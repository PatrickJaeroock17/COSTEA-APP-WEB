"""Add inventory movements without creating fictitious opening balances."""
from alembic import op
import sqlalchemy as sa
from app.models.material import ExactDecimal

revision = 'a20260925005'
down_revision = 'f19c2026a004'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('inventory_locks',
        sa.Column('company_id', sa.Integer(), sa.ForeignKey('companies.id'), primary_key=True),
        sa.Column('revision', sa.Integer(), nullable=False))
    op.execute('INSERT INTO inventory_locks (company_id, revision) SELECT id,0 FROM companies')
    op.create_table('inventory_movements',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('company_id', sa.Integer(), sa.ForeignKey('companies.id'), nullable=False),
        sa.Column('material_id', sa.Integer(), sa.ForeignKey('materials.id'), nullable=False),
        sa.Column('sale_id', sa.Integer(), sa.ForeignKey('sales.id'), nullable=True),
        sa.Column('movement_on', sa.Date(), nullable=False),
        sa.Column('kind', sa.String(12), nullable=False),
        sa.Column('quantity', ExactDecimal(), nullable=False),
        sa.Column('unit_cost', ExactDecimal(), nullable=False),
        sa.Column('reference', sa.String(180), nullable=False),
        sa.Column('voided', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('company_id','reference','material_id'))
    for field in ('company_id','material_id','sale_id'):
        op.create_index('ix_inventory_movements_' + field, 'inventory_movements', [field])


def downgrade():
    op.drop_table('inventory_movements')
    op.drop_table('inventory_locks')
