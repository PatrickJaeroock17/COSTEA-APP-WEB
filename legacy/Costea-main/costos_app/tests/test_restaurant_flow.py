"""Restaurant acceptance tests: actual HTTP forms, isolated data, external source adapter."""

import re
from copy import deepcopy
from datetime import date, datetime
from decimal import Decimal as D

import pytest

from app.extensions import db
from app.models import (
    Company,
    Industry,
    Material,
    MaterialCostVersion,
    Period,
    Product,
    RecipeLine,
    RecipeVersion,
)
from app.models.inventory import InventoryMovement
from app.models.planning import Budget, CostConcept, PlanLine, ProductionPlan, RecipeWork
from app.services.catalog import SQLServerCatalog
from app.services.personalization import personalize
from app.services.planning import evaluate
from app.services.recipe_source import parse_dishes


class FakeCatalog:
    def __init__(self):
        self.rows = [
            dict(
                id_insumo=7,
                codigo_comercial="CAT-001",
                nombre="Insumo de prueba",
                variedad="Variedad A",
                id_categoria=4,
                id_unidad=2,
                categoria="Categoría de prueba",
                unidad="kg",
                unidad_nombre="Kilogramo",
                precio_mayorista=D("20"),
                fecha_actualizacion=datetime(2026, 9, 1, 14, 30, 20, 270000),
                activo=True,
            )
        ]

    def categories(self):
        return [dict(id_categoria=4, nombre="Categoría de prueba")]

    def units(self):
        return [dict(id_unidad=2, codigo="kg", descripcion="Kilogramo")]

    def ingredients(self, category=None, unit=None, **kwargs):
        return [
            dict(r)
            for r in self.rows
            if r["activo"]
            and (category is None or r["id_categoria"] == category)
            and (unit is None or r["id_unidad"] == unit)
        ]

    def get(self, ident):
        return (
            next((dict(r) for r in self.ingredients() if r["id_insumo"] == ident), None)
            or self.missing()
        )

    def missing(self):
        raise ValueError("El insumo no existe o está inactivo en SQL Server.")


def source_data():
    return dict(
        schema_version=1,
        dishes=[
            dict(
                id="test-only",
                version="v1",
                name="Receta de prueba",
                portions="2",
                ingredients=[dict(insumo_id=7, quantity="800", unit_code="g", loss_percent="20")],
            )
        ],
    )


@pytest.fixture
def restaurant(catalog):
    app, client = catalog
    app.extensions["catalog_provider"] = FakeCatalog()
    dishes = parse_dishes(source_data())
    app.extensions["recipe_provider"] = type("Provider", (), {"dishes": lambda self: dishes})()
    with app.app_context():
        industry = db.session.scalar(db.select(Industry).where(Industry.slug == "restaurantes"))
        for ident in (1, 2, 3):
            company = db.session.get(Company, ident)
            company.industry_id = industry.id
            period = Period(company_id=ident, year=2026, month=9)
            period.tax_rate = D("0")  # The restaurant workflow must still use the requested 18%.
            db.session.add(period)
        db.session.commit()
    return app, client


def stock_source(client, company_id=1, ingredient_id=7, quantity="100", reference="Compra fuente"):
    assert client.post(
        f"/empresas/{company_id}/catalogo/{ingredient_id}/seleccionar"
    ).status_code == 302
    with client.application.app_context():
        material_id = db.session.scalar(
            db.select(Material.id).where(
                Material.company_id == company_id, Material.external_insumo_id == ingredient_id
            )
        )
    assert client.post(
        f"/empresas/{company_id}/inventarios",
        data=dict(
            material_id=str(material_id),
            movement_on="2026-09-01",
            quantity=quantity,
            unit_cost="20",
            reference=reference,
            token="stock-source-test",
        ),
    ).status_code == 302


def test_opening_stock_is_registered_once_for_one_restaurant(restaurant):
    app, client = restaurant
    app.extensions["catalog_provider"].rows[0]["stock_inicial"] = D("12.5")

    response = client.get("/empresas/1/inventarios")
    assert response.status_code == 200
    assert b"Stock de apertura" in response.data

    assert client.post("/empresas/1/inventarios/apertura").status_code == 302
    with app.app_context():
        receipts = list(db.session.scalars(db.select(InventoryMovement)))
        assert len(receipts) == 1
        assert receipts[0].company_id == 1
        assert receipts[0].quantity == D("12.5")
        assert receipts[0].unit_cost == D("20")
        assert db.session.scalar(
            db.select(Material.id).where(
                Material.company_id == 2, Material.external_insumo_id == 7
            )
        ) is None

    assert client.post("/empresas/1/inventarios/apertura").status_code == 302
    with app.app_context():
        assert db.session.scalar(db.select(db.func.count(InventoryMovement.id))) == 1


