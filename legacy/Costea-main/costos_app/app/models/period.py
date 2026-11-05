from decimal import Decimal

from sqlalchemy import CheckConstraint, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db
from app.models.base import TimestampMixin
from app.models.tax import decode_rate, encode_rate

MONTHS = (
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
)


class Period(TimestampMixin, db.Model):
    __tablename__ = "periods"
    __table_args__ = (
        UniqueConstraint("company_id", "year", "month"),
        CheckConstraint("year BETWEEN 1900 AND 9999", name="year_range"),
        CheckConstraint("month BETWEEN 1 AND 12", name="month_range"),
        CheckConstraint("tax_millionths BETWEEN 0 AND 1000000", name="tax_range"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id", ondelete="NO ACTION"), index=True, nullable=False
    )
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    tax_millionths: Mapped[int | None] = mapped_column(Integer)
    company: Mapped["Company"] = relationship(back_populates="periods")  # noqa: F821

    @property
    def label(self) -> str:
        return f"{MONTHS[self.month - 1]} {self.year}"

    @property
    def key(self) -> str:
        return f"{self.year:04d}-{self.month:02d}"

    @property
    def tax_rate(self) -> Decimal | None:
        return decode_rate(self.tax_millionths)

    @tax_rate.setter
    def tax_rate(self, value: Decimal | None) -> None:
        self.tax_millionths = encode_rate(value)
