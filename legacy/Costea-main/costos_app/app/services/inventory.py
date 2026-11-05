"""Perpetual weighted average. Entries carry saved cost; sales freeze recipe consumption.

Backdated receipts/sales and sale cancellations replay each material chronologically.
Insufficient entries leave valuation pending rather than inventing stock or costs.
"""

from decimal import Decimal
from uuid import uuid4

from sqlalchemy import false
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models import Material
from app.models.inventory import InventoryLock, InventoryMovement
from app.services.recipes import LineInput, calculate_line

D = Decimal


def lock_inventory(company_id):
    if db.session.get(InventoryLock, company_id) is None:
        try:
            with db.session.begin_nested():
                db.session.add(InventoryLock(company_id=company_id, revision=0))
                db.session.flush()
        except IntegrityError:
            pass
    db.session.execute(
        db.update(InventoryLock)
        .where(InventoryLock.company_id == company_id)
        .values(revision=InventoryLock.revision + 1)
    )


def ledger(company_id, material_id, on_date=None):
    statement = db.select(InventoryMovement).where(
        InventoryMovement.company_id == company_id,
        InventoryMovement.material_id == material_id,
        InventoryMovement.voided == false(),
    )
    if on_date is not None:
        statement = statement.where(InventoryMovement.movement_on <= on_date)
    movements = list(
        db.session.scalars(
            statement.order_by(
                InventoryMovement.movement_on, InventoryMovement.kind, InventoryMovement.id
            )
        )
    )
    quantity, value, rows = D("0"), D("0"), []
    for movement in movements:
        if movement.kind == "in":
            cost = movement.quantity * movement.unit_cost
            quantity += movement.quantity
            if value is not None:
                value += cost
            unit_cost = movement.unit_cost
        else:
            if movement.quantity > quantity or value is None:
                unit_cost = cost = value = None
            else:
                unit_cost = value / quantity if quantity else D("0")
                cost = value if movement.quantity == quantity else movement.quantity * unit_cost
            quantity -= movement.quantity
            if value is not None:
                value -= cost
        rows.append(
            dict(
                movement=movement,
                quantity=quantity,
                value=value,
                average=(value / quantity if quantity else D("0")) if value is not None else None,
                unit_cost=unit_cost,
                cost=cost,
            )
        )
    return rows


def inventory_price(company_id, material_id, on_date=None):
    """Return the exact last usable moving average and its availability state.

    A material without receipts still uses its recipe price. When stock reaches
    zero, the last valued average remains useful for a new price estimate.
    """
    rows = ledger(company_id, material_id, on_date)
    if not any(row["movement"].kind == "in" for row in rows):
        return None, "catalog"
    if rows[-1]["value"] is None:
        return None, "pending"
    for row in reversed(rows):
        if row["average"] is not None and row["quantity"] > 0:
            return row["average"], "kardex"
    return None, "pending"


def recipe_quantities(recipe, output_quantity):
    """Material amounts for the requested number of recipe output units."""
    quantities = {}
    for line in recipe.lines:
        amount = calculate_line(
            LineInput(line.quantity, line.factor, D("0"), line.mode, line.rate)
        ).gross_quantity
        quantities[line.material_id] = quantities.get(line.material_id, D("0")) + (
            amount * output_quantity / recipe.output_quantity
        )
    return quantities


def stock_shortages(company_id, quantities, on_date):
    """List insufficient ingredients, including stock reserved by later outputs."""
    shortages = []
    for material_id, needed in quantities.items():
        history = ledger(company_id, material_id)
        at_date = next(
            (row["quantity"] for row in reversed(history) if row["movement"].movement_on <= on_date),
            D("0"),
        )
        future = [row["quantity"] for row in history if row["movement"].movement_on > on_date]
        available = min([at_date, *future])
        if available < needed:
            material = db.session.get(Material, material_id)
            shortages.append(
                dict(material=material, needed=needed, available=available)
            )
    return shortages


def require_stock(company_id, quantities, on_date):
    """Reject an operation if any required ingredient is missing."""
    shortages = stock_shortages(company_id, quantities, on_date)
    if shortages:
        descriptions = [
            f"{row['material'].inventory_label}: se necesitan {format(row['needed'].normalize(), 'f')} "
            f"{row['material'].base_unit.symbol}, disponibles {format(row['available'].normalize(), 'f')} "
            f"{row['material'].base_unit.symbol}"
            for row in shortages
        ]
        raise ValueError(
            "No se puede elaborar el plato. Insumos insuficientes en el inventario: "
            + "; ".join(descriptions)
            + ". Registra las entradas faltantes."
        )


def sale_outputs(sale, recipe, *, enforce_stock=False):
    lock_inventory(sale.company_id)
    db.session.flush()
    quantities = recipe_quantities(recipe, sale.quantity)
    if enforce_stock:
        require_stock(sale.company_id, quantities, sale.sold_on)
    for material_id, quantity in quantities.items():
        if db.session.scalar(
            db.select(InventoryMovement.id).where(
                InventoryMovement.company_id == sale.company_id,
                InventoryMovement.sale_id == sale.id,
                InventoryMovement.material_id == material_id,
                InventoryMovement.voided == false(),
            )
        ):
            continue
        db.session.add(
            InventoryMovement(
                company_id=sale.company_id,
                material_id=material_id,
                sale_id=sale.id,
                movement_on=sale.sold_on,
                kind="out",
                quantity=quantity,
                unit_cost=D("0"),
                reference=f"Venta #{sale.id} · {uuid4().hex[:12]}",
                voided=False,
            )
        )
    db.session.flush()
    for material_id in quantities:
        ledger(sale.company_id, material_id)


def plan_outputs(plan):
    """Register one frozen recipe consumption per production plan publication."""
    lock_inventory(plan.company_id)
    db.session.flush()
    if db.session.scalar(
        db.select(InventoryMovement.id).where(
            InventoryMovement.company_id == plan.company_id,
            InventoryMovement.plan_id == plan.id,
            InventoryMovement.voided == false(),
        )
    ):
        return False

    quantities = {}
    for plan_line in plan.lines:
        for material_id, quantity in recipe_quantities(
            plan_line.recipe, plan_line.quantity
        ).items():
            quantities[material_id] = quantities.get(material_id, D("0")) + quantity

    require_stock(plan.company_id, quantities, plan.price_date)

    for material_id, quantity in quantities.items():
        db.session.add(
            InventoryMovement(
                company_id=plan.company_id,
                material_id=material_id,
                plan_id=plan.id,
                movement_on=plan.price_date,
                kind="out",
                quantity=quantity,
                unit_cost=D("0"),
                reference=f"Plan de producción #{plan.id}",
                voided=False,
            )
        )
    db.session.flush()
    for material_id in quantities:
        ledger(plan.company_id, material_id)
    return True


def void_sale_outputs(sale):
    lock_inventory(sale.company_id)
    movements = list(
        db.session.scalars(db.select(InventoryMovement).where(InventoryMovement.sale_id == sale.id))
    )
    for movement in movements:
        movement.voided = True
        movement.sale_id = (
            None  # Keep the movement/reference as an audit trail after deleting the sale.
        )
    db.session.flush()
    for material_id in {m.material_id for m in movements}:
        ledger(sale.company_id, material_id)
