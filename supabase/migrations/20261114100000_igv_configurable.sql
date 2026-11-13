-- Costea · IGV configurable por restaurante.
-- Antes: 18 % fijo (legacy forzaba 0.18 para restaurantes). Ahora cada restaurante elige su tasa (régimen general
-- 18 %, MYPE restaurante con tasa reducida, u otra entre 0 y 30 %).
--   · restaurants.igv_rate: tasa vigente, por defecto 0.18.
--   · sales.igv_rate: tasa congelada al vender. Las ventas existentes se registraron con 18 %.
--   · Planes: la venta de referencia inicial y la tasa de cada línea usan la tasa del restaurante.
--   · Al cambiar la tasa, los planes pierden su cálculo revisado (vuelven a "Revisar cálculo").
--   · Los presupuestos publicados no cambian: su fotografía guarda la tasa usada.

alter table public.restaurants
  add column igv_rate numeric(7, 6) not null default 0.18 check (igv_rate between 0 and 0.30);

alter table public.sales
  add column igv_rate numeric(7, 6) not null default 0.18 check (igv_rate between 0 and 1);

create or replace function public.restaurants_igv_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.igv_rate is distinct from old.igv_rate then
    update public.production_plans set calculation_hash = null where restaurant_id = new.id;
    update public.plan_lines set tax_rate = new.igv_rate where restaurant_id = new.id;
  end if;
  return new;
end $$;
revoke execute on function public.restaurants_igv_changed() from anon, authenticated, public;
create trigger restaurants_igv_changed after update of igv_rate on public.restaurants
  for each row execute function public.restaurants_igv_changed();

create or replace function public.register_sale(p_period bigint, p_product bigint, p_sold_on date, p_quantity numeric, p_unit_cost numeric)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  p record;
  per record;
  rid bigint;
  price numeric;
  sid bigint;
  r record;
  missing text := '';
  shortages jsonb := '[]'::jsonb;
  tag text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
begin
  select * into p from public.products where id = p_product;
  if not found or not public.can_edit(p.restaurant_id) then
    raise exception 'No tienes permiso para registrar ventas en este restaurante.' using errcode = '42501';
  end if;
  if not p.active then
    raise exception 'El plato está archivado.' using errcode = 'P0001';
  end if;
  select * into per from public.periods where id = p_period and restaurant_id = p.restaurant_id;
  if not found or p_sold_on is null or extract(year from p_sold_on) <> per.year or extract(month from p_sold_on) <> per.month then
    raise exception 'Registra una fecha dentro del mes de trabajo.' using errcode = 'P0001';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La cantidad vendida debe ser mayor que cero.' using errcode = 'P0001';
  end if;
  select amount into price from public.product_prices where product_id = p_product;
  if price is null then
    raise exception 'Asigna primero el precio de carta del plato.' using errcode = 'P0001';
  end if;
  rid := public._latest_recipe(p_product);
  if not exists (select 1 from public.recipe_lines where recipe_id = rid) then
    raise exception 'Completa los insumos de la receta antes de registrar ventas.' using errcode = 'P0001';
  end if;
  if p_unit_cost is null or p_unit_cost < 0 then
    raise exception 'No se pudo calcular el costo de la receta.' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p.restaurant_id::text, 14));
  for r in
    select l.material_id, m.name, m.variety, u.symbol,
           sum(public.recipe_line_gross(l.quantity, l.factor, l.mode, l.rate)) * p_quantity / v.output_quantity as needed
    from public.recipe_lines l
    join public.recipe_versions v on v.id = l.recipe_id
    join public.materials m on m.id = l.material_id
    join public.units u on u.code = m.base_unit_code
    where l.recipe_id = rid
    group by l.material_id, m.name, m.variety, u.symbol, v.output_quantity
    order by m.name
  loop
    if public.material_available(r.material_id, p_sold_on) < r.needed then
      shortages := shortages || jsonb_build_object('name', btrim(r.name || ' ' || coalesce(r.variety, '')), 'unit', r.symbol,
        'needed', trim_scale(r.needed)::text, 'available', trim_scale(greatest(public.material_available(r.material_id, p_sold_on), 0))::text);
      missing := missing || case when missing = '' then '' else '; ' end ||
        btrim(r.name || ' ' || coalesce(r.variety, '')) || ': se necesitan ' || trim_scale(round(r.needed, 6))::text || ' ' || r.symbol ||
        ', disponibles ' || trim_scale(round(greatest(public.material_available(r.material_id, p_sold_on), 0), 6))::text || ' ' || r.symbol;
    end if;
  end loop;
  if missing <> '' then
    raise exception 'No se puede elaborar el plato. Insumos insuficientes en el inventario: %. Registra las entradas faltantes.', missing
      using errcode = 'P0001', detail = shortages::text, hint = 'stock';
  end if;

  insert into public.sales (restaurant_id, product_id, recipe_id, sold_on, quantity, unit_price, unit_cost, igv_rate)
  values (p.restaurant_id, p_product, rid, p_sold_on, p_quantity, price, p_unit_cost,
          (select igv_rate from public.restaurants where id = p.restaurant_id))
  returning id into sid;
  insert into public.inventory_movements (restaurant_id, material_id, sale_id, movement_on, kind, quantity, unit_cost, reference)
  select p.restaurant_id, l.material_id, sid, p_sold_on, 'out',
         trim_scale(sum(public.recipe_line_gross(l.quantity, l.factor, l.mode, l.rate)) * p_quantity / v.output_quantity), 0,
         'Venta #' || sid || ' · ' || tag
  from public.recipe_lines l
  join public.recipe_versions v on v.id = l.recipe_id
  where l.recipe_id = rid
  group by l.material_id, v.output_quantity;
  return sid;
