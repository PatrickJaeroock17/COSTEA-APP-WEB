"""Excel reconciliation, payroll, Food Cost, JSON plans and persistence boundaries."""

from decimal import Decimal as D

import pytest
from test_costing_engine import employee, scenario
from test_planning import flow as plan_flow
from test_planning import publish
from test_sql_dishes import MemoryDishStore

from app.extensions import db
from app.models import EmployeePeriodCost, ProductionPlan, Unit
from app.services.costing import calculate_plan, labor_cost, price
from app.services.payroll import PAYROLL_FIELDS, monthly_payroll
from app.services.planning import evaluate, payroll_input
from app.services.recipes import LineInput, calculate_line
from app.services.units import convert_quantity


def detailed_inputs(**changes):
    values = dict.fromkeys(PAYROLL_FIELDS, "0")
    values.update(
        salary="1800",
        bonuses="500",
        family_allowance="50",
        gratification_july="900",
        gratification_december="900",
        cts_annual="1800",
        essalud_percent="9",
        essalud_base=None,
        sctr_base=None,
    )
    return values | changes


def test_excel_cts_omission_is_corrected_and_bases_are_explicit():
    # Hoja1 C5:H5, with J5 based on the workbook's explicit I5=2500.
    # K5=2725 omitted H5=150. Correct total with that base is 2875.
    result = monthly_payroll(detailed_inputs(essalud_base="2500"))
    assert result["total"] == D("2875")
    assert sum(c["amount"] for c in result["components"]) == result["total"]
    # The default base excludes benefit provisions; its assumptions are visible.
    result = monthly_payroll(detailed_inputs())
    assert result["essalud_base_applied"] == D("2350")
    assert result["total"] == D("2861.50")


def test_minimum_base_eps_credit_and_sctr_not_counted_twice():
    result = monthly_payroll(
        detailed_inputs(
            essalud_minimum_base="2500",
            sctr_percent="1.5",
            sctr_base="2000",
            eps_monthly="100",
            eps_credit="50",
            extraordinary_percent="6.75",
        )
    )
    assert result["essalud_gross"] == D("225")
    assert result["total"] == D("2965.125")
    with pytest.raises(ValueError, match="crédito EPS"):
        monthly_payroll(detailed_inputs(eps_monthly="100", eps_credit="101"))


@pytest.mark.parametrize(
    "change",
    [{"salary": "NaN"}, {"salary": "-1"}, {"essalud_percent": "101"}, {"cts_annual": None}],
)
def test_invalid_or_missing_payroll_never_becomes_a_zero(change):
    with pytest.raises(ValueError):
        monthly_payroll(detailed_inputs(**change))


def test_excel_minute_rate_and_net_usable_ingredient(catalog):
    data = employee()
    data.update(components=[{"amount": D("2725")}], days=D("26"), hours=D("8"), productive=D(".9"))
    cost = labor_cost(data)
    assert cost["minutes"] == 11232  # Hoja2 F58
    assert cost["rate"] == D("2725") / D("11232")  # Hoja2 G58
    app, _ = catalog
    with app.app_context():
        kg, g, litre = [db.session.get(Unit, key) for key in ("kg", "g", "l")]
        assert convert_quantity(D("250"), g, kg) == D(".250")
        with pytest.raises(ValueError):
            convert_quantity(D("250"), litre, kg)
    net = calculate_line(LineInput(D("250"), D(".001"), D("80"), "loss", D(".2")))
    assert net.gross_quantity == D(".3125")
    assert net.amount == 25 and net.usable_unit_cost == 100 and net.yield_rate == D(".8")
    with pytest.raises(ValueError):
        calculate_line(LineInput(D("250"), D(".001"), D("80"), "loss", D("1")))


