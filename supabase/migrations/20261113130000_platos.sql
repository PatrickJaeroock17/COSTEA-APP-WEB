-- Costea · Fase 7: platos y recetas.
-- Reglas de legacy/Costea-main/costos_app/app/routes/products.py, services/personalization.py,
-- services/product_deletion.py y forms/product.py:
--   · Editar una receta crea la versión siguiente; las anteriores quedan intactas (historial inmutable).
--   · Bloqueo optimista con products.revision: si otro cambio llegó antes, se rechaza.
--   · Cada línea guarda la fotografía exacta: precio usado, equivalencia y su sustento.
--   · Personalizar un plato del catálogo copia sus insumos y exige stock para un lote.
--   · Solo se elimina un plato sin ventas, sin planes y sin gastos asignados.
--   · Cambio respecto del original: la mano de obra de la receta (recipe_work) pasa a la versión nueva.

-- ───────────── Disponible en kardex (legacy: stock_shortages) ─────────────

-- Saldo a la fecha, descontando lo ya comprometido por salidas posteriores (mínimo del saldo futuro).
create or replace function public.material_available(p_material bigint, p_on date)
returns numeric language sql stable security invoker set search_path = '' as $$
  with mv as (
    select movement_on,
           sum(case when kind = 'in' then quantity else -quantity end)
             over (order by movement_on, kind, id rows between unbounded preceding and current row) as balance,
           row_number() over (order by movement_on desc, kind desc, id desc) as rev
    from public.inventory_movements
    where material_id = p_material and not voided
  )
  select least(
    coalesce((select balance from mv where movement_on <= p_on order by rev limit 1), 0),
    coalesce((select min(balance) from mv where movement_on > p_on), 'Infinity'::numeric)
  );
$$;

-- Cantidad bruta en unidad base de una línea (legacy: calculate_line → gross_quantity).
create or replace function public.recipe_line_gross(quantity numeric, factor numeric, mode text, rate numeric)
returns numeric language sql immutable set search_path = '' as $$
  select case mode
    when 'loss' then quantity * factor / (1 - rate)
    when 'additional' then quantity * factor * (1 + rate)
    else quantity * factor
  end;
$$;

-- Rechaza si el kardex no alcanza para `batches` lotes de la versión de receta (legacy: require_stock).
create or replace function public._require_recipe_stock(p_recipe bigint, p_output numeric)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r record;
  missing text := '';
begin
  for r in
    select l.material_id, m.name, m.variety, u.symbol,
           sum(public.recipe_line_gross(l.quantity, l.factor, l.mode, l.rate)) * p_output / v.output_quantity as needed
    from public.recipe_lines l
    join public.recipe_versions v on v.id = l.recipe_id
    join public.materials m on m.id = l.material_id
    join public.units u on u.code = m.base_unit_code
    where l.recipe_id = p_recipe
    group by l.material_id, m.name, m.variety, u.symbol, v.output_quantity
    order by m.name
  loop
    if public.material_available(r.material_id, public.lima_today()) < r.needed then
      missing := missing || case when missing = '' then '' else '; ' end ||
        btrim(r.name || ' ' || coalesce(r.variety, '')) || ': se necesitan ' || trim_scale(round(r.needed, 6))::text || ' ' || r.symbol ||
        ', disponibles ' || trim_scale(round(greatest(public.material_available(r.material_id, public.lima_today()), 0), 6))::text || ' ' || r.symbol;
    end if;
  end loop;
  if missing <> '' then
    raise exception 'No se puede elaborar el plato. Insumos insuficientes en el inventario: %. Registra las compras faltantes.', missing
      using errcode = 'P0001';
  end if;
end $$;

-- ───────────── Nombre de plato sin duplicados ─────────────

create unique index products_name_uq on public.products (restaurant_id, lower(regexp_replace(btrim(name), '\s+', ' ', 'g')));

-- ───────────── Nueva versión de receta ─────────────

