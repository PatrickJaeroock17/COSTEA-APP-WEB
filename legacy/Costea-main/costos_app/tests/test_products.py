"""Product-first costing: restaurant example, sector vocabulary, history and isolation."""

import re
from decimal import Decimal

import pytest

from app.extensions import db
from app.models import (
    Company,
    Industry,
    Material,
    MaterialCostVersion,
    Product,
    RecipeLine,
    RecipeVersion,
)
from app.services.recipes import LineInput, calculate_line, money_text, recipe_totals

D = Decimal


def new_product(client, **overrides):
    data = {
        "name": "Ceviche",
        "description": "Receta de prueba",
        "output_quantity": "1",
        "output_unit_code": "unit",
    } | overrides
    response = client.post("/empresas/1/productos/nuevo", data=data)
    assert response.status_code == 302, response.get_data(as_text=True)
    return response.location


def ingredient(**overrides):
    return {
        "revision": "1",
        "name": "Pescado",
        "quantity": "250",
        "unit_key": "unit:g",
        "price": "80",
        "price_unit_code": "kg",
        "effective_on": "2026-09-01",
        "source": "Precio de prueba",
        "mode": "gross",
        "percent": "0",
    } | overrides


def edit_data(**overrides):
    return {
        "revision": "2",
        "quantity": "250",
        "unit_key": "unit:g",
        "mode": "gross",
        "percent": "0",
        "cost_id": "1",
        "new_price": "",
        "effective_on": "2026-09-01",
    } | overrides


@pytest.mark.parametrize(
    "mode,rate,gross,amount",
    [
        ("gross", "0", "0.25", "20"),
        ("loss", "0.2", "0.3125", "25"),
        ("additional", "0.2", "0.30", "24"),
    ],
)
def test_reference_recipe_arithmetic(mode, rate, gross, amount):
    result = calculate_line(LineInput(D("250"), D("0.001"), D("80"), mode, D(rate)))
    assert result.gross_quantity == D(gross)
    assert result.amount == D(amount)


def test_lot_and_rounding_and_empty_recipe():
    results, total, per_unit = recipe_totals([LineInput(D("3"), D("1"), D("40"))], D("20"))
    assert total == D("120") and per_unit == D("6")
    assert per_unit * D("100") == D("600")
    assert recipe_totals([], D("1")) == ([], None, None)
    assert money_text(D("2.345")) == "2.35"
    assert money_text(None) == "—"
    # Do not round each line before summing.
    _, total, _ = recipe_totals([LineInput(D("1"), D("1"), D("0.004"))] * 3, D("1"))
    assert total == D("0.012") and money_text(total) == "0.01"


@pytest.mark.parametrize(
    "line",
    [
        LineInput(D("0"), D("1"), D("1")),
        LineInput(D("1"), D("0"), D("1")),
        LineInput(D("1"), D("1"), D("-1")),
        LineInput(D("1"), D("1"), D("1"), "loss", D("1")),
        LineInput(D("1"), D("1"), D("1"), "gross", D("0.2")),
        LineInput(D("1"), D("1"), D("NaN")),
    ],
)
def test_invalid_recipe_calculation(line):
    with pytest.raises(ValueError):
        calculate_line(line)


@pytest.mark.parametrize(
    "sector,label,name_label",
    [
        ("restaurantes", "Platos y recetas", "Nombre del plato"),
        ("textil", "Platos y recetas", "Nombre del plato"),
        ("muebles", "Platos y recetas", "Nombre del plato"),
        ("imprenta", "Platos y recetas", "Nombre del plato"),
    ],
)
def test_four_sector_workflow(catalog, sector, label, name_label):
    app, client = catalog
    with app.app_context():
        db.session.get(Company, 1).industry_id = db.session.scalar(
            db.select(Industry.id).where(Industry.slug == sector)
        )
        db.session.commit()
    assert label in client.get("/empresas/1/productos").get_data(as_text=True)
    assert name_label in client.get("/empresas/1/productos/nuevo").get_data(as_text=True)
    path = new_product(client)
    assert client.post(path + "/insumos/nuevo", data=ingredient()).status_code == 302
    html = client.get(path).get_data(as_text=True)
    assert "PEN 20.00" in html and "250 g" in html and "80 / kg" in html
    assert client.get("/empresas/1/productos").status_code == 200


