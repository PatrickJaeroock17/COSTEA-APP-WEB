-- Costea · Fase 6: insumos.
-- Reglas de legacy/Costea-main/costos_app/app/routes/materials.py, services/material_identity.py,
-- services/catalog_selection.py, services/opening_stock.py y la migración f20261001010 (códigos comerciales).
--   · Código AAA-000: prefijo de la categoría + correlativo. El catálogo reserva sus códigos.
--   · Un insumo no se duplica por código ni por nombre + variedad dentro del restaurante.
--   · Agregar del catálogo crea el insumo y su precio (versión inmutable) en una transacción.
--   · Una compra registra la entrada del kardex y una nueva versión de precio, de forma idempotente.
--   · Los restaurantes en soles reciben una sola vez el stock inicial del catálogo.

-- ───────────── Prefijo de categoría (legacy: category_prefix) ─────────────

create or replace function public.category_prefix(category text)
returns text language plpgsql immutable set search_path = '' as $$
declare
  plain text := upper(translate(coalesce(category, ''), 'áéíóúàèìòùäëïöüâêîôûñçÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÂÊÎÔÛÑÇ', 'aeiouaeiouaeiouaeiouncAEIOUAEIOUAEIOUAEIOUNC'));
  w text;
  words text[] := '{}';
  p text;
begin
  foreach w in array regexp_split_to_array(btrim(regexp_replace(plain, '[^A-Z0-9]+', ' ', 'g')), ' ') loop
    if w <> '' and w not in ('DE', 'DEL', 'EL', 'LA', 'LAS', 'LOS', 'Y') then
      words := words || w;
    end if;
  end loop;
  if coalesce(array_length(words, 1), 0) = 0 then
    return 'INS';
  end if;
  p := left(words[1], 3);
  if length(p) < 3 then
    p := p || left(array_to_string(words[2:], ''), 3 - length(p));
  end if;
  return rpad(p, 3, 'X');
end $$;

-- ───────────── Códigos comerciales del catálogo ─────────────

alter table public.catalogo_insumos add column codigo_comercial text;
update public.catalogo_insumos i
set codigo_comercial = s.code
from (
  select i2.id_insumo,
         public.category_prefix(c.nombre) || '-' ||
         lpad((row_number() over (partition by public.category_prefix(c.nombre) order by i2.id_insumo))::text, 3, '0') as code
  from public.catalogo_insumos i2
  left join public.catalogo_categorias c on c.id_categoria = i2.id_categoria
) s
where s.id_insumo = i.id_insumo;
alter table public.catalogo_insumos
  alter column codigo_comercial set not null,
  add constraint catalogo_insumos_codigo_comercial_uq unique (codigo_comercial),
  add constraint catalogo_insumos_codigo_comercial_ck check (codigo_comercial ~ '^[A-Z]{3}-[0-9]{3}$');

-- Unidad del catálogo → unidad física (legacy: UNIT_CODES).
create or replace function public.catalog_unit_code(label text)
returns text language sql immutable set search_path = '' as $$
  select case lower(btrim(coalesce(label, '')))
    when 'kg' then 'kg' when 'kilogramo' then 'kg'
    when 'litro' then 'l' when 'l' then 'l'
    when 'g' then 'g' when 'gramo' then 'g'
    when 'ml' then 'ml' when 'mililitro' then 'ml'
    when 'unidad' then 'unit' when 'und' then 'unit' when 'unit' then 'unit'
  end;
$$;

-- ───────────── Reglas de la tabla materials ─────────────

-- Unidad base y origen de catálogo no cambian (los precios guardados conservan su denominador).
-- El código de un insumo del catálogo solo cambia en el catálogo maestro.
create or replace function public.materials_guard_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.base_unit_code is distinct from old.base_unit_code then
    raise exception 'La unidad base no se puede cambiar: los precios guardados dependen de ella.' using errcode = 'P0001';
  end if;
  if new.catalog_material_id is distinct from old.catalog_material_id then
    raise exception 'El origen de catálogo de un insumo no se puede cambiar.' using errcode = 'P0001';
  end if;
  if old.catalog_material_id is not null and new.code is distinct from old.code then
    raise exception 'El código de un insumo del Catálogo General solo puede cambiar en el catálogo maestro.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger materials_guard_update before update on public.materials
  for each row execute function public.materials_guard_update();