-- p_lines: arreglo de {material_id, cost_version_id, quantity, unit_key, mode, rate}.
-- unit_key: 'unit:<código>' (equivalencia universal) · 'custom:<id>' (presentación del insumo) ·
-- o la misma clave de la versión anterior para ese insumo (conserva su factor explícito).
create or replace function public._new_recipe_version(
  p_product bigint,
  p_revision int,
  p_output_quantity numeric,
  p_lines jsonb,
  p_author uuid
)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  p record;
  prev record;
  rid bigint;
  spec jsonb;
  pos int := 0;
  m record;
  cv record;
  base record;
  u record;
  prev_line record;
  f numeric;
  lbl text;
  ev text;
  qty numeric;
  md text;
  rt numeric;
begin
  select pr.*, r.currency into p from public.products pr join public.restaurants r on r.id = pr.restaurant_id where pr.id = p_product for update of pr;
  if p.revision <> p_revision then
    raise exception 'La receta cambió mientras la editabas. Recarga la página y vuelve a intentarlo.' using errcode = 'P0001';
  end if;
  select * into prev from public.recipe_versions where product_id = p_product order by number desc limit 1;
  if p_output_quantity is null or p_output_quantity <= 0 then
    raise exception 'El rendimiento debe ser mayor que cero.' using errcode = 'P0001';
  end if;
  update public.products set revision = revision + 1 where id = p_product;
  insert into public.recipe_versions (restaurant_id, product_id, number, author_id, output_quantity, output_unit_code, currency, product_name)
  values (p.restaurant_id, p_product, p_revision + 1, p_author, p_output_quantity, coalesce(prev.output_unit_code, 'unit'), p.currency, p.name)
  returning id into rid;

  for spec in select value from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
    pos := pos + 1;
    select * into m from public.materials where id = (spec ->> 'material_id')::bigint and restaurant_id = p.restaurant_id;
    if not found then
      raise exception 'Insumo inexistente en este restaurante.' using errcode = 'P0001';
    end if;
    select * into prev_line from public.recipe_lines where recipe_id = prev.id and material_id = m.id;
    if not m.active and prev_line.id is null then
      raise exception '% está archivado. Restáuralo para usarlo en recetas.', m.name using errcode = 'P0001';
    end if;
    select * into cv from public.material_cost_versions where id = (spec ->> 'cost_version_id')::bigint and material_id = m.id;
    if not found then
      raise exception 'Elige un precio de %.', m.name using errcode = 'P0001';
    end if;
    if cv.currency <> p.currency then
      raise exception 'El precio de % está en otra moneda.', m.name using errcode = 'P0001';
    end if;
    qty := (spec ->> 'quantity')::numeric;
    md := coalesce(spec ->> 'mode', 'gross');
    rt := coalesce((spec ->> 'rate')::numeric, 0);
    if qty is null or qty <= 0 then
      raise exception 'La cantidad de % debe ser mayor que cero.', m.name using errcode = 'P0001';
    end if;
    if md = 'loss' and rt >= 1 then
      raise exception 'La merma de % debe ser menor que 100 %%.', m.name using errcode = 'P0001';
    end if;
    if md = 'gross' and rt <> 0 then
      raise exception 'En cantidad bruta de % ingresa 0 %% para no duplicar la merma.', m.name using errcode = 'P0001';
    end if;

    select * into base from public.units where code = m.base_unit_code;
    f := null;
    if spec ->> 'unit_key' like 'unit:%' then
      select * into u from public.units where code = substr(spec ->> 'unit_key', 6);
      if found and u.dimension = base.dimension then
        f := trim_scale((u.numerator::numeric * base.denominator) / (u.denominator::numeric * base.numerator));
        lbl := u.symbol;
        ev := 'Equivalencia universal de unidades compatibles.';
      end if;
    elsif spec ->> 'unit_key' like 'custom:%' then
      select c.factor, c.label, c.evidence into f, lbl, ev from public.material_conversions c
      where c.id = substr(spec ->> 'unit_key', 8)::bigint and c.material_id = m.id;
    end if;
    if f is null and prev_line.id is not null and prev_line.unit_key = spec ->> 'unit_key' then
      f := prev_line.factor; lbl := prev_line.unit_label; ev := prev_line.conversion_evidence;
    end if;
    if f is null then
      raise exception 'La unidad elegida para % no tiene equivalencia con su unidad base. Registra una presentación del insumo.', m.name using errcode = 'P0001';
    end if;
    begin
      insert into public.recipe_lines (restaurant_id, recipe_id, position, material_id, cost_version_id, material_name, quantity, unit_key, unit_label, factor, conversion_evidence, mode, rate)
      values (p.restaurant_id, rid, pos, m.id, cv.id, btrim(m.name || ' ' || coalesce(m.variety, '')), qty, spec ->> 'unit_key', lbl, f, ev, md, rt);
    exception when unique_violation then
      raise exception '% ya está en la receta. Edita su fila para cambiar la cantidad o el precio.', m.name using errcode = 'P0001';
    end;
  end loop;

  -- La mano de obra asignada a la receta pasa a la nueva versión.
  insert into public.recipe_work (restaurant_id, recipe_id, no_materials, no_labor, operations)
  select restaurant_id, rid, no_materials, no_labor, operations from public.recipe_work where recipe_id = prev.id;
  return rid;
