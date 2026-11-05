import re
from datetime import date
from decimal import Decimal, InvalidOperation

from flask_wtf import FlaskForm
from wtforms import SelectField, SelectMultipleField, StringField, SubmitField
from wtforms.validators import DataRequired, InputRequired, Length, Optional, ValidationError

from app.forms.auth import trim

CURRENCIES = [
    ("PEN", "PEN · Sol peruano"),
    ("USD", "USD · Dólar estadounidense"),
    ("EUR", "EUR · Euro"),
]


class TaxPercentField(StringField):
    """Keep invalid text for feedback; parse exactly without floating point."""

    def pre_validate(self, form):
        self.rate = None
        raw = (self.data or "").strip()
        if not raw:
            return
        if not re.fullmatch(r"[0-9]{1,3}(?:[.,][0-9]{1,4})?", raw):
            raise ValidationError("Usa un porcentaje de 0 a 100 con hasta 4 decimales.")
        try:
            percent = Decimal(raw.replace(",", "."))
        except InvalidOperation as error:
            raise ValidationError("Ingresa un porcentaje válido.") from error
        if not Decimal("0") <= percent <= Decimal("100"):
            raise ValidationError("El porcentaje debe estar entre 0 y 100.")
        self.rate = percent / Decimal("100")


class MonthField(StringField):
    def pre_validate(self, form):
        value = self.data or ""
        if not re.fullmatch(r"[0-9]{4}-[0-9]{2}", value):
            raise ValidationError("Selecciona un mes válido (AAAA-MM).")
        year, month = map(int, value.split("-"))
        if not (1900 <= year <= 9999 and 1 <= month <= 12):
            raise ValidationError("El año debe ser de 1900 a 9999 y el mes de 1 a 12.")
        self.year, self.month = year, month


class CompanyForm(FlaskForm):
    legal_name = StringField(
        "Razón social",
        filters=[trim],
        validators=[
            DataRequired(message="Ingresa la razón social."),
            Length(min=2, max=180, message="Usa entre 2 y 180 caracteres."),
        ],
    )
    trade_name = StringField(
        "Nombre comercial (opcional)",
        filters=[trim],
        validators=[
            Optional(),
            Length(max=180, message="Usa hasta 180 caracteres."),
        ],
    )
    tax_id_kind = SelectField(
        "Tipo de identificación",
        choices=[
            ("peru_ruc", "RUC peruano · 11 dígitos"),
            ("other", "Otro identificador"),
        ],
        validators=[InputRequired()],
    )
    tax_id = StringField(
        "Identificador tributario (opcional)",
        filters=[trim],
        validators=[
            Optional(),
            Length(max=20, message="Usa hasta 20 caracteres."),
        ],
    )
    currency = SelectField("Moneda de trabajo", choices=CURRENCIES, validators=[InputRequired()])
    tax_percent = TaxPercentField("IGV sugerido para nuevos periodos (%)", filters=[trim])
    submit = SubmitField("Guardar empresa")

    def validate_tax_id(self, field):
        if not field.data:
            return
        if self.tax_id_kind.data == "peru_ruc" and not re.fullmatch(r"[0-9]{11}", field.data):
            raise ValidationError("El RUC debe contener exactamente 11 dígitos.")
        if self.tax_id_kind.data == "other" and not re.fullmatch(
            r"[A-Za-z0-9 ._/-]{1,20}", field.data
        ):
            raise ValidationError("Usa letras, números, espacios, puntos, barras o guiones.")


class CreateCompanyForm(CompanyForm):
    initial_month = MonthField(
        "Primer periodo de trabajo", default=lambda: date.today().strftime("%Y-%m")
    )


class PeriodForm(FlaskForm):
    month_key = MonthField("Mes y año", default=lambda: date.today().strftime("%Y-%m"))
    tax_percent = TaxPercentField("IGV de este periodo (%)", filters=[trim])
    submit = SubmitField("Crear periodo")


class PeriodTaxForm(FlaskForm):
    tax_percent = TaxPercentField("IGV de este periodo (%)", filters=[trim])
    submit = SubmitField("Guardar impuesto")


class UnitsForm(FlaskForm):
    unit_codes = SelectMultipleField(
        "Unidades disponibles",
        validators=[
            Length(min=1, message="Selecciona al menos una unidad."),
        ],
    )
    submit = SubmitField("Guardar unidades")


class ActionForm(FlaskForm):
    submit = SubmitField("Confirmar")
