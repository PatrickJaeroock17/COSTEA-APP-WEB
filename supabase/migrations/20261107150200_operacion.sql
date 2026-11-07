-- Costea · Datos de operación de cada restaurante.
-- Porta materials, products, planning, sales e inventory de legacy/Costea-main/costos_app/app/models.
-- Cambios respecto del original:
--   · company_id → restaurant_id (uuid) y el control de propietario pasa a RLS.
--   · Los decimales exactos (texto en el original) usan numeric de PostgreSQL, también exacto.
--   · Cada tabla hija lleva restaurant_id y una FK compuesta (restaurant_id, padre_id): un registro
--     nunca puede apuntar a datos de otro restaurante, y RLS filtra sin joins.
--   · El historial inmutable (versiones de precio y de receta, equivalencias, presupuestos) se protege
--     con triggers que rechazan UPDATE y DELETE.
--   · No se portan dish_sync (cola hacia SQL Server) ni industries (Costea es solo para restaurantes).

-- ───────────── Insumos ─────────────

create table public.materials (
  id bigint generated always as identity primary key,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  -- Formato AAA-000. Los insumos del catálogo copian el código comercial; los propios usan el mismo formato.
  code text not null check (code ~ '^[A-Z]{3}-[0-9]{3}$'),
  catalog_material_id int references public.catalogo_insumos (id_insumo),
  name text not null check (char_length(btrim(name)) between 1 and 220),
  variety text check (char_length(variety) <= 100),
  category text not null check (char_length(category) <= 100),
  supplier text check (char_length(supplier) <= 180),
  base_unit_code text not null references public.units (code),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, code),
  unique (restaurant_id, id)
);
create unique index materials_catalog_uq on public.materials (restaurant_id, catalog_material_id)
  where catalog_material_id is not null;

-- Equivalencias (p. ej. "1 atado = 0.25 kg"). Inmutables.
create table public.material_conversions (
  id bigint generated always as identity primary key,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  material_id bigint not null,
  label text not null check (char_length(btrim(label)) between 1 and 80),
  factor numeric not null check (factor > 0),
  evidence text not null check (char_length(evidence) <= 500),
  created_at timestamptz not null default now(),
  foreign key (restaurant_id, material_id) references public.materials (restaurant_id, id),
  unique (material_id, label),
  unique (restaurant_id, id)
);

-- Versiones de costo de referencia. Inmutables: un cambio de precio es una versión nueva.
create table public.material_cost_versions (
  id bigint generated always as identity primary key,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  material_id bigint not null,
  author_id uuid not null default auth.uid() references auth.users (id),
  effective_on date not null,
  mode text not null check (mode in ('direct', 'purchase')),
  source text not null check (char_length(source) <= 500),
  currency char(3) not null,
  unit_cost numeric check (unit_cost >= 0),
  quantity numeric check (quantity > 0),
  purchase_unit text check (char_length(purchase_unit) <= 80),
  factor numeric check (factor > 0),
  conversion_evidence text check (char_length(conversion_evidence) <= 500),
  net_amount numeric check (net_amount >= 0),
  nonrecoverable_tax numeric check (nonrecoverable_tax >= 0),
  recoverable_tax numeric check (recoverable_tax >= 0),
  attributable_cost numeric check (attributable_cost >= 0),
  created_at timestamptz not null default now(),
  foreign key (restaurant_id, material_id) references public.materials (restaurant_id, id),
  unique (restaurant_id, id),
  constraint exclusive_cost_inputs check (
    (mode = 'direct' and unit_cost is not null and quantity is null and factor is null and net_amount is null
      and nonrecoverable_tax is null and recoverable_tax is null and attributable_cost is null)
    or (mode = 'purchase' and unit_cost is null and quantity is not null and factor is not null
      and net_amount is not null and nonrecoverable_tax is not null and recoverable_tax is not null
      and attributable_cost is not null and purchase_unit is not null)
  )
);
create index material_cost_versions_material_idx on public.material_cost_versions (material_id, effective_on desc, id desc);

