from datetime import date
from decimal import Decimal
from uuid import uuid4

from flask import Blueprint, abort, flash, redirect, render_template, request, url_for
from flask_login import login_required
from flask_wtf import FlaskForm
from sqlalchemy.exc import IntegrityError
from wtforms import DateField, HiddenField, SelectField, StringField
from wtforms.validators import DataRequired, Length

from app.extensions import db
from app.forms.company import ActionForm
from app.forms.material import ExactNumberField
from app.models import Material, Product
from app.models.inventory import InventoryMovement
from app.services.catalog_sync import sync_restaurant_catalog
from app.services.companies import owned_company
from app.services.inventory import ledger, lock_inventory
from app.services.inventory_sources import (
    import_entry,
    recipe_requirements,
    saved_entries,
    simulated_recipe_outputs,
    sync_saved_sales,
)
from app.services.opening_stock import opening_receipts, opening_stock_rows

bp = Blueprint("inventory", __name__, url_prefix="/empresas/<int:company_id>/inventarios")


class ReceiptForm(FlaskForm):
    material_id = SelectField("Insumo", coerce=int)
    movement_on = DateField(
        "Fecha de ingreso o saldo inicial", default=date.today, validators=[DataRequired()]
    )
    quantity = ExactNumberField("Cantidad recibida en la unidad base indicada", positive=True)
    unit_cost = ExactNumberField("Costo unitario real en la unidad base (sin IGV recuperable)")
    reference = StringField(
        "Comprobante o referencia única de la entrada", validators=[DataRequired(), Length(max=140)]
    )
    token = HiddenField(default=lambda: str(uuid4()), validators=[DataRequired(), Length(max=36)])


class SavedEntryForm(FlaskForm):
    source = SelectField("Materia prima guardada", validators=[DataRequired()])


@bp.post("/apertura")
@login_required
def opening_stock(company_id):
    company = owned_company(company_id)
    if not ActionForm().validate_on_submit():
        abort(400)
    try:
        result = sync_restaurant_catalog(company)
        db.session.commit()
    except (ValueError, IntegrityError) as exc:
        db.session.rollback()
        flash(str(exc) if isinstance(exc, ValueError) else "No se pudo registrar el stock de apertura.", "warning")
    else:
        flash(
            f"Catálogo actualizado: {result['opening_receipts']} entradas iniciales nuevas "
            f"y {result['recipes']} recetas con precios actualizados.", "success",
        )
    return redirect(url_for("inventory.index", company_id=company_id))


