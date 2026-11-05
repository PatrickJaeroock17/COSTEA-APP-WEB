"""Exact costing, historical selection, ownership and form validation."""

import re
from datetime import date
from decimal import Decimal, localcontext

import pytest
from sqlalchemy import text
from sqlalchemy.dialects import postgresql, sqlite

from app.extensions import db
from app.models import (
    Company,
    CompanyUnit,
    Material,
    MaterialConversion,
    MaterialCostVersion,
)
from app.models.inventory import InventoryMovement
from app.models.material import ExactDecimal
from app.services.material_identity import category_prefix
from app.services.materials import acquisition_cost, effective_version, version_result

D = Decimal


def create_material(client, cid=1, **kwargs):
    response = client.post(
        f"/empresas/{cid}/materiales/nuevo",
        data={
            "code": "sec-001",
            "name": "Harina",
            "category": "Secos",
            "supplier": "Proveedor",
            "base_unit_code": "g",
        }
        | kwargs,
    )
    assert response.status_code == 302, response.get_data(as_text=True)
    return response.location


def purchase_data(**kwargs):
    return {
        "effective_on": "2026-09-01",
        "source": "Cotización de prueba",
        "quantity": "2",
        "purchase_unit": "unit:kg",
        "net_amount": "160",
        "nonrecoverable_tax": "4",
        "recoverable_tax": "28.8",
        "attributable_cost": "6",
    } | kwargs


def test_acquisition_excludes_recoverable_tax_and_keeps_precision():
    result = acquisition_cost(D("2"), D("1000"), D("160"), D("4"), D("6"), D("28.8"))
    assert result.base_quantity == D("2000")
    assert result.acquisition_amount == D("170")
    assert result.unit_cost == D("0.085")
    assert result.recoverable_tax == D("28.8")
    # Required numerical case: 250 g at 80/kg = 20, no intermediate cent rounding.
    result = acquisition_cost(D("1"), D("1000"), D("80"), D("0"), D("0"), D("0"))
    assert result.unit_cost * D("250") == D("20")
    with localcontext() as ctx:
        ctx.prec = 6
        result = acquisition_cost(D("3"), D("1"), D("1"), D("0"), D("0"), D("0"))
        assert str(result.unit_cost) == "0.3333333333333333333333333333"


@pytest.mark.parametrize("bad", [None, 1.25, D("NaN"), D("Infinity"), D("-1")])
def test_invalid_arithmetic_inputs_rejected(bad):
    with pytest.raises(ValueError):
        acquisition_cost(D("1"), D("1"), bad, D("0"), D("0"), D("0"))


def test_zero_purchase_denominators():
    for quantity, factor in [(D("0"), D("1")), (D("1"), D("0"))]:
        with pytest.raises(ValueError):
            acquisition_cost(quantity, factor, D("1"), D("0"), D("0"), D("0"))


def test_category_prefix_is_clean_and_predictable():
    assert category_prefix("Abarrotes, granos y condimentos") == "ABA"
    assert category_prefix("Pescados") == "PES"
    assert category_prefix("Verduras") == "VER"
    assert category_prefix("Té y café") == "TEC"


@pytest.mark.parametrize("dialect", [sqlite.dialect(), postgresql.dialect()])
def test_decimal_type_codec_is_exact_for_both_dialects(dialect):
    value = D("999999999999.123456")
    codec = ExactDecimal()
    encoded = codec.process_bind_param(value, dialect)
    assert encoded == "999999999999.123456"
    assert codec.process_result_value(encoded, dialect) == value
    with pytest.raises(ValueError):
        codec.process_bind_param(0.1, dialect)


def test_catalog_cost_history_dates_and_snapshots(catalog):
    app, client = catalog
    path = create_material(client, company_id=3)
    assert client.get(path).status_code == 200
    assert "Sin costo vigente" in client.get(path).get_data(as_text=True)
    assert client.post(path + "/costos/purchase", data=purchase_data()).status_code == 302
    for amount, day in [
        ("0.1", "2026-09-01"),
        ("999999999999.123456", "2027-01-01"),
        ("0", "2026-10-01"),
    ]:
        assert (
            client.post(
                path + "/costos/direct",
                data={"unit_cost": amount, "effective_on": day, "source": "Actualización"},
            ).status_code
            == 302
        )
    with app.app_context():
        m = db.session.scalar(db.select(Material))
        assert m.company_id == 1 and m.code == "SEC-001"
        assert len(m.costs) == 4
        assert effective_version(m.costs, date(2026, 8, 31)) is None
        assert version_result(effective_version(m.costs, date(2026, 9, 15))) == D("0.1")
        assert version_result(effective_version(m.costs, date(2026, 12, 31))) == D("0")
        assert version_result(effective_version(m.costs, date(2027, 1, 1))) == D(
            "999999999999.123456"
        )
        original = next(c for c in m.costs if c.mode == "purchase")
        assert original.factor == D("1000") and version_result(original) == D("0.085")
        stored = db.session.execute(
            text(
                "SELECT unit_cost, typeof(unit_cost) FROM material_cost_versions WHERE effective_on='2027-01-01'"
            )
        ).one()
        assert tuple(stored) == ("999999999999.123456", "text")
    assert "999999999999.123456" in client.get(path).get_data(as_text=True)  # history stays visible
    assert "0.1 / g" in client.get(path + "?fecha=2026-09-15").get_data(as_text=True)
    assert client.get(path + "?fecha=garbage").status_code == 400
    assert client.get("/empresas/1/materiales?q=harina").status_code == 200
    assert "Harina" not in client.get("/empresas/1/materiales?q=ausente").get_data(as_text=True)


