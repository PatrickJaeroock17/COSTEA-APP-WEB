"""Pure Decimal engine v1: labor, allocation, prices and reconciled monthly plans."""

from decimal import ROUND_FLOOR, ROUND_HALF_UP, Decimal, localcontext

from app.services.materials import nonnegative
from app.services.recipes import LineInput, calculate_line

D = Decimal
ZERO = D("0")
CENT = D("0.01")
ENGINE = "1.3.0"


def money(value):
    with localcontext() as ctx:
        ctx.prec = max(28, len(value.as_tuple().digits) + abs(value.as_tuple().exponent) + 4)
        return value.quantize(CENT, rounding=ROUND_HALF_UP)


def labor_cost(data):
    total = sum((nonnegative(c["amount"]) for c in data["components"]), ZERO)
    fractions = data["fractions"]
    if set(fractions) != {"mod", "cif", "admin", "sales"} or sum(fractions.values()) != 1:
        raise ValueError("La distribución del personal debe sumar 100 %.")
    for value in [
        *fractions.values(),
        data["days"],
        data["hours"],
        data["excluded"],
        data["productive"],
    ]:
        nonnegative(value)
    programmed = data["days"] * data["hours"] * 60
    if data["excluded"] > programmed or data["productive"] > 1:
        raise ValueError("Tiempo excluido o productividad inválidos.")
    effective = (programmed - data["excluded"]) * data["productive"]
    direct_cost, minutes = total * fractions["mod"], effective * fractions["mod"]
    rate = direct_cost / minutes if minutes else None
    direct_basis = data.get("direct_basis", "time")
    if direct_basis not in ("time", "quantity"):
        raise ValueError("Base de mano de obra inválida.")
    planned_units = nonnegative(data.get("planned_units", ZERO))
    unit_rate = direct_cost / planned_units if planned_units else None
    return dict(
        total=total,
        cost=direct_cost,
        minutes=minutes,
        rate=rate,
        direct_basis=direct_basis,
        planned_units=planned_units,
        unit_rate=unit_rate,
        indirect={k: total * fractions[k] for k in ("cif", "admin", "sales")},
    )


def allocation(amount, bases):
    nonnegative(amount)
    for b in bases.values():
        nonnegative(b)
    base = sum(bases.values(), ZERO)
    exact = {key: amount * b / base if base else ZERO for key, b in bases.items()}
    # Reconcile full precision too; deterministic residual to the greatest positive base.
    if base:
        key = min((k for k in bases if bases[k] > 0), key=lambda k: (-bases[k], k))
        exact[key] += amount - sum(exact.values(), ZERO)
    rounded = {k: v.quantize(CENT, rounding=ROUND_FLOOR) for k, v in exact.items()}
    if base:
        cents = int((money(amount) - sum(rounded.values(), ZERO)) / CENT)
        order = sorted(exact, key=lambda k: (-(exact[k] - rounded[k]), k))
        for key in order[:cents]:
            rounded[key] += CENT
    return dict(exact=exact, rounded=rounded, unassigned=ZERO if base else amount)


def price(cost, mode, value, tax, adopted=None):
    for v in (cost, value, tax):
        nonnegative(v)
    if (
        tax > 1
        or mode not in ("markup", "margin", "manual", "food_cost")
        or (mode == "margin" and value >= 1)
        or (mode == "food_cost" and not 0 < value <= 1)
    ):
        raise ValueError("Tasa, margen o modalidad inválidos.")
    suggested_net = (
        cost / value
        if mode == "food_cost"
        else cost * (1 + value)
        if mode == "markup"
        else cost / (1 - value)
        if mode == "margin"
        else value / (1 + tax)
    )
    suggested = suggested_net * (1 + tax)
    final = money(nonnegative(adopted) if adopted is not None else suggested)
    net = final / (1 + tax)
    return dict(
        suggested=suggested,
        final=final,
        net=net,
        tax=final - net,
        result=net - cost,
        margin=(net - cost) / net if net else None,
        markup=(net - cost) / cost if cost else None,
        cost_ratio=cost / net if net else None,
    )


def calculate_plan(data):
    with localcontext() as ctx:
        ctx.prec = 28
        return _calculate_plan(data)