-- ───────────── Platos y recetas ─────────────

create table public.products (
  id bigint generated always as identity primary key,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  code text not null check (char_length(btrim(code)) between 1 and 40),
  name text not null check (char_length(btrim(name)) between 1 and 180),
  description text check (char_length(description) <= 500),
  menu_category text check (char_length(menu_category) <= 50),
  -- Origen en el catálogo base (p. ej. 'catalogo:1'), para no duplicar al importar.
  source_key text check (char_length(source_key) <= 180),
  source_version text check (char_length(source_version) <= 80),
  active boolean not null default true,
  revision int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, code),
  unique (restaurant_id, id)
);
create unique index products_source_uq on public.products (restaurant_id, source_key) where source_key is not null;

-- Versiones de receta. Inmutables: editar una receta crea la versión siguiente.
create table public.recipe_versions (
  id bigint generated always as identity primary key,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  product_id bigint not null,
  number int not null check (number > 0),
  author_id uuid not null default auth.uid() references auth.users (id),
  output_quantity numeric not null check (output_quantity > 0),
  output_unit_code text not null references public.units (code),
  currency char(3) not null,
  product_name text not null check (char_length(product_name) <= 180),
  created_at timestamptz not null default now(),
  foreign key (restaurant_id, product_id) references public.products (restaurant_id, id),
  unique (product_id, number),
  unique (restaurant_id, id)
);

-- Líneas de receta: guardan el precio y la equivalencia usados (fotografía exacta). Inmutables.
create table public.recipe_lines (
  id bigint generated always as identity primary key,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  recipe_id bigint not null,
  position int not null,
  material_id bigint not null,
  cost_version_id bigint not null,
  material_name text not null check (char_length(material_name) <= 180),
  quantity numeric not null check (quantity > 0),
  unit_key text not null check (char_length(unit_key) <= 40),
  unit_label text not null check (char_length(unit_label) <= 80),
  factor numeric not null check (factor > 0),
  conversion_evidence text not null check (char_length(conversion_evidence) <= 500),
  mode text not null check (mode in ('gross', 'loss', 'additional')),
  rate numeric not null check (rate >= 0 and (mode <> 'loss' or rate < 1) and (mode <> 'gross' or rate = 0)),
  foreign key (restaurant_id, recipe_id) references public.recipe_versions (restaurant_id, id),
  foreign key (restaurant_id, material_id) references public.materials (restaurant_id, id),
  foreign key (restaurant_id, cost_version_id) references public.material_cost_versions (restaurant_id, id),
  unique (recipe_id, position),
  unique (recipe_id, material_id)
);
create index recipe_lines_material_idx on public.recipe_lines (material_id);

-- Mano de obra por receta (operaciones con minutos) y marcas "sin materiales"/"sin mano de obra".
create table public.recipe_work (
  id bigint generated always as identity primary key,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  recipe_id bigint not null unique,
  no_materials boolean not null default false,
  no_labor boolean not null default false,
  operations jsonb not null default '[]'::jsonb check (jsonb_typeof(operations) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (restaurant_id, recipe_id) references public.recipe_versions (restaurant_id, id)
);

-- ───────────── Personal ─────────────

create table public.employees (
  id bigint generated always as identity primary key,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 180),
  role text not null check (char_length(role) <= 180),
  document text check (char_length(document) <= 40),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, id)
);

-- Costo del trabajador en un periodo. Los decimales dentro del JSON van como texto (como el original).
create table public.employee_period_costs (
  id bigint generated always as identity primary key,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  employee_id bigint not null,
  period_id bigint not null,
  data jsonb not null,
  -- Beneficios anuales, bases y tasas sociales explícitas. NULL conserva la planilla agregada original.
  breakdown jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (restaurant_id, employee_id) references public.employees (restaurant_id, id),
  foreign key (restaurant_id, period_id) references public.periods (restaurant_id, id),
  unique (employee_id, period_id)
);

