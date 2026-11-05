"""Monthly worker minute costs from stored payroll, before MOD/indirect allocation."""

from app.extensions import db
from app.models import Employee, EmployeePeriodCost
from app.services.costing import labor_cost
from app.services.planning import payroll_input


def worker_minute_rows(company_id, period_id):
    records = {
        record.employee_id: record
        for record in db.session.scalars(
            db.select(EmployeePeriodCost)
            .join(Employee)
            .where(Employee.company_id == company_id, EmployeePeriodCost.period_id == period_id)
        )
    }
    rows = []
    for employee in db.session.scalars(
        db.select(Employee)
        .where(Employee.company_id == company_id)
        .order_by(Employee.role, Employee.name)
    ):
        record = records.get(employee.id)
        if not employee.active and record is None:
            continue
        row = dict(
            employee=employee,
            salary=None,
            programmed=None,
            productive=None,
            effective=None,
            rate=None,
            excluded=None,
            days=None,
            hours=None,
            by_quantity=False,
            missing=record is None,
        )
        if record:
            data = payroll_input(record)
            cost = labor_cost(data)
            programmed = data["days"] * data["hours"] * 60
            effective = (programmed - data["excluded"]) * data["productive"]
            row.update(
                salary=cost["total"],
                programmed=programmed,
                productive=data["productive"],
                effective=effective,
                rate=cost["total"] / effective if effective else None,
                excluded=data["excluded"],
                days=data["days"],
                hours=data["hours"],
                by_quantity=cost["direct_basis"] == "quantity",
            )
        rows.append(row)
    return rows
