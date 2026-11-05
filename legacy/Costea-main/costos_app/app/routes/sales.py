from decimal import Decimal

from flask import Blueprint, abort, flash, g, redirect, render_template, request, url_for
from flask_login import login_required
from sqlalchemy import true

from app.extensions import db
from app.forms.company import ActionForm
from app.forms.sales import PriceForm, SaleForm
from app.models import Product
from app.models.sales import ProductPrice, Sale
from app.routes.products import calculation, ingredient_prices
from app.services.companies import owned_company
from app.services.costing import money
from app.services.inventory import sale_outputs, void_sale_outputs
from app.services.materials import decimal_text
from app.services.sales import monthly_results

bp = Blueprint("sales", __name__, url_prefix="/empresas/<int:company_id>")


def products(company_id):
    return list(
        db.session.scalars(
            db.select(Product)
            .where(Product.company_id == company_id, Product.active == true())
            .order_by(Product.name)
        )
    )


@bp.route("/precios", methods=["GET", "POST"])
@login_required
def prices(company_id):
    company = owned_company(company_id)
    records = products(company_id)
    form = PriceForm()
    form.product_id.choices = [(p.id, p.name) for p in records]
    if request.method == "GET":
        selected = request.args.get("product_id", type=int)
        if selected in {p.id for p in records}:
            form.product_id.data = selected
            current = db.session.get(ProductPrice, selected)
            form.amount.data = decimal_text(current.amount) if current else ""
    if form.validate_on_submit():
        amount = money(form.amount.value)
        if amount <= 0:
            form.amount.errors.append("El precio mínimo es 0.01.")
        else:
            record = db.session.get(ProductPrice, form.product_id.data)
            if record is None:
                record = ProductPrice(product_id=form.product_id.data)
                db.session.add(record)
            record.amount = amount
            db.session.commit()
            flash("Precio guardado. Se aplicará a las nuevas ventas.", "success")
            if request.form.get("return_to") == "recipe":
                return redirect(
                    url_for(
                        "products.detail",
                        company_id=company_id,
                        product_id=form.product_id.data,
                        _anchor="costo-completo",
                    )
                )
            return redirect(url_for("sales.prices", company_id=company_id))
    amounts = {p.id: db.session.get(ProductPrice, p.id) for p in records}
    return render_template(
        "sales/prices.html",
        company=company,
        products=records,
        amounts=amounts,
        form=form,
        decimal_igv=Decimal("1.18"),
    ), (422 if form.is_submitted() else 200)


@bp.route("/ventas", methods=["GET", "POST"])
@login_required
def index(company_id):
    company = owned_company(company_id)
    records = products(company_id)
    form = SaleForm()
    form.product_id.choices = []
    for product in records:
        price = db.session.get(ProductPrice, product.id)
        label = f"{company.currency} {money(price.amount)}" if price else "sin precio"
        unit = product.recipes[-1].output_unit.symbol if product.recipes else "unidad"
        form.product_id.choices.append((product.id, f"{product.name} · {label} / {unit}"))
    period = g.active_period if g.active_company.id == company_id else None
    if form.validate_on_submit():
        product = next(p for p in records if p.id == form.product_id.data)
        price = db.session.get(ProductPrice, product.id)
        recipe = product.recipes[-1] if product.recipes else None
        prices = ingredient_prices(recipe, form.sold_on.data) if recipe and form.sold_on.data else []
        unit_cost = calculation(recipe, prices=prices)[2] if recipe and prices else None
        if not period or (form.sold_on.data.year, form.sold_on.data.month) != (
            period.year,
            period.month,
        ):
            form.sold_on.errors.append(
                "Selecciona el periodo de esta empresa y registra una fecha dentro de ese mes."
            )
        if price is None:
            form.product_id.errors.append("Asigna primero un precio en Precios de venta.")
        if unit_cost is None:
            form.product_id.errors.append(
                "Completa los ingredientes de la receta antes de registrar ventas."
            )
        elif recipe.currency != company.currency or any(
            quote["source"] != "kardex" and line.cost_version.effective_on > form.sold_on.data
            for line, quote in zip(recipe.lines, prices, strict=True)
        ):
            form.product_id.errors.append(
                "Revisa la moneda y las fechas de vigencia de los costos de la receta."
            )
        if not form.errors:
            sale = Sale(
                company_id=company_id,
                product_id=product.id,
                recipe_id=recipe.id,
                sold_on=form.sold_on.data,
                quantity=form.quantity.value,
                unit_price=price.amount,
                unit_cost=unit_cost,
            )
            try:
                db.session.add(sale)
                sale_outputs(sale, recipe, enforce_stock=True)
                db.session.commit()
            except ValueError as exc:
                db.session.rollback()
                form.quantity.errors.append(str(exc))
            else:
                flash("Venta guardada y salida de inventario registrada.", "success")
                return redirect(url_for("sales.index", company_id=company_id))
    result = monthly_results(company_id, period) if period else None
    return render_template("sales/index.html", company=company, form=form, actual=result), (
        422 if form.is_submitted() else 200
    )


@bp.post("/ventas/<int:sale_id>/eliminar")
@login_required
def delete(company_id, sale_id):
    owned_company(company_id)
    if not ActionForm().validate_on_submit():
        abort(400)
    sale = db.first_or_404(db.select(Sale).where(Sale.id == sale_id, Sale.company_id == company_id))
    void_sale_outputs(sale)
    db.session.delete(sale)
    db.session.commit()
    flash("Venta eliminada y resultados actualizados.", "success")
    return redirect(url_for("sales.index", company_id=company_id))
