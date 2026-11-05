import pytest
from flask_migrate import downgrade, upgrade
from sqlalchemy.exc import IntegrityError

from app import create_app
from app.extensions import db
from app.models import Company, Industry, User
from app.services.companies import list_owned_companies


def test_seed_is_idempotent_and_creates_no_financial_data(app):
    runner = app.test_cli_runner()
    assert runner.invoke(args=["seed-industries"]).exit_code == 0
    assert runner.invoke(args=["seed-industries"]).exit_code == 0
    assert set(db.session.scalars(db.select(Industry.slug))) == {
        "textil",
        "muebles",
        "imprenta",
        "restaurantes",
    }
    assert db.session.scalar(db.select(db.func.count()).select_from(User)) == 0
    assert db.session.scalar(db.select(db.func.count()).select_from(Company)) == 0


def test_companies_are_scoped_to_owner(app, client, user, login):
    app.test_cli_runner().invoke(args=["seed-industries"])
    industry = db.session.scalar(db.select(Industry))
    other = User(name="Otro usuario", email="other@example.com")
    other.set_password("Otra frase de prueba!")
    db.session.add(other)
    db.session.flush()
    own = Company(user_id=user.id, industry_id=industry.id, legal_name="Empresa propia")
    foreign = Company(user_id=other.id, industry_id=industry.id, legal_name="Empresa ajena")
    archived = Company(
        user_id=user.id, industry_id=industry.id, legal_name="Empresa archivada", active=False
    )
    db.session.add_all([own, foreign, archived])
    db.session.commit()
    assert list_owned_companies(user.id) == [own]
    login()
    response = client.get("/dashboard?empresa_id=" + str(foreign.id)).get_data(as_text=True)
    assert "Empresa propia" in response
    assert "Empresa ajena" not in response
    assert "Empresa archivada" not in response


def test_sqlite_foreign_keys_are_enforced(app):
    db.session.add(Company(user_id=999, industry_id=999, legal_name="Inválida"))
    with pytest.raises(IntegrityError):
        db.session.commit()
    db.session.rollback()


def test_security_headers_and_error_page(client):
    response = client.get("/auth/ingresar")
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert "form-action 'self'" in response.headers["Content-Security-Policy"]
    assert response.headers["Cache-Control"] == "no-store"
    assert client.get("/not-a-route").status_code == 404


def test_healthcheck(client):
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.get_json() == {"status": "ok"}

    response = client.get("/readyz")
    assert response.status_code == 200
    assert response.get_json() == {"status": "ready"}


def test_missing_or_placeholder_secret_fails():
    for secret in (None, "short", "replace-with-a-random-secret-of-at-least-32-characters"):
        with pytest.raises(RuntimeError, match="SECRET_KEY"):
            create_app({"SECRET_KEY": secret, "TESTING": True})


def test_login_rate_limit_is_applied():
    application = create_app(
        {
            "TESTING": True,
            "SECRET_KEY": "test-rate-limit-secret-not-for-production",
            "SQLALCHEMY_DATABASE_URI": "sqlite://",
            "WTF_CSRF_ENABLED": False,
            "RATELIMIT_ENABLED": True,
            "RATELIMIT_STORAGE_URI": "memory://",
        }
    )
    with application.app_context():
        db.create_all()
        with application.test_client() as client:
            for _ in range(10):
                assert client.post("/auth/ingresar", data={}).status_code == 422
            response = client.post("/auth/ingresar", data={})
            assert response.status_code == 429
            assert "Espera un momento" in response.get_data(as_text=True)
        db.session.remove()
        db.drop_all()


def test_migration_upgrade_downgrade_roundtrip(tmp_path):
    database = (tmp_path / "migration.db").as_posix()
    application = create_app(
        {
            "TESTING": True,
            "SECRET_KEY": "test-migrations-secret-not-for-production",
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{database}",
            "RATELIMIT_ENABLED": False,
        }
    )
    with application.app_context():
        upgrade()
        assert {"users", "companies", "industries"}.issubset(
            db.inspect(db.engine).get_table_names()
        )
        downgrade(revision="base")
        assert "users" not in db.inspect(db.engine).get_table_names()
        upgrade()
        assert "users" in db.inspect(db.engine).get_table_names()
        db.session.remove()
        db.engine.dispose()


def test_vendor_assets_available_locally(client):
    for path in (
        "vendor/bootstrap/bootstrap.min.css",
        "vendor/bootstrap-icons/bootstrap-icons.min.css",
        "vendor/bootstrap-icons/fonts/bootstrap-icons.woff2",
        "css/app.css",
        "js/app.js",
        "img/favicon.svg",
    ):
        assert client.get("/static/" + path).status_code == 200
