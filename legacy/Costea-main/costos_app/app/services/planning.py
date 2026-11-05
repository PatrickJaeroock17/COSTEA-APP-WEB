"""Ownership-checked ORM adapters and reproducible snapshot serialization."""

import hashlib
import json
from decimal import Decimal

from sqlalchemy import true

from app.extensions import db
from app.models import MaterialCostVersion
from app.models.planning import CostConcept, Employee, EmployeePeriodCost, RecipeWork
from app.services.costing import ENGINE, calculate_plan
from app.services.inventory import inventory_price
from app.services.materials import version_result
from app.services.payroll import monthly_payroll

D = Decimal


def plain(value):
    if isinstance(value, Decimal):
        return format(value, "f")
    if isinstance(value, dict):
        return {str(k): plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [plain(v) for v in value]
    return value


def payroll_input(record):
    raw = record.data
    components = (
        [
            dict(c, source=raw["components"][0]["source"])
            for c in monthly_payroll(record.breakdown["inputs"])["components"]
        ]
        if record.breakdown
        else raw["components"]
    )
    return dict(
        id=record.employee_id,
        name=record.employee.name,
        role=record.employee.role,
        components=[
            dict(name=c["name"], amount=D(c["amount"]), source=c["source"]) for c in components
        ],
        breakdown=record.breakdown,
        fractions={k: D(v) for k, v in raw["fractions"].items()},
        **{k: D(raw[k]) for k in ("days", "hours", "excluded", "productive")},
        basis=raw["basis"],
        direct_basis=raw.get("direct_basis", "time"),
        planned_units=D(raw.get("planned_units", "0")),
        justification=raw["justification"],
    )


def plan_input(plan):
    issues, lines = [], []
    records = list(
        db.session.scalars(
            db.select(EmployeePeriodCost)
            .join(Employee)
            .where(
                Employee.company_id == plan.company_id,
                EmployeePeriodCost.period_id == plan.period_id,
            )
            .order_by(EmployeePeriodCost.id)
        )
    )
    staff = [payroll_input(r) for r in records]
    configured = {r.employee_id for r in records}
    for employee in db.session.scalars(
        db.select(Employee).where(Employee.company_id == plan.company_id, Employee.active == true())
    ):
        if employee.id not in configured:
            issues.append(
                f"{employee.name}: falta configurar su costo mensual, incluso si es cero."
            )
    concepts = [
        dict(
            id=f"concept-{c.id}",
            name=c.name,
            kind=c.kind,
            amount=c.amount,
            basis=c.basis,
            targets=c.targets,
            justification=c.justification,
            behavior=c.behavior,
        )
        for c in db.session.scalars(
            db.select(CostConcept)
            .where(
                CostConcept.company_id == plan.company_id,
                CostConcept.period_id == plan.period_id,
                CostConcept.active == true(),
            )
            .order_by(CostConcept.id)
        )
    ]
    for line in plan.lines:
        recipe = line.recipe
        if recipe.product_id != line.product_id or line.product.company_id != plan.company_id:
            raise ValueError("Referencia de receta ajena al plan.")
        work = db.session.scalar(db.select(RecipeWork).where(RecipeWork.recipe_id == recipe.id))
        materials = []
        for material in recipe.lines:
            cost = db.session.get(MaterialCostVersion, material.cost_version_id)
            if (
                material.material.company_id != plan.company_id
                or cost.material_id != material.material_id
            ):
                raise ValueError("Referencia de material ajena al plan.")
            average, price_source = inventory_price(
                plan.company_id, material.material_id, plan.price_date
            )
            if price_source != "kardex" and cost.effective_on > plan.price_date:
                issues.append(
                    f"{recipe.product_name}: el precio de {material.material_name} tiene vigencia posterior a la fecha de referencia. Revisa la receta o la fecha del plan."
                )
            if recipe.currency != plan.company.currency or (
                price_source != "kardex" and cost.currency != plan.company.currency
            ):
                issues.append(f"{recipe.product_name}: la moneda del precio o receta no coincide.")
            if price_source == "pending":
                issues.append(
                    f"{recipe.product_name}: el kardex de {material.material_name} tiene valoración pendiente; registra las entradas faltantes."
                )
            materials.append(
                dict(
                    name=material.material_name,
                    material_id=material.material_id,
                    base_unit=material.material.base_unit.symbol,
                    version=cost.id,
                    quantity=material.quantity,
                    factor=material.factor,
                    mode=material.mode,
                    rate=material.rate,
                    unit_cost=average if price_source == "kardex" else version_result(cost),
                    origin=(
                        "Promedio ponderado del kardex"
                        if price_source == "kardex"
                        else "Kardex pendiente; precio de receta provisional"
                        if price_source == "pending"
                        else cost.source
                    ),
                    price_source=price_source,
                    effective_on=cost.effective_on.isoformat(),
                    conversion=material.conversion_evidence,
                    price_inputs={
                        k: getattr(cost, k)
                        for k in (
                            "mode",
                            "unit_cost",
                            "quantity",
                            "factor",
                            "net_amount",
                            "nonrecoverable_tax",
                            "recoverable_tax",
                            "attributable_cost",
                        )
                    },
                )
            )
        operations = []
        if work:
            for op in work.operations:
                employee = db.session.get(Employee, op["employee_id"])
                if employee is None or employee.company_id != plan.company_id:
                    raise ValueError("Trabajador ajeno a la receta.")
                operations.append(
                    dict(employee_id=employee.id, activity=op["activity"], minutes=D(op["minutes"]))
                )
        lines.append(
            dict(
                id=line.id,
                product_id=line.product_id,
                recipe_id=recipe.id,
                recipe_number=recipe.number,
                name=recipe.product_name,
                unit=recipe.output_unit.symbol,
                output=recipe.output_quantity,
                quantity=line.quantity,
                reference_price=line.reference_price,
                equivalent_factor=line.equivalent_factor,
                pricing_mode=line.pricing_mode,
                pricing_value=line.pricing_value,
                adopted_price=line.adopted_price,
                tax=D(".18")
                if plan.company.industry.slug == "restaurantes"
                else (line.tax_rate if line.tax_rate is not None else plan.period.tax_rate),
                materials=materials,
                price_pending=any(m["price_source"] == "pending" for m in materials),
                operations=operations,
                no_materials=bool(work and work.no_materials),
                no_labor=bool(work and work.no_labor),
            )
        )
    return dict(
        engine=ENGINE,
        company=plan.company.display_name,
        company_id=plan.company_id,
        currency=plan.company.currency,
        period=plan.period.label,
        period_id=plan.period_id,
        plan=plan.name,
        plan_id=plan.id,
        price_date=plan.price_date.isoformat(),
        assumption="Producción igual a ventas; sin inventarios ni productos en proceso; consumo proporcional de lotes.",
        no_cif=plan.no_cif,
        no_expenses=plan.no_expenses,
        staff=staff,
        concepts=concepts,
        lines=lines,
        issues=issues,
    )


def evaluate(plan):
    data = plan_input(plan)
    fingerprint = hashlib.sha256(
        json.dumps(plain(data), sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()
    ).hexdigest()
    return data, calculate_plan(data), fingerprint
