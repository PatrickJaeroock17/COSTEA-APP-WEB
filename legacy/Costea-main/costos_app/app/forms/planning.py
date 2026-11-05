from datetime import date
from decimal import Decimal

from flask_wtf import FlaskForm
from wtforms import (
    BooleanField,
    DateField,
    HiddenField,
    SelectField,
    SelectMultipleField,
    StringField,
)
from wtforms.validators import DataRequired, Length, Optional, ValidationError

from app.forms.auth import trim
from app.forms.material import ExactNumberField
from app.forms.product import OptionalNumberField

BASIS = [
    ("equivalent", "Unidades equivalentes"),
    ("mod", "Minutos MOD"),
    ("sales", "Ventas de referencia sin impuesto"),
]
KINDS = [
    ("cif", "Costo indirecto de fabricación"),
    ("admin", "Gasto administrativo"),
    ("sales", "Gasto de ventas"),
    ("finance", "Gastos financieros (GF)"),
    ("other", "Otros gastos operativos"),
]


class EmployeeForm(FlaskForm):
    name = StringField(
        "Nombre del trabajador", filters=[trim], validators=[DataRequired(), Length(max=180)]
    )
    role = StringField("Cargo", filters=[trim], validators=[DataRequired(), Length(max=180)])
    document = StringField(
        "Documento (opcional)", filters=[trim], validators=[Optional(), Length(max=40)]
    )
    active = BooleanField("Activo", default=True)


class NewEmployeeForm(EmployeeForm):
    configure_payroll = BooleanField("Registrar también costo mensual y tiempo por plato")
    recipe_id = SelectField("Plato al que dedica tiempo (opcional)", coerce=int, default=0)
    recipe_minutes = OptionalNumberField("Minutos de este trabajador para toda la receta / lote")

    def validate_recipe_minutes(self, field):
        if not self.configure_payroll.data:
            return
        value = getattr(field, "value", None)
        if self.recipe_id.data and value is None:
            raise ValidationError("Indica los minutos del lote; usa 0 si no participa.")
        if not self.recipe_id.data and value:
            raise ValidationError("Selecciona el plato al que corresponden los minutos.")


