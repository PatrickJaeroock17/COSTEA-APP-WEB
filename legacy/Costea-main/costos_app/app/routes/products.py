"""Product-first recipe editing shared by the four industry vocabularies."""

from datetime import date
from decimal import Decimal
from uuid import uuid4

from flask import Blueprint, abort, flash, redirect, render_template, request, url_for
from flask_login import current_user, login_required
from sqlalchemy import false, true
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.forms.product import (
    CatalogIngredientForm,
    ProductForm,
    QuickIngredientForm,
    RecipeActionForm,
    ScaleRecipeForm,
)
from app.forms.sales import PriceForm
from app.models import CompanyUnit, Material, MaterialCostVersion, PlanLine, ProductionPlan, Unit
from app.models.product import Product, RecipeLine, RecipeVersion
from app.models.sales import ProductPrice
from app.services.companies import owned_company
from app.services.inventory import (
    inventory_price,
    lock_inventory,
    recipe_quantities,
    require_stock,
    stock_shortages,
)
from app.services.material_identity import next_material_code
from app.services.materials import decimal_text, effective_version, version_result
from app.services.planning import evaluate
from app.services.portion_summary import portion_summary
from app.services.product_deletion import delete_product
from app.services.recipes import LineInput, recipe_totals
from app.services.sectors import sector_terms
from app.services.units import convert_quantity

bp = Blueprint("products", __name__, url_prefix="/empresas/<int:company_id>/productos")
LINE_FIELDS = (
    "material_id",
    "cost_version_id",
    "material_name",
    "quantity",
    "unit_key",
    "unit_label",
    "factor",
    "conversion_evidence",
    "mode",
    "rate",
)


def own_product(company_id, product_id, editable=False):
    company = owned_company(company_id)
    product = db.session.scalar(
        db.select(Product).where(Product.id == product_id, Product.company_id == company.id)
    )
    if not product:
        abort(404)
    if editable and not product.active:
        abort(409, description="Restaura el producto antes de editar su receta.")
    return product


def physical_units():
    return list(
        db.session.scalars(db.select(Unit).where(Unit.dimension != "time").order_by(Unit.name))
    )


def line_data(line):
    return {key: getattr(line, key) for key in LINE_FIELDS}


def reserve_revision(product, expected):
    if expected != str(product.revision):
        abort(409)
    old = product.revision
    result = db.session.execute(
        db.update(Product)
        .where(Product.id == product.id, Product.revision == old)
        .values(revision=old + 1)
    )
    if result.rowcount != 1:
        abort(409)
    return old + 1


def save_recipe(product, number, rows, output_quantity=None, output_unit_code=None):
    previous = product.recipes[-1] if product.recipes else None
    version = RecipeVersion(
        product_id=product.id,
        number=number,
        author_id=current_user.id,
        output_quantity=output_quantity
        if output_quantity is not None
        else previous.output_quantity,
        output_unit_code=output_unit_code or previous.output_unit_code,
        currency=product.company.currency,
        product_name=product.name,
    )
    db.session.add(version)
    db.session.flush()
    for position, row in enumerate(rows, 1):
        db.session.add(RecipeLine(recipe_id=version.id, position=position, **row))
    db.session.commit()


def detail_redirect(product):
    return redirect(
        url_for("products.detail", company_id=product.company_id, product_id=product.id)
    )


def ingredient_prices(recipe, on_date=None):
    prices = []
    for line in recipe.lines:
        average, source = inventory_price(
            line.material.company_id, line.material_id, on_date or date.today()
        )
        prices.append(
            dict(
                unit_cost=average if source == "kardex" else version_result(line.cost_version),
                source=source,
            )
        )
    return prices


def calculation(recipe, on_date=None, prices=None):
    prices = prices if prices is not None else ingredient_prices(recipe, on_date)
    inputs = [
        LineInput(
            line.quantity, line.factor, quote["unit_cost"], line.mode, line.rate
        )
        for line, quote in zip(recipe.lines, prices, strict=True)
    ]
    return recipe_totals(inputs, recipe.output_quantity)


def recipe_shortages(recipe):
    return stock_shortages(
        db.session.get(Product, recipe.product_id).company_id,
        recipe_quantities(recipe, recipe.output_quantity),
        date.today(),
    )