-- Duplicado por nombre + variedad (sin distinguir mayúsculas), incluidos archivados.
create unique index materials_name_variety_uq on public.materials
  (restaurant_id, lower(btrim(name)), lower(btrim(coalesce(variety, ''))));

-- Activa una unidad para el restaurante si este ya eligió unidades (sin filas = todas activas).
create or replace function public._enable_unit(rid uuid, unit text)
returns void language sql security definer set search_path = '' as $$
  insert into public.restaurant_units (restaurant_id, unit_code, enabled)
  select rid, unit, true
  where exists (select 1 from public.restaurant_units where restaurant_id = rid)
  on conflict (restaurant_id, unit_code) do update set enabled = true;
$$;

-- ───────────── Agregar insumo del catálogo (legacy: select_ingredient) ─────────────

create or replace function public._add_catalog_material(rid uuid, p_catalog_id int, author uuid)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  item record;
  unit text;
  mid bigint;
  current_unit text;
  eff date;
  cur text;
begin
  select currency into cur from public.restaurants where id = rid;
  if cur is distinct from 'PEN' then
    raise exception 'Los precios del catálogo están en soles. Usa un restaurante en PEN.' using errcode = 'P0001';
  end if;
  select i.*, coalesce(c.nombre, 'Sin categoría') as categoria, u.codigo as unidad
    into item
  from public.catalogo_insumos i
  left join public.catalogo_categorias c on c.id_categoria = i.id_categoria
  join public.catalogo_unidades_medida u on u.id_unidad = i.id_unidad
  where i.id_insumo = p_catalog_id;
  if not found then
    raise exception 'El insumo del catálogo no existe.' using errcode = 'P0001';
  end if;
  if not item.activo then
    raise exception 'Este insumo está inactivo. Solo se conserva para históricos.' using errcode = 'P0001';
  end if;
  unit := public.catalog_unit_code(item.unidad);
  if unit is null then
    raise exception 'La unidad de origen no tiene una equivalencia física configurada.' using errcode = 'P0001';
  end if;

  select id, base_unit_code into mid, current_unit
  from public.materials where restaurant_id = rid and catalog_material_id = p_catalog_id;
  if mid is null then
    if exists (select 1 from public.materials where restaurant_id = rid and code = item.codigo_comercial) then
      raise exception 'Ya existe el insumo % en este restaurante, incluso si está archivado.', item.codigo_comercial using errcode = 'P0001';
    end if;
    if exists (
      select 1 from public.materials
      where restaurant_id = rid and lower(btrim(name)) = lower(btrim(item.nombre))
        and lower(btrim(coalesce(variety, ''))) = lower(btrim(coalesce(item.variedad, '')))
    ) then
      raise exception 'Ya existe % % en este restaurante. Abre ese insumo para registrar un precio nuevo.', item.nombre, coalesce(item.variedad, '') using errcode = 'P0001';
    end if;
    insert into public.materials (restaurant_id, code, catalog_material_id, name, variety, category, base_unit_code)
    values (rid, item.codigo_comercial, p_catalog_id, item.nombre, item.variedad, item.categoria, unit)
    returning id into mid;
  else
    if current_unit <> unit then
      raise exception 'La unidad de origen cambió. Revisa la equivalencia antes de continuar.' using errcode = 'P0001';
    end if;
    update public.materials
    set active = true, name = item.nombre, variety = item.variedad, category = item.categoria
    where id = mid;
  end if;
  perform public._enable_unit(rid, unit);

  eff := (item.fecha_actualizacion at time zone 'America/Lima')::date;
  if not exists (
    select 1 from public.material_cost_versions
    where material_id = mid and mode = 'direct' and effective_on = eff and unit_cost = item.precio_mayorista
  ) then
    insert into public.material_cost_versions (restaurant_id, material_id, author_id, effective_on, mode, source, currency, unit_cost)
    values (rid, mid, author, eff, 'direct',
            'Catálogo General · ' || item.codigo_comercial || ' · actualización ' || to_char(eff, 'YYYY-MM-DD'),
            'PEN', item.precio_mayorista);
  end if;
  return mid;
