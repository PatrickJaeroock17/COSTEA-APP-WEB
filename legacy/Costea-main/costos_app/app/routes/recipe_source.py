from datetime import date

from flask import Blueprint, abort, flash, redirect, request, url_for
from flask_login import current_user, login_required
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.forms.company import ActionForm
from app.models import Product
from app.services.companies import owned_company
from app.services.inventory import lock_inventory, recipe_quantities, require_stock
from app.services.personalization import personalize
from app.services.recipe_source import get_recipe_source

bp = Blueprint("recipe_source", __name__, url_prefix="/empresas/<int:company_id>/platos-fuente")


@bp.get("")
@login_required
def index(company_id):
    owned_company(company_id)
    return redirect(url_for("products.index", company_id=company_id, _anchor="equipo"))


@bp.post("")
@login_required
def select(company_id):
    company = owned_company(company_id)
    if not ActionForm().validate_on_submit():
        abort(400)
    try:
        dishes = get_recipe_source().dishes()
        dish = next((d for d in dishes if d.key == request.form.get("source_id")), None)
        if dish is None:
            abort(404)
        existing = db.session.scalar(
            db.select(Product).where(
                Product.company_id == company.id,
                Product.source_key == dish.key,
            )
        )
        if existing:
            lock_inventory(company_id)
            recipe = existing.recipes[-1]
            require_stock(company_id, recipe_quantities(recipe, recipe.output_quantity), date.today())
            db.session.rollback()
            flash("Este plato ya está en tus recetas. Puedes editarlo directamente.", "info")
            return redirect(
                url_for("products.detail", company_id=company.id, product_id=existing.id)
            )
        product = personalize(company, current_user.id, dish)
        db.session.commit()
        flash(
            "Receta creada. Ya puedes ajustar cantidades, ingredientes, rendimiento y costos.",
            "success",
        )
        return redirect(url_for("products.detail", company_id=company.id, product_id=product.id))
    except ValueError as exc:
        db.session.rollback()
        flash(str(exc), "warning")
    except IntegrityError:
        db.session.rollback()
        flash("Este plato ya fue personalizado. Abre tu receta existente.", "warning")
    return redirect(url_for("products.index", company_id=company.id, _anchor="equipo"))
