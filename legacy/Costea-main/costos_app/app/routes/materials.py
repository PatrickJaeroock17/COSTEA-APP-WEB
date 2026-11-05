"""Owned material catalogue; cost versions and conversions are append-only."""

import calendar
from datetime import date
from decimal import Decimal, localcontext

from flask import Blueprint, abort, flash, g, redirect, render_template, request, url_for
from flask_login import current_user, login_required
from sqlalchemy import false, true
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.forms.material import (
    ConversionForm,
    DirectCostForm,
    MaterialEntryForm,
    MaterialForm,
    PriceUpdateForm,
    PurchaseCostForm,
    QuickMaterialForm,
)
from app.models import CompanyUnit, Material, MaterialConversion, MaterialCostVersion, Unit
from app.models.inventory import InventoryMovement
from app.routes.companies import require_action
from app.services.catalog import catalog_commercial_code, get_catalog
from app.services.companies import owned_company
from app.services.inventory import ledger, lock_inventory
from app.services.material_identity import (
    duplicate_material,
    duplicate_message,
    next_material_code,
)
from app.services.materials import acquisition_cost, decimal_text, effective_version, version_result
from app.services.units import convert_quantity

bp = Blueprint("materials", __name__, url_prefix="/empresas/<int:company_id>/materiales")


def owned_material(company_id, material_id):
    company = owned_company(company_id)
    material = db.session.scalar(
        db.select(Material).where(Material.id == material_id, Material.company_id == company.id)
    )
    if material is None:
        abort(404)
    return material


def selected_date(company_id):
    raw = request.args.get("fecha")
    if raw is None:
        period = g.active_period
        if period and period.company_id == company_id:
            return date(
                period.year,
                period.month,
                calendar.monthrange(period.year, period.month)[1],
            )
        return date.today()
    try:
        value = date.fromisoformat(raw)
        if raw != value.isoformat():
            raise ValueError()
        return value
    except ValueError:
        abort(400)


def enabled_units(company_id):
    return list(
        db.session.scalars(
            db.select(Unit)
            .join(CompanyUnit)
            .where(CompanyUnit.company_id == company_id, CompanyUnit.enabled == true())
            .order_by(Unit.name)
        )
    )


def apply_material_form(record, form):
    for field in ("code", "name", "category", "supplier", "base_unit_code"):
        setattr(record, field, getattr(form, field).data or None)


def prepare_quick_form(form, company, units):
    form.base_unit_code.choices = [(unit.code, unit.name) for unit in units]
    try:
        categories = get_catalog().categories()
    except ValueError:
        categories = []
    form.category.choices = [
        (row["nombre"], row["nombre"])
        for row in categories
    ]
    if not form.is_submitted():
        form.effective_on.data = selected_date(company.id)
    return bool(categories)