def test_existing_restaurant_gets_opening_before_activity_without_replenishment(restaurant):
    app, client = restaurant
    app.extensions["catalog_provider"].rows[0]["stock_inicial"] = D("12.5")
    stock_source(client, quantity="100")
    with app.app_context():
        material = db.session.scalar(db.select(Material).where(Material.company_id == 1))
        db.session.add(InventoryMovement(
            company_id=1, material_id=material.id, movement_on=date(2026, 9, 2),
            kind="out", quantity=D("5"), unit_cost=D("0"), reference="Consumo anterior",
        ))
        db.session.commit()
        material_id = material.id
    result = app.test_cli_runner().invoke(args=["sync-catalog-data"])
    assert result.exit_code == 0, result.output
    assert "3 entradas iniciales nuevas" in result.output
    from app.services.inventory import ledger
    from app.services.opening_stock import OPENING_REFERENCE

    with app.app_context():
        rows = ledger(1, material_id)
        initial = next(row for row in rows if row["movement"].reference == OPENING_REFERENCE)
        assert initial["movement"].movement_on == date(2026, 9, 1)
        assert initial["movement"].quantity == D("12.5")
        assert rows[-1]["quantity"] == D("107.5")
        assert rows[-1]["value"] == D("2150")
        initial["movement"].voided = True
        db.session.commit()
    # Restarting neither replenishes consumed stock nor restores voided entries.
    assert app.test_cli_runner().invoke(args=["sync-catalog-data"]).exit_code == 0
    with app.app_context():
        assert db.session.scalar(db.select(db.func.count(InventoryMovement.id))) == 5
        assert ledger(1, material_id)[-1]["quantity"] == D("95")
    page = client.get("/empresas/2/inventarios")
    assert page.status_code == 200
    assert "Stock inicial · catálogo SQL" in page.text
    assert "12.5" in page.text


def test_new_restaurant_receives_catalog_opening_without_pressing_a_button(restaurant):
    app, client = restaurant
    app.extensions["catalog_provider"].rows[0]["stock_inicial"] = D("12.5")
    response = client.post("/empresas/nueva", data=dict(
        legal_name="Nueva cevichería", tax_id_kind="other", tax_id="",
        currency="PEN", tax_percent="18", initial_month="2026-09",
    ))
    assert response.status_code == 302, response.text
    with app.app_context():
        company = db.session.scalar(db.select(Company).where(Company.legal_name == "Nueva cevichería"))
        receipt = db.session.scalar(db.select(InventoryMovement).where(InventoryMovement.company_id == company.id))
        assert receipt.quantity == D("12.5")
        assert receipt.unit_cost == D("20")
        assert receipt.movement_on == date(2026, 9, 1)
        assert db.session.scalar(db.select(db.func.count(InventoryMovement.id))) == 1


def test_prior_manual_catalog_import_is_recognized_and_dated_at_opening(restaurant):
    app, client = restaurant
    app.extensions["catalog_provider"].rows[0]["stock_inicial"] = D("12.5")
    stock_source(client, quantity="12.5")
    with app.app_context():
        entry = db.session.scalar(db.select(InventoryMovement))
        old_id = entry.id
        entry.reference = "Stock de apertura estimado · catálogo"
        entry.movement_on = date(2026, 10, 14)
        db.session.commit()
    result = app.test_cli_runner().invoke(args=["sync-catalog-data"])
    assert result.exit_code == 0, result.output
    with app.app_context():
        entries = list(db.session.scalars(db.select(InventoryMovement).where(InventoryMovement.company_id == 1)))
        assert len(entries) == 1
        assert entries[0].id == old_id
        assert entries[0].quantity == D("12.5")
        assert entries[0].movement_on == date(2026, 9, 1)


def test_catalog_refresh_keeps_history_and_published_plans(restaurant):
    app, client = restaurant
    stock_source(client)
    assert client.post("/empresas/1/platos-fuente", data={"source_id":"test-only"}).status_code == 302
    with app.app_context():
        product = db.session.scalar(db.select(Product))
        product_id = product.id
        old = product.recipes[-1]
        old_id = old.id
        db.session.add(RecipeWork(recipe_id=old.id, no_materials=False, no_labor=True, operations=[]))
        manual_product = Product(company_id=1, code="P-MANUAL", name="Precio personalizado")
        db.session.add(manual_product)
        db.session.flush()
        manual_recipe = RecipeVersion(
            product_id=manual_product.id, number=1, author_id=1, output_quantity=old.output_quantity,
            output_unit_code=old.output_unit_code, currency="PEN", product_name=manual_product.name,
        )
        manual_cost = MaterialCostVersion(
            material_id=old.lines[0].material_id, author_id=1, effective_on=date(2026, 9, 1),
            mode="direct", currency="PEN", unit_cost=D("99"), source="Precio personalizado",
        )
        db.session.add_all([manual_recipe, manual_cost])
        db.session.flush()
        from app.services.catalog_sync import LINE_FIELDS

        data = {key:getattr(old.lines[0], key) for key in LINE_FIELDS}
        data["cost_version_id"] = manual_cost.id
        db.session.add(RecipeLine(recipe_id=manual_recipe.id, position=1, **data))
        manual_id = manual_product.id
        period = db.session.scalar(db.select(Period).where(Period.company_id == 1))
        for name in ("Borrador", "Publicado"):
            plan = ProductionPlan(company_id=1, period_id=period.id, name=name, price_date=date(2026, 9, 15))
            db.session.add(plan)
            db.session.flush()
            db.session.add(PlanLine(plan_id=plan.id, product_id=product.id, recipe_id=old.id,
                                   quantity=D("2"), reference_price=D("30"), equivalent_factor=D("1"),
                                   pricing_mode="manual", pricing_value=D("30")))
            if name == "Publicado":
                db.session.add(Budget(company_id=1, plan_id=plan.id, author_id=1, number=1,
                                      snapshot={"sentinel":"histórico"}, fingerprint="original"))
        db.session.commit()
    app.extensions["catalog_provider"].rows[0].update(precio_mayorista=D("25"), fecha_actualizacion=datetime(2026, 9, 2))
    result = app.test_cli_runner().invoke(args=["sync-catalog-data"])
    assert result.exit_code == 0, result.output
    with app.app_context():
        product = db.session.get(Product, product_id)
        new = product.recipes[-1]
        assert len(product.recipes) == 2
        assert db.session.get(RecipeVersion, old_id).lines[0].cost_version.unit_cost == D("20")
        assert new.lines[0].cost_version.unit_cost == D("25")
        assert new.lines[0].quantity == D("800")
        assert db.session.scalar(db.select(RecipeWork).where(RecipeWork.recipe_id == new.id)).no_labor
        draft = db.session.scalar(db.select(PlanLine).join(ProductionPlan).where(ProductionPlan.name == "Borrador"))
        published = db.session.scalar(db.select(PlanLine).join(ProductionPlan).where(ProductionPlan.name == "Publicado"))
        assert draft.recipe_id == new.id
        assert published.recipe_id == old_id
        assert db.session.scalar(db.select(Budget)).snapshot == {"sentinel":"histórico"}
        manual = db.session.get(Product, manual_id)
        assert len(manual.recipes) == 1
        assert manual.recipes[0].lines[0].cost_version.unit_cost == D("99")
    assert app.test_cli_runner().invoke(args=["sync-catalog-data"]).exit_code == 0
    with app.app_context():
        assert db.session.scalar(db.select(db.func.count(RecipeVersion.id))) == 3


