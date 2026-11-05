"""Store only selected restaurant inputs and immutable price evidence, not a catalog replica."""

from datetime import date
from decimal import Decimal

from app.extensions import db
from app.models import CompanyUnit, Material, MaterialCostVersion, Unit
from app.services.catalog import catalog_commercial_code
from app.services.material_identity import (
    duplicate_material,
    duplicate_message,
)
from app.services.materials import nonnegative

# Physical conversion aliases, not catalog entries. Names/categories come from SQL Server.
UNIT_CODES = {
    "kg": "kg",
    "kilogramo": "kg",
    "litro": "l",
    "l": "l",
    "g": "g",
    "gramo": "g",
    "ml": "ml",
    "mililitro": "ml",
    "unidad": "unit",
    "und": "unit",
    "unit": "unit",
}


def select_ingredient(company, author_id, item):
    if company.currency != "PEN":
        raise ValueError("Los precios del catálogo están en soles. Usa un restaurante en PEN.")
    code = UNIT_CODES.get(item["unidad"].strip().casefold())
    unit = db.session.get(Unit, code) if code else None
    if unit is None:
        raise ValueError("La unidad de origen no tiene una equivalencia física configurada.")
    price = nonnegative(Decimal(str(item["precio_mayorista"])))
    if not item["activo"]:
        raise ValueError("Este insumo está inactivo. Solo se conserva para históricos.")
    commercial_code = catalog_commercial_code(item)
    material = db.session.scalar(
        db.select(Material).where(
            Material.company_id == company.id, Material.external_insumo_id == item["id_insumo"]
        )
    )
    if material is None:
        duplicate, reason = duplicate_material(
            company.id,
            code=commercial_code,
            name=item["nombre"],
            variety=item["variedad"],
        )
        if duplicate:
            raise ValueError(duplicate_message(duplicate, reason))
        material = Material(
            company_id=company.id,
            code=commercial_code,
            name=item["nombre"],
            variety=item["variedad"],
            category=item["categoria"] or "Sin categoría",
            base_unit_code=unit.code,
            external_insumo_id=item["id_insumo"],
        )
        db.session.add(material)
        db.session.flush()
    else:
        duplicate, reason = duplicate_material(
            company.id,
            code=commercial_code,
            name=item["nombre"],
            variety=item["variedad"],
            exclude_id=material.id,
        )
        if duplicate:
            raise ValueError(duplicate_message(duplicate, reason))
        material.code = commercial_code
        material.name = item["nombre"]
        material.variety = item["variedad"]
        material.category = item["categoria"] or "Sin categoría"
    if material.base_unit_code != unit.code:
        raise ValueError("La unidad de origen cambió. Revisa la equivalencia antes de continuar.")
    material.active = True
    setting = db.session.get(CompanyUnit, (company.id, unit.code))
    if setting:
        setting.enabled = True
    else:
        db.session.add(CompanyUnit(company_id=company.id, unit_code=unit.code))
    updated = item["fecha_actualizacion"]
    effective = (
        updated.date() if hasattr(updated, "date") else date.fromisoformat(str(updated)[:10])
    )
    origin = f"SQL Server · {commercial_code} · actualización {effective.isoformat()}"
    cost = db.session.scalar(
        db.select(MaterialCostVersion).where(
            MaterialCostVersion.material_id == material.id,
            MaterialCostVersion.mode == "direct",
            MaterialCostVersion.effective_on == effective,
            MaterialCostVersion.unit_cost == price,
        )
    )
    if cost is None:
        cost = MaterialCostVersion(
            material_id=material.id,
            author_id=author_id,
            effective_on=effective,
            mode="direct",
            source=origin,
            currency="PEN",
            unit_cost=price,
        )
        db.session.add(cost)
        db.session.flush()
    return material, cost
