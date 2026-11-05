"""Add detailed monthly payroll and the restaurant business plan without rewriting history."""
from alembic import op
import sqlalchemy as sa

revision = "f19c2026a004"
down_revision = "e8bc410aa003"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("employee_period_costs", sa.Column("breakdown", sa.JSON(), nullable=True))
    op.create_table(
        "business_plans",
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), primary_key=True),
        sa.Column("title", sa.String(180), nullable=False),
        sa.Column("content", sa.JSON(), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )


def downgrade():
    op.drop_table("business_plans")
    with op.batch_alter_table("employee_period_costs") as batch:
        batch.drop_column("breakdown")
