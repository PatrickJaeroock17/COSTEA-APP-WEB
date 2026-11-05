"""One output unit: CMP/MOD are already unit costs; overhead is a monthly allocation."""

from decimal import Decimal


def portion_summary(result, line_id, tax_rate):
    row = next(row for row in result["rows"] if row["id"] == line_id)
    quantity = row["quantity"]

    def unit(key):
        return row.get(key, Decimal("0")) / quantity if quantity else None

    other = (
        (row["expenses"] - row.get("admin", 0) - row.get("selling", 0) - row.get("finance", 0))
        / quantity
        if quantity
        else None
    )
    complete = not result["issues"] and quantity > 0 and row["price"] is not None
    price = row["price"] if complete else None
    return dict(
        name=row["name"],
        unit=row["unit"],
        complete=complete,
        components=[
            ("Materia prima", row["cmp"]),
            ("Mano de obra directa", row["mod"]),
            ("CIF", unit("cif")),
            ("Gastos administrativos", unit("admin")),
            ("Gastos de ventas", unit("selling")),
            ("Gastos financieros", unit("finance")),
            ("Otros gastos", other),
        ],
        total=row["complete"] if complete else None,
        profit=price["result"] if price else None,
        net=price["net"] if price else None,
        tax=price["tax"] if price else None,
        final=price["final"] if price else None,
        suggested=price["suggested"] if price else None,
        tax_rate=tax_rate,
        issues=result["issues"],
    )
