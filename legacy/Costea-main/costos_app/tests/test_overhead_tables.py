from decimal import Decimal as D

import pytest
from test_planning import flow as plan_flow

from app.extensions import db
from app.models import CostConcept, EmployeePeriodCost, PlanLine, ProductionPlan
from app.services.overhead_tables import overhead_tables
from app.services.planning import evaluate


@pytest.fixture
def setup(catalog):
    return plan_flow.__wrapped__(catalog)


def concept_data(**changes):
    return (
        dict(
            period_id="1",
            name="Publicidad",
            kind="sales",
            amount="160",
            basis="equivalent",
            behavior="fixed",
            justification="Porciones comparables",
            active="y",
        )
        | changes
    )


def test_separate_categories_and_reconciliation(setup):
    app, client, prefix, *_ = setup
    assert client.post(prefix + "/costos/nuevo", data=concept_data()).status_code == 302
    page = client.get(prefix + "/costos").text
    assert page.count('class="table overhead-cost-table"') == 3
    for title in (
        "COSTOS INDIRECTOS DEL RESTAURANTE (FABRICACIÓN)",
        "GASTOS ADMINISTRATIVOS",
        "GASTOS DE VENTAS",
    ):
        assert f"<h2>{title}</h2>" in page
    with app.app_context():
        plan = db.session.get(ProductionPlan, 1)
        result = evaluate(plan)[1]
        groups = overhead_tables(
            list(db.session.scalars(db.select(CostConcept))), result, plan.lines[0]
        )
        assert [g["total"] for g in groups] == [D("1"), D(".5"), D(".2")]
        assert (
            sum(g["total"] for g in groups)
            == result["rows"][0]["complete"] - result["rows"][0]["cmp"] - result["rows"][0]["mod"]
        )
        assert all(g["rows"][0]["percent"] == 1 for g in groups)


def test_concept_can_complete_plan_inputs_atomically(setup):
    app, client, prefix, *_ = setup
    response = client.post(
        prefix + "/costos/nuevo",
        data=concept_data(
            allocation_line_id="1",
            allocation_quantity="1000",
            allocation_reference_price="25",
            allocation_equivalent_factor="2",
        ),
    )
    assert response.status_code == 302, response.text
    assert "plan=1" in response.location and "plato=1" in response.location
    assert client.get(response.location).status_code == 200
    with app.app_context():
        line = db.session.get(PlanLine, 1)
        assert (line.quantity, line.reference_price, line.equivalent_factor) == (
            D("1000"),
            D("25"),
            D("2"),
        )
    for patch in (
        dict(allocation_line_id="999"),
        dict(allocation_quantity="0", allocation_line_id="1"),
        dict(period_id="2", allocation_line_id="1"),
        dict(allocation_quantity="10"),
    ):
        assert (
            client.post(
                prefix + "/costos/nuevo", data=concept_data(name="No guardar") | patch
            ).status_code
            == 422
        )
    with app.app_context():
        assert (
            db.session.scalar(db.select(CostConcept).where(CostConcept.name == "No guardar"))
            is None
        )
        assert db.session.get(PlanLine, 1).quantity == D("1000")
    assert client.get(prefix + "/costos?periodo=2").status_code == 404
    assert client.get(prefix + "/costos?plan=999").status_code == 404
    assert client.get(prefix + "/costos?plato=999").status_code == 404
    assert client.post("/empresas/3/gestion/costos/nuevo", data=concept_data()).status_code == 404


def test_classification_selection_and_missing_plan(catalog):
    app, client = catalog
    path = "/empresas/1/gestion"
    page = client.get(path + "/costos").text
    assert page.count('class="table overhead-cost-table"') == 3
    assert "completa un plan de producción" in page
    page = client.get(path + "/costos/nuevo?tipo=admin").text
    assert '<option selected value="admin">Gasto administrativo</option>' in page
    assert "Costo indirecto de fabricación" in page and "Gasto de ventas" in page
    page = client.get(path + "/costos/nuevo?tipo=finance").text
    assert '<option selected value="finance">Gastos financieros (GF)</option>' in page
    assert client.get(path + "/costos/nuevo?periodo=9999").status_code == 404


def test_indirect_payroll_once_and_inactive_concepts(setup):
    app, _, *_ = setup
    with app.app_context():
        record = db.session.scalar(db.select(EmployeePeriodCost))
        record.data = record.data | dict(fractions=dict(mod=".5", cif=".5", admin="0", sales="0"))
        db.session.get(CostConcept, 2).active = False
        db.session.commit()
        plan = db.session.get(ProductionPlan, 1)
        result = evaluate(plan)[1]
        records = list(db.session.scalars(db.select(CostConcept)))
        groups = overhead_tables(records, result, plan.lines[0])
        assert groups[0]["total"] == D("2.5")  # 800 concept + 1200 payroll / 800 portions
        assert sum(row["payroll"] for row in groups[0]["rows"]) == 1
        assert groups[1]["total"] == 0 and groups[1]["monthly"] == 0
        assert overhead_tables(records)[0]["total"] is None


def test_sales_allocation_uses_unrounded_percentage(setup):
    app, _, *_ = setup
    with app.app_context():
        concept = db.session.get(CostConcept, 1)
        concept.amount = D("8000")
        allocations = [
            dict(
                id="concept-1",
                kind="cif",
                bases={1: D("18720"), 2: D("244450")},
                exact={1: D("8000") * D("18720") / D("263170")},
                amount=D("8000"),
            )
        ]
        line = db.session.get(PlanLine, 1)
        line.quantity = D("468")
        row = overhead_tables([concept], dict(allocations=allocations), line)[0]["rows"][0]
        assert row["percent"] == D("18720") / D("263170")
        assert abs(row["unit_cost"] - D("1.2159440665729377")) < D("1e-15")
