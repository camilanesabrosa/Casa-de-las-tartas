# Respaldo local y Google Drive

## Qué hace

- SQLite sigue siendo la base activa local: `%APPDATA%/mostrador/business.sqlite` en Windows.
- Nunca se trabaja directamente sobre una base ubicada dentro de una carpeta sincronizada.
- Al conectar Drive, la app hace una copia consistente con el Online Backup API de SQLite. La primera copia se hace al abrir el negocio; los cambios guardados se agrupan durante 30 segundos antes de subir otra copia.
- Mantiene una copia automática por día y conserva las 30 más recientes. “Crear respaldo ahora” agrega una copia manual independiente.
- La carpeta visible se llama `Casa de las Tartas` en el Google Drive elegido.
- Restaurar descarga y valida el archivo antes de detener el servidor local; al cambiar la base, conserva la base anterior como `business.sqlite.pre-restore-…` y reinicia la app.
- El token renovable se cifra con `safeStorage` de Electron en `google-drive.json`. No se incluye en los respaldos SQLite. Para recuperar en otra PC se inicia sesión en Drive y se restaura una copia.
- Si una carga automática falla por un problema temporal, se vuelve a intentar a los 15 minutos. Un acceso revocado requiere reconectar Drive.

## Configurar OAuth para la app distribuida

La integración ya está en el código, pero la conexión queda desactivada hasta configurar el OAuth Client ID de Casa de las Tartas.

1. En Google Cloud Console, crear/elegir el proyecto de la app y habilitar Google Drive API.
2. Configurar la pantalla de consentimiento con el nombre, email de soporte y audiencia correspondientes. Agregar `https://www.googleapis.com/auth/drive.file`.
3. Crear credenciales **OAuth Client ID → Desktop app**. Este flujo usa navegador del sistema, retorno loopback y PKCE; no requiere ni debe distribuir un client secret. Google soporta loopback para clientes Desktop y recomienda PKCE para aplicaciones instaladas.
4. Copiar el Client ID público a `clientId` en `electron/drive-config.cjs`, y luego compilar la app. La variable `CASA_GOOGLE_DRIVE_CLIENT_ID` sirve solo para desarrollo cuando se ejecuta desde un entorno que la tenga definida; una app abierta desde el menú Inicio no hereda necesariamente esa configuración.
5. Antes de distribuir, revisar el estado de publicación de la pantalla de consentimiento. En modo Testing, las autorizaciones de scopes distintos a identidad caducan a los 7 días, incluso el refresh token; no es apropiado para respaldo continuo.

La política pública de privacidad de la integración está en
`https://sinnick.dev/cdt/privacy-policy/`. La app debe publicarse con audiencia
External y estado In production para que cualquier cuenta Google pueda
autorizarla; el modo Testing limita el acceso a la lista de usuarios de prueba.

Referencias oficiales: [OAuth para apps instaladas](https://developers.google.com/identity/protocols/oauth2), [recomendaciones OAuth y PKCE](https://developers.google.com/identity/protocols/oauth2/resources/best-practices), [audiencia y modo Testing](https://support.google.com/cloud/answer/15549945?hl=en).

## Política de los respaldos

La copia contiene productos, ventas, pagos, caja, compras, gastos, proveedores, stock y ajustes, igual que la base local. Quien tenga acceso a la cuenta de Google vinculada puede acceder a los archivos creados por la app. Desconectar la cuenta borra el token local pero no elimina copias de Drive. El usuario debe eliminar esas copias desde Drive si quiere borrarlas.

Al restaurar, la base activa de esta computadora se reemplaza por la copia elegida y la app se reinicia. Se deja el archivo previo como respaldo local de seguridad, para poder recuperarlo manualmente si hiciera falta.

## Inicio limpio

Las instalaciones nuevas se inicializan con el catálogo de productos sin movimientos y stock en cero. En instalaciones existentes, “Reiniciar negocio” requiere escribir `REINICIAR`; elimina el historial del negocio y los proveedores, conserva productos/precios/configuración y deja el stock en cero. Esta acción no se ejecuta automáticamente durante actualización o instalación y no debe ejecutarse sin aprobación del negocio.
