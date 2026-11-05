"""Complete local workflow: monthly labor, overhead, plans and published budgets."""

import calendar
import json
from datetime import date
from decimal import Decimal

from flask import Blueprint, Response, abort, flash, g, redirect, render_template, request, url_for
from flask_login import current_user, login_required
from sqlalchemy import true
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.extensions import db
from app.forms.company import ActionForm
from app.forms.labor_profile import (
    ChildForm,
    DeleteLaborProfileForm,
    LaborProfileForm,
    VacationForm,
)
from app.forms.planning import (
    ConceptForm,
    EmployeeForm,
    NewEmployeeForm,
    OperationForm,
    PayrollForm,
    PlanForm,
    PlanLineForm,
    PublishForm,
    WorkForm,
)
from app.models import Period, Product, RecipeVersion
from app.models.planning import (
    Budget,
    BudgetArchive,
    CostConcept,
    Employee,
    EmployeePeriodCost,
    PlanLine,
    ProductionPlan,
    RecipeWork,
)
from app.services.companies import owned_company
from app.services.costing import labor_cost
from app.services.employee_profiles import delete_employee, employee_dependencies
from app.services.inventory import plan_outputs
from app.services.labor_scenario import labor_scenario, labor_worker_details
from app.services.labor_table import recipe_labor_table
from app.services.materials import decimal_text
from app.services.overhead_tables import overhead_tables
from app.services.payroll import PAYROLL_FIELDS
from app.services.plan_creation import plan_dish_options, selected_plan_lines
from app.services.planning import evaluate, payroll_input, plain
from app.services.production_table import production_table
from app.services.restaurant_labor import (
    BENEFIT_FIELDS,
    delete_profile,
    labor_areas,
    profile_revision,
    restaurant_details,
    restaurant_workers,
    save_profile,
)

bp = Blueprint("planning", __name__, url_prefix="/empresas/<int:company_id>/gestion")
D = Decimal


def owned(model, company_id, record_id):
    owned_company(company_id)
    return db.first_or_404(
        db.select(model).where(model.id == record_id, model.company_id == company_id)
    )


def action():
    if not ActionForm().validate_on_submit():
        abort(400)


def periods(form, company_id):
    records = list(
        db.session.scalars(
            db.select(Period)
            .where(Period.company_id == company_id)
            .order_by(Period.year.desc(), Period.month.desc())
        )
    )
    form.period_id.choices = [(p.id, p.label) for p in records]
    if request.method == "GET" and g.active_period and g.active_period.company_id == company_id:
        form.period_id.data = g.active_period.id
    return records


def form_page(company, form, title, back, help_text):
    return render_template(
        "planning/form.html",
        company=company,
        form=form,
        title=title,
        back=back,
        help_text=help_text,
    ), (422 if form.is_submitted() else 200)


@bp.get("/personal")
@login_required
def employees(company_id):
    company = owned_company(company_id)
    employees = list(
        db.session.scalars(
            db.select(Employee).where(Employee.company_id == company_id).order_by(Employee.name)
        )
    )
    payroll = list(
        db.session.scalars(
            db.select(EmployeePeriodCost)
            .join(Employee)
            .where(Employee.company_id == company_id)
            .order_by(EmployeePeriodCost.period_id.desc())
        )
    )
    available_periods = list(
        db.session.scalars(
            db.select(Period)
            .where(Period.company_id == company_id)
            .order_by(Period.year.desc(), Period.month.desc())
        )
    )
    recipes = list(
        db.session.scalars(
            db.select(RecipeVersion)
            .join(Product)
            .where(Product.company_id == company_id)
            .order_by(Product.name, RecipeVersion.number.desc())
        )
    )
    period_id = request.args.get("periodo", type=int)
    recipe_id = request.args.get("receta", type=int)
    if period_id is not None and period_id not in {p.id for p in available_periods}:
        abort(404)
    if recipe_id is not None and recipe_id not in {r.id for r in recipes}:
        abort(404)
    period_id = period_id or (
        g.active_period.id if g.active_period and g.active_period.company_id == company_id else None
    )
    selected_period = next((p for p in available_periods if p.id == period_id), None)
    selected_period = selected_period or (available_periods[0] if available_periods else None)
    selected_recipe = next((r for r in recipes if r.id == recipe_id), None)
    selected_recipe = selected_recipe or (recipes[0] if recipes else None)
    work = (
        db.session.scalar(db.select(RecipeWork).where(RecipeWork.recipe_id == selected_recipe.id))
        if selected_recipe
        else None
    )
    labor_table = (
        recipe_labor_table(
            employees,
            [r for r in payroll if r.period_id == selected_period.id],
            selected_recipe,
            work,
        )
        if selected_period and selected_recipe
        else None
    )
    reference_workers, reference_total, reference_error = [], D("0"), None
    if company.industry.slug == "restaurantes":
        try:
            reference_workers, reference_total = labor_scenario()
            reference_workers, reference_total = restaurant_workers(company_id, reference_workers)
        except ValueError as exc:
            reference_error = str(exc)
        except SQLAlchemyError:
            db.session.rollback()
            reference_error = "No se pudo consultar el personal de este restaurante. Revisa la conexión con Azure SQL."
    return render_template(
        "planning/employees.html",
        company=company,
        employees=employees,
        payroll=payroll,
        labor_cost=labor_cost,
        payroll_input=payroll_input,
        labor_table=labor_table,
        labor_periods=available_periods,
        labor_recipes=recipes,
        selected_labor_period=selected_period,
        selected_labor_recipe=selected_recipe,
        reference_workers=reference_workers,
        reference_total=reference_total,
        reference_error=reference_error,
        period_names={
            p.id: p.label
            for p in db.session.scalars(db.select(Period).where(Period.company_id == company_id))
        },
    )