def render_workspace(company, *, quick_form=None, open_quick_form=False, status_code=200):
    on_date = selected_date(company.id)
    query = request.args.get("q", "").strip()[:180]
    status = request.args.get("estado", "activos")
    active_tab = request.args.get("tab", "catalogo")
    if active_tab not in ("catalogo", "mios"):
        active_tab = "catalogo"
    product_id = request.args.get("plato", type=int)
    if product_id:
        from app.routes.products import own_product

        product = own_product(company.id, product_id, True)
    else:
        product = None

    stmt = db.select(Material).where(Material.company_id == company.id)
    if status != "todos":
        stmt = stmt.where(Material.active == (false() if status == "archivados" else true()))
    if query:
        stmt = stmt.where(
            db.or_(
                Material.name.icontains(query, autoescape=True),
                Material.variety.icontains(query, autoescape=True),
                Material.code.icontains(query, autoescape=True),
                Material.category.icontains(query, autoescape=True),
            )
        )
    materials = list(db.session.scalars(stmt.order_by(Material.name)))
    versions = {material.id: effective_version(material.costs, on_date) for material in materials}
    local_by_external = {
        material.external_insumo_id: material
        for material in db.session.scalars(
            db.select(Material).where(
                Material.company_id == company.id,
                Material.external_insumo_id.is_not(None),
            )
        )
    }

    catalog_rows, catalog_error = [], None
    try:
        catalog_rows = get_catalog().ingredients(
            category=request.args.get("categoria", type=int),
            unit=request.args.get("unidad", type=int),
        )
        for row in catalog_rows:
            row["codigo_comercial"] = catalog_commercial_code(row)
        if query:
            folded = query.casefold()
            catalog_rows = [
                row
                for row in catalog_rows
                if folded
                in " ".join(
                    str(value or "")
                    for value in (
                        row["codigo_comercial"],
                        row["nombre"],
                        row["variedad"],
                        row["categoria"],
                        row["unidad"],
                    )
                ).casefold()
            ]
    except ValueError as exc:
        catalog_error = str(exc)

    units = enabled_units(company.id)
    form = quick_form or QuickMaterialForm()
    has_categories = prepare_quick_form(form, company, units)
    return render_template(
        "materials/index.html",
        company=company,
        materials=materials,
        versions=versions,
        on_date=on_date,
        query=query,
        status=status,
        version_result=version_result,
        catalog_rows=catalog_rows,
        catalog_error=catalog_error,
        local_by_external=local_by_external,
        product=product,
        active_tab=active_tab,
        quick_form=form,
        has_units=bool(units),
        has_categories=has_categories,
        open_quick_form=open_quick_form,
    ), status_code


@bp.get("")
@login_required
def index(company_id):
    company = owned_company(company_id)
    return render_workspace(company)


@bp.post("/nuevo-rapido")
@login_required
def quick_create(company_id):
    company = owned_company(company_id)
    form = QuickMaterialForm()
    units = enabled_units(company.id)
    prepare_quick_form(form, company, units)
    if form.validate_on_submit():
        try:
            reserved_codes = {
                catalog_commercial_code(row) for row in get_catalog().ingredients()
            }
            code = next_material_code(
                company.id,
                form.category.data,
                reserved_codes=reserved_codes,
            )
        except ValueError as exc:
            message = str(exc)
            form.category.errors.append(message)
            flash(message, "warning")
            return render_workspace(
                company,
                quick_form=form,
                open_quick_form=True,
                status_code=422,
            )
        duplicate, reason = duplicate_material(
            company.id,
            code=code,
            name=form.name.data,
            variety=form.variety.data,
        )
        if duplicate:
            message = duplicate_message(duplicate, reason)
            form.name.errors.append(message)
            flash(message, "warning")
            return render_workspace(
                company,
                quick_form=form,
                open_quick_form=True,
                status_code=422,
            )
        material = Material(
            company_id=company.id,
            code=code,
            name=form.name.data,
            variety=form.variety.data or None,
            category=form.category.data,
            base_unit_code=form.base_unit_code.data,
        )
        db.session.add(material)
        try:
            db.session.flush()
            db.session.add(
                MaterialCostVersion(
                    material_id=material.id,
                    author_id=current_user.id,
                    effective_on=form.effective_on.data,
                    mode="direct",
                    source=f"Alta privada · {company.display_name}",
                    currency=company.currency,
                    unit_cost=form.unit_cost.value,
                )
            )
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            message = "No se pudo reservar el código correlativo. Vuelve a intentarlo."
            form.name.errors.append(message)
            flash(message, "warning")
        else:
            flash("Material y precio inicial guardados.", "success")
            return redirect(url_for("materials.index", company_id=company.id, tab="mios"))
    return render_workspace(
        company,
        quick_form=form,
        open_quick_form=True,
        status_code=422,
    )


