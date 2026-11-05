$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$costeaPython = Join-Path $projectRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $costeaPython)) {
    throw 'Falta el entorno virtual. Sigue la instalación descrita en costos_app\README.md.'
}
Push-Location (Join-Path $projectRoot 'costos_app')
try {
    & $costeaPython 'scripts\prepare_local.py'
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo preparar la base de datos.' }
    & $costeaPython 'serve.py'
    if ($LASTEXITCODE -ne 0) { throw 'El servidor terminó con un error.' }
} finally {
    Pop-Location
}

