"""Copy approved source ingredients into a restaurant-owned version, atomically."""

from datetime import date
from decimal import Decimal
from uuid import uuid4

from app.extensions import db
from app.models import Product, RecipeLine, RecipeVersion, Unit
from app.services.catalog import get_catalog
from app.services.catalog_selection import select_ingredient
from app.services.inventory import lock_inventory, recipe_quantities, require_stock
from app.services.units import convert_quantity


def personalize(company, author_id, dish):
    lock_inventory(company.id)
    existing = db.session.scalar(
        db.select(Product).where(
            Product.company_id == company.id,
            Product.source_key == dish.key,
        )
    )
    if existing:
        raise ValueError(
            "Ya personalizaste este plato. Abre tu receta existente, incluso si está archivada."
        )
    product = Product(
        company_id=company.id,
        code="P-" + uuid4().hex[:12].upper(),
        name=dish.name,
        source_key=dish.key,
        source_version=dish.version,
    )
    db.session.add(product)
    db.session.flush()
    recipe = RecipeVersion(
        product_id=product.id,
        number=1,
        author_id=author_id,
        output_quantity=dish.portions,
        output_unit_code="unit",
        currency=company.currency,
        product_name=product.name,
    )
    db.session.add(recipe)
    db.session.flush()
    catalog = get_catalog()
    for pos, row in enumerate(dish.ingredients, 1):
        material, cost = select_ingredient(company, author_id, catalog.get(row.insumo_id))
        unit = db.session.get(Unit, row.unit_code)
        if unit is None:
            raise ValueError("La receta usa una unidad de consumo sin equivalencia configurada.")
        if row.factor_to_base is None:
            factor = convert_quantity(Decimal("1"), unit, material.base_unit)
            evidence = "Equivalencia física de la receta de origen."
        else:
            factor = row.factor_to_base
            evidence = "Factor explícito de receta_detalles en SQL Server."
        db.session.add(
            RecipeLine(
                recipe_id=recipe.id,
                position=pos,
                material_id=material.id,
                cost_version_id=cost.id,
                material_name=material.display_name,
                quantity=row.quantity,
                unit_key=f"unit:{unit.code}",
                unit_label=unit.symbol,
                factor=factor,
                conversion_evidence=evidence,
                mode="loss" if row.loss else "gross",
                rate=row.loss,
            )
        )
    db.session.flush()
    require_stock(company.id, recipe_quantities(recipe, recipe.output_quantity), date.today())
    return product
