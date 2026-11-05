import re
from decimal import Decimal as D

import pytest

from app.extensions import db
from app.models import (
    Budget,
    Company,
    Employee,
    Period,
    RecipeVersion,
)
from app.models.inventory import InventoryMovement
from app.models.planning import ProductionPlan
from app.services.planning import evaluate


@pytest.fixture
def flow(catalog):
    app, client = catalog
    with app.app_context():
        p = Period(company_id=1, year=2026, month=9)
        p.tax_rate = D(".18")
        other = Period(company_id=2, year=2026, month=9)
        other.tax_rate = D("0")
        db.session.add_all([p, other])
        db.session.commit()
    prefix = "/empresas/1/gestion"
    assert (
        client.post(
            prefix + "/personal/nuevo",
            data={"name": "Operario", "role": "Producción", "active": "y"},
        ).status_code
        == 302
    )
    payroll = dict(
        period_id=1,
        salary="2400",
        allowances="0",
        provisions="0",
        charges="0",
        other="0",
        source="Caso didáctico",
        days="20",
        hours="8",
        excluded="0",
        productive="80",
        mod="100",
        cif="0",
        admin="0",
        sales="0",
        basis="equivalent",
        justification="Una unidad equivalente por producto comparable",
    )
    r = client.post(prefix + "/personal/1/mes", data=payroll)
    assert r.status_code == 302, r.get_data(as_text=True)
    r = client.post(
        "/empresas/1/productos/nuevo",
        data={"name": "Producto completo", "output_quantity": "20", "output_unit_code": "unit"},
    )
    assert r.status_code == 302
    r = client.post(
        "/empresas/1/productos/1/insumos/nuevo",
        data={
            "revision": "1",
            "name": "Material base",
            "quantity": "1",
            "unit_key": "unit:kg",
            "price": "120",
            "price_unit_code": "kg",
            "mode": "gross",
            "percent": "0",
            "effective_on": "2026-09-01",
            "source": "Prueba",
        },
    )
    assert r.status_code == 302, r.get_data(as_text=True)
    with app.app_context():
        recipe = db.session.scalar(db.select(RecipeVersion).order_by(RecipeVersion.id.desc())).id
    assert (
        client.post(
            f"{prefix}/recetas/{recipe}/operaciones/agregar",
            data={"employee_id": "1", "activity": "Elaborar lote", "minutes": "160"},
        ).status_code
        == 302
    )
    for name, kind, amount in [
        ("Alquiler producción", "cif", "800"),
        ("Administración", "admin", "400"),
    ]:
        r = client.post(
            prefix + "/costos/nuevo",
            data=dict(
                period_id=1,
                name=name,
                kind=kind,
                amount=amount,
                basis="equivalent",
                behavior="fixed",
                justification="Unidades comparables de un producto",
                active="y",
            ),
        )
        assert r.status_code == 302, r.get_data(as_text=True)
    r = client.post(
        prefix + "/planes/nuevo",
        data={"name": "Plan base", "period_id": "1", "price_date": "2026-09-30", "assumption": "y"},
    )
    assert r.status_code == 302, r.get_data(as_text=True)
    plan = r.location
    line_data = dict(
        recipe_id=recipe,
        quantity="800",
        reference_price="15",
        equivalent_factor="1",
        pricing_mode="manual",
        pricing_value="17.7",
        adopted_price="",
        tax_percent="",
    )
    r = client.post(plan + "/lineas/nueva", data=line_data)
    assert r.status_code == 302, r.get_data(as_text=True)
    return app, client, prefix, plan, payroll, line_data, recipe


def fingerprint(client, plan):
    html = client.get(plan).get_data(as_text=True)
    return re.search(r'name="fingerprint"[^>]*value="([^"]+)"', html).group(1)


def publish(client, plan):
    with client.application.app_context():
        stocked = db.session.scalar(
            db.select(InventoryMovement.id).where(
                InventoryMovement.reference == "insumos para el plan"
            )
        )
    if not stocked:
        assert client.post(
            "/empresas/1/inventarios",
            data=dict(
                material_id="1",
                movement_on="2026-09-01",
                quantity="40",
                unit_cost="120",
                reference="Insumos para el plan",
                token="plan-stock",
            ),
        ).status_code == 302
    assert client.post(plan + "/calcular").status_code == 302
    r = client.post(plan + "/publicar", data={"fingerprint": fingerprint(client, plan)})
    assert "/presupuestos/" in r.location
    return r.location


def test_plan_publication_requires_inventory(flow):
    app, client, _, plan, _, _, _ = flow
    assert client.post(plan + "/calcular").status_code == 302
    response = client.post(plan + "/publicar", data={"fingerprint": fingerprint(client, plan)})
    assert response.location == plan
    assert "Insumos insuficientes" in client.get(plan).text
    with app.app_context():
        assert db.session.scalar(db.select(db.func.count()).select_from(Budget)) == 0
        assert db.session.scalar(db.select(db.func.count()).select_from(InventoryMovement)) == 0
    assert "/presupuestos/" in publish(client, plan)


