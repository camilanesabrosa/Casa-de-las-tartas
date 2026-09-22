# Publicación de descargas

La versión 0.2.0 se publicó el 21 de septiembre de 2026 en
[sinnick.dev/cdt/](https://sinnick.dev/cdt/). La página y las actualizaciones
son archivos estáticos. No se despliega un servidor de la aplicación ni SQLite.

## Acceso y rutas

Con Tailscale conectado, usar `ssh root@vps`. Tailscale SSH puede pedir una
autorización en el navegador. No se guardan claves ni tokens en este repositorio.

```text
/var/www/cdt-download/
  index.html
  update/
    Casa-de-las-Tartas-0.2.0-win-x64-Setup.exe
    Casa-de-las-Tartas-0.2.0-win-x64-Setup.exe.blockmap
    latest.yml
```

La carpeta queda fuera de `/var/www/sinnick` para que un despliegue del sitio
principal no reemplace las descargas. No modificar `/var/www/wiener-update/`
ni el servicio `casadelastartas`, que pertenece a la publicación web anterior.

## Nginx

`nginx.conf` se instala como `/etc/nginx/snippets/cdt-download.conf`.
El bloque HTTPS de `/etc/nginx/sites-available/sinnick.dev` incluye:

```nginx
include /etc/nginx/snippets/cdt-download.conf;
```

La configuración anterior quedó respaldada en
`/etc/nginx/sites-available/sinnick.dev.before-cdt-0.2.0`.
Validar con `nginx -t` antes de `systemctl reload nginx`. No hace falta reiniciar
los otros servicios. Una nueva versión de la app tampoco necesita recargar Nginx.

El snippet redirige `/cdt` a `/cdt/`, sirve el HTML como índice y desactiva el
listado del directorio. Los archivos ausentes devuelven 404, sin caer en la
página principal. `Cache-Control: no-cache` permite revalidar el manifiesto y
el HTML. Las descargas admiten rangos HTTP para el actualizador.

## Próximas versiones

1. Seguir [Actualizaciones](../../docs/actualizaciones.md) para compilar y ejecutar
   `npm run release:prepare`.
2. Subir `release/cdt/` a un directorio temporal privado del VPS. Comparar los
   hashes SHA-256 locales con los archivos recibidos antes de publicarlos.
3. Copiar el instalador y su blockmap a `/var/www/cdt-download/update/`.
   No reemplazar un instalador ya publicado con otros bytes bajo el mismo nombre.
   Conservar los archivos de las versiones anteriores.
4. Publicar el HTML actualizado. Publicar `latest.yml` al final, primero con
   un nombre temporal y después renombrándolo en el mismo directorio. Así nunca
   se ofrece un manifiesto incompleto ni un instalador que todavía no existe.
5. Comprobar la página, el manifiesto, el tamaño y el hash del instalador por
   HTTPS. Los directorios deben tener permisos `0755` y los archivos `0644`.

La primera publicación se preparó completa en un directorio privado, se
verificaron los cuatro archivos y luego se habilitó la ruta pública.

## Verificación de 0.2.0

Se comprobó la redirección, el botón de descarga, el manifiesto y el blockmap.
La descarga completa por HTTPS tiene 208.959.512 bytes y este SHA-256:

```text
ee699bb563b567d369a01dc0c01a9b6a4afb9e673da9259222cddfac2d5d2008
```

Nginx pasó la validación y los servicios existentes siguieron activos. El
manifiesto de Wiener conserva su hash anterior. Queda pendiente probar la
instalación y el recorrido de actualización en una PC o VM Windows x64.
El instalador no tiene firma digital; Windows puede mostrar una advertencia.
