"""Phase 2 integration tests use request-scoped application contexts."""

import re
from decimal import Decimal

import pytest

from app import create_app
from app.extensions import db
from app.models import Company, CompanyUnit, Industry, Period, Unit, User
from app.models.tax import decode_rate, encode_rate
from app.services.units import convert_quantity


@pytest.fixture
def workspace():
    app = create_app(
        {
            "TESTING": True,
            "SECRET_KEY": "company-test-secret-not-for-production",
            "SQLALCHEMY_DATABASE_URI": "sqlite://",
            "WTF_CSRF_ENABLED": False,
            "RATELIMIT_ENABLED": False,
            "SESSION_COOKIE_SECURE": False,
        }
    )
    with app.app_context():
        db.create_all()
        for command in ("seed-industries", "seed-units"):
            assert app.test_cli_runner().invoke(args=[command]).exit_code == 0
        first = User(name="Primera persona", email="first@example.com")
        first.set_password("Una frase para pruebas!")
        other = User(name="Segunda persona", email="second@example.com")
        other.set_password("Otra frase para pruebas!")
        db.session.add_all([first, other])
        db.session.commit()
        ids = {
            "owner": first.id,
            "other": other.id,
            "industry": db.session.scalar(db.select(Industry.id)),
        }
    client = app.test_client()

    class SourceUnits:
        def units(self):
            return [
                dict(id_unidad=1, codigo="Litro", descripcion="Litro"),
                dict(id_unidad=2, codigo="kg", descripcion="Kilogramo"),
            ]

    app.extensions["catalog_provider"] = SourceUnits()
    app.extensions["recipe_provider"] = type(
        "EmptyRecipeProvider", (), {"dishes": lambda self: ()}
    )()
    assert (
        client.post(
            "/auth/ingresar",
            data={
                "email": "first@example.com",
                "password": "Una frase para pruebas!",
            },
        ).status_code
        == 302
    )
    yield app, client, ids
    with app.app_context():
        db.session.remove()
        db.drop_all()
        db.engine.dispose()


def company_data(ids, **overrides):
    return {
        "legal_name": "Empresa de prueba SAC",
        "trade_name": "Mi proyecto",
        "tax_id_kind": "peru_ruc",
        "tax_id": "20123456789",
        "industry_id": ids["industry"],
        "currency": "PEN",
        "tax_percent": "18",
        "initial_month": "2026-09",
    } | overrides


def create_company(workspace, **overrides):
    app, client, ids = workspace
    response = client.post("/empresas/nueva", data=company_data(ids, **overrides))
    assert response.status_code == 302, response.get_data(as_text=True)
    return int(response.location.split("/")[2])


def test_create_company_period_and_owned_context(workspace):
    app, client, ids = workspace
    cid = create_company(workspace, user_id=ids["other"])
    with app.app_context():
        company = db.session.get(Company, cid)
        assert company.user_id == ids["owner"]
        assert company.currency == "PEN"
        assert company.default_tax_rate == Decimal("0.18")
        period = db.session.scalar(db.select(Period).where(Period.company_id == cid))
        assert period.key == "2026-09"
        assert period.tax_rate == Decimal("0.18")
        assert not company.unit_settings
        pid = period.id
    with client.session_transaction() as session:
        assert session["active_company_id"] == cid
        assert session["active_period_id"] == pid
    for page in (
        "/dashboard",
        "/empresas",
        f"/empresas/{cid}/editar",
        f"/empresas/{cid}/periodos",
        f"/empresas/{cid}/unidades",
    ):
        assert client.get(page).status_code == 200


def test_units_live_inside_restaurant_settings_without_sidebar_duplicate(workspace):
    _app, client, _ids = workspace
    cid = create_company(workspace)

    settings = client.get(f"/empresas/{cid}/editar").get_data(as_text=True)
    assert "Unidades y conversiones" not in settings
    assert f'href="/empresas/{cid}/unidades"' in settings

    units = client.get(f"/empresas/{cid}/unidades").get_data(as_text=True)
    assert "Unidades y conversiones" not in units
    assert "Datos del restaurante · Unidades" in units
    assert f'href="/empresas/{cid}/editar" class="nav-item active"' in units