@bp.route("", methods=["GET", "POST"])
@login_required
def index(company_id):
    company = owned_company(company_id)
    materials = list(
        db.session.scalars(
            db.select(Material).where(Material.company_id == company_id).order_by(Material.name)
        )
    )
    all_materials = {material.id: material for material in materials}
    product_id = request.args.get("plato", type=int)
    product = (
        db.first_or_404(
            db.select(Product).where(Product.id == product_id, Product.company_id == company_id)
        )
        if product_id
        else None
    )
    if product and product.recipes:
        recipe_ids = {line.material_id for line in product.recipes[-1].lines}
        materials = [m for m in materials if m.id in recipe_ids]
    entries = saved_entries(company_id, product_id)
    saved_form = SavedEntryForm()
    saved_form.source.choices = [
        (
            e["key"],
            f"{e['material'].inventory_label} · {e['quantity']} {e['material'].base_unit.symbol} · {company.currency} {e['unit_cost']:.2f} / {e['material'].base_unit.symbol} · {e['origin']}",
        )
        for e in entries
        if not e["imported"]
    ]
    if request.method == "POST" and "source" in request.form:
        if saved_form.validate_on_submit():
            try:
                import_entry(company_id, saved_form.source.data, product_id)
                sync_saved_sales(company_id)
                db.session.commit()
            except (ValueError, IntegrityError):
                db.session.rollback()
                saved_form.source.errors.append(
                    "No se pudo agregar la entrada o ya fue registrada. Recarga el kardex."
                )
            else:
                flash("Entrada conectada con los datos guardados. Ventas sincronizadas.", "success")
                selected_entry = next(e for e in entries if e["key"] == saved_form.source.data)
                return redirect(
                    url_for(
                        "inventory.index",
                        company_id=company_id,
                        plato=product_id,
                        insumo=selected_entry["material"].id,
                    )
                )
    form = ReceiptForm()
    form.material_id.choices = [
        (m.id, f"{m.inventory_label} · {m.base_unit.symbol}") for m in materials
    ]
    if request.method == "POST" and "source" not in request.form and form.validate_on_submit():
        try:
            lock_inventory(company_id)
            reference = " ".join(form.reference.data.strip().casefold().split())
            if db.session.scalar(
                db.select(InventoryMovement.id).where(
                    InventoryMovement.company_id == company_id,
                    InventoryMovement.material_id == form.material_id.data,
                    InventoryMovement.reference == reference,
                )
            ):
                raise ValueError("Esta entrada ya está registrada para el insumo; no se duplicó.")
            db.session.add(
                InventoryMovement(
                    company_id=company_id,
                    material_id=form.material_id.data,
                    movement_on=form.movement_on.data,
                    kind="in",
                    quantity=form.quantity.value,
                    unit_cost=form.unit_cost.value,
                    reference=reference,
                    voided=False,
                )
            )
            db.session.flush()
            ledger(company_id, form.material_id.data)
            db.session.commit()
        except (ValueError, IntegrityError) as exc:
            db.session.rollback()
            form.reference.errors.append(
                str(exc)
                if isinstance(exc, ValueError)
                else "La entrada ya fue registrada; recarga el kardex."
            )
        else:
            flash("Entrada de inventario registrada.", "success")
            return redirect(
                url_for(
                    "inventory.index",
                    company_id=company_id,
                    insumo=form.material_id.data,
                    plato=product_id,
                )
            )
    material_id = request.args.get("insumo", type=int)
    selected = next((m for m in materials if m.id == material_id), None)
    if material_id and selected is None:
        from flask import abort

        abort(404)
    selected = selected or (materials[0] if materials else None)
    if request.method == "GET" and selected:
        form.material_id.data = selected.id
    rows = ledger(company_id, selected.id) if selected else []
    visible_ids = {material.id for material in materials}
    requirements = [
        row for row in recipe_requirements(company_id) if row["material"].id in visible_ids
    ]
    simulated_outputs = simulated_recipe_outputs(company_id, requirements)
    selected_output = next(
        (row for row in simulated_outputs if selected and row["material"].id == selected.id),
        None,
    )
    actual_quantity = rows[-1]["quantity"] if rows else 0
    stock_alert = (
        {
            "actual": actual_quantity,
            "required": selected_output["quantity"],
            "missing": max(selected_output["quantity"] - actual_quantity, 0),
        }
        if selected_output and actual_quantity <= selected_output["quantity"]
        else None
    )
    receipts = [entry for entry in opening_receipts(company_id) if not entry.voided]
    opening_count = len(receipts)
    opening_value = sum((entry.quantity * entry.unit_cost for entry in receipts), Decimal("0"))
    opening_pending, opening_error = 0, None
    if company.industry.slug == "restaurantes" and company.currency == "PEN":
        try:
            opening_rows = opening_stock_rows()
            recorded_ids = {all_materials[entry.material_id].external_insumo_id
                            for entry in opening_receipts(company_id)}
            opening_pending = sum(row["id_insumo"] not in recorded_ids for row, _ in opening_rows)
        except ValueError as exc:
            opening_error = str(exc)
    return render_template(
        "inventory/index.html",
        company=company,
        form=saved_form,
        entries=entries,
        requirements=simulated_outputs,
        selected_output=selected_output,
        stock_alert=stock_alert,
        materials=materials,
        selected=selected,
        rows=rows,
        product=product,
        opening_count=opening_count,
        opening_value=opening_value,
        opening_error=opening_error,
        opening_pending=opening_pending,
        opening_receipts=receipts,
        opening_materials=all_materials,
    ), (422 if form.errors or saved_form.errors else 200)
