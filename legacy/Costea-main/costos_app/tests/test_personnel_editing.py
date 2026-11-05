"""Exercise real personnel forms and SQL writes with the supplied catalog data."""

import re
from contextlib import contextmanager
from datetime import date
from decimal import Decimal
from html.parser import HTMLParser
from pathlib import Path
from types import SimpleNamespace

import pytest
from sqlalchemy import event, text
from werkzeug.datastructures import MultiDict

from app.extensions import db
from app.models import Company, Industry, Product, RecipeVersion
from app.models.planning import (
    Budget,
    Employee,
    EmployeePeriodCost,
    ProductionPlan,
    RecipeWork,
    RestaurantLaborProfile,
)
from app.services import labor_scenario as catalog_service


class FormInputs(HTMLParser):
    def __init__(self):
        super().__init__()
        self.data = MultiDict()
        self.select = None
        self.option = None
        self.textarea = None
        self.template_depth = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "template":
            self.template_depth += 1
        if self.template_depth:
            return
        if tag == "input" and attrs.get("name"):
            if attrs.get("type") != "checkbox" or "checked" in attrs:
                self.data.add(attrs["name"], attrs.get("value", "y"))
        if tag == "select":
            self.select = attrs["name"]
        if tag == "option":
            self.option = attrs
        if tag == "textarea":
            self.textarea = attrs["name"]
            self.data.add(self.textarea, "")

    def handle_endtag(self, tag):
        if tag == "template":
            self.template_depth -= 1
        if self.template_depth:
            return
        if tag == "option" and "selected" in self.option:
            self.data.add(self.select, self.option["value"])
        if tag == "select":
            self.select = None
        if tag == "textarea":
            self.textarea = None

    def handle_data(self, value):
        if self.textarea and not self.template_depth:
            self.data[self.textarea] += value


def form_data(response):
    parser = FormInputs()
    parser.feed(response.text)
    return parser.data


