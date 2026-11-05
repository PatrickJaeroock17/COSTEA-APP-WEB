"""Transactional queue for the normalized SQL Server dish/recipe projection."""

from flask import current_app, has_app_context
from sqlalchemy import event
from sqlalchemy.orm import Session

from app.extensions import db
from app.models import (
    Company,
    Employee,
    EmployeePeriodCost,
    Material,
    MaterialConversion,
    MaterialCostVersion,
    Period,
    Product,
    ProductPrice,
    RecipeLine,
    RecipeVersion,
)
from app.models.base import utc_now
from app.models.planning import CostConcept, PlanLine, ProductionPlan, RecipeWork
from app.models.restaurant import DishSync
from app.services.dish_snapshot import dish_snapshot
from app.services.dish_storage import get_dish_store


@event.listens_for(Session, "after_flush")
def collect_changed_dishes(session, _context):
    if not has_app_context():
        return
    companies = session.info.setdefault("dish_companies", set())
    for obj in session.new | session.dirty | session.deleted:
        if isinstance(obj, Company):
            companies.add(obj.id)
        elif isinstance(obj, (Product, Material, Employee, Period, CostConcept, ProductionPlan)):
            companies.add(obj.company_id)
        elif isinstance(obj, (RecipeVersion, ProductPrice, PlanLine)):
            companies.add(
                session.scalar(db.select(Product.company_id).where(Product.id == obj.product_id))
            )
        elif isinstance(obj, (RecipeLine, RecipeWork)):
            companies.add(
                session.scalar(
                    db.select(Product.company_id)
                    .join(RecipeVersion)
                    .where(RecipeVersion.id == obj.recipe_id)
                )
            )
        elif isinstance(obj, (MaterialCostVersion, MaterialConversion)):
            companies.add(
                session.scalar(db.select(Material.company_id).where(Material.id == obj.material_id))
            )
        elif isinstance(obj, EmployeePeriodCost):
            companies.add(
                session.scalar(db.select(Employee.company_id).where(Employee.id == obj.employee_id))
            )


def queue_products(session, product_ids):
    product_ids = set(product_ids)
    if not product_ids:
        return
    existing = set(
        session.scalars(db.select(DishSync.product_id).where(DishSync.product_id.in_(product_ids)))
    )
    if existing:
        session.execute(
            db.update(DishSync)
            .where(DishSync.product_id.in_(existing))
            .values(generation=DishSync.generation + 1, error=None)
        )
    for product_id in product_ids - existing:
        session.add(DishSync(product_id=product_id))


@event.listens_for(Session, "before_commit")
def queue_before_commit(session):
    if not has_app_context():
        return
    session.flush()
    companies = session.info.pop("dish_companies", set()) - {None}
    if companies:
        queue_products(
            session, session.scalars(db.select(Product.id).where(Product.company_id.in_(companies)))
        )


@event.listens_for(Session, "after_rollback")
def discard_rolled_back_changes(session):
    session.info.pop("dish_companies", None)


def pending_query(owner_id=None, company_id=None):
    stmt = (
        db.select(DishSync)
        .join(Product)
        .join(Company)
        .where(DishSync.generation > DishSync.synced_generation)
    )
    if owner_id is not None:
        stmt = stmt.where(Company.user_id == owner_id)
    if company_id is not None:
        stmt = stmt.where(Company.id == company_id)
    return stmt.order_by(DishSync.product_id)


def sync_pending(*, owner_id=None, company_id=None):
    if not current_app.config["DISH_SYNC_ENABLED"]:
        return 0, 0
    records = [
        (r.product_id, r.generation)
        for r in db.session.scalars(pending_query(owner_id, company_id))
    ]
    saved = 0
    store = get_dish_store()
    for product_id, generation in records:
        try:
            snapshot = dish_snapshot(product_id)
            store.save(snapshot, generation)
        except ValueError as exc:
            # Only our sanitized errors reach the UI/queue; raw driver errors are not persisted.
            db.session.rollback()
            db.session.execute(
                db.update(DishSync)
                .where(DishSync.product_id == product_id, DishSync.generation == generation)
                .values(error=str(exc)[:500])
            )
            db.session.commit()
            return saved, len(records) - saved
        db.session.execute(
            db.update(DishSync)
            .where(DishSync.product_id == product_id, DishSync.generation == generation)
            .values(synced_generation=generation, synced_at=utc_now(), error=None)
        )
        db.session.commit()
        saved += 1
    return saved, len(list(db.session.scalars(pending_query(owner_id, company_id))))
