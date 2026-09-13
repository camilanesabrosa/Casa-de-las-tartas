# Mostrador

Muestra de ventas, productos, stock, proveedores, gastos y catálogo de un negocio gastronómico. El catálogo público es la página principal; la administración está en `/admin`. Soporta unidades enteras y peso en gramos, con precio por kilo. Los 25 nombres de artículos y 13 variedades se transcribieron del listado aportado por Fernando; precios y movimientos son ejemplos.

## Acceso de prueba

Usuario: `demo@mostrador.test`. Contraseña: `Mostrador123!`. Se muestran en `/admin/login` y están precargados para facilitar la demostración. Esta cuenta es pública por diseño y solo sirve para datos ficticios. Todos los visitantes de la muestra ven el mismo catálogo y quienes ingresan con la cuenta de prueba pueden editarlo.

Las sesiones duran 8 horas, usan cookies HttpOnly y SameSite=Lax, y llevan Secure en HTTPS. D1 guarda únicamente hashes de los tokens aleatorios. El servidor exige sesión para leer administración y guardar cambios, y comprueba el origen en cada escritura. Cerrar sesión revoca el token. Los datos privados de las identidades de versiones anteriores permanecen separados del nuevo negocio de muestra y no se publican.

## Desarrollo

Requiere Node 22.13 o posterior. `npm ci` instala dependencias y `npm run dev` inicia la vista de desarrollo. La cuenta de prueba de la aplicación funciona tanto en desarrollo como en la versión publicada, sin exigir una cuenta de ChatGPT. El acceso externo del Site depende además de la política de audiencia configurada en Sites, que se conserva al publicar.

Comandos: `npm test`, `npx tsc --noEmit`, `npm run build`.

La app usa React, Vinext y Cloudflare Workers. La declaración lógica de D1 está en `.openai/hosting.json`; la plataforma configura los recursos reales al publicar.

## Primera base local

Generar migraciones con `npm run db:generate` solo cuando cambie el esquema. Compilar una vez antes de aplicar la primera migración:

```sh
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_thin_brood.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_oval_luminals.sql
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
- El catálogo público y la cuenta de prueba usan el mismo negocio de demostración. Los costos e historiales requieren una sesión de administración.

## Límites de esta versión

Es una demostración para validar el alcance, no una entrega lista para manejar dinero real. La puesta en marcha comercial necesita reemplazar la cuenta pública de prueba por accesos privados de la clienta, sus datos reales, copias automáticas y recuperación comprobada.

El piloto guarda el conjunto de datos en un documento D1 con revisión, hasta 1 MB y 500 variedades. Para uso sostenido debe migrarse a tablas por entidad. Los respaldos JSON se descargan, pero su recuperación todavía requiere asistencia técnica. No hay facturación fiscal, pagos online, fiado, recetas, lotes, vencimientos ni integración con balanzas. El saldo mostrado suma todos los medios de pago, sin conciliación bancaria ni cierre de efectivo por caja.

Los 25 artículos tienen fotos ilustrativas individuales en `public/photos/products/`, generadas con la herramienta integrada imagegen. Las instrucciones usadas se conservan en `docs/product-photo-prompts.json`. La selección se hace por nombre y, cuando el relleno es visible, por variedad, en `lib/product-photos.ts`. Se distinguen pollo, pescado, soja, tipos de papa y formas de pasta. Fernando confirmó Yogurlac como pote de yogur con cereales y banana, y Mendosoja como milanesa de soja.

Cada producto admite un enlace HTTPS a su foto propia desde el formulario de edición. Esa foto tiene prioridad; si falta o falla, usa la ilustrativa del artículo. Los artículos o rellenos sin coincidencia muestran “Foto pendiente”, sin asignarles una imagen de otra comida. La vista previa del editor sigue los cambios de nombre y variedad. Todavía no se suben archivos desde el dispositivo. Los rellenos del listado son sugerencias al cargar un artículo; no se atribuyen automáticamente a las pastas.

## Estructura

- `lib/business.ts`: tipos, datos de muestra y cálculos de presentación.
- `lib/actions.ts`: validación y operaciones del negocio.
- `db/business-store.ts`: persistencia con control de revisión.
- `app/api/business/route.ts`: administración y datos sanitizados para el catálogo.
- `app/api/session/route.ts`, `app/demo-auth.ts`: acceso de prueba y sesiones persistentes.
- `app/page.tsx`: catálogo público con datos renderizados desde el servidor.
- `app/admin/`: acceso y página de administración.
- `app/business-app.tsx`, `app/views.tsx`, `app/components.tsx`: interfaz de administración y formularios.
- `app/catalogo/`: catálogo, carrito y enlace a WhatsApp. Abrir el enlace no confirma venta ni reserva stock.
- `tests/business.test.ts`: pruebas de cantidades, importes, stock, deuda y anulaciones.
- `tests/api-check.py`: pruebas contra el Worker construido en localhost:8788 con una base local de prueba separada. Comprueba acceso, sesiones, edición pública, privacidad, concurrencia y cierre de sesión; nunca envía datos a producción.

La propuesta comercial y la guía de uso están en la carpeta superior a este proyecto.
