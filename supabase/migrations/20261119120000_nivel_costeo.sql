-- Costea · nivel de costeo por restaurante (capa de presentación; no cambia cálculos).
--   1 = Costo rápido (insumos, platos, costo y precio)
--   2 = Con mi tiempo (suma personal y minutos por plato)
--   3 = Costo completo (gastos, plan, presupuestos, ventas, inventario, reportes)
-- Los restaurantes que ya tienen personal, gastos, planes o ventas pasan a 3 para no ocultarles su trabajo.
-- El nivel puede cambiarlo cualquier miembro con permiso de edición (el dueño ya podía editar el restaurante;
-- las políticas RLS de restaurants no se tocan: la función valida con can_edit).

alter table public.restaurants
  add column cost_level smallint not null default 1 check (cost_level between 1 and 3);

update public.restaurants r set cost_level = 3
where exists (select 1 from public.production_plans x where x.restaurant_id = r.id)
   or exists (select 1 from public.cost_concepts x where x.restaurant_id = r.id)
   or exists (select 1 from public.sales x where x.restaurant_id = r.id)
   or exists (select 1 from public.employees x where x.restaurant_id = r.id);

create or replace function public.set_cost_level(p_restaurant uuid, p_level smallint)
returns smallint language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_edit(p_restaurant) then
    raise exception 'No tienes permiso para cambiar el nivel de costeo.' using errcode = '42501';
  end if;
  if p_level is null or p_level not between 1 and 3 then
    raise exception 'El nivel de costeo debe ser 1, 2 o 3.' using errcode = 'P0001';
  end if;
  update public.restaurants set cost_level = p_level where id = p_restaurant;
  return p_level;
end $$;
revoke execute on function public.set_cost_level(uuid, smallint) from anon, public;
grant execute on function public.set_cost_level(uuid, smallint) to authenticated;