@bp.route("/nuevo", methods=["GET", "POST"])
@bp.route("/<int:material_id>/editar", methods=["GET", "POST"])
@login_required
def edit(company_id, material_id=None):
    company = owned_company(company_id)
    material = owned_material(company_id, material_id) if material_id else None
    if material and not material.active:
        abort(409)
    form = MaterialForm(obj=material)
    if material and material.catalog_sourced:
        form.code.render_kw = {"readonly": True, "aria-readonly": "true"}
    # Base units never change: historical prices retain their original denominator.
    units = [material.base_unit] if material else enabled_units(company_id)
    form.base_unit_code.choices = [(u.code, f"{u.name} ({u.symbol})") for u in units]
    if form.validate_on_submit():
        if material and material.catalog_sourced and form.code.data != material.code:
            form.code.errors.append(
                "El ID de un insumo del Catálogo General solo puede cambiar en el catálogo maestro."
            )
            return render_template(
                "materials/form.html",
                company=company,
                material=material,
                form=form,
                has_units=bool(units),
            ), 422
        record = material or Material(company_id=company.id)
        apply_material_form(record, form)
        duplicate, reason = duplicate_material(
            company.id,
            code=record.code,
            name=record.name,
            variety=record.variety,
            exclude_id=record.id,
        )
        if duplicate:
            message = duplicate_message(duplicate, reason)
            form.name.errors.append(message)
            flash(message, "warning")
            return render_template(
                "materials/form.html",
                company=company,
                material=material,
                form=form,
                has_units=bool(units),
            ), 422
        db.session.add(record)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            form.code.errors.append(
                "Este código ya existe en la empresa, incluso entre archivados."
            )
        else:
            flash("Material guardado. Puedes registrar sus costos de referencia.", "success")
            return redirect(
                url_for("materials.detail", company_id=company_id, material_id=record.id)
            )
    return render_template(
        "materials/form.html", company=company, material=material, form=form, has_units=bool(units)
    ), (422 if form.is_submitted() else 200)


def price_chart(costs):
    """Build responsive SVG coordinates without converting stored amounts to float."""
    samples = sorted(
        (
            {
                "date": cost.effective_on,
                "value": version_result(cost),
                "cost": cost,
            }
            for cost in costs
        ),
        key=lambda item: (item["date"], item["cost"].id),
    )
    if not samples:
        return None
    width, height = Decimal("800"), Decimal("250")
    left, right, top, bottom = map(Decimal, ("58", "22", "24", "42"))
    low = min(item["value"] for item in samples)
    high = max(item["value"] for item in samples)
    if low == high:
        padding = max(abs(low) / Decimal("10"), Decimal("1"))
        low = max(Decimal("0"), low - padding)
        high += padding
    with localcontext() as context:
        context.prec = 28
        x_span = width - left - right
        y_span = height - top - bottom
        divisor = Decimal(len(samples) - 1) if len(samples) > 1 else Decimal("1")
        value_span = high - low
        points = []
        for index, item in enumerate(samples):
            x = left + (x_span / divisor * index if len(samples) > 1 else x_span / 2)
            y = top + (high - item["value"]) / value_span * y_span
            points.append(
                {
                    **item,
                    "x": decimal_text(x),
                    "y": decimal_text(y),
                    "value_text": decimal_text(item["value"]),
                }
            )
    return {
        "points": points,
        "polyline": " ".join(f'{point["x"]},{point["y"]}' for point in points),
        "low": decimal_text(low),
        "high": decimal_text(high),
        "first_date": samples[0]["date"],
        "last_date": samples[-1]["date"],
    }


def render_detail(
    material,
    *,
    price_form=None,
    entry_form=None,
    open_dialog=None,
    status_code=200,
):
    on_date = selected_date(material.company_id)
    price_form = price_form if price_form is not None else PriceUpdateForm(formdata=None)
    entry_form = entry_form if entry_form is not None else MaterialEntryForm(formdata=None)
    options = purchase_options(material)
    entry_form.purchase_unit.choices = [
        (key, f"{label} · {factor} {material.base_unit.symbol}")
        for key, (label, factor, _) in options.items()
    ]
    if not price_form.is_submitted():
        price_form.effective_on.data = on_date
    if not entry_form.is_submitted():
        entry_form.movement_on.data = on_date
    rows = ledger(material.company_id, material.id)
    balance = rows[-1] if rows else None
    return render_template(
        "materials/detail.html",
        company=material.company,
        material=material,
        version=effective_version(material.costs, on_date),
        on_date=on_date,
        version_result=version_result,
        acquisition_cost=acquisition_cost,
        price_form=price_form,
        entry_form=entry_form,
        inventory_rows=rows,
        inventory_balance=balance,
        price_chart=price_chart(material.costs),
        open_dialog=open_dialog,
    ), status_code


