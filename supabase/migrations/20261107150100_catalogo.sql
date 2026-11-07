-- Costea · Catálogo base (solo lectura para usuarios).
-- Porta las tablas de legacy/Costea-main/cevicheria_costos_completo.sql conservando nombres de tabla y columna
-- (con prefijo catalogo_) para que los servicios portados encuentren los mismos datos.
-- Los datos se cargan en la migración catalogo_datos, generada por supabase/scripts/catalogo-desde-legacy.mjs.

-- ───────────── Insumos (secciones 1, 6 y 7) ─────────────

create table public.catalogo_categorias (
  id_categoria int primary key,
  nombre text not null unique check (char_length(nombre) <= 100)
);

create table public.catalogo_unidades_medida (
  id_unidad int primary key,
  codigo text not null unique check (char_length(codigo) <= 20),
  descripcion text check (char_length(descripcion) <= 100)
);

create table public.catalogo_insumos (
  id_insumo int primary key,
  nombre text not null check (char_length(nombre) <= 100),
  variedad text check (char_length(variedad) <= 100),
  id_categoria int references public.catalogo_categorias (id_categoria),
  id_unidad int not null references public.catalogo_unidades_medida (id_unidad),
  -- Precio referencial por unidad base (kg o Litro), ya con la revisión documentada de la sección 6.
  precio_mayorista numeric(10, 2) not null check (precio_mayorista >= 0),
  fecha_actualizacion timestamptz not null default now(),
  activo boolean not null default true,
  -- Inventario de apertura (sección 7). NULL = pendiente de plan; 0 = sin compra inicial.
  stock_inicial numeric(14, 3) check (stock_inicial >= 0),
  -- Criterio y referencia de la revisión de precios (sección 6).
  criterio_precio text,
  referencia_precio text,
  unique (nombre, variedad, id_unidad)
);
create index catalogo_insumos_categoria_idx on public.catalogo_insumos (id_categoria);

-- ───────────── Platos y recetas estándar (secciones 2, 3 y 5) ─────────────

create table public.catalogo_platos (
  id_plato int primary key,
  nombre text not null check (char_length(nombre) <= 180),
  descripcion text check (char_length(descripcion) <= 500),
  moneda char(3) not null default 'PEN',
  porciones numeric(28, 6) not null check (porciones > 0),
  unidad_produccion text not null default 'porcion',
  categoria_menu text check (char_length(categoria_menu) <= 50)
);

create table public.catalogo_receta_detalles (
  id_plato int not null references public.catalogo_platos (id_plato) on delete cascade,
  id_insumo int not null references public.catalogo_insumos (id_insumo),
  orden smallint not null default 0,
  cantidad numeric(14, 4) not null check (cantidad > 0),
  unidad_receta text not null check (unidad_receta in ('g', 'kg', 'ml', 'l', 'unid')),
  factor_a_unidad_base numeric(14, 6) not null check (factor_a_unidad_base > 0),
  merma_pct numeric(5, 2) not null default 0 check (merma_pct >= 0 and merma_pct < 100),
  notas text check (char_length(notas) <= 200),
  -- Igual que la columna calculada del original: CAST(cantidad * factor AS DECIMAL(18,6)).
  cantidad_base numeric(18, 6) generated always as (round(cantidad * factor_a_unidad_base, 6)) stored,
  primary key (id_plato, orden),
  unique (id_plato, id_insumo)
);
create index catalogo_receta_detalles_insumo_idx on public.catalogo_receta_detalles (id_insumo);

-- ───────────── Personal simulado y parámetros laborales (sección 8) ─────────────

create table public.catalogo_parametros_laborales (
  id_escenario int primary key,
  nombre text not null,
  id_instalacion text not null,
  id_restaurante int not null,
  fecha_referencia date not null,
  anio_calendario int not null,
  regimen text not null check (regimen = 'GENERAL'),
  rmv numeric(12, 2) not null check (rmv > 0),
  uit numeric(12, 2) not null check (uit > 0),
  tasa_asignacion numeric(7, 4) not null,
  tasa_essalud numeric(7, 4) not null,
  tasa_bonificacion_grati_essalud numeric(7, 4) not null,
  tasa_bonificacion_grati_eps numeric(7, 4) not null,
  tasa_credito_eps numeric(7, 4) not null,
  tasa_onp numeric(7, 4) not null,
  tasa_afp_aporte numeric(7, 4) not null,
  tasa_afp_prima numeric(7, 4) not null,
  tasa_afp_flujo numeric(7, 4) not null,
  afp_referencia text not null,
  tope_prima_afp numeric(12, 2) not null,
  tasa_cuarta numeric(7, 4) not null,
  limite_recibo_sin_retencion numeric(12, 2) not null,
  dias_semana_empresa smallint not null check (dias_semana_empresa in (5, 6)),
  observaciones text not null
);

create table public.catalogo_areas_personal (
  codigo_area text primary key,
  nombre text not null,
  clasificacion_costo text not null check (clasificacion_costo in ('MOD', 'CIF', 'ADMINISTRACION', 'VENTAS'))
);

create table public.catalogo_trabajadores (
  codigo_trabajador text primary key,
  nombres text not null,
  apellidos text not null,
  cargo text not null,
  codigo_area text not null references public.catalogo_areas_personal (codigo_area),
  es_simulado boolean not null default true,
  activo boolean not null default true
);

