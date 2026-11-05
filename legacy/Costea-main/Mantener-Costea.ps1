$ErrorActionPreference = 'Stop'
$costeaRoot = $PSScriptRoot
$costeaPython = Join-Path $costeaRoot '.venv\Scripts\python.exe'
$costeaLogs = Join-Path $costeaRoot '.artifacts'
New-Item -ItemType Directory -Path $costeaLogs -Force | Out-Null
Set-Location (Join-Path $costeaRoot 'costos_app')
while ($true) {
    try {
        # An existing listener may be a manually started copy; never kill it.
        $costeaListener = Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue
        if (-not $costeaListener) {
            Add-Content -LiteralPath (Join-Path $costeaLogs 'autostart.log') -Value "$(Get-Date -Format o) Iniciando Costea."
            $costeaServer = Start-Process -FilePath $costeaPython -ArgumentList 'serve.py' -WorkingDirectory (Join-Path $costeaRoot 'costos_app') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $costeaLogs 'restaurant-server.log') -RedirectStandardError (Join-Path $costeaLogs 'restaurant-server-error.log') -PassThru
            $costeaServer.WaitForExit()
            Add-Content -LiteralPath (Join-Path $costeaLogs 'autostart.log') -Value "$(Get-Date -Format o) Servidor detenido. Se reintentara en 10 segundos."
        }
    } catch {
        Add-Content -LiteralPath (Join-Path $costeaLogs 'autostart.log') -Value "$(Get-Date -Format o) $($_.Exception.Message)"
    }
    Start-Sleep -Seconds 10
}
