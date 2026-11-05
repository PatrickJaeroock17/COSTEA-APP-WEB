import re
from decimal import Decimal as D

import pytest
from test_planning import flow as plan_flow

from app.extensions import db
from app.models import Employee, EmployeePeriodCost, RecipeVersion, RecipeWork
from app.services.labor_table import recipe_labor_table


@pytest.fixture
def setup(catalog):
    return plan_flow.__wrapped__(catalog)


def new_worker_data(recipe):
    return dict(
        name="Nueva cocinera",
        role="Cocinera",
        active="y",
        configure_payroll="y",
        recipe_id=str(recipe),
        recipe_minutes="10",
        **{
            "payroll-period_id": "1",
            "payroll-calculation_mode": "legacy",
            "payroll-salary": "2725",
            "payroll-source": "Costo mensual confirmado",
            "payroll-days": "26",
            "payroll-hours": "8",
            "payroll-productive": "90",
            "payroll-mod": "100",
            "payroll-cif": "0",
            "payroll-admin": "0",
            "payroll-sales": "0",
            "payroll-basis": "equivalent",
            "payroll-justification": "Tiempo de cocina",
            "payroll-direct_basis": "time",
        },
    )


def test_original_sections_and_recipe_labor_table(setup):
    app, client, prefix, _, _, _, recipe = setup
    response = client.get(prefix + f"/personal?periodo=1&receta={recipe}")
    assert response.status_code == 200
    page = response.text
    assert (
        page.index("<h2>Trabajadores</h2>")
        < page.index("<h2>Configuraciones mensuales</h2>")
        < page.index("<h2>Costos de mano de obra directa</h2>")
    )
    assert "TOTAL DE MANO DE OBRA DIRECTA" in page
    with app.app_context():
        employees = list(db.session.scalars(db.select(Employee)))
        records = list(db.session.scalars(db.select(EmployeePeriodCost)))
        result = recipe_labor_table(
            employees,
            records,
            db.session.get(RecipeVersion, recipe),
            db.session.scalar(db.select(RecipeWork)),
        )
        assert result["total"] == 50 and result["per_portion"] == D("2.5")
        assert result["rows"][0]["minutes"] == 160
        assert result["rows"][0]["rate"] == D(".3125")
        # Multiple activities add their times, not duplicate monthly salary.
        work = db.session.scalar(db.select(RecipeWork))
        work.operations = [*work.operations, dict(employee_id=1, activity="Servir", minutes="16")]
        result = recipe_labor_table(employees, records, db.session.get(RecipeVersion, recipe), work)
        assert result["total"] == 55
        assert (
            recipe_labor_table(employees, [], db.session.get(RecipeVersion, recipe), work)["total"]
            is None
        )
    assert client.get(prefix + "/personal?periodo=2").status_code == 404
    assert client.get(prefix + "/personal?receta=9999").status_code == 404


def test_create_worker_payroll_and_minutes_together(setup):
    app, client, prefix, _, _, _, recipe = setup
    path = prefix + "/personal/nuevo"
    page = client.get(path).text
    assert 'name="payroll-salary"' in page and 'name="recipe_minutes"' in page
    assert 'name="payroll-cts_annual"' in page and 'name="payroll-hours"' in page
    response = client.post(path, data=new_worker_data(recipe))
    assert response.status_code == 302, response.text
    assert f"receta={recipe}" in response.location
    with app.app_context():
        worker = db.session.scalar(db.select(Employee).where(Employee.name == "Nueva cocinera"))
        record = db.session.scalar(
            db.select(EmployeePeriodCost).where(EmployeePeriodCost.employee_id == worker.id)
        )
        assert record.period_id == 1 and record.data["days"] == "26"
        work = db.session.scalar(db.select(RecipeWork).where(RecipeWork.recipe_id == recipe))
        assert work.operations[-1]["employee_id"] == worker.id
        assert work.operations[-1]["minutes"] == "10"
        result = recipe_labor_table(
            [worker],
            [record],
            db.session.get(RecipeVersion, recipe),
            type("Work", (), dict(operations=[work.operations[-1]], no_labor=False))(),
        )
        assert result["rows"][0]["rate"] == D("2725") / D("11232")
        assert result["total"] == D("2725") / D("11232") * 10
    assert client.get(response.location).status_code == 200


def test_invalid_onboarding_is_atomic_and_scoped(setup):
    app, client, prefix, _, _, _, recipe = setup
    path = prefix + "/personal/nuevo"
    for override in (
        {"payroll-salary": ""},
        {"recipe_minutes": ""},
        {"payroll-period_id": "2"},
        {"recipe_id": "9999"},
    ):
        response = client.post(path, data=new_worker_data(recipe) | override)
        assert response.status_code == 422, response.text
        with app.app_context():
            assert db.session.scalar(db.select(db.func.count()).select_from(Employee)) == 1
    assert (
        client.post("/empresas/3/gestion/personal/nuevo", data=new_worker_data(recipe)).status_code
        == 404
    )


def test_prefixed_payroll_csrf_and_detailed_creation(setup):
    app, client, prefix, _, _, _, recipe = setup
    app.config["WTF_CSRF_ENABLED"] = True
    path = prefix + "/personal/nuevo"
    payload = new_worker_data(recipe) | {
        "payroll-calculation_mode": "detailed",
        "payroll-gratification_july": "2400",
    }
    assert client.post(path, data=payload).status_code == 400
    page = client.get(path).text
    for name in ("csrf_token", "payroll-csrf_token"):
        payload[name] = re.search(r'name="' + name + r'"[^>]*value="([^"]+)"', page).group(1)
    response = client.post(path, data=payload)
    assert response.status_code == 302, response.text
    with app.app_context():
        record = db.session.scalar(
            db.select(EmployeePeriodCost).where(EmployeePeriodCost.employee_id == 2)
        )
        assert record.breakdown["inputs"]["gratification_july"] == "2400"
