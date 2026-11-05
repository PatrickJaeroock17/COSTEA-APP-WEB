"""Data migration coverage for strict restaurant material codes."""

import pytest
from flask_migrate import downgrade, upgrade
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app import create_app
from app.extensions import db


def test_material_code_migration_normalizes_existing_rows_and_enforces_format():
    application = create_app(
        {
            "TESTING": True,
            "SECRET_KEY": "material-code-migration-test-secret",
            "SQLALCHEMY_DATABASE_URI": "sqlite://",
            "RATELIMIT_ENABLED": False,
        }
    )
    with application.app_context():
        upgrade(revision="61d074e89df8")
        db.session.execute(
            text(
                "INSERT INTO users (id,name,email,password_hash,enabled,created_at,updated_at) "
                "VALUES (1,'Owner','codes@example.com','hash',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"
            )
        )
        db.session.execute(
            text(
                "INSERT INTO industries (id,name,slug,description,active,created_at,updated_at) "
                "VALUES (1,'Restaurantes','restaurantes','Test',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"
            )
        )
        for company_id in (1, 2):
            db.session.execute(
                text(
                    "INSERT INTO companies (id,user_id,industry_id,legal_name,currency,active,created_at,updated_at) "
                    "VALUES (:id,1,1,:name,'PEN',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"
                ),
                {"id": company_id, "name": f"Empresa {company_id}"},
            )
        db.session.commit()
        upgrade(revision="c20260930007")
        db.session.execute(
            text(
                "INSERT INTO units (code,name,symbol,dimension,numerator,denominator) "
                "VALUES ('kg','Kilogramo','kg','mass',1,1)"
            )
        )
        rows = [
            (1, 1, "PRV-OLD", "Arroz", "Abarrotes"),
            (2, 1, "SQL-7", "Agua", "Abastecimiento"),
            (3, 1, "OLD", "Bonito", "Pescados"),
            (4, 2, "ANOTHER", "Arroz", "Abarrotes"),
        ]
        for material_id, company_id, code, name, category in rows:
            db.session.execute(
                text(
                    "INSERT INTO materials "
                    "(id,company_id,code,external_insumo_id,name,variety,category,supplier,base_unit_code,active,created_at,updated_at) "
                    "VALUES (:id,:company_id,:code,NULL,:name,NULL,:category,NULL,'kg',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"
                ),
                {
                    "id": material_id,
                    "company_id": company_id,
                    "code": code,
                    "name": name,
                    "category": category,
                },
            )
        db.session.commit()

        upgrade()
        migrated = db.session.execute(
            text("SELECT company_id, code FROM materials ORDER BY id")
        ).all()
        assert migrated == [(1, "ABA-001"), (1, "ABA-002"), (1, "PES-001"), (2, "ABA-001")]
        code_column = next(
            column for column in db.inspect(db.engine).get_columns("materials") if column["name"] == "code"
        )
        assert code_column["type"].length == 7

        with pytest.raises(IntegrityError):
            db.session.execute(
                text(
                    "INSERT INTO materials "
                    "(id,company_id,code,name,category,base_unit_code,active,created_at,updated_at) "
                    "VALUES (5,1,'aba-003','Otro','Abarrotes','kg',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"
                )
            )
            db.session.commit()
        db.session.rollback()

        downgrade(revision="c20260930007")
        db.session.execute(
            text(
                "INSERT INTO materials "
                "(id,company_id,code,name,category,base_unit_code,active,created_at,updated_at) "
                "VALUES (5,1,'legacy-code','Otro','Abarrotes','kg',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"
            )
        )
        db.session.commit()
        db.session.remove()
        db.engine.dispose()
