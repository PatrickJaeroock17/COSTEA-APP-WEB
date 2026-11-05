"""Exact six-decimal rates stored as integer millionths on every database."""

from decimal import Decimal

SCALE = Decimal("1000000")


def encode_rate(value: Decimal | None) -> int | None:
    if value is None:
        return None
    if not isinstance(value, Decimal) or not value.is_finite() or not 0 <= value <= 1:
        raise ValueError("La tasa debe ser Decimal, finita y estar entre 0 y 1.")
    scaled = value * SCALE
    if scaled != scaled.to_integral_value():
        raise ValueError("La tasa admite hasta seis decimales.")
    return int(scaled)


def decode_rate(value: int | None) -> Decimal | None:
    return Decimal(value) / SCALE if value is not None else None
