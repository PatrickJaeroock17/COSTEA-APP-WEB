"""Monthly planning inputs and immutable published budgets. JSON decimals are strings."""

from datetime import date
from decimal import Decimal

from sqlalchemy import JSON, Boolean, Date, ForeignKey, Index, String, UniqueConstraint, event, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db
from app.models.base import TimestampMixin
from app.models.material import ExactDecimal, immutable_record


class Employee(TimestampMixin, db.Model):
    __tablename__ = "employees"
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    name: Mapped[str] = mapped_column(String(180))
    role: Mapped[str] = mapped_column(String(180))
    document: Mapped[str | None] = mapped_column(String(40))
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class EmployeePeriodCost(TimestampMixin, db.Model):
    __tablename__ = "employee_period_costs"
    __table_args__ = (UniqueConstraint("employee_id", "period_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"), index=True)
    period_id: Mapped[int] = mapped_column(ForeignKey("periods.id"), index=True)
    data: Mapped[dict] = mapped_column(JSON)
    # Explicit annual benefits, social contribution bases/rates and monthly totals.
    # NULL retains the original aggregate payroll without guessing its composition.
    breakdown: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    employee: Mapped[Employee] = relationship()


class RestaurantLaborProfile(TimestampMixin, db.Model):
    """A restaurant's customization or deletion of one base personnel profile."""

    __tablename__ = "restaurant_labor_profiles"
    __table_args__ = (UniqueConstraint("company_id", "base_scenario_id", "base_worker_code"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    base_scenario_id: Mapped[int] = mapped_column()
    base_worker_code: Mapped[str] = mapped_column(String(20))
    local_worker_code: Mapped[str | None] = mapped_column(String(20))
    local_scenario_id: Mapped[int | None] = mapped_column()
    deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    revision: Mapped[int] = mapped_column(default=1)
    references: Mapped[dict] = mapped_column(JSON, default=dict)


class RecipeWork(TimestampMixin, db.Model):
    __tablename__ = "recipe_work"
    id: Mapped[int] = mapped_column(primary_key=True)
    recipe_id: Mapped[int] = mapped_column(ForeignKey("recipe_versions.id"), unique=True)
    no_materials: Mapped[bool] = mapped_column(Boolean, default=False)
    no_labor: Mapped[bool] = mapped_column(Boolean, default=False)
    operations: Mapped[list] = mapped_column(JSON, default=list)


class CostConcept(TimestampMixin, db.Model):
    __tablename__ = "cost_concepts"
    __table_args__ = (
        Index(
            "uq_cost_reference",
            "company_id",
            "period_id",
            "reference_key",
            unique=True,
            mssql_where=text("reference_key IS NOT NULL"),
            sqlite_where=text("reference_key IS NOT NULL"),
        ),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    period_id: Mapped[int] = mapped_column(ForeignKey("periods.id"), index=True)
    name: Mapped[str] = mapped_column(String(180))
    reference_key: Mapped[str | None] = mapped_column(String(180))
    kind: Mapped[str] = mapped_column(String(12))
    amount: Mapped[Decimal] = mapped_column(ExactDecimal())
    basis: Mapped[str] = mapped_column(String(16))
    behavior: Mapped[str] = mapped_column(String(10))
    justification: Mapped[str] = mapped_column(String(500))
    targets: Mapped[list] = mapped_column(JSON, default=list)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class ProductionPlan(TimestampMixin, db.Model):
    __tablename__ = "production_plans"
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    period_id: Mapped[int] = mapped_column(ForeignKey("periods.id"), index=True)
    name: Mapped[str] = mapped_column(String(180))
    price_date: Mapped[date] = mapped_column(Date)
    no_cif: Mapped[bool] = mapped_column(Boolean, default=False)
    no_expenses: Mapped[bool] = mapped_column(Boolean, default=False)
    active: Mapped[bool] = mapped_column(Boolean, default=False)
    calculation_hash: Mapped[str | None] = mapped_column(String(64))
    lines: Mapped[list["PlanLine"]] = relationship(order_by="PlanLine.id")
    period: Mapped["Period"] = relationship()  # noqa: F821
    company: Mapped["Company"] = relationship()  # noqa: F821


class PlanLine(TimestampMixin, db.Model):
    __tablename__ = "plan_lines"
    __table_args__ = (UniqueConstraint("plan_id", "product_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("production_plans.id"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    recipe_id: Mapped[int] = mapped_column(ForeignKey("recipe_versions.id"))
    quantity: Mapped[Decimal] = mapped_column(ExactDecimal())
    reference_price: Mapped[Decimal] = mapped_column(ExactDecimal())
    equivalent_factor: Mapped[Decimal] = mapped_column(ExactDecimal())
    pricing_mode: Mapped[str] = mapped_column(String(12))
    pricing_value: Mapped[Decimal] = mapped_column(ExactDecimal())
    adopted_price: Mapped[Decimal | None] = mapped_column(ExactDecimal())
    tax_rate: Mapped[Decimal | None] = mapped_column(ExactDecimal())
    recipe: Mapped["RecipeVersion"] = relationship()  # noqa: F821
    product: Mapped["Product"] = relationship()  # noqa: F821


class Budget(TimestampMixin, db.Model):
    __tablename__ = "budgets"
    __table_args__ = (UniqueConstraint("plan_id", "number"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("production_plans.id"), index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    number: Mapped[int] = mapped_column()
    snapshot: Mapped[dict] = mapped_column(JSON)
    fingerprint: Mapped[str] = mapped_column(String(64))


class BudgetArchive(db.Model):
    __tablename__ = "budget_archives"
    budget_id: Mapped[int] = mapped_column(ForeignKey("budgets.id"), primary_key=True)
    archived: Mapped[bool] = mapped_column(Boolean, default=True)


event.listen(Budget, "before_update", immutable_record)
event.listen(Budget, "before_delete", immutable_record)
