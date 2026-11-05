from datetime import date

from flask_wtf import FlaskForm
from wtforms import DateField, SelectField
from wtforms.validators import DataRequired

from app.forms.material import ExactNumberField


class PriceForm(FlaskForm):
    product_id = SelectField("Plato o producto", coerce=int, validators=[DataRequired()])
    amount = ExactNumberField("Precio de venta por unidad, incluido IGV del 18 %", positive=True)


class SaleForm(FlaskForm):
    product_id = SelectField("Plato o producto vendido", coerce=int, validators=[DataRequired()])
    sold_on = DateField("Fecha de venta", default=date.today, validators=[DataRequired()])
    quantity = ExactNumberField("Cantidad vendida (unidades de salida de la receta)", positive=True)
