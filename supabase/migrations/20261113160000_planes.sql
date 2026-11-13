-- Costea · Fase 10: plan del mes para costo y precio por plato.
-- Reglas de legacy/Costea-main/costos_app/app/routes/planning.py (plan_edit, plan_line, line_remove, activate),
-- services/plan_creation.py y forms/planning.py (PlanForm, PlanLineForm):
--   · Un plan pertenece a un mes; el primero del mes queda activo y solo hay un activo por mes.
--   · Cada plato entra una sola vez, con la versión de receta elegida (conserva sus precios).
--   · Al crear el plan, cada plato elegido lleva porciones, precio final con IGV y factor > 0;
--     la venta de referencia es el precio sin IGV y la modalidad inicial es precio manual.
--   · Restaurantes: IGV fijo 18 %.
--   · Modalidades: food_cost 0 < v ≤ 1 · margin v < 1 · markup v ≥ 0 · manual = precio con IGV.

create or replace function public._plan_for_edit(p_plan bigint)
returns public.production_plans language plpgsql security definer set search_path = '' as $$
declare
  pl public.production_plans;
begin
  select * into pl from public.production_plans where id = p_plan;
  if not found or not public.can_edit(pl.restaurant_id) then
    raise exception 'No tienes permiso para editar este plan.' using errcode = '42501';
  end if;
  return pl;
end $$;

create or replace function public._latest_recipe(p_product bigint)
returns bigint language sql stable security definer set search_path = '' as $$
  select id from public.recipe_versions where product_id = p_product order by number desc limit 1;
$$;

-- p_lines: arreglo de {product_id, quantity, price (con IGV), factor}.
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
        values (p_restaurant, pid, prod.id, public._latest_recipe(prod.id), qty, trim_scale(round(price / 1.18, 20)), factor, 'manual', price, null, 0.18);
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

-- Agrega o edita la línea de un plato. p_use_latest = true pasa la línea a la versión vigente de la receta.
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
        pricing_mode = p_pricing_mode, pricing_value = p_pricing_value, adopted_price = p_adopted_price, tax_rate = 0.18,
        recipe_id = case when p_use_latest then public._latest_recipe(p_product) else recipe_id end
    where id = current.id
    returning id into lid;
  else
    insert into public.plan_lines (restaurant_id, plan_id, product_id, recipe_id, quantity, reference_price, equivalent_factor, pricing_mode, pricing_value, adopted_price, tax_rate)
    values (pl.restaurant_id, p_plan, p_product, public._latest_recipe(p_product), p_quantity, p_reference_price, p_equivalent_factor, p_pricing_mode, p_pricing_value, p_adopted_price, 0.18)
    returning id into lid;
  end if;
  update public.production_plans set calculation_hash = null where id = p_plan;
  return lid;
end $$;

create or replace function public.remove_plan_line(p_line bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare
  l record;
begin
  select * into l from public.plan_lines where id = p_line;
  if not found then
    raise exception 'La línea ya no existe. Recarga la página.' using errcode = 'P0001';
  end if;
  perform public._plan_for_edit(l.plan_id);
  delete from public.plan_lines where id = p_line;
  update public.production_plans set calculation_hash = null where id = l.plan_id;
end $$;

-- Un solo plan activo por mes (legacy: activate).
create or replace function public.activate_plan(p_plan bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare
  pl public.production_plans := public._plan_for_edit(p_plan);
begin
  update public.production_plans set active = false where restaurant_id = pl.restaurant_id and period_id = pl.period_id and id <> p_plan;
  update public.production_plans set active = true where id = p_plan;
end $$;

create unique index production_plans_active_uq on public.production_plans (restaurant_id, period_id) where active;

revoke execute on function public._plan_for_edit(bigint), public._latest_recipe(bigint) from anon, authenticated, public;
revoke execute on function public.create_plan(uuid, bigint, text, date, boolean, boolean, jsonb),
  public.save_plan_line(bigint, bigint, numeric, numeric, numeric, text, numeric, numeric, boolean),
  public.remove_plan_line(bigint), public.activate_plan(bigint) from anon, public;
grant execute on function public.create_plan(uuid, bigint, text, date, boolean, boolean, jsonb),
  public.save_plan_line(bigint, bigint, numeric, numeric, numeric, text, numeric, numeric, boolean),
  public.remove_plan_line(bigint), public.activate_plan(bigint) to authenticated;
