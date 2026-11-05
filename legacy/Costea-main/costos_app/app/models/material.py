"""Material catalogue and append-only reference-cost inputs.

Decimals use canonical text, avoiding SQLite's binary floating-point conversion.
Arithmetic belongs in services; SQL must not sum these text columns.
"""

import re
from datetime import date
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
    event,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates
from sqlalchemy.types import TypeDecorator

from app.extensions import db
from app.models.base import TimestampMixin


class ExactDecimal(TypeDecorator):
    impl = String(80)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if not isinstance(value, Decimal) or not value.is_finite() or value < 0:
            raise ValueError("Se requiere un Decimal finito no negativo.")
        result = format(value, "f")
        if len(result) > 80:
            raise ValueError("Decimal demasiado extenso.")
        return result

    def process_result_value(self, value, dialect):
        return Decimal(value) if value is not None else None


class Material(TimestampMixin, db.Model):
    __tablename__ = "materials"
    __table_args__ = (
        UniqueConstraint("company_id", "code", name="uq_material_company_code"),
        Index(
            "uq_material_external",
            "company_id",
            "external_insumo_id",
            unique=True,
            mssql_where=text("external_insumo_id IS NOT NULL"),
            sqlite_where=text("external_insumo_id IS NOT NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id", ondelete="NO ACTION"), index=True
    )
    # Catalog-backed rows copy dbo.insumos.codigo_comercial verbatim. Private
    # rows use the same format but are allocated outside the catalog namespace.
    code: Mapped[str] = mapped_column(String(7))
    external_insumo_id: Mapped[int | None] = mapped_column()
    # dbo.insumos allows 100 characters for both name and variety. Catalog-backed
    # materials join both values with a separator, so 220 preserves the source
    # without silently truncating it. Categories mirror dbo.categorias.nombre.
    name: Mapped[str] = mapped_column(String(220))
    variety: Mapped[str | None] = mapped_column(String(100))
    category: Mapped[str] = mapped_column(String(100))
    supplier: Mapped[str | None] = mapped_column(String(180))
    base_unit_code: Mapped[str] = mapped_column(ForeignKey("units.code", ondelete="NO ACTION"))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    company: Mapped["Company"] = relationship()  # noqa: F821
    base_unit: Mapped["Unit"] = relationship()  # noqa: F821
    costs: Mapped[list["MaterialCostVersion"]] = relationship(
        order_by="MaterialCostVersion.effective_on.desc(), MaterialCostVersion.id.desc()"
    )
    conversions: Mapped[list["MaterialConversion"]] = relationship(
        order_by="MaterialConversion.label"
    )

    @property
    def display_name(self) -> str:
        return " · ".join(filter(None, (self.name, self.variety)))

    @property
    def inventory_label(self) -> str:
        return f"{self.name} - {self.variety}" if self.variety else self.name

    @property
    def catalog_sourced(self) -> bool:
        return self.external_insumo_id is not None

    @validates("code")
    def validate_code(self, key, value):
        if not re.fullmatch(r"[A-Z]{3}-\d{3}", value or ""):
            raise ValueError("El código debe usar exactamente el formato AAA-000.")
        return value


class MaterialConversion(TimestampMixin, db.Model):
    __tablename__ = "material_conversions"
    __table_args__ = (
        UniqueConstraint("material_id", "label", name="uq_material_conversion_label"),
        CheckConstraint("CAST(factor AS DECIMAL(38,18)) > 0", name="positive_conversion"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    material_id: Mapped[int] = mapped_column(
        ForeignKey("materials.id", ondelete="NO ACTION"), index=True
    )
    label: Mapped[str] = mapped_column(String(80))
    factor: Mapped[Decimal] = mapped_column(ExactDecimal())
    evidence: Mapped[str] = mapped_column(String(500))


class MaterialCostVersion(TimestampMixin, db.Model):
    __tablename__ = "material_cost_versions"
    __table_args__ = (
        CheckConstraint("mode IN ('direct', 'purchase')", name="cost_mode"),
        CheckConstraint(
            "(mode = 'direct' AND unit_cost IS NOT NULL AND quantity IS NULL AND factor IS NULL AND net_amount IS NULL AND nonrecoverable_tax IS NULL AND recoverable_tax IS NULL AND attributable_cost IS NULL) OR (mode = 'purchase' AND unit_cost IS NULL AND quantity IS NOT NULL AND factor IS NOT NULL AND net_amount IS NOT NULL AND nonrecoverable_tax IS NOT NULL AND recoverable_tax IS NOT NULL AND attributable_cost IS NOT NULL AND purchase_unit IS NOT NULL)",
            name="exclusive_cost_inputs",
        ),
        CheckConstraint(
            "quantity IS NULL OR CAST(quantity AS DECIMAL(38,18)) > 0",
            name="positive_purchase_quantity",
        ),
        CheckConstraint(
            "factor IS NULL OR CAST(factor AS DECIMAL(38,18)) > 0",
            name="positive_purchase_factor",
        ),
        CheckConstraint(
            "(unit_cost IS NULL OR CAST(unit_cost AS DECIMAL(38,18)) >= 0) AND "
            "(net_amount IS NULL OR CAST(net_amount AS DECIMAL(38,18)) >= 0) AND "
            "(nonrecoverable_tax IS NULL OR CAST(nonrecoverable_tax AS DECIMAL(38,18)) >= 0) AND "
            "(recoverable_tax IS NULL OR CAST(recoverable_tax AS DECIMAL(38,18)) >= 0) AND "
            "(attributable_cost IS NULL OR CAST(attributable_cost AS DECIMAL(38,18)) >= 0)",
            name="nonnegative_costs",
        ),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    material_id: Mapped[int] = mapped_column(
        ForeignKey("materials.id", ondelete="NO ACTION"), index=True
    )
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="NO ACTION"))
    effective_on: Mapped[date] = mapped_column(Date, index=True)
    mode: Mapped[str] = mapped_column(String(10))
    source: Mapped[str] = mapped_column(String(500))
    currency: Mapped[str] = mapped_column(String(3))
    unit_cost: Mapped[Decimal | None] = mapped_column(ExactDecimal())
    quantity: Mapped[Decimal | None] = mapped_column(ExactDecimal())
    purchase_unit: Mapped[str | None] = mapped_column(String(80))
    factor: Mapped[Decimal | None] = mapped_column(ExactDecimal())
    conversion_evidence: Mapped[str | None] = mapped_column(String(500))
    net_amount: Mapped[Decimal | None] = mapped_column(ExactDecimal())
    nonrecoverable_tax: Mapped[Decimal | None] = mapped_column(ExactDecimal())
    recoverable_tax: Mapped[Decimal | None] = mapped_column(ExactDecimal())
    attributable_cost: Mapped[Decimal | None] = mapped_column(ExactDecimal())


def immutable_record(mapper, connection, target):
    raise ValueError("El historial es inmutable. Registra una nueva versión o equivalencia.")


for record_type in (MaterialCostVersion, MaterialConversion):
    event.listen(record_type, "before_update", immutable_record)
    event.listen(record_type, "before_delete", immutable_record)