@bp.get("")
@login_required
def index(company_id):
    company = owned_company(company_id)
    query = request.args.get("q", "").strip()[:180]
    archived = request.args.get("estado") == "archivados"
    stmt = db.select(Product).where(
        Product.company_id == company.id,
        Product.active == (false() if archived else true()),
    )
    if query:
        stmt = stmt.where(Product.name.icontains(query, autoescape=True))
    products = list(db.session.scalars(stmt.order_by(Product.name)))
    dishes, source_error = (), None
    source_products = {}
    if company.industry.slug == "restaurantes":
        from app.services.recipe_source import get_recipe_source

        try:
            dishes = get_recipe_source().dishes()
        except ValueError as exc:
            source_error = str(exc)
        source_products = {
            product.source_key: product
            for product in db.session.scalars(
                db.select(Product).where(
                    Product.company_id == company.id,
                    Product.source_key.is_not(None),
                )
            )
        }
    return render_template(
        "products/index.html",
        company=company,
        terms=sector_terms(company),
        products=products,
        query=query,
        archived=archived,
        calculation=calculation,
        stock_shortages=recipe_shortages,
        dishes=dishes,
        source_error=source_error,
        source_products=source_products,
    )


@bp.route("/nuevo", methods=["GET", "POST"])
@bp.route("/<int:product_id>/editar", methods=["GET", "POST"])
@login_required
def edit(company_id, product_id=None):
    company = owned_company(company_id)
    product = own_product(company_id, product_id, True) if product_id else None
    terms = sector_terms(company)
    form = ProductForm(obj=product)
    form.name.label.text = terms["name"]
    form.output_quantity.label.text = terms["yield_label"]
    form.output_unit_code.choices = [
        (u.code, terms["output_label"] if u.code == "unit" else u.name)
        for u in physical_units()
        if u.dimension == "count" and (company.industry.slug != "restaurantes" or u.code == "unit")
    ]
    if request.method == "GET" and product:
        form.revision.data = str(product.revision)
        form.output_quantity.data = decimal_text(product.recipes[-1].output_quantity)
        form.output_unit_code.data = product.recipes[-1].output_unit_code
    if form.validate_on_submit():
        duplicate = next(
            (
                p
                for p in db.session.scalars(
                    db.select(Product).where(Product.company_id == company.id)
                )
                if p.id != product_id
                and " ".join(p.name.casefold().split())
                == " ".join(form.name.data.casefold().split())
            ),
            None,
        )
        if duplicate:
            form.name.errors.append(
                "Ya existe un plato con este nombre. Edita su receta o revisa los archivados."
            )
            return render_template(
                "products/form.html", company=company, terms=terms, product=product, form=form
            ), 422
        if product:
            previous = product.recipes[-1]
            if form.output_quantity.value != previous.output_quantity:
                try:
                    lock_inventory(company_id)
                    require_stock(
                        company_id,
                        recipe_quantities(previous, previous.output_quantity),
                        date.today(),
                    )
                except ValueError as exc:
                    db.session.rollback()
                    form.output_quantity.errors.append(str(exc))
                    return render_template(
                        "products/form.html", company=company, terms=terms, product=product, form=form
                    ), 422
            number = reserve_revision(product, form.revision.data)
            rows = [line_data(line) for line in product.recipes[-1].lines]
        else:
            product = Product(
                company_id=company.id, company=company, code="P-" + uuid4().hex[:12].upper()
            )
            db.session.add(product)
            number, rows = 1, []
        product.name, product.description = form.name.data, form.description.data or None
        db.session.flush()
        save_recipe(product, number, rows, form.output_quantity.value, form.output_unit_code.data)
        flash("Guardado. Agrega los insumos y sus cantidades para calcular el costo.", "success")
        return detail_redirect(product)
    return render_template(
        "products/form.html", company=company, terms=terms, product=product, form=form
    ), (422 if form.is_submitted() else 200)


