"""Void legacy inventory receipts created from recipe quantities.

Revision ID: g20261002011
Revises: f20261001010
"""

import sqlalchemy as sa
from alembic import op

revision = "g20261002011"
down_revision = "f20261001010"
branch_labels = None
depends_on = None


def upgrade():
    # A recipe is a consumption specification, never a stock receipt. Preserve
    # these movements as audit records while removing their effect on balances.
    op.execute(
        sa.text(
            "UPDATE inventory_movements SET voided = 1 "
            "WHERE kind = 'in' AND reference LIKE 'Insumo de plato #%/%'"
        )
    )


def downgrade():
    # The previous voided state cannot be reconstructed safely.
    pass