def _calculate_plan(data):
    issues = list(data.get("issues", []))
    rows, staff, concepts = {}, {}, list(data["concepts"])
    requirements = {}
    for employee in data["staff"]:
        result = labor_cost(employee)
        staff[employee["id"]] = result | {
            "name": employee["name"],
            "required": ZERO,
            "assigned": ZERO,
            "required_units": ZERO,
        }
        if result["direct_basis"] == "time" and result["cost"] > 0 and result["minutes"] == 0:
            issues.append(f"{employee['name']}: costo MOD positivo sin minutos disponibles.")
        if result["direct_basis"] == "quantity" and not result["planned_units"]:
            issues.append(f"{employee['name']}: indica las porciones mensuales previstas.")
        for kind, amount in result["indirect"].items():
            if amount:
                concepts.append(
                    dict(
                        id=f"salary-{employee['id']}-{kind}",
                        name=f"Personal · {employee['name']} · {kind}",
                        kind=kind,
                        amount=amount,
                        basis=employee["basis"],
                        targets=[],
                        justification=employee["justification"],
                    )
                )
    if not any(line["quantity"] > 0 for line in data["lines"]):
        issues.append("El plan necesita al menos un producto con cantidad positiva.")
    for line in data["lines"]:
        key, quantity, output = line["id"], line["quantity"], line["output"]
        nonnegative(quantity)
        if output <= 0:
            raise ValueError("El lote debe producir una cantidad positiva.")
        row = dict(
            id=key,
            name=line["name"],
            unit=line["unit"],
            quantity=quantity,
            cmp=ZERO,
            mod=ZERO,
            cif=ZERO,
            expenses=ZERO,
            admin=ZERO,
            selling=ZERO,
            finance=ZERO,
            minutes=ZERO,
            price=None,
            complete=None,
            production=None,
            material_details=[],
            labor_details=[],
        )
        rows[key] = row
        if quantity == 0:
            continue
        if not line["materials"] and not line["no_materials"]:
            issues.append(f"{line['name']}: faltan insumos o declarar que no aplican.")
        if line["materials"] and line["no_materials"]:
            issues.append(f"{line['name']}: no puede declarar sin materiales si hay insumos.")
        if not line["operations"] and not line["no_labor"]:
            issues.append(f"{line['name']}: faltan operaciones o declarar que no aplica MOD.")
        if line["operations"] and line["no_labor"]:
            issues.append(f"{line['name']}: hay operaciones y declaración sin MOD simultáneas.")
        for material in line["materials"]:
            result = calculate_line(
                LineInput(
                    material["quantity"],
                    material["factor"],
                    material["unit_cost"],
                    material["mode"],
                    material["rate"],
                )
            )
            row["cmp"] += result.amount / output
            # Consolidate in each ingredient's purchase/base unit, including loss.
            material_key = material.get("material_id", material["name"])
            needed = requirements.setdefault(
                material_key,
                dict(
                    material_id=material_key,
                    name=material["name"],
                    unit=material.get("base_unit", "unidad base"),
                    quantity=ZERO,
                    amount=ZERO,
                    price_versions=[],
                ),
            )
            needed["quantity"] += result.gross_quantity * quantity / output
            needed["amount"] += result.amount * quantity / output
            if material["version"] not in needed["price_versions"]:
                needed["price_versions"].append(material["version"])
            row["material_details"].append(
                dict(
                    name=material["name"],
                    gross=result.gross_quantity,
                    amount=result.amount,
                    version=material["version"],
                    unit_cost=material["unit_cost"],
                    origin=material.get("origin"),
                )
            )
        counted_workers = set()
        for operation in line["operations"]:
            employee = staff.get(operation["employee_id"])
            if employee and employee["direct_basis"] == "quantity":
                if operation["employee_id"] in counted_workers:
                    continue  # Several activities by one worker must not charge each portion twice.
                counted_workers.add(operation["employee_id"])
                if employee["unit_rate"] is None:
                    continue
                amount = employee["unit_rate"]
                row["mod"] += amount
                employee["required_units"] += quantity
                employee["assigned"] += amount * quantity
                row["labor_details"].append(
                    dict(
                        name=employee["name"],
                        activity=operation["activity"],
                        minutes=ZERO,
                        rate=ZERO,
                        amount=amount,
                        by_quantity=True,
                    )
                )
                continue
            minutes = nonnegative(operation["minutes"]) / output
            if minutes == 0:
                issues.append(
                    f"{line['name']}: indica minutos positivos para el trabajador por tiempo."
                )
            row["minutes"] += minutes
            if employee is None or employee["rate"] is None:
                issues.append(
                    f"{line['name']}: falta costo/tiempo MOD válido del trabajador #{operation['employee_id']}."
                )
                continue
            amount = minutes * employee["rate"]
            row["mod"] += amount
            employee["required"] += minutes * quantity
            employee["assigned"] += amount * quantity
            row["labor_details"].append(
                dict(
                    name=employee["name"],
                    activity=operation["activity"],
                    minutes=minutes,
                    rate=employee["rate"],
                    amount=amount,
                )
            )
    capacity = False
    for employee in staff.values():
        employee["excess"] = max(ZERO, employee["required"] - employee["minutes"])
        employee["idle"] = employee["cost"] - employee["assigned"]
        employee["excess_units"] = max(ZERO, employee["required_units"] - employee["planned_units"])
        if employee["excess_units"] > 0:
            capacity = True
            issues.append(f"{employee['name']}: se superan las porciones mensuales previstas.")
        if employee["excess"] > 0:
            capacity = True
            issues.append(
                f"{employee['name']}: capacidad excedida en {employee['excess']} minutos."
            )
    if not any(c["kind"] == "cif" for c in concepts) and not data["no_cif"]:
        issues.append("Faltan CIF o declarar expresamente que no aplican.")
    if not any(c["kind"] != "cif" for c in concepts) and not data["no_expenses"]:
        issues.append("Faltan gastos o declarar expresamente que no aplican.")
    if data["no_cif"] and any(c["kind"] == "cif" and c["amount"] for c in concepts):
        issues.append("Hay CIF positivos: retira la declaración de que no aplican.")
    if data["no_expenses"] and any(c["kind"] != "cif" and c["amount"] for c in concepts):
        issues.append("Hay gastos positivos: retira la declaración de que no aplican.")
    allocations, unassigned = [], ZERO
    for concept in concepts:
        bases = {}
        for line in data["lines"]:
            if concept["targets"] and line["product_id"] not in concept["targets"]:
                continue
            value = (
                line["equivalent_factor"]
                if concept["basis"] == "equivalent"
                else rows[line["id"]]["minutes"]
                if concept["basis"] == "mod"
                else line["reference_price"]
            )
            bases[line["id"]] = line["quantity"] * value
        allocated = allocation(concept["amount"], bases)
        for key, amount in allocated["exact"].items():
            rows[key]["cif" if concept["kind"] == "cif" else "expenses"] += amount
            if concept["kind"] in ("admin", "sales", "finance"):
                rows[key][
                    {"admin": "admin", "sales": "selling", "finance": "finance"}[concept["kind"]]
                ] += amount
        unassigned += allocated["unassigned"]
        if allocated["unassigned"]:
            issues.append(f"{concept['name']}: importe positivo sin base de asignación.")
        allocations.append(concept | allocated | {"bases": bases})
    for line in data["lines"]:
        row = rows[line["id"]]
        if not line["quantity"]:
            continue
        row["production"] = row["cmp"] + row["mod"] + row["cif"] / line["quantity"]
        row["complete"] = row["production"] + row["expenses"] / line["quantity"]
        if line["tax"] is None:
            issues.append(f"{line['name']}: falta configurar el impuesto del periodo o producto.")
        elif not line.get("price_pending"):
            row["price"] = price(
                row["complete"],
                line["pricing_mode"],
                line["pricing_value"],
                line["tax"],
                line["adopted_price"],
            )
    cmp = sum((r["cmp"] * r["quantity"] for r in rows.values()), ZERO)
    mod_available = sum((s["cost"] for s in staff.values()), ZERO)
    mod_assigned = sum((s["assigned"] for s in staff.values()), ZERO)
    cif = sum((c["amount"] for c in concepts if c["kind"] == "cif"), ZERO)
    expenses = sum((c["amount"] for c in concepts if c["kind"] != "cif"), ZERO)
    sales = sum((r["quantity"] * r["price"]["net"] for r in rows.values() if r["price"]), ZERO)
    full = sum(
        (r["quantity"] * r["complete"] for r in rows.values() if r["complete"] is not None), ZERO
    )
    costs = cmp + mod_available + cif + expenses
    bridge = full + (mod_available - mod_assigned) + unassigned
    difference = costs - bridge
    if abs(difference) > D("0.00000001"):
        issues.append("La conciliación de costos no coincide; revisa las entradas.")
    return dict(
        engine=ENGINE,
        status="capacidad_excedida"
        if capacity
        else "sin_base_asignacion"
        if unassigned
        else "incompleto"
        if issues
        else "calculable",
        issues=list(dict.fromkeys(issues)),
        rows=list(rows.values()),
        staff=list(staff.values()),
        allocations=allocations,
        requirements=list(requirements.values()),
        totals=dict(
            cmp=cmp,
            mod_available=mod_available,
            mod_assigned=mod_assigned,
            idle=mod_available - mod_assigned,
            cif=cif,
            expenses=expenses,
            admin=sum((c["amount"] for c in concepts if c["kind"] == "admin"), ZERO),
            selling=sum((c["amount"] for c in concepts if c["kind"] == "sales"), ZERO),
            finance=sum((c["amount"] for c in concepts if c["kind"] == "finance"), ZERO),
            production=cmp + mod_assigned + cif,
            unassigned=unassigned,
            complete_assigned=full,
            costs=costs,
            sales=sales,
            profit=None if issues else sales - costs,
            margin=(sales - costs) / sales if sales and not issues else None,
            bridge=bridge,
            difference=difference,
        ),
    )
