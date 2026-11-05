"""Source-unit preferences and the durable SQL Server dish-projection queue."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.extensions import db


class CatalogUnitSelection(db.Model):
    __tablename__ = "catalog_unit_selections"
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), primary_key=True)
    source_unit_id: Mapped[int] = mapped_column(primary_key=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)


class DishSync(db.Model):
    __tablename__ = "dish_sync"
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), primary_key=True)
    generation: Mapped[int] = mapped_column(Integer, default=1)
    synced_generation: Mapped[int] = mapped_column(Integer, default=0)
    synced_at: Mapped[datetime | None] = mapped_column(DateTime)
    error: Mapped[str | None] = mapped_column(String(500))