def test_full_recipe_edit_history_cost_freeze_and_removal(catalog):
    app, client = catalog
    path = new_product(client, output_quantity="20")
    assert client.post(path + "/insumos/nuevo", data=ingredient(quantity="1500")).status_code == 302
    with app.app_context():
        product = db.session.scalar(db.select(Product))
        assert product.revision == 2
        line = product.recipes[-1].lines[0]
        lid, mid, cost_id = line.id, line.material_id, line.cost_version_id
        assert line.factor == D("0.001")
        assert line.cost_version.unit_cost == D("80")
        assert len(product.recipes[0].lines) == 0
    assert "PEN 6.00" in client.get(path).get_data(as_text=True)
    # Updating shared catalogue prices does not silently alter a recipe.
    assert (
        client.post(
            f"/empresas/1/materiales/{mid}/costos/direct",
            data={"unit_cost": "100", "effective_on": "2026-09-02", "source": "Cotización nueva"},
        ).status_code
        == 302
    )
    assert "PEN 6.00" in client.get(path).get_data(as_text=True)
    assert client.get(path + f"/insumos/{lid}/editar").status_code == 200
    assert (
        client.post(
            path + f"/insumos/{lid}/editar",
            data=edit_data(quantity="1500", cost_id=str(cost_id), new_price="90"),
        ).status_code
        == 302
    )
    assert "PEN 6.75" in client.get(path).get_data(as_text=True)
    assert "PEN 6.00" in client.get(path + "?version=2").get_data(as_text=True)
    # A stale browser must not overwrite the newer recipe, including inline catalog writes.
    assert (
        client.post(
            path + "/insumos/nuevo", data=ingredient(revision="2", name="Arroz")
        ).status_code
        == 409
    )
    with app.app_context():
        product = db.session.scalar(db.select(Product))
        latest_line = product.recipes[-1].lines[0].id
        assert db.session.scalar(db.select(db.func.count()).select_from(Material)) == 1
    assert (
        client.post(path + f"/insumos/{latest_line}/quitar", data={"revision": "3"}).status_code
        == 302
    )
    assert "Todavía no hay insumos" in client.get(path).get_data(as_text=True)
    assert "PEN 6.75" in client.get(path + "?version=3").get_data(as_text=True)
    assert client.get(path + "?version=999").status_code == 404


def test_scale_recipe_updates_all_quantities_and_preserves_history(catalog):
    app, client = catalog
    path = new_product(client, output_quantity="2")
    assert client.post(path + "/insumos/nuevo", data=ingredient(quantity="100")).status_code == 302
    from test_inventory import receipt

    assert receipt(client, "0.5", "80").status_code == 302

    response = client.post(path + "/escalar", data={"revision": "2", "output_quantity": "10"})
    assert response.status_code == 302
    with app.app_context():
        product = db.session.scalar(db.select(Product))
        assert product.revision == 3
        assert product.recipes[-1].output_quantity == D("10")
        assert product.recipes[-1].lines[0].quantity == D("500")
        assert product.recipes[-2].output_quantity == D("2")
        assert product.recipes[-2].lines[0].quantity == D("100")
    page = client.get(path).get_data(as_text=True)
    assert "Receta escalada proporcionalmente" in page
    assert ">500<" in page and ">g<" in page


@pytest.mark.parametrize(
    "field,value",
    [
        ("quantity", "0"),
        ("quantity", "200 g"),
        ("price", "-1"),
        ("price", ""),
        ("unit_key", "unit:l"),
        ("unit_key", "custom:99"),
        ("percent", "100"),
        ("name", ""),
        ("price_unit_code", "not-a-unit"),
    ],
)
def test_quick_entry_validation_rolls_back_everything(catalog, field, value):
    app, client = catalog
    path = new_product(client)
    data = ingredient(**{field: value})
    if field == "percent":
        data["mode"] = "loss"
    assert client.post(path + "/insumos/nuevo", data=data).status_code == 422
    with app.app_context():
        assert db.session.scalar(db.select(db.func.count()).select_from(Material)) == 0
        assert db.session.scalar(db.select(db.func.count()).select_from(MaterialCostVersion)) == 0
        assert db.session.scalar(db.select(Product)).revision == 1


def test_catalog_duplicate_crosscompany_cost_and_csrf(catalog):
    app, client = catalog
    path = new_product(client)
    assert client.post(path + "/insumos/nuevo", data=ingredient()).status_code == 302
    with app.app_context():
        line = db.session.scalar(db.select(RecipeLine))
        lid, mid, cid = line.id, line.material_id, line.cost_version_id
        pid = db.session.scalar(db.select(Product.id))
    assert (
        client.post(
            path + "/insumos/nuevo", data=ingredient(revision="2", name="pEsCaDo")
        ).status_code
        == 422
    )
    assert client.post(path + f"/insumos/catalogo/{mid}", data=edit_data()).status_code == 422
    other = new_product(client, name="Otro plato")
    assert (
        client.post(
            other + f"/insumos/catalogo/{mid}", data=edit_data(revision="1", cost_id=str(cid))
        ).status_code
        == 302
    )
    for owner in (2, 3):
        base = f"/empresas/{owner}/productos/{pid}"
        for suffix in ("", "/editar", f"/insumos/{lid}/editar", f"/insumos/catalogo/{mid}"):
            assert client.get(base + suffix).status_code == 404
        assert client.post(base + "/insumos/nuevo", data=ingredient()).status_code == 404
        assert (
            client.post(base + f"/insumos/{lid}/quitar", data={"revision": "2"}).status_code == 404
        )
    assert client.get("/empresas/3/productos").status_code == 404
    assert (
        client.post(other + f"/insumos/catalogo/{mid}", data=edit_data(cost_id="9999")).status_code
        == 422
    )
    app.config["WTF_CSRF_ENABLED"] = True
    for url in (
        path + "/insumos/nuevo",
        path + f"/insumos/{lid}/editar",
        path + f"/insumos/{lid}/quitar",
        path + "/estado",
        path + "/escalar",
        path + "/editar",
        "/empresas/1/productos/nuevo",
    ):
        assert client.post(url, data={}).status_code == 400
    html = client.get(path + f"/insumos/{lid}/editar").get_data(as_text=True)
    token = re.search(r'name="csrf_token"[^>]*value="([^"]+)"', html).group(1)
    assert (
        client.post(
            path + f"/insumos/{lid}/editar", data=edit_data(csrf_token=token, quantity="500")
        ).status_code
        == 302
    )


