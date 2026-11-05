"""Dimensional conversion using exact rational definitions from the catalog."""

from decimal import Decimal

from app.models import Unit


def convert_quantity(quantity: Decimal, source: Unit, target: Unit) -> Decimal:
    if not isinstance(quantity, Decimal) or not quantity.is_finite() or quantity < 0:
        raise ValueError("La cantidad debe ser Decimal, finita y no negativa.")
    if source.dimension != target.dimension:
        raise ValueError("Estas unidades no tienen una conversión universal compatible.")
    return quantity * source.factor_to_base / target.factor_to_base