def test_failed_opening_import_rolls_back_the_restaurant(restaurant):
    app, _ = restaurant
    provider = app.extensions["catalog_provider"]
    provider.rows[0]["stock_inicial"] = D("12.5")
    provider.rows.append(provider.rows[0] | dict(
        id_insumo=8, codigo_comercial="CAT-002", nombre="Unidad inválida", unidad="desconocida",
    ))
    result = app.test_cli_runner().invoke(args=["sync-catalog-data"])
    assert result.exit_code != 0
    with app.app_context():
        assert db.session.scalar(db.select(db.func.count(InventoryMovement.id))) == 0
        assert db.session.scalar(db.select(db.func.count(Material.id))) == 0


def test_labor_contract_children_and_breakdown_are_visible_with_ownership(restaurant, monkeypatch):
    _, client = restaurant
    from app.routes import planning

    worker = dict(
        codigo_trabajador="SIM001", codigo_contrato="CT001", id_escenario=1,
        trabajador_activo=True, activo=True, es_simulado=True, costo_calculado=True,
        nombres="Ana", apellidos="Simulada", cargo="Cocinera", area="Cocina", clasificacion_costo="MOD",
        escenario_nombre="Escenario de prueba", fecha_referencia=date(2026, 9, 1), anio_calendario=2026,
        vinculo="DEPENDIENTE", estado_planilla="REGISTRADO", modalidad="Tiempo completo", tipo_pago="MENSUAL",
        salud="ESSALUD", pension="ONP", observaciones="Datos del escenario", hijos_asignacion=1,
        hijos_escolaridad=1, escolaridad_anual=D("240"), horas_dia=D("8"), horas_efectivas_anual=D("1800"),
        dias_trabajados_programados=250, feriados_descansados=10, feriados_trabajados=0, dias_vacaciones_derecho=30,
        fecha_inicio=date(2025, 1, 1), tarifa=D("2600"), dias_semana=6,
        horas_servicio_mes=D("0"), factor_productivo=D("0.9"), trabaja_feriados=True,
        tiene_suspension_cuarta=False, pension_descuento_mes=D("338"),
        quinta_impuesto_anual_estimado=D("1200"), cuarta_retencion_mes=D("0"),
        bono_remunerativo_mes=D("200"), bolsa_viveres_mes=D("60"),
        escolaridad_por_hijo_anual=D("240"), vida_ley_mes_estimada=D("10"),
        sctr_salud_mes_estimada=D("5"), sctr_pension_mes_estimada=D("4"),
        utilidades_anual=D("0"), reemplazo_vacaciones_anual=D("0"),
        beneficios_observaciones="Primas y escolaridad del caso de prueba",
        escenario_observaciones="Calendario y remuneración normalizados",
    )
    worker.update({key:D("2500") for key in (
        "remuneracion_basica_mes", "asignacion_familiar_mes", "remuneracion_computable_mes",
        "costo_mensual_equivalente", "costo_anual_completo", "neto_mensual_promedio_regularizado", "costo_hora_efectiva",
    )})
    monkeypatch.setattr(planning, "labor_worker_details", lambda code, scenario, contract: dict(
        worker=worker, breakdown=[dict(concepto="Seguro Vida Ley", importe_anual=D("120"), tratamiento="SUMA")],
        children=[dict(codigo_hijo="H01", edad_al_corte=8, acreditado=True, cursa_superiores=False,
                       escolaridad_simulada=True, observacion="Escolaridad registrada")],
        schedule=[2,3,4,5,6,7], vacations=[],
    ))
    response = client.get("/empresas/1/gestion/personal/escenario/1/SIM001")
    assert response.status_code == 200
    assert "Escolaridad registrada" in response.text
    assert "Seguro Vida Ley" in response.text
    fields = {label: value.strip() for label, value in re.findall(
        r"<div><dt>([^<]+)</dt><dd>(.*?)</dd></div>", response.text, re.S
    )}
    assert fields["Código de trabajador"] == "SIM001"
    assert fields["Código de contrato"] == "CT001"
    assert fields["Estado del trabajador"] == "Activo"
    assert fields["Datos simulados"] == "Sí"
    assert fields["Fecha de inicio"] == "2025-01-01"
    assert fields["Tarifa contratada (Mensual)"] == "S/ 2600.00"
    assert fields["Trabaja en feriados"] == "Sí"
    assert fields["Descuento mensual AFP / ONP"] == "S/ 338.00"
    assert fields["Quinta categoría: promedio mensual estimado"] == "S/ 100.00"
    assert fields["Utilidades anuales"] == "S/ 0.00"
    visible_text = re.sub(r"<[^>]+>", "", response.text)
    assert "Días de trabajo: Martes, Miércoles, Jueves, Viernes, Sábado, Domingo." in visible_text
    assert "Descanso semanal: Lunes." in visible_text
    assert "Primas y escolaridad del caso de prueba" in response.text
    assert "Calendario y remuneración normalizados" in response.text
    assert client.get("/empresas/2/gestion/personal/escenario/1/SIM001").status_code == 200
    assert client.get("/empresas/3/gestion/personal/escenario/1/SIM001").status_code == 404