@bp.get("/<int:product_id>")
@login_required
def detail(company_id, product_id):
    product = own_product(company_id, product_id)
    recipe = product.recipes[-1]
    if "version" in request.args:
        recipe = next(
            (r for r in product.recipes if str(r.number) == request.args["version"]), None
        )
        if recipe is None:
            abort(404)
    prices = ingredient_prices(recipe)
    results, total, per_unit = calculation(recipe, prices=prices)
    plans = list(
        db.session.scalars(
            db.select(ProductionPlan)
            .join(PlanLine)
            .where(
                ProductionPlan.company_id == company_id,
                PlanLine.recipe_id == recipe.id,
            )
            .order_by(ProductionPlan.active.desc(), ProductionPlan.id.desc())
        )
    )
    plan_id = request.args.get("plan", type=int)
    if plan_id is not None and plan_id not in {plan.id for plan in plans}:
        abort(404)
    selected_plan = next((plan for plan in plans if plan.id == plan_id), None)
    selected_plan = selected_plan or (plans[0] if plans else None)
    cost_summary = None
    pricing_mode = None
    selected_line = None
    if selected_plan:
        selected_line = next(
            line for line in selected_plan.lines if line.recipe_id == recipe.id
        )
        data, result, _ = evaluate(selected_plan)
        line_input = next(row for row in data["lines"] if row["id"] == selected_line.id)
        cost_summary = portion_summary(result, selected_line.id, line_input["tax"])
        pricing_mode = selected_line.pricing_mode
    selected_material_ids = {line.material_id for line in product.recipes[-1].lines}
    material_query = db.select(Material).where(
        Material.company_id == company_id, Material.active == true()
    )
    if selected_material_ids:
        material_query = material_query.where(Material.id.not_in(selected_material_ids))
    materials = list(db.session.scalars(material_query.order_by(Material.name)))
    form = quick_form(product)
    action = RecipeActionForm(revision=str(product.revision))
    scale_form = ScaleRecipeForm(
        revision=str(product.revision), output_quantity=decimal_text(recipe.output_quantity)
    )
    sale_price = db.session.get(ProductPrice, product.id)
    price_form = PriceForm()
    price_form.product_id.choices = [(product.id, product.name)]
    price_form.product_id.data = product.id
    price_form.amount.data = decimal_text(sale_price.amount) if sale_price else ""
    return render_template(
        "products/detail.html",
        company=product.company,
        terms=sector_terms(product.company),
        product=product,
        recipe=recipe,
        results=results,
        prices=prices,
        price_pending=any(quote["source"] == "pending" for quote in prices),
        total=total,
        per_unit=per_unit,
        form=form,
        action=action,
        scale_form=scale_form,
        materials=materials,
        version_result=version_result,
        current=recipe.number == product.revision,
        plans=plans,
        selected_plan=selected_plan,
        selected_line=selected_line,
        cost_summary=cost_summary,
        pricing_mode=pricing_mode,
        sale_price=sale_price,
        price_form=price_form,
        shortages=recipe_shortages(recipe),
    )


@bp.post("/<int:product_id>/escalar")
@login_required
def scale(company_id, product_id):
    product = own_product(company_id, product_id, True)
    form = ScaleRecipeForm()
    if not form.validate_on_submit():
        for errors in form.errors.values():
            for error in errors:
                flash(error, "warning")
        return detail_redirect(product)
    previous = product.recipes[-1]
    try:
        lock_inventory(company_id)
        require_stock(
            company_id, recipe_quantities(previous, form.output_quantity.value), date.today()
        )
    except ValueError as exc:
        db.session.rollback()
        flash(str(exc), "warning")
        return detail_redirect(product)
    multiplier = form.output_quantity.value / previous.output_quantity
    number = reserve_revision(product, form.revision.data)
    rows = []
    for line in previous.lines:
        row = line_data(line)
        row["quantity"] = line.quantity * multiplier
        rows.append(row)
    save_recipe(
        product,
        number,
        rows,
        output_quantity=form.output_quantity.value,
        output_unit_code=previous.output_unit_code,
    )
    flash(
        "Receta escalada proporcionalmente. La versión anterior se conserva en el historial.",
        "success",
    )
    return detail_redirect(product)


def quick_form(product):
    form = QuickIngredientForm()
    units = physical_units()
    form.unit_key.choices = [(f"unit:{u.code}", f"{u.name} ({u.symbol})") for u in units]
    form.price_unit_code.choices = [(u.code, f"{u.name} ({u.symbol})") for u in units]
    if request.method == "GET":
        form.revision.data = str(product.revision)
        form.price_unit_code.data = (
            "kg" if product.company.industry.slug == "restaurantes" else "unit"
        )
        form.unit_key.data = (
            "unit:g" if product.company.industry.slug == "restaurantes" else "unit:unit"
        )
    return form


@bp.get("/<int:product_id>/elegir-insumo")
@login_required
def choose_material(company_id, product_id):
    own_product(company_id, product_id, True)
    material_id = request.args.get("material_id", type=int)
    if not material_id:
        abort(400)
    return redirect(
        url_for(
            "products.catalog_add",
            company_id=company_id,
            product_id=product_id,
            material_id=material_id,
        )
    )


