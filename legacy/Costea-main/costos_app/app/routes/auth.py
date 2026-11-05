"""Session authentication; all state-changing requests require CSRF."""

from flask import Blueprint, flash, redirect, render_template, session, url_for
from flask_login import current_user, login_required, login_user, logout_user
from sqlalchemy.exc import IntegrityError
from werkzeug.security import check_password_hash, generate_password_hash

from app.extensions import db, limiter
from app.forms.auth import LoginForm, LogoutForm, RegisterForm
from app.models import User

bp = Blueprint("auth", __name__, url_prefix="/auth")
# A missing user still performs one password verification.
_DUMMY_HASH = generate_password_hash("unused-account-password", method="scrypt")


@bp.route("/registro", methods=["GET", "POST"])
@limiter.limit("10 per hour", methods=["POST"])
def register():
    if current_user.is_authenticated:
        return redirect(url_for("dashboard.index"))
    form = RegisterForm()
    if form.validate_on_submit():
        user = User(name=form.name.data, email=form.email.data)
        user.set_password(form.password.data)
        db.session.add(user)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            form.email.errors.append("No se pudo registrar este correo. Intenta iniciar sesión.")
            return render_template("auth/register.html", form=form), 422
        flash("Tu cuenta está lista. Inicia sesión para continuar.", "success")
        return redirect(url_for("auth.login"))
    return render_template("auth/register.html", form=form), (422 if form.is_submitted() else 200)


@bp.route("/ingresar", methods=["GET", "POST"])
@limiter.limit("10 per minute", methods=["POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("dashboard.index"))
    form = LoginForm()
    if form.validate_on_submit():
        user = db.session.scalar(db.select(User).where(User.email == form.email.data))
        valid = (
            user.check_password(form.password.data)
            if user
            else check_password_hash(_DUMMY_HASH, form.password.data)
        )
        if user and valid and user.is_active:
            session.clear()
            login_user(user, remember=form.remember.data, fresh=True)
            session.permanent = True
            # Phase 1 has a single authenticated destination. Ignore untrusted `next`.
            return redirect(url_for("dashboard.index"))
        flash("El correo o la contraseña no son correctos.", "danger")
        return render_template("auth/login.html", form=form), 401
    return render_template("auth/login.html", form=form), (422 if form.is_submitted() else 200)


@bp.post("/salir")
@login_required
def logout():
    form = LogoutForm()
    if not form.validate_on_submit():
        return render_template(
            "errors/error.html", code=400, message="Actualiza la página e intenta nuevamente."
        ), 400
    # Clear workspace state before logout so Flask-Login can also expire a
    # remembered sign-in cookie in the response.
    session.clear()
    logout_user()
    flash("Has cerrado sesión correctamente.", "success")
    return redirect(url_for("auth.login"))
