"""Restaurant-specific customizations of base personnel.

Revision ID: h20261014012
Revises: g20261002011
"""

import sqlalchemy as sa
from alembic import op

revision = "h20261014012"
down_revision = "g20261002011"
branch_labels = None
depends_on = None


def upgrade():
    from app.models.planning import RestaurantLaborProfile

    RestaurantLaborProfile.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade():
    if sa.inspect(op.get_bind()).has_table("restaurant_labor_profiles"):
        op.drop_table("restaurant_labor_profiles")
