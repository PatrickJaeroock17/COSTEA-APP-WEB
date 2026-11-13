-- Costea · Fase 14: inventario.
-- Reglas de legacy/Costea-main/costos_app/app/routes/inventory.py (index, opening_stock),
-- services/inventory_sources.py (saved_entries, import_entry) e INVENTARIOS.md:
--   · Entrada manual en la unidad base del insumo, con costo real sin IGV recuperable y una referencia
--     única por insumo (normalizada: minúsculas y espacios simples). No se duplica.
--   · Una compra con comprobante ya guardada (versión de precio en modo compra) puede incorporarse una
--     sola vez al kardex con su cantidad en unidad base y su costo unitario.
--   · El stock de apertura del catálogo puede volver a pedirse: solo agrega lo que falte, nunca repone.

create or replace function public.register_receipt(p_material bigint, p_date date, p_quantity numeric, p_unit_cost numeric, p_reference text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  m record;
  ref text := lower(regexp_replace(btrim(coalesce(p_reference, '')), '\s+', ' ', 'g'));
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

create or replace function public.import_saved_purchase(p_cost_version bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v record;
  mid bigint;
  ref text := 'Compra guardada #' || p_cost_version;
begin
  select * into v from public.material_cost_versions where id = p_cost_version;
  if not found or not public.can_edit(v.restaurant_id) then
    raise exception 'Selecciona una compra guardada de este restaurante.' using errcode = '42501';
  end if;
  if v.mode <> 'purchase' then
    raise exception 'Solo las compras con comprobante tienen cantidad para ingresar al kardex.' using errcode = 'P0001';
  end if;
  select id into mid from public.inventory_movements where restaurant_id = v.restaurant_id and material_id = v.material_id and reference = ref;
  if mid is not null then
    return mid; -- Ya incorporada: se conservan los datos de entonces.
  end if;
  insert into public.inventory_movements (restaurant_id, material_id, movement_on, kind, quantity, unit_cost, reference)
  values (v.restaurant_id, v.material_id, v.effective_on, 'in', trim_scale(v.quantity * v.factor),
          trim_scale((v.net_amount + v.nonrecoverable_tax + v.attributable_cost) / (v.quantity * v.factor)), ref)
  returning id into mid;
  return mid;
end $$;

create or replace function public.seed_catalog_opening(p_restaurant uuid)
returns int language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_edit(p_restaurant) then
    raise exception 'No tienes permiso para registrar el stock de apertura.' using errcode = '42501';
  end if;
  return public._seed_catalog_opening(p_restaurant);
end $$;

revoke execute on function public.register_receipt(bigint, date, numeric, numeric, text), public.import_saved_purchase(bigint),
  public.seed_catalog_opening(uuid) from anon, public;
grant execute on function public.register_receipt(bigint, date, numeric, numeric, text), public.import_saved_purchase(bigint),
  public.seed_catalog_opening(uuid) to authenticated;
