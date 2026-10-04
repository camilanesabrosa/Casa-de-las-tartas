"use client";

import { useState } from "react";
import { type Business, money, quantityLabel } from "@/lib/business";
import { categorySalesSummary, type CategorySalesPeriod } from "@/lib/category-sales";

const periods = [{ id: "day", label: "Día" }, { id: "week", label: "Semana" }, { id: "month", label: "Mes" }] as const;
const dateLabel = (key: string) => new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", dateStyle: "short" }).format(new Date(`${key}T12:00:00Z`));

export function CategorySales({ data, today }: { data: Business; today: string }) {
  const [period, setPeriod] = useState<CategorySalesPeriod>("day");
  const [selected, setSelected] = useState<string | null>(null);
  const anchor = selected ?? today;
  const invalidDate = !/^\d{4}-\d{2}-\d{2}$/.test(anchor) || !Number.isFinite(new Date(`${anchor}T12:00:00Z`).getTime()) || anchor > today;
  const report = categorySalesSummary(data, period, invalidDate ? today : anchor, today);
  const until = report.range.to < today ? report.range.to : today;
  const max = Math.max(1, ...report.rows.map((row) => row.amount));
  return (
    <section className="panel category-sales-panel" aria-labelledby="category-sales-title">
      <div className="panel-heading category-sales-heading">
        <div>
          <h2 id="category-sales-title">Ventas por categoría</h2>
          <p>Cuánto se cobró y qué cantidad se vendió en cada categoría</p>
        </div>
        <div className="category-sales-controls">
          <div className="category-sales-periods" role="group" aria-label="Agrupar ventas por categoría">
            {periods.map((option) => <button key={option.id} type="button" aria-pressed={period === option.id} onClick={() => setPeriod(option.id)}>{option.label}</button>)}
          </div>
          <label className="category-sales-date">Fecha de referencia
            <input type="date" value={anchor} max={today} aria-invalid={invalidDate} onChange={(event) => setSelected(event.target.value)} />
          </label>
          {selected !== null ? <button className="text-link" type="button" onClick={() => setSelected(null)}>Volver a hoy</button> : null}
        </div>
      </div>
      {invalidDate ? <p className="category-sales-message" role="alert">Elegí una fecha válida hasta hoy. Mientras tanto mostramos el período actual.</p> : null}
      <div className="category-sales-summary" aria-live="polite">
        <p>{period === "day" ? `Día ${dateLabel(report.range.from)}` : `${period === "week" ? "Semana" : "Mes"} del ${dateLabel(report.range.from)} al ${dateLabel(report.range.to)}`}
          <small>Datos hasta el {dateLabel(until)} · Hora de Argentina{period === "week" ? " · Lunes a domingo" : ""}</small>
        </p>
        <p>Total cobrado <strong>{money(report.total)}</strong></p>
      </div>
      {report.salesCount === 0 ? <p className="category-sales-message">No hay ventas en este período. Las categorías sin ventas muestran $0.</p> : null}
      {report.rows.length ? (
        <div className="category-sales-scroll" role="region" aria-label="Detalle de ventas por categoría" tabIndex={0}>
          <table className="category-sales-table">
            <caption className="sr-only">Cobrado, cantidad vendida y ventas por categoría. Una venta con varias categorías se cuenta en cada una.</caption>
            <thead><tr><th scope="col">Categoría</th><th scope="col">Cobrado</th><th scope="col">Cantidad vendida</th><th scope="col">Ventas</th></tr></thead>
            <tbody>{report.rows.map((row) => (
              <tr key={row.name}>
                <th scope="row">{row.name}<div className="category-sales-track" aria-hidden="true"><div className="category-sales-bar" style={{ width: `${row.amount / max * 100}%` }} /></div></th>
                <td className="category-sales-amount">{money(row.amount)}</td>
                <td>{[row.units ? quantityLabel(row.units, "unit") : "", row.grams ? quantityLabel(row.grams, "kg") : ""].filter(Boolean).join(" · ") || "Sin ventas"}</td>
                <td>{row.salesCount}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : <p className="category-sales-message">Agregá categorías en Productos y stock para verlas acá.</p>}
      <p className="category-sales-note">Ordenado por importe cobrado, sin ventas anuladas. Las cantidades separan unidades y kilos. Una venta puede incluir varias categorías. Se usan las categorías actuales de los productos; los productos borrados figuran como Sin categoría.</p>
    </section>
  );
}