@bp.get("/<int:material_id>")
@login_required
def detail(company_id, material_id):
    return render_detail(owned_material(company_id, material_id))


@bp.post("/<int:material_id>/precios")
@login_required
def update_price(company_id, material_id):
    material = owned_material(company_id, material_id)
    if not material.active:
        abort(409)
    form = PriceUpdateForm()
    if form.validate_on_submit():
        source = form.source.data or f"Actualización manual · {material.company.display_name}"
        record = MaterialCostVersion(
            material_id=material.id,
            author_id=current_user.id,
            effective_on=form.effective_on.data,
            mode="direct",
            source=source,
            currency=material.company.currency,
            unit_cost=form.unit_cost.value,
        )
        version_result(record)
        db.session.add(record)
        db.session.commit()
        flash("Precio de compra actualizado; el historial anterior se conserva.", "success")
        return redirect(
            url_for(
                "materials.detail",
                company_id=company_id,
                material_id=material_id,
                fecha=record.effective_on.isoformat(),
            )
        )
    return render_detail(
        material,
        price_form=form,
        open_dialog="price-update-dialog",
        status_code=422,
    )


@bp.post("/<int:material_id>/kardex/entradas")
@login_required
def add_inventory_entry(company_id, material_id):
    material = owned_material(company_id, material_id)
    if not material.active:
        abort(409)
    form = MaterialEntryForm()
    options = purchase_options(material)
    form.purchase_unit.choices = [
        (key, f"{label} · {factor} {material.base_unit.symbol}")
        for key, (label, factor, _) in options.items()
    ]
    if form.validate_on_submit():
        label, factor, _ = options[form.purchase_unit.data]
        with localcontext() as context:
            context.prec = 28
            base_quantity = form.quantity.value * factor
            base_unit_cost = form.unit_price.value / factor
        has_movements = db.session.scalar(
            db.select(InventoryMovement.id).where(
                InventoryMovement.company_id == company_id,
                InventoryMovement.material_id == material.id,
                InventoryMovement.voided == false(),
            )
        )
        entry_label = "Compra" if has_movements else "Inventario inicial"
        # The client token, not the changing opening/receipt label, is the idempotency key.
        reference = f"Entrada {material.code} · {form.token.data}"
        try:
            lock_inventory(company_id)
            db.session.add(
                InventoryMovement(
                    company_id=company_id,
                    material_id=material.id,
                    movement_on=form.movement_on.data,
                    kind="in",
                    quantity=base_quantity,
                    unit_cost=base_unit_cost,
                    reference=reference,
                    voided=False,
                )
            )
            db.session.add(
                MaterialCostVersion(
                    material_id=material.id,
                    author_id=current_user.id,
                    effective_on=form.movement_on.data,
                    mode="direct",
                    source=f"{entry_label} / Kardex · {label}",
                    currency=material.company.currency,
                    unit_cost=base_unit_cost,
                )
            )
            db.session.flush()
            ledger(company_id, material.id)
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            form.quantity.errors.append(
                "Esta entrada ya fue registrada. Recarga la ficha antes de reintentar."
            )
        else:
            flash(
                f"{entry_label} registrado en el kardex y en el historial de precios.",
                "success",
            )
            return redirect(
                url_for(
                    "materials.detail",
                    company_id=company_id,
                    material_id=material.id,
                    fecha=form.movement_on.data.isoformat(),
                )
                + "#kardex"
            )
    return render_detail(
        material,
        entry_form=form,
        open_dialog="inventory-entry-dialog",
        status_code=422,
    )


@bp.post("/<int:material_id>/estado")
@login_required
def toggle(company_id, material_id):
    material = owned_material(company_id, material_id)
    require_action()
    state = request.form.get("state")
    if state not in ("active", "archived"):
        abort(400)
    material.active = state == "active"
    db.session.commit()
    flash("Estado actualizado. Se conserva todo el historial.", "success")
    return redirect(url_for("materials.detail", company_id=company_id, material_id=material_id))


