"""Monthly employer cost. Annual benefit budgets are provisioned once over 12 months.

Bases and rates are explicit because contracts/regimes differ. This is a cost
budget, not a payroll declaration. EPS credit is entered separately to avoid
charging both the full EsSalud contribution and a credit already applied.
"""

from decimal import Decimal, localcontext

from app.services.materials import nonnegative

D = Decimal
PAYROLL_FIELDS = (
    "salary",
    "bonuses",
    "family_allowance",
    "gratification_july",
    "gratification_december",
    "cts_annual",
    "extraordinary_percent",
    "essalud_percent",
    "essalud_base",
    "essalud_minimum_base",
    "sctr_percent",
    "sctr_base",
    "eps_monthly",
    "eps_credit",
    "other",
)
OPTIONAL_BASES = {"essalud_base", "sctr_base"}


def monthly_payroll(inputs):
    values = {}
    for key in PAYROLL_FIELDS:
        raw = inputs.get(key)
        if raw is None and key in OPTIONAL_BASES:
            values[key] = None
            continue
        if raw is None:
            raise ValueError(f"Falta el dato de planilla: {key}.")
        try:
            values[key] = nonnegative(D(str(raw)))
        except (ValueError, ArithmeticError):
            raise ValueError(f"Importe de planilla inválido: {key}.") from None
    for key in ("essalud_percent", "sctr_percent", "extraordinary_percent"):
        if values[key] > 100:
            raise ValueError("Las tasas de planilla deben estar entre 0 y 100 %.")
    with localcontext() as ctx:
        ctx.prec = 28
        remuneration = values["salary"] + values["bonuses"] + values["family_allowance"]
        base = values["essalud_base"]
        base = max(remuneration if base is None else base, values["essalud_minimum_base"])
        sctr_base = values["sctr_base"]
        sctr_base = remuneration if sctr_base is None else sctr_base
        essalud = base * values["essalud_percent"] / 100
        if values["eps_credit"] > min(essalud, values["eps_monthly"]):
            raise ValueError("El crédito EPS no puede superar EsSalud ni la prima EPS mensual.")
        july = values["gratification_july"] / 12
        december = values["gratification_december"] / 12
        components = {
            "salary": ("Sueldo básico", values["salary"]),
            "bonuses": ("Bonificaciones mensuales", values["bonuses"]),
            "family_allowance": ("Asignación familiar", values["family_allowance"]),
            "gratification_july": ("Provisión gratificación julio", july),
            "gratification_december": ("Provisión gratificación diciembre", december),
            "cts": ("Provisión CTS", values["cts_annual"] / 12),
            "extraordinary": (
                "Bonificación extraordinaria de gratificaciones",
                (july + december) * values["extraordinary_percent"] / 100,
            ),
            "essalud": ("EsSalud neto de crédito EPS", essalud - values["eps_credit"]),
            "sctr": ("SCTR", sctr_base * values["sctr_percent"] / 100),
            "eps": ("EPS mensual", values["eps_monthly"]),
            "other": ("Otros costos mensuales", values["other"]),
        }
        return {
            "schema_version": 1,
            "inputs": values,
            "essalud_base_applied": base,
            "sctr_base_applied": sctr_base,
            "essalud_gross": essalud,
            "components": [
                dict(key=k, name=name, amount=amount) for k, (name, amount) in components.items()
            ],
            "total": sum((amount for _, amount in components.values()), D("0")),
        }
