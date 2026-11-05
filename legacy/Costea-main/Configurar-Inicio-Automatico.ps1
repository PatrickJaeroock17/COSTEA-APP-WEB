$ErrorActionPreference = 'Stop'
$costeaUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$costeaPowerShell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$costeaScript = Join-Path $PSScriptRoot 'Mantener-Costea.ps1'
$costeaAction = New-ScheduledTaskAction -Execute $costeaPowerShell -Argument ('-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $costeaScript + '"') -WorkingDirectory $PSScriptRoot
$costeaLogin = New-ScheduledTaskTrigger -AtLogOn -User $costeaUser
$costeaRetry = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)
$costeaPrincipal = New-ScheduledTaskPrincipal -UserId $costeaUser -LogonType Interactive -RunLevel Limited
$costeaSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName 'Costea-Servidor-Local' -Action $costeaAction -Trigger @($costeaLogin, $costeaRetry) -Principal $costeaPrincipal -Settings $costeaSettings -Description 'Mantiene Costea disponible en http://127.0.0.1:5000 al iniciar sesion y recupera el servidor si se detiene.' -Force | Out-Null
Start-ScheduledTask -TaskName 'Costea-Servidor-Local'
Write-Output 'Inicio automatico de Costea configurado.'
