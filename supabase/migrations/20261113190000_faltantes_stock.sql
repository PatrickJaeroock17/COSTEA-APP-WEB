-- Costea · Ajuste de la fase 13: el error de stock insuficiente lleva los faltantes como datos.
-- La validación es la misma (mismo cálculo, mismas condiciones y mismo mensaje); solo se agrega
-- DETAIL = JSON [{name, unit, needed, available}] y HINT = 'stock', para mostrarlos como tabla en la app.

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

  insert into public.sales (restaurant_id, product_id, recipe_id, sold_on, quantity, unit_price, unit_cost)
  values (p.restaurant_id, p_product, rid, p_sold_on, p_quantity, price, p_unit_cost)
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

create or replace function public.publish_budget(p_plan bigint, p_fingerprint text, p_snapshot jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  pl public.production_plans;
  previous record;
  bid bigint;
  r record;
  missing text := '';
  shortages jsonb := '[]'::jsonb;
begin
  select * into pl from public.production_plans where id = p_plan for update;
  if not found or not public.can_edit(pl.restaurant_id) then
    raise exception 'No tienes permiso para publicar este plan.' using errcode = '42501';
  end if;
  if p_fingerprint is null or pl.calculation_hash is distinct from p_fingerprint then
    raise exception 'No se publicó: faltan datos o cambiaron las entradas. Revisa el cálculo y vuelve a intentarlo.' using errcode = 'P0001';
  end if;

  select id, number, fingerprint into previous from public.budgets where plan_id = p_plan order by number desc limit 1;
  if previous.id is not null and previous.fingerprint = p_fingerprint then
    bid := previous.id;
  else
    insert into public.budgets (restaurant_id, plan_id, author_id, number, snapshot, fingerprint)
    values (pl.restaurant_id, p_plan, (select auth.uid()), coalesce(previous.number, 0) + 1, p_snapshot, p_fingerprint)
    returning id into bid;
  end if;

  -- Salidas del kardex una sola vez por plan (legacy: plan_outputs).
  if not exists (select 1 from public.inventory_movements where plan_id = p_plan and not voided) then
    perform pg_advisory_xact_lock(hashtextextended(pl.restaurant_id::text, 14));
    for r in
      select l.material_id, m.name, m.variety, u.symbol,
             sum(public.recipe_line_gross(l.quantity, l.factor, l.mode, l.rate) * pli.quantity / v.output_quantity) as needed
      from public.plan_lines pli
      join public.recipe_versions v on v.id = pli.recipe_id
      join public.recipe_lines l on l.recipe_id = v.id
      join public.materials m on m.id = l.material_id
      join public.units u on u.code = m.base_unit_code
      where pli.plan_id = p_plan and pli.quantity > 0
      group by l.material_id, m.name, m.variety, u.symbol
      order by m.name
    loop
      if public.material_available(r.material_id, pl.price_date) < r.needed then
      shortages := shortages || jsonb_build_object('name', btrim(r.name || ' ' || coalesce(r.variety, '')), 'unit', r.symbol,
        'needed', trim_scale(r.needed)::text, 'available', trim_scale(greatest(public.material_available(r.material_id, pl.price_date), 0))::text);
        missing := missing || case when missing = '' then '' else '; ' end ||
          btrim(r.name || ' ' || coalesce(r.variety, '')) || ': se necesitan ' || trim_scale(round(r.needed, 6))::text || ' ' || r.symbol ||
          ', disponibles ' || trim_scale(round(greatest(public.material_available(r.material_id, pl.price_date), 0), 6))::text || ' ' || r.symbol;
      end if;
    end loop;
    if missing <> '' then
      raise exception 'No se puede publicar: insumos insuficientes en el inventario al %: %. Registra las compras faltantes.', to_char(pl.price_date, 'DD/MM/YYYY'), missing
        using errcode = 'P0001', detail = shortages::text, hint = 'stock';
    end if;
    insert into public.inventory_movements (restaurant_id, material_id, plan_id, movement_on, kind, quantity, unit_cost, reference)
    select pl.restaurant_id, l.material_id, p_plan, pl.price_date, 'out',
           trim_scale(sum(public.recipe_line_gross(l.quantity, l.factor, l.mode, l.rate) * pli.quantity / v.output_quantity)), 0,
           'Plan de producción #' || p_plan
    from public.plan_lines pli
    join public.recipe_versions v on v.id = pli.recipe_id
    join public.recipe_lines l on l.recipe_id = v.id
    where pli.plan_id = p_plan and pli.quantity > 0
    group by l.material_id;
  end if;
  return bid;
end $$;
