"""Convenience entry point for the industry catalog."""

from app import create_app

if __name__ == "__main__":
    app = create_app()
    with app.app_context():
        app.cli.commands["seed-industries"].main(standalone_mode=False)
