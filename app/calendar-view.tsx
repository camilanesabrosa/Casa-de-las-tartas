"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import { type Business, dateKey, money } from "@/lib/business";
import {
  calendarDate,
  calendarRange,
  dailyBalances,
  emptyDay,
  shiftPeriod,
  type CalendarMode,
} from "@/lib/calendar";

const weekdays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const formatDate = (key: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", ...options }).format(
    calendarDate(key),
  );

export function CalendarView({ data }: { data: Business }) {
  const today = dateKey();
  const [mode, setMode] = useState<CalendarMode>("month");
  const [selected, setSelected] = useState(() => dateKey());
  const balances = useMemo(() => dailyBalances(data), [data]);
  const dates = calendarRange(selected, mode);
  const day = balances.get(selected) ?? emptyDay(selected);
  const periodDays = dates.filter(
    (date) => mode === "week" || date.slice(0, 7) === selected.slice(0, 7),
  );
  const totals = periodDays.reduce(
    (total, date) => {
      const item = balances.get(date);
      if (item) {
        total.income += item.income;
        total.outgoing += item.outgoing;
      }
      return total;
    },
    { income: 0, outgoing: 0 },
  );
  const period =
    mode === "month"
      ? formatDate(selected, { month: "long", year: "numeric" })
      : `${formatDate(dates[0], { day: "numeric", month: "short" })} al ${formatDate(dates[6], { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <div className="calendar-view">
      <div className="calendar-toolbar">
        <div className="calendar-navigation">
          <div className="calendar-arrows">
            <button
              className="calendar-icon-button"
              aria-label={mode === "month" ? "Mes anterior" : "Semana anterior"}
              onClick={() => setSelected(shiftPeriod(selected, mode, -1))}
            >
              <ChevronLeft />
            </button>
            <button
              className="calendar-icon-button"
              aria-label={
                mode === "month" ? "Mes siguiente" : "Semana siguiente"
              }
              onClick={() => setSelected(shiftPeriod(selected, mode, 1))}
            >
              <ChevronRight />
            </button>
          </div>
          <h2 aria-live="polite">{period}</h2>
          <button className="btn" onClick={() => setSelected(today)}>
            Hoy
          </button>
        </div>
        <div
          className="calendar-modes"
          role="group"
          aria-label="Vista del calendario"
        >
          <button
            aria-pressed={mode === "week"}
            onClick={() => setMode("week")}
          >
            Semanal
          </button>
          <button
            aria-pressed={mode === "month"}
            onClick={() => setMode("month")}
          >
            Mensual
          </button>
        </div>
      </div>

      <div className="calendar-totals" aria-label="Totales del período">
        <div>
          <span>Ingresos</span>
          <strong>{money(totals.income)}</strong>
        </div>
        <div>
          <span>Egresos</span>
          <strong>{money(totals.outgoing)}</strong>
        </div>
        <div>
          <span>Saldo del período</span>
          <strong
            className={
              totals.income < totals.outgoing ? "calendar-negative" : ""
            }
          >
            {money(totals.income - totals.outgoing)}
          </strong>
        </div>
      </div>

      <p className="calendar-explanation">
        Cada día muestra sus ingresos menos sus egresos, sumando todos los
        medios de pago. La apertura de caja no se cuenta como ingreso.
      </p>
      <div
        className="calendar-scroll"
        tabIndex={0}
        role="region"
        aria-label={`Calendario ${mode === "month" ? "mensual" : "semanal"}`}
      >
        <div className="calendar-grid" data-mode={mode}>
          {weekdays.map((label) => (
            <div className="calendar-weekday" key={label}>
              {label}
            </div>
          ))}
          {dates.map((date) => {
            const value = balances.get(date);
            const activity = Boolean(
              value && (value.entries > 0 || value.registers.length > 0),
            );
            const inMonth =
              mode === "week" || date.slice(0, 7) === selected.slice(0, 7);
            return (
              <button
                key={date}
                className="calendar-day"
                data-outside={!inMonth}
                data-today={date === today}
                aria-current={date === today ? "date" : undefined}
                aria-pressed={date === selected}
                aria-label={`${formatDate(date, { dateStyle: "full" })}, ${activity ? `saldo ${money(value?.balance ?? 0)}` : "sin movimientos"}`}
                onClick={() => setSelected(date)}
              >
                <span className="calendar-day-number">
                  {Number(date.slice(-2))}
                  {date === today && <small>Hoy</small>}
                </span>
                {activity ? (
                  <>
                    <strong
                      className={value!.balance < 0 ? "calendar-negative" : ""}
                    >
                      {money(value!.balance)}
                    </strong>
                    <span className="calendar-day-caption">
                      {value!.salesCount
                        ? `${value!.salesCount} ${value!.salesCount === 1 ? "venta" : "ventas"}`
                        : "Sin ventas"}
                    </span>
                    {mode === "week" && (
                      <span className="calendar-day-flows">
                        <span>
                          <ArrowDownLeft /> {money(value!.income)}
                        </span>
                        <span>
                          <ArrowUpRight /> {money(value!.outgoing)}
                        </span>
                      </span>
                    )}
                    {value!.registers.length > 0 && (
                      <span className="calendar-register-dot">
                        {value!.registers.some((register) => !register.closedAt)
                          ? "Caja abierta"
                          : "Caja cerrada"}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="calendar-no-activity">Sin movimientos</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <section
        className="panel calendar-detail"
        aria-labelledby="calendar-detail-heading"
      >
        <div className="calendar-detail-heading">
          <h2 id="calendar-detail-heading">
            {formatDate(selected, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </h2>
          <strong className={day.balance < 0 ? "calendar-negative" : ""}>
            {money(day.balance)}
          </strong>
        </div>
        <div className="calendar-breakdown">
          <div>
            <span>Ventas cobradas</span>
            <strong>{money(day.sales)}</strong>
          </div>
          <div>
            <span>Aportes</span>
            <strong>{money(day.deposits)}</strong>
          </div>
          <div>
            <span>Pagos a proveedores</span>
            <strong>{money(day.purchases)}</strong>
          </div>
          <div>
            <span>Gastos pagados</span>
            <strong>{money(day.expenses)}</strong>
          </div>
          <div>
            <span>Retiros</span>
            <strong>{money(day.withdrawals)}</strong>
          </div>
        </div>
        {day.entries === 0 && (
          <p className="calendar-explanation">
            No hay cobros ni pagos registrados para este día.
          </p>
        )}
        <p className="calendar-explanation">
          Saldos según los registros actuales. Las ventas anuladas se excluyen.
        </p>
        {day.registers.map((register) => (
          <div className="calendar-register" key={register.id}>
            <strong>
              {register.closedAt ? "Caja cerrada" : "Caja abierta"}
            </strong>
            <span>
              Apertura{" "}
              {new Intl.DateTimeFormat("es-AR", {
                timeZone: "America/Argentina/Mendoza",
                dateStyle: "short",
                timeStyle: "short",
              }).format(new Date(register.openedAt))}{" "}
              · {money(register.opening)}
            </span>
            {register.closedAt && (
              <span>
                Cierre{" "}
                {new Intl.DateTimeFormat("es-AR", {
                  timeZone: "America/Argentina/Mendoza",
                  dateStyle: "short",
                  timeStyle: "short",
                }).format(new Date(register.closedAt))}{" "}
                · Contado {money(register.counted ?? 0)} · Diferencia{" "}
                {money(register.difference ?? 0)}
              </span>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
