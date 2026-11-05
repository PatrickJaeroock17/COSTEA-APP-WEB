from decimal import Decimal as D

from test_sales import setup_sale

from app.extensions import db
from app.models import Sale
from app.models.inventory import InventoryMovement
from app.services.inventory import ledger


def receipt(client, quantity="10", cost="80", reference="Inicial", day="2026-09-01"):
    return client.post(
        "/empresas/1/inventarios",
        data=dict(
            material_id="1",
            movement_on=day,
            quantity=quantity,
            unit_cost=cost,
            reference=reference,
            token="receipt-test",
        ),
    )


def test_weighted_average_sales_and_reversal(catalog):
    app, client, _ = setup_sale(catalog, with_stock=False)
    assert receipt(client).status_code == 302
    assert receipt(client, "20", "78", "Compra 2", "2026-09-02").status_code == 302
    assert receipt(client, "20", "78", "Compra 2", "2026-09-02").status_code == 422
    with app.app_context():
        rows = ledger(1, 1)
        assert rows[-1]["quantity"] == 30 and rows[-1]["value"] == 2360
        assert rows[-1]["average"] == D("2360") / 30
    response = client.post(
        "/empresas/1/ventas", data=dict(product_id="1", sold_on="2026-09-23", quantity="18")
    )
    assert response.status_code == 302, response.text  # recipe 250g x18 = 4.5kg
    with app.app_context():
        row = ledger(1, 1)[-1]
        assert row["movement"].quantity == D("4.5")
        assert row["quantity"] == D("25.5")
        assert abs(row["cost"] - D("354")) < D("1e-20")
        assert abs(row["value"] - D("2006")) < D("1e-20")
    assert client.post("/empresas/1/ventas/1/eliminar").status_code == 302
    with app.app_context():
        assert ledger(1, 1)[-1]["quantity"] == 30
        assert db.session.scalar(
            db.select(InventoryMovement).where(InventoryMovement.kind == "out")
        ).voided
    assert client.get("/empresas/1/inventarios").status_code == 200
    assert client.get("/empresas/3/inventarios").status_code == 404
    assert client.get("/empresas/2/inventarios?insumo=1").status_code == 404


def test_recipe_and_sale_use_weighted_kardex_price(catalog):
    from datetime import date

    from app.models import Product
    from app.routes.products import calculation

    app, client, path = setup_sale(catalog, with_stock=False)
    assert receipt(client, "2", "4", "Arroz a cuatro", "2026-09-01").status_code == 302
    assert receipt(client, "3", "5", "Arroz a cinco", "2026-09-02").status_code == 302
    with app.app_context():
        recipe = db.session.get(Product, 1).recipes[-1]
        assert calculation(recipe, date(2026, 9, 1))[2] == D("1")
        assert calculation(recipe, date(2026, 9, 2))[2] == D("1.15")
    page = client.get(path).get_data(as_text=True)
    assert "Promedio del kardex" in page
    assert "4.60" in page and "1.15" in page
    assert client.post(
        "/empresas/1/ventas",
        data={"product_id": "1", "sold_on": "2026-09-23", "quantity": "1"},
    ).status_code == 302
    with app.app_context():
        assert db.session.get(Sale, 1).unit_cost == D("1.15")


def test_pending_kardex_price_is_identified(catalog):
    from datetime import date

    from app.models import Product
    from app.routes.products import ingredient_prices

    app, client, _ = setup_sale(catalog, with_stock=False)
    assert receipt(client, "1", "4", "Compra", "2026-09-01").status_code == 302
    with app.app_context():
        db.session.add(
            InventoryMovement(
                company_id=1,
                material_id=1,
                movement_on=date(2026, 9, 2),
                kind="out",
                quantity=D("2"),
                unit_cost=D("0"),
                reference="Salida histórica anterior al control de stock",
                voided=False,
            )
        )
        db.session.commit()
        recipe = db.session.get(Product, 1).recipes[-1]
        assert ingredient_prices(recipe, date(2026, 9, 23))[0]["source"] == "pending"


