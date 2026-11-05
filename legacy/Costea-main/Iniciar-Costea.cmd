@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Falta instalar el entorno. Consulta costos_app\README.md.
  pause
  exit /b 1
)
".venv\Scripts\python.exe" "costos_app\scripts\prepare_local.py"
if errorlevel 1 (
  echo No se pudo preparar la base de datos.
  pause
  exit /b 1
)
echo.
echo Abre http://127.0.0.1:5000 en tu navegador.
echo Conserva esta ventana abierta. Ctrl+C detiene Costea.
".venv\Scripts\python.exe" "costos_app\serve.py"
pause
