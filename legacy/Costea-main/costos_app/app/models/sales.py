"""Persisted selling prices and actual sales with historical recipe and price."""

from datetime import date
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db
from app.models.base import TimestampMixin
from app.models.material import ExactDecimal


class ProductPrice(TimestampMixin, db.Model):
    __tablename__ = "product_prices"
    __table_args__ = (
        CheckConstraint("CAST(amount AS DECIMAL(38,18)) > 0", name="positive_sale_price"),
    )
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), primary_key=True)
    amount: Mapped[Decimal] = mapped_column(ExactDecimal())


class Sale(TimestampMixin, db.Model):
    __tablename__ = "sales"
    __table_args__ = (
        CheckConstraint(
            "CAST(quantity AS DECIMAL(38,18)) > 0", name="positive_sale_quantity"
        ),
        CheckConstraint(
            "CAST(unit_price AS DECIMAL(38,18)) > 0", name="positive_sale_unit_price"
        ),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    recipe_id: Mapped[int] = mapped_column(ForeignKey("recipe_versions.id"))
    sold_on: Mapped[date] = mapped_column(Date, index=True)
    quantity: Mapped[Decimal] = mapped_column(ExactDecimal())
    unit_price: Mapped[Decimal] = mapped_column(ExactDecimal())
    unit_cost: Mapped[Decimal] = mapped_column(ExactDecimal())
    product: Mapped["Product"] = relationship()  # noqa: F821
