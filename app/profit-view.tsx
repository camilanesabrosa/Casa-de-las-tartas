"use client";

import { useState } from "react";
import { type Business, money } from "@/lib/business";
import { profitSummary, type ProfitPeriod } from "@/lib/profit";

const formatDay = (day: string) => new Intl.DateTimeFormat("es-AR", {
  timeZone: "UTC", dateStyle: "short",
}).format(new Date(`${day}T12:00:00Z`));

export function ProfitView({ data, today, navigate }: {
  data: Business; today: string; navigate: (section: string) => void;
}) {
  const [period, setPeriod] = useState<ProfitPeriod>("month");
  const report = profitSummary(data, period, today);
  const amount = (value: number | null) => value === null ? "Faltan costos" : money(value);
  const resultLabel = report.net === null ? "Todavía no podemos calcular el resultado"
    : report.net < 0 ? "Este período hubo pérdida"
    : report.net > 0 ? "Este período dejó ganancia" : "Este período quedó en cero";
  return (
    <div className="profit-view">
      <div className="section-toolbar profit-toolbar">
        <h2>Tu resultado, paso a paso</h2>
        <label className="period-control">
          Período
          <select value={period} onChange={(event) => setPeriod(event.target.value as ProfitPeriod)}>
            <option value="today">Hoy</option>
            <option value="week">Últimos 7 días</option>
            <option value="30days">Últimos 30 días</option>
            <option value="month">Este mes</option>
            <option value="all">Todo el historial</option>
          </select>
        </label>
      </div>
      <p className="profit-period">{report.range.from ? `${formatDay(report.range.from)} al ${formatDay(report.range.to)}` : `Todo lo registrado hasta el ${formatDay(report.range.to)}`} · Hora de Argentina</p>
      {!report.hasActivity ? <p className="profit-notice">Todavía no hay movimientos en este período. Registrá una compra, una venta o un gasto para ver el resultado.</p> : null}
      {report.missingCostLines > 0 ? (
        <div className="profit-notice profit-warning" role="status">
          <strong>Hay {report.missingCostLines} {report.missingCostLines === 1 ? "renglón vendido sin costo" : "renglones vendidos sin costo"}.</strong>
          <p>No mostramos una ganancia ni una pérdida porque sería incompleta. Revisá el costo de tus productos antes de las próximas ventas. Las ventas anteriores conservan el costo que tenían.</p>
          <p>{report.missingCostNames.join(", ")}</p>
          <button className="text-link" onClick={() => navigate("products")}>Revisar costos de productos</button>
        </div>
      ) : null}
      <section className="panel profit-panel" aria-label="Ganancias y pérdidas del período">
        <div className="profit-ledger">
          <h2>Cómo se calcula</h2>
          <dl>
            <div className="profit-row">
              <dt>Ventas cobradas <small>{report.salesCount} {report.salesCount === 1 ? "venta" : "ventas"}, sin las anuladas</small></dt>
              <dd>{money(report.revenue)}</dd>
            </div>
            <div className="profit-row">
              <dt>Menos costo de lo vendido <small>Lo que costó la mercadería que salió en esas ventas</small></dt>
              <dd>{report.missingCostLines ? "Faltan costos" : money(report.knownCost)}</dd>
            </div>
            <div className="profit-row profit-subtotal">
              <dt>Ganancia bruta <small>Lo que dejan las ventas antes de descontar los gastos</small></dt>
              <dd className={report.gross !== null && report.gross < 0 ? "profit-negative" : ""}>{amount(report.gross)}</dd>
            </div>
            <div className="profit-row">
              <dt>Menos gastos fijos <small>Por ejemplo, alquiler o servicios</small></dt>
              <dd>{money(report.fixedExpenses)}</dd>
            </div>
            <div className="profit-row">
              <dt>Menos gastos variables <small>Los demás gastos registrados en el período</small></dt>
              <dd>{money(report.variableExpenses)}</dd>
            </div>
            <div className="profit-row profit-subtotal">
              <dt>Ganancia neta <small>Ganancia bruta menos todos los gastos del período</small></dt>
              <dd className={report.net !== null && report.net < 0 ? "profit-negative" : ""}>{amount(report.net)}</dd>
            </div>
          </dl>
          <p className="profit-note">Incluye los gastos por su fecha de registro, aunque todavía no estén pagados. Pendientes incluidos: {money(report.pendingExpenses)}.</p>
        </div>
        <div className={`profit-outcome ${report.net === null ? "profit-incomplete" : report.net < 0 ? "profit-loss" : "profit-gain"}`}>
          <h2>{resultLabel}</h2>
          <p className="profit-main-amount">{report.net === null ? "Sin calcular" : money(Math.abs(report.net))}</p>
          <p>{report.net === null ? "Necesitamos el costo de todo lo vendido para calcularlo." : report.net < 0 ? "El costo de lo vendido y los gastos superaron lo cobrado en ventas." : "Es el resultado después de descontar el costo de lo vendido y los gastos cargados."}</p>
          <dl className="profit-loss-detail">
            <dt>Pérdida del período</dt><dd>{amount(report.loss)}</dd>
          </dl>
          <p className="profit-note">La pérdida es el resultado neto negativo. No se descuenta otra vez.</p>
          <button className="text-link" onClick={() => navigate("expenses")}>Revisar gastos y compras</button>
        </div>
      </section>
      <section className="panel profit-purchases" aria-label="Mercadería del período">
        <h2>Lo que ingresó en mercadería</h2>
        <dl>
          <div className="profit-row"><dt>Mercadería recibida <small>Valor total de {report.purchasesCount} {report.purchasesCount === 1 ? "compra registrada, pagada o pendiente" : "compras registradas, pagadas o pendientes"}</small></dt><dd>{money(report.purchased)}</dd></div>
          <div className="profit-row"><dt>Pagos a proveedores <small>Pagado en este período, incluso por compras anteriores</small></dt><dd>{money(report.purchasePayments)}</dd></div>
        </dl>
        <p className="profit-note">Comprar mercadería no significa perder dinero. Mientras no se venda, queda en stock. Su costo se descuenta al venderla, para no contarlo dos veces.</p>
      </section>
      <p className="profit-note">Resultado según los registros de la app, no es el saldo de caja ni un informe contable. Usa el costo guardado en cada venta, no el precio o costo actual del producto. No incluye mermas, correcciones de stock ni impuestos u otros costos que no estén cargados como gastos. Si ya cargaste un costo en la mercadería, no lo cargues otra vez como gasto.</p>
    </div>
  );
}
