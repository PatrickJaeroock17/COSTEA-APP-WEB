import pytest

from app import create_app
from app.extensions import db
from app.models import Company, CompanyUnit, Industry, User


@pytest.fixture
def app():
    application = create_app(
        {
            "TESTING": True,
            "SECRET_KEY": "test-only-secret-never-use-in-production-1234",
            "SQLALCHEMY_DATABASE_URI": "sqlite://",
            "WTF_CSRF_ENABLED": False,
            "RATELIMIT_ENABLED": False,
            "SESSION_COOKIE_SECURE": False,
        }
    )
    with application.app_context():
        db.create_all()
        yield application
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def user(app):
    account = User(name="Ana Torres", email="ana@example.com")
    account.set_password("Frase de prueba 2026!")
    db.session.add(account)
    db.session.commit()
    return account


@pytest.fixture
def login(client, user):
    return lambda: client.post(
        "/auth/ingresar",
        data={
            "email": "ana@example.com",
            "password": "Frase de prueba 2026!",
        },
    )


@pytest.fixture
def catalog():
    app = create_app(
        {
            "TESTING": True,
            "SECRET_KEY": "materials-test-secret-not-for-production",
            "SQLALCHEMY_DATABASE_URI": "sqlite://",
            "WTF_CSRF_ENABLED": False,
            "RATELIMIT_ENABLED": False,
            "SESSION_COOKIE_SECURE": False,
        }
    )
    with app.app_context():
        db.create_all()
        for cmd in ("seed-industries", "seed-units"):
            assert app.test_cli_runner().invoke(args=[cmd]).exit_code == 0
        user = User(name="Prueba", email="materials@example.com")
        user.set_password("Materiales de prueba 2026!")
        other = User(name="Otro", email="other@example.com")
        other.set_password("Otros materiales 2026!")
        db.session.add_all([user, other])
        db.session.flush()
        industry = db.session.scalar(db.select(Industry.id))
        for i, owner in enumerate((user, user, other), 1):
            db.session.add(
                Company(
                    id=i,
                    user_id=owner.id,
                    industry_id=industry,
                    legal_name=f"Empresa {i}",
                    currency="PEN",
                )
            )
        db.session.flush()
        for cid in (1, 2, 3):
            for code in ("g", "kg", "l", "unit"):
                db.session.add(CompanyUnit(company_id=cid, unit_code=code))
        db.session.commit()
    client = app.test_client()
    assert (
        client.post(
            "/auth/ingresar",
            data={"email": "materials@example.com", "password": "Materiales de prueba 2026!"},
        ).status_code
        == 302
    )
    yield app, client
    with app.app_context():
        db.session.remove()
        db.drop_all()
