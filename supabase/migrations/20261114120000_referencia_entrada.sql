-- Costea · Inventario: la referencia de una entrada se guarda tal como la escribió el usuario
-- (solo sin espacios al inicio y al final). La comparación para detectar duplicados sigue sin distinguir
-- mayúsculas ni espacios repetidos: la unicidad pasa del texto exacto a su clave normalizada.
-- Las entradas ya registradas conservan su texto en minúsculas (el original no se guardó).

create or replace function public.reference_key(p text)
returns text language sql immutable parallel safe set search_path = '' as $$
  select lower(regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g'))
$$;

do $$
declare c text;
begin
  select conname into c
  from pg_constraint
  where conrelid = 'public.inventory_movements'::regclass and contype = 'u'
    and pg_get_constraintdef(oid) ilike '%reference%';
  if c is not null then
    execute format('alter table public.inventory_movements drop constraint %I', c);
  end if;
end $$;

create unique index inventory_movements_reference_key
  on public.inventory_movements (restaurant_id, material_id, public.reference_key(reference));

create or replace function public.register_receipt(p_material bigint, p_date date, p_quantity numeric, p_unit_cost numeric, p_reference text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  m record;
  ref text := btrim(coalesce(p_reference, ''));
  mid bigint;
begin
  select * into m from public.materials where id = p_material;
  if not found or not public.can_edit(m.restaurant_id) then
    raise exception 'No tienes permiso para registrar entradas de este insumo.' using errcode = '42501';
  end if;
  if p_date is null then
    raise exception 'Elige la fecha de la entrada.' using errcode = 'P0001';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La cantidad recibida debe ser mayor que cero.' using errcode = 'P0001';
  end if;
  if p_unit_cost is null or p_unit_cost < 0 then
    raise exception 'El costo unitario no puede ser negativo.' using errcode = 'P0001';
  end if;
  if char_length(ref) not between 1 and 140 then
    raise exception 'Indica el comprobante o una referencia única (hasta 140 caracteres).' using errcode = 'P0001';
  end if;
  begin
    insert into public.inventory_movements (restaurant_id, material_id, movement_on, kind, quantity, unit_cost, reference)
    values (m.restaurant_id, p_material, p_date, 'in', p_quantity, p_unit_cost, ref)
    returning id into mid;
  exception when unique_violation then
    raise exception 'Esta entrada ya está registrada para el insumo; no se duplicó.' using errcode = 'P0001';
  end;
  return mid;
end $$;
