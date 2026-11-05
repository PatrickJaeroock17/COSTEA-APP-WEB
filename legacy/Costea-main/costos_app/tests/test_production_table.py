from copy import deepcopy
from decimal import Decimal as D

import pytest
from test_costing_engine import scenario
from test_planning import flow as plan_flow

from app.extensions import db
from app.models import ProductionPlan
from app.services.costing import calculate_plan
from app.services.production_table import production_table


def test_rows_remain_separate_and_monthly_totals_reconcile():
    data = scenario()
    second = deepcopy(data["lines"][0])
    second.update(id=2, product_id=2, name="Segundo plato", quantity=D("100"))
    data["lines"].append(second)
    result = calculate_plan(data)
    table = production_table(result)
    assert len(table["rows"]) == 2
    assert table["quantity"] == 900 and table["sales"] == 13500
    assert sum(r["sales_share"] for r in table["rows"]) == 1
    assert sum(r["share"] for r in table["rows"]) == 1
    assert table["cost"] == result["totals"]["complete_assigned"]
    assert table["cost"] + table["idle"] + table["unassigned"] == result["totals"]["costs"]


@pytest.fixture
def setup(catalog):
    return plan_flow.__wrapped__(catalog)


def test_creation_reuses_prices_and_quantity_and_is_atomic(setup):
    app, client, prefix, *_ = setup
    path = prefix + "/planes/nuevo"
    page = client.get(path).text
    assert 'name="dish_ids"' in page and 'name="quantity_1"' in page
    payload = dict(
        name="Nuevo escenario", period_id="1", price_date="2026-09-30", assumption="y", dish_ids="1"
    )
    response = client.post(path, data=payload)
    assert response.status_code == 302, response.text
    with app.app_context():
        plan = db.session.get(ProductionPlan, 2)
        assert len(plan.lines) == 1
        assert plan.lines[0].quantity == 800 and plan.lines[0].pricing_value == D("17.7")
        assert db.session.get(ProductionPlan, 1).lines[0].quantity == 800
    assert "PLAN DE PRODUCCIÓN" in client.get(response.location).text
    assert client.get(prefix + "/planes").text.count('class="table production-summary-table"') == 2
    for change in (
        dict(dish_ids="999"),
        dict(quantity_1="0"),
        dict(price_1=""),
        dict(dish_ids=["1", "1"]),
    ):
        assert client.post(path, data=payload | change).status_code == 422
    with app.app_context():
        assert db.session.scalar(db.select(db.func.count()).select_from(ProductionPlan)) == 2
    assert client.post("/empresas/3/gestion/planes/nuevo", data=payload).status_code == 404
