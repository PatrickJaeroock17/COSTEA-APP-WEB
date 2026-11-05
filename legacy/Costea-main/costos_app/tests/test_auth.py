import re

import pytest

from app import create_app
from app.extensions import db
from app.models import User


def registration(**overrides):
    data = {
        "name": "Ana Torres",
        "email": "ana@example.com",
        "password": "Frase de prueba 2026!",
        "confirm_password": "Frase de prueba 2026!",
    }
    return data | overrides


def token(response):
    return re.search(
        r'name="csrf_token" type="hidden" value="([^"]+)"', response.get_data(as_text=True)
    ).group(1)


def test_register_normalizes_email_and_hashes_password(client):
    response = client.post("/auth/registro", data=registration(email=" ANA@Example.com "))
    assert response.status_code == 302
    assert response.location.endswith("/auth/ingresar")
    user = db.session.scalar(db.select(User))
    assert user.email == "ana@example.com"
    assert user.name == "Ana Torres"
    assert user.password_hash.startswith("scrypt:")
    assert user.password_hash != registration()["password"]
    assert user.check_password(registration()["password"])
    assert not user.check_password("wrong password")


def test_duplicate_email_is_rejected_case_insensitively(client, user):
    response = client.post("/auth/registro", data=registration(email="ANA@EXAMPLE.COM"))
    assert response.status_code == 422
    assert "No se pudo registrar" in response.get_data(as_text=True)
    assert db.session.scalar(db.select(db.func.count()).select_from(User)) == 1


@pytest.mark.parametrize(
    "overrides",
    [
        {"name": " "},
        {"email": "invalid"},
        {"password": "short"},
        {"confirm_password": "different"},
        {"name": "x" * 101},
    ],
)
def test_invalid_registration_does_not_create_user(client, overrides):
    assert client.post("/auth/registro", data=registration(**overrides)).status_code == 422
    assert db.session.scalar(db.select(db.func.count()).select_from(User)) == 0


def test_protected_dashboard_redirects_to_login(client):
    response = client.get("/dashboard")
    assert response.status_code == 302
    assert "/auth/ingresar" in response.location


def test_login_logout_and_session_reset(client, login):
    with client.session_transaction() as session:
        session["untrusted_company_id"] = 999
    assert login().status_code == 302
    with client.session_transaction() as session:
        assert "untrusted_company_id" not in session
        assert session["_user_id"]
        assert session.permanent
    assert client.get("/dashboard").status_code == 200
    assert client.get("/auth/salir").status_code == 405
    assert client.post("/auth/salir").status_code == 302
    assert client.get("/dashboard").status_code == 302


@pytest.mark.parametrize("remember", [False, True])
def test_remember_login_is_opt_in_and_logout_clears_it(client, user, remember):
    password_hash = user.password_hash
    response = client.post(
        "/auth/ingresar",
        data={
            "email": user.email,
            "password": "Frase de prueba 2026!",
            **({"remember": "y"} if remember else {}),
        },
    )
    assert response.status_code == 302
    assert bool(client.get_cookie("remember_token")) is remember
    assert user.password_hash == password_hash
    assert db.session.scalar(db.select(db.func.count()).select_from(User)) == 1
    if remember:
        cookie = client.get_cookie("remember_token")
        assert cookie.http_only
        assert cookie.same_site == "Lax"
        client.delete_cookie("session")
        assert client.get("/dashboard").status_code == 200
    assert client.post("/auth/salir").status_code == 302
    assert client.get_cookie("remember_token") is None
    assert client.get("/dashboard").status_code == 302


@pytest.mark.parametrize(
    "email,password",
    [
        ("ana@example.com", "incorrect-password"),
        ("missing@example.com", "incorrect-password"),
    ],
)
def test_invalid_credentials_use_same_message(client, user, email, password):
    response = client.post("/auth/ingresar", data={"email": email, "password": password})
    assert response.status_code == 401
    assert "El correo o la contraseña no son correctos." in response.get_data(as_text=True)
    assert client.get("/dashboard").status_code == 302


def test_disabled_user_cannot_login_or_keep_session(client, user, login):
    login()
    user.enabled = False
    db.session.commit()
    assert client.get("/dashboard").status_code == 302
    assert login().status_code == 401


def test_next_parameter_cannot_redirect_outside_app(client, user):
    response = client.post(
        "/auth/ingresar?next=https://evil.example",
        data={
            "email": user.email,
            "password": "Frase de prueba 2026!",
        },
    )
    assert response.location == "/dashboard"


def test_real_csrf_registration_login_logout():
    # Keep application contexts request-scoped, like the real server. Holding
    # one across requests would incorrectly retain Flask-WTF's cached token.
    app = create_app(
        {
            "TESTING": True,
            "SECRET_KEY": "csrf-integration-secret-not-for-production",
            "SQLALCHEMY_DATABASE_URI": "sqlite://",
            "WTF_CSRF_ENABLED": True,
            "RATELIMIT_ENABLED": False,
            "SESSION_COOKIE_SECURE": False,
        }
    )
    with app.app_context():
        db.create_all()
    client = app.test_client()
    assert client.post("/auth/registro", data=registration()).status_code == 400
    csrf = token(client.get("/auth/registro"))
    assert client.post("/auth/registro", data=registration(csrf_token=csrf)).status_code == 302
    csrf = token(client.get("/auth/ingresar"))
    assert (
        client.post(
            "/auth/ingresar",
            data={
                "email": "ana@example.com",
                "password": "Frase de prueba 2026!",
                "csrf_token": csrf,
            },
        ).status_code
        == 302
    )
    assert client.post("/auth/salir").status_code == 400
    csrf = token(client.get("/dashboard"))
    assert client.post("/auth/salir", data={"csrf_token": csrf}).status_code == 302
    assert client.get("/dashboard").status_code == 302


def test_user_name_is_html_escaped(client, user, login):
    user.name = '<script>alert("x")</script>'
    db.session.commit()
    login()
    text = client.get("/dashboard").get_data(as_text=True)
    assert '<script>alert("x")</script>' not in text
    assert "&lt;script&gt;" in text