def test_sale_without_entries_is_rejected_then_purchase_allows_it(catalog):
    app, client, _ = setup_sale(catalog, with_stock=False)
    payload = dict(product_id="1", sold_on="2026-09-23", quantity="15")
    response = client.post("/empresas/1/ventas", data=payload)
    assert response.status_code == 422
    assert "Insumos insuficientes en el inventario" in response.text
    with app.app_context():
        assert db.session.scalar(db.select(db.func.count()).select_from(Sale)) == 0
        assert ledger(1, 1) == []
    assert receipt(client, "5", "70", "Inicial", "2026-09-01").status_code == 302
    assert client.post("/empresas/1/ventas", data=payload).status_code == 302
    with app.app_context():
        assert ledger(1, 1)[-1]["value"] == D("87.50")


def test_stock_alert_and_backdated_sale_limit(catalog):
    app, client, _ = setup_sale(catalog, with_stock=False)
    assert receipt(client, "0.5", "4").status_code == 302
    page = client.get("/empresas/1/inventarios?insumo=1").text
    assert "Stock bajo" not in page
    sale = dict(product_id="1", sold_on="2026-09-23", quantity="1")
    assert client.post("/empresas/1/ventas", data=sale).status_code == 302
    page = client.get("/empresas/1/inventarios?insumo=1").text
    assert "Stock bajo" in page
    assert "Existencia real: 0.25 kg" in page
    assert client.post("/empresas/1/ventas", data=sale).status_code == 302
    page = client.get("/empresas/1/inventarios?insumo=1").text
    assert "Sin stock" in page
    assert "Existencia real: 0 kg" in page
    assert "Faltan 0.25 kg" in page
    response = client.post("/empresas/1/ventas", data=sale | {"sold_on": "2026-09-02", "quantity": "1"})
    assert response.status_code == 422
    assert "Insumos insuficientes en el inventario" in response.text
    with app.app_context():
        assert db.session.scalar(db.select(db.func.count()).select_from(Sale)) == 2
        assert ledger(1, 1)[-1]["quantity"] == 0


def test_receipt_scope_and_csrf(catalog):
    app, client, _ = setup_sale(catalog, with_stock=False)
    assert (
        client.post(
            "/empresas/2/inventarios",
            data=dict(
                material_id="1",
                movement_on="2026-09-01",
                quantity="10",
                unit_cost="80",
                reference="Ajeno",
                token="t",
            ),
        ).status_code
        == 422
    )
    app.config["WTF_CSRF_ENABLED"] = True
    assert receipt(client).status_code == 400


def test_fifteen_plates_consume_five_kg_from_frozen_recipe(catalog):
    app, client, path = setup_sale(catalog, with_stock=False)
    from test_products import edit_data

    from app.models import Product

    with app.app_context():
        product = db.session.get(Product, 1)
        line = product.recipes[-1].lines[0]
        line_id, cost_id = line.id, line.cost_version_id
    assert (
        client.post(
            path + f"/insumos/{line_id}/editar",
            data=edit_data(quantity="1000", cost_id=str(cost_id), mode="gross", percent="0"),
        ).status_code
        == 302
    )
    assert receipt(client, "10", "80").status_code == 302
    assert (
        client.post(
            path + "/editar",
            data=dict(revision="3", name="Ceviche", output_quantity="3", output_unit_code="unit"),
        ).status_code
        == 302
    )
    assert (
        client.post(
            "/empresas/1/ventas", data=dict(product_id="1", sold_on="2026-09-23", quantity="15")
        ).status_code
        == 302
    )
    with app.app_context():
        row = ledger(1, 1)[-1]
        assert row["movement"].quantity == 5 and row["quantity"] == 5
        assert row["cost"] == 400


