"""Read-only recipe labor detail using the same monthly rates as the plan engine."""

from decimal import Decimal

from app.services.costing import labor_cost
from app.services.planning import payroll_input

D = Decimal


def recipe_labor_table(employees, records, recipe, work):
    monthly = {r.employee_id: r for r in records}
    operations = work.operations if work else []
    rows, issues, total = [], [], D("0")
    if not operations and not (work and work.no_labor):
        issues.append(
            "Asigna los minutos de trabajo a esta receta o declara que no requiere MOD en Operaciones."
        )
    if operations and work.no_labor:
        issues.append("La receta tiene operaciones y una declaración sin MOD; revisa Operaciones.")
    for employee in employees:
        assigned = [op for op in operations if op["employee_id"] == employee.id]
        minutes = sum((D(op["minutes"]) for op in assigned), D("0"))
        record = monthly.get(employee.id)
        cost = labor_cost(payroll_input(record)) if record else None
        amount = D("0") if not assigned else None
        note = "Sin tiempo asignado a este plato" if not assigned else ""
        if assigned:
            if not cost:
                issues.append(f"{employee.name}: falta configurar el costo mensual.")
            elif cost["direct_basis"] == "quantity":
                note = "Reparto por porciones; no utiliza tarifa por minuto"
                if cost["unit_rate"] is None:
                    issues.append(f"{employee.name}: faltan las porciones mensuales previstas.")
                else:
                    amount = cost["unit_rate"] * recipe.output_quantity
            elif cost["rate"] is None:
                issues.append(f"{employee.name}: faltan minutos MOD disponibles en el mes.")
            elif any(D(op["minutes"]) <= 0 for op in assigned):
                issues.append(
                    f"{employee.name}: completa los minutos positivos de sus operaciones."
                )
            else:
                amount = minutes * cost["rate"]
        if amount is not None:
            total += amount
        rows.append(
            dict(
                employee=employee,
                salary=cost["total"] if cost else None,
                minutes=minutes,
                rate=cost["rate"] if cost and cost["direct_basis"] == "time" else None,
                amount=amount,
                note=note,
                configured=bool(record),
            )
        )
    known = {employee.id for employee in employees}
    if any(op["employee_id"] not in known for op in operations):
        issues.append("La receta tiene un trabajador no disponible en este restaurante.")
    return dict(
        rows=rows,
        issues=issues,
        total=None if issues else total,
        per_portion=None if issues else total / recipe.output_quantity,
    )