@pytest.mark.parametrize(
    "invalid",
    [
        {"legal_name": " "},
        {"tax_id": "123"},
        {"tax_id_kind": "invented"},
        {"currency": "ZZZ"},
        {"initial_month": "2026-13"},
        {"initial_month": "2026-00"},
        {"initial_month": "1899-12"},
        {"initial_month": ""},
        {"tax_percent": "NaN"},
        {"tax_percent": "Infinity"},
        {"tax_percent": "101"},
        {"tax_percent": "-1"},
        {"tax_percent": "18.12345"},
    ],
)
def test_invalid_company_is_not_partially_saved(workspace, invalid):
    app, client, ids = workspace
    assert client.post("/empresas/nueva", data=company_data(ids, **invalid)).status_code == 422
    with app.app_context():
        assert db.session.scalar(db.select(db.func.count()).select_from(Company)) == 0
        assert db.session.scalar(db.select(db.func.count()).select_from(Period)) == 0


@pytest.mark.parametrize(
    "percent,rate",
    [("", None), ("0", Decimal("0")), ("100", Decimal("1")), ("18,1234", Decimal("0.181234"))],
)
def test_tax_rate_roundtrip_and_rendering(workspace, percent, rate):
    app, client, _ = workspace
    cid = create_company(workspace, tax_percent=percent)
    with app.app_context():
        company = db.session.get(Company, cid)
        assert company.default_tax_rate == Decimal(".18")
        assert company.periods[0].tax_rate == Decimal(".18")
    html = client.get(f"/empresas/{cid}/editar").get_data(as_text=True)
    assert 'value="18"' in html


def test_edit_defaults_preserves_period_and_ownership(workspace):
    app, client, ids = workspace
    cid = create_company(workspace)
    response = client.post(
        f"/empresas/{cid}/editar",
        data=company_data(
            ids,
            legal_name="Nombre actualizado",
            trade_name="",
            tax_percent="10",
            currency="USD",
            user_id=ids["other"],
        ),
    )
    assert response.status_code == 302
    with app.app_context():
        company = db.session.get(Company, cid)
        assert company.user_id == ids["owner"]
        assert company.legal_name == "Nombre actualizado"
        assert company.display_name == "Nombre actualizado"
        assert company.currency == "USD"
        assert company.default_tax_rate == Decimal(".18")
        assert company.periods[0].tax_rate == Decimal(".18")
    assert 'value="18"' in client.get(f"/empresas/{cid}/periodos").get_data(as_text=True)


def test_duplicate_tax_identifier_including_archived(workspace):
    app, client, ids = workspace
    cid = create_company(workspace)
    assert client.post(f"/empresas/{cid}/archivar").status_code == 302
    assert client.post("/empresas/nueva", data=company_data(ids)).status_code == 422
    with app.app_context():
        assert db.session.scalar(db.select(db.func.count()).select_from(Company)) == 1


def test_optional_tax_id_and_other_format(workspace):
    app, client, ids = workspace
    create_company(workspace, tax_id="")
    create_company(workspace, tax_id="")
    create_company(workspace, tax_id_kind="other", tax_id="R-ABC/123")
    with app.app_context():
        assert db.session.scalar(db.select(db.func.count()).select_from(Company)) == 3


def test_period_unique_per_company_and_tax_edit_is_local(workspace):
    app, client, _ = workspace
    cid = create_company(workspace)
    endpoint = f"/empresas/{cid}/periodos"
    assert (
        client.post(endpoint, data={"month_key": "2026-09", "tax_percent": "0"}).status_code == 422
    )
    assert (
        client.post(endpoint, data={"month_key": "2026-10", "tax_percent": "0"}).status_code == 302
    )
    with app.app_context():
        october = db.session.scalar(
            db.select(Period).where(Period.company_id == cid, Period.month == 10)
        )
        pid = october.id
        assert october.tax_rate == Decimal(".18")
    assert (
        client.post(
            f"/empresas/{cid}/periodos/{pid}/impuesto", data={"tax_percent": ""}
        ).status_code
        == 302
    )
    with app.app_context():
        assert db.session.get(Period, pid).tax_rate == Decimal(".18")
        assert db.session.get(Company, cid).default_tax_rate == Decimal(".18")
        assert db.session.scalar(db.select(Period).where(Period.month == 9)).tax_rate == Decimal(
            ".18"
        )


