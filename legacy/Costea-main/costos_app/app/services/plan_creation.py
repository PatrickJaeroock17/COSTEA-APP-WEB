"""Validate selected dishes before creating any plan or line."""

import re
from decimal import Decimal
from types import SimpleNamespace

from sqlalchemy import true

from app.extensions import db
from app.models import PlanLine, Product, ProductionPlan, ProductPrice


def plan_dish_options(company, period_id, formdata=None):
    options = []
    for product in db.session.scalars(
        db.select(Product)
        .where(Product.company_id == company.id, Product.active == true())
        .order_by(Product.name)
    ):
        if not product.recipes:
            continue
        previous = db.session.scalar(
            db.select(PlanLine)
            .join(ProductionPlan)
            .where(
                ProductionPlan.company_id == company.id,
                ProductionPlan.period_id == period_id,
                PlanLine.product_id == product.id,
            )
            .order_by(ProductionPlan.id.desc())
            .limit(1)
        )
        price = db.session.get(ProductPrice, product.id)
        amount = (
            price.amount
            if price
            else (
                previous.adopted_price
                if previous and previous.adopted_price is not None
                else previous.pricing_value
                if previous and previous.pricing_mode == "manual"
                else None
            )
        )
        item = dict(
            product=product,
            recipe=product.recipes[-1],
            quantity=str(previous.quantity) if previous else "",
            price=str(amount) if amount is not None else "",
            factor=str(previous.equivalent_factor) if previous else "1",
            origin="Datos propuestos del mismo mes"
            if previous
            else "Precio guardado"
            if price
            else "Completa cantidad y precio",
            selected=False,
        )
        if formdata is not None:
            item.update(
                selected=str(product.id) in formdata.getlist("dish_ids"),
                **{
                    key: formdata.get(f"{prefix}_{product.id}", item[key])
                    for key, prefix in [
                        ("quantity", "quantity"),
                        ("price", "price"),
                        ("factor", "factor"),
                    ]
                },
            )
        options.append(SimpleNamespace(**item))
    return options


def selected_plan_lines(options, formdata, tax):
    ids = formdata.getlist("dish_ids")
    if len(ids) != len(set(ids)) or any(i not in {str(o.product.id) for o in options} for i in ids):
        return [], ["La selección contiene platos repetidos o ajenos al restaurante."]
    rows, errors = [], []
    for item in options:
        if str(item.product.id) not in ids:
            continue
        values = {}
        for key, label in [
            ("quantity", "cantidad mensual"),
            ("price", "precio final"),
            ("factor", "factor equivalente"),
        ]:
            raw = getattr(item, key).strip().replace(",", ".")
            if not re.fullmatch(r"[0-9]{1,12}(?:\.[0-9]{1,6})?", raw) or Decimal(raw) <= 0:
                errors.append(
                    f"{item.product.name}: indica {label} mayor que cero, con hasta 6 decimales."
                )
            else:
                values[key] = Decimal(raw)
        if len(values) == 3:
            rows.append(
                dict(
                    product_id=item.product.id,
                    recipe_id=item.recipe.id,
                    quantity=values["quantity"],
                    reference_price=values["price"] / (1 + tax),
                    equivalent_factor=values["factor"],
                    pricing_mode="manual",
                    pricing_value=values["price"],
                    adopted_price=None,
                    tax_rate=tax,
                )
            )
    return rows, errors