end $$;

create or replace function public.add_catalog_material(p_restaurant uuid, p_catalog_id int)
returns bigint language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_edit(p_restaurant) then
    raise exception 'No tienes permiso para agregar insumos en este restaurante.' using errcode = '42501';
  end if;
  return public._add_catalog_material(p_restaurant, p_catalog_id, (select auth.uid()));
end $$;

-- ───────────── Stock inicial del catálogo (legacy: register_opening_stock) ─────────────

create or replace function public._seed_catalog_opening(rid uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare
  r record;
  item record;
  mid bigint;
  opening date;
  created int := 0;
begin
  select owner_id, currency, created_at into r from public.restaurants where id = rid;
  if not found or r.currency <> 'PEN' then
    return 0;
  end if;
  -- La apertura va antes de toda la actividad registrada del restaurante.
  select least(
    public.lima_today(),
    (r.created_at at time zone 'America/Lima')::date,
    coalesce((select min(make_date(year, month, 1)) from public.periods where restaurant_id = rid), 'infinity'::date),
    coalesce((select min(movement_on) from public.inventory_movements where restaurant_id = rid), 'infinity'::date)
  ) into opening;

  for item in
    select id_insumo, stock_inicial, precio_mayorista from public.catalogo_insumos
    where activo and stock_inicial > 0 order by id_insumo
  loop
    select id into mid from public.materials where restaurant_id = rid and catalog_material_id = item.id_insumo;
    if mid is not null and exists (
      select 1 from public.inventory_movements
      where restaurant_id = rid and material_id = mid and reference = 'Stock inicial · catálogo'
    ) then
      continue; -- Nunca se repone stock ya consumido o anulado.
    end if;
    begin
      mid := public._add_catalog_material(rid, item.id_insumo, r.owner_id);
    exception when others then
      continue; -- Un insumo propio con el mismo nombre tiene prioridad: no se duplica.
    end;
    insert into public.inventory_movements (restaurant_id, material_id, movement_on, kind, quantity, unit_cost, reference)
    values (rid, mid, opening, 'in', item.stock_inicial, item.precio_mayorista, 'Stock inicial · catálogo');
    created := created + 1;
  end loop;
  return created;
end $$;

-- ───────────── Insumo propio (legacy: quick_create) ─────────────

create or replace function public.create_material(
  p_restaurant uuid,
  p_name text,
  p_variety text,
  p_category text,
  p_unit text,
  p_unit_cost numeric,
  p_effective_on date,
  p_supplier text default null
)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  prefix text;
  seq int;
  new_code text;
  dup_code text;
  dup_name text;
  mid bigint;
  r record;
begin
  if not public.can_edit(p_restaurant) then
    raise exception 'No tienes permiso para agregar insumos en este restaurante.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 100 then
    raise exception 'Escribe el nombre del insumo (hasta 100 caracteres).' using errcode = 'P0001';
  end if;
  if char_length(btrim(coalesce(p_category, ''))) not between 1 and 100 then
    raise exception 'Elige una categoría.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.units where code = p_unit) then
    raise exception 'Elige una unidad válida.' using errcode = 'P0001';
  end if;
  if p_unit_cost is null or p_unit_cost < 0 or p_effective_on is null then
    raise exception 'Ingresa un precio no negativo y su fecha.' using errcode = 'P0001';
  end if;
  select legal_name, trade_name, currency into r from public.restaurants where id = p_restaurant;

  -- Un código a la vez por restaurante.
  perform pg_advisory_xact_lock(hashtextextended(p_restaurant::text, 6));
  if exists (
    select 1 from public.materials
    where restaurant_id = p_restaurant and lower(btrim(name)) = lower(btrim(p_name))
      and lower(btrim(coalesce(variety, ''))) = lower(btrim(coalesce(p_variety, '')))
  ) then
    select m2.code, btrim(m2.name || ' ' || coalesce(m2.variety, '')) into dup_code, dup_name from public.materials m2
    where m2.restaurant_id = p_restaurant and lower(btrim(m2.name)) = lower(btrim(p_name))
      and lower(btrim(coalesce(m2.variety, ''))) = lower(btrim(coalesce(p_variety, '')));
    raise exception 'Ya existe % con el código % en este restaurante. Abre ese insumo para registrar un precio nuevo.', dup_name, dup_code using errcode = 'P0001';
  end if;
  prefix := public.category_prefix(p_category);
  select coalesce(max(substr(c, 5, 3)::int), 0) + 1 into seq
  from (
    select codigo_comercial as c from public.catalogo_insumos where codigo_comercial like prefix || '-%'
    union all
    select m.code from public.materials m where m.restaurant_id = p_restaurant and m.code like prefix || '-%'
  ) s;
  if seq > 999 then
    raise exception 'La categoría % alcanzó el máximo de 999 insumos en este restaurante.', prefix using errcode = 'P0001';
  end if;
  new_code := prefix || '-' || lpad(seq::text, 3, '0');
  insert into public.materials (restaurant_id, code, name, variety, category, supplier, base_unit_code)
  values (p_restaurant, new_code, btrim(p_name), nullif(btrim(coalesce(p_variety, '')), ''), btrim(p_category),
          nullif(btrim(coalesce(p_supplier, '')), ''), p_unit)
  returning id into mid;
  perform public._enable_unit(p_restaurant, p_unit);
  insert into public.material_cost_versions (restaurant_id, material_id, author_id, effective_on, mode, source, currency, unit_cost)
  values (p_restaurant, mid, (select auth.uid()), p_effective_on, 'direct',
          'Alta propia · ' || coalesce(r.trade_name, r.legal_name), r.currency, p_unit_cost);
  return mid;
end $$;

-- ───────────── Compra al kardex (legacy: add_inventory_entry) ─────────────

-- p_unit: 'unit:<código>' (equivalencia universal de la misma dimensión) o 'custom:<id>' (equivalencia del insumo).
create or replace function public.register_purchase(
  p_material bigint,
  p_quantity numeric,
  p_unit text,
  p_unit_price numeric,
  p_date date,
  p_token text
)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  m record;
  base record;
  u record;
  factor numeric;
  label text;
  entry_label text;
  movement bigint;
begin
  select mt.*, r.currency into m
  from public.materials mt join public.restaurants r on r.id = mt.restaurant_id
  where mt.id = p_material;
  if not found or not public.can_edit(m.restaurant_id) then
    raise exception 'No tienes permiso para registrar compras de este insumo.' using errcode = '42501';
  end if;
  if not m.active then
    raise exception 'El insumo está archivado. Restáuralo para registrar compras.' using errcode = 'P0001';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La cantidad comprada debe ser mayor que cero.' using errcode = 'P0001';
  end if;
  if p_unit_price is null or p_unit_price < 0 or p_date is null then
    raise exception 'Ingresa un precio no negativo y la fecha.' using errcode = 'P0001';
  end if;
  if p_token !~ '^[0-9a-f]{32}$' then
    raise exception 'Solicitud inválida. Recarga la página.' using errcode = 'P0001';
  end if;

  select * into base from public.units where code = m.base_unit_code;
  if p_unit like 'unit:%' then
    select * into u from public.units where code = substr(p_unit, 6);
    if not found or u.dimension <> base.dimension then
      raise exception 'Esa unidad no es compatible con la unidad base del insumo.' using errcode = 'P0001';
    end if;
    factor := (u.numerator::numeric * base.denominator) / (u.denominator::numeric * base.numerator);
    label := u.name;
  elsif p_unit like 'custom:%' then
    select c.factor, c.label into factor, label from public.material_conversions c
    where c.id = substr(p_unit, 8)::bigint and c.material_id = p_material;
    if not found then
      raise exception 'Esa presentación no existe para este insumo.' using errcode = 'P0001';
    end if;
  else
    raise exception 'Elige la unidad de compra.' using errcode = 'P0001';
  end if;

  entry_label := case when exists (
    select 1 from public.inventory_movements where material_id = p_material and not voided
  ) then 'Compra' else 'Inventario inicial' end;
  begin
    insert into public.inventory_movements (restaurant_id, material_id, movement_on, kind, quantity, unit_cost, reference)
    values (m.restaurant_id, p_material, p_date, 'in', trim_scale(p_quantity * factor), trim_scale(p_unit_price / factor),
            'Entrada ' || m.code || ' · ' || p_token)
    returning id into movement;
  exception when unique_violation then
    raise exception 'Esta entrada ya fue registrada. Recarga la ficha antes de reintentar.' using errcode = 'P0001';
  end;
  insert into public.material_cost_versions (restaurant_id, material_id, author_id, effective_on, mode, source, currency, unit_cost)
  values (m.restaurant_id, p_material, (select auth.uid()), p_date, 'direct',
          entry_label || ' / Kardex · ' || label, m.currency, trim_scale(p_unit_price / factor));
  return movement;
end $$;

-- ───────────── Permisos ─────────────

revoke execute on function public._enable_unit(uuid, text), public._add_catalog_material(uuid, int, uuid),
  public._seed_catalog_opening(uuid) from anon, authenticated, public;
revoke execute on function public.add_catalog_material(uuid, int), public.create_material(uuid, text, text, text, text, numeric, date, text),
  public.register_purchase(bigint, numeric, text, numeric, date, text) from anon, public;
grant execute on function public.add_catalog_material(uuid, int), public.create_material(uuid, text, text, text, text, numeric, date, text),
  public.register_purchase(bigint, numeric, text, numeric, date, text) to authenticated;

-- ───────────── Alta de restaurantes con stock inicial ─────────────

-- create_restaurant pasa a security definer para poder sembrar el catálogo; inserta siempre con el usuario actual.
create or replace function public.create_restaurant(
  p_legal_name text,
  p_trade_name text default null,
  p_tax_id_kind text default 'peru_ruc',
  p_tax_id text default null,
  p_currency text default 'PEN',
  p_year int default null,
  p_month int default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  rid uuid := gen_random_uuid();
  today date := public.lima_today();
begin
  if (select auth.uid()) is null then
    raise exception 'Inicia sesión para crear un restaurante.' using errcode = '42501';
  end if;
  insert into public.restaurants (id, owner_id, legal_name, trade_name, tax_id_kind, tax_id, currency, default_tax_rate)
  values (
    rid, (select auth.uid()), btrim(p_legal_name), nullif(btrim(coalesce(p_trade_name, '')), ''),
    coalesce(p_tax_id_kind, 'peru_ruc'), nullif(btrim(coalesce(p_tax_id, '')), ''), coalesce(p_currency, 'PEN'), 0.18
  );
  insert into public.periods (restaurant_id, year, month, tax_rate)
  values (rid, coalesce(p_year, extract(year from today)::int), coalesce(p_month, extract(month from today)::int), 0.18);
  perform public._seed_catalog_opening(rid);
  return rid;
end $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  restaurant_name text := nullif(btrim(meta ->> 'restaurant'), '');
  rid uuid := gen_random_uuid();
  today date := public.lima_today();
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    left(coalesce(nullif(btrim(meta ->> 'name'), ''), nullif(btrim(meta ->> 'full_name'), ''), split_part(new.email, '@', 1), ''), 100)
  );
  if restaurant_name is not null and char_length(restaurant_name) >= 2 then
    insert into public.restaurants (id, owner_id, legal_name) values (rid, new.id, left(restaurant_name, 180));
    insert into public.periods (restaurant_id, year, month, tax_rate)
    values (rid, extract(year from today)::int, extract(month from today)::int, 0.18);
    perform public._seed_catalog_opening(rid);
  end if;
  return new;
end $$;

-- Restaurantes existentes en soles: stock inicial una sola vez.
select public._seed_catalog_opening(id) from public.restaurants where currency = 'PEN';
