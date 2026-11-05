"""Align local material text lengths with the SQL Server source catalog."""

import sqlalchemy as sa
from alembic import op

revision = "b20260930006"
down_revision = "a20260925005"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("materials") as batch:
        batch.alter_column(
            "name",
            existing_type=sa.String(length=180),
            type_=sa.String(length=220),
            existing_nullable=False,
        )
        batch.alter_column(
            "category",
            existing_type=sa.String(length=80),
            type_=sa.String(length=100),
            existing_nullable=False,
        )


def downgrade():
    with op.batch_alter_table("materials") as batch:
        batch.alter_column(
            "category",
            existing_type=sa.String(length=100),
            type_=sa.String(length=80),
            existing_nullable=False,
        )
        batch.alter_column(
            "name",
            existing_type=sa.String(length=220),
            type_=sa.String(length=180),
            existing_nullable=False,
        )
