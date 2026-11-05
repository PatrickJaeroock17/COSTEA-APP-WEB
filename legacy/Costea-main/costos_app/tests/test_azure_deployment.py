from config import environment_config


def test_azure_environment_enables_production_and_trusts_platform_hostname(monkeypatch):
    hostname = "costea-cevicheria-web.example.azurewebsites.net"
    monkeypatch.setenv("WEBSITE_SITE_NAME", "costea-cevicheria-web")
    monkeypatch.setenv("WEBSITE_HOSTNAME", hostname)
    monkeypatch.delenv("APP_ENV", raising=False)
    monkeypatch.delenv("TRUSTED_HOSTS", raising=False)

    config = environment_config()

    assert config["APP_ENV"] == "production"
    assert config["BEHIND_AZURE_PROXY"] is True
    assert config["SESSION_COOKIE_SECURE"] is True
    assert config["TRUSTED_HOSTS"] == [hostname]


def test_custom_hosts_are_preserved_with_azure_hostname(monkeypatch):
    monkeypatch.setenv("WEBSITE_SITE_NAME", "costea-cevicheria-web")
    monkeypatch.setenv("WEBSITE_HOSTNAME", "costea.azurewebsites.net")
    monkeypatch.setenv("TRUSTED_HOSTS", "costea.example.com,costea.azurewebsites.net")

    config = environment_config()

    assert config["TRUSTED_HOSTS"] == [
        "costea.example.com",
        "costea.azurewebsites.net",
    ]


def test_readiness_requires_sql_opening_receipts_to_be_synchronized(app, client, monkeypatch):
    from app.extensions import db
    from app.services import catalog_sync

    with app.app_context():
        monkeypatch.setattr(db.engine.dialect, "name", "mssql")
    monkeypatch.setattr(catalog_sync, "opening_sync_complete", lambda: False)
    assert client.get("/readyz").status_code == 503
    monkeypatch.setattr(catalog_sync, "opening_sync_complete", lambda: True)
    response = client.get("/readyz")
    assert response.status_code == 200
    assert response.get_json() == {"status": "ready", "catalog_sync": "ready"}
