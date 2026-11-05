"""Ensure the upgrade preserves populated phase-1 databases."""

from flask_migrate import downgrade, upgrade
from sqlalchemy import text

from app import create_app
from app.extensions import db


def test_upgrade_preserves_existing_accounts_and_companies(tmp_path):
    database = (tmp_path / "legacy.db").as_posix()
    app = create_app(
        {
            "TESTING": True,
            "SECRET_KEY": "legacy-migration-secret-not-for-production",
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{database}",
            "RATELIMIT_ENABLED": False,
        }
    )
    with app.app_context():
        upgrade(revision="61d074e89df8")
        db.session.execute(
            text(
                "INSERT INTO users (id,name,email,password_hash,enabled,created_at,updated_at) VALUES (1,'Existing owner','legacy@example.com','preserve-me',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"
            )
        )
        db.session.execute(
            text(
                "INSERT INTO industries (id,name,slug,description,active,created_at,updated_at) VALUES (1,'Textil','textil','Legacy',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"
            )
        )
        db.session.execute(
            text(
                "INSERT INTO companies (id,user_id,industry_id,legal_name,tax_id,currency,active,created_at,updated_at) VALUES (1,1,1,'Existing company','EX-123','PEN',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"
            )
        )
        db.session.commit()
        upgrade()
        row = db.session.execute(
            text(
                "SELECT legal_name,tax_id,tax_id_kind,default_tax_millionths FROM companies WHERE id=1"
            )
        ).one()
        assert tuple(row) == ("Existing company", "EX-123", "other", None)
        assert (
            db.session.execute(text("SELECT password_hash FROM users WHERE id=1")).scalar_one()
            == "preserve-me"
        )
        db.session.execute(
            text(
                "INSERT INTO periods (id,company_id,year,month,tax_millionths,created_at,updated_at) VALUES (1,1,2026,9,181234,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"
            )
        )
        db.session.execute(
            text(
                "INSERT INTO units (code,name,symbol,dimension,numerator,denominator) VALUES ('g','Gramo','g','mass',1,1)"
            )
        )
        db.session.execute(
            text("INSERT INTO company_units (company_id,unit_code,enabled) VALUES (1,'g',1)")
        )
        db.session.commit()
        # Tests only: downgrade deletes phase-2 configuration, never done on user data.
        downgrade(revision="61d074e89df8")
        assert (
            db.session.execute(text("SELECT legal_name FROM companies WHERE id=1")).scalar_one()
            == "Existing company"
        )
        db.session.commit()
        upgrade()
        assert (
            db.session.execute(text("SELECT password_hash FROM users WHERE id=1")).scalar_one()
            == "preserve-me"
        )
        db.session.remove()
        db.engine.dispose()