@bp.get("/personal/escenario/<int:scenario_id>/<worker_code>")
@login_required
def labor_reference(company_id, scenario_id, worker_code):
    company = owned_company(company_id)
    if company.industry.slug != "restaurantes":
        abort(404)
    try:
        details = restaurant_details(company_id, scenario_id, worker_code, request.args.get("contrato"), base_loader=labor_worker_details)
    except (ValueError, SQLAlchemyError) as exc:
        db.session.rollback()
        flash(str(exc) if isinstance(exc, ValueError) else "No se pudo consultar el perfil. Revisa la conexión con Azure SQL.", "warning")
        return redirect(url_for("planning.employees", company_id=company_id))
    if details is None:
        abort(404)
    return render_template("planning/labor_reference.html", company=company, **details)


def restaurant_profile(company_id, scenario_id, worker_code):
    company = owned_company(company_id)
    if company.industry.slug != "restaurantes":
        abort(404)
    details = restaurant_details(company_id, scenario_id, worker_code, request.args.get("contrato"), base_loader=labor_worker_details)
    if details is None:
        abort(404)
    return company, details


@bp.route("/personal/escenario/<int:scenario_id>/<worker_code>/editar", methods=["GET", "POST"])
@login_required
def labor_profile_edit(company_id, scenario_id, worker_code):
    try:
        company, details = restaurant_profile(company_id, scenario_id, worker_code)
        form = LaborProfileForm()
        form.codigo_area.choices = labor_areas()
        if request.method == "GET":
            data = dict(details["worker"]) | {
                "revision": profile_revision(details), "schedule": details["schedule"],
                "children": [dict(row) for row in details["children"]],
                "vacations": [dict(row) for row in details["vacations"]],
            }
            for key, value in data.items():
                if isinstance(value, Decimal):
                    data[key] = decimal_text(value)
            if isinstance(data.get("fecha_inicio"), str):
                data["fecha_inicio"] = date.fromisoformat(data["fecha_inicio"])
            for vacation in data["vacations"]:
                for key in ("fecha_inicio", "fecha_fin"):
                    if isinstance(vacation[key], str):
                        vacation[key] = date.fromisoformat(vacation[key])
            form.process(data=data)
        if form.validate_on_submit():
            save_profile(company_id, scenario_id, worker_code, details["worker"]["codigo_contrato"],
                         form.revision.data, form.profile_data())
            db.session.commit()
            flash("Perfil actualizado en este restaurante. Sus costos se han recalculado.", "success")
            return redirect(url_for("planning.labor_reference", company_id=company_id,
                                    scenario_id=scenario_id, worker_code=worker_code,
                                    contrato=details["worker"]["codigo_contrato"]))
    except (ValueError, SQLAlchemyError) as exc:
        db.session.rollback()
        flash(str(exc) if isinstance(exc, ValueError) else "No se pudo guardar el perfil. Revisa la conexión con Azure SQL e inténtalo de nuevo.", "warning")
        return redirect(url_for("planning.employees", company_id=company_id))
    return render_template("planning/labor_profile_edit.html", company=company, form=form,
                           worker=details["worker"], benefit_fields=BENEFIT_FIELDS,
                           child_template=ChildForm(prefix="children-__index__-"),
                           vacation_template=VacationForm(prefix="vacations-__index__-")), (422 if form.is_submitted() else 200)


@bp.route("/personal/escenario/<int:scenario_id>/<worker_code>/eliminar", methods=["GET", "POST"])
@login_required
def labor_profile_delete(company_id, scenario_id, worker_code):
    try:
        company, details = restaurant_profile(company_id, scenario_id, worker_code)
        form = DeleteLaborProfileForm()
        if request.method == "GET":
            form.revision.data = profile_revision(details)
        if form.validate_on_submit():
            delete_profile(company_id, scenario_id, worker_code, details["worker"]["codigo_contrato"], form.revision.data)
            db.session.commit()
            flash("Trabajador eliminado de este restaurante.", "success")
            return redirect(url_for("planning.employees", company_id=company_id))
    except (ValueError, SQLAlchemyError) as exc:
        db.session.rollback()
        flash(str(exc) if isinstance(exc, ValueError) else "No se pudo eliminar el perfil. Revisa la conexión con Azure SQL e inténtalo de nuevo.", "warning")
        return redirect(url_for("planning.employees", company_id=company_id))
    return render_template("planning/labor_profile_delete.html", company=company,
                           worker=details["worker"], form=form), (422 if form.is_submitted() else 200)


