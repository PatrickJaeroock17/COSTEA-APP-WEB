"""Add a separate variety field to restaurant-private materials."""

import sqlalchemy as sa
from alembic import op

revision = "c20260930007"
down_revision = "b20260930006"
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()
    columns = {column["name"] for column in sa.inspect(connection).get_columns("materials")}
    if "variety" not in columns:
        op.add_column("materials", sa.Column("variety", sa.String(length=100), nullable=True))
    # Materialize the result before issuing UPDATE statements. SQL Server's
    # ODBC connection cannot execute another command while this cursor is open
    # unless MARS is enabled, and migrations must not depend on MARS.
    rows = list(
        connection.execute(
            sa.text(
                "SELECT id, name FROM materials "
                "WHERE external_insumo_id IS NOT NULL AND name LIKE :separator"
            ),
            {"separator": "% · %"},
        ).mappings()
    )
    for row in rows:
        name, variety = row["name"].split(" · ", 1)
        connection.execute(
            sa.text("UPDATE materials SET name=:name, variety=:variety WHERE id=:id"),
            {"id": row["id"], "name": name, "variety": variety[:100]},
        )


def downgrade():
    connection = op.get_bind()
    columns = {column["name"] for column in sa.inspect(connection).get_columns("materials")}
    if "variety" not in columns:
        return
    rows = list(
        connection.execute(
            sa.text("SELECT id, name, variety FROM materials WHERE variety IS NOT NULL")
        ).mappings()
    )
    for row in rows:
        combined = f"{row['name']} · {row['variety']}"[:220]
        connection.execute(
            sa.text("UPDATE materials SET name=:name WHERE id=:id"),
            {"id": row["id"], "name": combined},
        )
    with op.batch_alter_table("materials") as batch:
        batch.drop_column("variety")
