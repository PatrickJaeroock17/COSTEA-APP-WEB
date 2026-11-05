from copy import deepcopy
from decimal import Decimal as D

import pytest

from app.services.costing import allocation, calculate_plan, labor_cost, price


def employee(mod="1"):
    return dict(
        id=1,
        name="Operario",
        components=[dict(name="Costo mensual", amount=D("2400"), source="Prueba")],
        fractions=dict(mod=D(mod), cif=1 - D(mod), admin=D("0"), sales=D("0")),
        days=D("20"),
        hours=D("8"),
        excluded=D("0"),
        productive=D(".8"),
        basis="equivalent",
        justification="Mismo producto",
    )


def scenario(quantity="800"):
    return dict(
        staff=[employee()],
        no_cif=False,
        no_expenses=False,
        concepts=[
            dict(
                id="cif",
                name="CIF",
                kind="cif",
                amount=D("800"),
                basis="equivalent",
                targets=[],
                justification="Iguales",
            ),
            dict(
                id="expense",
                name="Gastos",
                kind="admin",
                amount=D("400"),
                basis="equivalent",
                targets=[],
                justification="Iguales",
            ),
        ],
        lines=[
            dict(
                id=1,
                product_id=1,
                name="Producto",
                unit="ud",
                quantity=D(quantity),
                output=D("20"),
                no_materials=False,
                no_labor=False,
                materials=[
                    dict(
                        name="Material",
                        version=1,
                        quantity=D("1"),
                        factor=D("1"),
                        unit_cost=D("120"),
                        mode="gross",
                        rate=D("0"),
                    )
                ],
                operations=[dict(employee_id=1, activity="Producir", minutes=D("160"))],
                equivalent_factor=D("1"),
                reference_price=D("15"),
                pricing_mode="manual",
                pricing_value=D("17.70"),
                tax=D(".18"),
                adopted_price=None,
            )
        ],
    )


def test_labor_and_mixed_resource():
    cost = labor_cost(employee())
    assert cost["minutes"] == D("7680")
    assert cost["rate"] == D(".3125")
    assert cost["rate"] * 8 == D("2.50")
    mixed = labor_cost(employee(".5"))
    assert mixed["cost"] == 1200 and mixed["minutes"] == 3840
    assert mixed["rate"] == cost["rate"] and mixed["indirect"]["cif"] == 1200


def test_labor_by_quantity_and_no_double_charge_for_multiple_activities():
    data = scenario("800")
    data["staff"][0].update(direct_basis="quantity", planned_units=D("800"))
    data["lines"][0]["operations"].append(
        dict(employee_id=1, activity="Otra actividad", minutes=D("0"))
    )
    result = calculate_plan(data)
    assert result["status"] == "calculable", result["issues"]
    assert result["rows"][0]["mod"] == D("3")
    assert result["totals"]["mod_assigned"] == D("2400")
    assert result["totals"]["idle"] == 0
    assert result["staff"][0]["required_units"] == 800
    data["lines"][0]["quantity"] = D("801")
    assert calculate_plan(data)["status"] == "capacidad_excedida"


def test_consolidation_combines_same_ingredient_with_different_prices():
    data = scenario("800")
    second = deepcopy(data["lines"][0])
    second.update(id=2, product_id=2, quantity=D("100"))
    second["materials"][0].update(unit_cost=D("150"), version=2)
    data["lines"].append(second)
    result = calculate_plan(data)
    assert len(result["requirements"]) == 1
    ingredient = result["requirements"][0]
    assert ingredient["quantity"] == D("45")
    assert ingredient["amount"] == D("5550")
    assert ingredient["price_versions"] == [1, 2]


def test_full_reconciliation_required_case():
    result = calculate_plan(scenario())
    assert result["status"] == "calculable", result["issues"]
    totals = result["totals"]
    for key, expected in dict(
        cmp="4800",
        mod_available="2400",
        mod_assigned="2000",
        idle="400",
        cif="800",
        expenses="400",
        costs="8400",
        sales="12000",
        profit="3600",
        margin=".30",
        complete_assigned="8000",
        bridge="8400",
    ).items():
        assert totals[key] == D(expected), key
    assert result["rows"][0]["complete"] == 10


