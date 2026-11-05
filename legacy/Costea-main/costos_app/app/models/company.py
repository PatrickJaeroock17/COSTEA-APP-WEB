"""Company ownership and default settings for future periods."""

from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Index, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db
from app.models.base import TimestampMixin
from app.models.tax import decode_rate, encode_rate


class Company(TimestampMixin, db.Model):
    __tablename__ = "companies"
    __table_args__ = (
        Index(
            "uq_company_owner_tax_id",
            "user_id",
            "tax_id_kind",
            "tax_id",
            unique=True,
            mssql_where=text("tax_id IS NOT NULL"),
            sqlite_where=text("tax_id IS NOT NULL"),
        ),
        CheckConstraint("currency IN ('PEN', 'USD', 'EUR')", name="currency_length"),
        CheckConstraint("default_tax_millionths BETWEEN 0 AND 1000000", name="tax_range"),
        CheckConstraint("tax_id_kind IN ('peru_ruc', 'other')", name="tax_id_kind"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="NO ACTION"), index=True, nullable=False
    )
    industry_id: Mapped[int] = mapped_column(
        ForeignKey("industries.id", ondelete="NO ACTION"), index=True, nullable=False
    )
    legal_name: Mapped[str] = mapped_column(String(180), nullable=False)
    trade_name: Mapped[str | None] = mapped_column(String(180))
    tax_id: Mapped[str | None] = mapped_column(String(20))
    tax_id_kind: Mapped[str] = mapped_column(
        String(12), default="peru_ruc", server_default="other", nullable=False
    )
    currency: Mapped[str] = mapped_column(String(3), default="PEN", nullable=False)
    default_tax_millionths: Mapped[int | None] = mapped_column(Integer)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    owner: Mapped["User"] = relationship(back_populates="companies")  # noqa: F821
    industry: Mapped["Industry"] = relationship(back_populates="companies")  # noqa: F821
    periods: Mapped[list["Period"]] = relationship(back_populates="company")  # noqa: F821
    unit_settings: Mapped[list["CompanyUnit"]] = relationship(back_populates="company")  # noqa: F821

    @property
    def display_name(self) -> str:
        return self.trade_name or self.legal_name

    @property
    def default_tax_rate(self) -> Decimal | None:
        return decode_rate(self.default_tax_millionths)

    @default_tax_rate.setter
    def default_tax_rate(self, value: Decimal | None) -> None:
        self.default_tax_millionths = encode_rate(value)
