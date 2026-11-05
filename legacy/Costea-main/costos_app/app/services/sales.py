"""Actual monthly results. Selling prices include 18% IGV, costs exclude recoverable tax."""

import calendar
from datetime import date
from decimal import Decimal

from sqlalchemy import true

from app.extensions import db
from app.models import CostConcept, Employee, EmployeePeriodCost
from app.models.sales import Sale
from app.services.costing import labor_cost
from app.services.planning import payroll_input

D = Decimal
IGV = D("0.18")


def summarize(sales, fixed=D("0"), other_variable=D("0")):
    rows = {}
    for sale in sales:
        row = rows.setdefault(
            sale.product_id, dict(name=sale.product.name, quantity=D(0), gross=D(0), materials=D(0))
        )
        row["quantity"] += sale.quantity
        row["gross"] += sale.quantity * sale.unit_price
        row["materials"] += sale.quantity * sale.unit_cost
    gross = sum((r["gross"] for r in rows.values()), D(0))
    net = gross / (1 + IGV)
    materials = sum((r["materials"] for r in rows.values()), D(0))
    contribution = net - materials - other_variable
    ratio = contribution / net if net else None
    equilibrium = fixed / ratio if ratio and ratio > 0 else None
    for row in rows.values():
        row["net"] = row["gross"] / (1 + IGV)
        row["variable"] = row["materials"] + (other_variable * row["net"] / net if net else D(0))
        row["contribution"] = row["net"] - row["variable"]
        row["fixed"] = fixed * row["net"] / net if net else D(0)
        row["profit"] = row["contribution"] - row["fixed"]
    return dict(
        rows=sorted(rows.values(), key=lambda r: (-r["quantity"], r["name"])),
        gross=gross,
        net=net,
        tax=gross - net,
        materials=materials,
        variable=materials + other_variable,
        fixed=fixed,
        costs=materials + other_variable + fixed,
        profit=contribution - fixed,
        ratio=ratio,
        equilibrium=equilibrium,
        equilibrium_gross=equilibrium * (1 + IGV) if equilibrium is not None else None,
    )


def monthly_results(company_id, period):
    start = date(period.year, period.month, 1)
    end = date(period.year, period.month, calendar.monthrange(period.year, period.month)[1])
    sales = list(
        db.session.scalars(
            db.select(Sale)
            .where(Sale.company_id == company_id, Sale.sold_on >= start, Sale.sold_on <= end)
            .order_by(Sale.sold_on.desc(), Sale.id.desc())
        )
    )
    concepts = list(
        db.session.scalars(
            db.select(CostConcept).where(
                CostConcept.company_id == company_id,
                CostConcept.period_id == period.id,
                CostConcept.active == true(),
            )
        )
    )
    fixed = sum((c.amount for c in concepts if c.behavior == "fixed"), D(0))
    variable = sum((c.amount for c in concepts if c.behavior != "fixed"), D(0))
    payroll = list(
        db.session.scalars(
            db.select(EmployeePeriodCost)
            .join(Employee)
            .where(Employee.company_id == company_id, EmployeePeriodCost.period_id == period.id)
        )
    )
    fixed += sum((labor_cost(payroll_input(p))["total"] for p in payroll), D(0))
    result = summarize(sales, fixed, variable)
    result["sales"] = sales
    result["period"] = period
    result["missing_staff"] = db.session.scalar(
        db.select(db.func.count())
        .select_from(Employee)
        .where(
            Employee.company_id == company_id,
            Employee.active == true(),
            Employee.id.not_in([p.employee_id for p in payroll]),
        )
    )
    return result