def test_capacity_exceeded_blocks_final_profit():
    result = calculate_plan(scenario("1000"))
    assert result["status"] == "capacidad_excedida"
    assert result["staff"][0]["excess"] == 320
    assert result["totals"]["profit"] is None


def test_allocation_bases_cents_and_missing_base():
    assert allocation(D("900"), {1: D("100"), 2: D("200")})["exact"] == {1: D("300"), 2: D("600")}
    assert allocation(D("300"), {1: D("1000"), 2: D("500")})["exact"] == {1: D("200"), 2: D("100")}
    rounded = allocation(D("100"), {1: D("1"), 2: D("1"), 3: D("1")})
    assert rounded["rounded"] == {1: D("33.34"), 2: D("33.33"), 3: D("33.33")}
    assert sum(rounded["exact"].values()) == 100
    assert allocation(D("9"), {1: D("0")})["unassigned"] == 9
    assert allocation(D("0"), {1: D("0")})["unassigned"] == 0


def test_markup_margin_and_manual_tax():
    p = price(D("100"), "markup", D(".25"), D(".18"))
    assert p["net"] == 125 and p["final"] == D("147.50") and p["margin"] == D(".2")
    p = price(D("100"), "margin", D(".25"), D("0"))
    assert p["suggested"] == D("133.3333333333333333333333333")
    assert p["final"] == D("133.33")
    p = price(D("80"), "manual", D("118"), D(".18"))
    assert p["net"] == 100 and p["tax"] == 18 and p["result"] == 20 and p["margin"] == D(".2")
    assert price(D("80"), "manual", D("0"), D(".18"))["margin"] is None
    assert price(D("80"), "manual", D("50"), D("0"))["result"] == -30
    assert price(D("0"), "manual", D("0"), D("0"))["markup"] is None
    with pytest.raises(ValueError):
        price(D("100"), "margin", D("1"), D("0"))


def test_mixed_payroll_is_included_once_and_no_circular_price():
    data = scenario("400")
    data["staff"] = [employee(".5")]
    result = calculate_plan(data)
    assert result["status"] == "calculable"
    assert result["totals"]["mod_available"] == 1200
    assert result["totals"]["cif"] == 2000  # 800 + 1200 salary transfer
    assert result["totals"]["costs"] == 6000  # 2400 materials + 2400 labor + 800 CIF + 400 expenses
    data["concepts"][0]["basis"] = "sales"
    old = calculate_plan(data)["allocations"][0]["exact"]
    data["lines"][0]["pricing_value"] = D("500")
    assert calculate_plan(data)["allocations"][0]["exact"] == old


@pytest.mark.parametrize(
    "change",
    [
        "missing_materials",
        "missing_labor",
        "no_tax",
        "zero_productivity",
        "zero_base",
        "zero_production",
    ],
)
def test_incomplete_inputs_never_produce_final_profit(change):
    data = deepcopy(scenario())
    if change == "missing_materials":
        data["lines"][0]["materials"] = []
    if change == "missing_labor":
        data["lines"][0]["operations"] = []
    if change == "no_tax":
        data["lines"][0]["tax"] = None
    if change == "zero_productivity":
        data["staff"][0]["productive"] = D("0")
    if change == "zero_base":
        data["concepts"][0]["targets"] = [999]
    if change == "zero_production":
        data["lines"][0]["quantity"] = D("0")
    result = calculate_plan(data)
    assert result["status"] != "calculable"
    assert result["totals"]["profit"] is None


def test_explicit_components_not_applicable_and_zero_sales():
    data = scenario()
    data["staff"] = []
    data["concepts"] = []
    data["no_cif"] = True
    data["no_expenses"] = True
    row = data["lines"][0]
    row.update(
        materials=[],
        operations=[],
        no_materials=True,
        no_labor=True,
        pricing_mode="manual",
        pricing_value=D("0"),
    )
    result = calculate_plan(data)
    assert result["status"] == "calculable"
    assert result["totals"]["profit"] == 0 and result["totals"]["margin"] is None
