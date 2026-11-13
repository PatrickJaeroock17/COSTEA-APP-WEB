-- Costea · Fase 8: personal.
-- Reglas de legacy/Costea-main/costos_app/app/routes/planning.py (personal, mes, operaciones),
-- forms/planning.py y services/employee_profiles.py:
--   · Un trabajador no se repite: mismo documento, o mismo nombre cuando no hay documento.
--   · Las operaciones de una receta (trabajador, actividad, minutos por lote) no repiten actividad
--     para el mismo trabajador; agregar una operación retira la marca "sin mano de obra".
--   · "Sin materiales" no puede marcarse si la receta tiene insumos; "sin MOD" exige quitar operaciones.
--   · Eliminar un trabajador quita sus costos mensuales y sus operaciones; los presupuestos publicados
--     conservan su fotografía.

create unique index employees_document_uq on public.employees (restaurant_id, lower(btrim(document)))
  where document is not null;

-- ───────────── Operaciones de receta ─────────────

create or replace function public._recipe_for_edit(p_recipe bigint)
returns public.recipe_versions language plpgsql security definer set search_path = '' as $$
declare
  v public.recipe_versions;
begin
  select * into v from public.recipe_versions where id = p_recipe;
  if not found or not public.can_edit(v.restaurant_id) then
    raise exception 'No tienes permiso para editar esta receta.' using errcode = '42501';
  end if;
  return v;
end $$;

create or replace function public.add_operation(p_recipe bigint, p_employee bigint, p_activity text, p_minutes numeric)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v public.recipe_versions := public._recipe_for_edit(p_recipe);
  w record;
  activity text := regexp_replace(btrim(coalesce(p_activity, '')), '\s+', ' ', 'g');
begin
  if not exists (select 1 from public.employees where id = p_employee and restaurant_id = v.restaurant_id and active) then
    raise exception 'Elige un trabajador activo de este restaurante.' using errcode = 'P0001';
  end if;
  if char_length(activity) not between 1 and 180 then
    raise exception 'Describe la actividad (hasta 180 caracteres).' using errcode = 'P0001';
  end if;
  if p_minutes is null or p_minutes < 0 then
    raise exception 'Los minutos no pueden ser negativos.' using errcode = 'P0001';
  end if;
  insert into public.recipe_work (restaurant_id, recipe_id) values (v.restaurant_id, p_recipe)
  on conflict (recipe_id) do nothing;
  select * into w from public.recipe_work where recipe_id = p_recipe for update;
  if exists (
    select 1 from jsonb_array_elements(w.operations) op
    where (op ->> 'employee_id')::bigint = p_employee
      and lower(regexp_replace(btrim(op ->> 'activity'), '\s+', ' ', 'g')) = lower(activity)
  ) then
    raise exception 'Esta actividad ya está asignada al trabajador. Quita la anterior para reemplazarla.' using errcode = 'P0001';
  end if;
  update public.recipe_work
  set operations = operations || jsonb_build_array(jsonb_build_object('employee_id', p_employee, 'activity', activity, 'minutes', trim_scale(p_minutes)::text)),
      no_labor = false
  where recipe_id = p_recipe;
end $$;

-- p_position empieza en 0, como el original.
create or replace function public.remove_operation(p_recipe bigint, p_position int)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v public.recipe_versions := public._recipe_for_edit(p_recipe);
  w record;
begin
  select * into w from public.recipe_work where recipe_id = p_recipe for update;
  if not found or p_position < 0 or p_position >= jsonb_array_length(w.operations) then
    raise exception 'La operación ya no existe. Recarga la página.' using errcode = 'P0001';
  end if;
  update public.recipe_work set operations = operations - p_position where recipe_id = p_recipe;
end $$;

create or replace function public.set_recipe_work(p_recipe bigint, p_no_materials boolean, p_no_labor boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v public.recipe_versions := public._recipe_for_edit(p_recipe);
begin
  if p_no_materials and exists (select 1 from public.recipe_lines where recipe_id = p_recipe) then
    raise exception 'La receta tiene insumos. No puede declarar que no requiere materiales.' using errcode = 'P0001';
  end if;
  if p_no_labor and exists (select 1 from public.recipe_work where recipe_id = p_recipe and jsonb_array_length(operations) > 0) then
    raise exception 'Retira las operaciones antes de declarar que no requiere mano de obra directa.' using errcode = 'P0001';
  end if;
  insert into public.recipe_work (restaurant_id, recipe_id, no_materials, no_labor)
  values (v.restaurant_id, p_recipe, coalesce(p_no_materials, false), coalesce(p_no_labor, false))
  on conflict (recipe_id) do update set no_materials = excluded.no_materials, no_labor = excluded.no_labor;
end $$;

-- ───────────── Eliminar trabajador (legacy: delete_employee) ─────────────

create or replace function public.delete_employee(p_employee bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare
  e record;
begin
  select * into e from public.employees where id = p_employee for update;
  if not found or not public.can_edit(e.restaurant_id) then
    raise exception 'No tienes permiso para eliminar este trabajador.' using errcode = '42501';
  end if;
  update public.recipe_work w
  set operations = coalesce((
    select jsonb_agg(op order by ord)
    from jsonb_array_elements(w.operations) with ordinality as t(op, ord)
    where (op ->> 'employee_id')::bigint <> p_employee
  ), '[]'::jsonb)
  where w.restaurant_id = e.restaurant_id
    and exists (select 1 from jsonb_array_elements(w.operations) op where (op ->> 'employee_id')::bigint = p_employee);
  delete from public.employee_period_costs where employee_id = p_employee;
  delete from public.employees where id = p_employee;
end $$;

revoke execute on function public._recipe_for_edit(bigint) from anon, authenticated, public;
revoke execute on function public.add_operation(bigint, bigint, text, numeric), public.remove_operation(bigint, int),
  public.set_recipe_work(bigint, boolean, boolean), public.delete_employee(bigint) from anon, public;
grant execute on function public.add_operation(bigint, bigint, text, numeric), public.remove_operation(bigint, int),
  public.set_recipe_work(bigint, boolean, boolean), public.delete_employee(bigint) to authenticated;