create table public.catalogo_contratos_personal (
  codigo_contrato text primary key,
  codigo_trabajador text not null references public.catalogo_trabajadores (codigo_trabajador),
  id_escenario int not null references public.catalogo_parametros_laborales (id_escenario),
  vinculo text not null check (vinculo in ('DEPENDIENTE', 'INDEPENDIENTE')),
  estado_planilla text not null check (estado_planilla in ('REGISTRADO', 'NO_REGISTRADO', 'NO_APLICA')),
  modalidad text not null,
  fecha_inicio date not null,
  tipo_pago text not null check (tipo_pago in ('MENSUAL', 'HORA', 'SERVICIO')),
  tarifa numeric(12, 2) not null check (tarifa > 0),
  horas_dia numeric(6, 2) not null check (horas_dia >= 0 and horas_dia <= 8),
  dias_semana smallint not null check (dias_semana between 0 and 6),
  horas_servicio_mes numeric(8, 2) not null check (horas_servicio_mes >= 0),
  factor_productivo numeric(6, 4) not null check (factor_productivo > 0 and factor_productivo <= 1),
  trabaja_feriados boolean not null,
  pension text not null check (pension in ('ONP', 'AFP_FLUJO', 'AFP_SALDO', 'NO_APLICA')),
  salud text not null check (salud in ('ESSALUD', 'EPS', 'NO_APLICA')),
  tiene_suspension_cuarta boolean not null default false,
  activo boolean not null default true,
  observaciones text not null,
  constraint contrato_vinculo_planilla check (
    (vinculo = 'DEPENDIENTE' and estado_planilla in ('REGISTRADO', 'NO_REGISTRADO') and salud <> 'NO_APLICA'
      and pension <> 'NO_APLICA' and horas_dia > 0 and dias_semana > 0)
    or (vinculo = 'INDEPENDIENTE' and estado_planilla = 'NO_APLICA' and salud = 'NO_APLICA'
      and pension = 'NO_APLICA' and horas_servicio_mes > 0)
  )
);

create table public.catalogo_hijos_personal (
  codigo_hijo text primary key,
  codigo_trabajador text not null references public.catalogo_trabajadores (codigo_trabajador),
  edad_al_corte smallint not null check (edad_al_corte between 0 and 100),
  cursa_superiores boolean not null,
  acreditado boolean not null,
  escolaridad_simulada boolean not null,
  observacion text not null
);

create table public.catalogo_beneficios_personal (
  codigo_contrato text primary key references public.catalogo_contratos_personal (codigo_contrato),
  bono_remunerativo_mes numeric(12, 2) not null check (bono_remunerativo_mes >= 0),
  bolsa_viveres_mes numeric(12, 2) not null check (bolsa_viveres_mes >= 0),
  movilidad_condicion_mes numeric(12, 2) not null check (movilidad_condicion_mes >= 0),
  alimentacion_condicion_mes numeric(12, 2) not null check (alimentacion_condicion_mes >= 0),
  escolaridad_por_hijo_anual numeric(12, 2) not null check (escolaridad_por_hijo_anual >= 0),
  canasta_navidad_anual numeric(12, 2) not null check (canasta_navidad_anual >= 0),
  uniformes_epp_anual numeric(12, 2) not null check (uniformes_epp_anual >= 0),
  examenes_capacitacion_anual numeric(12, 2) not null check (examenes_capacitacion_anual >= 0),
  eps_empresa_mes numeric(12, 2) not null check (eps_empresa_mes >= 0),
  vida_ley_mes_estimada numeric(12, 2) not null check (vida_ley_mes_estimada >= 0),
  sctr_salud_mes_estimada numeric(12, 2) not null check (sctr_salud_mes_estimada >= 0),
  sctr_pension_mes_estimada numeric(12, 2) not null check (sctr_pension_mes_estimada >= 0),
  accidente_adicional_mes numeric(12, 2) not null check (accidente_adicional_mes >= 0),
  horas_extra_25_mes numeric(8, 2) not null check (horas_extra_25_mes >= 0),
  horas_extra_35_mes numeric(8, 2) not null check (horas_extra_35_mes >= 0),
  utilidades_anual numeric(12, 2) not null check (utilidades_anual >= 0),
  reemplazo_vacaciones_anual numeric(12, 2) not null check (reemplazo_vacaciones_anual >= 0),
  observaciones text not null
);

create table public.catalogo_jornadas_personal (
  codigo_contrato text not null references public.catalogo_contratos_personal (codigo_contrato),
  dia_iso smallint not null check (dia_iso between 1 and 7),
  primary key (codigo_contrato, dia_iso)
);

create table public.catalogo_calendario_laboral (
  fecha date primary key,
  anio int not null,
  dia_iso smallint not null check (dia_iso between 1 and 7),
  es_feriado boolean not null,
  descripcion text not null
);

create table public.catalogo_vacaciones_personal (
  codigo_contrato text not null references public.catalogo_contratos_personal (codigo_contrato),
  anio int not null,
  fecha_inicio date not null,
  fecha_fin date not null,
  tipo_dias text not null check (tipo_dias in ('CALENDARIO', 'LABORABLES')),
  observacion text not null,
  primary key (codigo_contrato, anio),
  check (fecha_fin >= fecha_inicio)
);

-- ───────────── RLS: lectura para usuarios con sesión; sin escritura ─────────────

do $$
declare t text;
begin
  foreach t in array array[
    'catalogo_categorias', 'catalogo_unidades_medida', 'catalogo_insumos', 'catalogo_platos',
    'catalogo_receta_detalles', 'catalogo_parametros_laborales', 'catalogo_areas_personal',
    'catalogo_trabajadores', 'catalogo_contratos_personal', 'catalogo_hijos_personal',
    'catalogo_beneficios_personal', 'catalogo_jornadas_personal', 'catalogo_calendario_laboral',
    'catalogo_vacaciones_personal'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "todos leen" on public.%I for select to authenticated using (true)', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;
