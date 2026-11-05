from flask_wtf import FlaskForm
from wtforms import BooleanField, PasswordField, StringField, SubmitField
from wtforms.validators import DataRequired, Email, EqualTo, Length


def trim(value: str | None) -> str:
    return value.strip() if value else ""


def normalize_email(value: str | None) -> str:
    return trim(value).casefold()


class LoginForm(FlaskForm):
    remember = BooleanField("Recordar mi sesión")
    email = StringField(
        "Correo electrónico",
        filters=[normalize_email],
        validators=[
            DataRequired(message="Ingresa tu correo electrónico."),
            Email(message="Ingresa un correo electrónico válido."),
            Length(max=254, message="El correo es demasiado largo."),
        ],
    )
    password = PasswordField(
        "Contraseña",
        validators=[
            DataRequired(message="Ingresa tu contraseña."),
            Length(max=128, message="La contraseña admite hasta 128 caracteres."),
        ],
    )
    submit = SubmitField("Iniciar sesión")


class RegisterForm(FlaskForm):
    name = StringField(
        "Nombre completo",
        filters=[trim],
        validators=[
            DataRequired(message="Ingresa tu nombre."),
            Length(min=2, max=100, message="Usa entre 2 y 100 caracteres."),
        ],
    )
    email = StringField(
        "Correo electrónico",
        filters=[normalize_email],
        validators=[
            DataRequired(message="Ingresa tu correo electrónico."),
            Email(message="Ingresa un correo electrónico válido."),
            Length(max=254, message="El correo es demasiado largo."),
        ],
    )
    password = PasswordField(
        "Contraseña",
        validators=[
            DataRequired(message="Crea una contraseña."),
            Length(min=12, max=128, message="Usa entre 12 y 128 caracteres."),
        ],
    )
    confirm_password = PasswordField(
        "Confirma tu contraseña",
        validators=[
            DataRequired(message="Repite tu contraseña."),
            EqualTo("password", message="Las contraseñas no coinciden."),
        ],
    )
    submit = SubmitField("Crear mi cuenta")


class LogoutForm(FlaskForm):
    submit = SubmitField("Cerrar sesión")