@bp.route("/personal/nuevo", methods=["GET", "POST"])
@bp.route("/personal/<int:employee_id>/editar", methods=["GET", "POST"])
@login_required
def employee_edit(company_id, employee_id=None):
    company = owned_company(company_id)
    employee = owned(Employee, company_id, employee_id) if employee_id else None
    form = EmployeeForm(obj=employee) if employee else NewEmployeeForm()
    initial_payroll = None
    if not employee:
        initial_payroll = PayrollForm(prefix="payroll")
        available_periods = periods(initial_payroll, company_id)
        products = list(
            db.session.scalars(
                db.select(Product)
                .where(Product.company_id == company_id, Product.active == true())
                .order_by(Product.name)
            )
        )
        recipes = [p.recipes[-1] for p in products if p.recipes]
        form.recipe_id.choices = [(0, "Asignar plato después")] + [
            (
                r.id,
                f"{r.product_name} · lote {decimal_text(r.output_quantity)} · versión {r.number}",
            )
            for r in recipes
        ]
        if request.method == "GET":
            form.configure_payroll.data = bool(available_periods)
            initial_payroll.calculation_mode.data = "detailed"
            initial_payroll.days.data = "26"
            initial_payroll.hours.data = "8"
            initial_payroll.direct_basis.data = "time"
        initial_payroll.direct_basis.choices = [("time", "Por minutos dedicados a cada receta")]

    def employee_page():
        if employee_id:
            return form_page(
                company,
                form,
                "Datos del trabajador",
                url_for("planning.employees", company_id=company_id),
                "Desactivar un trabajador conserva sus costos mensuales y operaciones históricas. Revisa su configuración mensual para los planes futuros.",
            )
        return render_template(
            "planning/new_employee.html",
            company=company,
            form=form,
            payroll_form=initial_payroll,
            detail_fields=[k for k in PAYROLL_FIELDS if k not in ("salary", "other")],
        ), (422 if form.is_submitted() else 200)

    valid = form.validate_on_submit()
    if not employee_id and form.configure_payroll.data and form.is_submitted():
        valid = initial_payroll.validate_on_submit() and valid
    if valid:
        other_workers = db.session.scalars(
            db.select(Employee).where(Employee.company_id == company_id)
        )
        if any(
            e.id != employee_id
            and (
                (
                    form.document.data
                    and e.document
                    and e.document.casefold() == form.document.data.casefold()
                )
                or (
                    not form.document.data
                    and " ".join(e.name.casefold().split())
                    == " ".join(form.name.data.casefold().split())
                )
            )
            for e in other_workers
        ):
            form.name.errors.append(
                "Este trabajador ya está registrado. Edita el registro existente; si son personas distintas con el mismo nombre, indica su documento."
            )
            return employee_page()
        employee = employee or Employee(company_id=company_id)
        for k in ("name", "role", "document", "active"):
            setattr(employee, k, getattr(form, k).data)
        db.session.add(employee)
        if not employee_id and form.configure_payroll.data:
            db.session.flush()
            data = monthly_form_data(initial_payroll)
            db.session.add(
                EmployeePeriodCost(
                    employee_id=employee.id,
                    period_id=initial_payroll.period_id.data,
                    data=plain(data),
                    breakdown=plain(initial_payroll.breakdown)
                    if initial_payroll.calculation_mode.data == "detailed"
                    else None,
                )
            )
            if form.recipe_id.data and form.recipe_minutes.value > 0:
                work = db.session.scalar(
                    db.select(RecipeWork).where(RecipeWork.recipe_id == form.recipe_id.data)
                )
                work = work or RecipeWork(recipe_id=form.recipe_id.data, operations=[])
                work.operations = [
                    *work.operations,
                    dict(
                        employee_id=employee.id,
                        activity="Preparación del plato",
                        minutes=str(form.recipe_minutes.value),
                    ),
                ]
                work.no_labor = False
                db.session.add(work)
        db.session.commit()
        return redirect(
            url_for(
                "planning.employees",
                company_id=company_id,
                **(
                    dict(periodo=initial_payroll.period_id.data, receta=form.recipe_id.data or None)
                    if initial_payroll and form.configure_payroll.data
                    else {}
                ),
            )
        )
    return employee_page()


@bp.route("/personal/<int:employee_id>/eliminar", methods=["GET", "POST"])
@login_required
def employee_delete(company_id, employee_id):
    company = owned_company(company_id)
    employee = owned(Employee, company_id, employee_id)
    if request.method == "POST":
        action()
        try:
            delete_employee(company_id, employee_id)
            db.session.commit()
        except (ValueError, IntegrityError):
            db.session.rollback()
            flash("No se pudo eliminar el trabajador. Recarga la lista e inténtalo de nuevo.", "warning")
        else:
            flash("Perfil del trabajador eliminado.", "success")
        return redirect(url_for("planning.employees", company_id=company_id))
    payroll_count, assignment_count, _ = employee_dependencies(company_id, employee_id)
    return render_template(
        "planning/employee_delete.html", company=company, employee=employee,
        payroll_count=payroll_count, assignment_count=assignment_count,
    )


def monthly_form_data(form):
    names = {
        "salary": "Remuneración",
        "allowances": "Asignaciones",
        "provisions": "Provisiones de beneficios",
        "charges": "Cargas patronales",
        "other": "Otros componentes",
    }
    data = dict(
        components=[
            dict(name=label, amount=getattr(form, key).value, source=form.source.data)
            for key, label in names.items()
        ],
        fractions={k: getattr(form, k).value / 100 for k in ("mod", "cif", "admin", "sales")},
        days=form.days.value,
        hours=form.hours.value,
        excluded=form.excluded.value,
        productive=form.productive.value / 100,
        direct_basis=form.direct_basis.data,
        planned_units=form.planned_units.value,
        basis=form.basis.data,
        justification=form.justification.data,
    )
    if form.calculation_mode.data == "detailed":
        data["components"] = [
            dict(c, source=form.source.data) for c in form.breakdown["components"]
        ]
    labor_cost(data)
    return data