end $$;

create or replace function public._product_for_edit(p_product bigint)
returns public.products language plpgsql security definer set search_path = '' as $$
declare
  p public.products;
begin
  select * into p from public.products where id = p_product;
  if not found or not public.can_edit(p.restaurant_id) then
    raise exception 'No tienes permiso para editar este plato.' using errcode = '42501';
  end if;
  if not p.active then
    raise exception 'Restaura el plato antes de editar su receta.' using errcode = 'P0001';
  end if;
  return p;
end $$;

-- ───────────── API ───────────── --

create or replace function public.create_product(
  p_restaurant uuid,
  p_name text,
  p_description text default null,
  p_menu_category text default null,
  p_output_quantity numeric default 1
)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  pid bigint;
  cur text;
begin
  if not public.can_edit(p_restaurant) then
    raise exception 'No tienes permiso para crear platos en este restaurante.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 180 then
    raise exception 'Escribe el nombre del plato (hasta 180 caracteres).' using errcode = 'P0001';
  end if;
  if p_output_quantity is null or p_output_quantity <= 0 then
    raise exception 'El rendimiento debe ser mayor que cero.' using errcode = 'P0001';
  end if;
  select currency into cur from public.restaurants where id = p_restaurant;
  begin
    insert into public.products (restaurant_id, code, name, description, menu_category)
    values (p_restaurant, 'P-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)), btrim(p_name),
            nullif(btrim(coalesce(p_description, '')), ''), nullif(btrim(coalesce(p_menu_category, '')), ''))
    returning id into pid;
  exception when unique_violation then
    raise exception 'Ya existe un plato con este nombre. Edita su receta o revisa los archivados.' using errcode = 'P0001';
  end;
  insert into public.recipe_versions (restaurant_id, product_id, number, author_id, output_quantity, output_unit_code, currency, product_name)
  values (p_restaurant, pid, 1, (select auth.uid()), p_output_quantity, 'unit', cur, btrim(p_name));
  return pid;
end $$;

-- Reemplaza todas las líneas (agregar, editar o quitar un insumo) y crea la versión siguiente.
create or replace function public.save_recipe(p_product bigint, p_revision int, p_lines jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  p public.products := public._product_for_edit(p_product);
  out_qty numeric;
begin
  select output_quantity into out_qty from public.recipe_versions where product_id = p_product order by number desc limit 1;
  return public._new_recipe_version(p_product, p_revision, out_qty, p_lines, (select auth.uid()));
end $$;

-- Copia las líneas de la versión vigente como especificación.
create or replace function public._current_lines(p_product bigint, multiplier numeric default 1)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'material_id', l.material_id, 'cost_version_id', l.cost_version_id, 'quantity', trim_scale(l.quantity * multiplier),
    'unit_key', l.unit_key, 'mode', l.mode, 'rate', l.rate) order by l.position), '[]'::jsonb)
  from public.recipe_lines l
  where l.recipe_id = (select id from public.recipe_versions where product_id = p_product order by number desc limit 1);
