from decimal import Decimal as D

import pytest
from test_planning import flow as plan_flow

from app.extensions import db
from app.models import Employee, EmployeePeriodCost
from app.services.worker_minutes import worker_minute_rows


@pytest.fixture
def setup(catalog):
    return plan_flow.__wrapped__(catalog)


def test_monthly_minutes_productivity_and_no_fabricated_rates(setup):
    app, _, *_ = setup
    with app.app_context():
        record = db.session.scalar(db.select(EmployeePeriodCost))
        record.data = record.data | dict(
            components=[dict(name="Sueldo", amount="2725", source="Prueba")],
            days="26",
            hours="8",
            productive=".9",
            excluded="0",
        )
        db.session.add(Employee(company_id=1, name="Pendiente", role="Ayudante", active=True))
        db.session.add(Employee(company_id=2, name="Ajeno", role="Privado", active=True))
        db.session.commit()
        rows = worker_minute_rows(1, 1)
        row = next(r for r in rows if r["employee"].id == 1)
        assert row["programmed"] == 12480 and row["effective"] == 11232
        assert row["productive"] == D(".9")
        assert row["rate"] == D("2725") / D("11232")
        pending = next(r for r in rows if r["employee"].name == "Pendiente")
        assert pending["salary"] is None and pending["rate"] is None
        assert all(r["employee"].name != "Ajeno" for r in rows)
        record.data = record.data | dict(excluded="480", productive=".85")
        db.session.commit()
        assert worker_minute_rows(1, 1)[1]["effective"] == D("10200")
        record.data = record.data | dict(productive="0")
        db.session.commit()
        assert worker_minute_rows(1, 1)[1]["rate"] is None


def test_table_and_new_worker_inputs_are_available(setup):
    _, client, prefix, *_ = setup
    page = client.get("/empresas/1/costeo?plan=1&plato=1").text
    assert "Costo por minuto de trabajador" in page
    table = page.split('class="table worker-minute-table"')[1].split("</table>")[0]
    assert "9600" in table and "7680" in table and "0.3125" in table
    assert "PEN 2400.00" in table and "80.00 %" in table
    page = client.get(prefix + "/personal/nuevo").text
    for field in ("salary", "days", "hours", "productive", "excluded"):
        assert f'name="payroll-{field}"' in page
