# Inicio automatico de Costea

La tarea de Windows `Costea-Servidor-Local` inicia el servidor al entrar en la cuenta de Windows que la registro. Se ejecuta oculta, sin limite de tiempo, tambien con bateria. Cada minuto Windows comprueba si debe iniciar la tarea; no crea otra instancia si ya esta ejecutandose.

`Mantener-Costea.ps1` supervisa el servidor y lo reinicia 10 segundos despues de que termine. Los registros se guardan en `.artifacts/autostart.log`, `.artifacts/restaurant-server.log` y `.artifacts/restaurant-server-error.log`. No modifica datos ni ejecuta migraciones al reiniciar.

Abrir: http://127.0.0.1:5000/

La computadora debe estar encendida, sin suspension y con la sesion de Windows iniciada. Bloquear la pantalla no cierra la sesion. Esta direccion solo funciona en esta computadora. La configuracion no cambia las opciones de energia de Windows.

Si se mueve la carpeta del proyecto, registrar nuevamente desde su nueva ubicacion:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Configurar-Inicio-Automatico.ps1
```

Para desactivar el inicio automatico, deshabilitar `Costea-Servidor-Local` en el Programador de tareas de Windows. Para detenerlo inmediatamente, finalizar tambien la tarea y el proceso servidor correspondiente.

Verificacion realizada: respuesta HTTP 200 y recuperacion automatica despues de detener el proceso servidor de forma controlada. El inicio tras reiniciar Windows queda configurado; no se reinicio la computadora durante esta verificacion.
