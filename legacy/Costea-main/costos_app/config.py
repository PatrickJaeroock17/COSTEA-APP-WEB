"""Environment configuration, evaluated for each application instance."""

import os
from datetime import timedelta

DEFAULT_SQLSERVER_URL = (
    "mssql+pyodbc://@localhost/Costea_Cevicheria?"
    "driver=ODBC+Driver+18+for+SQL+Server&"
    "Trusted_Connection=yes&Encrypt=yes&TrustServerCertificate=yes"
)


def environment_config() -> dict:
    azure_site_name = os.getenv("WEBSITE_SITE_NAME", "").strip()
    azure_hostname = os.getenv("WEBSITE_HOSTNAME", "").strip()
    production = os.getenv("APP_ENV", "development") == "production" or bool(azure_site_name)
    hosts = [host.strip() for host in os.getenv("TRUSTED_HOSTS", "").split(",") if host.strip()]
    if azure_hostname and azure_hostname not in hosts:
        hosts.append(azure_hostname)
    database_url = os.getenv("DATABASE_URL", DEFAULT_SQLSERVER_URL)
    return {
        "APP_ENV": "production" if production else "development",
        "SECRET_KEY": os.getenv("SECRET_KEY"),
        "SQLALCHEMY_DATABASE_URI": database_url,
        "SQLALCHEMY_TRACK_MODIFICATIONS": False,
        "SQLALCHEMY_ENGINE_OPTIONS": {
            "pool_pre_ping": True,
            "hide_parameters": True,
        },
        "APP_INSTANCE_ID": os.getenv("APP_INSTANCE_ID", ""),
        "DISH_SYNC_ENABLED": True,
        "SESSION_COOKIE_HTTPONLY": True,
        "SESSION_COOKIE_SAMESITE": "Lax",
        "SESSION_COOKIE_SECURE": production,
        "REMEMBER_COOKIE_SECURE": production,
        "REMEMBER_COOKIE_HTTPONLY": True,
        "REMEMBER_COOKIE_SAMESITE": "Lax",
        "REMEMBER_COOKIE_DURATION": timedelta(days=14),
        "PERMANENT_SESSION_LIFETIME": timedelta(hours=8),
        "SESSION_REFRESH_EACH_REQUEST": False,
        "WTF_CSRF_TIME_LIMIT": 7200,
        "WTF_I18N_ENABLED": False,
        "MAX_CONTENT_LENGTH": 64 * 1024,
        "RATELIMIT_STORAGE_URI": os.getenv("RATELIMIT_STORAGE_URI", "memory://"),
        "RATELIMIT_HEADERS_ENABLED": True,
        "TRUSTED_HOSTS": hosts or None,
        "BEHIND_AZURE_PROXY": bool(azure_site_name),
    }