def test_inactive_independent_contract_shows_status_suspension_and_missing_cost(restaurant, monkeypatch):
    _, client = restaurant
    from app.routes import planning

    worker = dict(
        codigo_trabajador="SIM012", codigo_contrato="CT012", id_escenario=1, nombres="Roberto", apellidos="Base",
        cargo="Técnico", area="Soporte", clasificacion_costo="CIF", trabajador_activo=False,
        activo=False, es_simulado=True, vinculo="INDEPENDIENTE", tipo_pago="SERVICIO",
        tiene_suspension_cuarta=True, costo_calculado=False, tarifa=D("500"),
        vida_ley_mes_estimada=D("0"), observaciones="Servicio autónomo suspendido",
    )
    monkeypatch.setattr(planning, "labor_worker_details", lambda code, scenario, contract: dict(
        worker=worker, breakdown=[], children=[], schedule=[], vacations=[],
    ) if contract == "CT012" else None)
    response = client.get("/empresas/1/gestion/personal/escenario/1/SIM012?contrato=CT012")
    assert response.status_code == 200
    fields = {label: value.strip() for label, value in re.findall(
        r"<div><dt>([^<]+)</dt><dd>(.*?)</dd></div>", response.text, re.S
    )}
    assert fields["Estado del trabajador"] == "Inactivo"
    assert fields["Estado del contrato"] == "Inactivo"
    assert fields["Suspensión de retenciones de cuarta categoría"] == "Sí"
    assert fields["Costo anual completo del empleador"] == "Sin cálculo"
    assert fields["Prima mensual estimada de Seguro Vida Ley"] == "S/ 0.00"
    assert "no tiene una proyección de costos activa" in response.text
    assert client.get("/empresas/1/gestion/personal/escenario/1/SIM012?contrato=AJENO").status_code == 404


def test_base_workers_are_shared_across_restaurants_and_private_staff_stay_scoped(restaurant, monkeypatch):
    app, client = restaurant
    from app.models.planning import Employee
    from app.routes import planning

    with app.app_context():
        db.session.add(Employee(company_id=1, name="Personal exclusivo", role="Cocina"))
        db.session.commit()

    monkeypatch.setattr(
        planning,
        "labor_scenario",
        lambda: (
            [dict(
                nombres="Ana", apellidos="Simulada", cargo="Cocinera", area="Cocina",
                codigo_trabajador="SIM001", codigo_contrato="CT001", id_escenario=1,
                trabajador_activo=True, activo=True, es_simulado=True,
                vinculo="DEPENDIENTE", estado_planilla="REGISTRADO", tipo_pago="MENSUAL",
                tarifa=D("2600"), horas_dia=D("8"), dias_semana=6, clasificacion_costo="MOD",
                hijos_asignacion=1, hijos_escolaridad=1,
                escolaridad_anual=D("240"), essalud_neto_anual=D("900"),
                eps_anual=D("0"), vida_ley_anual=D("120"),
                sctr_salud_anual=D("60"), sctr_pension_anual=D("40"),
                costo_mensual_equivalente=D("2500"),
            )],
            D("2500"),
        ),
    )
    for company_id in (1, 2):
        response = client.get(f"/empresas/{company_id}/gestion/personal")
        assert response.status_code == 200
        assert "Ana Simulada" in response.text
        assert "Personal base compartido" in response.text
        assert response.text.index("Ana Simulada") < response.text.index("Trabajadores adicionales")
        assert f'/empresas/{company_id}/gestion/personal/escenario/1/SIM001?contrato=CT001' in response.text
        assert ("Personal exclusivo" in response.text) == (company_id == 1)
    assert client.get("/empresas/3/gestion/personal").status_code == 404


