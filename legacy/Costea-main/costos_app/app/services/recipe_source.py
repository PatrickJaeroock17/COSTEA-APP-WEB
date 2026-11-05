"""Read-only dish source backed by dbo.platos and dbo.receta_detalles."""

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Protocol

from flask import current_app
from sqlalchemy import text

from app.services.catalog import catalog_connection


@dataclass(frozen=True)
class SourceIngredient:
    insumo_id: int
    quantity: Decimal
    unit_code: str
    loss: Decimal
    factor_to_base: Decimal | None = None


@dataclass(frozen=True)
class SourceDish:
    key: str
    version: str
    name: str
    portions: Decimal
    ingredients: tuple[SourceIngredient, ...]


class RecipeSource(Protocol):
    def dishes(self) -> tuple[SourceDish, ...]: ...


def number(value, *, positive=False):
    if isinstance(value, (bool, float)) or len(str(value)) > 30:
        raise ValueError("La fuente debe enviar decimales como cadenas, sin flotantes.")
    try:
        result = Decimal(str(value))
    except InvalidOperation as exc:
        raise ValueError("Número inválido en la fuente de recetas.") from exc
    if not result.is_finite() or result < 0 or result > Decimal("1000000000000"):
        raise ValueError("Número fuera de rango en la fuente de recetas.")
    if positive and result == 0:
        raise ValueError("Las cantidades y porciones deben ser mayores que cero.")
    return result


def label(value, limit):
    if not isinstance(value, str) or not value.strip() or len(value) > limit:
        raise ValueError("Identificador o nombre inválido en la fuente de recetas.")
    return value.strip()


def parse_dishes(data):
    if (
        not isinstance(data, dict)
        or data.get("schema_version") != 1
        or not isinstance(data.get("dishes"), list)
    ):
        raise ValueError("La fuente requiere schema_version=1 y una lista dishes.")
    result, keys = [], set()
    for raw in data["dishes"]:
        key = label(raw["id"], 180)
        if key in keys:
            raise ValueError("La fuente contiene identificadores de platos duplicados.")
        keys.add(key)
        ingredients, ids = [], set()
        if not isinstance(raw["ingredients"], list) or not raw["ingredients"]:
            raise ValueError("Cada receta de origen debe contener ingredientes.")
        for row in raw["ingredients"]:
            ident = row["insumo_id"]
            if type(ident) is not int or ident <= 0 or ident in ids:
                raise ValueError("Insumo inválido o duplicado en una receta de origen.")
            ids.add(ident)
            loss = number(row.get("loss_percent", "0")) / 100
            if loss >= 1:
                raise ValueError("La merma debe ser menor que 100 %.")
            ingredients.append(
                SourceIngredient(
                    ident,
                    number(row["quantity"], positive=True),
                    label(row["unit_code"], 16),
                    loss,
                    number(row["factor_to_base"], positive=True)
                    if "factor_to_base" in row
                    else None,
                )
            )
        result.append(
            SourceDish(
                key,
                label(raw["version"], 80),
                label(raw["name"], 180),
                number(raw["portions"], positive=True),
                tuple(ingredients),
            )
        )
    return tuple(result)


class SQLServerRecipeSource:
    def dishes(self):
        statement = text(
            """SELECT p.id_plato, p.version_receta, p.nombre, p.porciones,
                      d.id_insumo, d.cantidad, d.unidad_receta,
                      d.factor_a_unidad_base, d.merma_pct
               FROM dbo.platos AS p
               JOIN dbo.receta_detalles AS d ON d.id_plato = p.id_plato
               WHERE p.id_instalacion = N'CATALOGO-BASE' AND p.activo = 1
               ORDER BY p.nombre, p.id_plato, d.orden, d.id_receta_detalle"""
        )
        dishes: dict[int, dict] = {}
        with catalog_connection() as connection:
            for row in connection.execute(statement).mappings():
                dish = dishes.setdefault(
                    row["id_plato"],
                    {
                        "key": f"sqlserver:{row['id_plato']}",
                        "version": str(row["version_receta"]),
                        "name": row["nombre"],
                        "portions": row["porciones"],
                        "ingredients": [],
                    },
                )
                unit_code = "unit" if row["unidad_receta"] == "unid" else row["unidad_receta"]
                dish["ingredients"].append(
                    SourceIngredient(
                        row["id_insumo"],
                        number(row["cantidad"], positive=True),
                        label(unit_code, 16),
                        number(row["merma_pct"]) / 100,
                        number(row["factor_a_unidad_base"], positive=True),
                    )
                )
        return tuple(
            SourceDish(
                item["key"],
                item["version"],
                label(item["name"], 180),
                number(item["portions"], positive=True),
                tuple(item["ingredients"]),
            )
            for item in dishes.values()
        )


def get_recipe_source() -> RecipeSource:
    return current_app.extensions.get("recipe_provider") or SQLServerRecipeSource()