@bp.post("/<int:product_id>/insumos/nuevo")
@login_required
def quick_add(company_id, product_id):
    product = own_product(company_id, product_id, True)
    form = quick_form(product)
    if form.validate_on_submit():
        used = db.session.get(Unit, form.unit_key.data.split(":", 1)[1])
        priced = db.session.get(Unit, form.price_unit_code.data)
        if used.dimension != priced.dimension:
            form.unit_key.errors.append(
                "Estas unidades no tienen una equivalencia universal. Usa unidades de la misma dimensión o registra una equivalencia específica desde el catálogo."
            )
        existing = db.session.scalars(db.select(Material).where(Material.company_id == company_id))
        if any(m.name.casefold() == form.name.data.casefold() for m in existing):
            form.name.errors.append(
                "Este insumo ya existe. Agrégalo desde el catálogo; si está archivado, restáuralo primero."
            )
        if not form.errors:
            number = reserve_revision(product, form.revision.data)
            rows = [line_data(line) for line in product.recipes[-1].lines]
            material = Material(
                company_id=company_id,
                code=next_material_code(company_id, "Insumos de recetas"),
                name=form.name.data,
                category="Insumos de recetas",
                base_unit_code=priced.code,
            )
            db.session.add(material)
            db.session.flush()
            cost = MaterialCostVersion(
                material_id=material.id,
                author_id=current_user.id,
                mode="direct",
                effective_on=form.effective_on.data,
                currency=product.company.currency,
                source=form.source.data or f"Precio ingresado en {product.name}",
                unit_cost=form.price.value,
            )
            db.session.add(cost)
            for unit in (used, priced):
                setting = db.session.get(CompanyUnit, (company_id, unit.code))
                if setting:
                    setting.enabled = True
                else:
                    db.session.add(CompanyUnit(company_id=company_id, unit_code=unit.code))
                    db.session.flush()
            db.session.flush()
            rows.append(
                dict(
                    material_id=material.id,
                    cost_version_id=cost.id,
                    material_name=material.display_name,
                    quantity=form.quantity.value,
                    unit_key=form.unit_key.data,
                    unit_label=used.symbol,
                    factor=convert_quantity(Decimal("1"), used, priced),
                    conversion_evidence="Equivalencia universal de unidades compatibles.",
                    mode=form.mode.data,
                    rate=form.rate,
                )
            )
            save_recipe(product, number, rows)
            flash(
                "Insumo agregado y costo actualizado. También quedó disponible en el catálogo.",
                "success",
            )
            return detail_redirect(product)
    return render_template(
        "products/ingredient.html",
        company=product.company,
        terms=sector_terms(product.company),
        product=product,
        form=form,
        quick=True,
        material=None,
        line=None,
    ), 422


def consumption_options(material):
    options = {}
    for unit in physical_units():
        if unit.dimension == material.base_unit.dimension:
            options[f"unit:{unit.code}"] = (
                unit.symbol,
                convert_quantity(Decimal("1"), unit, material.base_unit),
                "Equivalencia universal de unidades compatibles.",
            )
    for conversion in material.conversions:
        options[f"custom:{conversion.id}"] = (
            conversion.label,
            conversion.factor,
            conversion.evidence,
        )
    return options


