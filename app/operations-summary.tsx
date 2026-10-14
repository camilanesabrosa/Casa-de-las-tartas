"use client";
import { useState, type ReactNode } from "react";
import { money, quantityLabel, dateKey, type Business } from "@/lib/business";
import {
  purchasesSummary,
  stockSummary,
  validReportDate,
  type ReportPeriod,
  type PurchasedArticle,
  type StockArticle,
  type StockCategory,
} from "@/lib/operations-summary";

const dateLabel = (day: string) =>
  new Intl.DateTimeFormat("es-AR", {
    timeZone: "UTC",
    dateStyle: "short",
  }).format(new Date(`${day}T12:00:00Z`));
const percent = (value: number | null) =>
  value === null
    ? "Sin datos suficientes"
    : `${value.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
export type OverviewTab = "sales" | "purchases" | "stock";
export function SummaryTabs({
  value,
  onChange,
}: {
  value: OverviewTab;
  onChange: (value: OverviewTab) => void;
}) {
  return (
    <div
      className="operations-switch"
      role="group"
      aria-label="Tipo de resumen"
    >
      {(
        [
          ["sales", "Ventas"],
          ["purchases", "Compras"],
          ["stock", "Stock"],
        ] as const
      ).map(([id, label]) => (
        <button
          type="button"
          key={id}
          aria-pressed={value === id}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
function Metrics({ children }: { children: ReactNode }) {
  return <div className="operations-metrics">{children}</div>;
}
function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: ReactNode;
  note?: string;
}) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}
function Table({
  title,
  columns,
  children,
  empty,
  emptyMessage,
}: {
  title: string;
  columns: string[];
  children: ReactNode;
  empty?: boolean;
  emptyMessage?: string;
}) {
  return empty ? (
    <p className="operations-empty">
      {emptyMessage || "No hay artículos para mostrar."}
    </p>
  ) : (
    <div
      className="category-sales-scroll"
      role="region"
      aria-label={title}
      tabIndex={0}
    >
      <table className="category-sales-table operations-table">
        <caption className="sr-only">{title}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th scope="col" key={c}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function Choices<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      className="category-sales-periods operations-choices"
      role="group"
      aria-label={label}
    >
      {options.map(([id, name]) => (
        <button
          type="button"
          key={id}
          aria-pressed={id === value}
          onClick={() => onChange(id)}
        >
          {name}
        </button>
      ))}
    </div>
  );
}
function PurchasedTable({
  rows,
  title,
}: {
  rows: PurchasedArticle[];
  title: string;
}) {
  return (
    <Table
      title={title}
      columns={["Artículo", "Cantidad", "Gasto", "Costo promedio"]}
      empty={!rows.length}
    >
      {rows.map((row) => (
        <tr key={row.key}>
          <th scope="row">{row.name}</th>
          <td>{quantityLabel(row.quantity, row.unit)}</td>
          <td>{money(row.amount)}</td>
          <td>
            {row.averageCost === null
              ? "Faltan costos"
              : `${money(row.averageCost)} / ${row.unit === "kg" ? "kg" : "unidad"}`}
          </td>
        </tr>
      ))}
    </Table>
  );
}
export function PurchasesOverview({
  data,
  today,
  navigate,
}: {
  data: Business;
  today: string;
  navigate: (view: string) => void;
}) {
  const [period, setPeriod] = useState<ReportPeriod>("month");
  const [selected, setSelected] = useState<string | null>(null);
  const [ranking, setRanking] = useState<"spend" | "quantity" | "margin">(
    "spend",
  );
  const [marginSource, setMarginSource] = useState<"actual" | "estimated">(
    "actual",
  );
  const anchor = selected ?? today;
  const report = purchasesSummary(data, period, anchor, today);
  return (
    <div className="operations-overview">
      <div className="operations-heading">
        <div>
          <h2>Resumen de compras</h2>
          <p>Proveedores, artículos y costos de tus compras.</p>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => navigate("expenses")}
        >
          Ver gastos y compras
        </button>
      </div>
      <div className="operations-controls">
        <Choices
          value={period}
          onChange={setPeriod}
          label="Período de compras"
          options={[
            ["day", "Día"],
            ["week", "Semana"],
            ["month", "Mes"],
            ["all", "Todo"],
          ]}
        />
        <label className="category-sales-date">
          Fecha de referencia
          <input
            type="date"
            max={today}
            value={anchor}
            aria-invalid={!validReportDate(anchor, today)}
            onChange={(e) => setSelected(e.target.value)}
          />
        </label>
        {selected !== null && (
          <button
            type="button"
            className="text-link"
            onClick={() => setSelected(null)}
          >
            Volver a hoy
          </button>
        )}
      </div>
      {!validReportDate(anchor, today) && (
        <p role="alert">
          Elegí una fecha válida hasta hoy. Mostramos el período actual.
        </p>
      )}
      <p className="operations-note">
        {report.range.from
          ? `Del ${dateLabel(report.range.from)} al ${dateLabel(report.range.to)}`
          : `Todo hasta el ${dateLabel(report.range.to)}`}{" "}
        · Hora de Argentina
      </p>
      <Metrics>
        <Metric
          label="Total comprado"
          value={money(report.purchased)}
          note="Por fecha de compra"
        />
        <Metric
          label="Pagado en el período"
          value={money(report.paidInPeriod)}
          note="Incluye pagos de compras anteriores"
        />
        <Metric
          label="Pendiente de estas compras hoy"
          value={money(report.outstanding)}
        />
        <Metric
          label="Facturas de compra"
          value={report.invoicesCount}
          note={`${report.suppliersCount} proveedores con compras`}
        />
      </Metrics>
      <section className="panel operations-panel">
        <div className="panel-heading">
          <div>
            <h2>¿A quién le compramos más?</h2>
            <p>Ordenado por importe comprado en el período.</p>
          </div>
        </div>
        <Table
          title="Compras por proveedor"
          columns={[
            "Proveedor",
            "Comprado",
            "Facturas",
            "Pagado en el período",
          ]}
          empty={!report.suppliers.length}
          emptyMessage="No hay compras ni pagos a proveedores en este período."
        >
          {report.suppliers.map((row) => (
            <tr key={row.id}>
              <th scope="row">{row.name}</th>
              <td>{money(row.amount)}</td>
              <td>{row.invoices}</td>
              <td>{money(row.paid)}</td>
            </tr>
          ))}
        </Table>
        {!report.suppliers.length && (
          <p className="operations-note">
            Registrá una compra para empezar a comparar proveedores.
          </p>
        )}
      </section>
      <section className="panel operations-panel">
        <div className="panel-heading">
          <div>
            <h2>Artículos</h2>
            <p>Compará cantidades, gasto y margen bruto.</p>
          </div>
          <Choices
            value={ranking}
            onChange={setRanking}
            label="Ranking de artículos comprados"
            options={[
              ["spend", "Mayor gasto"],
              ["quantity", "Más cantidad"],
              ["margin", "Mejor margen"],
            ]}
          />
        </div>
        {ranking === "spend" && (
          <PurchasedTable rows={report.articles} title="Artículos por gasto" />
        )}
        {ranking === "quantity" && (
          <div className="operations-unit-groups">
            {(["unit", "kg"] as const).map((unit) => (
              <div key={unit}>
                <h3>{unit === "kg" ? "Por peso" : "Por unidades"}</h3>
                <PurchasedTable
                  rows={report.quantities[unit]}
                  title={`Cantidad comprada ${unit}`}
                />
              </div>
            ))}
          </div>
        )}
        {ranking === "margin" && (
          <>
            <Choices
              value={marginSource}
              onChange={setMarginSource}
              label="Origen del margen"
              options={[
                ["actual", "Ventas reales"],
                ["estimated", "Estimado con precio actual"],
              ]}
            />
            {marginSource === "actual" ? (
              <>
                <p className="operations-note">
                  Margen bruto de las ventas del período, con sus precios y
                  costos históricos. Incluye todos los artículos vendidos y
                  excluye ventas anuladas. No descuenta gastos del negocio.
                </p>
                <Table
                  title="Margen bruto de ventas reales"
                  columns={[
                    "Artículo",
                    "Vendido",
                    "Ingreso",
                    "Ganancia bruta",
                    "Margen",
                  ]}
                  empty={!report.margins.length}
                >
                  {report.margins.map((row) => (
                    <tr key={row.key}>
                      <th scope="row">{row.name}</th>
                      <td>{quantityLabel(row.quantity, row.unit)}</td>
                      <td>{money(row.revenue)}</td>
                      <td>
                        {row.gross === null
                          ? "Faltan costos"
                          : money(row.gross)}
                      </td>
                      <td>{percent(row.margin)}</td>
                    </tr>
                  ))}
                </Table>
              </>
            ) : (
              <>
                <p className="operations-note">
                  Estimación para los artículos comprados: precio de venta
                  actual menos costo promedio ponderado de compra. Margen sobre
                  el precio de venta, antes de gastos; no es ganancia ya
                  obtenida.
                </p>
                <Table
                  title="Margen estimado de artículos comprados"
                  columns={[
                    "Artículo",
                    "Costo promedio",
                    "Precio actual",
                    "Margen estimado",
                  ]}
                  empty={!report.estimatedMargins.length}
                >
                  {report.estimatedMargins.map((row) => (
                    <tr key={row.key}>
                      <th scope="row">
                        {row.name}
                        <small>Por {row.unit === "kg" ? "kg" : "unidad"}</small>
                      </th>
                      <td>
                        {row.averageCost === null
                          ? "Faltan costos"
                          : money(row.averageCost)}
                      </td>
                      <td>
                        {row.currentPrice === null
                          ? "Sin precio actual"
                          : money(row.currentPrice)}
                      </td>
                      <td>{percent(row.estimatedMargin)}</td>
                    </tr>
                  ))}
                </Table>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}
function StockTable({
  rows,
  mode,
  title,
}: {
  rows: StockArticle[];
  mode: "restock" | "stock";
  title: string;
}) {
  return (
    <Table
      title={title}
      columns={
        mode === "restock"
          ? [
              "Artículo",
              "Stock",
              "Mínimo",
              "Para llegar al mínimo",
              "Cobertura estimada",
            ]
          : ["Artículo", "Stock", "Valor al costo", "Última venta"]
      }
      empty={!rows.length}
    >
      {rows.map((row) => (
        <tr key={row.product.id}>
          <th scope="row">
            {row.name}
            {row.product.stock === 0 && <small>Sin stock</small>}
          </th>
          <td>{quantityLabel(row.product.stock, row.product.unit)}</td>
          {mode === "restock" ? (
            <>
              <td>{quantityLabel(row.product.minimum, row.product.unit)}</td>
              <td>
                {row.toMinimum === null
                  ? "Definir mínimo"
                  : row.toMinimum === 0
                    ? "En el mínimo"
                    : quantityLabel(row.toMinimum, row.product.unit)}
              </td>
              <td>
                {row.coverageDays === null
                  ? "Sin ventas recientes"
                  : `${row.coverageDays} días`}
              </td>
            </>
          ) : (
            <>
              <td>{row.knownCost ? money(row.amount) : "Sin costo"}</td>
              <td>
                {row.lastSale
                  ? dateLabel(dateKey(new Date(row.lastSale)))
                  : "Nunca"}
              </td>
            </>
          )}
        </tr>
      ))}
    </Table>
  );
}
function StockCategoryTable({ rows }: { rows: StockCategory[] }) {
  const max = Math.max(1, ...rows.map((row) => row.amount));
  return (
    <Table
      title="Stock por categoría"
      columns={[
        "Categoría",
        "Stock",
        "Valor al costo",
        "Artículos con stock",
        "Para reponer",
      ]}
      empty={!rows.length}
      emptyMessage="Agregá categorías en Productos y stock para verlas acá."
    >
      {rows.map((row) => (
        <tr key={row.name}>
          <th scope="row">
            {row.name}
            <div className="category-sales-track" aria-hidden="true">
              <div
                className="category-sales-bar"
                style={{ width: `${(row.amount / max) * 100}%` }}
              />
            </div>
          </th>
          <td>
            {[
              row.units ? quantityLabel(row.units, "unit") : "",
              row.grams ? quantityLabel(row.grams, "kg") : "",
            ]
              .filter(Boolean)
              .join(" · ") || "Sin stock"}
          </td>
          <td>
            {money(row.amount)}
            {row.missingCosts > 0 && (
              <small>{row.missingCosts} sin costo</small>
            )}
          </td>
          <td>
            {row.inStock} de {row.articles}
          </td>
          <td>{row.low || "—"}</td>
        </tr>
      ))}
    </Table>
  );
}
export function StockOverview({
  data,
  today,
  navigate,
}: {
  data: Business;
  today: string;
  navigate: (view: string) => void;
}) {
  const [mode, setMode] = useState<
    "restock" | "category" | "quantity" | "value" | "idle"
  >("restock");
  const report = stockSummary(data, today);
  return (
    <div className="operations-overview">
      <div className="operations-heading">
        <div>
          <h2>Resumen de stock</h2>
          <p>Existencias actuales al {dateLabel(today)}.</p>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => navigate("products")}
        >
          Ir a productos y stock
        </button>
      </div>
      <Metrics>
        <Metric label="Artículos con stock" value={report.inStock} />
        <Metric label="En mínimo o por debajo" value={report.low.length} />
        <Metric label="Sin stock" value={report.empty} />
        <Metric
          label="Valor del stock al costo"
          value={money(report.value)}
          note={
            report.missingCosts
              ? `Valor parcial: ${report.missingCosts} artículos sin costo`
              : "Calculado con los costos actuales"
          }
        />
      </Metrics>
      <section className="panel operations-panel">
        <div className="panel-heading">
          <div>
            <h2>
              {mode === "restock"
                ? "Qué hace falta reponer"
                : mode === "category"
                  ? "Stock por categoría"
                  : mode === "quantity"
                    ? "Qué tenemos más"
                    : mode === "value"
                      ? "Dónde se concentra el stock"
                      : "Artículos sin ventas recientes"}
            </h2>
            <p>
              {mode === "idle"
                ? "Con existencias y sin ventas en los últimos 30 días."
                : mode === "category"
                  ? "Lo que queda en cada categoría y cuánto vale al costo."
                  : "Usá los mínimos de cada producto para planificar las compras."}
            </p>
          </div>
        </div>
        <Choices
          value={mode}
          onChange={setMode}
          label="Análisis de stock"
          options={[
            ["restock", "Reposición"],
            ["category", "Por categoría"],
            ["quantity", "Más existencias"],
            ["value", "Mayor valor"],
            ["idle", "Sin ventas (30 días)"],
          ]}
        />
        {mode === "restock" && (
          <>
            <StockTable
              rows={report.low}
              mode="restock"
              title="Prioridades de reposición"
            />
            {!report.low.length && (
              <p className="operations-note">
                Todos los artículos están por encima de su mínimo.
              </p>
            )}
            <p className="operations-note">
              La cantidad sugerida alcanza el mínimo configurado. La cobertura
              divide el stock por el promedio diario vendido en los últimos 30
              días; es una referencia, no un pronóstico.
            </p>
          </>
        )}
        {mode === "category" && (
          <>
            <StockCategoryTable rows={report.byCategory} />
            <p className="operations-note">
              Ordenado por valor al costo. La barra compara ese valor entre
              categorías. Las cantidades separan unidades y kilos; «Para
              reponer» cuenta los artículos en su mínimo o por debajo.
            </p>
          </>
        )}
        {mode === "quantity" && (
          <div className="operations-unit-groups">
            {(["unit", "kg"] as const).map((unit) => (
              <div key={unit}>
                <h3>{unit === "kg" ? "Por peso" : "Por unidades"}</h3>
                <StockTable
                  rows={report.quantities[unit]}
                  mode="stock"
                  title={`Existencias ${unit}`}
                />
              </div>
            ))}
          </div>
        )}
        {(mode === "value" || mode === "idle") && (
          <StockTable
            rows={mode === "value" ? report.byValue : report.idle}
            mode="stock"
            title={
              mode === "value"
                ? "Valor de existencias"
                : "Stock sin ventas recientes"
            }
          />
        )}
      </section>
    </div>
  );
}
