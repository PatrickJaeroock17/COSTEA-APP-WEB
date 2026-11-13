-- Costea · Fase 13: ventas reales.
-- Reglas de legacy/Costea-main/costos_app/app/routes/sales.py (index, delete) y services/inventory.py
-- (sale_outputs con enforce_stock, void_sale_outputs):
--   · Una venta exige precio de carta, receta vigente con insumos y fecha dentro del mes de trabajo.
--   · Guarda el precio (con IGV) y el costo de materiales por unidad a la fecha de venta (congelados).
--   · Descuenta del kardex los insumos de la receta para la cantidad vendida, exigiendo stock disponible
--     (incluido lo comprometido por salidas posteriores). Todo o nada.
--   · Eliminar una venta anula sus salidas (quedan como registro, sin venta) y la borra.

-- El costo unitario lo calcula el servidor con el motor (kardex o precio de la receta, igual que la ficha
-- del plato); la base valida todo lo demás y registra venta y salidas en la misma transacción.
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
      missing := missing || case when missing = '' then '' else '; ' end ||
        btrim(r.name || ' ' || coalesce(r.variety, '')) || ': se necesitan ' || trim_scale(round(r.needed, 6))::text || ' ' || r.symbol ||
        ', disponibles ' || trim_scale(round(greatest(public.material_available(r.material_id, p_sold_on), 0), 6))::text || ' ' || r.symbol;
    end if;
  end loop;
  if missing <> '' then
    raise exception 'No se puede elaborar el plato. Insumos insuficientes en el inventario: %. Registra las entradas faltantes.', missing
      using errcode = 'P0001';
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

create or replace function public.delete_sale(p_sale bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare
  s record;
begin
  select * into s from public.sales where id = p_sale;
  if not found or not public.can_edit(s.restaurant_id) then
    raise exception 'No tienes permiso para eliminar esta venta.' using errcode = '42501';
  end if;
  -- Las salidas quedan como registro de auditoría, anuladas y sin venta (legacy: void_sale_outputs).
  update public.inventory_movements set voided = true, sale_id = null where sale_id = p_sale;
  delete from public.sales where id = p_sale;
end $$;

revoke execute on function public.register_sale(bigint, bigint, date, numeric, numeric), public.delete_sale(bigint) from anon, public;
grant execute on function public.register_sale(bigint, bigint, date, numeric, numeric), public.delete_sale(bigint) to authenticated;
