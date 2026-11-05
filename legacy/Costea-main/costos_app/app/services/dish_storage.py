"""Persist dishes and their current normalized recipe in SQL Server."""

import json
import re
from decimal import Decimal
from pathlib import Path
from uuid import UUID

from flask import current_app
from sqlalchemy import text

from app.services.catalog import catalog_connection


def installation_id():
    try:
        return str(UUID(current_app.config["APP_INSTANCE_ID"]))
    except (ValueError, KeyError, TypeError) as exc:
        raise ValueError("Falta APP_INSTANCE_ID. Ejecuta scripts/prepare_local.py.") from exc


class SQLServerDishStore:
    def delete(self, *, company_id, product_id, owner_id, connection):
        """Remove this owner's projection in the caller's SQL Server transaction."""
        if connection.execute(text("SELECT OBJECT_ID(N'dbo.platos', N'U')")).scalar() is None:
            return
        params = dict(installation=installation_id(), company=company_id, product=product_id)
        key = "id_instalacion=:installation AND id_restaurante=:company AND id_plato_local=:product"
        row = connection.execute(
            text("SELECT id_plato,id_usuario FROM dbo.platos WITH (UPDLOCK,HOLDLOCK) WHERE " + key),
            params,
        ).first()
        if row is None:
            return
        if row.id_usuario != owner_id:
            raise ValueError("El plato de SQL Server pertenece a otro propietario.")
        connection.execute(
            text("DELETE FROM dbo.receta_detalles WHERE id_plato=:dish"), {"dish": row.id_plato}
        )
        connection.execute(text("DELETE FROM dbo.platos WHERE " + key), params)

    def initialize(self):
        script = Path(current_app.root_path).parents[1] / "cevicheria_costos_completo.sql"
        source = script.read_text(encoding="utf-8-sig")
        start = source.index("-- 2. PLATOS")
        end = source.index("-- 4. VISTAS", start)
        batches = [
            batch.strip()
            for batch in re.split(r"(?im)^\s*GO\s*$", source[start:end])
            if batch.strip()
        ]
        with catalog_connection(write=True) as connection:
            for batch in batches:
                connection.exec_driver_sql(batch)

    def save(self, snapshot, generation):
        current = snapshot["recetas"][-1]
        params = dict(
            installation=installation_id(),
            company=snapshot["id_restaurante"],
            owner=snapshot["id_usuario"],
            product=snapshot["id_plato_local"],
            name=snapshot["nombre"],
            description=snapshot["descripcion"],
            currency=snapshot["moneda"],
            portions=current["porciones"],
            unit=current["unidad_produccion"],
            revision=current["version"],
            active=snapshot["activo"],
            generation=generation,
            price=snapshot["precio_venta_con_igv"],
            specs=json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")),
        )
        key = "id_instalacion=:installation AND id_restaurante=:company AND id_plato_local=:product"
        with catalog_connection(write=True) as connection:
            # Range lock on the unique origin key makes simultaneous retries idempotent.
            row = connection.execute(
                text(
                    "SELECT id_plato, id_usuario, generacion FROM dbo.platos "
                    "WITH (UPDLOCK, HOLDLOCK) WHERE "
                    + key
                ),
                params,
            ).first()
            if row is not None:
                if row.id_usuario != params["owner"]:
                    raise ValueError("El plato de SQL Server pertenece a otro propietario.")
                if row.generacion > generation:
                    raise ValueError(
                        "SQL Server tiene una edición posterior. Revisa el respaldo local antes de sincronizar."
                    )
                connection.execute(
                    text(
                        """UPDATE dbo.platos SET nombre=:name,
                    descripcion=:description, moneda=:currency, porciones=:portions,
                    unidad_produccion=:unit, version_receta=:revision, activo=:active,
                    generacion=:generation, especificaciones=:specs, precio_venta=:price,
                    fecha_actualizacion=SYSUTCDATETIME() WHERE """
                        + key
                    ),
                    params,
                )
                dish_id = row.id_plato
            else:
                dish_id = connection.execute(
                    text("""INSERT INTO dbo.platos
                    (id_instalacion,id_restaurante,id_usuario,id_plato_local,nombre,descripcion,
                    moneda,porciones,unidad_produccion,version_receta,activo,generacion,
                    especificaciones,precio_venta)
                    OUTPUT INSERTED.id_plato
                    VALUES (:installation,:company,:owner,:product,:name,:description,:currency,
                    :portions,:unit,:revision,:active,:generation,:specs,:price)"""),
                    params,
                ).scalar_one()
            self._replace_recipe(connection, dish_id, current["ingredientes"])

    @staticmethod
    def _replace_recipe(connection, dish_id, ingredients):
        """Replace the current normalized recipe; the JSON keeps all historic versions."""
        rows = []
        allowed_units = {"g": "g", "kg": "kg", "ml": "ml", "l": "l", "unit": "unid"}
        for position, ingredient in enumerate(ingredients, 1):
            if ingredient["id_insumo"] is None:
                # User-defined materials have no dbo.insumos foreign key. They remain
                # fully represented in especificaciones without corrupting the catalog.
                continue
            quantity = Decimal(ingredient["cantidad"])
            factor = Decimal(ingredient["factor_conversion"])
            unit_key = ingredient["unidad_clave"]
            unit_code = unit_key.split(":", 1)[1] if unit_key.startswith("unit:") else None
            if unit_code not in allowed_units:
                # Custom consumption units are normalized to the catalog base unit.
                unit_code = ingredient["unidad_precio"]
                quantity *= factor
                factor = Decimal("1")
            if unit_code not in allowed_units:
                continue
            rate = Decimal(ingredient["merma_o_adicional_porcentaje"])
            if ingredient["modo_cantidad"] == "additional":
                quantity *= Decimal("1") + rate / 100
                rate = Decimal("0")
            elif ingredient["modo_cantidad"] != "loss":
                rate = Decimal("0")
            rows.append(
                {
                    "dish": dish_id,
                    "ingredient": ingredient["id_insumo"],
                    "position": position,
                    "quantity": quantity,
                    "unit": allowed_units[unit_code],
                    "factor": factor,
                    "loss": rate,
                    "notes": (ingredient["sustento_conversion"] or "")[:200] or None,
                }
            )
        connection.execute(
            text("DELETE FROM dbo.receta_detalles WHERE id_plato=:dish"), {"dish": dish_id}
        )
        if rows:
            connection.execute(
                text("""INSERT INTO dbo.receta_detalles
                (id_plato,id_insumo,orden,cantidad,unidad_receta,
                 factor_a_unidad_base,merma_pct,notas)
                VALUES (:dish,:ingredient,:position,:quantity,:unit,:factor,:loss,:notes)"""),
                rows,
            )


def get_dish_store():
    return current_app.extensions.get("dish_store") or SQLServerDishStore()
