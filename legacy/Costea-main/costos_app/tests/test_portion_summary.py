from decimal import Decimal as D

import pytest
from test_costing_engine import scenario
from test_planning import flow as plan_flow

from app.extensions import db
from app.models import ProductionPlan
from app.services.costing import calculate_plan
from app.services.portion_summary import portion_summary


def test_summary_divides_only_monthly_allocations_not_unit_costs():
    result = calculate_plan(scenario())  # recipe yields 20; monthly plan sells 800
    summary = portion_summary(result, 1, D(".18"))
    assert dict(summary["components"]) == {
        "Materia prima": D("6"),
        "Mano de obra directa": D("2.5"),
        "CIF": D("1"),
        "Gastos administrativos": D(".5"),
        "Gastos de ventas": D("0"),
        "Gastos financieros": D("0"),
        "Otros gastos": D("0"),
    }
    assert summary["total"] == 10
    assert summary["profit"] == 5 and summary["net"] == 15
    assert summary["tax"] == D("2.7") and summary["final"] == D("17.7")
    assert summary["suggested"] == D("17.7")
    assert sum(value for _, value in summary["components"]) == summary["total"]


def test_missing_inputs_block_final_summary_and_zero_quantity_is_safe():
    data = scenario()
    data["staff"] = []
    summary = portion_summary(calculate_plan(data), 1, D(".18"))
    assert not summary["complete"]
    assert all(summary[key] is None for key in ("total", "profit", "net", "tax", "final"))
    data["lines"][0]["quantity"] = D("0")
    assert portion_summary(calculate_plan(data), 1, D(".18"))["total"] is None


@pytest.fixture
def setup(catalog):
    return plan_flow.__wrapped__(catalog)


def test_saved_plan_and_new_scenario_render_one_plate_without_writes(setup):
    app, client, _, _, _, line_data, recipe = setup
    path = "/empresas/1/costeo"
    page = client.get(path + "?plan=1&plato=1").text
    assert "Resumen de costo y precio de 1 plato" in page
    table = page.split('class="table portion-cost-table"')[1].split("</table>")[0]
    assert "PEN 10.00" in table and "PEN 17.70" in table
    assert "PEN 800.00" not in table  # entire monthly CIF must not be charged to one plate
    response = client.post(
        path,
        data=line_data
        | dict(recipe_id=recipe, period_id="1", price_date="2026-09-30", action="calculate"),
    )
    assert response.status_code == 200, response.text
    table = response.text.split('class="table portion-cost-table"')[1].split("</table>")[0]
    assert "PEN 10.00" in table and "PEN 17.70" in table
    assert client.get(path + "?plan=999").status_code == 404
    assert client.get(path + "?plato=999").status_code == 404
    assert client.get("/empresas/3/costeo?plan=1").status_code == 404
    with app.app_context():
        assert db.session.scalar(db.select(db.func.count()).select_from(ProductionPlan)) == 1


def test_recipe_detail_shows_complete_cost_after_operational_steps(setup):
    _, client, _, plan, _, line_data, _ = setup
    path = "/empresas/1/productos/1"
    page = client.get(path).text
    assert page.index("Costo de materia prima") < page.index("2 · Mano de obra directa")
    assert page.index("3 · CIF y gastos") < page.index('id="costo-completo"')
    complete = page.split('id="costo-completo"', 1)[1].split('id="precio-final"', 1)[0]
    assert "PEN 10.00" in complete
    assert "PEN 17.70" in complete
    assert "Precio definido en el plan" in complete
    assert "Precio de venta sugerido" not in complete  # The plan uses manual pricing.
    assert (
        client.post(
            plan + "/lineas/1",
            data=line_data | {"pricing_mode": "food_cost", "pricing_value": "30"},
        ).status_code
        == 302
    )
    calculated = client.get(path).text
    assert "Precio de venta sugerido" in calculated
    assert "PEN 39.33" in calculated
    assert client.get(path + "?plan=999").status_code == 404
    assert client.get("/empresas/2/productos/1").status_code == 404