def test_food_cost_and_financial_costs_reconcile():
    p = price(D("12"), "food_cost", D(".30"), D(".18"))
    assert p["suggested"] == D("47.20") and p["net"] == 40 and p["tax"] == D("7.20")
    assert p["cost_ratio"] == D(".30")
    assert price(D("12"), "food_cost", D(".3"), D("0"))["final"] == 40
    assert price(D("12"), "food_cost", D(".3"), D(".18"), D("59"))["cost_ratio"] == D(".24")
    for invalid in (D("0"), D("1.01")):
        with pytest.raises(ValueError):
            price(D("12"), "food_cost", invalid, D(".18"))
    data = scenario()
    data["concepts"].append(
        data["concepts"][1] | dict(id="finance", kind="finance", amount=D("160"))
    )
    data["lines"][0].update(pricing_mode="food_cost", pricing_value=D(".3"))
    result = calculate_plan(data)
    assert result["rows"][0]["production"] == D("9.5")
    assert result["rows"][0]["complete"] == D("10.2")
    assert result["rows"][0]["finance"] == 160
    assert result["totals"]["finance"] == 160 and result["totals"]["difference"] == 0
    assert result["rows"][0]["price"]["final"] == D("40.12")


@pytest.fixture
def full_flow(catalog):
    return plan_flow.__wrapped__(catalog)


def test_detailed_payroll_ui_history_and_sql_snapshot(full_flow):
    app, client, prefix, plan, old_payroll, line_data, recipe = full_flow
    budget = publish(client, plan)
    old_snapshot = client.get(budget + "/descargar").json
    store = MemoryDishStore()
    app.extensions["dish_store"] = store
    app.config["DISH_SYNC_ENABLED"] = True
    payload = (
        old_payroll
        | detailed_inputs(essalud_base="2350", sctr_base="2350")
        | {"calculation_mode": "detailed"}
    )
    response = client.post(prefix + "/personal/1/mes", data=payload)
    assert response.status_code == 302, response.text
    assert client.get(prefix + "/personal/1/mes?periodo=1").status_code == 200
    assert client.get(budget + "/descargar").json == old_snapshot
    with app.app_context():
        record = db.session.scalar(
            db.select(EmployeePeriodCost).where(EmployeePeriodCost.employee_id == 1)
        )
        assert record.breakdown["inputs"]["cts_annual"] == "1800"
        assert labor_cost(payroll_input(record))["total"] == D("2861.5")
        _, result, _ = evaluate(db.session.get(ProductionPlan, 1))
        assert abs(result["totals"]["difference"]) < D("1e-20")
    dish, _ = store.rows[(1, 1)]
    assert dish["schema_version"] == 2
    assert dish["planes"][0]["planilla"][0]["breakdown"]["inputs"]["cts_annual"] == "1800"
    for invalid in ({"essalud_percent": "101"}, {"eps_credit": "1"}):
        assert client.post(prefix + "/personal/1/mes", data=payload | invalid).status_code == 422
    assert client.post("/empresas/3/gestion/personal/1/mes", data=payload).status_code == 404


def test_food_cost_and_finance_forms(full_flow):
    app, client, prefix, plan, _, line_data, _ = full_flow
    payload = line_data | dict(pricing_mode="food_cost", pricing_value="30")
    assert client.post(plan + "/lineas/1", data=payload).status_code == 302
    for bad in ("0", "100.1"):
        assert (
            client.post(plan + "/lineas/1", data=payload | dict(pricing_value=bad)).status_code
            == 422
        )
    response = client.post(
        prefix + "/costos/nuevo",
        data=dict(
            period_id=1,
            name="Intereses",
            kind="finance",
            amount="160",
            basis="equivalent",
            behavior="fixed",
            justification="Financiación de cocina",
            active="y",
        ),
    )
    assert response.status_code == 302, response.text
    assert "Gastos financieros" in client.get(prefix + "/costos").text
    assert "Financieros total" in client.get(plan).text
    with app.app_context():
        _, result, _ = evaluate(db.session.get(ProductionPlan, 1))
        assert result["rows"][0]["complete"] == D("10.2")
        assert result["rows"][0]["price"]["final"] == D("40.12")