-- Personalización o baja de un perfil del personal base (catálogo) por restaurante.
create table public.restaurant_labor_profiles (
  id bigint generated always as identity primary key,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  base_scenario_id int not null,
  base_worker_code text not null check (char_length(base_worker_code) <= 20),
  local_worker_code text check (char_length(local_worker_code) <= 20),
  local_scenario_id int,
  deleted boolean not null default false,
  revision int not null default 1,
  refs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, base_scenario_id, base_worker_code)
);

-- ───────────── Gastos (CIF, administración, ventas) ─────────────

create table public.cost_concepts (
  id bigint generated always as identity primary key,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  period_id bigint not null,
  name text not null check (char_length(btrim(name)) between 1 and 180),
  reference_key text check (char_length(reference_key) <= 180),
  kind text not null check (char_length(kind) <= 12),
  amount numeric not null check (amount >= 0),
  basis text not null check (char_length(basis) <= 16),
  behavior text not null check (char_length(behavior) <= 10),
  justification text not null check (char_length(justification) <= 500),
  targets jsonb not null default '[]'::jsonb check (jsonb_typeof(targets) = 'array'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (restaurant_id, period_id) references public.periods (restaurant_id, id)
);
create unique index cost_concepts_reference_uq on public.cost_concepts (restaurant_id, period_id, reference_key)
  where reference_key is not null;

-- ───────────── Plan de producción y presupuestos ─────────────

create table public.production_plans (
  id bigint generated always as identity primary key,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  period_id bigint not null,
  name text not null check (char_length(btrim(name)) between 1 and 180),
  price_date date not null,
  no_cif boolean not null default false,
  no_expenses boolean not null default false,
  active boolean not null default false,
  calculation_hash text check (char_length(calculation_hash) <= 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (restaurant_id, period_id) references public.periods (restaurant_id, id),
  unique (restaurant_id, id)
);

create table public.plan_lines (
  id bigint generated always as identity primary key,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  plan_id bigint not null,
  product_id bigint not null,
  recipe_id bigint not null,
  quantity numeric not null check (quantity >= 0),
  reference_price numeric not null check (reference_price >= 0),
  equivalent_factor numeric not null check (equivalent_factor > 0),
  pricing_mode text not null check (pricing_mode in ('markup', 'margin', 'manual', 'food_cost')),
  pricing_value numeric not null check (pricing_value >= 0),
  adopted_price numeric check (adopted_price >= 0),
  tax_rate numeric check (tax_rate between 0 and 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (restaurant_id, plan_id) references public.production_plans (restaurant_id, id) on delete cascade,
  foreign key (restaurant_id, product_id) references public.products (restaurant_id, id),
  foreign key (restaurant_id, recipe_id) references public.recipe_versions (restaurant_id, id),
  unique (plan_id, product_id)
);

-- Presupuestos publicados: fotografía completa e inmutable del cálculo.
create table public.budgets (
  id bigint generated always as identity primary key,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  plan_id bigint not null,
  author_id uuid not null default auth.uid() references auth.users (id),
  number int not null check (number > 0),
  snapshot jsonb not null,
  fingerprint text not null check (char_length(fingerprint) = 64),
  created_at timestamptz not null default now(),
  foreign key (restaurant_id, plan_id) references public.production_plans (restaurant_id, id),
  unique (plan_id, number),
  unique (restaurant_id, id)
);

create table public.budget_archives (
  budget_id bigint primary key,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  archived boolean not null default true,
  foreign key (restaurant_id, budget_id) references public.budgets (restaurant_id, id)
);

-- ───────────── Ventas ─────────────

create table public.product_prices (
  product_id bigint primary key,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  amount numeric not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (restaurant_id, product_id) references public.products (restaurant_id, id)
);

-- Cada venta guarda la receta y el costo calculados a su fecha.
create table public.sales (
  id bigint generated always as identity primary key,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  product_id bigint not null,
  recipe_id bigint not null,
  sold_on date not null,
  quantity numeric not null check (quantity > 0),
  unit_price numeric not null check (unit_price > 0),
  unit_cost numeric not null check (unit_cost >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (restaurant_id, product_id) references public.products (restaurant_id, id),
  foreign key (restaurant_id, recipe_id) references public.recipe_versions (restaurant_id, id),
  unique (restaurant_id, id)
);
create index sales_restaurant_date_idx on public.sales (restaurant_id, sold_on);

-- ───────────── Inventario (kardex con promedio ponderado) ─────────────

create table public.inventory_movements (
  id bigint generated always as identity primary key,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  material_id bigint not null,
  sale_id bigint,
  plan_id bigint,
  movement_on date not null,
  kind text not null check (char_length(kind) <= 12),
  quantity numeric not null,
  unit_cost numeric not null check (unit_cost >= 0),
  reference text not null check (char_length(reference) <= 180),
  voided boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (restaurant_id, material_id) references public.materials (restaurant_id, id),
  foreign key (restaurant_id, sale_id) references public.sales (restaurant_id, id),
  foreign key (restaurant_id, plan_id) references public.production_plans (restaurant_id, id),
  unique (restaurant_id, reference, material_id)
);
create index inventory_movements_material_idx on public.inventory_movements (material_id, movement_on);

-- Bloqueo optimista del kardex por restaurante.
create table public.inventory_locks (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  revision int not null default 0
);

-- ───────────── Índices por restaurante y triggers ─────────────

do $$
declare t text;
begin
  foreach t in array array[
    'materials', 'material_conversions', 'material_cost_versions', 'products', 'recipe_versions',
    'recipe_lines', 'recipe_work', 'employees', 'employee_period_costs', 'restaurant_labor_profiles',
    'cost_concepts', 'production_plans', 'plan_lines', 'budgets', 'budget_archives', 'product_prices',
    'sales', 'inventory_movements'
  ] loop
    execute format('create index if not exists %I on public.%I (restaurant_id)', t || '_restaurant_idx', t);
  end loop;

  foreach t in array array[
    'materials', 'products', 'recipe_work', 'employees', 'employee_period_costs', 'restaurant_labor_profiles',
    'cost_concepts', 'production_plans', 'plan_lines', 'product_prices', 'sales', 'inventory_movements'
  ] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_updated_at', t);
  end loop;

  -- Historial inmutable.
  foreach t in array array['material_conversions', 'material_cost_versions', 'recipe_versions', 'recipe_lines', 'budgets'] loop
    execute format('create trigger %I before update or delete on public.%I for each row execute function public.reject_change()', t || '_inmutable', t);
  end loop;
end $$;

-- ───────────── RLS ─────────────

do $$
declare t text;
begin
  foreach t in array array[
    'materials', 'material_conversions', 'material_cost_versions', 'products', 'recipe_versions',
    'recipe_lines', 'recipe_work', 'employees', 'employee_period_costs', 'restaurant_labor_profiles',
    'cost_concepts', 'production_plans', 'plan_lines', 'budgets', 'budget_archives', 'product_prices',
    'sales', 'inventory_movements', 'inventory_locks'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "miembros leen" on public.%I for select to authenticated using (public.is_member(restaurant_id))', t);
    execute format('create policy "editores crean" on public.%I for insert to authenticated with check (public.can_edit(restaurant_id))', t);
    execute format('create policy "editores actualizan" on public.%I for update to authenticated using (public.can_edit(restaurant_id)) with check (public.can_edit(restaurant_id))', t);
    execute format('create policy "editores borran" on public.%I for delete to authenticated using (public.can_edit(restaurant_id))', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
