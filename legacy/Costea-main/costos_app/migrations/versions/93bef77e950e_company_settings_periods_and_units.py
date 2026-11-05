"""Company settings periods and units

Revision ID: 93bef77e950e
Revises: 61d074e89df8
Create Date: 2026-09-20 17:16:57.933292

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '93bef77e950e'
down_revision = '61d074e89df8'
branch_labels = None
depends_on = None


def upgrade():
    # Upgrade the parent before creating children (SQLite enforces foreign keys).
    # Existing identifiers are retained without assuming they are Peruvian RUCs.
    with op.batch_alter_table('companies', schema=None) as batch_op:
        batch_op.add_column(sa.Column('tax_id_kind', sa.String(length=12), server_default='other', nullable=False))
        batch_op.add_column(sa.Column('default_tax_millionths', sa.Integer(), nullable=True))
        batch_op.create_check_constraint(op.f('ck_companies_tax_range'), 'default_tax_millionths BETWEEN 0 AND 1000000')
        batch_op.create_check_constraint(op.f('ck_companies_tax_id_kind'), "tax_id_kind IN ('peru_ruc', 'other')")
    op.create_index(
        'uq_company_owner_tax_id',
        'companies',
        ['user_id', 'tax_id_kind', 'tax_id'],
        unique=True,
        mssql_where=sa.text('tax_id IS NOT NULL'),
        sqlite_where=sa.text('tax_id IS NOT NULL'),
    )

    op.create_table('units',
    sa.Column('code', sa.String(length=16), nullable=False),
    sa.Column('name', sa.String(length=50), nullable=False),
    sa.Column('symbol', sa.String(length=10), nullable=False),
    sa.Column('dimension', sa.String(length=20), nullable=False),
    sa.Column('numerator', sa.Integer(), nullable=False),
    sa.Column('denominator', sa.Integer(), nullable=False),
    sa.CheckConstraint('numerator > 0 AND denominator > 0', name=op.f('ck_units_positive_factor')),
    sa.PrimaryKeyConstraint('code', name=op.f('pk_units'))
    )
    op.create_table('company_units',
    sa.Column('company_id', sa.Integer(), nullable=False),
    sa.Column('unit_code', sa.String(length=16), nullable=False),
    sa.Column('enabled', sa.Boolean(), nullable=False),
    sa.ForeignKeyConstraint(['company_id'], ['companies.id'], name=op.f('fk_company_units_company_id_companies'), ondelete='NO ACTION'),
    sa.ForeignKeyConstraint(['unit_code'], ['units.code'], name=op.f('fk_company_units_unit_code_units'), ondelete='NO ACTION'),
    sa.PrimaryKeyConstraint('company_id', 'unit_code', name=op.f('pk_company_units'))
    )
    op.create_table('periods',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('company_id', sa.Integer(), nullable=False),
    sa.Column('year', sa.Integer(), nullable=False),
    sa.Column('month', sa.Integer(), nullable=False),
    sa.Column('tax_millionths', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.CheckConstraint('month BETWEEN 1 AND 12', name=op.f('ck_periods_month_range')),
    sa.CheckConstraint('tax_millionths BETWEEN 0 AND 1000000', name=op.f('ck_periods_tax_range')),
    sa.CheckConstraint('year BETWEEN 1900 AND 9999', name=op.f('ck_periods_year_range')),
    sa.ForeignKeyConstraint(['company_id'], ['companies.id'], name=op.f('fk_periods_company_id_companies'), ondelete='NO ACTION'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_periods')),
    sa.UniqueConstraint('company_id', 'year', 'month', name=op.f('uq_periods_company_id'))
    )
    with op.batch_alter_table('periods', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_periods_company_id'), ['company_id'], unique=False)



def downgrade():
    # Remove dependent tables before rebuilding companies under SQLite.
    op.drop_table('periods')
    op.drop_table('company_units')
    op.drop_table('units')
    op.drop_index('uq_company_owner_tax_id', table_name='companies')
    with op.batch_alter_table('companies', schema=None) as batch_op:
        batch_op.drop_constraint(op.f('ck_companies_tax_range'), type_='check')
        batch_op.drop_constraint(op.f('ck_companies_tax_id_kind'), type_='check')
        batch_op.drop_column('default_tax_millionths')
        batch_op.drop_column('tax_id_kind')