def test_switching_company_resets_period(workspace):
    app, client, _ = workspace
    first = create_company(workspace)
    second = create_company(
        workspace, legal_name="Segunda", tax_id="20987654321", initial_month="2026-10"
    )
    with app.app_context():
        first_pid = db.session.scalar(db.select(Period.id).where(Period.company_id == first))
        second_pid = db.session.scalar(db.select(Period.id).where(Period.company_id == second))
    assert (
        client.post(
            "/espacio/empresa", data={"company_id": first}, follow_redirects=True
        ).status_code
        == 200
    )
    with client.session_transaction() as session:
        assert session["active_company_id"] == first
        assert session["active_period_id"] == first_pid
    assert client.post("/espacio/periodo", data={"period_id": second_pid}).status_code == 404
    assert client.post("/espacio/periodo", data={"period_id": first_pid}).status_code == 302


def test_archive_confirmation_and_restore_keep_children(workspace):
    app, client, _ = workspace
    cid = create_company(workspace)
    assert (
        client.post(f"/empresas/{cid}/unidades", data={"unit_codes": ["1", "2"]}).status_code == 302
    )
    assert client.get(f"/empresas/{cid}/archivar").status_code == 200
    with app.app_context():
        assert db.session.get(Company, cid).active
    assert client.post(f"/empresas/{cid}/archivar", follow_redirects=True).status_code == 200
    with app.app_context():
        company = db.session.get(Company, cid)
        assert not company.active
        assert len(company.periods) == 1
        assert len(company.unit_settings) == 2
    with client.session_transaction() as session:
        assert "active_company_id" not in session
        assert "active_period_id" not in session
    assert client.post("/espacio/empresa", data={"company_id": cid}).status_code == 404
    assert client.get(f"/empresas/{cid}/editar").status_code == 404
    assert client.post(f"/empresas/{cid}/restaurar", follow_redirects=True).status_code == 200
    with app.app_context():
        assert db.session.get(Company, cid).active


def test_cross_owner_ids_are_rejected_everywhere(workspace):
    app, client, ids = workspace
    own = create_company(workspace)
    with app.app_context():
        other = Company(
            user_id=ids["other"], industry_id=ids["industry"], legal_name="AJENA SECRETA"
        )
        db.session.add(other)
        db.session.flush()
        period = Period(company_id=other.id, year=2026, month=11)
        db.session.add(period)
        db.session.commit()
        foreign_id, pid = other.id, period.id
    for suffix in ("editar", "periodos", "unidades", "archivar", f"periodos/{pid}/impuesto"):
        for method in (client.get, client.post):
            assert method(f"/empresas/{foreign_id}/{suffix}").status_code == 404
    assert client.post(f"/empresas/{foreign_id}/restaurar").status_code == 404
    assert client.post("/espacio/empresa", data={"company_id": foreign_id}).status_code == 404
    assert client.post("/espacio/periodo", data={"period_id": pid}).status_code == 404
    assert client.get(f"/empresas/{own}/periodos/{pid}/impuesto").status_code == 404
    with client.session_transaction() as session:
        session["active_company_id"] = foreign_id
        session["active_period_id"] = pid
    html = client.get("/dashboard").get_data(as_text=True)
    assert "AJENA SECRETA" not in html
    with client.session_transaction() as session:
        assert session["active_company_id"] == own
        assert session["active_period_id"] != pid


