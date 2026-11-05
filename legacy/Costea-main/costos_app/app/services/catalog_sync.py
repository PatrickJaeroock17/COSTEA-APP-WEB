"""Apply SQL catalog prices and opening receipts to restaurant workspaces."""

from copy import deepcopy
from datetime import date

from flask import current_app
from sqlalchemy import text, true

from app.extensions import db
from app.models import Company, Industry, Material, Product, RecipeLine, RecipeVersion
from app.models.planning import Budget, PlanLine, ProductionPlan, RecipeWork
from app.services.catalog import get_catalog
from app.services.catalog_selection import select_ingredient
from app.services.inventory import lock_inventory
from app.services.materials import version_result
from app.services.opening_stock import OPENING_REFERENCES, register_opening_stock

LINE_FIELDS = (
    "material_id",
    "cost_version_id",
    "material_name",
    "quantity",
    "unit_key",
    "unit_label",
    "factor",
    "conversion_evidence",
    "mode",
    "rate",
)


def catalog_available():
    return db.engine.dialect.name == "mssql" or hasattr(
        current_app.extensions.get("catalog_provider"), "ingredients"
    )


def refresh_recipe_prices(company, costs):
    """Create current recipe versions for SQL prices; keep manual price overrides."""
    changed = 0
    for product in db.session.scalars(
        db.select(Product).where(Product.company_id == company.id, Product.active == true())
    ):
        if not product.recipes:
            continue
        previous = product.recipes[-1]
        replacements = {}
        for line in previous.lines:
            cost = costs.get(line.material_id)
            if (
                cost is not None
                and cost.effective_on <= date.today()
                and line.cost_version.source.startswith("SQL Server ·")
                and version_result(line.cost_version) != version_result(cost)
            ):
                replacements[line.id] = cost.id
        if not replacements:
            continue
        old_revision = product.revision
        result = db.session.execute(
            db.update(Product)
            .where(Product.id == product.id, Product.revision == old_revision)
            .values(revision=old_revision + 1)
        )
        if result.rowcount != 1:
            raise ValueError(
                "La receta cambió durante la actualización del catálogo; vuelve a intentar."
            )
        version = RecipeVersion(
            product_id=product.id,
            number=old_revision + 1,
            author_id=company.user_id,
            output_quantity=previous.output_quantity,
            output_unit_code=previous.output_unit_code,
            currency=previous.currency,
            product_name=product.name,
        )
        db.session.add(version)
        db.session.flush()
        for line in previous.lines:
            data = {key: getattr(line, key) for key in LINE_FIELDS}
            data["cost_version_id"] = replacements.get(line.id, line.cost_version_id)
            db.session.add(RecipeLine(recipe_id=version.id, position=line.position, **data))
        work = db.session.scalar(db.select(RecipeWork).where(RecipeWork.recipe_id == previous.id))
        if work:
            db.session.add(
                RecipeWork(
                    recipe_id=version.id,
                    no_materials=work.no_materials,
                    no_labor=work.no_labor,
                    operations=deepcopy(work.operations),
                )
            )
        # Only unpublished plans following this recipe advance to the new price.
        # Published budgets and sale recipe references retain their snapshots.
        plan_lines = db.session.scalars(
            db.select(PlanLine)
            .join(ProductionPlan)
            .where(
                ProductionPlan.company_id == company.id,
                PlanLine.recipe_id == previous.id,
                ~db.exists().where(Budget.plan_id == ProductionPlan.id),
            )
        )
        for plan_line in plan_lines:
            plan_line.recipe_id = version.id
            db.session.get(ProductionPlan, plan_line.plan_id).calculation_hash = None
        db.session.flush()
        db.session.expire(product, ["recipes"])
        changed += 1
    return changed


def sync_restaurant_catalog(company, catalog_rows=None):
    if company.industry.slug != "restaurantes" or company.currency != "PEN":
        return {"opening_receipts": 0, "recipes": 0}
    lock_inventory(company.id)
    rows = get_catalog().ingredients() if catalog_rows is None else catalog_rows
    by_id = {row["id_insumo"]: row for row in rows}
    costs = {}
    selected = list(
        db.session.scalars(
            db.select(Material).where(Material.company_id == company.id, Material.active == true())
        )
    )
    for material in selected:
        item = by_id.get(material.external_insumo_id)
        if item is not None:
            _, costs[material.id] = select_ingredient(company, company.user_id, item)
    receipts = register_opening_stock(company, catalog_rows=rows)
    recipes = refresh_recipe_prices(company, costs)
    return {"opening_receipts": receipts, "recipes": recipes}


def sync_all_restaurants():
    """Run on App Service startup. Each restaurant is applied atomically."""
    rows = get_catalog().ingredients()
    company_ids = list(
        db.session.scalars(
            db.select(Company.id)
            .join(Industry)
            .where(Industry.slug == "restaurantes", Company.currency == "PEN")
            .order_by(Company.id)
        )
    )
    totals = {"restaurants": 0, "opening_receipts": 0, "recipes": 0}
    for company_id in company_ids:
        try:
            result = sync_restaurant_catalog(db.session.get(Company, company_id), rows)
            db.session.commit()
        except Exception:
            db.session.rollback()
            raise
        totals["restaurants"] += 1
        totals["opening_receipts"] += result["opening_receipts"]
        totals["recipes"] += result["recipes"]
    return totals


def opening_sync_complete():
    """Readiness gate: every positive SQL opening has a restaurant receipt."""
    missing = db.session.scalar(
        text(
            "SELECT TOP (1) c.id FROM dbo.companies c "
            "JOIN dbo.industries s ON s.id=c.industry_id "
            "CROSS JOIN dbo.insumos i "
            "WHERE s.slug=N'restaurantes' AND c.currency='PEN' "
            "AND i.activo=1 AND i.stock_inicial>0 "
            "AND NOT EXISTS (SELECT 1 FROM dbo.materials m "
            "JOIN dbo.inventory_movements v ON v.material_id=m.id AND v.company_id=c.id "
            "WHERE m.company_id=c.id AND m.external_insumo_id=i.id_insumo "
            "AND v.reference IN (:current_reference,:legacy_reference))"
        ),
        {"current_reference": OPENING_REFERENCES[0], "legacy_reference": OPENING_REFERENCES[1]},
    )
    return missing is None
