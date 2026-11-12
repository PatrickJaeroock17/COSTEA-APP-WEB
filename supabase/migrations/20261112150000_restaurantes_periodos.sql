-- Costea · Fase 5: restaurantes y periodos.
-- Reglas de legacy/Costea-main/costos_app/app/routes/companies.py y forms/company.py:
--   · el restaurante se crea junto con su primer periodo, en una sola transacción;
--   · RUC peruano = 11 dígitos; otro identificador = letras, números, espacio . _ / -;
--   · la moneda se bloquea cuando ya hay registros con importes;
--   · restaurantes: IGV 18 % fijo (periodos y tasa por defecto).

-- ───────────── Validaciones de datos del restaurante ─────────────

alter table public.restaurants
  add constraint restaurants_legal_name_len check (char_length(btrim(legal_name)) between 2 and 180),
  add constraint restaurants_tax_id_format check (
    tax_id is null
    or (tax_id_kind = 'peru_ruc' and tax_id ~ '^[0-9]{11}$')
    or (tax_id_kind = 'other' and tax_id ~ '^[A-Za-z0-9 ._/-]{1,20}$')
  );

-- ───────────── Mes actual en Perú ─────────────

create or replace function public.lima_today()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'America/Lima')::date;
$$;

-- ───────────── Crear restaurante + primer periodo (atómico) ─────────────

-- security invoker: RLS se aplica igual que en un insert directo.
create or replace function public.create_restaurant(
  p_legal_name text,
  p_trade_name text default null,
  p_tax_id_kind text default 'peru_ruc',
  p_tax_id text default null,
  p_currency text default 'PEN',
  p_year int default null,
  p_month int default null
)
returns uuid language plpgsql security invoker set search_path = '' as $$
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
  return rid;
end $$;

revoke execute on function public.create_restaurant(text, text, text, text, text, int, int) from anon, public;
grant execute on function public.create_restaurant(text, text, text, text, text, int, int) to authenticated;

-- ───────────── Moneda bloqueada con datos y dueño inmutable ─────────────

create or replace function public.restaurant_money_data(rid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_member(rid) and (
    exists (select 1 from public.material_cost_versions where restaurant_id = rid)
    or exists (select 1 from public.products where restaurant_id = rid)
    or exists (select 1 from public.employee_period_costs where restaurant_id = rid)
    or exists (select 1 from public.cost_concepts where restaurant_id = rid)
    or exists (select 1 from public.production_plans where restaurant_id = rid)
    or exists (select 1 from public.sales where restaurant_id = rid)
    or exists (select 1 from public.inventory_movements where restaurant_id = rid)
  );
$$;
revoke execute on function public.restaurant_money_data(uuid) from anon, public;
grant execute on function public.restaurant_money_data(uuid) to authenticated;

create or replace function public.restaurants_guard_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.owner_id := old.owner_id;
  if new.currency is distinct from old.currency and (
    exists (select 1 from public.material_cost_versions where restaurant_id = old.id)
    or exists (select 1 from public.products where restaurant_id = old.id)
    or exists (select 1 from public.employee_period_costs where restaurant_id = old.id)
    or exists (select 1 from public.cost_concepts where restaurant_id = old.id)
    or exists (select 1 from public.production_plans where restaurant_id = old.id)
    or exists (select 1 from public.sales where restaurant_id = old.id)
    or exists (select 1 from public.inventory_movements where restaurant_id = old.id)
  ) then
    raise exception 'La moneda no se puede cambiar: el restaurante ya tiene importes registrados.' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.restaurants_guard_update() from anon, authenticated, public;
create trigger restaurants_guard_update before update on public.restaurants
  for each row execute function public.restaurants_guard_update();

-- ───────────── Alta de usuario: restaurante con su primer periodo ─────────────

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
  end if;
  return new;
end $$;
revoke execute on function public.handle_new_user() from anon, authenticated, public;

-- ───────────── Restaurantes existentes sin periodo ─────────────

insert into public.periods (restaurant_id, year, month, tax_rate)
select r.id, extract(year from public.lima_today())::int, extract(month from public.lima_today())::int, 0.18
from public.restaurants r
where not exists (select 1 from public.periods p where p.restaurant_id = r.id);