def test_source_creation_requires_every_ingredient_and_enough_stock(restaurant):
    app, client = restaurant
    app.extensions["catalog_provider"].rows.append(
        app.extensions["catalog_provider"].rows[0] | dict(
            id_insumo=8, codigo_comercial="CAT-002", nombre="Limón", variedad="Sutil"
        )
    )
    source = source_data()
    source["dishes"][0]["name"] = "Ceviche mixto"
    source["dishes"][0]["ingredients"].append(
        dict(insumo_id=8, quantity="50", unit_code="g")
    )
    dishes = parse_dishes(source)
    app.extensions["recipe_provider"] = type("Provider", (), {"dishes": lambda self: dishes})()
    stock_source(client, quantity="1")
    response = client.post(
        "/empresas/1/platos-fuente", data={"source_id": "test-only"}, follow_redirects=True
    )
    assert "No se puede elaborar el plato" in response.text
    assert "Limón - Sutil" in response.text
    with app.app_context():
        assert db.session.scalar(db.select(db.func.count()).select_from(Product)) == 0
        assert db.session.scalar(db.select(db.func.count()).select_from(RecipeVersion)) == 0
        assert db.session.scalar(db.select(db.func.count()).select_from(Material)) == 1
    stock_source(client, ingredient_id=8, quantity="0.025")
    response = client.post(
        "/empresas/1/platos-fuente", data={"source_id": "test-only"}, follow_redirects=True
    )
    assert "se necesitan 0.05 kg, disponibles 0.025 kg" in response.text
    stock_source(client, ingredient_id=8, quantity="0.025", reference="Completar limón")
    response = client.post("/empresas/1/platos-fuente", data={"source_id": "test-only"})
    assert response.location.endswith("/productos/1")
    assert "Insumos disponibles para elaborar" in client.get(response.location).text
    scaled = client.post(response.location + "/escalar", data={"revision": "1", "output_quantity": "4"}, follow_redirects=True)
    assert "No se puede elaborar el plato" in scaled.text
    with app.app_context():
        product = db.session.get(Product, 1)
        assert product.revision == 1 and len(product.recipes) == 1
        lemon = db.session.scalar(db.select(Material).where(Material.external_insumo_id == 8))
        db.session.add(InventoryMovement(
            company_id=1, material_id=lemon.id, movement_on=date.today(),
            kind="out", quantity=D("0.05"), unit_cost=D("0"),
            reference="Limón agotado", voided=False,
        ))
        db.session.commit()
    for page in ("/empresas/1/productos", "/empresas/1/productos/1"):
        html = client.get(page).text
        assert "Elaboración bloqueada: faltan insumos" in html
        assert "Limón - Sutil" in html
        assert "necesita 0.05 kg; disponible 0 kg" in html
    response = client.post(
        "/empresas/1/platos-fuente", data={"source_id": "test-only"}, follow_redirects=True
    )
    assert "No se puede elaborar el plato" in response.text


def test_catalog_and_source_personalization_are_isolated_and_immutable(restaurant):
    app, client = restaurant
    source = source_data()
    before = deepcopy(source)
    response = client.get("/empresas/1/catalogo")
    assert response.status_code == 200
    assert "Categoría de prueba" in response.text
    assert "Insumo de prueba" in response.text
    assert "CAT-001" in response.text
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
        assert heading in response.text
    assert "Kilogramo" in response.text
    assert "2026-09-01" in response.text
    assert "14:30:20" not in response.text and ".270000" not in response.text
    assert 'name="fecha" value="2026-09-30"' in response.text
    assert "Insumo de prueba" not in client.get("/empresas/1/catalogo?categoria=999").text
    products_page = client.get("/empresas/1/productos")
    assert products_page.status_code == 200
    assert "Receta de prueba" in products_page.text
    assert "Usar y editar receta" in products_page.text
    assert client.get("/empresas/1/platos-fuente").location.endswith(
        "/empresas/1/productos#equipo"
    )
    for cid in (1, 2):
        stock_source(client, company_id=cid)
        response = client.post(f"/empresas/{cid}/platos-fuente", data={"source_id": "test-only"})
        assert response.status_code == 302, response.text
    duplicate = client.post(
        "/empresas/1/platos-fuente", data={"source_id": "test-only"}
    )
    assert duplicate.status_code == 302
    assert duplicate.location.endswith("/empresas/1/productos/1")
    assert (
        client.post("/empresas/3/platos-fuente", data={"source_id": "test-only"}).status_code == 404
    )
    assert client.get("/empresas/3/catalogo").status_code == 404
    assert client.post("/empresas/3/catalogo/7/seleccionar").status_code == 404
    with app.app_context():
        products = list(db.session.scalars(db.select(Product).order_by(Product.id)))
        first, second = products
        assert first.source_key == second.source_key == "test-only"
        assert first.company_id != second.company_id
        line = first.recipes[-1].lines[0]
        line_id, material_id = line.id, line.material_id
        assert line.material_id != second.recipes[-1].lines[0].material_id
        assert line.factor == D(".001") and line.rate == D(".2")
    response = client.post(
        f"/empresas/1/productos/1/insumos/{line_id}/editar",
        data=dict(
            revision="1",
            unit_key="unit:g",
            quantity="400",
            mode="loss",
            percent="0",
            cost_id="0",
            new_price="24",
            effective_on="2026-09-02",
        ),
    )
    assert response.status_code == 302, response.text
    with app.app_context():
        product = db.session.get(Product, 1)
        assert product.revision == 2
        assert product.recipes[0].lines[0].quantity == D("800")
        assert product.recipes[-1].lines[0].quantity == D("400")
        assert db.session.get(Product, 2).recipes[-1].lines[0].quantity == D("800")
    assert source == before
    app.extensions["catalog_provider"].rows[0]["activo"] = False
    unified = client.get("/empresas/1/catalogo").text
    assert 'data-material-row="catalogo"' not in unified
    assert "Insumo de prueba" in unified  # Its local history remains in Mis Insumos.
    assert client.get("/empresas/1/productos/1?version=1").status_code == 200
    # Historical prices remain; inactive source ingredients cannot be newly selected.
    response = client.post("/empresas/1/catalogo/7/seleccionar", follow_redirects=True)
    assert "inactivo" in response.text
    with app.app_context():
        assert db.session.get(Material, material_id)
        assert db.session.scalar(db.select(db.func.count()).select_from(MaterialCostVersion)) == 3


