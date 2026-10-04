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
  privacy-policy/index.html
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

La versión actual es 0.4.0, publicada el 4 de octubre de 2026. Se
conservaron los instaladores y blockmaps anteriores para las instalaciones existentes.

## Verificación de 0.4.0

Incluye el cierre automático de caja a las 23:59 de Mendoza, el informe de
mercadería y ganancias, y las ventas por categoría por día, semana y mes,
ordenadas por importe de mayor a menor.

El instalador Windows x64 tiene 208.988.289 bytes. Se verificaron los hashes
SHA-256 del HTML, instalador, blockmap y manifiesto en el directorio privado
`/root/cdt-0.4.0.mFlDpfyr/`. Allí quedaron `previous-index.html` y
`previous-latest.yml` como respaldo de la publicación 0.3.0.

Antes de activar el manifiesto se descargó el instalador completo por HTTPS.
Coincidieron tamaño, SHA-256 y SHA-512, y se verificaron el hash del blockmap y
las respuestas HTTP por rangos. SHA-256 del instalador:

```text
063a3103f4636b9b8b06fddbf8111363fbbbfbde5ded830594f405c2e96c5d76
```

La página y `latest.yml` se publicaron con renombrado atómico, el manifiesto
como último paso. Los archivos tienen permisos `0644`; los directorios `0755`.
Nginx y `casadelastartas` siguieron activos sin reinicios, y el hash del
manifiesto de Wiener no cambió.

Pasaron 110 pruebas, TypeScript y el lint de los nuevos informes, el reloj de
caja y sus pruebas. Se verificaron la versión empaquetada, el ejecutable x64,
el canal CDT, los componentes de Drive y caja, y la ausencia de archivos SQLite
en el paquete. Sigue pendiente probar la instalación y actualización en una
PC o VM Windows x64. El instalador no está firmado.

## Verificación de 0.3.0

El instalador Windows x64 tiene 208.979.328 bytes. Se compararon los hashes
SHA-256 de la página, el instalador, el blockmap y el manifiesto después de
subirlos al directorio privado `/root/cdt-0.3.0.toFh6TuK/`. Ese directorio
conserva también `previous-index.html` y `previous-latest.yml` para recuperar
la publicación anterior si fuese necesario.

Se descargó el instalador completo por HTTPS y coincidieron su tamaño,
SHA-256 y SHA-512. SHA-256:

```text
7628fdfd3f9058d3b38cf5798e823a8a9c6a3fa578cc11a2a6915faef0c49889
```

Se verificaron las respuestas HTTP por rangos y el blockmap público antes de
publicar `latest.yml` atómicamente como último paso. Los permisos son `0644`.
Nginx y el servicio web anterior siguieron activos, sin reinicios. El hash del
manifiesto de Wiener no cambió. Pasaron 85 pruebas, incluidas las del
actualizador, y TypeScript. El lint de los archivos de los últimos cambios pasó;
el lint global conserva errores anteriores de tipos `any` en SQLite e incluye
archivos generados en `release/`. Sigue pendiente la prueba de instalación y
actualización en una PC o VM Windows x64. El instalador no está firmado.

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
