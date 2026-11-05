"""Normalize material codes to three letters and three digits."""

import re
import unicodedata

import sqlalchemy as sa
from alembic import op

revision = "d20261001008"
down_revision = "c20260930007"
branch_labels = None
depends_on = None

_IGNORED_WORDS = {"DE", "DEL", "EL", "LA", "LAS", "LOS", "Y"}


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


def upgrade():
    connection = op.get_bind()
    rows = list(
        connection.execute(
            sa.text(
                "SELECT id, company_id, category FROM materials "
                "ORDER BY company_id, id"
            )
        ).mappings()
    )

    sequences = {}
    final_codes = []
    for row in rows:
        prefix = _prefix(row["category"])
        key = (row["company_id"], prefix)
        sequences[key] = sequences.get(key, 0) + 1
        if sequences[key] > 999:
            raise RuntimeError(
                f"El restaurante {row['company_id']} supera 999 insumos con prefijo {prefix}."
            )
        final_codes.append(f"{prefix}-{sequences[key]:03d}")

    # Removing the old uniqueness constraint first makes the transition safe
    # even if an old arbitrary code happens to equal one of the temporary codes.
    with op.batch_alter_table("materials") as batch:
        batch.drop_constraint("uq_material_company_code", type_="unique")

    # Move every existing value out of the final namespace before assigning
    # correlatives. This prevents collisions with codes already using AAA-000.
    for row in rows:
        connection.execute(
            sa.text("UPDATE materials SET code=:code WHERE id=:id"),
            {"code": f"MIG-D08-{row['id']}", "id": row["id"]},
        )

    for row, code in zip(rows, final_codes, strict=True):
        connection.execute(
            sa.text("UPDATE materials SET code=:code WHERE id=:id"),
            {"code": code, "id": row["id"]},
        )

    dialect = connection.dialect.name
    format_check = (
        "code LIKE '[A-Z][A-Z][A-Z]-[0-9][0-9][0-9]'"
        if dialect == "mssql"
        else "code GLOB '[A-Z][A-Z][A-Z]-[0-9][0-9][0-9]'"
    )
    with op.batch_alter_table("materials") as batch:
        batch.alter_column(
            "code",
            existing_type=sa.String(length=40),
            type_=sa.String(length=7),
            existing_nullable=False,
        )
        batch.create_unique_constraint("uq_material_company_code", ["company_id", "code"])
        batch.create_check_constraint("ck_materials_commercial_code", format_check)


def downgrade():
    with op.batch_alter_table("materials") as batch:
        batch.drop_constraint("ck_materials_commercial_code", type_="check")
        batch.drop_constraint("uq_material_company_code", type_="unique")
        batch.alter_column(
            "code",
            existing_type=sa.String(length=7),
            type_=sa.String(length=40),
            existing_nullable=False,
        )
        batch.create_unique_constraint("uq_material_company_code", ["company_id", "code"])
