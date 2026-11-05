"""Read the personnel catalog shared by every restaurant."""

from decimal import Decimal

from sqlalchemy import text

from app.extensions import db
from app.services.catalog import catalog_connection


def labor_scenario(company_id=None):
    if db.engine.dialect.name != "mssql":
        return [], Decimal("0")
    scope = (
        "p.id_instalacion = N'CATALOGO-BASE' AND p.id_restaurante = 0"
        if company_id is None
        else "p.id_instalacion = N'COSTEA-PERSONAL' AND p.id_restaurante = " + str(int(company_id))
    )
    with catalog_connection() as connection:
        contracts = [
            dict(row)
            for row in connection.exec_driver_sql(
                f"""SELECT c.*, t.nombres, t.apellidos, t.cargo, t.es_simulado, t.codigo_area,
                          t.activo AS trabajador_activo,
                          a.nombre AS area, a.clasificacion_costo,
                          p.nombre AS escenario_nombre, p.fecha_referencia,
                          p.anio_calendario, p.regimen, p.afp_referencia,
                          p.observaciones AS escenario_observaciones
                   FROM dbo.contratos_personal AS c
                   JOIN dbo.trabajadores AS t
                     ON t.codigo_trabajador = c.codigo_trabajador
                   JOIN dbo.areas_personal AS a ON a.codigo_area = t.codigo_area
                   JOIN dbo.parametros_laborales AS p
                     ON p.id_escenario = c.id_escenario
                   WHERE {scope}
                   ORDER BY a.nombre, t.apellidos, t.nombres, c.activo DESC, c.codigo_contrato"""
            ).mappings()
        ]
        projections = {
            row["codigo_contrato"]: dict(row)
            for row in connection.exec_driver_sql(
                f"""SELECT v.* FROM dbo.vista_costo_anual_trabajador AS v
                   JOIN dbo.parametros_laborales AS p ON p.id_escenario = v.id_escenario
                   WHERE {scope}"""
            ).mappings()
        }
    rows = [
        projections.get(contract["codigo_contrato"], {})
        | contract
        | {"costo_calculado": contract["codigo_contrato"] in projections}
        for contract in contracts
    ]
    return rows, sum(
        (row.get("costo_mensual_equivalente") or Decimal("0") for row in rows),
        Decimal("0"),
    )


def labor_worker_details(worker_code, scenario_id, contract_code=None, company_id=None):
    workers, _ = labor_scenario(company_id)
    worker = next(
        (
            row
            for row in workers
            if row["codigo_trabajador"] == worker_code
            and row["id_escenario"] == scenario_id
            and (contract_code is None or row["codigo_contrato"] == contract_code)
        ),
        None,
    )
    if worker is None:
        return None
    with catalog_connection() as connection:
        parameters = (
            connection.execute(
                text("SELECT * FROM dbo.parametros_laborales WHERE id_escenario=:scenario"),
                {"scenario": scenario_id},
            )
            .mappings()
            .first()
        )
        if parameters is not None:
            worker.update(
                {
                    key: value
                    for key, value in parameters.items()
                    if key not in {"nombre", "observaciones"}
                }
            )
        benefits = (
            connection.execute(
                text("SELECT * FROM dbo.beneficios_personal WHERE codigo_contrato=:contract"),
                {"contract": worker["codigo_contrato"]},
            )
            .mappings()
            .first()
        )
        if benefits is not None:
            worker.update({key: value for key, value in benefits.items() if key != "observaciones"})
            worker["beneficios_observaciones"] = benefits["observaciones"]
        breakdown = list(
            connection.execute(
                text(
                    "SELECT concepto, importe_anual, tratamiento FROM dbo.vista_desglose_anual_personal "
                    "WHERE codigo_contrato=:contract ORDER BY orden"
                ),
                {"contract": worker["codigo_contrato"]},
            ).mappings()
        )
        children = list(
            connection.execute(
                text(
                    "SELECT codigo_hijo, edad_al_corte, acreditado, cursa_superiores, "
                    "escolaridad_simulada, observacion FROM dbo.hijos_personal "
                    "WHERE codigo_trabajador=:worker ORDER BY codigo_hijo"
                ),
                {"worker": worker_code},
            ).mappings()
        )
        vacations = list(
            connection.execute(
                text(
                    "SELECT anio, fecha_inicio, fecha_fin, tipo_dias, observacion "
                    "FROM dbo.vacaciones_personal WHERE codigo_contrato=:contract ORDER BY anio"
                ),
                {"contract": worker["codigo_contrato"]},
            ).mappings()
        )
        schedule = list(
            connection.execute(
                text(
                    "SELECT dia_iso FROM dbo.jornadas_personal WHERE codigo_contrato=:contract "
                    "ORDER BY dia_iso"
                ),
                {"contract": worker["codigo_contrato"]},
            ).scalars()
        )
    return dict(
        worker=worker,
        breakdown=breakdown,
        children=children,
        vacations=vacations,
        schedule=schedule,
    )