@bp.route("/<int:product_id>/insumos/catalogo/<int:material_id>", methods=["GET", "POST"])
@bp.route("/<int:product_id>/insumos/<int:line_id>/editar", methods=["GET", "POST"])
@login_required
def catalog_add(company_id, product_id, material_id=None, line_id=None):
    product = own_product(company_id, product_id, True)
    previous = product.recipes[-1]
    line = next((row for row in previous.lines if row.id == line_id), None) if line_id else None
    if line_id and line is None:
        abort(404)
    material_id = line.material_id if line else material_id
    material = db.session.scalar(
        db.select(Material).where(Material.id == material_id, Material.company_id == company_id)
    )
    if material is None:
        abort(404)
    if not material.active and not line:
        abort(409)
    if material.external_insumo_id and not line:
        from app.services.catalog import get_catalog

        try:
            get_catalog().get(material.external_insumo_id)
        except ValueError as exc:
            flash(str(exc), "warning")
            return redirect(
                url_for(
                    "materials.index",
                    company_id=company_id,
                    plato=product.id,
                    tab="catalogo",
                )
            )
    form = CatalogIngredientForm()
    options = consumption_options(material)
    if line:
        options[line.unit_key] = (line.unit_label, line.factor, line.conversion_evidence)
    form.unit_key.choices = [(key, label) for key, (label, _, _) in options.items()]
    costs = {c.id: c for c in material.costs if c.currency == product.company.currency}
    form.cost_id.choices = [(0, "Ingresar un nuevo precio")] + [
        (
            c.id,
            f"{c.effective_on} · {c.currency} {decimal_text(version_result(c))} / {material.base_unit.symbol} · versión #{c.id}",
        )
        for c in costs.values()
    ]
    if request.method == "GET":
        form.revision.data = str(product.revision)
        current = effective_version(list(costs.values()), date.today())
        form.cost_id.data = line.cost_version_id if line else (current.id if current else 0)
        form.unit_key.data = line.unit_key if line else f"unit:{material.base_unit_code}"
        if line:
            form.quantity.data = decimal_text(line.quantity)
            form.mode.data = line.mode
            form.percent.data = decimal_text(line.rate * 100)
    if form.validate_on_submit():
        if not line and any(row.material_id == material.id for row in previous.lines):
            form.quantity.errors.append(
                "Este insumo ya está en la receta. Edita su fila para cambiar la cantidad o el precio."
            )
        if form.cost_id.data == 0 and form.new_price.value is None:
            form.new_price.errors.append("Ingresa el precio o selecciona una versión del catálogo.")
        if not form.errors:
            number = reserve_revision(product, form.revision.data)
            cost = costs.get(form.cost_id.data)
            if form.new_price.value is not None:
                cost = MaterialCostVersion(
                    material_id=material.id,
                    author_id=current_user.id,
                    mode="direct",
                    effective_on=form.effective_on.data,
                    currency=product.company.currency,
                    source=f"Precio ingresado en {product.name}",
                    unit_cost=form.new_price.value,
                )
                db.session.add(cost)
                db.session.flush()
            label, factor, evidence = options[form.unit_key.data]
            replacement = dict(
                material_id=material.id,
                cost_version_id=cost.id,
                material_name=material.display_name,
                quantity=form.quantity.value,
                unit_key=form.unit_key.data,
                unit_label=label,
                factor=factor,
                conversion_evidence=evidence,
                mode=form.mode.data,
                rate=form.rate,
            )
            rows = [
                replacement if line and row.id == line.id else line_data(row)
                for row in previous.lines
            ]
            if not line:
                rows.append(replacement)
            save_recipe(product, number, rows)
            flash(
                "Receta actualizada. La versión anterior conserva cantidades y precios.", "success"
            )
            return detail_redirect(product)
    return render_template(
        "products/ingredient.html",
        company=product.company,
        terms=sector_terms(product.company),
        product=product,
        form=form,
        quick=False,
        material=material,
        line=line,
    ), (422 if form.is_submitted() else 200)


@bp.post("/<int:product_id>/insumos/<int:line_id>/quitar")
@login_required
def remove_line(company_id, product_id, line_id):
    product = own_product(company_id, product_id, True)
    form = RecipeActionForm()
    if not form.validate_on_submit():
        abort(400)
    previous = product.recipes[-1]
    if not any(line.id == line_id for line in previous.lines):
        abort(404)
    number = reserve_revision(product, form.revision.data)
    save_recipe(product, number, [line_data(line) for line in previous.lines if line.id != line_id])
    flash("Insumo retirado de la receta actual. Se conserva en el historial.", "success")
    return detail_redirect(product)


@bp.post("/<int:product_id>/estado")
@login_required
def toggle(company_id, product_id):
    product = own_product(company_id, product_id)
    form = RecipeActionForm()
    if not form.validate_on_submit() or form.revision.data != str(product.revision):
        abort(409)
    state = request.form.get("state")
    if state not in ("active", "archived"):
        abort(400)
    product.active = state == "active"
    db.session.commit()
    return detail_redirect(product)


@bp.post("/<int:product_id>/eliminar")
@login_required
def delete(company_id, product_id):
    product = own_product(company_id, product_id)
    form = RecipeActionForm()
    if not form.validate_on_submit():
        abort(400)
    try:
        reserve_revision(product, form.revision.data)
        delete_product(product)
        db.session.commit()
    except ValueError as exc:
        db.session.rollback()
        flash(str(exc), "warning")
    except IntegrityError:
        db.session.rollback()
        flash("No se pudo eliminar: el plato tiene registros asociados. Recarga la página.", "warning")
    else:
        flash("Plato eliminado.", "success")
    return redirect(url_for("products.index", company_id=company_id, _anchor="mis-platos"))


@bp.post("/sincronizar")
@login_required
def synchronize(company_id):
    from app.routes.companies import require_action

    owned_company(company_id)
    require_action()
    # The common after_request hook retries this owner's pending dishes in this restaurant.
    return redirect(url_for("products.index", company_id=company_id))
