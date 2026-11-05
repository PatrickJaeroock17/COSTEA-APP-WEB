"""Make dbo.insumos the source of truth for commercial material codes."""

import re
import unicodedata

import sqlalchemy as sa
from alembic import op

revision = "f20261001010"
down_revision = "e20261001009"
branch_labels = None
depends_on = None

_IGNORED_WORDS = {"DE", "DEL", "EL", "LA", "LAS", "LOS", "Y"}
_CODE_PATTERN = re.compile(r"^[A-Z]{3}-[0-9]{3}$")


def _prefix(category):
    plain = unicodedata.normalize("NFKD", category or "").encode("ascii", "ignore").decode()
    words = [
        word
        for word in re.findall(r"[A-Z0-9]+", plain.upper())
        if word not in _IGNORED_WORDS
    ]
    if not words:
        return "INS"
    value = words[0][:3]
    if len(value) < 3:
        value += "".join(words[1:])[: 3 - len(value)]
    return value.ljust(3, "X")


def _drop_constraint(connection, table, name):
    connection.execute(
        sa.text(
            f"IF EXISTS (SELECT 1 FROM sys.objects WHERE name=N'{name}' "
            f"AND parent_object_id=OBJECT_ID(N'dbo.{table}')) "
            f"ALTER TABLE dbo.{table} DROP CONSTRAINT {name}"
        )
    )


def _catalog_assignments(connection):
    rows = list(
        connection.execute(
            sa.text(
                "SELECT i.id_insumo, c.nombre AS categoria "
                "FROM dbo.insumos i "
                "LEFT JOIN dbo.categorias c ON c.id_categoria=i.id_categoria "
                "ORDER BY i.id_insumo"
            )
        ).mappings()
    )
    sequences = {}
    assignments = {}
    for row in rows:
        prefix = _prefix(row["categoria"])
        sequences[prefix] = sequences.get(prefix, 0) + 1
        if sequences[prefix] > 999:
            raise RuntimeError(f"El catálogo supera 999 insumos con el prefijo {prefix}.")
        assignments[row["id_insumo"]] = f"{prefix}-{sequences[prefix]:03d}"
    return assignments


def _next_private_code(category, reserved, used):
    prefix = _prefix(category)
    matches = [
        int(code[-3:])
        for code in reserved | used
        if code.startswith(f"{prefix}-") and _CODE_PATTERN.fullmatch(code)
    ]
    sequence = max(matches, default=0) + 1
    if sequence > 999:
        raise RuntimeError(f"No quedan códigos privados disponibles para {prefix}.")
    return f"{prefix}-{sequence:03d}"


def _sync_local_materials(connection, catalog_codes):
    if not connection.scalar(sa.text("SELECT OBJECT_ID(N'dbo.materials', N'U')")):
        return
    rows = list(
        connection.execute(
            sa.text(
                "SELECT id, company_id, code, external_insumo_id, category "
                "FROM dbo.materials ORDER BY company_id, id"
            )
        ).mappings()
    )
    reserved = set(catalog_codes.values())
    assignments = {}
    for company_id in sorted({row["company_id"] for row in rows}):
        company_rows = [row for row in rows if row["company_id"] == company_id]
        used = {
            catalog_codes[row["external_insumo_id"]]
            for row in company_rows
            if row["external_insumo_id"] is not None
            and row["external_insumo_id"] in catalog_codes
        }
        for row in company_rows:
            external_id = row["external_insumo_id"]
            if external_id is not None:
                if external_id not in catalog_codes:
                    raise RuntimeError(
                        f"El material {row['id']} referencia el insumo inexistente {external_id}."
                    )
                assignments[row["id"]] = catalog_codes[external_id]
                continue
            old_code = str(row["code"] or "").upper()
            if (
                _CODE_PATTERN.fullmatch(old_code)
                and old_code not in reserved
                and old_code not in used
            ):
                code = old_code
            else:
                code = _next_private_code(row["category"], reserved, used)
            assignments[row["id"]] = code
            used.add(code)

    # d20261001008 created the check through SQLAlchemy's naming convention.
    # On SQL Server its physical name is therefore prefixed a second time
    # (ck_materials_ck_materials_commercial_code).  Accept both names so this
    # migration also works in databases created before/after that convention.
    for constraint_name in (
        "ck_materials_ck_materials_commercial_code",
        "ck_materials_commercial_code",
        "uq_materials_company_id",
        "uq_material_company_code",
    ):
        _drop_constraint(connection, "materials", constraint_name)
    connection.execute(sa.text("ALTER TABLE dbo.materials ALTER COLUMN code NVARCHAR(40) NOT NULL"))
    for row in rows:
        connection.execute(
            sa.text("UPDATE dbo.materials SET code=:code WHERE id=:id"),
            {"code": f"SYNC-{row['id']}", "id": row["id"]},
        )
    for material_id, code in assignments.items():
        connection.execute(
            sa.text("UPDATE dbo.materials SET code=:code WHERE id=:id"),
            {"code": code, "id": material_id},
        )
    connection.execute(sa.text("ALTER TABLE dbo.materials ALTER COLUMN code NVARCHAR(7) NOT NULL"))
    connection.execute(
        sa.text(
            "ALTER TABLE dbo.materials ADD CONSTRAINT uq_material_company_code "
            "UNIQUE (company_id, code)"
        )
    )
    connection.execute(
        sa.text(
            "ALTER TABLE dbo.materials ADD CONSTRAINT ck_materials_commercial_code CHECK "
            "(code COLLATE Latin1_General_100_BIN2 "
            "LIKE '[A-Z][A-Z][A-Z]-[0-9][0-9][0-9]')"
        )
    )