@pytest.fixture
def editable_personnel(catalog, monkeypatch):
    app, client = catalog
    with app.app_context():
        industry = db.session.scalar(db.select(Industry).where(Industry.slug == "restaurantes"))
        for ident in (1, 2, 3):
            db.session.get(Company, ident).industry_id = industry.id
        db.session.commit()
        connection = db.session.connection()
        connection.exec_driver_sql("ATTACH DATABASE ':memory:' AS dbo")
        source = (Path(__file__).parents[2] / "cevicheria_costos_completo.sql").read_text(
            encoding="utf-8-sig"
        )
        tables = (
            "parametros_laborales",
            "areas_personal",
            "trabajadores",
            "contratos_personal",
            "hijos_personal",
            "beneficios_personal",
            "jornadas_personal",
            "vacaciones_personal",
        )
        for table in tables:
            schema = re.search(rf"CREATE TABLE dbo\.{table} \((.*?)\n    \);", source, re.S).group(
                1
            )
            schema = schema.replace("N'", "'").replace("REFERENCES dbo.", "REFERENCES ")
            connection.exec_driver_sql(f"CREATE TABLE dbo.{table} ({schema})")
            for statement in re.findall(rf"INSERT INTO dbo\.{table} [^\r\n]+", source):
                connection.exec_driver_sql(statement.replace("N'", "'"))
        benefits = ",".join(
            f"b.{name}"
            for name in (
                "bono_remunerativo_mes",
                "bolsa_viveres_mes",
                "movilidad_condicion_mes",
                "alimentacion_condicion_mes",
                "escolaridad_por_hijo_anual",
                "canasta_navidad_anual",
                "uniformes_epp_anual",
                "examenes_capacitacion_anual",
                "eps_empresa_mes",
                "vida_ley_mes_estimada",
                "sctr_salud_mes_estimada",
                "sctr_pension_mes_estimada",
                "accidente_adicional_mes",
                "horas_extra_25_mes",
                "horas_extra_35_mes",
                "utilidades_anual",
                "reemplazo_vacaciones_anual",
            )
        )
        connection.exec_driver_sql(
            "CREATE VIEW dbo.vista_costo_anual_trabajador AS SELECT c.*, t.nombres,t.apellidos,t.cargo, "
            "a.nombre AS area, a.clasificacion_costo, " + benefits + ", "
            "c.tarifa AS remuneracion_basica_mes, c.tarifa AS costo_mensual_equivalente, "
            "c.tarifa*12 AS costo_anual_completo FROM contratos_personal c "
            "JOIN trabajadores t ON t.codigo_trabajador=c.codigo_trabajador "
            "JOIN areas_personal a ON a.codigo_area=t.codigo_area "
            "JOIN beneficios_personal b ON b.codigo_contrato=c.codigo_contrato WHERE c.activo=1 AND t.activo=1"
        )
        connection.exec_driver_sql(
            "CREATE VIEW dbo.vista_desglose_anual_personal AS SELECT codigo_contrato,1 AS orden, "
            "'Sueldo básico anual' AS concepto,costo_anual_completo AS importe_anual,'SUMA' AS tratamiento "
            "FROM vista_costo_anual_trabajador"
        )
        db.session.commit()
        engine = db.engine

    def adapt_values(conn, cursor, statement, parameters, context, executemany):
        def adapt(row):
            return tuple(str(value) if isinstance(value, Decimal) else value for value in row)

        return statement, [adapt(row) for row in parameters] if executemany else adapt(parameters)

    event.listen(engine, "before_cursor_execute", adapt_values, retval=True)

    class CatalogResult:
        def __init__(self, result):
            self.result = result

        def mappings(self):
            integer_fields = {
                "id_escenario",
                "id_restaurante",
                "anio_calendario",
                "es_simulado",
                "activo",
                "trabajador_activo",
                "dias_semana",
                "dia_iso",
                "orden",
                "edad_al_corte",
                "cursa_superiores",
                "acreditado",
                "escolaridad_simulada",
                "anio",
                "trabaja_feriados",
                "tiene_suspension_cuarta",
                "dias_semana_empresa",
            }
            rows = [
                {
                    key: Decimal(str(value))
                    if isinstance(value, (float, int)) and key not in integer_fields
                    else value
                    for key, value in row.items()
                }
                for row in self.result.mappings()
            ]

            class Rows(list):
                def first(self):
                    return self[0] if self else None

            return Rows(rows)

        def scalars(self):
            return self.result.scalars()

    class CatalogConnection:
        def exec_driver_sql(self, statement):
            return CatalogResult(
                db.session.connection().exec_driver_sql(statement.replace("N'", "'"))
            )

        def execute(self, statement, parameters):
            return CatalogResult(db.session.execute(statement, parameters))

    @contextmanager
    def catalog_connection():
        yield CatalogConnection()

    monkeypatch.setattr(catalog_service, "catalog_connection", catalog_connection)
    monkeypatch.setattr(
        catalog_service,
        "db",
        SimpleNamespace(engine=SimpleNamespace(dialect=SimpleNamespace(name="mssql"))),
    )
    yield app, client
    event.remove(engine, "before_cursor_execute", adapt_values)
    with app.app_context():
        db.session.remove()
        db.session.connection().exec_driver_sql("DETACH DATABASE dbo")


PROFILE = "/empresas/1/gestion/personal/escenario/1/SIM002"


