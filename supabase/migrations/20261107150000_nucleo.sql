-- Costea · Núcleo: perfiles, restaurantes, miembros, periodos y unidades.
-- Reemplaza users + companies + periods + units del sistema Flask (legacy/Costea-main/costos_app/app/models).
-- Aislamiento por restaurante con RLS: cada usuario ve solo los restaurantes de los que es miembro.

-- ───────────── Utilidades ─────────────

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Historial inmutable (versiones de precio, recetas, presupuestos publicados).
create or replace function public.reject_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'El historial es inmutable. Registra una nueva versión.' using errcode = 'P0001';
end $$;

-- ───────────── Perfiles ─────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ───────────── Restaurantes ─────────────

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id),
  legal_name text not null check (char_length(btrim(legal_name)) between 1 and 180),
  trade_name text check (char_length(trade_name) <= 180),
  tax_id text check (char_length(tax_id) <= 20),
  tax_id_kind text not null default 'peru_ruc' check (tax_id_kind in ('peru_ruc', 'other')),
  currency char(3) not null default 'PEN' check (currency in ('PEN', 'USD', 'EUR')),
  -- Tasa por defecto para periodos nuevos (IGV Perú 18 %). Seis decimales exactos como el original.
  default_tax_rate numeric(7, 6) default 0.18 check (default_tax_rate between 0 and 1),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index restaurants_owner_idx on public.restaurants (owner_id);
create unique index restaurants_owner_tax_id_uq on public.restaurants (owner_id, tax_id_kind, tax_id)
  where tax_id is not null;
create trigger restaurants_updated_at before update on public.restaurants
  for each row execute function public.set_updated_at();

create table public.restaurant_members (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'editor' check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (restaurant_id, user_id)
);
create index restaurant_members_user_idx on public.restaurant_members (user_id);

