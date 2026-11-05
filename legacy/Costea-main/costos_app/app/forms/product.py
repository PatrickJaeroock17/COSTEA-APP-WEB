from datetime import date
from decimal import Decimal

from flask_wtf import FlaskForm
from wtforms import DateField, HiddenField, SelectField, StringField
from wtforms.validators import DataRequired, Length, Optional, ValidationError

from app.forms.auth import trim
from app.forms.material import ExactNumberField


class ProductForm(FlaskForm):
    revision = HiddenField()
    name = StringField("Nombre", filters=[trim], validators=[DataRequired(), Length(max=180)])
    description = StringField(
        "Descripción (opcional)", filters=[trim], validators=[Optional(), Length(max=500)]
    )
    output_quantity = ExactNumberField("Rendimiento", positive=True, default="1")
    output_unit_code = SelectField("Unidad del producto terminado", default="unit")


class QuantityForm(FlaskForm):
    revision = HiddenField(validators=[DataRequired()])
    quantity = ExactNumberField("Cantidad usada en toda la receta / lote", positive=True)
    unit_key = SelectField("Unidad de la cantidad usada")
    mode = SelectField(
        "Cómo está expresada la cantidad",
        choices=[
            ("gross", "Cantidad bruta: ya incluye lo que se consume"),
            ("loss", "Cantidad neta: ajustar por pérdida sobre la entrada"),
            ("additional", "Cantidad neta: agregar un porcentaje sobre la necesidad"),
        ],
        default="loss",
    )
    percent = ExactNumberField("Merma o adicional (%)", default="0")

    def validate_percent(self, field):
        if not hasattr(field, "value"):
            return
        if self.mode.data == "loss" and field.value >= 100:
            raise ValidationError("La pérdida debe ser menor que 100 %.")
        if self.mode.data == "gross" and field.value != 0:
            raise ValidationError("En cantidad bruta, ingresa 0 para no duplicar la merma.")

    @property
    def rate(self):
        return self.percent.value / Decimal("100")


class QuickIngredientForm(QuantityForm):
    name = StringField(
        "Nombre del insumo", filters=[trim], validators=[DataRequired(), Length(max=180)]
    )
    price = ExactNumberField("Precio por unidad de compra")
    price_unit_code = SelectField("Unidad a la que corresponde ese precio", default="kg")
    effective_on = DateField("Fecha del precio", default=date.today, validators=[DataRequired()])
    source = StringField(
        "Origen del precio (opcional)", filters=[trim], validators=[Optional(), Length(max=500)]
    )


class OptionalNumberField(ExactNumberField):
    def pre_validate(self, form):
        if not (self.data or "").strip():
            self.value = None
            return
        super().pre_validate(form)


class CatalogIngredientForm(QuantityForm):
    cost_id = SelectField("Precio del catálogo que se usará", coerce=int)
    new_price = OptionalNumberField("Nuevo precio por unidad base (opcional)")
    effective_on = DateField(
        "Fecha del nuevo precio", default=date.today, validators=[DataRequired()]
    )


class RecipeActionForm(FlaskForm):
    revision = HiddenField(validators=[DataRequired()])


class ScaleRecipeForm(RecipeActionForm):
    output_quantity = ExactNumberField("Nuevo rendimiento de la receta", positive=True)
