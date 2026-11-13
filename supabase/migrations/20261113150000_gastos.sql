-- Costea · Fase 9: gastos (CIF, administración, ventas, financieros y otros).
-- Reglas de legacy/Costea-main/costos_app/app/routes/planning.py (concept_edit, save_concept) y forms/planning.py:
--   · Clasificación, comportamiento y base de reparto con los valores del original.
--   · Un concepto no se repite en el mes: mismo nombre o mismo comprobante (la referencia se guarda
--     normalizada y, si no se indica, es el nombre).
--   · Los destinatarios son platos del mismo restaurante; sin destinatarios = todos los del plan.
--   · No se borran: se excluyen del cálculo con `active = false`.

alter table public.cost_concepts
  add constraint cost_concepts_kind_ck check (kind in ('cif', 'admin', 'sales', 'finance', 'other')),
  add constraint cost_concepts_basis_ck check (basis in ('equivalent', 'mod', 'sales')),
  add constraint cost_concepts_behavior_ck check (behavior in ('fixed', 'variable')),
  add constraint cost_concepts_justification_ck check (char_length(btrim(justification)) between 1 and 500);

create unique index cost_concepts_name_uq on public.cost_concepts
  (restaurant_id, period_id, lower(regexp_replace(btrim(name), '\s+', ' ', 'g')));

create or replace function public.cost_concepts_check_targets()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from jsonb_array_elements(new.targets) t
    where jsonb_typeof(t) <> 'number'
       or not exists (select 1 from public.products p where p.id = (t #>> '{}')::bigint and p.restaurant_id = new.restaurant_id)
  ) then
    raise exception 'Los platos destinatarios deben ser platos de este restaurante.' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.cost_concepts_check_targets() from anon, authenticated, public;
create trigger cost_concepts_check_targets before insert or update of targets on public.cost_concepts
  for each row execute function public.cost_concepts_check_targets();
