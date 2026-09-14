# VPS de Fernando

Publicación: https://sinnick.dev/casadelastartas/

Servidor `vps` de Tailscale, servicio `casadelastartas`, Node 24 y SQLite.
Nginx termina HTTPS y deriva exclusivamente `/casadelastartas/` a `127.0.0.1:4312`.
La cuenta pública de prueba sigue siendo `demo@mostrador.test` / `Mostrador123!`.

## Compilar y actualizar

Desde la raíz del proyecto:

```sh
npm ci
node scripts/build-vps.mjs
```

`dist/standalone/` contiene el servidor y sus dependencias. Copiar ese contenido a
una carpeta nueva en `/srv/casadelastartas/releases/`, junto con esta carpeta
`deployment/`. Cambiar el enlace `/srv/casadelastartas/current` a esa versión y
reiniciar únicamente `casadelastartas.service`. Conservar la versión anterior
para poder volver a enlazarla y reiniciar si fuese necesario.

La base vive fuera de las versiones, en `/var/lib/casadelastartas/business.sqlite`.
Nunca reemplazarla al actualizar el código. Se importaron los 25 productos y el
estado del negocio de la muestra de Sites; desde esta publicación ambas copias
son independientes. Las sesiones anteriores no se importan.

## Operación

```sh
tailscale ssh root@vps 'systemctl status casadelastartas --no-pager'
tailscale ssh root@vps 'journalctl -u casadelastartas -n 50 --no-pager'
tailscale ssh root@vps 'systemctl start casadelastartas-backup.service'
```

El timer `casadelastartas-backup.timer` genera una copia consistente diaria y
conserva las últimas 14 en `/var/lib/casadelastartas/backups/`. Son copias dentro
del VPS. Para restaurar: detener el servicio, preservar el conjunto actual
`business.sqlite`, `business.sqlite-wal` y `business.sqlite-shm` en otra carpeta,
copiar el respaldo seleccionado como `business.sqlite`, asignarlo a
`casadelastartas:casadelastartas` con permisos `0600`, y volver a iniciar.

Configuración Nginx: `/etc/nginx/snippets/casadelastartas.conf`, incluida desde
el virtual host existente de `sinnick.dev`. Validar con `nginx -t` antes de recargar.

## Verificación local

Usar una base de prueba separada; la prueba modifica datos:

```sh
MOSTRADOR_DATABASE_PATH=/tmp/mostrador-qa/business.sqlite PORT=8788 HOST=127.0.0.1 node dist/standalone/server.js
MOSTRADOR_TEST_BASE_PATH=/casadelastartas python3 tests/api-check.py
```

Sin `MOSTRADOR_TARGET=vps`, la configuración original de Sites/Cloudflare sigue
disponible. `lib/paths.ts` agrega el prefijo a enlaces, fotos, APIs y cookies en
la compilación VPS; Vinext lo aplica a rutas, redirecciones y recursos compilados.