def test_material_detail_quick_price_and_kardex_entry_are_exact_and_private(catalog):
    app, client = catalog
    path = create_material(client)
    page = client.get(path)
    assert page.status_code == 200
    assert "Historial de Precios de Compra" in page.text
    assert "Compras y Entradas (Kardex)" in page.text
    assert "price-update-dialog" in page.text

    response = client.post(
        path + "/precios",
        data={"unit_cost": "12.345678", "effective_on": "2026-09-15", "source": ""},
    )
    assert response.status_code == 302
    response = client.post(
        path + "/kardex/entradas",
        data={
            "quantity": "2.5",
            "purchase_unit": "unit:kg",
            "unit_price": "80.123456",
            "movement_on": "2026-09-16",
            "token": "a" * 32,
        },
    )
    assert response.status_code == 302
    assert response.location.endswith("#kardex")
    assert (
        client.post(
            path + "/kardex/entradas",
            data={
                "quantity": "2.5",
                "purchase_unit": "unit:kg",
                "unit_price": "80.123456",
                "movement_on": "2026-09-16",
                "token": "a" * 32,
            },
        ).status_code
        == 422
    )

    with app.app_context():
        movement = db.session.scalar(db.select(InventoryMovement))
        assert movement.company_id == 1 and movement.material_id == 1
        assert movement.quantity == D("2500")
        assert movement.unit_cost == D("0.080123456")
        material = db.session.get(Material, 1)
        assert len(material.costs) == 2
        assert {version_result(cost) for cost in material.costs} == {
            D("12.345678"),
            D("0.080123456"),
        }

    page = client.get(path)
    assert "price-chart-line" in page.text
    assert "0.080123456" in page.text
    assert client.post("/empresas/2/materiales/1/precios", data={}).status_code == 404


def test_unified_workspace_and_quick_material_with_initial_cost(catalog):
    app, client = catalog
    app.extensions["catalog_provider"] = type(
        "PrivateMaterialCatalog",
        (),
        {
            "categories": lambda self: [{"id_categoria": 1, "nombre": "Pruebas"}],
            "ingredients": lambda self, **kwargs: [],
        },
    )()
    page = client.get("/empresas/1/materiales")
    assert page.status_code == 200
    body = page.get_data(as_text=True)
    assert body.count("1. Insumos y Materia Prima") == 1
    assert "Insumos personalizados" not in body
    assert "Catálogo General" in page.get_data(as_text=True)
    assert "Mis Insumos / En Uso" in body
    for heading in (
        "ID",
        "Nombre",
        "Variedad",
        "Categoría",
        "Unidad",
        "Precio (PEN)",
        "Actualización",
        "Estado",
        "Acción",
    ):
        assert heading in body
    assert body.count("data-sortable-table") == 2
    assert body.count("data-material-sort-form") == 2
    assert body.count("Ordenar por...") == 2
    assert "data-sort-column" not in body
    assert "bi-arrow-down-up" not in body
    assert "INSUMO PRIVADO · Empresa 1" in body
    assert client.get("/empresas/1/catalogo").status_code == 200

    response = client.post(
        "/empresas/1/materiales/nuevo-rapido?tab=mios",
        data={
            "name": "Material rápido",
            "variety": "Presentación privada",
            "category": "Pruebas",
            "base_unit_code": "kg",
            "unit_cost": "12.50",
            "effective_on": "2026-09-29",
        },
    )
    assert response.status_code == 302
    assert response.location.endswith("/empresas/1/materiales?tab=mios")
    with app.app_context():
        material = db.session.scalar(db.select(Material))
        assert material.code == "PRU-001" and material.base_unit_code == "kg"
        assert material.variety == "Presentación privada"
        assert len(material.costs) == 1
        assert material.costs[0].unit_cost == D("12.50")
        assert material.costs[0].source == "Alta privada · Empresa 1"
    assert "Material rápido" not in client.get("/empresas/2/materiales?tab=mios").get_data(
        as_text=True
    )

    missing_price = client.post(
        "/empresas/1/materiales/nuevo-rapido?tab=mios",
        data={
            "name": "Sin precio",
            "variety": "Sin costo",
            "category": "Pruebas",
            "base_unit_code": "kg",
            "effective_on": "2026-09-29",
        },
    )
    assert missing_price.status_code == 422
    assert "Ingresa el precio por unidad base." in missing_price.get_data(as_text=True)
    with app.app_context():
        assert db.session.scalar(db.select(db.func.count()).select_from(Material)) == 1