def upgrade():
    connection = op.get_bind()
    if connection.dialect.name != "mssql":
        return

    connection.execute(
        sa.text(
            "IF COL_LENGTH(N'dbo.insumos', N'codigo_comercial') IS NULL "
            "ALTER TABLE dbo.insumos ADD codigo_comercial NVARCHAR(7) NULL"
        )
    )
    _drop_constraint(connection, "insumos", "CK_insumos_codigo_comercial")
    _drop_constraint(connection, "insumos", "UQ_insumos_codigo_comercial")
    catalog_codes = _catalog_assignments(connection)
    for ingredient_id, code in catalog_codes.items():
        connection.execute(
            sa.text(
                "UPDATE dbo.insumos SET codigo_comercial=:code WHERE id_insumo=:id_insumo"
            ),
            {"code": code, "id_insumo": ingredient_id},
        )
    connection.execute(
        sa.text(
            "ALTER TABLE dbo.insumos ALTER COLUMN codigo_comercial NVARCHAR(7) NOT NULL"
        )
    )
    connection.execute(
        sa.text(
            "ALTER TABLE dbo.insumos ADD CONSTRAINT UQ_insumos_codigo_comercial "
            "UNIQUE (codigo_comercial)"
        )
    )
    connection.execute(
        sa.text(
            "ALTER TABLE dbo.insumos ADD CONSTRAINT CK_insumos_codigo_comercial CHECK "
            "(codigo_comercial COLLATE Latin1_General_100_BIN2 "
            "LIKE '[A-Z][A-Z][A-Z]-[0-9][0-9][0-9]')"
        )
    )
    _sync_local_materials(connection, catalog_codes)
    connection.execute(
        sa.text(
            """CREATE OR ALTER VIEW dbo.vista_insumos AS
            SELECT i.id_insumo, i.codigo_comercial, i.nombre, i.variedad,
                   c.nombre AS categoria, u.codigo AS unidad_medida,
                   i.precio_mayorista, i.activo
            FROM dbo.insumos i
            LEFT JOIN dbo.categorias c ON i.id_categoria=c.id_categoria
            LEFT JOIN dbo.unidades_medida u ON i.id_unidad=u.id_unidad"""
        )
    )
    connection.execute(
        sa.text(
            """CREATE OR ALTER TRIGGER dbo.trg_insumos_sync_material_code
            ON dbo.insumos AFTER UPDATE AS
            BEGIN
                SET NOCOUNT ON;
                IF UPDATE(codigo_comercial)
                    UPDATE m SET m.code=i.codigo_comercial
                    FROM dbo.materials m
                    JOIN inserted i ON i.id_insumo=m.external_insumo_id
                    WHERE m.code<>i.codigo_comercial;
            END"""
        )
    )


def downgrade():
    connection = op.get_bind()
    if connection.dialect.name != "mssql":
        return
    connection.execute(
        sa.text(
            "IF OBJECT_ID(N'dbo.trg_insumos_sync_material_code', N'TR') IS NOT NULL "
            "DROP TRIGGER dbo.trg_insumos_sync_material_code"
        )
    )
    connection.execute(
        sa.text(
            """CREATE OR ALTER VIEW dbo.vista_insumos AS
            SELECT i.id_insumo, i.nombre, i.variedad,
                   c.nombre AS categoria, u.codigo AS unidad_medida,
                   i.precio_mayorista, i.activo
            FROM dbo.insumos i
            LEFT JOIN dbo.categorias c ON i.id_categoria=c.id_categoria
            LEFT JOIN dbo.unidades_medida u ON i.id_unidad=u.id_unidad"""
        )
    )
    _drop_constraint(connection, "insumos", "CK_insumos_codigo_comercial")
    _drop_constraint(connection, "insumos", "UQ_insumos_codigo_comercial")
    connection.execute(sa.text("ALTER TABLE dbo.insumos DROP COLUMN codigo_comercial"))
