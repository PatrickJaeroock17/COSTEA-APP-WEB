"""Catalog setup and synchronization commands."""

import click
from flask.cli import with_appcontext

from app.extensions import db
from app.models import Industry, Unit

INDUSTRIES = (
    ("textil", "Textil", "Prendas, materiales y procesos textiles."),
    ("muebles", "Muebles", "Mobiliario, componentes y acabados."),
    ("imprenta", "Imprenta", "Impresos, tirajes y materiales gráficos."),
    ("restaurantes", "Restaurantes", "Platos, ingredientes y preparación."),
)

# Factors relative to gram, milliliter, unit, meter, square meter and minute.
UNITS = (
    ("g", "Gramo", "g", "mass", 1, 1),
    ("kg", "Kilogramo", "kg", "mass", 1000, 1),
    ("ml", "Mililitro", "ml", "volume", 1, 1),
    ("l", "Litro", "L", "volume", 1000, 1),
    ("unit", "Unidad", "ud", "count", 1, 1),
    ("thousand", "Millar", "millar", "count", 1000, 1),
    ("m", "Metro", "m", "length", 1, 1),
    ("m2", "Metro cuadrado", "m²", "area", 1, 1),
    ("min", "Minuto", "min", "time", 1, 1),
    ("h", "Hora", "h", "time", 60, 1),
)


@click.command("seed-industries")
@with_appcontext
def seed_industries():
    """Add missing industries without modifying existing catalog entries."""
    existing = set(db.session.scalars(db.select(Industry.slug)))
    created = 0
    for slug, name, description in INDUSTRIES:
        if slug not in existing:
            db.session.add(Industry(slug=slug, name=name, description=description))
            created += 1
    db.session.commit()
    click.echo(f"Rubros creados: {created}. Catálogo listo.")


@click.command("seed-units")
@with_appcontext
def seed_units():
    """Add definitions, without enabling units or altering companies."""
    existing = set(db.session.scalars(db.select(Unit.code)))
    created = 0
    for code, name, symbol, dimension, numerator, denominator in UNITS:
        if code not in existing:
            db.session.add(
                Unit(
                    code=code,
                    name=name,
                    symbol=symbol,
                    dimension=dimension,
                    numerator=numerator,
                    denominator=denominator,
                )
            )
            created += 1
    db.session.commit()
    click.echo(f"Unidades creadas: {created}. Catálogo listo.")


@click.command("check-catalog")
@with_appcontext
def check_catalog():
    """Verify the real source with SELECT only; never import or create source tables."""
    from app.services.catalog import get_catalog

    try:
        catalog = get_catalog()
        categories, units, ingredients = (
            catalog.categories(),
            catalog.units(),
            catalog.ingredients(),
        )
    except ValueError as exc:
        raise click.ClickException(str(exc)) from None
    click.echo(
        f"SQL Server disponible: {len(categories)} categorías, {len(units)} unidades, "
        f"{len(ingredients)} insumos activos. Solo lectura; ninguna tabla modificada."
    )


@click.command("init-dishes")
@with_appcontext
def init_dishes():
    """Create or extend dbo.platos and dbo.receta_detalles without touching the catalog."""
    from app.services.dish_storage import get_dish_store, installation_id

    try:
        installation_id()
        get_dish_store().initialize()
    except ValueError as exc:
        raise click.ClickException(str(exc)) from None
    click.echo(
        "Tablas dbo.platos y dbo.receta_detalles listas en Costea_Cevicheria. "
        "Catálogos originales conservados."
    )


@click.command("sync-dishes")
@click.option(
    "--all", "all_products", is_flag=True, help="Incluye platos existentes, incluso archivados."
)
@with_appcontext
def sync_dishes(all_products):
    """Flush pending dish specifications into SQL Server."""
    from app.models import Product
    from app.services.dish_sync import queue_products, sync_pending

    if all_products:
        queue_products(db.session, db.session.scalars(db.select(Product.id)))
        db.session.commit()
    saved, pending = sync_pending()
    click.echo(f"Platos guardados en SQL Server: {saved}. Pendientes: {pending}.")
    if pending:
        raise click.ClickException(
            "Revisa la conexión y los permisos sobre dbo.platos y dbo.receta_detalles."
        )


@click.command("sync-catalog-data")
@with_appcontext
def sync_catalog_data():
    """Apply SQL opening stock and updated catalog prices to all restaurants."""
    from sqlalchemy.exc import SQLAlchemyError

    from app.services.catalog_sync import sync_all_restaurants

    try:
        result = sync_all_restaurants()
    except (ValueError, SQLAlchemyError):
        db.session.rollback()
        # Driver exception strings may include connection information.
        raise click.ClickException(
            "No se pudo sincronizar el stock inicial y los precios del catálogo SQL. "
            "Revisa los permisos y los insumos duplicados en los restaurantes."
        ) from None
    click.echo(
        f"Catálogo sincronizado: {result['restaurants']} restaurantes, "
        f"{result['opening_receipts']} entradas iniciales nuevas, "
        f"{result['recipes']} recetas con precios actualizados."
    )


@click.command("prepare-labor-profiles")
@with_appcontext
def prepare_labor_profiles():
    """Create the table for restaurant-specific personnel customizations."""
    from sqlalchemy.exc import SQLAlchemyError

    from app.models.planning import RestaurantLaborProfile

    try:
        RestaurantLaborProfile.__table__.create(bind=db.engine, checkfirst=True)
    except SQLAlchemyError:
        raise click.ClickException("No se pudo preparar la edición de perfiles de personal.") from None
    click.echo("Perfiles de personal por restaurante preparados.")
