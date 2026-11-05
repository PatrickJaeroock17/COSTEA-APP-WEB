"""Ownership-scoped queries and validated session context."""

from flask import abort, g, request, session
from flask_login import current_user
from sqlalchemy import true

from app.extensions import db
from app.models import Company, Period


def list_owned_companies(user_id: int, include_archived: bool = False) -> list[Company]:
    statement = db.select(Company).where(Company.user_id == user_id).order_by(Company.legal_name)
    if not include_archived:
        statement = statement.where(Company.active == true())
    return list(db.session.scalars(statement))


def owned_company(company_id: int, *, include_archived: bool = False) -> Company:
    statement = db.select(Company).where(
        Company.id == company_id, Company.user_id == current_user.id
    )
    if not include_archived:
        statement = statement.where(Company.active == true())
    return db.first_or_404(statement)


def owned_period(company_id: int, period_id: int) -> Period:
    owned_company(company_id)
    return db.first_or_404(
        db.select(Period).where(
            Period.id == period_id,
            Period.company_id == company_id,
        )
    )


def activate_company(company: Company) -> None:
    session["active_company_id"] = company.id
    session.pop("active_period_id", None)


def resolve_workspace() -> None:
    """Revalidate ownership on every request, never trust IDs in session or URL."""
    g.owned_companies, g.periods = [], []
    g.active_company, g.active_period = None, None
    if request.endpoint == "static" or not current_user.is_authenticated:
        return
    g.owned_companies = list_owned_companies(current_user.id)
    companies = {company.id: company for company in g.owned_companies}
    requested = (request.view_args or {}).get("company_id")
    if requested in companies and session.get("active_company_id") != requested:
        activate_company(companies[requested])
    selected = session.get("active_company_id")
    g.active_company = companies.get(selected) if type(selected) is int else None
    if g.active_company is None:
        session.pop("active_company_id", None)
        session.pop("active_period_id", None)
        if not g.owned_companies:
            return
        g.active_company = g.owned_companies[0]
        session["active_company_id"] = g.active_company.id
    g.periods = list(
        db.session.scalars(
            db.select(Period)
            .where(
                Period.company_id == g.active_company.id,
            )
            .order_by(Period.year.desc(), Period.month.desc())
        )
    )
    selected = session.get("active_period_id")
    g.active_period = next(
        (p for p in g.periods if type(selected) is int and p.id == selected), None
    )
    if g.active_period is None:
        session.pop("active_period_id", None)
        if g.periods:
            g.active_period = g.periods[0]
            session["active_period_id"] = g.active_period.id


def require_active_company() -> Company:
    if g.active_company is None:
        abort(404)
    return g.active_company