def test_material_actions_follow_restaurant_selection_and_local_columns_are_compact(restaurant):
    app, client = restaurant
    company_one = "/empresas/1/materiales"
    company_two = "/empresas/2/materiales"
    initial = client.get(company_one).text
    assert "Plan de negocio" not in initial
    assert "Usar en mi restaurante" in initial
    assert "Gestionar insumo" not in initial
    assert client.get("/empresas/1/plan-negocio").status_code == 404

    assert client.post("/empresas/1/catalogo/7/seleccionar").status_code == 302
    selected = client.get(company_one).text
    catalog_panel = selected.split('id="material-panel-catalogo"', 1)[1].split(
        'id="material-panel-mios"', 1
    )[0]
    local_panel = selected.split('id="material-panel-mios"', 1)[1]
    assert "Usar en mi restaurante" not in catalog_panel
    assert catalog_panel.count("Gestionar insumo") == 1
    assert local_panel.count("Gestionar insumo") == 1
    assert 'class="material-status-cell text-nowrap px-2"' in local_panel
    assert 'class="material-action-cell text-nowrap px-2"' in local_panel

    # A selection in one restaurant must not change the other restaurant's catalog action.
    other = client.get(company_two).text
    assert "Usar en mi restaurante" in other
    assert "Gestionar insumo" not in other
    with app.app_context():
        material = db.session.scalar(db.select(Material).where(Material.company_id == 1))
        material.active = False
        db.session.commit()
    archived = client.get(company_one + "?estado=archivados").text
    assert "Usar en mi restaurante" not in archived
    assert archived.count("Gestionar insumo") == 2


def test_catalog_selection_preserves_sql_text_lengths_and_clean_price_date(restaurant):
    app, client = restaurant
    item = app.extensions["catalog_provider"].rows[0]
    item["nombre"] = "N" * 100
    item["variedad"] = "V" * 100
    item["categoria"] = "C" * 100
    item["precio_mayorista"] = D("12345678.90")

    response = client.post("/empresas/1/catalogo/7/seleccionar")
    assert response.status_code == 302
    with app.app_context():
        material = db.session.scalar(db.select(Material))
        assert material.company_id == 1
        assert material.code == "CAT-001"
        assert material.name == "N" * 100
        assert material.variety == "V" * 100
        assert material.category == "C" * 100
        assert material.costs[0].unit_cost == D("12345678.90")
        assert material.costs[0].effective_on.isoformat() == "2026-09-01"
        assert material.costs[0].source.endswith("actualización 2026-09-01")
        assert ".270000" not in material.costs[0].source


def test_catalog_code_is_inherited_and_private_codes_do_not_collide(restaurant):
    app, client = restaurant
    private = client.post(
        "/empresas/1/materiales/nuevo-rapido?tab=mios",
        data={
            "name": "Insumo privado",
            "variety": "Propio",
            "category": "Categoría de prueba",
            "base_unit_code": "kg",
            "unit_cost": "10",
            "effective_on": "2026-09-01",
        },
    )
    assert private.status_code == 302
    assert client.post("/empresas/1/catalogo/7/seleccionar").status_code == 302
    with app.app_context():
        materials = list(
            db.session.scalars(db.select(Material).order_by(Material.external_insumo_id))
        )
        assert {material.code for material in materials} == {"CAT-001", "CAT-002"}
        catalog_material = next(material for material in materials if material.catalog_sourced)
        assert catalog_material.external_insumo_id == 7


def test_existing_local_material_resynchronizes_from_catalog_code(restaurant):
    app, client = restaurant
    assert client.post("/empresas/1/catalogo/7/seleccionar").status_code == 302
    edit_page = client.get("/empresas/1/materiales/1/editar")
    assert 'name="code"' in edit_page.text and "readonly" in edit_page.text
    tampered = client.post(
        "/empresas/1/materiales/1/editar",
        data={
            "code": "CAT-008",
            "name": "Insumo de prueba",
            "category": "Categoría de prueba",
            "supplier": "",
            "base_unit_code": "kg",
        },
    )
    assert tampered.status_code == 422
    assert "solo puede cambiar en el catálogo maestro" in tampered.text
    app.extensions["catalog_provider"].rows[0]["codigo_comercial"] = "CAT-009"
    assert client.post("/empresas/1/catalogo/7/seleccionar").status_code == 302
    with app.app_context():
        material = db.session.scalar(db.select(Material))
        assert material.code == "CAT-009"


