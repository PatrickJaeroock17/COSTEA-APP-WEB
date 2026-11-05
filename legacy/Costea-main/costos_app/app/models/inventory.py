from datetime import date
from decimal import Decimal

from sqlalchemy import Boolean, Date, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.extensions import db
from app.models.base import TimestampMixin
from app.models.material import ExactDecimal


class InventoryMovement(TimestampMixin, db.Model):
    __tablename__ = "inventory_movements"
    __table_args__ = (UniqueConstraint("company_id", "reference", "material_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    material_id: Mapped[int] = mapped_column(ForeignKey("materials.id"), index=True)
    sale_id: Mapped[int | None] = mapped_column(ForeignKey("sales.id"), nullable=True, index=True)
    plan_id: Mapped[int | None] = mapped_column(
        ForeignKey("production_plans.id"), nullable=True, index=True
    )
    movement_on: Mapped[date] = mapped_column(Date)
    kind: Mapped[str] = mapped_column(String(12))
    quantity: Mapped[Decimal] = mapped_column(ExactDecimal())
    unit_cost: Mapped[Decimal] = mapped_column(ExactDecimal())
    reference: Mapped[str] = mapped_column(String(180))
    voided: Mapped[bool] = mapped_column(Boolean, default=False)


class InventoryLock(db.Model):
    __tablename__ = "inventory_locks"
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), primary_key=True)
    revision: Mapped[int] = mapped_column(default=0)
