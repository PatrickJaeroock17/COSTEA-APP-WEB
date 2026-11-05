# Despliegue en Azure App Service

El repositorio despliega únicamente a la aplicación Linux `costea-cevicheria-web` mediante
`.github/workflows/main_costea-cevicheria-web.yml`. El workflow anterior de `costea-app` fue
eliminado para evitar dos despliegues en cada `push` a `main`.

## Configuración de Azure

En **App Service > costea-cevicheria-web > Variables de entorno**, configurar:

- `SECRET_KEY`: valor aleatorio de al menos 32 caracteres.
- `DATABASE_URL`: conexión a una base SQL Server accesible desde Azure. No debe apuntar a
  `localhost` ni usar `Trusted_Connection=yes` desde el App Service Linux.
- `APP_ENV`: `production` (Azure también se detecta automáticamente mediante
  `WEBSITE_SITE_NAME`).
- `RATELIMIT_STORAGE_URI`: para una sola instancia se admite temporalmente `memory://`.
  Antes de escalar a varias instancias, usar una URL de Redis compartida.
- `SCM_DO_BUILD_DURING_DEPLOYMENT`: `true`, para que Oryx instale `requirements.txt`. Debe
  configurarse una sola vez en Azure; el workflow no lo modifica durante el despliegue para
  evitar reiniciar el contenedor SCM mientras OneDeploy está trabajando.

`WEBSITE_HOSTNAME` lo proporciona Azure y se agrega automáticamente a `TRUSTED_HOSTS`. Si se
configura un dominio personalizado, añadirlo manualmente a `TRUSTED_HOSTS`, separado por comas.

No guardar valores reales de estas variables en GitHub ni en archivos `.env` versionados.

## Arranque y comprobación

GitHub Actions configura Gunicorn explícitamente con un solo worker, apropiado para el plan
Basic B1 inicial. Antes de iniciarlo ejecuta `python -m flask --app application sync-catalog-data`
con la conexión de App Service. Esto registra las entradas iniciales faltantes del SQL en cada
restaurante y actualiza los precios de catálogo en sus recetas vigentes, conservando versiones
anteriores y presupuestos publicados. La operación es idempotente y no repone stock consumido.
Azure debe usar Python 3.12. Después de desplegar, comprobar:

```text
https://<dominio-de-la-aplicacion>/healthz
https://<dominio-de-la-aplicacion>/readyz
```

`/healthz` confirma que Flask arrancó y responde `{"status":"ok"}`. `/readyz` comprueba además
la conexión a SQL Server y que todos los insumos con stock inicial tengan su entrada en los
restaurantes. Responde `{"status":"ready","catalog_sync":"ready"}`. GitHub Actions usa `/readyz` al final
del despliegue, de modo que una conexión de base de datos inválida deja un error visible en el
workflow en lugar de publicar aparentemente con éxito.

Antes de cada despliegue, GitHub Actions instala las dependencias, ejecuta Ruff, todas las
pruebas y una importación real de `application:app`. Si alguna validación falla, no publica el
paquete en Azure. Azure instala únicamente `requirements.txt`; las herramientas de pruebas se
mantienen separadas en `requirements-dev.txt` para reducir tiempo de compilación y consumo de CPU.