def test_archive_output_zero_and_immutable_history(catalog):
    app, client = catalog
    assert (
        client.post(
            "/empresas/1/productos/nuevo",
            data={"name": "Inválido", "output_quantity": "0", "output_unit_code": "unit"},
        ).status_code
        == 422
    )
    path = new_product(client)
    assert client.post(path + "/insumos/nuevo", data=ingredient(price="0")).status_code == 302
    assert "PEN 0.00" in client.get(path).get_data(as_text=True)
    assert (
        client.post(path + "/estado", data={"revision": "2", "state": "archived"}).status_code
        == 302
    )
    assert (
        client.post(
            path + "/insumos/nuevo", data=ingredient(revision="2", name="Nuevo")
        ).status_code
        == 409
    )
    assert "Ceviche" not in client.get("/empresas/1/productos").get_data(as_text=True)
    assert "Ceviche" in client.get("/empresas/1/productos?estado=archivados").get_data(as_text=True)
    assert (
        client.post(path + "/estado", data={"revision": "2", "state": "active"}).status_code == 302
    )
    with app.app_context():
        recipe = db.session.scalar(db.select(RecipeVersion))
        recipe.output_quantity = D("2")
        with pytest.raises(ValueError, match="inmutable"):
            db.session.commit()
        db.session.rollback()


def test_printing_output_per_thousand_is_explicit(catalog):
    app, client = catalog
    path = new_product(client, name="Volantes", output_quantity="1", output_unit_code="thousand")
    assert (
        client.post(
            path + "/insumos/nuevo",
            data=ingredient(
                name="Papel",
                quantity="1000",
                unit_key="unit:unit",
                price="0.12",
                price_unit_code="unit",
            ),
        ).status_code
        == 302
    )
    html = client.get(path).get_data(as_text=True)
    assert "PEN 120.00" in html and "millar" in html


def test_delete_unused_dish_checks_owner_csrf_revision_and_keeps_stock(catalog):
    from test_inventory import receipt

    from app.models import DishSync, ProductPrice
    from app.models.planning import RecipeWork
    from app.services.inventory import ledger

    app, client = catalog
    path = new_product(client)
    assert client.post(path + "/insumos/nuevo", data=ingredient()).status_code == 302
    assert receipt(client, "1", "80").status_code == 302
    with app.app_context():
        recipe = db.session.get(Product, 1).recipes[-1]
        db.session.add_all([
            ProductPrice(product_id=1, amount=D("30")),
            RecipeWork(recipe_id=recipe.id, operations=[]),
        ])
        db.session.commit()
    assert "Eliminar plato" in client.get("/empresas/1/productos").text
    assert client.post("/empresas/2/productos/1/eliminar", data={"revision": "2"}).status_code == 404
    assert client.post(path + "/eliminar", data={"revision": "1"}).status_code == 409
    app.config["WTF_CSRF_ENABLED"] = True
    assert client.post(path + "/eliminar", data={"revision": "2"}).status_code == 400
    app.config["WTF_CSRF_ENABLED"] = False
    response = client.post(path + "/eliminar", data={"revision": "2"}, follow_redirects=True)
    assert "Plato eliminado." in response.text
    assert client.get(path).status_code == 404
    with app.app_context():
        assert db.session.get(Product, 1) is None
        for model in (RecipeVersion, RecipeLine, RecipeWork, ProductPrice, DishSync):
            assert db.session.scalar(db.select(db.func.count()).select_from(model)) == 0
        assert db.session.get(Material, 1) is not None
        assert db.session.scalar(db.select(db.func.count()).select_from(MaterialCostVersion)) == 1
        assert ledger(1, 1)[-1]["quantity"] == D("1")


def test_delete_dish_with_sales_preserves_history(catalog):
    from test_sales import setup_sale

    from app.models import Sale

    app, client, path = setup_sale(catalog)
    assert client.post(
        "/empresas/1/ventas", data={"product_id": "1", "sold_on": "2026-09-23", "quantity": "1"}
    ).status_code == 302
    response = client.post(path + "/eliminar", data={"revision": "2"}, follow_redirects=True)
    assert "No se puede eliminar este plato porque tiene ventas registradas" in response.text
    with app.app_context():
        assert db.session.get(Product, 1).revision == 2
        assert db.session.get(Sale, 1) is not None