def test_edit_complete_profile_is_scoped_and_keeps_base_codes(editable_personnel):
    app, client = editable_personnel
    page = client.get(PROFILE + "/editar?contrato=CT002")
    assert page.status_code == 200
    data = form_data(page)
    data["nombres"] = "Miguel actualizado"
    data["tarifa"] = "3456.78"
    data["bono_remunerativo_mes"] = "350"
    data["sctr_salud_mes_estimada"] = "32.50"
    data["beneficios_observaciones"] = "Seguro actualizado solo aquí"
    data["children-0-edad_al_corte"] = "12"
    child_index = max(int(key.split("-")[1]) for key in data if key.startswith("children-")) + 1
    for key, value in {
        "codigo_hijo": "NUEVO-HIJO",
        "edad_al_corte": "7",
        "acreditado": "y",
        "escolaridad_simulada": "y",
        "observacion": "Hijo añadido",
    }.items():
        data[f"children-{child_index}-{key}"] = value
    data["vacations-0-remove"] = "y"
    for key, value in {
        "anio": "2027",
        "fecha_inicio": "2027-02-01",
        "fecha_fin": "2027-03-02",
        "tipo_dias": "CALENDARIO",
        "observacion": "Vacaciones nuevas",
    }.items():
        data[f"vacations-1-{key}"] = value
    data.setlist("schedule", ["2", "3", "4", "5", "6"])
    result = client.post(PROFILE + "/editar?contrato=CT002", data=data)
    assert result.status_code == 302, re.findall(
        r'.{0,500}<p class="field-error">.{0,100}', result.text, re.S
    )
    own = client.get(PROFILE + "?contrato=CT002")
    assert own.status_code == 200
    assert "Miguel actualizado" in own.text
    assert "Seguro actualizado solo aquí" in own.text
    assert "S/ 3456.78" in own.text
    assert "Personal personalizado" in own.text
    assert "Hijo añadido" in own.text
    assert "Vacaciones nuevas" in own.text
    assert "2027-02-01" in own.text
    assert "SIM002" in own.text and "CT002" in own.text
    other = client.get(PROFILE.replace("/empresas/1/", "/empresas/2/") + "?contrato=CT002")
    assert "Miguel actualizado" not in other.text
    with app.app_context():
        assert (
            db.session.execute(
                text("SELECT tarifa FROM dbo.contratos_personal WHERE codigo_contrato='CT002'")
            ).scalar_one()
            == 3000
        )
        assert db.session.execute(text("SELECT COUNT(*) FROM dbo.trabajadores")).scalar_one() == 14
        assert db.session.scalar(db.select(db.func.count(RestaurantLaborProfile.id))) == 1
    assert "Miguel actualizado" in client.get("/empresas/1/gestion/personal").text
    assert "Miguel actualizado" not in client.get("/empresas/2/gestion/personal").text
    # A restaurant-specific profile remains editable after the first save.
    again = form_data(client.get(PROFILE + "/editar?contrato=CT002"))
    again["cargo"] = "Segundo cambio"
    assert client.post(PROFILE + "/editar?contrato=CT002", data=again).status_code == 302
    assert "Segundo cambio" in client.get(PROFILE).text


def test_delete_only_removes_profile_in_selected_restaurant_and_survives_reload(editable_personnel):
    app, client = editable_personnel
    confirmation = client.get(PROFILE + "/eliminar?contrato=CT002")
    assert confirmation.status_code == 200
    assert client.get(PROFILE).status_code == 200
    result = client.post(PROFILE + "/eliminar?contrato=CT002", data=form_data(confirmation))
    assert result.status_code == 302
    assert client.get(PROFILE).status_code == 404
    assert client.get(PROFILE + "/editar").status_code == 404
    assert "Miguel Torres Salazar" not in client.get("/empresas/1/gestion/personal").text
    assert "Miguel Torres Salazar" in client.get("/empresas/2/gestion/personal").text
    with app.app_context():
        db.session.remove()
        assert db.session.execute(text("SELECT COUNT(*) FROM dbo.trabajadores")).scalar_one() == 13
        assert (
            db.session.execute(text("SELECT COUNT(*) FROM dbo.parametros_laborales")).scalar_one()
            == 1
        )
        assert db.session.scalar(db.select(RestaurantLaborProfile)).deleted is True
    assert client.get(PROFILE).status_code == 404


def test_invalid_profile_and_stale_edit_do_not_change_any_restaurant(editable_personnel):
    app, client = editable_personnel
    original = form_data(client.get(PROFILE + "/editar?contrato=CT002"))
    invalid = original.copy()
    invalid["tarifa"] = "100.001"
    invalid["horas_dia"] = "9"
    invalid.setlist("schedule", [str(day) for day in range(1, 8)])
    assert client.post(PROFILE + "/editar?contrato=CT002", data=invalid).status_code == 422
    with app.app_context():
        assert db.session.scalar(db.select(db.func.count(RestaurantLaborProfile.id))) == 0
    changed = original.copy()
    changed["cargo"] = "Jefe actualizado"
    updated = client.post(PROFILE + "/editar?contrato=CT002", data=changed)
    assert updated.status_code == 302, re.findall(r'<p class="field-error">(.*?)</p>', updated.text)
    stale = original.copy()
    stale["cargo"] = "Cambio obsoleto"
    assert client.post(PROFILE + "/editar?contrato=CT002", data=stale).status_code == 302
    result = client.get(PROFILE)
    assert "Jefe actualizado" in result.text and "Cambio obsoleto" not in result.text