def test_catalog_registration_rejects_private_name_and_variety_duplicate(restaurant):
    app, client = restaurant
    response = client.post(
        "/empresas/1/materiales/nuevo-rapido?tab=mios",
        data={
            "name": "Insumo de prueba",
            "variety": "Variedad A",
            "category": "Categoría de prueba",
            "base_unit_code": "kg",
            "unit_cost": "19.50",
            "effective_on": "2026-09-01",
        },
    )
    assert response.status_code == 302

    duplicate = client.post("/empresas/1/catalogo/7/seleccionar", follow_redirects=True)
    assert duplicate.status_code == 200
    assert "Ya existe" in duplicate.get_data(as_text=True)
    assert "registrar un precio nuevo" in duplicate.get_data(as_text=True)
    with app.app_context():
        materials = list(db.session.scalars(db.select(Material)))
        assert len(materials) == 1
        assert materials[0].external_insumo_id is None


def test_source_failure_rolls_back_every_local_write(restaurant):
    app, client = restaurant
    broken = source_data()
    broken["dishes"][0]["ingredients"].append(dict(insumo_id=999, quantity="1", unit_code="kg"))
    dishes = parse_dishes(broken)
    with app.app_context():
        with pytest.raises(ValueError):
            personalize(db.session.get(Company, 1), 1, dishes[0])
        db.session.rollback()
        for model in (Product, Material, MaterialCostVersion, RecipeVersion):
            assert db.session.scalar(db.select(db.func.count()).select_from(model)) == 0


def test_explicit_recipe_factor_converts_pieces_to_catalog_mass(restaurant):
    app, client = restaurant
    source = source_data()
    source["dishes"][0]["ingredients"][0].update(
        quantity="3", unit_code="unit", factor_to_base="0.025"
    )
    dishes = parse_dishes(source)
    app.extensions["recipe_provider"] = type(
        "Provider", (), {"dishes": lambda self: dishes}
    )()

    stock_source(client)
    response = client.post("/empresas/1/platos-fuente", data={"source_id": "test-only"})
    assert response.status_code == 302, response.text
    with app.app_context():
        line = db.session.scalar(db.select(Product)).recipes[-1].lines[0]
        assert line.unit_key == "unit:unit"
        assert line.factor == D("0.025")


@pytest.mark.parametrize(
    "change",
    [
        {"quantity": "0"},
        {"quantity": "NaN"},
        {"quantity": "-1"},
        {"quantity": "1e100"},
        {"quantity": 0.5},
        {"loss_percent": "100"},
        {"insumo_id": True},
    ],
)
def test_recipe_source_rejects_invalid_inputs(change):
    data = source_data()
    data["dishes"][0]["ingredients"][0].update(change)
    with pytest.raises(ValueError):
        parse_dishes(data)


def test_unconfigured_sources_are_clear_and_no_fake_recipes(restaurant):
    app, client = restaurant
    app.extensions.pop("recipe_provider")
    assert (
        "conexión principal de SQL Server"
        in client.get("/empresas/1/platos-fuente", follow_redirects=True).text
    )
    app.extensions.pop("catalog_provider")
    response = client.get("/empresas/1/catalogo")
    assert response.status_code == 200
    assert "conexión principal de SQL Server" in response.text
    assert "Tus insumos locales siguen disponibles" in response.text
    with app.app_context():
        with pytest.raises(ValueError, match="conexión principal"):
            SQLServerCatalog().categories()
        assert not {"categorias", "unidades_medida", "insumos"} & set(db.metadata.tables)


def test_new_mutations_require_csrf(restaurant):
    app, client = restaurant
    app.config["WTF_CSRF_ENABLED"] = True
    for path, data in (
        ("/empresas/1/catalogo/7/seleccionar", {}),
        ("/empresas/1/platos-fuente", {"source_id": "test-only"}),
        ("/empresas/1/costeo", {"action": "plan"}),
    ):
        assert client.post(path, data=data).status_code == 400


def test_payroll_quantity_basis_is_persisted_and_validated(restaurant):
    app, client = restaurant
    from app.models import EmployeePeriodCost
    from app.services.costing import labor_cost
    from app.services.planning import payroll_input

    prefix = "/empresas/1/gestion"
    client.post(prefix + "/personal/nuevo", data=dict(name="Ayudante", role="Ayudante", active="y"))
    payload = dict(
        period_id="1",
        salary="600",
        allowances="0",
        provisions="0",
        charges="0",
        other="0",
        source="Prueba",
        days="10",
        hours="1",
        excluded="0",
        productive="100",
        mod="100",
        cif="0",
        admin="0",
        sales="0",
        basis="equivalent",
        justification="Prueba",
        direct_basis="quantity",
        planned_units="0",
    )
    assert client.post(prefix + "/personal/1/mes", data=payload).status_code == 422
    assert (
        client.post(prefix + "/personal/1/mes", data=payload | {"planned_units": "200"}).status_code
        == 302
    )
    with app.app_context():
        record = db.session.scalar(db.select(EmployeePeriodCost))
        assert record.data["direct_basis"] == "quantity"
        assert labor_cost(payroll_input(record))["unit_rate"] == D("3")
    assert client.get(prefix + "/personal/1/mes?periodo=1").status_code == 200


