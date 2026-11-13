-- Costea · Fase 12: presupuestos publicados.
-- Reglas de legacy/Costea-main/costos_app/app/routes/planning.py (publish, budget_toggle) y
-- services/inventory.py (plan_outputs):
--   · Publicar exige que la huella del cálculo revisado siga vigente (la verifica también el servidor).
--   · Si el último presupuesto del plan tiene la misma huella, no se crea otro (mismo resultado).
--   · Si no, se guarda la versión siguiente con la fotografía completa; es inmutable (trigger reject_change).
--   · Una sola vez por plan se registran en el kardex las salidas de insumos (consumo de las recetas
--     para las porciones del plan), exigiendo stock a la fecha de referencia. Todo o nada.
--   · Archivar un presupuesto solo lo oculta; nunca se borra.

create or replace function public.publish_budget(p_plan bigint, p_fingerprint text, p_snapshot jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  pl public.production_plans;
  previous record;
  bid bigint;
  r record;
  missing text := '';
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
        missing := missing || case when missing = '' then '' else '; ' end ||
          btrim(r.name || ' ' || coalesce(r.variety, '')) || ': se necesitan ' || trim_scale(round(r.needed, 6))::text || ' ' || r.symbol ||
          ', disponibles ' || trim_scale(round(greatest(public.material_available(r.material_id, pl.price_date), 0), 6))::text || ' ' || r.symbol;
      end if;
    end loop;
    if missing <> '' then
      raise exception 'No se puede publicar: insumos insuficientes en el inventario al %: %. Registra las compras faltantes.', to_char(pl.price_date, 'DD/MM/YYYY'), missing
        using errcode = 'P0001';
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

revoke execute on function public.publish_budget(bigint, text, jsonb) from anon, public;
grant execute on function public.publish_budget(bigint, text, jsonb) to authenticated;
