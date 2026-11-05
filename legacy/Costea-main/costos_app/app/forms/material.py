import re
from datetime import date
from decimal import Decimal
from uuid import uuid4

from flask_wtf import FlaskForm
from wtforms import DateField, HiddenField, SelectField, StringField
from wtforms.validators import (
    DataRequired,
    InputRequired,
    Length,
    Optional,
    Regexp,
    ValidationError,
)

from app.forms.auth import trim


class ExactNumberField(StringField):
    def __init__(self, *args, positive=False, **kwargs):
        self.positive = positive
        super().__init__(*args, **kwargs)

    def pre_validate(self, form):
        raw = (self.data or "").strip()
        if not re.fullmatch(r"[0-9]{1,12}(?:[.,][0-9]{1,6})?", raw):
            raise ValidationError(
                "Ingresa solo el número: hasta 12 enteros y 6 decimales, sin separador de miles."
            )
        self.value = Decimal(raw.replace(",", "."))
        if self.positive and self.value <= 0:
            raise ValidationError("Debe ser mayor que cero.")


class MaterialForm(FlaskForm):
    code = StringField(
        "Código",
        filters=[trim, lambda s: s.upper() if s else s],
        validators=[
            DataRequired(),
            Length(min=7, max=7),
            Regexp(
                r"^[A-Z]{3}-[0-9]{3}$",
                message="Usa exactamente tres letras, un guion y tres números; por ejemplo ABA-001.",
            ),
        ],
    )
    name = StringField(
        "Nombre del material", filters=[trim], validators=[DataRequired(), Length(max=220)]
    )
    category = StringField("Categoría", filters=[trim], validators=[DataRequired(), Length(max=100)])
    supplier = StringField(
        "Proveedor (opcional)", filters=[trim], validators=[Optional(), Length(max=180)]
    )
    base_unit_code = SelectField("Unidad base del costo", validators=[DataRequired()])


class QuickMaterialForm(FlaskForm):
    name = StringField("Nombre", filters=[trim], validators=[DataRequired(), Length(max=100)])
    variety = StringField("Variedad", filters=[trim], validators=[Optional(), Length(max=100)])
    category = SelectField("Categoría", validators=[DataRequired()])
    base_unit_code = SelectField("Unidad", validators=[DataRequired()])
    unit_cost = ExactNumberField(
        "Precio",
        validators=[InputRequired(message="Ingresa el precio por unidad base.")],
    )
    effective_on = DateField(
        "Fecha de actualización", default=date.today, validators=[DataRequired()]
    )


class CostForm(FlaskForm):
    effective_on = DateField(
        "Vigente desde",
        default=date.today,
        validators=[DataRequired(message="Selecciona una fecha válida.")],
    )
    source = StringField(
        "Origen y sustento", filters=[trim], validators=[DataRequired(), Length(max=500)]
    )


class DirectCostForm(CostForm):
    unit_cost = ExactNumberField("Costo por unidad base (sin impuesto recuperable)")


class PriceUpdateForm(FlaskForm):
    unit_cost = ExactNumberField(
        "Precio unitario por unidad base",
        validators=[InputRequired(message="Ingresa el precio por unidad base.")],
    )
    effective_on = DateField(
        "Fecha de vigencia",
        default=date.today,
        validators=[DataRequired(message="Selecciona una fecha valida.")],
    )
    source = StringField(
        "Proveedor / Sustento (opcional)",
        filters=[trim],
        validators=[Optional(), Length(max=500)],
    )


class MaterialEntryForm(FlaskForm):
    quantity = ExactNumberField(
        "Cantidad comprada",
        positive=True,
        validators=[InputRequired(message="Ingresa la cantidad comprada.")],
    )
    purchase_unit = SelectField("Unidad de compra", validators=[DataRequired()])
    unit_price = ExactNumberField(
        "Precio unitario",
        validators=[InputRequired(message="Ingresa el precio por unidad de compra.")],
    )
    movement_on = DateField(
        "Fecha",
        default=date.today,
        validators=[DataRequired(message="Selecciona una fecha valida.")],
    )
    token = HiddenField(
        default=lambda: uuid4().hex,
        validators=[
            DataRequired(),
            Length(min=32, max=32),
            Regexp(r"^[0-9a-f]{32}$"),
        ],
    )


class PurchaseCostForm(CostForm):
    quantity = ExactNumberField("Cantidad comprada", positive=True)
    purchase_unit = SelectField("Unidad de compra", validators=[DataRequired()])
    net_amount = ExactNumberField("Importe neto total después de descuentos")
    nonrecoverable_tax = ExactNumberField("Impuesto no recuperable total")
    recoverable_tax = ExactNumberField("Impuesto recuperable total (fuera del costo)")
    attributable_cost = ExactNumberField("Otros costos atribuibles totales")


class ConversionForm(FlaskForm):
    label = StringField(
        "Nombre de la presentación o equivalencia",
        filters=[trim],
        validators=[DataRequired(), Length(max=80)],
    )
    factor = ExactNumberField("Unidades base por una unidad de esta presentación", positive=True)
    evidence = StringField(
        "Sustento de la equivalencia", filters=[trim], validators=[DataRequired(), Length(max=500)]
    )
