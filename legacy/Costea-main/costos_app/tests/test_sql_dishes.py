"""New source units, restaurant-only registration and durable SQL dish saves."""

from contextlib import contextmanager
from copy import deepcopy
from decimal import Decimal

import pytest
from test_planning import flow as plan_flow

from app.extensions import db
from app.models import Company, DishSync, Product
from app.models.restaurant import CatalogUnitSelection
from app.services.dish_storage import SQLServerDishStore
from app.services.dish_sync import pending_query, sync_pending
from app.services.recipe_source import SQLServerRecipeSource


class MemoryDishStore:
    def __init__(self):
        self.rows = {}
        self.fail = False

    def save(self, snapshot, generation):
        if self.fail:
            raise ValueError("SQL Server no disponible para la prueba.")
        self.rows[(snapshot["id_restaurante"], snapshot["id_plato_local"])] = (
            deepcopy(snapshot),
            generation,
        )

    def delete(self, *, company_id, product_id, owner_id, connection):
        if self.fail:
            raise ValueError("SQL Server no disponible para la prueba.")
        self.rows.pop((company_id, product_id), None)


@pytest.fixture
def sql_flow(catalog):
    app, client = catalog
    store = MemoryDishStore()
    app.extensions["dish_store"] = store
    app.config["DISH_SYNC_ENABLED"] = True
    return app, client, store


def create_dish(client, company=1, name="Plato propio"):
    response = client.post(
        f"/empresas/{company}/productos/nuevo",
        data=dict(
            name=name,
            description="Descripción completa",
            output_quantity="2",
            output_unit_code="unit",
        ),
    )
    assert response.status_code == 302, response.text
    return response.location


def test_created_edited_archived_dish_is_written_with_all_recipe_versions(sql_flow):
    app, client, store = sql_flow
    path = create_dish(client)
    first, gen1 = store.rows[(1, 1)]
    assert first["nombre"] == "Plato propio" and first["descripcion"] == "Descripción completa"
    assert first["recetas"][0]["porciones"] == "2"
    data = dict(
        revision="1",
        name="Ingrediente propio",
        quantity="800",
        unit_key="unit:g",
        price="20",
        price_unit_code="kg",
        mode="loss",
        percent="20",
        effective_on="2026-09-01",
        source="Proveedor",
    )
    assert client.post(path + "/insumos/nuevo", data=data).status_code == 302
    snapshot, gen2 = store.rows[(1, 1)]
    assert gen2 > gen1 and len(snapshot["recetas"]) == 2
    latest = snapshot["recetas"][-1]
    ingredient = latest["ingredientes"][0]
    assert ingredient["cantidad"] == "800" and ingredient["factor_conversion"] == "0.001"
    assert ingredient["merma_o_adicional_porcentaje"] == "20.0"
    assert latest["costo_materia_prima"] == "20.00"
    assert latest["costo_materia_prima_por_porcion"] == "10.00"
    assert (
        client.post("/empresas/1/precios", data=dict(product_id="1", amount="35.40")).status_code
        == 302
    )
    assert store.rows[(1, 1)][0]["precio_venta_con_igv"] == "35.40"
    assert (
        client.post(path + "/estado", data=dict(revision="2", state="archived")).status_code == 302
    )
    assert store.rows[(1, 1)][0]["activo"] is False
    with app.app_context():
        job = db.session.get(DishSync, 1)
        assert job.generation == job.synced_generation and job.error is None


def test_failed_sql_write_remains_pending_and_retry_does_not_duplicate(sql_flow):
    app, client, store = sql_flow
    store.fail = True
    path = create_dish(client)
    assert "pendientes de guardar" in client.get(path).text
    with app.app_context():
        assert db.session.get(Product, 1)
        job = db.session.get(DishSync, 1)
        assert job.generation > job.synced_generation and job.error
    store.fail = False
    assert client.post("/empresas/1/productos/sincronizar").status_code == 302
    assert client.post("/empresas/1/productos/sincronizar").status_code == 302
    assert len(store.rows) == 1
    with app.app_context():
        assert list(db.session.scalars(pending_query())) == []