def test_quick_material_codes_duplicates_and_company_scope(catalog):
    app, client = catalog
    app.extensions["catalog_provider"] = type(
        "CategoryCatalog",
        (),
        {
            "categories": lambda self: [{"id_categoria": 1, "nombre": "Abarrotes"}],
            "ingredients": lambda self, **kwargs: [],
        },
    )()

    def create(cid, name, variety=""):
        return client.post(
            f"/empresas/{cid}/materiales/nuevo-rapido?tab=mios",
            data={
                "name": name,
                "variety": variety,
                "category": "Abarrotes",
                "base_unit_code": "kg",
                "unit_cost": "10.123456",
                "effective_on": "2026-09-30",
            },
        )

    assert create(1, "Arroz", "Extra").status_code == 302
    assert create(1, "Arroz", "Económico").status_code == 302
    with app.app_context():
        first = db.session.scalar(
            db.select(Material).where(Material.company_id == 1).order_by(Material.id)
        )
        assert first.code == "ABA-001"
        first_id = first.id
    assert client.post(
        f"/empresas/1/materiales/{first_id}/estado", data={"state": "archived"}
    ).status_code == 302

    duplicate = create(1, "Arroz", "Extra")
    assert duplicate.status_code == 422
    assert "Ya existe" in duplicate.get_data(as_text=True)
    assert "registrar un precio nuevo" in duplicate.get_data(as_text=True)
    assert create(2, "Arroz", "Extra").status_code == 302

    with app.app_context():
        company_one = list(
            db.session.scalars(
                db.select(Material)
                .where(Material.company_id == 1)
                .order_by(Material.code)
            )
        )
        company_two = list(
            db.session.scalars(db.select(Material).where(Material.company_id == 2))
        )
        assert [material.code for material in company_one] == ["ABA-001", "ABA-002"]
        assert [material.code for material in company_two] == ["ABA-001"]
        assert all(cost.unit_cost == D("10.123456") for material in company_one for cost in material.costs)


@pytest.mark.parametrize(
    "field,value",
    [
        ("quantity", "0"),
        ("quantity", "-1"),
        ("quantity", "200 g"),
        ("quantity", "1e3"),
        ("net_amount", "NaN"),
        ("net_amount", "1.0000001"),
        ("net_amount", ""),
        ("attributable_cost", "-1"),
        ("recoverable_tax", "Infinity"),
        ("purchase_unit", "unit:l"),
        ("purchase_unit", "custom:999"),
        ("effective_on", "2026-02-30"),
        ("source", ""),
    ],
)
def test_purchase_validation_is_atomic(catalog, field, value):
    app, client = catalog
    path = create_material(client)
    assert (
        client.post(path + "/costos/purchase", data=purchase_data(**{field: value})).status_code
        == 422
    )
    with app.app_context():
        assert db.session.scalar(db.select(db.func.count()).select_from(MaterialCostVersion)) == 0


def test_custom_conversion_is_material_specific(catalog):
    app, client = catalog
    path = create_material(client)
    assert (
        client.post(
            path + "/conversiones/nueva",
            data={
                "label": "Atado medido",
                "factor": "250,125",
                "evidence": "Pesaje neto 2026-09-01",
            },
        ).status_code
        == 302
    )
    other = create_material(client, code="SEC-002", name="Harina integral")
    with app.app_context():
        cid = db.session.scalar(db.select(MaterialConversion.id))
    data = purchase_data(
        purchase_unit=f"custom:{cid}",
        quantity="2",
        net_amount="10",
        nonrecoverable_tax="0",
        attributable_cost="0",
    )
    assert client.post(other + "/costos/purchase", data=data).status_code == 422
    assert client.post(path + "/costos/purchase", data=data).status_code == 302
    with app.app_context():
        version = db.session.scalar(db.select(MaterialCostVersion))
        assert version.factor == D("250.125")
        assert version.purchase_unit == "Atado medido"
        assert version.conversion_evidence == "Pesaje neto 2026-09-01"
    for data in [
        {"label": "kg", "factor": "20", "evidence": "No"},
        {"label": "atado MEDIDO", "factor": "20", "evidence": "Otra"},
        {"label": "Bolsa", "factor": "0", "evidence": "Peso"},
        {"label": "Bolsa", "factor": "20", "evidence": ""},
    ]:
        assert client.post(path + "/conversiones/nueva", data=data).status_code == 422


