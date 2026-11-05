"""Connect published production plans to exact kardex outputs."""

import sqlalchemy as sa
from alembic import op

revision = "e20261001009"
down_revision = "d20261001008"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("inventory_movements") as batch:
        batch.add_column(sa.Column("plan_id", sa.Integer(), nullable=True))
        batch.create_foreign_key(
            "fk_inventory_movements_plan_id",
            "production_plans",
            ["plan_id"],
            ["id"],
        )
        batch.create_index("ix_inventory_movements_plan_id", ["plan_id"])


def downgrade():
    with op.batch_alter_table("inventory_movements") as batch:
        batch.drop_index("ix_inventory_movements_plan_id")
        batch.drop_constraint("fk_inventory_movements_plan_id", type_="foreignkey")
        batch.drop_column("plan_id")
