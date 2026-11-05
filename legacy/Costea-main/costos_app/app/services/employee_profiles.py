"""Remove a restaurant's employee and draft inputs; retain published snapshots."""

from app.extensions import db
from app.models import Product, RecipeVersion
from app.models.planning import Employee, EmployeePeriodCost, ProductionPlan, RecipeWork


def employee_dependencies(company_id, employee_id):
    payroll_count = db.session.scalar(
        db.select(db.func.count(EmployeePeriodCost.id)).where(
            EmployeePeriodCost.employee_id == employee_id
        )
    )
    work = list(
        db.session.scalars(
            db.select(RecipeWork)
            .join(RecipeVersion)
            .join(Product)
            .where(Product.company_id == company_id)
        )
    )
    assignments = sum(
        str(operation.get("employee_id")) == str(employee_id)
        for record in work
        for operation in record.operations
    )
    return payroll_count, assignments, work


def delete_employee(company_id, employee_id):
    employee = db.session.scalar(
        db.select(Employee)
        .where(Employee.id == employee_id, Employee.company_id == company_id)
        .with_hint(Employee, "WITH (UPDLOCK, HOLDLOCK)", dialect_name="mssql")
    )
    if employee is None:
        raise ValueError("El trabajador ya no está disponible en este restaurante.")
    _, _, work = employee_dependencies(company_id, employee_id)
    for record in work:
        operations = [
            operation
            for operation in record.operations
            if str(operation.get("employee_id")) != str(employee_id)
        ]
        if len(operations) != len(record.operations):
            record.operations = operations
    db.session.execute(
        db.delete(EmployeePeriodCost).where(EmployeePeriodCost.employee_id == employee_id)
    )
    db.session.execute(
        db.update(ProductionPlan)
        .where(ProductionPlan.company_id == company_id)
        .values(calculation_hash=None)
    )
    db.session.delete(employee)
    db.session.flush()
