from flask import Blueprint, g, redirect, render_template, url_for
from flask_login import current_user, login_required
from sqlalchemy import true

from app.extensions import db
from app.models import Industry
from app.services.companies import list_owned_companies

bp = Blueprint("dashboard", __name__)


@bp.get("/")
def home():
    endpoint = "dashboard.index" if current_user.is_authenticated else "auth.login"
    return redirect(url_for(endpoint))


@bp.get("/dashboard")
@login_required
def index():
    from app.models import ProductionPlan

    plan = None
    result = None
    fresh = False
    if g.active_company and g.active_period:
        plan = db.session.scalar(
            db.select(ProductionPlan).where(
                ProductionPlan.company_id == g.active_company.id,
                ProductionPlan.period_id == g.active_period.id,
                ProductionPlan.active == true(),
            )
        )
    industries = db.session.scalars(
        db.select(Industry).where(Industry.active == true()).order_by(Industry.id)
    ).all()
    return render_template(
        "dashboard/workflow.html",
        industries=industries,
        companies=list_owned_companies(current_user.id),
        plan=plan,
        result=result,
        fresh=fresh,
    )
