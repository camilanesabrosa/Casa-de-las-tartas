# Ganancias

El menú Ganancias y el enlace Ver ganancias del Resumen abren el informe.
Se puede elegir Hoy, últimos 7 días, últimos 30 días, mes actual o todo el
historial. El período usa la fecha de Mendoza y no incluye registros futuros.

## Qué significa cada importe

- Mercadería recibida: el total de las compras registradas en el período,
  aunque se hayan pagado parcialmente o sigan pendientes.
- Pagos a proveedores: los pagos efectivamente registrados en el período.
  Pueden corresponder a compras recibidas en un período anterior.
- Ganancia bruta: ventas no anuladas menos el costo de lo vendido.
- Ganancia neta: ganancia bruta menos gastos fijos y variables registrados,
  incluidos los pendientes. Pagar esos gastos no los vuelve a descontar.
- Pérdida: el valor absoluto del resultado neto cuando es negativo. No es
  otro gasto y no se resta nuevamente.

Ejemplo: recibir 10 kg de mercadería por $70.000 y vender 2 kg por $18.000
descuenta $14.000 de costo de esas ventas, no toda la compra. La ganancia bruta
es $4.000. Si hay $1.000 de gastos fijos y $500 de variables, quedan $2.500
netos. Si el gasto fijo pasa a $6.000, la pérdida del período es $2.500.

## Costos y límites

El costo proviene de cada línea de venta, guardado al vender, con el mismo
redondeo por gramos/unidades que se usa al cobrar. Cambiar el precio o el costo
actual del producto no cambia las ventas anteriores. Una venta anulada no
aporta ingresos ni costo a este informe.

Un costo vacío, inválido o cero se considera sin completar. En ese caso no se
publican márgenes ni pérdidas definitivas, y se muestran los productos que
requieren revisión. Cambiar el producto ayuda a futuras ventas pero no inventa
un costo para las anteriores. Un costo cero legítimo también requiere revisión
porque el modelo actual no distingue mercadería gratuita de un costo faltante.

El saldo de caja es otra medida: aportes, retiros y arqueos no son ganancias.
El informe no aplica FIFO ni promedio ponderado, no valora mermas/correcciones
de stock y no contempla impuestos u otros costos no cargados. No sustituye un
informe contable. No cargar un mismo costo como mercadería y también como gasto.

## Verificación local

- Suite automatizada: compras, pagos parciales, gastos pendientes/pagados,
  cambios de precios/costos, anulaciones, costo faltante, pérdidas, fechas de
  Argentina y redondeo. También comprueba las explicaciones de la interfaz.
- Electron con SQLite temporal: se verificó el ejemplo anterior, el selector
  Hoy y la actualización inmediata al editar un gasto de $1.000 a $6.000.
  El resultado pasó de ganancia de $2.500 a pérdida de $2.500.
- No se modificaron registros reales para estas pruebas ni se generó un
  instalador nuevo.

El criterio de distinguir mercadería comprada de costo de lo vendido se
consultó en [IAS 2, IFRS](https://www.ifrs.org/issued-standards/list-of-standards/ias-2-inventories/).