def test_complete_workflow_snapshot_revision_and_reports(flow):
    app, client, prefix, plan, payroll, line_data, recipe = flow
    for path in (
        "/personal",
        "/personal/1/mes",
        "/costos",
        "/costos/1/editar",
        "/planes",
        "/presupuestos",
        "/reportes",
        f"/recetas/{recipe}/operaciones",
    ):
        assert client.get(prefix + path).status_code == 200, path
    assert client.get(plan).status_code == 200
    assert client.get(plan + "/editar").status_code == 200
    assert client.get(plan + "/lineas/1").status_code == 200
    with app.app_context():
        data, result, hash_ = evaluate(db.session.get(ProductionPlan, 1))
        assert result["status"] == "calculable", result["issues"]
        assert result["totals"]["profit"] == D("3600")
    budget = publish(client, plan)
    assert client.get(budget).status_code == 200
    snapshot = client.get(budget + "/descargar").json
    assert D(snapshot["result"]["totals"]["profit"]) == D("3600")
    assert publish(client, plan) == budget  # unchanged publication is idempotent
    with app.app_context():
        outputs = list(
            db.session.scalars(
                db.select(InventoryMovement).where(InventoryMovement.plan_id == 1)
            )
        )
        assert len(outputs) == 1
        assert outputs[0].company_id == 1
        assert outputs[0].quantity == D("40")
    assert client.post(plan + "/activar").status_code == 302
    assert "Plan base" in client.get("/dashboard").get_data(as_text=True)
    assert "3600.00" in client.get(prefix + "/reportes").get_data(as_text=True)
    assert (
        client.post(prefix + "/personal/1/mes", data=payroll | {"salary": "2600"}).status_code
        == 302
    )
    # Old saved fingerprint cannot publish after a payroll edit.
    assert client.post(plan + "/publicar", data={"fingerprint": hash_}).location == plan
    assert client.get(budget + "/descargar").json == snapshot
    new_budget = publish(client, plan)
    assert new_budget != budget
    assert client.post(budget + "/estado", data={"state": "archived"}).status_code == 302
    assert "Archivado" in client.get(budget).get_data(as_text=True)
    assert client.post(budget + "/estado", data={"state": "published"}).status_code == 302
    assert client.get(budget + "/descargar").json == snapshot
    with app.app_context():
        b = db.session.get(Budget, 1)
        b.snapshot = {"changed": True}
        with pytest.raises(ValueError, match="inmutable"):
            db.session.commit()
        db.session.rollback()


def test_plan_price_uses_kardex_average_on_reference_date(flow):
    from datetime import date

    app, client, _, plan_url, _, _, _ = flow
    with app.app_context():
        plan = db.session.get(ProductionPlan, 1)
        line = plan.lines[0]
        line.pricing_mode = "markup"
        line.pricing_value = D(".30")
        previous_price = evaluate(plan)[1]["rows"][0]["price"]["final"]
        db.session.add_all(
            [
                InventoryMovement(
                    company_id=1, material_id=1, movement_on=date(2026, 9, 1),
                    kind="in", quantity=D("50"), unit_cost=D("4"),
                    reference="Precio 4", voided=False,
                ),
                InventoryMovement(
                    company_id=1, material_id=1, movement_on=date(2026, 9, 2),
                    kind="in", quantity=D("50"), unit_cost=D("5"),
                    reference="Precio 5", voided=False,
                ),
                InventoryMovement(
                    company_id=1, material_id=1, movement_on=date(2026, 10, 1),
                    kind="in", quantity=D("100"), unit_cost=D("100"),
                    reference="Compra posterior", voided=False,
                ),
            ]
        )
        db.session.commit()
        data, result, _ = evaluate(plan)
        material = data["lines"][0]["materials"][0]
        assert material["unit_cost"] == D("4.5")
        assert material["price_source"] == "kardex"
        assert result["rows"][0]["cmp"] == D("0.225")
        assert result["rows"][0]["price"]["final"] < previous_price
        assert result["status"] == "calculable", result["issues"]
    assert client.get(plan_url).status_code == 200


def test_plan_does_not_suggest_price_with_pending_kardex(flow):
    from datetime import date

    app, _, _, _, _, _, _ = flow
    with app.app_context():
        db.session.add_all(
            [
                InventoryMovement(
                    company_id=1, material_id=1, movement_on=date(2026, 9, 1),
                    kind="in", quantity=D("1"), unit_cost=D("4"),
                    reference="Entrada insuficiente", voided=False,
                ),
                InventoryMovement(
                    company_id=1, material_id=1, movement_on=date(2026, 9, 2),
                    kind="out", quantity=D("2"), unit_cost=D("0"),
                    reference="Salida anterior", voided=False,
                ),
            ]
        )
        db.session.commit()
        _, result, _ = evaluate(db.session.get(ProductionPlan, 1))
        assert result["status"] == "incompleto"
        assert result["rows"][0]["price"] is None
        assert any("kardex" in issue for issue in result["issues"])