@bp.route("/personal/<int:employee_id>/mes", methods=["GET", "POST"])
@login_required
def payroll(company_id, employee_id):
    employee = owned(Employee, company_id, employee_id)
    company = owned_company(company_id)
    form = PayrollForm()
    periods(form, company_id)
    selected = (
        request.args.get("periodo", type=int) if request.method == "GET" else form.period_id.data
    )
    if selected and selected not in dict(form.period_id.choices):
        abort(404)
    selected = selected or form.period_id.data
    record = (
        db.session.scalar(
            db.select(EmployeePeriodCost).where(
                EmployeePeriodCost.employee_id == employee_id,
                EmployeePeriodCost.period_id == selected,
            )
        )
        if selected
        else None
    )
    names = {
        "salary": "Remuneración",
        "allowances": "Asignaciones",
        "provisions": "Provisiones de beneficios",
        "charges": "Cargas patronales",
        "other": "Otros componentes",
    }
    if request.method == "GET" and record:
        form.period_id.data = record.period_id
        form.direct_basis.data = record.data.get("direct_basis", "time")
        form.planned_units.data = record.data.get("planned_units", "0")
        if record.breakdown:
            form.calculation_mode.data = "detailed"
            for key, value in record.breakdown["inputs"].items():
                getattr(form, key).data = value if value is not None else ""
        else:
            for key, component in zip(names, record.data["components"], strict=True):
                getattr(form, key).data = component["amount"]
        form.source.data = record.data["components"][0]["source"]
        for key in ("days", "hours", "excluded", "basis", "justification"):
            getattr(form, key).data = record.data[key]
        form.productive.data = decimal_text(D(record.data["productive"]) * 100)
        for key, value in record.data["fractions"].items():
            getattr(form, key).data = decimal_text(D(value) * 100)
    elif request.method == "GET":
        form.calculation_mode.data = "detailed"
        form.days.data = "26"
        form.hours.data = "8"
    if form.validate_on_submit():
        data = dict(
            components=[
                dict(name=label, amount=getattr(form, k).value, source=form.source.data)
                for k, label in names.items()
            ],
            fractions={k: getattr(form, k).value / 100 for k in ("mod", "cif", "admin", "sales")},
            days=form.days.value,
            hours=form.hours.value,
            excluded=form.excluded.value,
            productive=form.productive.value / 100,
            direct_basis=form.direct_basis.data,
            planned_units=form.planned_units.value,
            basis=form.basis.data,
            justification=form.justification.data,
        )
        if form.calculation_mode.data == "detailed":
            data["components"] = [
                dict(c, source=form.source.data) for c in form.breakdown["components"]
            ]
        labor_cost(data)
        record = db.session.scalar(
            db.select(EmployeePeriodCost).where(
                EmployeePeriodCost.employee_id == employee_id,
                EmployeePeriodCost.period_id == form.period_id.data,
            )
        )
        record = record or EmployeePeriodCost(
            employee_id=employee_id, period_id=form.period_id.data
        )
        record.data = plain(data)
        record.breakdown = (
            plain(form.breakdown) if form.calculation_mode.data == "detailed" else None
        )
        db.session.add(record)
        db.session.commit()
        flash(
            "Costo mensual guardado. La parte indirecta se incorporará automáticamente, sin duplicar la nómina.",
            "success",
        )
        return redirect(url_for("planning.employees", company_id=company_id))
    return render_template(
        "planning/payroll.html",
        company=company,
        form=form,
        employee=employee,
        record=record,
        detail_fields=[k for k in PAYROLL_FIELDS if k not in ("salary", "other")],
        result=labor_cost(payroll_input(record)) if record else None,
    ), (422 if form.is_submitted() else 200)


def own_recipe(company_id, recipe_id):
    company = owned_company(company_id)
    recipe = db.first_or_404(
        db.select(RecipeVersion)
        .join(Product)
        .where(RecipeVersion.id == recipe_id, Product.company_id == company_id)
    )
    work = db.session.scalar(db.select(RecipeWork).where(RecipeWork.recipe_id == recipe_id))
    return company, recipe, work


@bp.route("/recetas/<int:recipe_id>/operaciones", methods=["GET", "POST"])
@login_required
def work(company_id, recipe_id):
    company, recipe, record = own_recipe(company_id, recipe_id)
    form = WorkForm(obj=record)
    operation_form = OperationForm()
    employees = list(
        db.session.scalars(
            db.select(Employee)
            .where(Employee.company_id == company_id, Employee.active == true())
            .order_by(Employee.name)
        )
    )
    operation_form.employee_id.choices = [(e.id, e.name) for e in employees]
    if form.validate_on_submit():
        if form.no_materials.data and recipe.lines:
            form.no_materials.errors.append(
                "La receta tiene insumos. No puede declarar que no requiere materiales."
            )
        elif form.no_labor.data and record and record.operations:
            form.no_labor.errors.append(
                "Retira las operaciones antes de declarar que no requiere MOD."
            )
        else:
            record = record or RecipeWork(recipe_id=recipe_id, operations=[])
            record.no_materials = form.no_materials.data
            record.no_labor = form.no_labor.data
            db.session.add(record)
            db.session.commit()
            flash("Aplicabilidad guardada para esta versión de receta.", "success")
            return redirect(url_for("planning.work", company_id=company_id, recipe_id=recipe_id))
    names = {
        e.id: e.name
        for e in db.session.scalars(db.select(Employee).where(Employee.company_id == company_id))
    }
    return render_template(
        "planning/work.html",
        company=company,
        recipe=recipe,
        record=record,
        form=form,
        operation_form=operation_form,
        names=names,
    ), (422 if form.is_submitted() else 200)