def test_duplicate_dishes_workers_and_operations_are_rejected(restaurant):
    app, client = restaurant
    dish = dict(name="Receta manual", output_quantity="1", output_unit_code="unit")
    assert client.post("/empresas/1/productos/nuevo", data=dish).status_code == 302
    assert (
        client.post(
            "/empresas/1/productos/nuevo", data=dish | {"name": " RECETA   MANUAL "}
        ).status_code
        == 422
    )
    worker = dict(name="Persona", role="Chef", document="DOC-1", active="y")
    assert client.post("/empresas/1/gestion/personal/nuevo", data=worker).status_code == 302
    assert (
        client.post(
            "/empresas/1/gestion/personal/nuevo", data=worker | {"name": "Otro nombre"}
        ).status_code
        == 422
    )
    op = dict(employee_id="1", activity="Preparar", minutes="10")
    path = "/empresas/1/gestion/recetas/1/operaciones/agregar"
    assert client.post(path, data=op).status_code == 302
    assert client.post(path, data=op | {"activity": " PREPARAR "}).status_code == 422


def test_full_restaurant_cost_price_production_flow(restaurant):
    app, client = restaurant
    stock_source(client)
    assert (
        client.post("/empresas/1/platos-fuente", data={"source_id": "test-only"}).status_code == 302
    )
    prefix = "/empresas/1/gestion"
    assert (
        client.post(
            prefix + "/personal/nuevo", data=dict(name="Chef prueba", role="Chef", active="y")
        ).status_code
        == 302
    )
    payroll = dict(
        period_id="1",
        salary="600",
        allowances="0",
        provisions="0",
        charges="0",
        other="0",
        source="Prueba",
        days="10",
        hours="1",
        excluded="0",
        productive="100",
        mod="100",
        cif="0",
        admin="0",
        sales="0",
        basis="equivalent",
        justification="Prueba",
    )
    assert client.post(prefix + "/personal/1/mes", data=payroll).status_code == 302
    assert (
        client.post(
            prefix + "/recetas/1/operaciones/agregar",
            data=dict(employee_id="1", activity="Preparar", minutes="6"),
        ).status_code
        == 302
    )
    for name, kind, amount, ref in (
        ("Gas", "cif", "100", "G-1"),
        ("Oficina", "admin", "60", "A-1"),
        ("Publicidad", "sales", "40", "V-1"),
    ):
        payload = dict(
            period_id="1",
            name=name,
            kind=kind,
            amount=amount,
            reference_key=ref,
            basis="equivalent",
            behavior="fixed",
            justification="Prueba",
            active="y",
        )
        r = client.post(prefix + "/costos/nuevo", data=payload)
        assert r.status_code == 302, r.text
        # Same cost cannot be repeated under another classification/name with same receipt.
        assert (
            client.post(
                prefix + "/costos/nuevo", data=payload | {"kind": "sales", "name": "Otro"}
            ).status_code
            == 422
        )
        assert (
            client.post(
                prefix + "/costos/nuevo",
                data=payload | {"name": f" {name.upper()} ", "reference_key": "otro"},
            ).status_code
            == 422
        )
    values = dict(
        recipe_id="1",
        quantity="200",
        reference_price="20",
        equivalent_factor="1",
        pricing_mode="margin",
        pricing_value="30",
        adopted_price="",
        tax_percent="0",
        period_id="1",
        price_date="2026-09-30",
        action="calculate",
    )
    response = client.post("/empresas/1/costeo", data=values)
    assert response.status_code == 200, response.text
    assert "Continuar al Plan de Producción" in response.text
    assert "Insumos consolidados" in response.text
    assert "23.60" in response.text
    response = client.post("/empresas/1/costeo", data=values | {"action": "plan"})
    assert response.status_code == 302, response.text
    plan_url = response.location
    assert client.get(plan_url).status_code == 200
    with app.app_context():
        material_id = db.session.get(ProductionPlan, 1).lines[0].recipe.lines[0].material_id
    assert client.post(
        "/empresas/1/inventarios",
        data=dict(
            material_id=str(material_id),
            movement_on="2026-09-01",
            quantity="100",
            unit_cost="20",
            reference="Compra para 200 platos",
            token="restaurant-stock",
        ),
    ).status_code == 302
    with app.app_context():
        plan = db.session.get(ProductionPlan, 1)
        data, result, fingerprint = evaluate(plan)
        assert result["status"] == "calculable", result["issues"]
        assert data["lines"][0]["tax"] == D(".18")
        assert result["requirements"][0]["quantity"] == D("100")  # 800 g / .8 / 2 * 200
        assert result["requirements"][0]["unit"] == "kg"
        assert result["totals"]["cmp"] == D("2000")
        assert result["totals"]["mod_assigned"] == D("600")
        assert result["totals"]["production"] == D("2700")
        assert result["totals"]["costs"] == D("2800")
        assert result["totals"]["profit"] == D("1200")
        assert result["rows"][0]["complete"] == D("14")
        assert result["rows"][0]["price"]["final"] == D("23.60")
        assert result["rows"][0]["admin"] == D("60")
        assert result["rows"][0]["selling"] == D("40")
        assert db.session.scalar(db.select(db.func.count()).select_from(CostConcept)) == 3
    assert client.post(plan_url + "/calcular").status_code == 302
    published = client.post(plan_url + "/publicar", data={"fingerprint": fingerprint})
    assert "/presupuestos/" in published.location
    saved = client.get(published.location + "/descargar").json
    assert saved["result"]["requirements"][0]["quantity"] == "100.00"
    assert client.post("/empresas/2/costeo", data=values).status_code == 422
    assert client.get("/empresas/3/costeo").status_code == 404
    assert client.post("/auth/salir").status_code == 302
    assert client.get(plan_url).status_code == 302
