"""Catalog access through the application's single SQL Server engine."""

import re
from contextlib import contextmanager

from flask import current_app
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.extensions import db
from app.services.material_identity import category_prefix

COMMERCIAL_CODE_PATTERN = re.compile(r"^[A-Z]{3}-[0-9]{3}$")


class CatalogUnavailable(ValueError):
    pass


def catalog_commercial_code(item) -> str:
    """Return the catalog-owned business key; tests may emulate legacy fixtures."""
    code = str(item.get("codigo_comercial") or "").strip().upper()
    if COMMERCIAL_CODE_PATTERN.fullmatch(code):
        return code
    if current_app.testing:
        sequence = int(item["id_insumo"])
        if 0 < sequence <= 999:
            return f"{category_prefix(item.get('categoria') or '')}-{sequence:03d}"
    raise CatalogUnavailable(
        "El Catálogo General no tiene un ID comercial válido. Aplica la migración pendiente."
    )


@contextmanager
def catalog_connection(*, write=False):
    try:
        engine = db.engine
        if engine.dialect.name != "mssql":
            raise CatalogUnavailable("El catálogo requiere la conexión principal de SQL Server.")
        with engine.begin() if write else engine.connect() as connection:
            yield connection
    except (SQLAlchemyError, ImportError) as exc:
        # Driver errors can contain hosts or credentials: never expose them in the UI.
        raise CatalogUnavailable(
            "No se pudo consultar SQL Server. Revisa la conexión, el controlador ODBC "
            "y los permisos de Costea_Cevicheria."
        ) from exc


class SQLServerCatalog:
    def categories(self):
        with catalog_connection() as conn:
            return [
                dict(r)
                for r in conn.execute(
                    text("SELECT id_categoria, nombre FROM dbo.categorias ORDER BY nombre")
                ).mappings()
            ]

    def units(self):
        with catalog_connection() as conn:
            return [
                dict(r)
                for r in conn.execute(
                    text(
                        "SELECT id_unidad, codigo, descripcion FROM dbo.unidades_medida ORDER BY codigo"
                    )
                ).mappings()
            ]

    def ingredients(self, *, category=None, unit=None, ingredient_id=None, active=True):
        sql = """SELECT i.id_insumo, i.codigo_comercial, i.nombre, i.variedad,
                    i.id_categoria, i.id_unidad,
                    i.precio_mayorista, i.fecha_actualizacion, i.stock_inicial, i.activo,
                    c.nombre AS categoria, u.codigo AS unidad, u.descripcion AS unidad_nombre
                 FROM dbo.insumos i
                 LEFT JOIN dbo.categorias c ON c.id_categoria=i.id_categoria
                 JOIN dbo.unidades_medida u ON u.id_unidad=i.id_unidad WHERE 1=1"""
        params = {}
        if active:
            sql += " AND i.activo=1"
        for column, value in (
            ("id_categoria", category),
            ("id_unidad", unit),
            ("id_insumo", ingredient_id),
        ):
            if value is not None:
                sql += f" AND i.{column}=:{column}"
                params[column] = value
        with catalog_connection() as conn:
            return [
                dict(r)
                for r in conn.execute(
                    text(sql + " ORDER BY i.nombre, i.variedad, i.id_insumo"), params
                ).mappings()
            ]

    def get(self, ingredient_id):
        rows = self.ingredients(ingredient_id=ingredient_id)
        if not rows:
            raise ValueError("El insumo no existe o está inactivo en SQL Server.")
        return rows[0]


def get_catalog():
    return current_app.extensions.get("catalog_provider") or SQLServerCatalog()