$$;

-- Datos del plato (nombre, descripción, categoría y rendimiento). Cambiar el rendimiento sin escalar
-- exige stock para un lote de la receta vigente (legacy: edit con require_stock).
create or replace function public.update_product(
  p_product bigint,
  p_revision int,
  p_name text,
  p_description text,
  p_menu_category text,
  p_output_quantity numeric
)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  p public.products := public._product_for_edit(p_product);
  prev record;
begin
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 180 then
    raise exception 'Escribe el nombre del plato (hasta 180 caracteres).' using errcode = 'P0001';
  end if;
  select * into prev from public.recipe_versions where product_id = p_product order by number desc limit 1;
  if p_output_quantity is distinct from prev.output_quantity then
    perform public._require_recipe_stock(prev.id, prev.output_quantity);
  end if;
  begin
    update public.products
    set name = btrim(p_name), description = nullif(btrim(coalesce(p_description, '')), ''),
        menu_category = nullif(btrim(coalesce(p_menu_category, '')), '')
    where id = p_product;
  exception when unique_violation then
    raise exception 'Ya existe un plato con este nombre. Edita su receta o revisa los archivados.' using errcode = 'P0001';
  end;
  return public._new_recipe_version(p_product, p_revision, p_output_quantity, public._current_lines(p_product), (select auth.uid()));
end $$;

-- Escala todas las cantidades al nuevo rendimiento; exige stock para el nuevo lote (legacy: scale).
create or replace function public.scale_recipe(p_product bigint, p_revision int, p_output_quantity numeric)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  p public.products := public._product_for_edit(p_product);
  prev record;
  rid bigint;
begin
  select * into prev from public.recipe_versions where product_id = p_product order by number desc limit 1;
  if p_output_quantity is null or p_output_quantity <= 0 then
    raise exception 'El nuevo rendimiento debe ser mayor que cero.' using errcode = 'P0001';
  end if;
  perform public._require_recipe_stock(prev.id, p_output_quantity);
  rid := public._new_recipe_version(p_product, p_revision, p_output_quantity,
    public._current_lines(p_product, p_output_quantity / prev.output_quantity), (select auth.uid()));
  return rid;
end $$;

-- ───────────── Platos del catálogo (legacy: personalize) ─────────────

create or replace function public.personalize_dish(p_restaurant uuid, p_dish int)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  d record;
  det record;
  pid bigint;
  rid bigint;
  mid bigint;
  cost_id bigint;
  unit_code text;
  u record;
  cur text;
begin
  if not public.can_edit(p_restaurant) then
    raise exception 'No tienes permiso para crear platos en este restaurante.' using errcode = '42501';
  end if;
  select currency into cur from public.restaurants where id = p_restaurant;
  select * into d from public.catalogo_platos where id_plato = p_dish;
  if not found then
    raise exception 'El plato del catálogo no existe.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.products where restaurant_id = p_restaurant and source_key = 'catalogo:' || p_dish) then
    raise exception 'Ya personalizaste este plato. Abre tu receta existente, incluso si está archivada.' using errcode = 'P0001';
  end if;
  begin
    insert into public.products (restaurant_id, code, name, description, menu_category, source_key, source_version)
    values (p_restaurant, 'P-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)), d.nombre, d.descripcion,
            d.categoria_menu, 'catalogo:' || p_dish, '1')
    returning id into pid;
  exception when unique_violation then
    raise exception 'Ya tienes un plato llamado %. Cámbiale el nombre antes de traer el del catálogo.', d.nombre using errcode = 'P0001';
  end;
  insert into public.recipe_versions (restaurant_id, product_id, number, author_id, output_quantity, output_unit_code, currency, product_name)
  values (p_restaurant, pid, 1, (select auth.uid()), d.porciones, 'unit', cur, d.nombre)
  returning id into rid;

  for det in select * from public.catalogo_receta_detalles where id_plato = p_dish order by orden loop
    mid := public._add_catalog_material(p_restaurant, det.id_insumo, (select auth.uid()));
    select id into cost_id from public.material_cost_versions
    where material_id = mid and mode = 'direct' and source like 'Catálogo General ·%'
    order by effective_on desc, id desc limit 1;
    unit_code := case det.unidad_receta when 'unid' then 'unit' else det.unidad_receta end;
    select * into u from public.units where code = unit_code;
    insert into public.recipe_lines (restaurant_id, recipe_id, position, material_id, cost_version_id, material_name, quantity, unit_key, unit_label, factor, conversion_evidence, mode, rate)
    select p_restaurant, rid, det.orden, mid, cost_id, btrim(m.name || ' ' || coalesce(m.variety, '')), det.cantidad,
           'unit:' || unit_code, u.symbol, det.factor_a_unidad_base, 'Factor explícito de la receta del catálogo.',
           case when det.merma_pct > 0 then 'loss' else 'gross' end, det.merma_pct / 100
    from public.materials m where m.id = mid;
  end loop;
  perform public._require_recipe_stock(rid, d.porciones);
  return pid;
