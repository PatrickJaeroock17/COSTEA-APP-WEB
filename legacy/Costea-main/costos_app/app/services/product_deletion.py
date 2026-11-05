"""Delete an unused dish and its recipes without changing inventory or history."""

from flask import current_app

from app.extensions import db
from app.models import CostConcept, DishSync, PlanLine, Product, ProductPrice, Sale
from app.models.planning import RecipeWork
from app.models.product import RecipeLine, RecipeVersion
from app.services.dish_storage import get_dish_store


def delete_product(product):
    if db.session.scalar(db.select(Sale.id).where(Sale.product_id == product.id).limit(1)):
        raise ValueError("No se puede eliminar este plato porque tiene ventas registradas.")
    if db.session.scalar(db.select(PlanLine.id).where(PlanLine.product_id == product.id).limit(1)):
        raise ValueError("No se puede eliminar este plato porque está incluido en un plan de producción.")
    concepts = db.session.scalars(
        db.select(CostConcept).where(CostConcept.company_id == product.company_id)
    )
    if any(product.id in concept.targets for concept in concepts):
        raise ValueError("No se puede eliminar este plato porque tiene costos o gastos asignados.")

    if db.session.get_bind().dialect.name == "mssql" or current_app.extensions.get("dish_store"):
        get_dish_store().delete(
            company_id=product.company_id,
            product_id=product.id,
            owner_id=product.company.user_id,
            connection=db.session.connection(),
        )

    recipes = db.select(RecipeVersion.id).where(RecipeVersion.product_id == product.id)
    # Explicit removal is allowed only after checking that these snapshots are unused.
    # Bulk deletion bypasses the ORM's protection against editing historical recipes.
    db.session.execute(db.delete(RecipeLine).where(RecipeLine.recipe_id.in_(recipes)))
    db.session.execute(db.delete(RecipeWork).where(RecipeWork.recipe_id.in_(recipes)))
    db.session.execute(db.delete(RecipeVersion).where(RecipeVersion.product_id == product.id))
    db.session.execute(db.delete(ProductPrice).where(ProductPrice.product_id == product.id))
    db.session.execute(db.delete(DishSync).where(DishSync.product_id == product.id))
    db.session.execute(db.delete(Product).where(Product.id == product.id))