def test_delete_removes_owned_dish_projection(sql_flow):
    app, client, store = sql_flow
    path = create_dish(client)
    assert (1, 1) in store.rows
    store.fail = True
    response = client.post(path + "/eliminar", data={"revision": "1"}, follow_redirects=True)
    assert "SQL Server no disponible para la prueba" in response.text
    with app.app_context():
        assert db.session.get(Product, 1).revision == 1
    assert (1, 1) in store.rows
    store.fail = False
    response = client.post(path + "/eliminar", data={"revision": "1"}, follow_redirects=True)
    assert "Plato eliminado." in response.text
    assert (1, 1) not in store.rows
    with app.app_context():
        assert db.session.get(Product, 1) is None
        assert db.session.get(DishSync, 1) is None


def test_failed_validation_and_rollback_never_reach_sql(sql_flow):
    app, client, store = sql_flow
    assert (
        client.post(
            "/empresas/1/productos/nuevo",
            data=dict(name="Inválido", output_quantity="0", output_unit_code="unit"),
        ).status_code
        == 422
    )
    with app.app_context():
        db.session.add(Product(company_id=1, name="No guardar", code="ROLLBACK"))
        db.session.flush()
        db.session.rollback()
        db.session.commit()
        assert list(db.session.scalars(db.select(DishSync))) == []
    assert store.rows == {}


def test_tenant_isolation_in_sql_keys_and_retry(sql_flow):
    app, client, store = sql_flow
    create_dish(client, 1)
    create_dish(client, 2)
    assert {(c, p) for c, p in store.rows} == {(1, 1), (2, 2)}
    assert client.post("/empresas/3/productos/sincronizar").status_code == 404
    with app.app_context():
        assert sync_pending(owner_id=999) == (0, 0)
    app.config["WTF_CSRF_ENABLED"] = True
    assert client.post("/empresas/1/productos/sincronizar").status_code == 400


def test_unit_page_uses_source_ids_names_and_updates_dynamically(catalog):
    app, client = catalog

    class Units:
        rows = [
            dict(id_unidad=71, codigo="kg", descripcion="Peso desde SQL"),
            dict(id_unidad=93, codigo="Litro", descripcion="Volumen desde SQL"),
        ]

        def units(self):
            return self.rows

    provider = Units()
    app.extensions["catalog_provider"] = provider
    page = client.get("/empresas/1/unidades")
    assert page.status_code == 200
    assert "Peso desde SQL" in page.text and 'value="71"' in page.text
    assert "Metro cuadrado" not in page.text and "Millar" not in page.text
    assert "Hora" not in page.text and "Minuto" not in page.text
    assert client.post("/empresas/1/unidades", data={"unit_codes": ["kg"]}).status_code == 422
    assert client.post("/empresas/1/unidades", data={"unit_codes": ["71"]}).status_code == 302
    with app.app_context():
        assert db.session.get(CatalogUnitSelection, (1, 71)).enabled
        assert not db.session.get(CatalogUnitSelection, (1, 93)).enabled
        assert db.session.get(CatalogUnitSelection, (2, 71)) is None
    provider.rows.append(
        dict(id_unidad=105, codigo="Envase", descripcion="Unidad nueva del equipo")
    )
    assert "Unidad nueva del equipo" in client.get("/empresas/1/unidades").text
    assert client.post("/empresas/1/unidades", data={"unit_codes": ["105"]}).status_code == 302
    assert client.get("/empresas/3/unidades").status_code == 404


def test_only_restaurants_can_be_created_even_with_forged_industry(catalog):
    app, client = catalog
    page = client.get("/empresas/nueva")
    assert page.status_code == 200
    assert "Elige tu rubro" not in page.text and 'name="industry_id"' not in page.text
    assert "Textil" not in page.text and "Muebles" not in page.text
    data = dict(
        legal_name="Restaurante nuevo",
        industry_id="9999",
        tax_id_kind="other",
        currency="PEN",
        tax_percent="18",
        initial_month="2026-09",
    )
    assert client.post("/empresas/nueva", data=data).status_code == 302
    with app.app_context():
        company = db.session.scalar(
            db.select(Company).where(Company.legal_name == "Restaurante nuevo")
        )
        assert company.industry.slug == "restaurantes"


@pytest.fixture
def full_plan(catalog):
    return plan_flow.__wrapped__(catalog)


