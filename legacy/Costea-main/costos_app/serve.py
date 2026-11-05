"""Local Windows-compatible server, no debugger, loopback only."""

from waitress import serve

from app import create_app

if __name__ == "__main__":
    print("Costea disponible en http://127.0.0.1:5000", flush=True)
    serve(create_app(), host="127.0.0.1", port=5000, threads=4)
