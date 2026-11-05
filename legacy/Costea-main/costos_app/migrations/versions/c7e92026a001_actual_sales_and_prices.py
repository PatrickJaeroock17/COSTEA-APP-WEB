"""Product prices and actual sales; additive migration preserving existing data."""

from alembic import op
import sqlalchemy as sa

revision = "c7e92026a001"
down_revision = "849260142f05"
branch_labels = None
depends_on = None


def timestamps():
    return [sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False)]


def upgrade():
    op.create_table("product_prices",
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id"), primary_key=True),
        sa.Column("amount", sa.String(80), nullable=False),
        sa.CheckConstraint("CAST(amount AS DECIMAL(38,18)) > 0", name="positive_sale_price"),
        *timestamps())
    op.create_table("sales",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("recipe_id", sa.Integer(), sa.ForeignKey("recipe_versions.id"), nullable=False),
        sa.Column("sold_on", sa.Date(), nullable=False),
        sa.Column("quantity", sa.String(80), nullable=False),
        sa.Column("unit_price", sa.String(80), nullable=False),
        sa.Column("unit_cost", sa.String(80), nullable=False),
        sa.CheckConstraint("CAST(quantity AS DECIMAL(38,18)) > 0", name="positive_sale_quantity"),
        sa.CheckConstraint("CAST(unit_price AS DECIMAL(38,18)) > 0", name="positive_sale_unit_price"),
        *timestamps())
    for column in ("company_id", "product_id", "sold_on"):
        op.create_index(f"ix_sales_{column}", "sales", [column])


def downgrade():
    op.drop_table("sales")
    op.drop_table("product_prices")