def test_delete_planned_dish_preserves_plan(full_plan):
    app, client, _, plan, _, _, _ = full_plan
    with app.app_context():
        revision = str(db.session.get(Product, 1).revision)
    response = client.post(
        "/empresas/1/productos/1/eliminar", data={"revision": revision}, follow_redirects=True
    )
    assert "está incluido en un plan de producción" in response.text
    assert client.get(plan).status_code == 200
    with app.app_context():
        assert str(db.session.get(Product, 1).revision) == revision


def test_plan_costs_and_labor_edits_refresh_sql_specifications(full_plan):
    from decimal import Decimal

    app, client, prefix, plan, payroll, line_data, recipe = full_plan
    store = MemoryDishStore()
    app.extensions["dish_store"] = store
    app.config["DISH_SYNC_ENABLED"] = True
    assert client.post(plan + "/calcular").status_code == 302
    snapshot, generation = store.rows[(1, 1)]
    assert snapshot["recetas"][-1]["operaciones"][0]["activity"] == "Elaborar lote"
    cost = snapshot["planes"][0]
    assert cost["cantidad"] == "800"
    assert Decimal(cost["resultado"]["complete"]) == 10
    assert cost["resultado"]["price"]["final"] == "17.70"
    assert cost["estado_calculo"] == "calculable"
    assert (
        client.post(prefix + "/personal/1/mes", data=payroll | {"salary": "2600"}).status_code
        == 302
    )
    updated, new_generation = store.rows[(1, 1)]
    assert new_generation > generation
    assert updated["planes"][0]["resultado"]["mod"] != cost["resultado"]["mod"]


def test_sqlserver_recipe_source_reads_normalized_tables(monkeypatch):
    rows = [
        dict(
            id_plato=12,
            version_receta=3,
            nombre="Ceviche de prueba",
            porciones=Decimal("2"),
            id_insumo=7,
            cantidad=Decimal("800"),
            unidad_receta="g",
            factor_a_unidad_base=Decimal("0.001"),
            merma_pct=Decimal("20"),
        ),
        dict(
            id_plato=12,
            version_receta=3,
            nombre="Ceviche de prueba",
            porciones=Decimal("2"),
            id_insumo=8,
            cantidad=Decimal("1"),
            unidad_receta="unid",
            factor_a_unidad_base=Decimal("0.025"),
            merma_pct=Decimal("0"),
        ),
    ]

    class Result:
        def mappings(self):
            return rows

    class Connection:
        def execute(self, statement):
            assert "dbo.receta_detalles" in str(statement)
            return Result()

    @contextmanager
    def connection():
        yield Connection()

    monkeypatch.setattr("app.services.recipe_source.catalog_connection", connection)
    dishes = SQLServerRecipeSource().dishes()
    assert len(dishes) == 1
    assert dishes[0].key == "sqlserver:12" and dishes[0].portions == Decimal("2")
    assert dishes[0].ingredients[0].loss == Decimal("0.2")
    assert dishes[0].ingredients[1].unit_code == "unit"
    assert dishes[0].ingredients[1].factor_to_base == Decimal("0.025")


def test_normalized_recipe_write_preserves_supported_catalog_lines():
    calls = []

    class Connection:
        def execute(self, statement, params=None):
            calls.append((str(statement), params))

    ingredients = [
        dict(
            id_insumo=7,
            cantidad="800",
            factor_conversion="0.001",
            unidad_clave="unit:g",
            unidad_precio="kg",
            merma_o_adicional_porcentaje="20",
            modo_cantidad="loss",
            sustento_conversion="Conversión física",
        ),
        dict(
            id_insumo=None,
            cantidad="1",
            factor_conversion="1",
            unidad_clave="unit:unit",
            unidad_precio="unit",
            merma_o_adicional_porcentaje="0",
            modo_cantidad="gross",
            sustento_conversion="Insumo propio",
        ),
    ]
    SQLServerDishStore._replace_recipe(Connection(), 15, ingredients)
    assert "DELETE FROM dbo.receta_detalles" in calls[0][0]
    inserted = calls[1][1]
    assert len(inserted) == 1
    assert inserted[0] | {"checked": True} == {
        "dish": 15,
        "ingredient": 7,
        "position": 1,
        "quantity": Decimal("800"),
        "unit": "g",
        "factor": Decimal("0.001"),
        "loss": Decimal("20"),
        "notes": "Conversión física",
        "checked": True,
    }
