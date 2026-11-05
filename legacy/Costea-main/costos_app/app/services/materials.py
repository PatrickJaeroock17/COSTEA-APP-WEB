"""Exact acquisition arithmetic and explicit date selection, without ORM writes."""

from dataclasses import dataclass
from decimal import Decimal, localcontext


def nonnegative(value):
    if not isinstance(value, Decimal) or not value.is_finite() or value < 0:
        raise ValueError("Se requiere un decimal finito no negativo.")
    return value


@dataclass(frozen=True)
class AcquisitionCost:
    base_quantity: Decimal
    acquisition_amount: Decimal
    unit_cost: Decimal
    recoverable_tax: Decimal


def acquisition_cost(
    quantity, factor, net_amount, nonrecoverable_tax, attributable_cost, recoverable_tax
):
    for value in (
        quantity,
        factor,
        net_amount,
        nonrecoverable_tax,
        attributable_cost,
        recoverable_tax,
    ):
        nonnegative(value)
    if quantity == 0 or factor == 0:
        raise ValueError("La cantidad y el factor deben ser mayores que cero.")
    with localcontext() as ctx:
        ctx.prec = 28
        base_quantity = quantity * factor
        amount = net_amount + nonrecoverable_tax + attributable_cost
        return AcquisitionCost(base_quantity, amount, amount / base_quantity, recoverable_tax)


def version_result(version):
    if version.mode == "direct":
        return nonnegative(version.unit_cost)
    return acquisition_cost(
        version.quantity,
        version.factor,
        version.net_amount,
        version.nonrecoverable_tax,
        version.attributable_cost,
        version.recoverable_tax,
    ).unit_cost


def effective_version(versions, on_date):
    eligible = [version for version in versions if version.effective_on <= on_date]
    return max(eligible, key=lambda version: (version.effective_on, version.id), default=None)


def decimal_text(value):
    if value is None:
        return "—"
    if isinstance(value, str):
        value = Decimal(value)
    result = format(value, "f")
    return result.rstrip("0").rstrip(".") if "." in result else result
