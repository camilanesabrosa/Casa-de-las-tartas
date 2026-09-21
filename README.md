# Casa de las Tartas

Aplicación de escritorio para llevar ventas, productos, stock, compras y gastos
de un negocio gastronómico. Corre en la computadora del negocio: abre su propio
servidor en `127.0.0.1` y guarda todo en un archivo SQLite junto a los datos del
usuario. No expone nada a internet.

Los 25 nombres de artículos y las 13 variedades de tarta se transcribieron del
listado aportado por Fernando; precios y movimientos son ejemplos.

## Cómo se usa

```sh
npm ci          # instalar dependencias
npm run app     # construir y abrir la aplicación
npm run app:dist  # generar el instalador en release/
npm run app:dist:win  # generar el instalador Windows x64 (.exe) en release/
```

Requiere Node 22.13 o posterior. `npm run dev` sigue abriendo la vista de
desarrollo en el navegador, útil para iterar sobre la interfaz.

### Instalador para Windows de 64 bits

`npm run app:dist:win` genera
`release/Casa-de-las-Tartas-0.1.0-win-x64-Setup.exe`. El asistente está en español
y permite elegir la carpeta de instalación. Incluye Electron y SQLite: la PC
de destino no necesita instalar Node ni un servidor de base de datos.

El instalador todavía no tiene firma digital; Windows puede mostrar una
advertencia de editor desconocido. La base se crea en el perfil del usuario,
fuera de la carpeta de instalación; el paquete no incluye los datos de esta PC.

La ventana usa una barra de título propia con los controles del sistema.
El ícono editable está en `public/brand/icon.svg`; `npm run icons` regenera
los archivos PNG, ICO e ICNS para escritorio. El nombre visible y el instalador
usan Casa de las Tartas, conservando `mostrador` como carpeta interna de datos
para mantener las bases existentes.

El actualizador para Windows x64 avisa cuando hay una nueva versión y permite
descargarla e instalarla con confirmación. Las preferencias se guardan en SQLite.
El canal configurado es `https://sinnick.dev/cdt/update/`; falta publicar allí
los archivos de la próxima versión. El flujo y los pasos de publicación están
en [Actualizaciones](docs/actualizaciones.md).

En Calendario podés alternar entre semana y mes, consultar el saldo de cada día
y ver su desglose de ventas, aportes, pagos y retiros. El saldo diario expresa
ingresos menos egresos de todos los medios de pago, no el efectivo contado ni
el acumulado. Las aperturas no se duplican como ingresos. Los casos pendientes
del arqueo se detallan en `docs/revision-caja.md`.

La base vive en la carpeta de datos del usuario: en Windows,
`%APPDATA%\mostrador\business.sqlite`. Borrar ese archivo regenera la muestra.

## Código de cartel

Cada producto tiene un número y su categoría aporta una letra, replicando los
carteles del local: **A** Precocidos, **B** Congelados, **C** Pastas,
**D** Varios, **E** Tartas. Así, `4A` es el medallón de merluza y `13E` la tarta
de cebolla y queso. El número se guarda con el producto y se edita desde el
formulario, para que borrar o reordenar artículos no descoloque el cartel
impreso. El buscador acepta el código además del nombre.

## Reglas de negocio

- Dinero en centavos enteros; cantidades en milésimas de la unidad base. Para
  productos por kilo, una cantidad de 250 representa 250 gramos. Para artículos
  por unidad, una cantidad de 1000 representa una unidad.
- El servidor valida cantidades y calcula precios desde el producto guardado. No
  acepta totales enviados por el navegador.
- Una venta, el cambio de stock y su registro se guardan en una operación
  atómica. Los importes históricos no cambian al editar precios.
- Una compra registra entrada de mercadería y deuda. Un pago posterior reduce la
  deuda y el dinero, sin tocar el stock.
- Un gasto pendiente no reduce dinero hasta que se registra su pago.
- La anulación de una venta repone el stock y revierte el cobro; no se ejecuta
  dos veces.
- Las escrituras usan comparación de revisión e identificador de petición para
  controlar concurrencia y reintentos.

## Límites de esta versión

Es una demostración para validar el alcance, no una entrega lista para manejar
dinero real. La puesta en marcha necesita los datos reales de la clienta, copias
automáticas y recuperación comprobada.

Guarda productos, ventas, compras, gastos y movimientos en tablas SQLite locales.
La interfaz conserva el límite de 500 variedades. Los respaldos
JSON se descargan, pero su recuperación todavía requiere asistencia técnica. No
hay facturación fiscal, pagos online, fiado, recetas, lotes, vencimientos ni
integración con balanzas. El saldo suma todos los medios de pago, sin
conciliación bancaria ni cierre de efectivo por caja.

**La aplicación no tiene cuentas ni contraseña**, porque corre en la máquina del
negocio. Si alguna vez se publica en un servidor, hay que reponer un control de
acceso antes: la API de datos responde a cualquiera que la alcance.

Los artículos tienen fotos ilustrativas en `public/photos/products/`. La
selección se hace por nombre y, cuando el relleno es visible, por variedad, en
`lib/product-photos.ts`. Cada producto admite además un enlace HTTPS a su propia
foto desde el formulario de edición; esa foto tiene prioridad.

## Estructura

- `electron/main.cjs`: proceso principal de la aplicación; abre el servidor y la ventana.
- `scripts/build-app.mjs`: construye el servidor que corre dentro de la aplicación.
- `lib/business.ts`: tipos, datos de muestra, códigos de cartel y cálculos.
- `lib/actions.ts`: validación y operaciones del negocio.
- `db/business-store.ts`: persistencia con control de revisión.
- `deployment/node-bindings.ts`: la capa SQLite que usan la aplicación y el VPS.
- `app/api/business/route.ts`: lectura y escritura de los datos.
- `app/page.tsx`: la administración, que es toda la aplicación.
- `app/business-app.tsx`, `app/views.tsx`, `app/components.tsx`: interfaz y formularios.
- `tests/business.test.ts`: pruebas de cantidades, importes, stock, deuda, anulaciones y códigos.
- `tests/api-check.mjs`: pruebas del contrato HTTP contra el servidor construido.

La carpeta `deployment/` conserva la publicación anterior en el VPS, que servía
además un catálogo público. Ya no corresponde a esta versión.
