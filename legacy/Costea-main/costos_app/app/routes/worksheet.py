"""Single-dish estimate before production planning, using the same cost engine."""

from datetime import date
from types import SimpleNamespace

from flask import Blueprint, abort, g, redirect, render_template, request, url_for
from flask_login import login_required
from sqlalchemy import true
from wtforms import BooleanField, DateField, SelectField
from wtforms.validators import DataRequired

from app.extensions import db
from app.forms.planning import PlanLineForm
from app.models import Period, PlanLine, Product, ProductionPlan, RecipeVersion
from app.services.companies import owned_company
from app.services.planning import evaluate
from app.services.portion_summary import portion_summary
from app.services.worker_minutes import worker_minute_rows

bp = Blueprint("worksheet", __name__, url_prefix="/empresas/<int:company_id>/costeo")


class WorksheetForm(PlanLineForm):
    period_id = SelectField("Mes de trabajo", coerce=int)
    price_date = DateField("Fecha de referencia", default=date.today, validators=[DataRequired()])
    no_cif = BooleanField("Confirmo que no hay costos indirectos de cocina")
    no_expenses = BooleanField("Confirmo que no hay gastos administrativos ni de venta")


@bp.route("", methods=["GET", "POST"])
@login_required
def index(company_id):
    company = owned_company(company_id)
    form = WorksheetForm()
    form.quantity.label.text = "Porciones previstas en el mes (para repartir CIF y gastos)"
    if company.industry.slug == "restaurantes":
        form.tax_percent.data = "18"
        form.tax_percent.render_kw = {"readonly": True}
    periods = list(
        db.session.scalars(
            db.select(Period)
            .where(Period.company_id == company_id)
            .order_by(Period.year.desc(), Period.month.desc())
        )
    )
    products = list(
        db.session.scalars(
            db.select(Product)
            .where(Product.company_id == company_id, Product.active == true())
            .order_by(Product.name)
        )
    )
    recipes = [p.recipes[-1] for p in products]
    form.period_id.choices = [(p.id, p.label) for p in periods]
    form.recipe_id.choices = [(r.id, f"{r.product_name} · versión {r.number}") for r in recipes]
    form.tax_percent.label.text = "IGV (%) · restaurantes: 18"
    if request.method == "GET":
        form.tax_percent.data = "18"
        if request.args.get("receta", type=int) in dict(form.recipe_id.choices):
            form.recipe_id.data = request.args.get("receta", type=int)
    result, data, summary = None, None, None
    saved_plans = list(
        db.session.scalars(
            db.select(ProductionPlan)
            .where(ProductionPlan.company_id == company_id)
            .order_by(ProductionPlan.active.desc(), ProductionPlan.id.desc())
        )
    )
    selected_plan_id = request.args.get("plan", type=int)
    if selected_plan_id is not None and selected_plan_id not in {p.id for p in saved_plans}:
        abort(404)
    saved_plan = next((p for p in saved_plans if p.id == selected_plan_id), None) or (
        saved_plans[0] if saved_plans else None
    )
    selected_line_id = request.args.get("plato", type=int)
    saved_lines = saved_plan.lines if saved_plan else []
    if selected_line_id is not None and selected_line_id not in {line.id for line in saved_lines}:
        abort(404)
    saved_line = next((line for line in saved_lines if line.id == selected_line_id), None)
    if saved_line is None and request.args.get("receta", type=int):
        saved_line = next(
            (
                line
                for line in saved_lines
                if line.recipe_id == request.args.get("receta", type=int)
            ),
            None,
        )
    elif saved_line is None:
        saved_line = saved_lines[0] if saved_lines else None
    if request.method == "GET" and saved_line:
        saved_data, saved_result, _ = evaluate(saved_plan)
        saved_input = next(line for line in saved_data["lines"] if line["id"] == saved_line.id)
        summary = portion_summary(saved_result, saved_line.id, saved_input["tax"])
    if form.validate_on_submit():
        recipe = db.session.get(RecipeVersion, form.recipe_id.data)
        product = next(p for p in products if p.id == recipe.product_id)
        period = next(p for p in periods if p.id == form.period_id.data)
        from decimal import Decimal

        values = dict(
            product_id=product.id,
            recipe_id=recipe.id,
            quantity=form.quantity.value,
            reference_price=form.reference_price.value,
            equivalent_factor=form.equivalent_factor.value,
            pricing_mode=form.pricing_mode.data,
            pricing_value=form.pricing_value.value
            / (1 if form.pricing_mode.data == "manual" else 100),
            adopted_price=form.adopted_price.value,
            tax_rate=Decimal(".18")
            if company.industry.slug == "restaurantes"
            else (form.tax_percent.value / 100 if form.tax_percent.value is not None else None),
        )
        line = SimpleNamespace(id=0, product=product, recipe=recipe, **values)
        plan_values = dict(
            company_id=company_id,
            period_id=period.id,
            name=f"Costeo · {product.name}"[:180],
            price_date=form.price_date.data,
            no_cif=form.no_cif.data,
            no_expenses=form.no_expenses.data,
        )
        draft = SimpleNamespace(id=0, company=company, period=period, lines=[line], **plan_values)
        data, result, _ = evaluate(draft)
        summary = portion_summary(result, 0, data["lines"][0]["tax"])
        if request.form.get("action") == "plan":
            if result["issues"]:
                form.quantity.errors.append("Completa los datos indicados antes de crear el plan.")
            else:
                plan = ProductionPlan(**plan_values)
                db.session.add(plan)
                db.session.flush()
                db.session.add(PlanLine(plan_id=plan.id, **values))
                db.session.commit()
                return redirect(
                    url_for("planning.plan_detail", company_id=company_id, plan_id=plan.id)
                )
        elif request.form.get("action", "calculate") != "calculate":
            abort(400)
    if request.method == "POST":
        worker_period = next((p for p in periods if p.id == form.period_id.data), None)
    elif saved_plan:
        worker_period = saved_plan.period
    else:
        worker_period = next(
            (p for p in periods if g.active_period and p.id == g.active_period.id), None
        ) or (periods[0] if periods else None)
    minute_rows = worker_minute_rows(company_id, worker_period.id) if worker_period else []
    return render_template(
        "planning/worksheet.html",
        company=company,
        form=form,
        data=data,
        result=result,
        summary=summary,
        saved_plans=saved_plans,
        saved_plan=saved_plan,
        saved_line=saved_line,
        worker_period=worker_period,
        minute_rows=minute_rows,
    ), (422 if form.errors else 200)