-- El dueño queda como miembro automáticamente al crear el restaurante.
create or replace function public.add_owner_membership()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.restaurant_members (restaurant_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (restaurant_id, user_id) do update set role = 'owner';
  return new;
end $$;
create trigger restaurants_add_owner after insert on public.restaurants
  for each row execute function public.add_owner_membership();

-- Funciones de permiso para RLS (security definer evita recursión entre políticas).
create or replace function public.is_member(rid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.restaurant_members m
    where m.restaurant_id = rid and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.can_edit(rid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.restaurant_members m
    where m.restaurant_id = rid and m.user_id = (select auth.uid()) and m.role in ('owner', 'editor')
  );
$$;

create or replace function public.is_owner(rid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.restaurant_members m
    where m.restaurant_id = rid and m.user_id = (select auth.uid()) and m.role = 'owner'
  );
$$;

-- ───────────── Periodos (mes de trabajo) ─────────────

create table public.periods (
  id bigint generated always as identity primary key,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  year int not null check (year between 1900 and 9999),
  month int not null check (month between 1 and 12),
  -- NULL = usar la tasa por defecto del restaurante.
  tax_rate numeric(7, 6) check (tax_rate between 0 and 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, year, month),
  unique (restaurant_id, id)
);
create trigger periods_updated_at before update on public.periods
  for each row execute function public.set_updated_at();

-- ───────────── Unidades ─────────────

-- Definiciones compartidas e inmutables. Factor a la unidad base = numerator / denominator.
create table public.units (
  code text primary key check (char_length(code) <= 16),
  name text not null check (char_length(name) <= 50),
  symbol text not null check (char_length(symbol) <= 10),
  dimension text not null check (dimension in ('mass', 'volume', 'count', 'length', 'area', 'time')),
  numerator int not null check (numerator > 0),
  denominator int not null check (denominator > 0)
);

-- Valores de legacy/Costea-main/costos_app/app/cli.py (seed-units). Factores respecto de g, ml, ud, m, m² y min.
insert into public.units (code, name, symbol, dimension, numerator, denominator) values
  ('g', 'Gramo', 'g', 'mass', 1, 1),
  ('kg', 'Kilogramo', 'kg', 'mass', 1000, 1),
  ('ml', 'Mililitro', 'ml', 'volume', 1, 1),
  ('l', 'Litro', 'L', 'volume', 1000, 1),
  ('unit', 'Unidad', 'ud', 'count', 1, 1),
  ('thousand', 'Millar', 'millar', 'count', 1000, 1),
  ('m', 'Metro', 'm', 'length', 1, 1),
  ('m2', 'Metro cuadrado', 'm²', 'area', 1, 1),
  ('min', 'Minuto', 'min', 'time', 1, 1),
  ('h', 'Hora', 'h', 'time', 60, 1);

-- Unidades habilitadas por restaurante (company_units).
create table public.restaurant_units (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  unit_code text not null references public.units (code),
  enabled boolean not null default true,
  primary key (restaurant_id, unit_code)
);

-- ───────────── Alta de usuario ─────────────

-- Al registrarse: crea el perfil y, si el formulario envió el nombre del restaurante, el restaurante.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  restaurant_name text := nullif(btrim(meta ->> 'restaurant'), '');
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    left(coalesce(nullif(btrim(meta ->> 'name'), ''), nullif(btrim(meta ->> 'full_name'), ''), split_part(new.email, '@', 1), ''), 100)
  );
  if restaurant_name is not null then
    insert into public.restaurants (owner_id, legal_name) values (new.id, left(restaurant_name, 180));
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────── RLS ─────────────

alter table public.profiles enable row level security;
alter table public.restaurants enable row level security;
alter table public.restaurant_members enable row level security;
alter table public.periods enable row level security;
alter table public.units enable row level security;
alter table public.restaurant_units enable row level security;

create policy "perfil propio: leer" on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "perfil propio: actualizar" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "miembros leen" on public.restaurants for select to authenticated
  using (public.is_member(id));
create policy "crear como dueño" on public.restaurants for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "dueño actualiza" on public.restaurants for update to authenticated
  using (public.is_owner(id)) with check (public.is_owner(id));
-- Sin política de borrado: los restaurantes se archivan (active = false).

create policy "miembros leen" on public.restaurant_members for select to authenticated
  using (public.is_member(restaurant_id));
create policy "dueño agrega" on public.restaurant_members for insert to authenticated
  with check (public.is_owner(restaurant_id) and role <> 'owner');
create policy "dueño cambia rol" on public.restaurant_members for update to authenticated
  using (public.is_owner(restaurant_id) and role <> 'owner') with check (public.is_owner(restaurant_id) and role <> 'owner');
create policy "dueño quita" on public.restaurant_members for delete to authenticated
  using (public.is_owner(restaurant_id) and role <> 'owner');

create policy "todos leen" on public.units for select to authenticated using (true);

do $$
declare t text;
begin
  foreach t in array array['periods', 'restaurant_units'] loop
    execute format('create policy "miembros leen" on public.%I for select to authenticated using (public.is_member(restaurant_id))', t);
    execute format('create policy "editores crean" on public.%I for insert to authenticated with check (public.can_edit(restaurant_id))', t);
    execute format('create policy "editores actualizan" on public.%I for update to authenticated using (public.can_edit(restaurant_id)) with check (public.can_edit(restaurant_id))', t);
    execute format('create policy "editores borran" on public.%I for delete to authenticated using (public.can_edit(restaurant_id))', t);
  end loop;
end $$;

-- Permisos explícitos: solo usuarios con sesión; RLS decide qué filas.
revoke all on public.profiles, public.restaurants, public.restaurant_members, public.periods, public.units, public.restaurant_units from anon;
grant select, update on public.profiles to authenticated;
grant select, insert, update on public.restaurants to authenticated;
grant select, insert, update, delete on public.restaurant_members, public.periods, public.restaurant_units to authenticated;
grant select on public.units to authenticated;
revoke execute on function public.is_member(uuid), public.can_edit(uuid), public.is_owner(uuid) from anon, public;
grant execute on function public.is_member(uuid), public.can_edit(uuid), public.is_owner(uuid) to authenticated;
revoke execute on function public.handle_new_user(), public.add_owner_membership() from anon, authenticated, public;