end $$;

create or replace function public.create_plan(
  p_restaurant uuid,
  p_period bigint,
  p_name text,
  p_price_date date,
  p_no_cif boolean,
  p_no_expenses boolean,
  p_lines jsonb
)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  pid bigint;
  spec jsonb;
  prod record;
  qty numeric;
  price numeric;
  factor numeric;
  problems text := '';
  rate numeric;
begin
  if not public.can_edit(p_restaurant) then
    raise exception 'No tienes permiso para crear planes en este restaurante.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.periods where id = p_period and restaurant_id = p_restaurant) then
    raise exception 'Elige un mes de trabajo del restaurante.' using errcode = 'P0001';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 180 then
    raise exception 'Escribe el nombre del plan (hasta 180 caracteres).' using errcode = 'P0001';
  end if;
  if p_price_date is null then
    raise exception 'Indica la fecha de referencia de los precios.' using errcode = 'P0001';
  end if;
  select igv_rate into rate from public.restaurants where id = p_restaurant;
  insert into public.production_plans (restaurant_id, period_id, name, price_date, no_cif, no_expenses, active)
  values (p_restaurant, p_period, btrim(p_name), p_price_date, coalesce(p_no_cif, false), coalesce(p_no_expenses, false),
          not exists (select 1 from public.production_plans where restaurant_id = p_restaurant and period_id = p_period))
  returning id into pid;

  for spec in select value from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
    select * into prod from public.products where id = (spec ->> 'product_id')::bigint and restaurant_id = p_restaurant and active;
    if not found then
      raise exception 'La selección contiene platos repetidos o ajenos al restaurante.' using errcode = 'P0001';
    end if;
    qty := nullif(spec ->> 'quantity', '')::numeric;
    price := nullif(spec ->> 'price', '')::numeric;
    factor := nullif(spec ->> 'factor', '')::numeric;
    if qty is null or qty <= 0 then problems := problems || prod.name || ': indica cantidad mensual mayor que cero. '; end if;
    if price is null or price <= 0 then problems := problems || prod.name || ': indica precio final mayor que cero. '; end if;
    if factor is null or factor <= 0 then problems := problems || prod.name || ': indica factor equivalente mayor que cero. '; end if;
    if problems = '' then
      begin
        insert into public.plan_lines (restaurant_id, plan_id, product_id, recipe_id, quantity, reference_price, equivalent_factor, pricing_mode, pricing_value, adopted_price, tax_rate)
        values (p_restaurant, pid, prod.id, public._latest_recipe(prod.id), qty, trim_scale(round(price / (1 + rate), 20)), factor, 'manual', price, null, rate);
      exception when unique_violation then
        raise exception 'La selección contiene platos repetidos o ajenos al restaurante.' using errcode = 'P0001';
      end;
    end if;
  end loop;
  if problems <> '' then
    raise exception '%', btrim(problems) using errcode = 'P0001';
  end if;
  return pid;