@bp.post("/recetas/<int:recipe_id>/operaciones/agregar")
@login_required
def operation_add(company_id, recipe_id):
    company, recipe, record = own_recipe(company_id, recipe_id)
    form = OperationForm()
    form.employee_id.choices = [
        (e.id, e.name)
        for e in db.session.scalars(
            db.select(Employee).where(Employee.company_id == company_id, Employee.active == true())
        )
    ]
    if form.validate_on_submit():
        record = record or RecipeWork(recipe_id=recipe_id, operations=[])
        if any(
            op["employee_id"] == form.employee_id.data
            and " ".join(op["activity"].casefold().split())
            == " ".join(form.activity.data.casefold().split())
            for op in record.operations
        ):
            form.activity.errors.append(
                "Esta actividad ya está asignada al trabajador. Quita la anterior para reemplazarla."
            )
            return form_page(
                company,
                form,
                "Agregar operación",
                url_for("planning.work", company_id=company_id, recipe_id=recipe_id),
                "No repitas el mismo trabajo en la receta.",
            )
        record.operations = [
            *record.operations,
            dict(
                employee_id=form.employee_id.data,
                activity=form.activity.data,
                minutes=str(form.minutes.value),
            ),
        ]
        record.no_labor = False
        db.session.add(record)
        db.session.commit()
        return redirect(url_for("planning.work", company_id=company_id, recipe_id=recipe_id))
    return form_page(
        company,
        form,
        "Agregar operación",
        url_for("planning.work", company_id=company_id, recipe_id=recipe_id),
        "Los minutos corresponden al lote completo de esta versión de receta.",
    )


@bp.post("/recetas/<int:recipe_id>/operaciones/<int:position>/quitar")
@login_required
def operation_remove(company_id, recipe_id, position):
    _, _, record = own_recipe(company_id, recipe_id)
    action()
    if not record or position >= len(record.operations):
        abort(404)
    record.operations = [op for i, op in enumerate(record.operations) if i != position]
    db.session.commit()
    return redirect(url_for("planning.work", company_id=company_id, recipe_id=recipe_id))


@bp.get("/costos")
@login_required
def concepts(company_id):
    company = owned_company(company_id)
    available_periods = list(
        db.session.scalars(
            db.select(Period)
            .where(Period.company_id == company_id)
            .order_by(Period.year.desc(), Period.month.desc())
        )
    )
    period_id = request.args.get("periodo", type=int)
    if period_id is not None and period_id not in {p.id for p in available_periods}:
        abort(404)
    period_id = period_id or (
        g.active_period.id if g.active_period and g.active_period.company_id == company_id else None
    )
    period = next((p for p in available_periods if p.id == period_id), None) or (
        available_periods[0] if available_periods else None
    )
    plans = (
        list(
            db.session.scalars(
                db.select(ProductionPlan)
                .where(
                    ProductionPlan.company_id == company_id, ProductionPlan.period_id == period.id
                )
                .order_by(ProductionPlan.id.desc())
            )
        )
        if period
        else []
    )
    plan_id = request.args.get("plan", type=int)
    if plan_id is not None and plan_id not in {p.id for p in plans}:
        abort(404)
    selected_plan = (
        next((p for p in plans if p.id == plan_id), None)
        or next((p for p in plans if p.active), None)
        or (plans[0] if plans else None)
    )
    line_id = request.args.get("plato", type=int)
    lines = selected_plan.lines if selected_plan else []
    if line_id is not None and line_id not in {line.id for line in lines}:
        abort(404)
    selected_line = next((line for line in lines if line.id == line_id), None) or (
        lines[0] if lines else None
    )
    records = list(
        db.session.scalars(
            db.select(CostConcept)
            .where(
                CostConcept.company_id == company_id,
                CostConcept.period_id == (period.id if period else -1),
            )
            .order_by(CostConcept.period_id.desc(), CostConcept.name)
        )
    )
    result = evaluate(selected_plan)[1] if selected_plan else None
    return render_template(
        "planning/concepts_tables.html",
        company=company,
        records=records,
        groups=overhead_tables(records, result, selected_line),
        available_periods=available_periods,
        selected_period=period,
        plans=plans,
        selected_plan=selected_plan,
        selected_line=selected_line,
        period_names={
            p.id: p.label
            for p in db.session.scalars(db.select(Period).where(Period.company_id == company_id))
        },
    )


