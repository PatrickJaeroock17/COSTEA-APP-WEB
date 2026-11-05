"""Prepare the local secret and database without creating demo accounts."""

import secrets
import subprocess
import sys
from pathlib import Path
from uuid import uuid4

from dotenv import dotenv_values


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    env_path = root / ".env"
    if not env_path.exists():
        with env_path.open("x", encoding="utf-8") as stream:
            stream.write(
                f"SECRET_KEY={secrets.token_hex(32)}\n"
                "APP_ENV=development\n"
                "DATABASE_URL=mssql+pyodbc://@localhost/Costea_Cevicheria?"
                "driver=ODBC+Driver+18+for+SQL+Server&Trusted_Connection=yes&"
                "Encrypt=yes&TrustServerCertificate=yes\n"
                "RATELIMIT_STORAGE_URI=memory://\n"
            )
        print("Configuración local creada. La clave privada no se muestra.")
    else:
        print("Se conserva la configuración local existente.")
    if not dotenv_values(env_path).get("APP_INSTANCE_ID"):
        with env_path.open("a", encoding="utf-8") as stream:
            stream.write(f"\nAPP_INSTANCE_ID={uuid4()}\n")
    for arguments in (("db", "upgrade"), ("seed-industries",), ("seed-units",)):
        subprocess.run(
            [sys.executable, "-m", "flask", "--app", "run", *arguments],
            cwd=root,
            check=True,
        )
    print("Entorno listo. No se crearon usuarios ni datos financieros.")


if __name__ == "__main__":
    main()