def test_units_do_not_mix_companies_and_disable_without_delete(workspace):
    app, client, _ = workspace
    first = create_company(workspace)
    second = create_company(workspace, tax_id="", legal_name="Otra")
    assert (
        client.post(f"/empresas/{first}/unidades", data={"unit_codes": ["1", "2"]}).status_code
        == 302
    )
    assert client.post(f"/empresas/{first}/unidades", data={"unit_codes": ["1"]}).status_code == 302
    assert (
        client.post(f"/empresas/{second}/unidades", data={"unit_codes": ["1"]}).status_code == 302
    )
    assert (
        client.post(f"/empresas/{second}/unidades", data={"unit_codes": ["unknown"]}).status_code
        == 422
    )
    assert client.post(f"/empresas/{second}/unidades", data={}).status_code == 422
    with app.app_context():
        assert not db.session.get(CompanyUnit, (first, "kg")).enabled
        assert db.session.get(CompanyUnit, (first, "l")).enabled
        assert db.session.get(CompanyUnit, (second, "l")).enabled
        assert db.session.get(CompanyUnit, (second, "kg")) is None


def test_catalog_seed_repeated_and_unit_conversion(workspace):
    app, _, _ = workspace
    for _ in range(2):
        assert app.test_cli_runner().invoke(args=["seed-units"]).exit_code == 0
    with app.app_context():
        assert db.session.scalar(db.select(db.func.count()).select_from(Unit)) == 10
        kg, gram = db.session.get(Unit, "kg"), db.session.get(Unit, "g")
        assert convert_quantity(Decimal(".25"), kg, gram) == Decimal("250")
        assert convert_quantity(Decimal("250"), gram, kg) == Decimal(".25")
        assert convert_quantity(
            Decimal("1.5"), db.session.get(Unit, "h"), db.session.get(Unit, "min")
        ) == Decimal("90")
        with pytest.raises(ValueError):
            convert_quantity(Decimal("1"), kg, db.session.get(Unit, "l"))
        with pytest.raises(ValueError):
            convert_quantity(0.1, kg, gram)


@pytest.mark.parametrize(
    "value", [Decimal("NaN"), Decimal("1.1"), Decimal("-.1"), Decimal("0.1234567"), 0.18]
)
def test_invalid_decimal_rate_is_rejected(value):
    with pytest.raises(ValueError):
        encode_rate(value)


def test_exact_rate_scale():
    assert encode_rate(Decimal(".181234")) == 181234
    assert decode_rate(181234) == Decimal(".181234")
    assert encode_rate(None) is None
    assert decode_rate(0) == Decimal("0")


def test_csrf_protects_company_mutations(workspace):
    app, client, ids = workspace
    cid = create_company(workspace)
    with app.app_context():
        pid = db.session.scalar(db.select(Period.id).where(Period.company_id == cid))
    app.config["WTF_CSRF_ENABLED"] = True
    for endpoint in (
        "/empresas/nueva",
        f"/empresas/{cid}/editar",
        f"/empresas/{cid}/archivar",
        f"/empresas/{cid}/restaurar",
        f"/empresas/{cid}/unidades",
        f"/empresas/{cid}/periodos",
        f"/empresas/{cid}/periodos/{pid}/impuesto",
        "/espacio/empresa",
        "/espacio/periodo",
    ):
        assert client.post(endpoint, data=company_data(ids)).status_code == 400
    html = client.get(f"/empresas/{cid}/editar").get_data(as_text=True)
    csrf = re.search(r'name="csrf_token" type="hidden" value="([^"]+)"', html).group(1)
    assert (
        client.post(
            f"/empresas/{cid}/editar",
            data=company_data(
                ids,
                csrf_token=csrf,
                legal_name="Guardado con CSRF",
            ),
        ).status_code
        == 302
    )


def test_active_industry_is_required_for_new_company(workspace):
    app, client, ids = workspace
    with app.app_context():
        restaurant = db.session.scalar(db.select(Industry).where(Industry.slug == "restaurantes"))
        restaurant.active = False
        db.session.commit()
    assert client.post("/empresas/nueva", data=company_data(ids)).status_code == 503
