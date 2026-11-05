"""Shared immutable unit definitions, selected independently by each company."""

from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db


class Unit(db.Model):
    __tablename__ = "units"
    __table_args__ = (CheckConstraint("numerator > 0 AND denominator > 0", name="positive_factor"),)

    code: Mapped[str] = mapped_column(String(16), primary_key=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    symbol: Mapped[str] = mapped_column(String(10), nullable=False)
    dimension: Mapped[str] = mapped_column(String(20), nullable=False)
    numerator: Mapped[int] = mapped_column(nullable=False)
    denominator: Mapped[int] = mapped_column(nullable=False)

    @property
    def factor_to_base(self) -> Decimal:
        return Decimal(self.numerator) / Decimal(self.denominator)


class CompanyUnit(db.Model):
    __tablename__ = "company_units"

    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id", ondelete="NO ACTION"), primary_key=True
    )
    unit_code: Mapped[str] = mapped_column(
        ForeignKey("units.code", ondelete="NO ACTION"), primary_key=True
    )
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    company: Mapped["Company"] = relationship(back_populates="unit_settings")  # noqa: F821
    unit: Mapped[Unit] = relationship()