def purchase_options(material):
    options = {}
    # Only dimensional, universal conversions are automatic. Existing base stays usable.
    for unit in [material.base_unit, *enabled_units(material.company_id)]:
        if unit.dimension == material.base_unit.dimension:
            factor = convert_quantity(Decimal("1"), unit, material.base_unit)
            options[f"unit:{unit.code}"] = (
                unit.name,
                factor,
                "Equivalencia universal entre unidades de la misma dimensión.",
            )
    for conversion in material.conversions:
        options[f"custom:{conversion.id}"] = (
            conversion.label,
            conversion.factor,
            conversion.evidence,
        )
    return options


@bp.route("/<int:material_id>/costos/<mode>", methods=["GET", "POST"])
@login_required
def add_cost(company_id, material_id, mode):
    material = owned_material(company_id, material_id)
    if not material.active:
        abort(409)
    if mode not in ("direct", "purchase"):
        abort(404)
    form = DirectCostForm() if mode == "direct" else PurchaseCostForm()
    options = purchase_options(material) if mode == "purchase" else {}
    if mode == "purchase":
        form.purchase_unit.choices = [
            (key, f"{label} · {factor} {material.base_unit.symbol}")
            for key, (label, factor, _) in options.items()
        ]
    if form.validate_on_submit():
        version = MaterialCostVersion(
            material_id=material.id,
            author_id=current_user.id,
            effective_on=form.effective_on.data,
            mode=mode,
            source=form.source.data,
            currency=material.company.currency,
        )
        if mode == "direct":
            version.unit_cost = form.unit_cost.value
        else:
            label, factor, evidence = options[form.purchase_unit.data]
            version.purchase_unit, version.factor, version.conversion_evidence = (
                label,
                factor,
                evidence,
            )
            for field in (
                "quantity",
                "net_amount",
                "nonrecoverable_tax",
                "recoverable_tax",
                "attributable_cost",
            ):
                setattr(version, field, getattr(form, field).value)
        version_result(version)  # Validate arithmetic before storing any reference input.
        db.session.add(version)
        db.session.commit()
        flash("Precio de compra guardado. Los registros anteriores se conservan.", "success")
        return redirect(
            url_for(
                "materials.detail",
                company_id=company_id,
                material_id=material_id,
                fecha=version.effective_on.isoformat(),
            )
        )
    return render_template(
        "materials/cost.html", company=material.company, material=material, form=form, mode=mode
    ), (422 if form.is_submitted() else 200)


@bp.route("/<int:material_id>/conversiones/nueva", methods=["GET", "POST"])
@login_required
def conversion(company_id, material_id):
    material = owned_material(company_id, material_id)
    if not material.active:
        abort(409)
    form = ConversionForm()
    if form.validate_on_submit():
        label = form.label.data.casefold()
        universal_labels = {
            str(value).casefold()
            for unit in db.session.scalars(db.select(Unit))
            for value in (unit.code, unit.name, unit.symbol)
        }
        if label in universal_labels:
            form.label.errors.append(
                "Usa un nombre específico, por ejemplo ‘Bolsa 5 kg’ o ‘Litro de aceite según ficha’. No redefinas unidades universales."
            )
        elif any(c.label.casefold() == label for c in material.conversions):
            form.label.errors.append(
                "Ya existe esa presentación. Usa un nombre distinto para una nueva equivalencia."
            )
        else:
            record = MaterialConversion(
                material_id=material.id,
                label=form.label.data,
                factor=form.factor.value,
                evidence=form.evidence.data,
            )
            db.session.add(record)
            try:
                db.session.commit()
            except IntegrityError:
                db.session.rollback()
                form.label.errors.append("Ya existe una presentación con ese nombre.")
            else:
                flash("Equivalencia registrada solo para este material.", "success")
                return redirect(
                    url_for("materials.detail", company_id=company_id, material_id=material_id)
                )
    return render_template(
        "materials/conversion.html", company=material.company, material=material, form=form
    ), (422 if form.is_submitted() else 200)