def test_cross_company_references_and_csrf(flow):
    app, client, prefix, plan, payroll, line_data, recipe = flow
    for cid in (2, 3):
        foreign = f"/empresas/{cid}/gestion"
        for path in (
            "/personal/1/editar",
            "/personal/1/mes",
            "/costos/1/editar",
            "/planes/1",
            "/planes/1/editar",
            f"/recetas/{recipe}/operaciones",
        ):
            assert client.get(foreign + path).status_code == 404, path
        assert client.post(foreign + "/planes/1/calcular").status_code == 404
    assert (
        client.post(
            prefix + "/costos/nuevo",
            data=dict(
                period_id=2,
                name="Ajeno",
                kind="cif",
                amount="1",
                basis="equivalent",
                behavior="fixed",
                justification="No",
                active="y",
            ),
        ).status_code
        == 422
    )
    assert (
        client.post(
            prefix + "/costos/nuevo",
            data=dict(
                period_id=1,
                name="Ajeno",
                kind="cif",
                amount="1",
                basis="equivalent",
                behavior="fixed",
                justification="No",
                targets=["999"],
                active="y",
            ),
        ).status_code
        == 422
    )
    assert (
        client.post(plan + "/lineas/nueva", data=line_data | {"recipe_id": "999"}).status_code
        == 422
    )
    assert (
        client.post(
            f"{prefix}/recetas/{recipe}/operaciones/agregar",
            data={"employee_id": "999", "activity": "Ajena", "minutes": "5"},
        ).status_code
        == 422
    )
    budget = publish(client, plan)
    assert client.get(budget.replace("/empresas/1/", "/empresas/2/")).status_code == 404
    app.config["WTF_CSRF_ENABLED"] = True
    for path in (
        plan + "/publicar",
        plan + "/calcular",
        plan + "/activar",
        plan + "/lineas/1/quitar",
        prefix + "/personal/1/mes",
        prefix + "/costos/1/editar",
        f"{prefix}/recetas/{recipe}/operaciones",
        budget + "/estado",
    ):
        assert client.post(path, data={}).status_code == 400, path


def test_capacity_invalid_percent_and_currency_lock(flow):
    app, client, prefix, plan, payroll, line_data, recipe = flow
    assert client.post(plan + "/lineas/1", data=line_data | {"quantity": "1000"}).status_code == 302
    assert client.post(plan + "/calcular").status_code == 302
    assert (
        client.post(plan + "/publicar", data={"fingerprint": fingerprint(client, plan)}).location
        == plan
    )
    with app.app_context():
        assert db.session.scalar(db.select(db.func.count()).select_from(Budget)) == 0
    assert client.post(prefix + "/personal/1/mes", data=payroll | {"mod": "50"}).status_code == 422
    assert (
        client.post(prefix + "/personal/1/mes", data=payroll | {"excluded": "999999"}).status_code
        == 422
    )
    assert (
        client.post(
            plan + "/lineas/1", data=line_data | {"pricing_mode": "margin", "pricing_value": "100"}
        ).status_code
        == 422
    )


def test_missing_monthly_staff_and_explicit_empty_recipe(flow):
    app, client, prefix, plan, payroll, line_data, recipe = flow
    with app.app_context():
        cid = db.session.get(Company, 1).industry_id
        employee = Employee(company_id=1, name="Administración sin mes", role="Administración")
        db.session.add(employee)
        db.session.commit()
        _, result, _ = evaluate(db.session.get(ProductionPlan, 1))
        assert result["status"] == "incompleto"
        assert any("falta configurar su costo mensual" in s for s in result["issues"])
    r = client.post(
        "/empresas/1/productos/nuevo",
        data={"name": "Sin componentes", "output_quantity": "1", "output_unit_code": "unit"},
    )
    assert r.status_code == 302
    with app.app_context():
        rid = db.session.scalar(db.select(RecipeVersion.id).order_by(RecipeVersion.id.desc()))
    assert client.get(f"{prefix}/recetas/{rid}/operaciones").status_code == 200
    assert (
        client.post(
            f"{prefix}/recetas/{rid}/operaciones", data={"no_materials": "y", "no_labor": "y"}
        ).status_code
        == 302
    )
    assert (
        client.post(
            "/empresas/1/editar",
            data={
                "legal_name": "Empresa",
                "currency": "USD",
                "industry_id": cid,
                "tax_id_kind": "other",
                "tax_percent": "",
            },
        ).status_code
        == 422
    )
