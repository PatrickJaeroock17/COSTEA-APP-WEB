"""Complete, exact-decimal dish specification, independent of the destination."""

from app.extensions import db
from app.models import (
    Material,
    MaterialCostVersion,
    Product,
    ProductPrice,
    RecipeLine,
    RecipeVersion,
)
from app.models.planning import PlanLine, ProductionPlan, RecipeWork
from app.services.materials import version_result
from app.services.planning import evaluate, plain
from app.services.recipes import LineInput, recipe_totals


def dish_snapshot(product_id):
    product = db.session.get(Product, product_id, populate_existing=True)
    if product is None:
        raise ValueError("El plato ya no existe.")
    recipes = []
    for recipe in db.session.scalars(
        db.select(RecipeVersion)
        .where(RecipeVersion.product_id == product_id)
        .order_by(RecipeVersion.number)
    ):
        ingredients, inputs = [], []
        for line in db.session.scalars(
            db.select(RecipeLine)
            .where(RecipeLine.recipe_id == recipe.id)
            .order_by(RecipeLine.position)
        ):
            material = db.session.get(Material, line.material_id, populate_existing=True)
            cost = db.session.get(MaterialCostVersion, line.cost_version_id)
            if material.company_id != product.company_id or cost.material_id != material.id:
                raise ValueError("La receta contiene un insumo ajeno al restaurante.")
            unit_cost = version_result(cost)
            inputs.append(LineInput(line.quantity, line.factor, unit_cost, line.mode, line.rate))
            ingredients.append(
                dict(
                    id_insumo=material.external_insumo_id,
                    id_material_local=material.id,
                    nombre=line.material_name,
                    categoria=material.category,
                    cantidad=line.quantity,
                    unidad_consumo=line.unit_label,
                    unidad_clave=line.unit_key,
                    unidad_precio=material.base_unit_code,
                    factor_conversion=line.factor,
                    sustento_conversion=line.conversion_evidence,
                    modo_cantidad=line.mode,
                    merma_o_adicional_porcentaje=line.rate * 100,
                    precio_unitario=unit_cost,
                    version_precio=cost.id,
                    fecha_precio=cost.effective_on.isoformat(),
                    origen_precio=cost.source,
                    insumo_activo=material.active,
                    precio_especificaciones={
                        k: getattr(cost, k)
                        for k in (
                            "mode",
                            "unit_cost",
                            "quantity",
                            "purchase_unit",
                            "factor",
                            "conversion_evidence",
                            "net_amount",
                            "nonrecoverable_tax",
                            "recoverable_tax",
                            "attributable_cost",
                        )
                    },
                )
            )
        results, total, portion = recipe_totals(inputs, recipe.output_quantity)
        for ingredient, result in zip(ingredients, results, strict=True):
            ingredient.update(
                cantidad_bruta=result.gross_quantity,
                costo=result.amount,
                costo_unidad_utilizable=result.usable_unit_cost,
                rendimiento_porcentaje=result.yield_rate * 100
                if result.yield_rate is not None
                else None,
            )
        work = db.session.scalar(db.select(RecipeWork).where(RecipeWork.recipe_id == recipe.id))
        recipes.append(
            dict(
                id_receta_local=recipe.id,
                version=recipe.number,
                nombre=recipe.product_name,
                autor_id=recipe.author_id,
                creada=recipe.created_at.isoformat(),
                porciones=recipe.output_quantity,
                unidad_produccion=recipe.output_unit_code,
                moneda=recipe.currency,
                ingredientes=ingredients,
                costo_materia_prima=total,
                costo_materia_prima_por_porcion=portion,
                operaciones=work.operations if work else [],
                sin_materia_prima=bool(work and work.no_materials),
                sin_mano_obra=bool(work and work.no_labor),
            )
        )
    if not recipes:
        raise ValueError("Falta la versión de receta del plato.")
    plans = []
    for line in db.session.scalars(db.select(PlanLine).where(PlanLine.product_id == product_id)):
        plan = db.session.get(ProductionPlan, line.plan_id, populate_existing=True)
        if plan.company_id != product.company_id:
            raise ValueError("El plan pertenece a otro restaurante.")
        inputs, result, fingerprint = evaluate(plan)
        row = next(r for r in result["rows"] if r["id"] == line.id)
        plans.append(
            dict(
                id_plan=plan.id,
                nombre=plan.name,
                periodo=plan.period.label,
                receta_id=line.recipe_id,
                cantidad=line.quantity,
                modo_precio=line.pricing_mode,
                objetivo_precio=line.pricing_value,
                planilla=inputs["staff"],
                costos_indirectos=inputs["concepts"],
                precio_adoptado=line.adopted_price,
                resultado=row,
                estado_calculo=result["status"],
                pendientes=result["issues"],
                huella=fingerprint,
            )
        )
    price = db.session.get(ProductPrice, product_id, populate_existing=True)
    return plain(
        dict(
            schema_version=2,
            id_plato_local=product.id,
            id_restaurante=product.company_id,
            id_usuario=product.company.user_id,
            restaurante=product.company.display_name,
            restaurante_activo=product.company.active,
            codigo=product.code,
            nombre=product.name,
            descripcion=product.description,
            moneda=product.company.currency,
            activo=product.active,
            version_actual=product.revision,
            origen_id=product.source_key,
            origen_version=product.source_version,
            precio_venta_con_igv=price.amount if price else None,
            recetas=recipes,
            planes=plans,
        )
    )
