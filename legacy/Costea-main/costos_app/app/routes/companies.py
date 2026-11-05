"""Company setup, period configuration and ownership-checked workspace changes."""

from decimal import Decimal

from flask import Blueprint, abort, flash, g, redirect, render_template, request, session, url_for
from flask_login import current_user, login_required
from sqlalchemy import true
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.forms.company import (
    ActionForm,
    CompanyForm,
    CreateCompanyForm,
    PeriodForm,
    PeriodTaxForm,
    UnitsForm,
)
from app.models import Company, CompanyUnit, Industry, Material, MaterialCostVersion, Period, Unit
from app.services.catalog_sync import catalog_available, sync_restaurant_catalog
from app.services.companies import (
    activate_company,
    list_owned_companies,
    owned_company,
    owned_period,
)

bp = Blueprint("companies", __name__)


def percent_text(rate: Decimal | None) -> str:
    if rate is None:
        return ""
    value = format(rate * 100, "f")
    return value.rstrip("0").rstrip(".") if "." in value else value


def restaurant_industry():
    industry = db.session.scalar(
        db.select(Industry).where(Industry.slug == "restaurantes", Industry.active == true())
    )
    if industry is None:
        abort(503)
    return industry


def apply_company_form(company, form):
    company.legal_name = form.legal_name.data
    company.trade_name = form.trade_name.data or None
    company.tax_id_kind = form.tax_id_kind.data
    company.tax_id = form.tax_id.data or None
    company.industry_id = restaurant_industry().id
    company.currency = form.currency.data
    company.default_tax_rate = form.tax_percent.rate
    company.default_tax_rate = Decimal(".18")


def require_action():
    if not ActionForm().validate_on_submit():
        abort(400)


def positive_id(field: str) -> int:
    raw = request.form.get(field, "")
    if not raw.isascii() or not raw.isdigit() or len(raw) > 18 or int(raw) <= 0:
        abort(400)
    return int(raw)


@bp.get("/empresas")
@login_required
def index():
    return render_template(
        "companies/index.html",
        companies=list_owned_companies(current_user.id, True),
        action_form=ActionForm(),
    )


@bp.route("/empresas/nueva", methods=["GET", "POST"])
@login_required
def create():
    form = CreateCompanyForm()
    restaurant_industry()
    if request.method == "GET":
        form.currency.data = "PEN"
        form.tax_id_kind.data = "peru_ruc"
        form.tax_percent.data = "18"
    if form.validate_on_submit():
        company = Company(user_id=current_user.id)
        apply_company_form(company, form)
        db.session.add(company)
        try:
            db.session.flush()
            period = Period(
                company_id=company.id, year=form.initial_month.year, month=form.initial_month.month
            )
            period.tax_rate = company.default_tax_rate
            db.session.add(period)
            db.session.flush()
            db.session.expire(company, ["periods"])
            if catalog_available():
                sync_restaurant_catalog(company)
            db.session.commit()
        except ValueError as exc:
            db.session.rollback()
            form.legal_name.errors.append(str(exc))
        except IntegrityError:
            db.session.rollback()
            form.tax_id.errors.append(
                "Ya tienes una empresa con este identificador. Revisa también las archivadas."
            )
        else:
            activate_company(company)
            session["active_period_id"] = period.id
            if company.industry.slug == "restaurantes":
                flash(
                    "Restaurante creado. Selecciona un plato o registra tu receta propia.",
                    "success",
                )
                return redirect(url_for("products.index", company_id=company.id))
            flash("Empresa creada. Selecciona las unidades que utilizarás.", "success")
            return redirect(url_for("companies.units", company_id=company.id))
    return render_template("companies/form.html", form=form, company=None), (
        422 if form.is_submitted() else 200
    )


@bp.route("/empresas/<int:company_id>/editar", methods=["GET", "POST"])
@login_required
def edit(company_id):
    company = owned_company(company_id)
    form = CompanyForm(obj=company)
    restaurant_industry()
    if request.method == "GET":
        form.tax_percent.data = percent_text(company.default_tax_rate)
    has_costs = (
        db.session.scalar(
            db.select(MaterialCostVersion.id)
            .join(Material, Material.id == MaterialCostVersion.material_id)
            .where(Material.company_id == company.id)
            .limit(1)
        )
        is not None
    )
    if has_costs:
        form.currency.choices = [
            choice for choice in form.currency.choices if choice[0] == company.currency
        ]
    from app.models import CostConcept, Employee, EmployeePeriodCost, Product, ProductionPlan

    monetary_records = (
        db.session.scalar(
            db.select(CostConcept.id).where(CostConcept.company_id == company.id).limit(1)
        )
        or db.session.scalar(
            db.select(ProductionPlan.id).where(ProductionPlan.company_id == company.id).limit(1)
        )
        or db.session.scalar(db.select(Product.id).where(Product.company_id == company.id).limit(1))
        or db.session.scalar(
            db.select(EmployeePeriodCost.id)
            .join(Employee)
            .where(Employee.company_id == company.id)
            .limit(1)
        )
    )
    if monetary_records:
        form.currency.choices = [
            choice for choice in form.currency.choices if choice[0] == company.currency
        ]
    if form.validate_on_submit():
        apply_company_form(company, form)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            form.tax_id.errors.append("Ya tienes una empresa con este identificador.")
        else:
            flash(
                "Configuración guardada. Los impuestos de periodos existentes se conservan.",
                "success",
            )
            return redirect(url_for("companies.edit", company_id=company.id))
    return render_template("companies/form.html", form=form, company=company), (
        422 if form.is_submitted() else 200
    )


