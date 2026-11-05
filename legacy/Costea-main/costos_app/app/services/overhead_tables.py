"""Separate overhead tables derived from the existing plan allocations, never a second budget."""

from decimal import Decimal

D = Decimal
TITLES = {
    "cif": "COSTOS INDIRECTOS DEL RESTAURANTE (FABRICACIÓN)",
    "admin": "GASTOS ADMINISTRATIVOS",
    "sales": "GASTOS DE VENTAS",
    "finance": "Gastos financieros",
    "other": "Otros gastos operativos",
}


def overhead_tables(records, result=None, line=None):
    allocations = {a["id"]: a for a in result["allocations"]} if result else {}
    inputs = [
        dict(
            key=f"concept-{c.id}",
            id=c.id,
            name=c.name,
            kind=c.kind,
            amount=c.amount,
            active=c.active,
            basis=c.basis,
            payroll=False,
        )
        for c in records
    ]
    inputs += [
        dict(
            key=a["id"],
            id=None,
            name=a["name"],
            kind=a["kind"],
            amount=a["amount"],
            active=True,
            basis=a["basis"],
            payroll=True,
        )
        for a in allocations.values()
        if str(a["id"]).startswith("salary-")
    ]
    groups = []
    for kind, title in TITLES.items():
        rows = []
        for item in (i for i in inputs if i["kind"] == kind):
            percent, assigned, unit_cost = None, None, None
            if line and not item["active"]:
                percent, assigned, unit_cost = D("0"), D("0"), D("0")
            elif line and (a := allocations.get(item["key"])):
                base = sum(a["bases"].values(), D("0"))
                percent = a["bases"].get(line.id, D("0")) / base if base else None
                # Missing denominator is pending, except a genuinely zero amount.
                if base or item["amount"] == 0:
                    assigned = a["exact"].get(line.id, D("0"))
                    unit_cost = assigned / line.quantity if line.quantity else None
            rows.append(
                item
                | dict(
                    percent=percent,
                    assigned=assigned,
                    unit_cost=unit_cost,
                    quantity=line.quantity if line else None,
                )
            )
        if kind in ("cif", "admin", "sales") or rows:
            groups.append(
                dict(
                    kind=kind,
                    title=title,
                    rows=rows,
                    monthly=sum((r["amount"] for r in rows if r["active"]), D("0")),
                    total=sum((r["unit_cost"] for r in rows), D("0"))
                    if line and line.quantity and all(r["unit_cost"] is not None for r in rows)
                    else None,
                )
            )
    return groups
