"""Production and net sales by dish, with complete unit costs from the shared engine."""

from decimal import Decimal


def production_table(result):
    zero = Decimal("0")
    rows = []
    compatible = len({r["unit"] for r in result["rows"]}) <= 1
    quantity = sum((r["quantity"] for r in result["rows"]), zero) if compatible else None
    for r in result["rows"]:
        net = r["price"]["net"] if r["price"] else None
        rows.append(
            dict(
                name=r["name"],
                quantity=r["quantity"],
                unit=r["unit"],
                share=r["quantity"] / quantity if quantity else None,
                net=net,
                sales=net * r["quantity"] if net is not None else None,
                cost=r["complete"],
                total_cost=r["complete"] * r["quantity"] if r["complete"] is not None else None,
            )
        )
    sales = (
        sum((r["sales"] for r in rows), zero) if all(r["sales"] is not None for r in rows) else None
    )
    for row in rows:
        row["sales_share"] = row["sales"] / sales if sales and row["sales"] is not None else None
    return dict(
        rows=rows,
        quantity=quantity,
        sales=sales,
        cost=sum((r["total_cost"] for r in rows), zero)
        if all(r["total_cost"] is not None for r in rows)
        else None,
        issues=result["issues"],
        idle=result["totals"]["idle"],
        unassigned=result["totals"]["unassigned"],
    )
