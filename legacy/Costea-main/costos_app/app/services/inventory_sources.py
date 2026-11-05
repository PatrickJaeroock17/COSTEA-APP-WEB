"""Purchase receipts and consolidated recipe requirements."""

from decimal import Decimal

from sqlalchemy import true

from app.extensions import db
from app.models import Material, Product, RecipeVersion, Sale
from app.models.inventory import InventoryMovement
from app.services.inventory import ledger, lock_inventory, sale_outputs
from app.services.materials import version_result
from app.services.recipes import LineInput, calculate_line


def recipe_requirements(company_id):
    """One current recipe batch per active dish, combined once per material."""
    totals = {}
    products = db.session.scalars(
        db.select(Product)
        .where(Product.company_id == company_id, Product.active == true())
        .order_by(Product.name)
    )
    for product in products:
        if not product.recipes:
            continue
        for line in product.recipes[-1].lines:
            gross = calculate_line(
                LineInput(line.quantity, line.factor, Decimal("0"), line.mode, line.rate)
            ).gross_quantity
            row = totals.setdefault(
                line.material_id,
                dict(material=line.material, quantity=Decimal("0"), dishes=[]),
            )
            row["quantity"] += gross
            row["dishes"].append(product.name)
    return sorted(
        totals.values(),
        key=lambda row: (
            row["material"].name.casefold(),
            (row["material"].variety or "").casefold(),
            row["material"].id,
        ),
    )


def simulated_recipe_outputs(company_id, requirements):
    """Show recipe demand in Kardex columns without recording a stock movement."""
    outputs = []
    for requirement in requirements:
        history = ledger(company_id, requirement["material"].id)
        quantity = history[-1]["quantity"] if history else Decimal("0")
        value = history[-1]["value"] if history else Decimal("0")
        average = value / quantity if value is not None and quantity > 0 else None
        needed = requirement["quantity"]
        if value is not None and needed <= quantity:
            unit_cost = average
            cost = value if needed == quantity else needed * unit_cost
            projected_value = value - cost
        else:
            unit_cost = cost = projected_value = None
        outputs.append(
            requirement
            | dict(
                unit_cost=unit_cost,
                cost=cost,
                projected_quantity=quantity - needed,
                projected_value=projected_value,
                projected_average=(projected_value / (quantity - needed))
                if projected_value is not None and quantity > needed
                else Decimal("0") if projected_value is not None else None,
            )
        )
    return outputs


def saved_entries(company_id, product_id=None):
    materials = list(
        db.session.scalars(db.select(Material).where(Material.company_id == company_id))
    )
    if product_id:
        products = list(
            db.session.scalars(
                db.select(Product).where(Product.company_id == company_id, Product.id == product_id)
            )
        )
        allowed = {line.material_id for p in products if p.recipes for line in p.recipes[-1].lines}
        materials = [m for m in materials if m.id in allowed]
    imported = {
        movement.reference: movement
        for movement in db.session.scalars(
            db.select(InventoryMovement).where(
                InventoryMovement.company_id == company_id, InventoryMovement.kind == "in"
            )
        )
    }
    entries = []
    for material in materials:
        for cost in material.costs:
            if cost.mode != "purchase":
                continue
            entries.append(
                dict(
                    key=f"Compra guardada #{cost.id}",
                    material=material,
                    quantity=cost.quantity * cost.factor,
                    unit_cost=version_result(cost),
                    date=cost.effective_on,
                    origin="Cantidad de compra guardada",
                )
            )
    for entry in entries:
        entry["imported"] = entry["key"] in imported
        if entry["imported"]:
            movement = imported[entry["key"]]
            entry.update(
                quantity=movement.quantity,
                unit_cost=movement.unit_cost,
                date=movement.movement_on,
                origin="Datos conservados al incorporar esta entrada",
            )
    return entries


def import_entry(company_id, key, product_id=None):
    lock_inventory(company_id)
    entry = next((e for e in saved_entries(company_id, product_id) if e["key"] == key), None)
    if entry is None:
        raise ValueError("Selecciona una materia prima guardada de esta empresa.")
    if entry["imported"]:
        return False
    db.session.add(
        InventoryMovement(
            company_id=company_id,
            material_id=entry["material"].id,
            movement_on=entry["date"],
            kind="in",
            quantity=entry["quantity"],
            unit_cost=entry["unit_cost"],
            reference=entry["key"],
            voided=False,
        )
    )
    db.session.flush()
    return True


def sync_saved_sales(company_id):
    lock_inventory(company_id)
    for sale in db.session.scalars(
        db.select(Sale).where(Sale.company_id == company_id).order_by(Sale.sold_on, Sale.id)
    ):
        recipe = db.session.get(RecipeVersion, sale.recipe_id)
        sale_outputs(sale, recipe)
