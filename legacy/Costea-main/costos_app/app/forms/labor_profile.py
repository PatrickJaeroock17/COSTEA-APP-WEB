"""Editable personnel inputs, with the same bounds as the SQL labor model."""

from decimal import Decimal

from flask_wtf import FlaskForm
from wtforms import (
    BooleanField,
    DateField,
    FieldList,
    Form,
    FormField,
    HiddenField,
    IntegerField,
    SelectField,
    SelectMultipleField,
    StringField,
    TextAreaField,
)
from wtforms.validators import DataRequired, InputRequired, Length, NumberRange, ValidationError

from app.forms.auth import trim
from app.forms.material import ExactNumberField
from app.services.restaurant_labor import BENEFIT_FIELDS, CONTRACT_FIELDS, WORKER_FIELDS

DAYS = [
    (1, "Lunes"),
    (2, "Martes"),
    (3, "Miércoles"),
    (4, "Jueves"),
    (5, "Viernes"),
    (6, "Sábado"),
    (7, "Domingo"),
]
BENEFIT_LABELS = [
    "Bono remunerativo mensual",
    "Bolsa de víveres remunerativa mensual",
    "Movilidad mensual",
    "Alimentación mensual",
    "Escolaridad anual por hijo",
    "Canasta de Navidad anual",
    "Uniformes y EPP anuales",
    "Exámenes y capacitación anuales",
    "Prima EPS mensual",
    "Seguro Vida Ley mensual",
    "SCTR Salud mensual",
    "SCTR Pensión mensual",
    "Seguro adicional de accidentes mensual",
    "Horas extra mensuales con recargo de 25 %",
    "Horas extra mensuales con recargo de 35 %",
    "Utilidades anuales",
    "Reemplazo en vacaciones anual",
]


class SQLNumberField(ExactNumberField):
    def __init__(self, *args, maximum=Decimal("9999999999.99"), scale=2, **kwargs):
        self.maximum = maximum
        self.scale = scale
        super().__init__(*args, **kwargs)

    def pre_validate(self, form):
        super().pre_validate(form)
        if self.value > self.maximum or self.value.as_tuple().exponent < -self.scale:
            raise ValidationError(f"Máximo {self.maximum}; usa hasta {self.scale} decimales.")


class ChildForm(Form):
    codigo_hijo = StringField(
        "Código del hijo", filters=[trim], validators=[DataRequired(), Length(max=20)]
    )
    edad_al_corte = IntegerField(
        "Edad al corte", validators=[InputRequired(), NumberRange(min=0, max=100)]
    )
    acreditado = BooleanField("Acreditado para asignación familiar")
    cursa_superiores = BooleanField("Cursa estudios superiores")
    escolaridad_simulada = BooleanField("Incluir en escolaridad")
    observacion = TextAreaField("Observación", filters=[trim], validators=[Length(max=300)])
    remove = BooleanField("Eliminar este hijo")

    def validate(self, extra_validators=None):
        return self.remove.data or super().validate(extra_validators)


class VacationForm(Form):
    anio = IntegerField("Año", validators=[InputRequired(), NumberRange(min=1900, max=9999)])
    fecha_inicio = DateField("Inicio", validators=[DataRequired()])
    fecha_fin = DateField("Fin", validators=[DataRequired()])
    tipo_dias = SelectField(
        "Tipo de días", choices=[("CALENDARIO", "Calendario"), ("LABORABLES", "Laborables")]
    )
    observacion = TextAreaField("Observación", filters=[trim], validators=[Length(max=500)])
    remove = BooleanField("Eliminar estas vacaciones")

    def validate(self, extra_validators=None):
        if self.remove.data:
            return True
        valid = super().validate(extra_validators)
        if valid and self.fecha_fin.data < self.fecha_inicio.data:
            self.fecha_fin.errors.append("El fin debe ser igual o posterior al inicio.")
            return False
        return valid