def test_recipe_is_not_offered_as_stock_entry_and_historical_sales_are_idempotent(catalog):
    app, client, _ = setup_sale(catalog, with_stock=False)
    from datetime import date

    from app.models import Product
    from app.services.inventory_sources import sync_saved_sales

    with app.app_context():
        recipe = db.session.get(Product, 1).recipes[-1]
        db.session.add(
            Sale(
                company_id=1,
                product_id=1,
                recipe_id=recipe.id,
                sold_on=date(2026, 9, 23),
                quantity=D("1"),
                unit_price=D("118"),
                unit_cost=D("20"),
            )
        )
        db.session.commit()
        sync_saved_sales(1)
        sync_saved_sales(1)
        db.session.commit()
        assert db.session.scalar(db.select(db.func.count()).select_from(InventoryMovement)) == 1
    page = client.get("/empresas/1/inventarios")
    assert page.status_code == 200
    assert 'name="quantity"' not in page.text and 'name="unit_cost"' not in page.text
    assert "Insumo de plato" not in page.text
    payload = dict(source="Insumo de plato #1/1")
    assert client.post("/empresas/2/inventarios", data=payload).status_code == 422
    assert client.post("/empresas/1/inventarios", data=payload).status_code == 422
    with app.app_context():
        rows = ledger(1, 1)
        assert len(rows) == 1
        assert rows[0]["movement"].kind == "out"
        assert rows[0]["quantity"] == D("-0.250")
        assert rows[0]["value"] is None


def test_recipe_consumption_is_consolidated_once_per_material(catalog):
    from test_products import edit_data, new_product

    from app.models import Material
    from app.services.inventory_sources import (
        recipe_requirements,
        saved_entries,
        simulated_recipe_outputs,
    )

    app, client, _ = setup_sale(catalog, with_stock=False)
    second = new_product(client, name="Arroz con pescado")
    response = client.post(
        second + "/insumos/catalogo/1",
        data=edit_data(revision="1", quantity="100", cost_id="1"),
    )
    assert response.status_code == 302, response.get_data(as_text=True)
    with app.app_context():
        material = db.session.get(Material, 1)
        material.name = "Papa"
        material.variety = "Amarilla"
        db.session.commit()
        rows = recipe_requirements(1)
        assert len(rows) == 1
        assert rows[0]["quantity"] == D("0.35")
        assert rows[0]["dishes"] == ["Arroz con pescado", "Ceviche"]
        assert saved_entries(1) == []
        simulated = simulated_recipe_outputs(1, rows)[0]
        assert simulated["projected_quantity"] == D("-0.35")
        assert simulated["cost"] is None
    page = client.get("/empresas/1/inventarios?plato=1").get_data(as_text=True)
    assert "Salidas de recetas en el kardex" not in page
    assert 'id="salidas-receta"' not in page
    assert "Papa - Amarilla" in page
    assert "SALIDA" in page
    assert 'name="plato" value="1"' in page
    individual_kardex = page.split('id="kardex-insumo"', 1)[1]
    assert individual_kardex.count("Salida simulada · receta vigente") == 1
    assert "Arroz con pescado, Ceviche · saldo proyectado" in individual_kardex
    assert "<td>0.35</td>" in individual_kardex
    assert "<td>-0.35</td>" in individual_kardex
    assert "Sin movimientos registrados" not in individual_kardex
    assert receipt(client, "1", "4").status_code == 302
    individual_kardex = client.get("/empresas/1/inventarios?insumo=1").text.split(
        'id="kardex-insumo"', 1
    )[1]
    assert "<td>1.40</td>" in individual_kardex
    assert "<td>0.65</td>" in individual_kardex
    with app.app_context():
        simulated = simulated_recipe_outputs(1, recipe_requirements(1))[0]
        assert simulated["projected_quantity"] == D("0.65")
        assert simulated["cost"] == D("1.40")
        assert ledger(1, 1)[-1]["quantity"] == D("1")


def test_saved_purchase_uses_quantity_conversion_and_acquisition_cost(catalog):
    from test_materials import purchase_data

    from app.services.inventory_sources import saved_entries

    app, client, _ = setup_sale(catalog, with_stock=False)
    assert (
        client.post("/empresas/1/materiales/1/costos/purchase", data=purchase_data()).status_code
        == 302
    )
    with app.app_context():
        entries = saved_entries(1)
        assert len(entries) == 1  # Do not also offer this material's recipe as a purchase.
        entry = entries[0]
        assert entry["quantity"] == D("2") and entry["unit_cost"] == D("85")
        key = entry["key"]
    assert client.post("/empresas/1/inventarios", data={"source": key}).status_code == 302
    with app.app_context():
        row = ledger(1, 1)[-1]
        assert row["quantity"] == 2 and row["value"] == 170