@bp.route("/costos/nuevo", methods=["GET", "POST"])
@bp.route("/costos/<int:concept_id>/editar", methods=["GET", "POST"])
@login_required
def concept_edit(company_id, concept_id=None):
    company = owned_company(company_id)
    record = owned(CostConcept, company_id, concept_id) if concept_id else None
    form = ConceptForm(obj=record)
    periods(form, company_id)
    allocation_lines = list(
        db.session.scalars(
            db.select(PlanLine)
            .join(ProductionPlan)
            .where(ProductionPlan.company_id == company_id)
            .order_by(ProductionPlan.id.desc(), PlanLine.id)
        )
    )
    form.allocation_line_id.choices = [(0, "Conservar los datos de los planes actuales")] + [
        (
            line.id,
            f"{line.product.name} · {db.session.get(ProductionPlan, line.plan_id).name} · {db.session.get(ProductionPlan, line.plan_id).period.label} · {decimal_text(line.quantity)} porciones · venta ref. {decimal_text(line.reference_price)} · factor {decimal_text(line.equivalent_factor)}",
        )
        for line in allocation_lines
    ]
    form.targets.choices = [
        (p.id, p.name)
        for p in db.session.scalars(db.select(Product).where(Product.company_id == company_id))
    ]
    if request.method == "GET" and record:
        form.period_id.data = record.period_id
        form.amount.data = decimal_text(record.amount)
    elif request.method == "GET" and request.args.get("tipo") in dict(form.kind.choices):
        form.kind.data = request.args["tipo"]
    if request.method == "GET" and not record and request.args.get("periodo"):
        requested_period = request.args.get("periodo", type=int)
        if requested_period not in dict(form.period_id.choices):
            abort(404)
        form.period_id.data = requested_period
    if form.validate_on_submit():
        if form.allocation_line_id.data:
            line = next(
                line for line in allocation_lines if line.id == form.allocation_line_id.data
            )
            plan = db.session.get(ProductionPlan, line.plan_id)
            if plan.period_id != form.period_id.data:
                form.allocation_line_id.errors.append(
                    "El plan seleccionado debe pertenecer al mismo periodo del concepto."
                )
                return concept_form_page(company, form)
        normalized = " ".join(form.name.data.casefold().split())
        reference = " ".join((form.reference_key.data or form.name.data).casefold().split())
        others = db.session.scalars(
            db.select(CostConcept).where(
                CostConcept.company_id == company_id, CostConcept.period_id == form.period_id.data
            )
        )
        if any(
            c.id != concept_id
            and (" ".join(c.name.casefold().split()) == normalized or c.reference_key == reference)
            for c in others
        ):
            form.name.errors.append(
                "Este costo o comprobante ya existe en el periodo. Edita el registro original para evitar duplicarlo."
            )
        else:
            return save_concept(company, record, form, reference)
    return concept_form_page(company, form)


def concept_form_page(company, form):
    return render_template("planning/concept_form.html", company=company, form=form), (
        422 if form.is_submitted() else 200
    )


def save_concept(company, record, form, reference):
    company_id = company.id
    if form.validate_on_submit():
        record = record or CostConcept(company_id=company_id)
        record.reference_key = reference
        for key in (
            "period_id",
            "name",
            "kind",
            "basis",
            "behavior",
            "justification",
            "targets",
            "active",
        ):
            setattr(record, key, getattr(form, key).data)
        record.amount = form.amount.value
        selected_plan = None
        if form.allocation_line_id.data:
            line = db.first_or_404(
                db.select(PlanLine)
                .join(ProductionPlan)
                .where(
                    PlanLine.id == form.allocation_line_id.data,
                    ProductionPlan.company_id == company_id,
                    ProductionPlan.period_id == form.period_id.data,
                )
            )
            selected_plan = db.session.get(ProductionPlan, line.plan_id)
            for field, attr in (
                ("allocation_quantity", "quantity"),
                ("allocation_reference_price", "reference_price"),
                ("allocation_equivalent_factor", "equivalent_factor"),
            ):
                if getattr(form, field).value is not None:
                    setattr(line, attr, getattr(form, field).value)
            selected_plan.calculation_hash = None
        db.session.add(record)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            form.reference_key.errors.append("Este comprobante ya está registrado en el periodo.")
        else:
            return redirect(
                url_for(
                    "planning.concepts",
                    company_id=company_id,
                    periodo=record.period_id,
                    **(
                        dict(plan=selected_plan.id, plato=form.allocation_line_id.data)
                        if selected_plan
                        else {}
                    ),
                )
            )
    return concept_form_page(company, form)


@bp.get("/planes")
@login_required
def plans(company_id):
    company = owned_company(company_id)
    records = list(
        db.session.scalars(
            db.select(ProductionPlan)
            .where(ProductionPlan.company_id == company_id)
            .order_by(ProductionPlan.id.desc())
        )
    )
    return render_template(
        "planning/plans.html",
        company=company,
        records=records,
        production_tables=[(plan, production_table(evaluate(plan)[1])) for plan in records],
    )


@bp.route("/planes/nuevo", methods=["GET", "POST"])
@bp.route("/planes/<int:plan_id>/editar", methods=["GET", "POST"])
@login_required
def plan_edit(company_id, plan_id=None):
    company = owned_company(company_id)
    record = owned(ProductionPlan, company_id, plan_id) if plan_id else None
    form = PlanForm(obj=record)
    available = periods(form, company_id)
    if record:
        form.period_id.choices = [(record.period_id, record.period.label)]
    if request.method == "GET":
        if record:
            form.period_id.data = record.period_id
            form.assumption.data = True
        else:
            selected = next(
                (p for p in available if p.id == form.period_id.data),
                available[0] if available else None,
            )
            if selected:
                form.price_date.data = date(
                    selected.year,
                    selected.month,
                    calendar.monthrange(selected.year, selected.month)[1],
                )
    dish_options = (
        plan_dish_options(
            company, form.period_id.data, request.form if request.method == "POST" else None
        )
        if not record
        else []
    )
    dish_errors, new_lines = [], []
    valid = form.validate_on_submit()
    if valid and not record:
        selected_period = next(p for p in available if p.id == form.period_id.data)
        tax = D(".18") if company.industry.slug == "restaurantes" else selected_period.tax_rate
        if request.form.getlist("dish_ids") and tax is None:
            dish_errors.append("Configura el impuesto del periodo antes de agregar platos.")
        else:
            new_lines, dish_errors = selected_plan_lines(dish_options, request.form, tax or D("0"))
    if valid and not dish_errors:
        record = record or ProductionPlan(company_id=company_id)
        for key in ("name", "period_id", "price_date", "no_cif", "no_expenses"):
            setattr(record, key, getattr(form, key).data)
        record.calculation_hash = None
        db.session.add(record)
        if not plan_id:
            db.session.flush()
            for values in new_lines:
                db.session.add(PlanLine(plan_id=record.id, **values))
        db.session.commit()
        return redirect(url_for("planning.plan_detail", company_id=company_id, plan_id=record.id))
    if not plan_id:
        return render_template(
            "planning/new_plan.html",
            company=company,
            form=form,
            dish_options=dish_options,
            dish_errors=dish_errors,
        ), (422 if form.is_submitted() else 200)
    return form_page(
        company,
        form,
        "Plan mensual / escenario",
        url_for("planning.plans", company_id=company_id),
        "Cada escenario es independiente. Las recetas se seleccionan explícitamente y conservan sus precios. La fecha de referencia valida su vigencia, no reemplaza automáticamente los precios. Actualiza la receta si deseas otros precios. Las cantidades admiten consumo proporcional de lotes, sin programación de lotes enteros.",
    )