end $$;

create or replace function public.save_plan_line(
  p_plan bigint,
  p_product bigint,
  p_quantity numeric,
  p_reference_price numeric,
  p_equivalent_factor numeric,
  p_pricing_mode text,
  p_pricing_value numeric,
  p_adopted_price numeric,
  p_use_latest boolean default false
)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  pl public.production_plans := public._plan_for_edit(p_plan);
  current record;
  lid bigint;
begin
  if not exists (select 1 from public.products where id = p_product and restaurant_id = pl.restaurant_id) then
    raise exception 'El plato no pertenece a este restaurante.' using errcode = 'P0001';
  end if;
  if p_quantity is null or p_quantity < 0 then
    raise exception 'La cantidad mensual no puede ser negativa.' using errcode = 'P0001';
  end if;
  if p_reference_price is null or p_reference_price < 0 then
    raise exception 'La venta de referencia no puede ser negativa.' using errcode = 'P0001';
  end if;
  if p_equivalent_factor is null or p_equivalent_factor <= 0 then
    raise exception 'El factor equivalente debe ser mayor que cero.' using errcode = 'P0001';
  end if;
  if p_pricing_mode not in ('markup', 'margin', 'manual', 'food_cost') or p_pricing_value is null or p_pricing_value < 0 then
    raise exception 'Elige la modalidad de precio y un valor no negativo.' using errcode = 'P0001';
  end if;
  if p_pricing_mode = 'food_cost' and not (p_pricing_value > 0 and p_pricing_value <= 1) then
    raise exception 'El food cost objetivo debe ser mayor que 0 y como máximo 100 %%.' using errcode = 'P0001';
  end if;
  if p_pricing_mode = 'margin' and p_pricing_value >= 1 then
    raise exception 'El margen objetivo debe ser menor que 100 %%.' using errcode = 'P0001';
  end if;
  if p_adopted_price is not null and p_adopted_price < 0 then
    raise exception 'El precio adoptado no puede ser negativo.' using errcode = 'P0001';
  end if;
  select * into current from public.plan_lines where plan_id = p_plan and product_id = p_product;
  if found then
    update public.plan_lines
    set quantity = p_quantity, reference_price = p_reference_price, equivalent_factor = p_equivalent_factor,
        pricing_mode = p_pricing_mode, pricing_value = p_pricing_value, adopted_price = p_adopted_price, tax_rate = (select igv_rate from public.restaurants where id = pl.restaurant_id),
        recipe_id = case when p_use_latest then public._latest_recipe(p_product) else recipe_id end
    where id = current.id
    returning id into lid;
  else
    insert into public.plan_lines (restaurant_id, plan_id, product_id, recipe_id, quantity, reference_price, equivalent_factor, pricing_mode, pricing_value, adopted_price, tax_rate)
    values (pl.restaurant_id, p_plan, p_product, public._latest_recipe(p_product), p_quantity, p_reference_price, p_equivalent_factor, p_pricing_mode, p_pricing_value, p_adopted_price, (select igv_rate from public.restaurants where id = pl.restaurant_id))
    returning id into lid;
  end if;
  update public.production_plans set calculation_hash = null where id = p_plan;
  return lid;
end $$;