class PayrollForm(FlaskForm):
    period_id = SelectField("Periodo mensual", coerce=int)
    calculation_mode = SelectField(
        "Cálculo de planilla",
        default="legacy",
        choices=[
            ("detailed", "Desglose de sueldo, beneficios y seguros"),
            ("legacy", "Importes mensuales consolidados"),
        ],
    )
    bonuses = ExactNumberField("Bonificaciones mensuales", default="0")
    family_allowance = ExactNumberField("Asignación familiar mensual", default="0")
    gratification_july = ExactNumberField(
        "Gratificación de julio prevista (importe anual, se divide entre 12)", default="0"
    )
    gratification_december = ExactNumberField(
        "Gratificación de diciembre prevista (importe anual, se divide entre 12)", default="0"
    )
    cts_annual = ExactNumberField("CTS total anual prevista (se divide entre 12)", default="0")
    extraordinary_percent = ExactNumberField(
        "Bonificación extraordinaria sobre gratificaciones (%)", default="9"
    )
    essalud_percent = ExactNumberField("EsSalud (%)", default="9")
    essalud_base = OptionalNumberField(
        "Base mensual EsSalud (vacío: sueldo + bonificaciones + asignación familiar)"
    )
    essalud_minimum_base = ExactNumberField(
        "Base mínima EsSalud aplicable al trabajador (0 si no aplica)", default="0"
    )
    sctr_percent = ExactNumberField("SCTR (%)", default="0")
    sctr_base = OptionalNumberField(
        "Base mensual SCTR (vacío: sueldo + bonificaciones + asignación familiar)"
    )
    eps_monthly = ExactNumberField("Prima EPS mensual a cargo del empleador", default="0")
    eps_credit = ExactNumberField("Crédito EPS mensual aplicable contra EsSalud", default="0")
    direct_basis = SelectField(
        "Cómo repartir el trabajo directo",
        default="time",
        choices=[
            ("time", "Por minutos dedicados a cada receta"),
            ("quantity", "Por porciones producidas (esfuerzo comparable)"),
        ],
    )
    planned_units = ExactNumberField(
        "Porciones mensuales previstas del trabajador (0 si usas minutos)", default="0"
    )
    salary = ExactNumberField("Remuneración mensual")
    allowances = ExactNumberField("Asignaciones mensuales", default="0")
    provisions = ExactNumberField("Provisiones mensuales de beneficios", default="0")
    charges = ExactNumberField("Cargas mensuales del empleador", default="0")
    other = ExactNumberField("Otros componentes mensuales", default="0")
    source = StringField(
        "Sustento y composición de los importes",
        filters=[trim],
        validators=[DataRequired(), Length(max=500)],
    )
    days = ExactNumberField("Días programados en el mes")
    hours = ExactNumberField("Horas programadas por día")
    excluded = ExactNumberField("Minutos excluidos del mes", default="0")
    productive = ExactNumberField("Factor productivo (%)", default="100")
    mod = ExactNumberField("Distribución a MOD (%)", default="100")
    cif = ExactNumberField("Distribución a CIF (%)", default="0")
    admin = ExactNumberField("Distribución a administración (%)", default="0")
    sales = ExactNumberField("Distribución a ventas (%)", default="0")
    basis = SelectField("Base para distribuir la parte indirecta del personal", choices=BASIS)
    justification = StringField(
        "Justificación de la distribución",
        filters=[trim],
        validators=[DataRequired(), Length(max=500)],
    )

    def validate_productive(self, field):
        if hasattr(field, "value") and field.value > 100:
            raise ValidationError("Debe estar entre 0 y 100 %.")

    def validate(self, extra_validators=None):
        valid = super().validate(extra_validators)
        if valid and self.calculation_mode.data == "detailed":
            from app.services.payroll import PAYROLL_FIELDS, monthly_payroll

            try:
                self.breakdown = monthly_payroll(
                    {k: getattr(self, k).value for k in PAYROLL_FIELDS}
                )
            except ValueError as exc:
                self.calculation_mode.errors.append(str(exc))
                return False
        return valid

    def validate_planned_units(self, field):
        if self.direct_basis.data == "quantity" and getattr(field, "value", None) == 0:
            raise ValidationError("Indica cuántas porciones produce el trabajador en el mes.")

    def validate_sales(self, field):
        fields = [self.mod, self.cif, self.admin, self.sales]
        if all(hasattr(f, "value") for f in fields) and sum(f.value for f in fields) != Decimal(
            "100"
        ):
            raise ValidationError("Las cuatro distribuciones deben sumar exactamente 100 %.")

    def validate_excluded(self, field):
        if (
            all(hasattr(f, "value") for f in (self.days, self.hours, field))
            and field.value > self.days.value * self.hours.value * 60
        ):
            raise ValidationError("No puede superar los minutos programados del mes.")


class WorkForm(FlaskForm):
    no_materials = BooleanField("Esta receta no requiere materiales")
    no_labor = BooleanField("Esta receta no requiere mano de obra directa")


class OperationForm(FlaskForm):
    employee_id = SelectField("Trabajador", coerce=int)
    activity = StringField(
        "Actividad", filters=[trim], validators=[DataRequired(), Length(max=180)]
    )
    minutes = ExactNumberField("Minutos por lote (0 si el trabajador se reparte por porciones)")


