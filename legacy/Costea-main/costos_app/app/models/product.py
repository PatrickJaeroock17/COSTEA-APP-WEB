"""Shared products and append-only recipe snapshots, including material prices."""

from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    event,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db
from app.models.base import TimestampMixin
from app.models.material import ExactDecimal, immutable_record


class Product(TimestampMixin, db.Model):
    __tablename__ = "products"
    __table_args__ = (
        UniqueConstraint("company_id", "code", name="uq_product_company_code"),
        Index(
            "uq_product_source",
            "company_id",
            "source_key",
            unique=True,
            mssql_where=text("source_key IS NOT NULL"),
            sqlite_where=text("source_key IS NOT NULL"),
        ),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id", ondelete="NO ACTION"), index=True
    )
    code: Mapped[str] = mapped_column(String(40))
    name: Mapped[str] = mapped_column(String(180))
    description: Mapped[str | None] = mapped_column(String(500))
    source_key: Mapped[str | None] = mapped_column(String(180))
    source_version: Mapped[str | None] = mapped_column(String(80))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    revision: Mapped[int] = mapped_column(Integer, default=1)
    company: Mapped["Company"] = relationship()  # noqa: F821
    recipes: Mapped[list["RecipeVersion"]] = relationship(order_by="RecipeVersion.number")


class RecipeVersion(TimestampMixin, db.Model):
    __tablename__ = "recipe_versions"
    __table_args__ = (
        UniqueConstraint("product_id", "number", name="uq_recipe_product_number"),
        CheckConstraint(
            "CAST(output_quantity AS DECIMAL(38,18)) > 0", name="positive_recipe_output"
        ),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="NO ACTION"), index=True
    )
    number: Mapped[int] = mapped_column(Integer)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="NO ACTION"))
    output_quantity: Mapped[Decimal] = mapped_column(ExactDecimal())
    output_unit_code: Mapped[str] = mapped_column(ForeignKey("units.code", ondelete="NO ACTION"))
    currency: Mapped[str] = mapped_column(String(3))
    product_name: Mapped[str] = mapped_column(String(180))
    output_unit: Mapped["Unit"] = relationship()  # noqa: F821
    lines: Mapped[list["RecipeLine"]] = relationship(order_by="RecipeLine.position")


class RecipeLine(db.Model):
    __tablename__ = "recipe_lines"
    __table_args__ = (
        UniqueConstraint("recipe_id", "position", name="uq_recipe_line_position"),
        UniqueConstraint("recipe_id", "material_id", name="uq_recipe_line_material"),
        CheckConstraint(
            "CAST(quantity AS DECIMAL(38,18)) > 0 AND "
            "CAST(factor AS DECIMAL(38,18)) > 0",
            name="positive_recipe_inputs",
        ),
        CheckConstraint("mode IN ('gross', 'loss', 'additional')", name="recipe_quantity_mode"),
        CheckConstraint(
            "CAST(rate AS DECIMAL(38,18)) >= 0 AND "
            "(mode != 'loss' OR CAST(rate AS DECIMAL(38,18)) < 1) AND "
            "(mode != 'gross' OR CAST(rate AS DECIMAL(38,18)) = 0)",
            name="recipe_rate_range",
        ),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    recipe_id: Mapped[int] = mapped_column(
        ForeignKey("recipe_versions.id", ondelete="NO ACTION"), index=True
    )
    position: Mapped[int] = mapped_column(Integer)
    material_id: Mapped[int] = mapped_column(ForeignKey("materials.id", ondelete="NO ACTION"))
    cost_version_id: Mapped[int] = mapped_column(
        ForeignKey("material_cost_versions.id", ondelete="NO ACTION")
    )
    material_name: Mapped[str] = mapped_column(String(180))
    quantity: Mapped[Decimal] = mapped_column(ExactDecimal())
    unit_key: Mapped[str] = mapped_column(String(40))
    unit_label: Mapped[str] = mapped_column(String(80))
    factor: Mapped[Decimal] = mapped_column(ExactDecimal())
    conversion_evidence: Mapped[str] = mapped_column(String(500))
    mode: Mapped[str] = mapped_column(String(12))
    rate: Mapped[Decimal] = mapped_column(ExactDecimal())
    material: Mapped["Material"] = relationship()  # noqa: F821
    cost_version: Mapped["MaterialCostVersion"] = relationship()  # noqa: F821


for record_type in (RecipeVersion, RecipeLine):
    event.listen(record_type, "before_update", immutable_record)
    event.listen(record_type, "before_delete", immutable_record)