def test_ownership_archive_base_and_code_rules(catalog):
    app, client = catalog
    path = create_material(client)
    mid = path.rsplit("/", 1)[1]
    for cid in (2, 3):
        foreign = f"/empresas/{cid}/materiales/{mid}"
        for suffix in ("", "/editar", "/costos/direct", "/costos/purchase", "/conversiones/nueva"):
            assert client.get(foreign + suffix).status_code == 404
        assert client.post(foreign + "/estado", data={"state": "archived"}).status_code == 404
        assert client.post(foreign + "/costos/purchase", data=purchase_data()).status_code == 404
    assert client.get("/empresas/3/materiales").status_code == 404
    assert (
        client.post(
            path + "/editar",
            data={"code": "SEC-001", "name": "Harina", "category": "Secos", "base_unit_code": "kg"},
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/empresas/1/materiales/nuevo",
            data={"code": "sec-001", "name": "Otro", "category": "Secos", "base_unit_code": "g"},
        ).status_code
        == 422
    )
    create_material(client, cid=2)  # same code is allowed in a different owned company
    assert client.post(path + "/estado", data={"state": "archived"}).status_code == 302
    assert client.post(path + "/costos/purchase", data=purchase_data()).status_code == 409
    assert client.get(path + "/editar").status_code == 409
    assert "Harina" not in client.get("/empresas/1/materiales").get_data(as_text=True)
    assert "Harina" in client.get("/empresas/1/materiales?estado=archivados").get_data(as_text=True)
    assert client.post(path + "/estado", data={"state": "active"}).status_code == 302
    assert client.get(path + "/editar").status_code == 200


def test_currency_lock_and_disabled_units(catalog):
    app, client = catalog
    path = create_material(client)
    assert client.post(path + "/costos/purchase", data=purchase_data()).status_code == 302
    with app.app_context():
        industry = db.session.get(Company, 1).industry_id
        db.session.get(CompanyUnit, (1, "kg")).enabled = False
        db.session.get(CompanyUnit, (1, "g")).enabled = False
        db.session.commit()
    response = client.post(
        "/empresas/1/editar",
        data={
            "legal_name": "Empresa editada",
            "industry_id": industry,
            "currency": "USD",
            "tax_id_kind": "other",
            "tax_id": "",
            "tax_percent": "",
        },
    )
    assert response.status_code == 422
    with app.app_context():
        assert db.session.get(Company, 1).currency == "PEN"
    assert client.post(path + "/costos/purchase", data=purchase_data()).status_code == 422
    assert (
        client.post(
            path + "/costos/purchase", data=purchase_data(purchase_unit="unit:g")
        ).status_code
        == 302
    )
    assert (
        client.post(
            "/empresas/1/materiales/nuevo",
            data={"code": "NEW", "name": "Nueva", "category": "Secos", "base_unit_code": "g"},
        ).status_code
        == 422
    )


def test_all_material_mutations_require_csrf(catalog):
    app, client = catalog
    path = create_material(client)
    app.config["WTF_CSRF_ENABLED"] = True
    for suffix in (
        "/editar",
        "/estado",
        "/costos/direct",
        "/costos/purchase",
        "/conversiones/nueva",
    ):
        assert client.post(path + suffix, data={}).status_code == 400
    assert client.post("/empresas/1/materiales/nuevo", data={}).status_code == 400
    assert client.post("/empresas/1/materiales/nuevo-rapido", data={}).status_code == 400
    html = client.get(path + "/costos/direct").get_data(as_text=True)
    token = re.search(r'name="csrf_token"[^>]*value="([^"]+)"', html).group(1)
    assert (
        client.post(
            path + "/costos/direct",
            data={
                "csrf_token": token,
                "unit_cost": "0,123456",
                "effective_on": "2026-09-01",
                "source": "Documento",
            },
        ).status_code
        == 302
    )


def test_cost_versions_cannot_be_overwritten_or_deleted(catalog):
    app, client = catalog
    path = create_material(client)
    assert client.post(path + "/costos/purchase", data=purchase_data()).status_code == 302
    with app.app_context():
        version = db.session.scalar(db.select(MaterialCostVersion))
        version.net_amount = D("999")
        with pytest.raises(ValueError, match="inmutable"):
            db.session.commit()
        db.session.rollback()
        version = db.session.scalar(db.select(MaterialCostVersion))
        assert version.net_amount == D("160")
        db.session.delete(version)
        with pytest.raises(ValueError, match="inmutable"):
            db.session.commit()
        db.session.rollback()