class ConceptForm(FlaskForm):
    period_id = SelectField("Periodo", coerce=int)
    name = StringField("Concepto", filters=[trim], validators=[DataRequired(), Length(max=180)])
    reference_key = StringField(
        "Comprobante o referencia única (opcional)",
        filters=[trim],
        validators=[Optional(), Length(max=180)],
    )
    kind = SelectField("Clasificación", choices=KINDS)
    amount = ExactNumberField("Importe total mensual presupuestado")
    behavior = SelectField(
        "Tipo de gasto",
        choices=[("fixed", "Fijo"), ("variable", "Variable")],
    )
    basis = SelectField("Base de distribución", choices=BASIS)
    justification = StringField(
        "Origen y justificación de la base",
        filters=[trim],
        validators=[DataRequired(), Length(max=500)],
    )
    targets = SelectMultipleField(
        "Productos destinatarios (sin selección = todos los del plan)", coerce=int
    )
    active = BooleanField("Incluir este concepto", default=True)
    allocation_line_id = SelectField(
        "Completar reparto de un plato del plan (opcional)", coerce=int, default=0
    )
    allocation_quantity = OptionalNumberField(
        "Cantidad mensual de platos (vacío conserva la del plan)"
    )
    allocation_reference_price = OptionalNumberField(
        "Venta de referencia por plato sin IGV (vacío conserva la del plan)"
    )
    allocation_equivalent_factor = OptionalNumberField(
        "Factor de unidades equivalentes (vacío conserva el del plan)"
    )

    def validate_allocation_quantity(self, field):
        value = getattr(field, "value", None)
        if value is not None and value <= 0:
            raise ValidationError("La cantidad mensual debe ser mayor que cero.")

    def validate_allocation_equivalent_factor(self, field):
        if getattr(field, "value", None) is not None and field.value <= 0:
            raise ValidationError("El factor debe ser mayor que cero.")

    def validate(self, extra_validators=None):
        valid = super().validate(extra_validators)
        if not self.allocation_line_id.data and any(
            getattr(f, "value", None) is not None
            for f in (
                self.allocation_quantity,
                self.allocation_reference_price,
                self.allocation_equivalent_factor,
            )
        ):
            self.allocation_line_id.errors.append(
                "Selecciona el plato y plan cuyos datos deseas completar."
            )
            return False
        return valid


class PlanForm(FlaskForm):
    name = StringField(
        "Nombre del plan o escenario", filters=[trim], validators=[DataRequired(), Length(max=180)]
    )
    period_id = SelectField("Periodo", coerce=int)
    price_date = DateField(
        "Fecha de referencia de los precios de materiales",
        default=date.today,
        validators=[DataRequired()],
    )
    no_cif = BooleanField("No hay CIF en este periodo")
    no_expenses = BooleanField("No hay gastos administrativos, de ventas ni otros")
    assumption = BooleanField(
        "Confirmo producción igual a ventas, sin inventarios ni productos en proceso",
        validators=[DataRequired(message="Confirma este supuesto para usar el plan.")],
    )


class PlanLineForm(FlaskForm):
    recipe_id = SelectField("Producto y versión de receta", coerce=int)
    quantity = ExactNumberField("Cantidad de productos buenos a producir y vender", positive=True)
    reference_price = ExactNumberField(
        "Valor de venta de referencia SIN impuesto (solo para distribución)", default="0"
    )
    equivalent_factor = ExactNumberField(
        "Factor de unidades equivalentes", positive=True, default="1"
    )
    pricing_mode = SelectField(
        "Modo de precio",
        choices=[
            ("food_cost", "Food Cost objetivo sobre costo total (%)"),
            ("markup", "Recargo sobre costo (%)"),
            ("margin", "Margen sobre venta neta (%)"),
            ("manual", "Precio final manual con impuesto"),
        ],
    )
    pricing_value = ExactNumberField("Objetivo porcentual o precio final, según el modo")
    adopted_price = OptionalNumberField("Precio final adoptado (opcional, reemplaza el sugerido)")
    tax_percent = OptionalNumberField("Impuesto del producto (%) — vacío usa el periodo")

    def validate_pricing_value(self, field):
        if (
            self.pricing_mode.data == "food_cost"
            and hasattr(field, "value")
            and not 0 < field.value <= 100
        ):
            raise ValidationError("El Food Cost objetivo debe ser mayor que 0 y como máximo 100 %.")
        if self.pricing_mode.data == "margin" and hasattr(field, "value") and field.value >= 100:
            raise ValidationError("El margen objetivo debe ser menor que 100 %.")

    def validate_tax_percent(self, field):
        if getattr(field, "value", None) is not None and field.value > 100:
            raise ValidationError("El impuesto debe estar entre 0 y 100 %.")


class PublishForm(FlaskForm):
    fingerprint = HiddenField(validators=[DataRequired()])