def test_profile_ownership_contract_tampering_and_csrf(editable_personnel):
    app, client = editable_personnel
    for suffix in ("/editar", "/eliminar"):
        foreign = PROFILE.replace("/empresas/1/", "/empresas/3/") + suffix
        assert client.get(foreign).status_code == 404
        assert client.post(foreign, data={}).status_code == 404
        assert client.get(PROFILE + suffix + "?contrato=CT001").status_code == 404
    app.config["WTF_CSRF_ENABLED"] = True
    assert client.post(PROFILE + "/eliminar?contrato=CT002", data={}).status_code == 400
    assert client.get(PROFILE).status_code == 200


def test_profile_storage_preparation_is_idempotent(editable_personnel):
    app, _ = editable_personnel
    for _ in range(2):
        result = app.test_cli_runner().invoke(args=["prepare-labor-profiles"])
        assert result.exit_code == 0


def test_failed_write_rolls_back_private_copy_and_all_related_rows(editable_personnel, monkeypatch):
    app, client = editable_personnel
    from app.services import restaurant_labor

    data = form_data(client.get(PROFILE + "/editar?contrato=CT002"))
    data["nombres"] = "No debe guardarse"
    update = restaurant_labor._update

    def failed_update(*args, **kwargs):
        update(*args, **kwargs)
        raise ValueError("Fallo de escritura simulado")

    monkeypatch.setattr(restaurant_labor, "_update", failed_update)
    assert client.post(PROFILE + "/editar?contrato=CT002", data=data).status_code == 302
    with app.app_context():
        assert db.session.scalar(db.select(db.func.count(RestaurantLaborProfile.id))) == 0
        assert db.session.execute(text("SELECT COUNT(*) FROM dbo.trabajadores")).scalar_one() == 13
        assert (
            db.session.execute(text("SELECT COUNT(*) FROM dbo.parametros_laborales")).scalar_one()
            == 1
        )
    assert "No debe guardarse" not in client.get(PROFILE).text


def test_private_employee_delete_preserves_other_restaurant_and_published_budget(catalog):
    app, client = catalog
    with app.app_context():
        one = Employee(company_id=1, name="Propio", role="Cocina")
        two = Employee(company_id=2, name="Ajeno", role="Cocina")
        db.session.add_all([one, two])
        db.session.flush()
        own_id, other_id = one.id, two.id
        from app.models import Period

        period = Period(company_id=1, year=2026, month=10)
        product = Product(company_id=1, code="PLA-001", name="Plato", revision=1)
        db.session.add_all([period, product])
        db.session.flush()
        recipe = RecipeVersion(
            product_id=product.id,
            number=1,
            author_id=1,
            output_quantity=Decimal("1"),
            output_unit_code="unit",
            currency="PEN",
            product_name="Plato",
        )
        db.session.add(recipe)
        db.session.flush()
        work = RecipeWork(
            recipe_id=recipe.id,
            operations=[{"employee_id": own_id, "activity": "Preparar", "minutes": "5"}],
        )
        plan = ProductionPlan(
            company_id=1,
            period_id=period.id,
            name="Plan",
            price_date=date(2026, 10, 14),
            calculation_hash="old",
        )
        db.session.add_all(
            [work, plan, EmployeePeriodCost(employee_id=own_id, period_id=period.id, data={})]
        )
        db.session.flush()
        snapshot = {"worker": "Propio", "cost": "1000"}
        budget = Budget(
            company_id=1,
            plan_id=plan.id,
            author_id=1,
            number=1,
            snapshot=snapshot,
            fingerprint="snapshot",
        )
        db.session.add(budget)
        db.session.commit()
        work_id, plan_id, budget_id = work.id, plan.id, budget.id
    path = f"/empresas/1/gestion/personal/{own_id}/eliminar"
    page = client.get(path)
    assert page.status_code == 200
    assert "1 configuraciones mensuales y 1 asignaciones" in page.text
    assert client.post(path, data={}).status_code == 302
    assert client.get(f"/empresas/1/gestion/personal/{other_id}/eliminar").status_code == 404
    with app.app_context():
        assert db.session.get(Employee, own_id) is None
        assert db.session.get(Employee, other_id) is not None
        assert db.session.scalar(db.select(db.func.count(EmployeePeriodCost.id))) == 0
        assert db.session.get(RecipeWork, work_id).operations == []
        assert db.session.get(ProductionPlan, plan_id).calculation_hash is None
        assert db.session.get(Budget, budget_id).snapshot == snapshot