@bp.route("/empresas/<int:company_id>/archivar", methods=["GET", "POST"])
@login_required
def archive(company_id):
    company = owned_company(company_id)
    form = ActionForm()
    if form.validate_on_submit():
        company.active = False
        db.session.commit()
        if session.get("active_company_id") == company.id:
            session.pop("active_company_id", None)
            session.pop("active_period_id", None)
        flash("Empresa archivada. Sus datos se conservan y puedes restaurarla.", "success")
        return redirect(url_for("companies.index"))
    return render_template("companies/archive.html", company=company, form=form)


@bp.post("/empresas/<int:company_id>/restaurar")
@login_required
def restore(company_id):
    company = owned_company(company_id, include_archived=True)
    require_action()
    company.active = True
    db.session.commit()
    flash("Empresa restaurada.", "success")
    return redirect(url_for("companies.index"))


@bp.post("/espacio/empresa")
@login_required
def select_company():
    require_action()
    company = owned_company(positive_id("company_id"))
    activate_company(company)
    if company.industry.slug == "restaurantes":
        return redirect(url_for("products.index", company_id=company.id))
    return redirect(url_for("dashboard.index"))


@bp.post("/espacio/periodo")
@login_required
def select_period():
    require_action()
    if not g.active_company:
        abort(404)
    period = owned_period(g.active_company.id, positive_id("period_id"))
    session["active_period_id"] = period.id
    return redirect(url_for("dashboard.index"))


@bp.route("/empresas/<int:company_id>/periodos", methods=["GET", "POST"])
@login_required
def periods(company_id):
    company = owned_company(company_id)
    form = PeriodForm()
    if request.method == "GET":
        form.tax_percent.data = percent_text(company.default_tax_rate)
    if form.validate_on_submit():
        period = Period(company_id=company.id, year=form.month_key.year, month=form.month_key.month)
        period.tax_rate = form.tax_percent.rate
        if company.industry.slug == "restaurantes":
            period.tax_rate = Decimal(".18")
        db.session.add(period)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            form.month_key.errors.append("Este periodo ya existe para la empresa.")
        else:
            if session.get("active_company_id") == company.id:
                session["active_period_id"] = period.id
            flash("Periodo creado con su propia configuración de impuesto.", "success")
            return redirect(url_for("companies.periods", company_id=company.id))
    records = list(
        db.session.scalars(
            db.select(Period)
            .where(
                Period.company_id == company.id,
            )
            .order_by(Period.year.desc(), Period.month.desc())
        )
    )
    return render_template("companies/periods.html", company=company, form=form, periods=records), (
        422 if form.is_submitted() else 200
    )


@bp.route("/empresas/<int:company_id>/periodos/<int:period_id>/impuesto", methods=["GET", "POST"])
@login_required
def period_tax(company_id, period_id):
    period = owned_period(company_id, period_id)
    form = PeriodTaxForm()
    if request.method == "GET":
        form.tax_percent.data = percent_text(period.tax_rate)
    if form.validate_on_submit():
        period.tax_rate = form.tax_percent.rate
        if period.company.industry.slug == "restaurantes":
            period.tax_rate = Decimal(".18")
        db.session.commit()
        flash("Impuesto del periodo actualizado.", "success")
        return redirect(url_for("companies.periods", company_id=company_id))
    return render_template(
        "companies/period_tax.html", company=period.company, period=period, form=form
    ), (422 if form.is_submitted() else 200)


@bp.route("/empresas/<int:company_id>/unidades", methods=["GET", "POST"])
@login_required
def units(company_id):
    company = owned_company(company_id)
    from app.models.restaurant import CatalogUnitSelection
    from app.services.catalog import get_catalog
    from app.services.catalog_selection import UNIT_CODES

    form = UnitsForm()
    try:
        catalog = get_catalog().units()
    except ValueError as exc:
        return render_template(
            "companies/units.html", company=company, form=form, units=[], error=str(exc)
        ), 503
    form.unit_codes.choices = [
        (str(u["id_unidad"]), u["descripcion"] or u["codigo"]) for u in catalog
    ]
    selected = list(
        db.session.scalars(
            db.select(CatalogUnitSelection).where(CatalogUnitSelection.company_id == company.id)
        )
    )
    existing = {setting.unit_code: setting for setting in company.unit_settings}
    if request.method == "GET":
        form.unit_codes.data = (
            [str(s.source_unit_id) for s in selected if s.enabled]
            if selected
            else [str(u["id_unidad"]) for u in catalog]
        )
    if form.validate_on_submit():
        enabled = set(form.unit_codes.data)
        settings = {s.source_unit_id: s for s in selected}
        codes = set()
        for unit in catalog:
            ident = unit["id_unidad"]
            setting = settings.get(ident) or CatalogUnitSelection(
                company_id=company.id, source_unit_id=ident
            )
            setting.enabled = str(ident) in enabled
            db.session.add(setting)
            code = UNIT_CODES.get(unit["codigo"].strip().casefold())
            if setting.enabled and code and db.session.get(Unit, code):
                codes.add(code)
        for code, setting in existing.items():
            setting.enabled = code in codes
        for code in codes - existing.keys():
            db.session.add(CompanyUnit(company_id=company.id, unit_code=code))
        db.session.commit()
        flash("Unidades de SQL Server guardadas para este restaurante.", "success")
        return redirect(url_for("companies.units", company_id=company.id))
    return render_template(
        "companies/units.html", company=company, form=form, units=catalog, error=None
    ), (422 if form.is_submitted() else 200)
