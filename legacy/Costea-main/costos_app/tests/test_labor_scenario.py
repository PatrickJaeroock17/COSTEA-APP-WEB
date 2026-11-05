"""The shared catalog keeps complete contracts, including inactive personnel."""

from contextlib import contextmanager
from decimal import Decimal
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine

from app.services import labor_scenario as service


@pytest.fixture
def personnel_catalog(monkeypatch):
    engine = create_engine("sqlite://")
    with engine.connect() as connection:
        connection.exec_driver_sql("ATTACH DATABASE ':memory:' AS dbo")
        statements = [
            "CREATE TABLE dbo.parametros_laborales (id_escenario INTEGER, id_instalacion TEXT, "
            "id_restaurante INTEGER, nombre TEXT, fecha_referencia TEXT, anio_calendario INTEGER, "
            "regimen TEXT, afp_referencia TEXT, observaciones TEXT)",
            "INSERT INTO dbo.parametros_laborales VALUES "
            "(1,'CATALOGO-BASE',0,'Base','2026-10-13',2026,'GENERAL','AFP','Supuesto global'),"
            "(2,'CATALOGO-BASE',99,'Privado','2026-10-13',2026,'GENERAL','AFP','Privado'),"
            "(3,'OTRA-INSTALACION',0,'Otro','2026-10-13',2026,'GENERAL','AFP','Otro')",
            "CREATE TABLE dbo.areas_personal (codigo_area TEXT, nombre TEXT, clasificacion_costo TEXT)",
            "INSERT INTO dbo.areas_personal VALUES ('COCINA','Cocina','MOD')",
            "CREATE TABLE dbo.trabajadores (codigo_trabajador TEXT, nombres TEXT, apellidos TEXT, "
            "cargo TEXT, es_simulado INTEGER, activo INTEGER, codigo_area TEXT)",
            "INSERT INTO dbo.trabajadores VALUES "
            "('SIM001','Ana','Base','Cocinera',1,1,'COCINA'),"
            "('SIM002','Juan','Inactivo','Mozo',0,0,'COCINA')",
            "CREATE TABLE dbo.contratos_personal (codigo_contrato TEXT, codigo_trabajador TEXT, "
            "id_escenario INTEGER, activo INTEGER, observaciones TEXT)",
            "INSERT INTO dbo.contratos_personal VALUES "
            "('CT001','SIM001',1,1,'Contrato vigente'),"
            "('CT002','SIM002',1,0,'Contrato inactivo'),"
            "('CT003','SIM001',1,0,'Contrato anterior'),"
            "('PRIVADO','SIM001',2,1,'Privado'),"
            "('OTRO','SIM001',3,1,'Otro')",
            "CREATE VIEW dbo.vista_costo_anual_trabajador AS SELECT c.*, 2500 AS "
            "costo_mensual_equivalente, 30000 AS costo_anual_completo "
            "FROM contratos_personal c JOIN trabajadores t "
            "ON t.codigo_trabajador=c.codigo_trabajador WHERE c.activo=1 AND t.activo=1",
            "CREATE TABLE dbo.beneficios_personal (codigo_contrato TEXT, "
            "vida_ley_mes_estimada INTEGER, observaciones TEXT)",
            "INSERT INTO dbo.beneficios_personal VALUES "
            "('CT001',10,'Seguro vigente'),('CT003',8,'Seguro anterior')",
            "CREATE TABLE dbo.vista_desglose_anual_personal (codigo_contrato TEXT, "
            "orden INTEGER, concepto TEXT, importe_anual INTEGER, tratamiento TEXT)",
            "INSERT INTO dbo.vista_desglose_anual_personal VALUES "
            "('CT001',1,'Seguro Vida Ley',120,'SUMA'),('CT003',1,'Seguro anterior',96,'SUMA')",
            "CREATE TABLE dbo.hijos_personal (codigo_trabajador TEXT, codigo_hijo TEXT, "
            "edad_al_corte INTEGER, acreditado INTEGER, cursa_superiores INTEGER, "
            "escolaridad_simulada INTEGER, observacion TEXT)",
            "INSERT INTO dbo.hijos_personal VALUES ('SIM001','H01',8,1,0,1,'Hijo acreditado')",
            "CREATE TABLE dbo.vacaciones_personal (codigo_contrato TEXT, anio INTEGER, "
            "fecha_inicio TEXT, fecha_fin TEXT, tipo_dias TEXT, observacion TEXT)",
            "INSERT INTO dbo.vacaciones_personal VALUES "
            "('CT001',2026,'2026-02-01','2026-03-02','CALENDARIO','Vacaciones previstas')",
            "CREATE TABLE dbo.jornadas_personal (codigo_contrato TEXT, dia_iso INTEGER)",
            "INSERT INTO dbo.jornadas_personal VALUES "
            "('CT001',2),('CT001',3),('CT001',4),('CT001',5),('CT001',6),('CT001',7),('CT003',1)",
        ]
        for statement in statements:
            connection.exec_driver_sql(statement)

        class CatalogConnection:
            def exec_driver_sql(self, statement):
                # SQLite accepts the same SELECTs after removing SQL Server's Unicode prefix.
                return connection.exec_driver_sql(statement.replace("N'", "'"))

            def execute(self, statement, parameters):
                return connection.execute(statement, parameters)

        @contextmanager
        def catalog_connection():
            yield CatalogConnection()

        monkeypatch.setattr(service, "catalog_connection", catalog_connection)
        monkeypatch.setattr(
            service,
            "db",
            SimpleNamespace(engine=SimpleNamespace(dialect=SimpleNamespace(name="mssql"))),
        )
        yield
    engine.dispose()


def test_global_catalog_retains_inactive_and_non_simulated_workers(personnel_catalog):
    workers, total = service.labor_scenario()
    assert {worker["codigo_contrato"] for worker in workers} == {"CT001", "CT002", "CT003"}
    assert total == Decimal("2500")
    inactive = next(worker for worker in workers if worker["codigo_contrato"] == "CT002")
    assert inactive["trabajador_activo"] == 0
    assert inactive["es_simulado"] == 0
    assert inactive["costo_calculado"] is False
    assert "costo_mensual_equivalente" not in inactive


def test_contract_details_keep_benefit_notes_children_and_calendar(personnel_catalog):
    details = service.labor_worker_details("SIM001", 1, "CT001")
    worker = details["worker"]
    assert worker["observaciones"] == "Contrato vigente"
    assert worker["beneficios_observaciones"] == "Seguro vigente"
    assert worker["escenario_observaciones"] == "Supuesto global"
    assert worker["vida_ley_mes_estimada"] == 10
    assert details["children"][0]["codigo_hijo"] == "H01"
    assert details["schedule"] == [2, 3, 4, 5, 6, 7]
    assert details["vacations"][0]["fecha_inicio"] == "2026-02-01"
    assert details["breakdown"][0]["importe_anual"] == 120


def test_contract_selector_and_scope_cannot_return_another_contract(personnel_catalog):
    details = service.labor_worker_details("SIM001", 1, "CT003")
    assert details["worker"]["codigo_contrato"] == "CT003"
    assert details["worker"]["costo_calculado"] is False
    assert details["worker"]["vida_ley_mes_estimada"] == 8
    assert details["schedule"] == [1]
    assert service.labor_worker_details("SIM001", 1, "CT002") is None
    assert service.labor_worker_details("SIM001", 2, "PRIVADO") is None
    assert service.labor_worker_details("SIM001", 3, "OTRO") is None
    assert service.labor_worker_details("DESCONOCIDO", 1) is None