@bp.route("/planes/<int:plan_id>/lineas/nueva", methods=["GET", "POST"])
@bp.route("/planes/<int:plan_id>/lineas/<int:line_id>", methods=["GET", "POST"])
@login_required
def plan_line(company_id, plan_id, line_id=None):
    plan = owned(ProductionPlan, company_id, plan_id)
    record = (
        db.first_or_404(
            db.select(PlanLine).where(PlanLine.id == line_id, PlanLine.plan_id == plan.id)
        )
        if line_id
        else None
    )
    form = PlanLineForm(obj=record)
    if plan.company.industry.slug == "restaurantes":
        form.tax_percent.data = "18"
        form.tax_percent.label.text = "IGV del restaurante (%) · fijo en 18"
        form.tax_percent.render_kw = {"readonly": True}
    recipes = list(
        db.session.scalars(
            db.select(RecipeVersion)
            .join(Product)
            .where(Product.company_id == company_id)
            .order_by(RecipeVersion.id.desc())
        )
    )
    form.recipe_id.choices = [
        (
            r.id,
            f"{r.product_name} · versión {r.number} · lote {r.output_quantity} {r.output_unit.symbol}",
        )
        for r in recipes
    ]
    if request.method == "GET" and record:
        for key in ("quantity", "reference_price", "equivalent_factor", "adopted_price"):
            value = getattr(record, key)
            getattr(form, key).data = decimal_text(value) if value is not None else ""
        form.pricing_value.data = decimal_text(
            record.pricing_value * (100 if record.pricing_mode != "manual" else 1)
        )
        form.tax_percent.data = (
            decimal_text(record.tax_rate * 100) if record.tax_rate is not None else ""
        )
        if plan.company.industry.slug == "restaurantes":
            form.tax_percent.data = "18"
    if form.validate_on_submit():
        recipe = next(r for r in recipes if r.id == form.recipe_id.data)
        record = record or PlanLine(plan_id=plan.id)
        record.recipe_id = recipe.id
        record.product_id = recipe.product_id
        record.pricing_mode = form.pricing_mode.data
        for key in ("quantity", "reference_price", "equivalent_factor", "adopted_price"):
            setattr(record, key, getattr(form, key).value)
        record.pricing_value = form.pricing_value.value / (
            100 if form.pricing_mode.data != "manual" else 1
        )
        record.tax_rate = (
            form.tax_percent.value / 100 if form.tax_percent.value is not None else None
        )
        if plan.company.industry.slug == "restaurantes":
            record.tax_rate = D(".18")
        plan.calculation_hash = None
        db.session.add(record)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            form.recipe_id.errors.append(
                "Este producto ya está en el plan. Edita su línea existente."
            )
        else:
            return redirect(url_for("planning.plan_detail", company_id=company_id, plan_id=plan.id))
    return form_page(
        plan.company,
        form,
        "Producto del plan",
        url_for("planning.plan_detail", company_id=company_id, plan_id=plan.id),
        "La cantidad usa la unidad de salida de la receta (porción o unidad); no mezcles ambas. Los objetivos de margen, recargo o Food Cost se ingresan en porcentaje. Food Cost usa costo total / objetivo (30 equivale a 30 %), antes del impuesto. El precio final se redondea a céntimos y el margen efectivo se recalcula. Un precio manual puede producir pérdida. El factor equivalente 1 solo es apropiado para productos comparables.",
    )


@bp.post("/planes/<int:plan_id>/lineas/<int:line_id>/quitar")
@login_required
def line_remove(company_id, plan_id, line_id):
    plan = owned(ProductionPlan, company_id, plan_id)
    action()
    line = db.first_or_404(
        db.select(PlanLine).where(PlanLine.id == line_id, PlanLine.plan_id == plan.id)
    )
    db.session.delete(line)
    plan.calculation_hash = None
    db.session.commit()
    return redirect(url_for("planning.plan_detail", company_id=company_id, plan_id=plan.id))


@bp.get("/planes/<int:plan_id>")
@login_required
def plan_detail(company_id, plan_id):
    plan = owned(ProductionPlan, company_id, plan_id)
    data, result, fingerprint = evaluate(plan)
    return render_template(
        "planning/plan.html",
        company=plan.company,
        plan=plan,
        data=data,
        result=result,
        fingerprint=fingerprint,
        publish_form=PublishForm(fingerprint=fingerprint),
        production=production_table(result),
        fresh=plan.calculation_hash == fingerprint,
    )


