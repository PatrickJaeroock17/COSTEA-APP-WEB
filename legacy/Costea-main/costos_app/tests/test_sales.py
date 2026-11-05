"""Actual sales: IGV, break-even, persistence, isolation and history."""

from datetime import date
from decimal import Decimal as D
from types import SimpleNamespace

from test_products import ingredient, new_product

from app.extensions import db
from app.models import CostConcept, Period, ProductPrice, Sale
from app.services.sales import monthly_results, summarize


def sample(quantity="10", price="118", cost="40", product_id=1):
    return SimpleNamespace(
        product_id=product_id,
        product=SimpleNamespace(name=f"Plato {product_id}"),
        quantity=D(quantity),
        unit_price=D(price),
        unit_cost=D(cost),
    )


def test_break_even_and_tax():
    r = summarize([sample()], fixed=D("300"), other_variable=D("100"))
    assert r["gross"] == 1180
    assert r["net"] == 1000
    assert r["tax"] == 180
    assert r["costs"] == 800
    assert r["profit"] == 200
    assert r["ratio"] == D("0.5")
    assert r["equilibrium"] == 600
    assert r["equilibrium_gross"] == 708
    assert r["rows"][0]["profit"] == 200


def test_no_sales_loss_and_zero_fixed():
    empty = summarize([], fixed=D("100"))
    assert empty["equilibrium"] is None and empty["profit"] == -100
    assert summarize([sample(cost="100")])["equilibrium"] is None
    assert summarize([sample(cost="110")])["equilibrium"] is None
    assert summarize([sample()])["equilibrium"] == 0
    r = summarize([sample(), sample(quantity="20", product_id=2)], D("500"), D("100"))
    assert r["rows"][0]["name"] == "Plato 2"
    assert abs(sum(row["profit"] for row in r["rows"]) - r["profit"]) < D("0.00000001")


def setup_sale(catalog, with_stock=True):
    app, client = catalog
    path = new_product(client)
    assert client.post(path + "/insumos/nuevo", data=ingredient()).status_code == 302
    with app.app_context():
        db.session.add(Period(company_id=1, year=2026, month=9))
        db.session.commit()
    assert (
        client.post("/empresas/1/precios", data={"product_id": "1", "amount": "118"}).status_code
        == 302
    )
    if with_stock:
        assert (
            client.post(
                "/empresas/1/inventarios",
                data=dict(
                    material_id="1",
                    movement_on="2026-09-01",
                    quantity="1000",
                    unit_cost="80",
                    reference="Existencias para pruebas de ventas",
                    token="test-stock",
                ),
            ).status_code
            == 302
        )
    return app, client, path


def test_sales_flow_history_and_company_isolation(catalog):
    app, client, path = setup_sale(catalog)
    data = {"product_id": "1", "sold_on": "2026-09-23", "quantity": "10"}
    assert client.post("/empresas/1/ventas", data=data).status_code == 302
    assert (
        client.post("/empresas/1/precios", data={"product_id": "1", "amount": "236"}).status_code
        == 302
    )
    for url in ("/empresas/1/precios", "/empresas/1/ventas", "/dashboard"):
        response = client.get(url)
        assert response.status_code == 200, response.get_data(as_text=True)
    home = client.get("/dashboard").get_data(as_text=True)
    assert "Cómo completar el costo" in home
    assert "Balance de ventas registradas" not in home
    assert client.post("/empresas/2/ventas", data=data).status_code == 422
    assert (
        client.post("/empresas/2/precios", data={"product_id": 1, "amount": 50}).status_code == 422
    )
    assert client.get("/empresas/3/ventas").status_code == 404
    assert client.post("/empresas/2/ventas/1/eliminar").status_code == 404
    assert (
        client.post("/empresas/1/ventas", data=data | {"sold_on": "2026-10-01"}).status_code == 422
    )
    assert client.post("/empresas/1/ventas", data=data | {"quantity": "-1"}).status_code == 422
    with app.app_context():
        sale = db.session.get(Sale, 1)
        assert sale.unit_price == D("118") and sale.unit_cost == D("20")
        assert db.session.get(ProductPrice, 1).amount == D("236")
        period = db.session.scalar(db.select(Period))
        db.session.add(
            CostConcept(
                company_id=1,
                period_id=period.id,
                name="Alquiler",
                kind="cif",
                amount=D("300"),
                behavior="fixed",
                basis="units",
                justification="Mensual",
                targets=[],
            )
        )
        db.session.commit()
        actual = monthly_results(1, period)
        assert actual["net"] == 1000 and actual["profit"] == 500
        assert actual["equilibrium"] == 375
    assert client.post("/empresas/1/ventas/1/eliminar").status_code == 302
    with app.app_context():
        assert db.session.get(Sale, 1) is None


def test_recipe_detail_cost_flow_and_final_price(catalog):
    app, client, path = setup_sale(catalog)
    page = client.get(path).text
    assert page.index("Costo de materia prima") < page.index("INSUMOS DE TODA LA RECETA")
    assert page.count('data-dialog-open="recipe-ingredient-dialog"') == 1
    assert page.count('data-dialog-open="recipe-adjust-dialog"') == 1
    assert page.count('class="recipe-private-add"') == 1
    assert "/empresas/1/materiales?plato=1&amp;tab=catalogo" in page
    assert 'data-recipe-tab=' not in page
    assert page.index("2 · Mano de obra directa") < page.index("3 · CIF y gastos")
    assert page.index("3 · CIF y gastos") < page.index('id="costo-completo"')
    assert "Aún no hay un plan de producción" in page
    assert page.count('name="amount"') == 1
    assert 'id="recipe-sale-dialog"' not in page
    assert "Kardex y entradas" in page
    assert "/empresas/1/materiales/1#kardex" in page

    response = client.post(
        "/empresas/1/precios",
        data={"product_id": "1", "amount": "139.99", "return_to": "recipe"},
    )
    assert response.status_code == 302
    assert response.location.endswith(path + "#costo-completo")
    assert "PEN 139.99" in client.get(response.location).text
    with app.app_context():
        assert db.session.get(ProductPrice, 1).amount == D("139.99")
    assert (
        client.post(
            "/empresas/2/precios",
            data={"product_id": "1", "amount": "1", "return_to": "recipe"},
        ).status_code
        == 422
    )


def test_missing_prices_recipes_bad_price_and_csrf(catalog):
    app, client = catalog
    new_product(client)
    with app.app_context():
        db.session.add(Period(company_id=1, year=2026, month=9))
        db.session.commit()
    for price in ("0", "0.001", "-1", "NaN", "Infinity"):
        assert (
            client.post("/empresas/1/precios", data={"product_id": 1, "amount": price}).status_code
            == 422
        )
    assert (
        client.post(
            "/empresas/1/ventas",
            data={"product_id": 1, "sold_on": date(2026, 9, 23), "quantity": 1},
        ).status_code
        == 422
    )
    app.config["WTF_CSRF_ENABLED"] = True
    assert (
        client.post("/empresas/1/precios", data={"product_id": 1, "amount": 10}).status_code == 400
    )
    assert client.post("/empresas/1/ventas/1/eliminar").status_code == 400
