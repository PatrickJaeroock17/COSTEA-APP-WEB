"""Record the SQL opening stock once per restaurant and catalog ingredient."""

from datetime import date
from decimal import Decimal

from app.extensions import db
from app.models import Material
from app.models.inventory import InventoryMovement
from app.services.catalog import get_catalog
from app.services.catalog_selection import select_ingredient
from app.services.inventory import lock_inventory

D = Decimal
OPENING_REFERENCE = "Stock inicial · catálogo SQL"
OPENING_REFERENCES = (OPENING_REFERENCE, "Stock de apertura estimado · catálogo")


def opening_stock_rows(catalog_rows=None):
    rows = []
    for item in get_catalog().ingredients() if catalog_rows is None else catalog_rows:
        quantity = D(str(item.get("stock_inicial") or 0))
        if quantity > 0:
            rows.append((item, quantity))
    return rows


def opening_date(company):
    """Place opening stock before the restaurant's recorded activity."""
    dates = [date.today()]
    if company.created_at:
        dates.append(company.created_at.date())
    dates.extend(date(p.year, p.month, 1) for p in company.periods)
    first_movement = db.session.scalar(
        db.select(db.func.min(InventoryMovement.movement_on)).where(
            InventoryMovement.company_id == company.id
        )
    )
    if first_movement:
        dates.append(first_movement)
    return min(dates)


def opening_receipts(company_id):
    return list(
        db.session.scalars(
            db.select(InventoryMovement)
            .where(
                InventoryMovement.company_id == company_id,
                InventoryMovement.reference.in_(OPENING_REFERENCES),
            )
            .order_by(InventoryMovement.material_id)
        )
    )


def register_opening_stock(company, *, movement_on=None, catalog_rows=None):
    """Add missing opening receipts without replenishing consumed or voided stock."""
    if company.industry.slug != "restaurantes" or company.currency != "PEN":
        raise ValueError("El stock de apertura requiere un restaurante en soles.")
    lock_inventory(company.id)
    rows = opening_stock_rows(catalog_rows)
    recorded = opening_receipts(company.id)
    recorded_ids = {entry.material_id for entry in recorded}
    movement_on = movement_on or opening_date(company)
    # The former manual import used today's date. Place those same receipts at
    # opening too, preserving their saved quantity, price and cancellation state.
    for entry in recorded:
        if entry.movement_on > movement_on:
            entry.movement_on = movement_on
    existing_materials = {
        material.external_insumo_id: material
        for material in db.session.scalars(
            db.select(Material).where(Material.company_id == company.id)
        )
    }
    created = 0
    for item, quantity in rows:
        material = existing_materials.get(item["id_insumo"])
        if material and material.id in recorded_ids:
            continue
        material, _ = select_ingredient(company, company.user_id, item)
        db.session.add(
            InventoryMovement(
                company_id=company.id,
                material_id=material.id,
                movement_on=movement_on,
                kind="in",
                quantity=quantity,
                unit_cost=D(str(item["precio_mayorista"])),
                reference=OPENING_REFERENCE,
                voided=False,
            )
        )
        created += 1
    db.session.flush()
    return created