@bp.post("/planes/<int:plan_id>/calcular")
@login_required
def calculate(company_id, plan_id):
    plan = owned(ProductionPlan, company_id, plan_id)
    action()
    _, result, fingerprint = evaluate(plan)
    plan.calculation_hash = fingerprint
    db.session.commit()
    flash(
        "Cálculo revisado. "
        + (
            "Puedes publicar el presupuesto."
            if result["status"] == "calculable"
            else "Resuelve los pendientes indicados antes de publicar."
        ),
        "success" if result["status"] == "calculable" else "warning",
    )
    return redirect(url_for("planning.plan_detail", company_id=company_id, plan_id=plan.id))


@bp.post("/planes/<int:plan_id>/activar")
@login_required
def activate(company_id, plan_id):
    plan = owned(ProductionPlan, company_id, plan_id)
    action()
    db.session.execute(
        db.update(ProductionPlan)
        .where(ProductionPlan.company_id == company_id, ProductionPlan.period_id == plan.period_id)
        .values(active=False)
    )
    plan.active = True
    db.session.commit()
    return redirect(url_for("planning.plan_detail", company_id=company_id, plan_id=plan.id))


@bp.post("/planes/<int:plan_id>/publicar")
@login_required
def publish(company_id, plan_id):
    plan = owned(ProductionPlan, company_id, plan_id)
    form = PublishForm()
    if not form.validate_on_submit():
        abort(400)
    # Obtain a write lock before reading input dependencies (SQLite serializes writes).
    db.session.execute(
        db.update(ProductionPlan).where(ProductionPlan.id == plan.id).values(name=plan.name)
    )
    data, result, fingerprint = evaluate(plan)
    if (
        result["status"] != "calculable"
        or plan.calculation_hash != fingerprint
        or form.fingerprint.data != fingerprint
    ):
        db.session.rollback()
        flash(
            "No se publicó: faltan datos o cambiaron las entradas. Recalcula y revisa el plan.",
            "warning",
        )
        return redirect(url_for("planning.plan_detail", company_id=company_id, plan_id=plan.id))
    previous = db.session.scalar(
        db.select(Budget).where(Budget.plan_id == plan.id).order_by(Budget.number.desc())
    )
    if previous and previous.fingerprint == fingerprint:
        try:
            plan_outputs(plan)
            db.session.commit()
        except ValueError as exc:
            db.session.rollback()
            flash(str(exc), "warning")
            return redirect(url_for("planning.plan_detail", company_id=company_id, plan_id=plan.id))
        return redirect(
            url_for("planning.budget_detail", company_id=company_id, budget_id=previous.id)
        )
    budget = Budget(
        company_id=company_id,
        plan_id=plan.id,
        author_id=current_user.id,
        number=previous.number + 1 if previous else 1,
        snapshot=plain({"input": data, "result": result}),
        fingerprint=fingerprint,
    )
    db.session.add(budget)
    try:
        plan_outputs(plan)
        db.session.commit()
    except ValueError as exc:
        db.session.rollback()
        flash(str(exc), "warning")
        return redirect(url_for("planning.plan_detail", company_id=company_id, plan_id=plan.id))
    return redirect(url_for("planning.budget_detail", company_id=company_id, budget_id=budget.id))


@bp.get("/presupuestos")
@login_required
def budgets(company_id):
    company = owned_company(company_id)
    records = list(
        db.session.scalars(
            db.select(Budget).where(Budget.company_id == company_id).order_by(Budget.id.desc())
        )
    )
    archived = {
        r.budget_id
        for r in db.session.scalars(
            db.select(BudgetArchive)
            .join(Budget)
            .where(Budget.company_id == company_id, BudgetArchive.archived == true())
        )
    }
    return render_template(
        "planning/budgets.html", company=company, records=records, archived=archived
    )


@bp.get("/presupuestos/<int:budget_id>")
@login_required
def budget_detail(company_id, budget_id):
    budget = owned(Budget, company_id, budget_id)
    state = db.session.get(BudgetArchive, budget_id)
    return render_template(
        "planning/budget.html",
        company=owned_company(company_id),
        budget=budget,
        data=budget.snapshot["input"],
        result=budget.snapshot["result"],
        archived=bool(state and state.archived),
    )


@bp.post("/presupuestos/<int:budget_id>/estado")
@login_required
def budget_toggle(company_id, budget_id):
    owned(Budget, company_id, budget_id)
    action()
    state = request.form.get("state")
    if state not in ("archived", "published"):
        abort(400)
    record = db.session.get(BudgetArchive, budget_id) or BudgetArchive(budget_id=budget_id)
    record.archived = state == "archived"
    db.session.add(record)
    db.session.commit()
    return redirect(url_for("planning.budget_detail", company_id=company_id, budget_id=budget_id))


@bp.get("/presupuestos/<int:budget_id>/descargar")
@login_required
def budget_download(company_id, budget_id):
    budget = owned(Budget, company_id, budget_id)
    return Response(
        json.dumps(budget.snapshot, ensure_ascii=False, indent=2),
        mimetype="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="presupuesto-{budget.id}-v{budget.number}.json"'
        },
    )


@bp.get("/reportes")
@login_required
def reports(company_id):
    company = owned_company(company_id)
    plan = db.session.scalar(
        db.select(ProductionPlan).where(
            ProductionPlan.company_id == company_id,
            ProductionPlan.active == true(),
            ProductionPlan.period_id == g.active_period.id
            if g.active_period and g.active_period.company_id == company_id
            else False,
        )
    )
    data, result, fingerprint = evaluate(plan) if plan else (None, None, None)
    return render_template(
        "planning/reports.html",
        company=company,
        plan=plan,
        data=data,
        result=result,
        fresh=bool(plan and plan.calculation_hash == fingerprint),
    )
