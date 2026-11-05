"""External catalog browsing and explicit ingredient selection."""

from flask import Blueprint, abort, flash, redirect, request, url_for
from flask_login import current_user, login_required
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.forms.company import ActionForm
from app.routes.products import own_product
from app.services.catalog import get_catalog
from app.services.catalog_selection import select_ingredient
from app.services.companies import owned_company

bp = Blueprint("catalog", __name__, url_prefix="/empresas/<int:company_id>/catalogo")


@bp.get("")
@login_required
def index(company_id):
    company = owned_company(company_id)
    from app.routes.materials import render_workspace

    return render_workspace(company)


@bp.post("/<int:ingredient_id>/seleccionar")
@login_required
def select(company_id, ingredient_id):
    company = owned_company(company_id)
    if not ActionForm().validate_on_submit():
        abort(400)
    product_id = request.form.get("plato", type=int)
    product = own_product(company_id, product_id, True) if product_id else None
    try:
        item = get_catalog().get(ingredient_id)
        material, cost = select_ingredient(company, current_user.id, item)
        db.session.commit()
    except (ValueError, IntegrityError) as exc:
        db.session.rollback()
        flash(
            str(exc)
            if isinstance(exc, ValueError)
            else "Este insumo ya fue seleccionado. Actualiza la página.",
            "warning",
        )
        return redirect(
            url_for(
                "materials.index",
                company_id=company_id,
                plato=product_id,
                tab="catalogo",
            )
        )
    if product:
        return redirect(
            url_for(
                "products.catalog_add",
                company_id=company_id,
                product_id=product.id,
                material_id=material.id,
            )
        )
    return redirect(url_for("materials.detail", company_id=company_id, material_id=material.id))
