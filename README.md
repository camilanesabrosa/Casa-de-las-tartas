# Mostrador

Primera versión privada para revisar un sistema de ventas, productos, stock, proveedores, gastos y catálogo de un negocio gastronómico. Soporta unidades enteras y peso en gramos, con precio por kilo. Los 25 nombres de artículos y 13 variedades se transcribieron del listado aportado por Fernando; precios y movimientos son ejemplos.

## Desarrollo

Requiere Node 22.13 o posterior. `npm ci` instala dependencias y `npm run dev` inicia la vista de desarrollo. El inicio de sesión de desarrollo lo simula exclusivamente el plugin local del starter. La versión publicada usa la identidad de la plataforma y mantiene acceso privado.

Comandos: `npm test`, `npx tsc --noEmit`, `npm run build`.

La app usa React, Vinext y Cloudflare Workers. La declaración lógica de D1 está en `.openai/hosting.json`; la plataforma configura los recursos reales al publicar.

## Primera base local

Generar migraciones con `npm run db:generate` solo cuando cambie el esquema. Compilar una vez antes de aplicar la primera migración:

```sh
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_thin_brood.sql
npm run dev
```

No volver a aplicar una migración que ya fue ejecutada. La publicación aplica las migraciones de producción por separado.

## Reglas de negocio

- Dinero en centavos enteros; cantidades en milésimas de la unidad base. Para productos por kilo, una cantidad de 250 representa 250 gramos. Para artículos por unidad, una cantidad de 1000 representa una unidad.
- El servidor valida cantidades y calcula precios desde el producto guardado. No acepta totales enviados por el navegador.
- Una venta, el cambio de stock y su registro se guardan en una operación atómica. Los importes históricos no cambian al editar precios.
- Una compra registra entrada de mercadería y deuda. Un pago posterior reduce la deuda y el dinero, sin tocar el stock.
- Un gasto pendiente no reduce dinero hasta que se registra su pago.
- La anulación de una venta repone el stock y revierte el cobro; no se ejecuta dos veces.
- Las escrituras usan comparación de revisión e identificador de petición para controlar concurrencia y reintentos.
- Las respuestas de administración no se almacenan en caché. El catálogo recibe productos publicados sin costos, ventas, deudas ni pagos.
- Cada usuario de la plataforma tiene datos separados. La identidad se valida en el servidor y la plataforma limita el acceso al Site privado.

## Límites de esta versión

Es una demostración para validar el alcance, no una entrega lista para manejar dinero real. El catálogo también es privado. La puesta en marcha comercial necesita catálogo público con administración separada, accesos de la clienta, sus datos reales, copias automáticas y recuperación comprobada.

El piloto guarda el conjunto de datos en un documento D1 con revisión, hasta 1 MB y 500 variedades. Para uso sostenido debe migrarse a tablas por entidad. Los respaldos JSON se descargan, pero su recuperación todavía requiere asistencia técnica. No hay facturación fiscal, pagos online, fiado, recetas, lotes, vencimientos ni integración con balanzas. El saldo mostrado suma todos los medios de pago, sin conciliación bancaria ni cierre de efectivo por caja.

La foto ilustrativa del catálogo se generó para la muestra. Los rellenos del listado son sugerencias al cargar un artículo; no se atribuyen automáticamente a las pastas.

## Estructura

- `lib/business.ts`: tipos, datos de muestra y cálculos de presentación.
- `lib/actions.ts`: validación y operaciones del negocio.
- `db/business-store.ts`: persistencia con control de revisión.
- `app/api/business/route.ts`: administración y datos sanitizados para el catálogo.
- `app/business-app.tsx`, `app/views.tsx`, `app/components.tsx`: interfaz de administración y formularios.
- `app/catalogo/`: catálogo, carrito y enlace a WhatsApp. Abrir el enlace no confirma venta ni reserva stock.
- `tests/business.test.ts`: pruebas de cantidades, importes, stock, deuda y anulaciones.
- `tests/api-check.py`: pruebas contra el Worker construido en localhost:8788. Usa identidades sintéticas aisladas y nunca envía datos a producción.

La propuesta comercial y la guía de uso están en la carpeta superior a este proyecto.
