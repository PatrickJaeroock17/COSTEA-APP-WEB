"""Decimal material costing, independent from industry and persistence."""

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal, localcontext

from app.services.materials import nonnegative


@dataclass(frozen=True)
class LineInput:
    quantity: Decimal
    factor: Decimal
    unit_cost: Decimal
    mode: str = "gross"
    rate: Decimal = Decimal("0")


@dataclass(frozen=True)
class LineResult:
    base_quantity: Decimal
    gross_quantity: Decimal
    amount: Decimal
    usable_unit_cost: Decimal
    yield_rate: Decimal | None


def calculate_line(line):
    for value in (line.quantity, line.factor, line.unit_cost, line.rate):
        nonnegative(value)
    if line.quantity <= 0 or line.factor <= 0:
        raise ValueError("La cantidad y el factor deben ser mayores que cero.")
    if line.mode not in ("gross", "loss", "additional"):
        raise ValueError("Modo de cantidad inválido.")
    if line.mode == "loss" and line.rate >= 1:
        raise ValueError("La merma debe ser menor que 100 %.")
    if line.mode == "gross" and line.rate != 0:
        raise ValueError("La cantidad bruta no admite merma adicional.")
    with localcontext() as ctx:
        ctx.prec = 28
        base = line.quantity * line.factor
        gross = base
        if line.mode == "loss":
            gross = base / (1 - line.rate)
        elif line.mode == "additional":
            gross = base * (1 + line.rate)
        return LineResult(
            base,
            gross,
            gross * line.unit_cost,
            (gross * line.unit_cost) / base,
            1 - line.rate if line.mode == "loss" else None,
        )


def recipe_totals(lines, output_quantity):
    nonnegative(output_quantity)
    if output_quantity == 0:
        raise ValueError("El rendimiento debe ser mayor que cero.")
    results = [calculate_line(line) for line in lines]
    if not results:
        return results, None, None
    with localcontext() as ctx:
        ctx.prec = 28
        total = sum((line.amount for line in results), Decimal("0"))
        return results, total, total / output_quantity


def money_text(value):
    if value is None:
        return "—"
    if isinstance(value, str):
        value = Decimal(value)
    with localcontext() as ctx:
        ctx.prec = max(28, len(value.as_tuple().digits) + abs(value.as_tuple().exponent) + 4)
        return format(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP), ".2f")