class LaborProfileForm(FlaskForm):
    revision = HiddenField(validators=[DataRequired()])
    nombres = StringField("Nombres", filters=[trim], validators=[DataRequired(), Length(max=100)])
    apellidos = StringField(
        "Apellidos", filters=[trim], validators=[DataRequired(), Length(max=100)]
    )
    cargo = StringField("Cargo", filters=[trim], validators=[DataRequired(), Length(max=100)])
    codigo_area = SelectField("Área", validators=[DataRequired()])
    trabajador_activo = BooleanField("Trabajador activo")
    es_simulado = BooleanField("Datos simulados")
    vinculo = SelectField(
        "Vínculo", choices=[("DEPENDIENTE", "Dependiente"), ("INDEPENDIENTE", "Independiente")]
    )
    estado_planilla = SelectField(
        "Estado en planilla",
        choices=[
            ("REGISTRADO", "Registrado"),
            ("NO_REGISTRADO", "No registrado"),
            ("NO_APLICA", "No aplica"),
        ],
    )
    modalidad = StringField(
        "Modalidad", filters=[trim], validators=[DataRequired(), Length(max=40)]
    )
    fecha_inicio = DateField("Fecha de inicio", validators=[DataRequired()])
    tipo_pago = SelectField(
        "Tipo de pago",
        choices=[("MENSUAL", "Mensual"), ("HORA", "Por hora"), ("SERVICIO", "Por servicio")],
    )
    tarifa = SQLNumberField("Tarifa contratada (S/)", positive=True)
    horas_dia = SQLNumberField("Horas diarias", maximum=Decimal("8"))
    horas_servicio_mes = SQLNumberField("Horas de servicio al mes", maximum=Decimal("999999.99"))
    factor_productivo = SQLNumberField(
        "Factor productivo (mayor que 0 y hasta 1)", positive=True, maximum=Decimal("1"), scale=4
    )
    schedule = SelectMultipleField("Días de trabajo", choices=DAYS, coerce=int)
    trabaja_feriados = BooleanField("Trabaja en feriados")
    pension = SelectField(
        "Sistema de pensiones",
        choices=[
            ("ONP", "ONP"),
            ("AFP_FLUJO", "AFP por flujo"),
            ("AFP_SALDO", "AFP por saldo"),
            ("NO_APLICA", "No aplica"),
        ],
    )
    salud = SelectField(
        "Cobertura de salud",
        choices=[("ESSALUD", "EsSalud"), ("EPS", "EPS"), ("NO_APLICA", "No aplica")],
    )
    tiene_suspension_cuarta = BooleanField("Suspensión de retenciones de cuarta categoría")
    activo = BooleanField("Contrato activo")
    observaciones = TextAreaField(
        "Supuestos del contrato", filters=[trim], validators=[Length(max=800)]
    )
    beneficios_observaciones = TextAreaField(
        "Supuestos de los beneficios", filters=[trim], validators=[Length(max=1000)]
    )
    children = FieldList(FormField(ChildForm), max_entries=30)
    vacations = FieldList(FormField(VacationForm), max_entries=20)

    def validate(self, extra_validators=None):
        valid = super().validate(extra_validators)
        if len(set(self.schedule.data)) != len(self.schedule.data) or len(self.schedule.data) > 6:
            self.schedule.errors.append("Selecciona hasta seis días diferentes por semana.")
            valid = False
        if self.vinculo.data == "DEPENDIENTE":
            if (
                self.estado_planilla.data == "NO_APLICA"
                or self.pension.data == "NO_APLICA"
                or self.salud.data == "NO_APLICA"
                or not self.schedule.data
                or getattr(self.horas_dia, "value", 0) <= 0
            ):
                self.vinculo.errors.append(
                    "Para un dependiente, indica planilla, pensión, salud, horas y días de trabajo."
                )
                valid = False
        elif (
            self.estado_planilla.data != "NO_APLICA"
            or self.pension.data != "NO_APLICA"
            or self.salud.data != "NO_APLICA"
            or getattr(self.horas_servicio_mes, "value", 0) <= 0
        ):
            self.vinculo.errors.append(
                "Para un independiente, planilla, pensión y salud deben ser «No aplica»; indica sus horas de servicio."
            )
            valid = False
        for collection, key, message in [
            (self.children, "codigo_hijo", "Los códigos de hijos deben ser diferentes."),
            (self.vacations, "anio", "Solo se admite un periodo de vacaciones por año."),
        ]:
            values = [entry.form[key].data for entry in collection if not entry.form.remove.data]
            if len(set(values)) != len(values):
                collection.errors.append(message)
                valid = False
        return valid

    def profile_data(self):
        keys = (
            *WORKER_FIELDS,
            *CONTRACT_FIELDS,
            *BENEFIT_FIELDS,
            "trabajador_activo",
            "beneficios_observaciones",
            "schedule",
        )
        data = {key: getattr(self[key], "value", self[key].data) for key in keys}
        for name in ("children", "vacations"):
            data[name] = [
                {key: value for key, value in entry.form.data.items() if key != "remove"}
                for entry in self[name]
                if not entry.form.remove.data
            ]
        return data


for _name, _label in zip(BENEFIT_FIELDS, BENEFIT_LABELS, strict=True):
    setattr(
        LaborProfileForm,
        _name,
        SQLNumberField(
            _label,
            maximum=Decimal("999999.99")
            if _name.startswith("horas_extra_")
            else Decimal("9999999999.99"),
        ),
    )


class DeleteLaborProfileForm(FlaskForm):
    revision = HiddenField(validators=[DataRequired()])
