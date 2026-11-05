"""References to external sources; never creates the supplied SQL Server tables."""

from alembic import op
import sqlalchemy as sa

revision = "d9a4b210a002"
down_revision = "c7e92026a001"
branch_labels = None
depends_on = None


def upgrade():
    # Additive ALTERs preserve populated SQLite foreign-key graphs (no table rebuild).
    op.add_column("materials", sa.Column("external_insumo_id", sa.Integer(), nullable=True))
    op.create_index(
        "uq_material_external",
        "materials",
        ["company_id", "external_insumo_id"],
        unique=True,
        mssql_where=sa.text("external_insumo_id IS NOT NULL"),
        sqlite_where=sa.text("external_insumo_id IS NOT NULL"),
    )
    op.add_column("products", sa.Column("source_key", sa.String(180), nullable=True))
    op.add_column("products", sa.Column("source_version", sa.String(80), nullable=True))
    op.create_index(
        "uq_product_source",
        "products",
        ["company_id", "source_key"],
        unique=True,
        mssql_where=sa.text("source_key IS NOT NULL"),
        sqlite_where=sa.text("source_key IS NOT NULL"),
    )
    op.add_column("cost_concepts", sa.Column("reference_key", sa.String(180), nullable=True))
    op.create_index(
        "uq_cost_reference",
        "cost_concepts",
        ["company_id", "period_id", "reference_key"],
        unique=True,
        mssql_where=sa.text("reference_key IS NOT NULL"),
        sqlite_where=sa.text("reference_key IS NOT NULL"),
    )


def downgrade():
    with op.batch_alter_table("cost_concepts") as batch:
        batch.drop_index("uq_cost_reference")
        batch.drop_column("reference_key")
    with op.batch_alter_table("products") as batch:
        batch.drop_index("uq_product_source")
        batch.drop_column("source_version")
        batch.drop_column("source_key")
    with op.batch_alter_table("materials") as batch:
        batch.drop_index("uq_material_external")
        batch.drop_column("external_insumo_id")
