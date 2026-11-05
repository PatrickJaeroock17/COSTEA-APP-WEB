"""Application factory for Costea."""

import logging
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, flash, g, render_template, request
from flask_wtf.csrf import CSRFError
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.middleware.proxy_fix import ProxyFix

from app.extensions import csrf, db, limiter, login_manager, migrate
from config import environment_config


def create_app(test_config: dict | None = None) -> Flask:
    root = Path(__file__).resolve().parent.parent
    load_dotenv(root / ".env", override=False)
    app = Flask(__name__, instance_path=str(root / "instance"))
    app.config.from_mapping(environment_config())
    if test_config is not None:
        app.config.update(test_config)
    if app.testing and "DISH_SYNC_ENABLED" not in (test_config or {}):
        app.config["DISH_SYNC_ENABLED"] = False
    secret = app.config.get("SECRET_KEY")
    if not secret or len(secret) < 32 or secret.startswith("replace-with-"):
        raise RuntimeError(
            "Configura SECRET_KEY con al menos 32 caracteres aleatorios. "
            "Ejecuta scripts/prepare_local.py para preparar el entorno local."
        )
    if app.config["APP_ENV"] == "production" and not app.config["TESTING"]:
        if app.config["RATELIMIT_STORAGE_URI"] == "memory://":
            logging.getLogger(__name__).warning(
                "RATELIMIT_STORAGE_URI usa memoria local; configura Redis antes de escalar "
                "la aplicación a más de una instancia."
            )
        if not app.config["TRUSTED_HOSTS"]:
            raise RuntimeError("Producción requiere TRUSTED_HOSTS explícitos.")
    if app.config["BEHIND_AZURE_PROXY"]:
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
    Path(app.instance_path).mkdir(parents=True, exist_ok=True)

    db.init_app(app)
    # SQLite is retained only for isolated tests. Persistent environments use
    # the single SQL Server engine configured by DATABASE_URL.
    if app.testing:
        with app.app_context():
            if db.engine.dialect.name == "sqlite":
                from sqlalchemy import event

                @event.listens_for(db.engine, "connect")
                def enable_test_foreign_keys(connection, _record):
                    cursor = connection.cursor()
                    cursor.execute("PRAGMA foreign_keys=ON")
                    cursor.close()

    migrate.init_app(app, db, directory=str(root / "migrations"), compare_type=True)
    login_manager.init_app(app)
    login_manager.login_view = "auth.login"
    login_manager.login_message = "Inicia sesión para acceder a tu espacio de trabajo."
    login_manager.login_message_category = "info"
    login_manager.session_protection = "strong"
    csrf.init_app(app)
    limiter.init_app(app)

    @app.get("/healthz")
    @limiter.exempt
    def healthcheck():
        return {"status": "ok"}

    @app.get("/readyz")
    @limiter.exempt
    def readinesscheck():
        try:
            db.session.execute(text("SELECT 1"))
            if db.engine.dialect.name == "mssql":
                from app.services.catalog_sync import opening_sync_complete

                if not opening_sync_complete():
                    return {"status": "unavailable"}, 503
                return {"status": "ready", "catalog_sync": "ready"}
        except SQLAlchemyError:
            db.session.rollback()
            app.logger.exception("Database readiness check failed")
            return {"status": "unavailable"}, 503
        return {"status": "ready"}

    from app.models import User
    from app.routes.auth import bp as auth_bp
    from app.routes.catalog import bp as catalog_bp
    from app.routes.companies import bp as companies_bp
    from app.routes.companies import percent_text
    from app.routes.dashboard import bp as dashboard_bp
    from app.routes.inventory import bp as inventory_bp
    from app.routes.materials import bp as materials_bp
    from app.routes.planning import bp as planning_bp
    from app.routes.products import bp as products_bp
    from app.routes.recipe_source import bp as recipe_source_bp
    from app.routes.sales import bp as sales_bp
    from app.routes.worksheet import bp as worksheet_bp
    from app.services.materials import decimal_text
    from app.services.recipes import money_text
    from app.services.sectors import sector_terms

    @login_manager.user_loader
    def load_user(user_id: str):
        try:
            user = db.session.get(User, int(user_id))
        except (TypeError, ValueError, OverflowError):
            return None
        return user if user and user.is_active else None

    app.register_blueprint(auth_bp)
    app.register_blueprint(inventory_bp)
    app.register_blueprint(catalog_bp)
    app.register_blueprint(recipe_source_bp)
    app.register_blueprint(worksheet_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(companies_bp)
    app.register_blueprint(materials_bp)
    app.register_blueprint(products_bp)
    app.register_blueprint(planning_bp)
    app.register_blueprint(sales_bp)
    from decimal import Decimal

    app.jinja_env.filters["rate_display"] = lambda value: (
        "—" if value is None else money_text(Decimal(str(value)) * 100) + " %"
    )
    app.jinja_env.filters["decimal"] = decimal_text
    app.jinja_env.filters["money"] = money_text
    app.jinja_env.filters["percent"] = percent_text

    from app.cli import (
        check_catalog,
        init_dishes,
        prepare_labor_profiles,
        seed_industries,
        seed_units,
        sync_catalog_data,
        sync_dishes,
    )
    from app.forms.auth import LogoutForm
    from app.forms.company import ActionForm
    from app.services.companies import resolve_workspace

    app.cli.add_command(seed_industries)
    app.cli.add_command(prepare_labor_profiles)
    app.cli.add_command(seed_units)
    app.cli.add_command(check_catalog)
    app.cli.add_command(init_dishes)
    app.cli.add_command(sync_dishes)
    app.cli.add_command(sync_catalog_data)
    app.before_request(resolve_workspace)
    from flask_login import current_user

    from app.services.dish_sync import pending_query, sync_pending

    @app.after_request
    def save_sqlserver_dishes(response):
        if (
            app.config["DISH_SYNC_ENABLED"]
            and current_user.is_authenticated
            and request.method in ("POST", "PUT", "PATCH", "DELETE")
            and response.status_code < 400
        ):
            _, pending = sync_pending(
                owner_id=current_user.id, company_id=(request.view_args or {}).get("company_id")
            )
            if pending:
                flash(
                    "Los cambios están guardados en SQL Server, pero queda pendiente actualizar "
                    "la vista normalizada del plato. Usa «Reintentar guardado».",
                    "warning",
                )
        return response

    @app.context_processor
    def shared_context():
        company = getattr(g, "active_company", None)
        pending = (
            len(list(db.session.scalars(pending_query(current_user.id, company.id))))
            if (company and app.config["DISH_SYNC_ENABLED"] and current_user.is_authenticated)
            else 0
        )
        return {
            "sql_dishes_pending": pending,
            "sector_terms": sector_terms,
            "logout_form": LogoutForm(),
            "action_form": ActionForm(),
            "active_company": getattr(g, "active_company", None),
            "active_period": getattr(g, "active_period", None),
            "workspace_companies": getattr(g, "owned_companies", []),
            "workspace_periods": getattr(g, "periods", []),
        }

    @app.errorhandler(CSRFError)
    def csrf_error(_error):
        return render_template(
            "errors/error.html",
            code=400,
            message="El formulario expiró o no es válido. Vuelve a la página e intenta nuevamente.",
        ), 400

    messages = {
        400: "La solicitud no es válida.",
        403: "No tienes acceso a esta página.",
        404: "No encontramos la página que buscas.",
        405: "Esta acción no está disponible por este método.",
        409: "No se pudo aplicar el cambio. Si el registro está archivado, restáuralo. Si la receta cambió en otra pestaña, recarga la página antes de editar.",
        413: "La información enviada supera el tamaño permitido.",
        429: "Has realizado varios intentos. Espera un momento y vuelve a intentarlo.",
        500: "No pudimos completar la solicitud. Intenta nuevamente en unos momentos.",
        503: "La configuración o la base de datos no está disponible. Revisa la conexión e inicialización.",
    }

    def http_error(error):
        if error.code == 500:
            db.session.rollback()
        return render_template(
            "errors/error.html", code=error.code, message=messages[error.code]
        ), error.code

    for code in messages:
        app.register_error_handler(code, http_error)

    @app.after_request
    def security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "same-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self'; style-src 'self'; "
            "img-src 'self' data:; font-src 'self'; connect-src 'self'; "
            "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
        )
        if request.endpoint != "static":
            response.headers["Cache-Control"] = "no-store"
        if app.config["SESSION_COOKIE_SECURE"]:
            response.headers["Strict-Transport-Security"] = "max-age=31536000"
        return response

    return app
