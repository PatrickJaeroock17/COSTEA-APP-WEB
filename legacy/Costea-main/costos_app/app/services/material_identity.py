"""Commercial material codes and restaurant-scoped duplicate validation."""

import re
import unicodedata

from app.extensions import db
from app.models import Material

_IGNORED_CATEGORY_WORDS = {"DE", "DEL", "EL", "LA", "LAS", "LOS", "Y"}


def _plain_words(value: str) -> list[str]:
    plain = unicodedata.normalize("NFKD", value or "").encode("ascii", "ignore").decode()
    return re.findall(r"[A-Z0-9]+", plain.upper())


def category_prefix(category: str) -> str:
    """Return a stable three-character prefix derived from a category label."""
    words = [word for word in _plain_words(category) if word not in _IGNORED_CATEGORY_WORDS]
    if not words:
        return "INS"
    prefix = words[0][:3]
    if len(prefix) < 3:
        prefix += "".join(words[1:])[: 3 - len(prefix)]
    return prefix.ljust(3, "X")


def next_material_code(
    company_id: int,
    category: str,
    *,
    reserved_codes: set[str] | None = None,
) -> str:
    """Generate a private code without occupying a master-catalog identifier."""
    prefix = category_prefix(category)
    pattern = re.compile(rf"^{re.escape(prefix)}-(\d{{3}})$")
    codes = set(
        db.session.scalars(
            db.select(Material.code).where(
                Material.company_id == company_id,
                Material.code.like(f"{prefix}-%"),
            )
        )
    )
    codes.update(reserved_codes or set())
    sequence = max(
        (int(match.group(1)) for code in codes if (match := pattern.fullmatch(code))),
        default=0,
    )
    if sequence >= 999:
        raise ValueError(
            f"La categoría {prefix} alcanzó el máximo de 999 insumos en este restaurante."
        )
    return f"{prefix}-{sequence + 1:03d}"


def duplicate_material(
    company_id: int,
    *,
    name: str,
    variety: str | None,
    code: str | None = None,
    exclude_id: int | None = None,
) -> tuple[Material | None, str | None]:
    """Find a duplicate code or normalized name/variety inside one restaurant."""
    normalized_code = (code or "").strip().casefold()
    normalized_name = (name or "").strip().casefold()
    normalized_variety = (variety or "").strip().casefold()
    statement = db.select(Material).where(Material.company_id == company_id)
    if exclude_id is not None:
        statement = statement.where(Material.id != exclude_id)
    for material in db.session.scalars(statement):
        if normalized_code and material.code.strip().casefold() == normalized_code:
            return material, "code"
        if (
            material.name.strip().casefold() == normalized_name
            and (material.variety or "").strip().casefold() == normalized_variety
        ):
            return material, "name_variety"
    return None, None


def duplicate_message(material: Material, reason: str) -> str:
    if reason == "code":
        return (
            f"Ya existe el insumo {material.code} en este restaurante, incluso si está archivado."
        )
    return (
        f"Ya existe {material.display_name} con el código {material.code} en este restaurante. "
        "Abre ese insumo para registrar un precio nuevo."
    )
