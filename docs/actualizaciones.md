# Actualizaciones de escritorio

La app usa `electron-updater` para el instalador NSIS de **Windows x64**.
Reproduce el flujo del bridge Wiener, pero no comparte su canal ni su manifiesto:
Electron consume `latest.yml`, no el `latest.json` de Tauri.

## Comportamiento

- Busca una versión nueva un minuto después de abrir la app y cada seis horas.
- Avisa sin interrumpir la carga de datos. La descarga requiere un clic y muestra
  su progreso. No descarga automáticamente.
- «Más tarde» oculta el aviso durante esa sesión. «Omitir esta versión» se guarda
  en SQLite; una versión posterior vuelve a generar un aviso.
- En Configuración se puede buscar manualmente, descargar una versión omitida y
  desactivar la búsqueda automática.
- «Instalar y reiniciar» pide confirmación en un diálogo nativo. Hay que guardar
  los formularios pendientes antes de continuar. Cerrar la app por otro motivo
  **no instala** una actualización pendiente.
- Si no hay conexión o falla la descarga, el negocio sigue funcionando localmente.
  La instalación solo se habilita después de verificar la descarga.

En desarrollo y en otras plataformas se muestra el motivo por el que el
actualizador no está disponible. Esta implementación no distribuye actualizaciones
de macOS ni Linux.

## Canal de publicación

El canal configurado es `https://sinnick.dev/cdt/update/`, separado del de Wiener.
La app consulta `https://sinnick.dev/cdt/update/latest.yml`.
`package.json` incluye esta configuración:

```json
{
  "build": {
    "publish": {
      "provider": "generic",
      "url": "https://sinnick.dev/cdt/update/"
    }
  }
}
```

Antes de usarlo hay que habilitar esa ruta en el servidor y publicar los archivos
de una versión. Esta tarea solo configura el cliente: no modifica el VPS ni sube
archivos. El directorio debe ser público por HTTPS y exclusivo de esta app. No
incluir tokens o claves privadas en el instalador.

## Publicar una versión (cuando se retome el armado del instalador)

1. Elegir una versión estable superior a la instalada, en formato `X.Y.Z`.
   Actualizar `package.json` y `package-lock.json` juntos, por ejemplo con
   `npm version 0.2.0 --no-git-tag-version`.
2. Ejecutar `npm test` y `npm run build:app`. Resolver o revisar los fallos antes
   de publicar. Los tests del actualizador solos se corren con
   `npm run test:updates`.
3. Ejecutar `npm run app:dist:win`. Con `build.publish` configurado,
   electron-builder incluye `app-update.yml` dentro de la app y genera en `release/`:
   - `Casa-de-las-Tartas-X.Y.Z-win-x64-Setup.exe`
   - su archivo `.blockmap`
   - `latest.yml`, con versión, nombre y hash SHA-512 del instalador
4. Subir primero el `.exe` y el `.blockmap` al canal; verificar que se puedan
   descargar completos. Publicar `latest.yml` **al final**, de forma atómica.
   No cachear el manifiesto a largo plazo; los archivos versionados sí pueden
   tener caché. No modificar un instalador después de generar su manifiesto.
5. Probar en una PC o VM Windows x64: versión anterior → buscar → descargar →
   cancelar instalación → instalar y reiniciar. Verificar la nueva versión,
   los registros anteriores y las preferencias. Probar también sin internet.

El script de empaquetado tiene `--publish never`: genera los archivos pero **no
los sube**. Esta tarea tampoco creó ni subió un instalador nuevo.

Las instalaciones viejas sin este código necesitan una primera actualización
manual. A partir de esa instalación, las siguientes versiones pueden llegar
por este mecanismo. Un build con el mismo número que el instalado no se ofrece
como actualización.

## Datos y seguridad

La identidad de instalación sigue siendo `dev.sinnick.mostrador` y la base sigue
en `%APPDATA%\mostrador\business.sqlite`, fuera del directorio del programa.
No cambiar esa identidad ni la ruta entre versiones. NSIS está configurado para
no borrar los datos del usuario al desinstalar. Mantener también el mismo modo de
instalación (por usuario o por equipo) al actualizar.

Las únicas escrituras nuevas son las preferencias `updates.automatic` y
`updates.skippedVersion`, en la tabla `desktop_preferences` de esa misma base.
No se suben ventas, productos ni otros registros al servidor de actualizaciones.
El servidor de publicación recibe las solicitudes de versión y descarga normales
(incluida la dirección IP del cliente).

El proceso principal valida el instalador esperado, la versión estable creciente
y la presencia de SHA-512; `electron-updater` comprueba el archivo descargado.
La integridad por hash no sustituye una firma del editor: el instalador actual
todavía no está firmado. El servidor y el canal de publicación deben protegerse;
conviene incorporar firma de código antes de una distribución amplia. No se
deshabilita la validación de firmas de `electron-updater`.

La interfaz solo accede a acciones concretas mediante el preload. No puede
enviar URLs, rutas ni comandos al actualizador. El proceso principal valida que
cada pedido venga del frame principal y del origen local de la ventana de la app.

Las actualizaciones no reemplazan un sistema de respaldos. Antes de cambios de
esquema, hacer una copia consistente de SQLite y comprobar la migración. No borrar
la base para resolver un problema de actualización.
