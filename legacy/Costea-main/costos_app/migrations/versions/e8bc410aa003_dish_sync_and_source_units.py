"""Add local source selections and transactional dish synchronization queue."""
from alembic import op
import sqlalchemy as sa

revision = "e8bc410aa003"
down_revision = "d9a4b210a002"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("catalog_unit_selections",
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), primary_key=True),
        sa.Column("source_unit_id", sa.Integer(), primary_key=True),
        sa.Column("enabled", sa.Boolean(), nullable=False))
    op.create_table("dish_sync",
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id"), primary_key=True),
        sa.Column("generation", sa.Integer(), nullable=False),
        sa.Column("synced_generation", sa.Integer(), nullable=False),
        sa.Column("synced_at", sa.DateTime(), nullable=True),
        sa.Column("error", sa.String(500), nullable=True))
    op.execute("INSERT INTO dish_sync (product_id,generation,synced_generation) SELECT id,1,0 FROM products")


def downgrade():
    op.drop_table("dish_sync")
    op.drop_table("catalog_unit_selections")