end $$;

-- ───────────── Eliminar (legacy: delete_product) ─────────────

create or replace function public.reject_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- Única excepción: borrar un plato sin uso (la marca solo la pone delete_product en su transacción).
  if tg_op = 'DELETE' and current_setting('costea.purge_product', true) = 'on' then
    return old;
  end if;
  raise exception 'El historial es inmutable. Registra una nueva versión.' using errcode = 'P0001';
end $$;

create or replace function public.delete_product(p_product bigint, p_revision int)
returns void language plpgsql security definer set search_path = '' as $$
declare
  p record;
begin
  select * into p from public.products where id = p_product for update;
  if not found or not public.can_edit(p.restaurant_id) then
    raise exception 'No tienes permiso para eliminar este plato.' using errcode = '42501';
  end if;
  if p.revision <> p_revision then
    raise exception 'El plato cambió. Recarga la página.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.sales where product_id = p_product) then
    raise exception 'No se puede eliminar este plato porque tiene ventas registradas.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.plan_lines where product_id = p_product) then
    raise exception 'No se puede eliminar este plato porque está incluido en un plan de producción.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.cost_concepts where restaurant_id = p.restaurant_id and targets @> to_jsonb(p_product)) then
    raise exception 'No se puede eliminar este plato porque tiene costos o gastos asignados.' using errcode = 'P0001';
  end if;
  perform set_config('costea.purge_product', 'on', true);
  delete from public.recipe_lines where recipe_id in (select id from public.recipe_versions where product_id = p_product);
  delete from public.recipe_work where recipe_id in (select id from public.recipe_versions where product_id = p_product);
  delete from public.recipe_versions where product_id = p_product;
  delete from public.product_prices where product_id = p_product;
  delete from public.products where id = p_product;
  perform set_config('costea.purge_product', 'off', true);
end $$;

-- ───────────── Permisos ─────────────

revoke execute on function public._require_recipe_stock(bigint, numeric), public._new_recipe_version(bigint, int, numeric, jsonb, uuid),
  public._product_for_edit(bigint), public._current_lines(bigint, numeric) from anon, authenticated, public;
revoke execute on function public.material_available(bigint, date), public.create_product(uuid, text, text, text, numeric),
  public.save_recipe(bigint, int, jsonb), public.update_product(bigint, int, text, text, text, numeric),
  public.scale_recipe(bigint, int, numeric), public.personalize_dish(uuid, int), public.delete_product(bigint, int) from anon, public;
grant execute on function public.material_available(bigint, date), public.create_product(uuid, text, text, text, numeric),
  public.save_recipe(bigint, int, jsonb), public.update_product(bigint, int, text, text, text, numeric),
  public.scale_recipe(bigint, int, numeric), public.personalize_dish(uuid, int), public.delete_product(bigint, int) to authenticated;
