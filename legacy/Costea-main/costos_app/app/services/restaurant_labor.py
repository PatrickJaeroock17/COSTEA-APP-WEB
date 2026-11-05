"""Personalize SQL personnel in one restaurant without changing the base catalog."""

import hashlib
import json
import re
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import text

from app.extensions import db
from app.models.planning import RestaurantLaborProfile
from app.services.labor_scenario import labor_scenario, labor_worker_details

LOCAL_INSTALLATION = "COSTEA-PERSONAL"
WORKER_FIELDS = ("nombres", "apellidos", "cargo", "codigo_area", "es_simulado")
CONTRACT_FIELDS = (
    "vinculo",
    "estado_planilla",
    "modalidad",
    "fecha_inicio",
    "tipo_pago",
    "tarifa",
    "horas_dia",
    "horas_servicio_mes",
    "factor_productivo",
    "trabaja_feriados",
    "pension",
    "salud",
    "tiene_suspension_cuarta",
    "activo",
    "observaciones",
)
BENEFIT_FIELDS = (
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


def labor_areas():
    return [
        tuple(row)
        for row in db.session.execute(
            text("SELECT codigo_area, nombre FROM dbo.areas_personal ORDER BY nombre")
        ).tuples()
    ]


def profile_record(company_id, scenario_id, worker_code, *, lock=False):
    query = db.select(RestaurantLaborProfile).where(
        RestaurantLaborProfile.company_id == company_id,
        RestaurantLaborProfile.base_scenario_id == scenario_id,
        RestaurantLaborProfile.base_worker_code == worker_code,
    )
    if lock:
        query = query.with_hint(
            RestaurantLaborProfile, "WITH (UPDLOCK, HOLDLOCK)", dialect_name="mssql"
        )
    return db.session.scalar(query)


def public_worker(worker, profile):
    reverse_contracts = {v: k for k, v in profile.references["contracts"].items()}
    return worker | {
        "codigo_trabajador": profile.base_worker_code,
        "id_escenario": profile.base_scenario_id,
        "codigo_contrato": reverse_contracts[worker["codigo_contrato"]],
        "personalizado": True,
    }


def restaurant_workers(company_id, base_workers):
    profiles = list(
        db.session.scalars(
            db.select(RestaurantLaborProfile).where(RestaurantLaborProfile.company_id == company_id)
        )
    )
    by_key = {(p.base_scenario_id, p.base_worker_code): p for p in profiles}
    local_workers, _ = (
        labor_scenario(company_id) if any(not p.deleted for p in profiles) else ([], 0)
    )
    local_by_code = {}
    for worker in local_workers:
        local_by_code.setdefault(worker["codigo_trabajador"], []).append(worker)
    workers, seen = [], set()
    for worker in base_workers:
        key = (worker["id_escenario"], worker["codigo_trabajador"])
        profile = by_key.get(key)
        if profile is None:
            workers.append(worker)
        elif key not in seen and not profile.deleted:
            workers.extend(
                public_worker(row, profile)
                for row in local_by_code.get(profile.local_worker_code, [])
            )
        seen.add(key)
    for key, profile in by_key.items():
        if key not in seen and not profile.deleted:
            workers.extend(
                public_worker(row, profile)
                for row in local_by_code.get(profile.local_worker_code, [])
            )
    workers.sort(key=lambda row: (row["area"], row["apellidos"], row["nombres"], not row["activo"]))
    return workers, sum(
        (row.get("costo_mensual_equivalente") or Decimal("0") for row in workers), Decimal("0")
    )


def restaurant_details(
    company_id, scenario_id, worker_code, contract_code=None, *, base_loader=None
):
    profile = profile_record(company_id, scenario_id, worker_code)
    if profile is None:
        return (base_loader or labor_worker_details)(worker_code, scenario_id, contract_code)
    if profile.deleted:
        return None
    contracts = profile.references["contracts"]
    local_contract = contracts.get(contract_code) if contract_code else None
    if contract_code and local_contract is None:
        return None
    details = labor_worker_details(
        profile.local_worker_code, profile.local_scenario_id, local_contract, company_id
    )
    if details is None:
        return None
    details["worker"] = public_worker(details["worker"], profile)
    children = {v: k for k, v in profile.references.get("children", {}).items()}
    details["children"] = [
        dict(row) | {"codigo_hijo": children.get(row["codigo_hijo"], row["codigo_hijo"])}
        for row in details["children"]
    ]
    return details


def profile_revision(details):
    return hashlib.sha256(
        json.dumps(details, sort_keys=True, default=str, ensure_ascii=False).encode()
    ).hexdigest()


def _rows(table, where, parameters):
    return [
        dict(row)
        for row in db.session.execute(
            text(f"SELECT * FROM dbo.{table} WHERE {where}"), parameters
        ).mappings()
    ]


def _insert(table, row):
    keys = list(row)
    if any(not re.fullmatch(r"[a-z_][a-z0-9_]*", key) for key in keys):
        raise ValueError("El catálogo contiene columnas de personal no reconocidas.")
    columns = ", ".join(f"[{key}]" for key in keys)
    values = ", ".join(f":{key}" for key in keys)
    db.session.execute(text(f"INSERT INTO dbo.{table} ({columns}) VALUES ({values})"), row)


def _update(table, key, code, values):
    assignments = ", ".join(f"[{name}]=:{name}" for name in values)
    db.session.execute(
        text(f"UPDATE dbo.{table} SET {assignments} WHERE [{key}]=:key_code"),
        values | {"key_code": code},
    )


def _code():
    return "R" + uuid4().hex[:19]


def _clone_profile(company_id, scenario_id, worker_code):
    parameters = _rows(
        "parametros_laborales",
        "id_escenario=:id AND id_instalacion='CATALOGO-BASE' AND id_restaurante=0",
        {"id": scenario_id},
    )
    source_workers = _rows("trabajadores", "codigo_trabajador=:code", {"code": worker_code})
    contracts = _rows(
        "contratos_personal",
        "codigo_trabajador=:code AND id_escenario=:id",
        {"code": worker_code, "id": scenario_id},
    )
    if not parameters or not source_workers or not contracts:
        raise ValueError("El perfil base ya no está disponible. Recarga la lista de trabajadores.")
    hint = " WITH (UPDLOCK, HOLDLOCK)" if db.engine.dialect.name == "mssql" else ""
    new_scenario = db.session.execute(
        text(f"SELECT COALESCE(MAX(id_escenario),0)+1 FROM dbo.parametros_laborales{hint}")
    ).scalar_one()
    _insert(
        "parametros_laborales",
        parameters[0]
        | {
            "id_escenario": new_scenario,
            "id_instalacion": LOCAL_INSTALLATION,
            "id_restaurante": company_id,
        },
    )
    local_worker = _code()
    _insert("trabajadores", source_workers[0] | {"codigo_trabajador": local_worker})
    references = {"contracts": {}, "children": {}}
    for contract in contracts:
        original_code, local_code = contract["codigo_contrato"], _code()
        references["contracts"][original_code] = local_code
        _insert(
            "contratos_personal",
            contract
            | {
                "codigo_contrato": local_code,
                "codigo_trabajador": local_worker,
                "id_escenario": new_scenario,
            },
        )
        for table in ("beneficios_personal", "jornadas_personal", "vacaciones_personal"):
            for row in _rows(table, "codigo_contrato=:code", {"code": original_code}):
                _insert(table, row | {"codigo_contrato": local_code})
    for child in _rows("hijos_personal", "codigo_trabajador=:code", {"code": worker_code}):
        local_child = _code()
        references["children"][child["codigo_hijo"]] = local_child
        _insert(
            "hijos_personal",
            child | {"codigo_hijo": local_child, "codigo_trabajador": local_worker},
        )
    profile = RestaurantLaborProfile(
        company_id=company_id,
        base_scenario_id=scenario_id,
        base_worker_code=worker_code,
        local_worker_code=local_worker,
        local_scenario_id=new_scenario,
        references=references,
    )
    db.session.add(profile)
    db.session.flush()
    return profile


def _checked_profile(company_id, scenario_id, worker_code, contract_code, revision):
    # Serialize the first customization and later edits in this restaurant.
    from app.models import Company

    db.session.execute(
        db.select(Company.id)
        .where(Company.id == company_id)
        .with_hint(Company, "WITH (UPDLOCK, HOLDLOCK)", dialect_name="mssql")
    )
    profile = profile_record(company_id, scenario_id, worker_code, lock=True)
    if profile and profile.deleted:
        raise ValueError("El trabajador ya fue eliminado de este restaurante.")
    details = restaurant_details(company_id, scenario_id, worker_code, contract_code)
    if details is None or profile_revision(details) != revision:
        raise ValueError(
            "El perfil cambió mientras lo editabas. Recarga su ficha antes de continuar."
        )
    return profile or _clone_profile(company_id, scenario_id, worker_code)


def save_profile(company_id, scenario_id, worker_code, contract_code, revision, data):
    profile = _checked_profile(company_id, scenario_id, worker_code, contract_code, revision)
    local_contract = profile.references["contracts"].get(contract_code)
    if local_contract is None:
        raise ValueError("El contrato no corresponde a este trabajador.")
    _update(
        "trabajadores",
        "codigo_trabajador",
        profile.local_worker_code,
        {key: data[key] for key in WORKER_FIELDS} | {"activo": data["trabajador_activo"]},
    )
    _update(
        "contratos_personal",
        "codigo_contrato",
        local_contract,
        {key: data[key] for key in CONTRACT_FIELDS} | {"dias_semana": len(data["schedule"])},
    )
    _update(
        "beneficios_personal",
        "codigo_contrato",
        local_contract,
        {key: data[key] for key in BENEFIT_FIELDS}
        | {"observaciones": data["beneficios_observaciones"]},
    )
    db.session.execute(
        text("DELETE FROM dbo.jornadas_personal WHERE codigo_contrato=:code"),
        {"code": local_contract},
    )
    for day in data["schedule"]:
        _insert("jornadas_personal", {"codigo_contrato": local_contract, "dia_iso": day})
    db.session.execute(
        text("DELETE FROM dbo.hijos_personal WHERE codigo_trabajador=:code"),
        {"code": profile.local_worker_code},
    )
    references = dict(profile.references)
    references["children"] = {}
    for child in data["children"]:
        code = _code()
        references["children"][child["codigo_hijo"]] = code
        _insert(
            "hijos_personal",
            child | {"codigo_hijo": code, "codigo_trabajador": profile.local_worker_code},
        )
    profile.references = references
    db.session.execute(
        text("DELETE FROM dbo.vacaciones_personal WHERE codigo_contrato=:code"),
        {"code": local_contract},
    )
    for vacation in data["vacations"]:
        _insert("vacaciones_personal", vacation | {"codigo_contrato": local_contract})
    profile.revision += 1
    db.session.flush()


def delete_profile(company_id, scenario_id, worker_code, contract_code, revision):
    profile = _checked_profile(company_id, scenario_id, worker_code, contract_code, revision)
    for code in profile.references["contracts"].values():
        for table in ("beneficios_personal", "jornadas_personal", "vacaciones_personal"):
            db.session.execute(
                text(f"DELETE FROM dbo.{table} WHERE codigo_contrato=:code"), {"code": code}
            )
    db.session.execute(
        text(
            "DELETE FROM dbo.contratos_personal WHERE codigo_trabajador=:code AND id_escenario=:id"
        ),
        {"code": profile.local_worker_code, "id": profile.local_scenario_id},
    )
    db.session.execute(
        text("DELETE FROM dbo.hijos_personal WHERE codigo_trabajador=:code"),
        {"code": profile.local_worker_code},
    )
    db.session.execute(
        text("DELETE FROM dbo.trabajadores WHERE codigo_trabajador=:code"),
        {"code": profile.local_worker_code},
    )
    db.session.execute(
        text(
            "DELETE FROM dbo.parametros_laborales WHERE id_escenario=:id AND id_restaurante=:company AND id_instalacion=:installation"
        ),
        {
            "id": profile.local_scenario_id,
            "company": company_id,
            "installation": LOCAL_INSTALLATION,
        },
    )
    profile.local_worker_code = None
    profile.local_scenario_id = None
    profile.references = {}
    profile.deleted = True
    profile.revision += 1
    db.session.flush()
