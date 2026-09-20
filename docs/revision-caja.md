# Revisión de apertura y cierre de caja

Revisado el 20 de septiembre de 2026. Se reprodujeron los casos con datos aislados
en memoria, sin escribir en la base del negocio. Esta revisión no modifica las
reglas de arqueo existentes.

## Hallazgos

### 1. El importe a contar incluye transferencias y tarjetas

`lib/business.ts`, funciones `registerExpected` y `registerBreakdown`, suman todas
las ventas del turno. `app/components.tsx`, `RegisterCloseEditor`, pide contar
lo que hay, sin aclarar que también se incluyen los medios electrónicos.

Caso reproducido: apertura de $10.000 y una venta con tarjeta de $1.600.
El sistema espera $11.600. Si se cuentan los $10.000 del cajón, registra un
retiro por $1.600 aunque no falta efectivo.

Hay que definir si el cierre controla efectivo físico o todos los medios.
Para controlar efectivo, cada pago a proveedor, gasto, aporte y retiro también
necesita un medio de pago; hoy esos movimientos no lo guardan. Una solución que
solo excluya ventas con tarjeta seguiría descontando pagos bancarios del cajón.

### 2. El resumen recalculado de una caja cerrada incluye su propio ajuste

`lib/actions.ts`, caso `closeRegister`, guarda `expected` y agrega un aporte o
retiro con la misma fecha del cierre. `registerBreakdown` incluye ese ajuste
por usar un límite de fecha inclusivo.

En el caso anterior, el cierre guarda un esperado de $11.600; al recalcularlo
después del retiro de ajuste, el resumen arroja $10.000. Para un cierre histórico
se deben mostrar los valores guardados y separar el ajuste de arqueo de los
movimientos que determinaron el esperado. El calendario nuevo muestra los valores
guardados del cierre, sin volver a calcularlos.

### 3. Anular una venta de otro turno cambia la historia y omite la devolución actual

`lib/actions.ts`, caso `cancelSale`, solo cambia `cancelled` y repone existencias.
No registra una devolución de dinero fechada ni la relaciona con el turno actual.
Los resúmenes filtran las ventas anuladas incluso si pertenecen a una caja cerrada.

Caso reproducido: anular al día siguiente la venta de $1.600 reduce nuevamente
el resumen del turno anterior, pero la nueva caja sigue esperando su apertura
completa y no contiene ningún pago de devolución. Se necesita guardar fecha,
importe y medio de la devolución, manteniendo los cierres históricos.

### 4. La apertura no representa el saldo acumulado general

Abrir con $10.000 no suma un ingreso, correctamente si se trata de fondos que ya
existían. Sin embargo, la frase del diálogo de cierre «el dinero del sistema
queda igual a lo que contaste» no se cumple para el saldo global cuando ese fondo
nunca se registró. En el ejemplo, el saldo global antes del cierre es $1.600,
no $11.600. Conviene distinguir fondo de apertura, resultado del turno, efectivo
contado y resultado acumulado en los textos y reportes.

## Qué funciona

- No permite abrir otra caja si hay una abierta, ni cerrar si no hay apertura.
- Las diferencias del cierre se guardan y generan un único ajuste por acción.
- Una apertura sin movimientos no inventa ingresos.
- Los pagos pendientes se descuentan cuando se pagan, no cuando se registra la deuda.

## Alcance del calendario

El saldo diario es ventas vigentes más aportes, menos pagos a proveedores, gastos
pagados y retiros. Suma todos los medios; no representa el efectivo contado ni
el saldo acumulado. Se agrupa por fecha de Mendoza. La suma diaria coincide con
el saldo general actual, incluidos los ajustes de caja. Las anulaciones siguen
la limitación del punto 3 hasta que exista un registro de devoluciones.

Se agregaron ocho pruebas del calendario para pagos diferidos y parciales,
aperturas, cierres que cruzan medianoche, anulaciones, zona horaria, saldos
negativos, semanas y meses bisiestos. Las 33 pruebas del conjunto pasan.
