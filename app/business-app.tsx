"use client";
import { appPath } from "@/lib/paths";
import { APP_NAME } from "@/lib/branding";
import { CalendarView } from "./calendar-view";
import { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  ShoppingBasket,
  Package,
  ReceiptText,
  Settings,
  ArrowDownToLine,
  Wallet,
  Plus,
  ArrowRight,
  CalendarDays,
  Leaf,
  Download,
  Check,
} from "lucide-react";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  categoryRanking,
  money,
  quantityLabel,
  summary,
  dateKey,
  openRegister,
  Business,
} from "@/lib/business";
import {
  SaleEditor,
  CashEditor,
  PurchaseEditor,
  RegisterOpenEditor,
  RegisterCloseEditor,
  downloadJSON,
  type Save,
} from "./components";
import {
  ProductsView,
  SalesView,
  ExpensesView,
  SettingsView,
} from "./views";
export const navigation = [
  { id: "overview", label: "Resumen", icon: LayoutDashboard },
  { id: "sales", label: "Ventas", icon: ShoppingBasket },
  { id: "products", label: "Productos y stock", icon: Package },
  { id: "expenses", label: "Gastos y compras", icon: ReceiptText },
  { id: "calendar", label: "Calendario", icon: CalendarDays },
];
async function fetchBusiness(signal?: AbortSignal): Promise<Business> {
  const response = await fetch(appPath("/api/business"), { cache: "no-store", signal });
  const result = (await response.json()) as Business & { error?: string };
  if (!response.ok) throw new Error(result.error || "No pudimos cargar los datos.");
  return result;
}
export default function BusinessApp() {
  const [data, setData] = useState<Business | null>(null);
  const [view, setView] = useState("overview");
  const [days, setDays] = useState(7);
  const [error, setError] = useState("");
  const [saleOpen, setSaleOpen] = useState(false);
  const [cashOpen, setCashOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);
  const pending = useRef<{ key: string; id: string } | null>(null);
  async function reload() {
    try {
      setData(await fetchBusiness());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos cargar los datos.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    void fetchBusiness(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) { setData(result); setError(""); }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "No pudimos cargar los datos.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(id);
  }, [toast]);
  const save: Save = async (action) => {
    if (!data) throw new Error("Esperá a que se carguen los datos.");
    const key = JSON.stringify(action);
    if (pending.current?.key !== key)
      pending.current = { key, id: crypto.randomUUID() };
    const r = await fetch(appPath("/api/business"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: data.version,
        requestId: pending.current.id,
        action,
      }),
    });
    const result = (await r.json()) as Business & { error?: string };
    if (!r.ok) {
      if (r.status === 409) setError(result.error || "No pudimos guardar.");
      throw new Error(result.error || "No pudimos guardar los cambios.");
    }
    setData(result);
    pending.current = null;
    setError("");
    setToast("Cambios guardados");
  };
  useEffect(() => {
    const ctx = (
      document as Document & {
        modelContext?: {
          registerTool: (t: unknown, o: unknown) => Promise<void>;
        };
      }
    ).modelContext;
    if (!ctx?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(
      ctx.registerTool(
        {
          name: "open_business_section",
          title: "Abrir sección del negocio",
          description:
            "Navega a una sección de la administración; no registra ventas ni modifica datos.",
          inputSchema: {
            type: "object",
            properties: {
              section: {
                type: "string",
                enum: [
                  "overview",
                  "sales",
                  "products",
                  "expenses",
                  "calendar",
                  "settings",
                ],
              },
            },
            required: ["section"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute: async (input: unknown) => {
            const value = input as { section: string };
            if (
              ![
                "overview",
                "sales",
                "products",
                "expenses",
                "calendar",
                "settings",
              ].includes(value?.section)
            )
              throw new Error("Sección no válida.");
            setView(value.section);
            return { section: value.section };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => {});
    return () => lifecycle.abort();
  }, []);
  if (!data)
    return (
      <main className="loading-screen">
        <div className="brand">
          <Brand />
        </div>
        <h1>
          {error ? "No pudimos abrir el negocio" : "Abriendo tu negocio…"}
        </h1>
        <p>{error || "Cargando productos, ventas y movimientos."}</p>
        {error && (
          <Button className="btn primary" disabled={loading} onClick={() => { setLoading(true); void reload(); }}>
            Volver a intentar
          </Button>
        )}
      </main>
    );
  const caja = openRegister(data);
  const titles: Record<string, string> = {
    overview: "Tu negocio, de un vistazo",
    sales: "Tus ventas",
    products: "Productos y stock",
    expenses: "Los gastos y las compras del negocio",
    settings: "Configuración",
    calendar: "El saldo de cada día",
  };
  const subtitles: Record<string, string> = {
    overview: "Todo lo que necesitás para llevar el día en orden.",
    sales: "Cada venta, su cobro y los productos que salieron.",
    products: "Lo que entra, lo que sale y lo que queda.",
    expenses: "Tené a mano lo que pagaste y lo que queda pendiente.",
    settings: "Los datos y las preferencias de tu negocio.",
    calendar: "Consultá tus ingresos, egresos y cierres de caja por semana o por mes.",
  };
  return (
    <SidebarProvider
      style={{ "--sidebar-width": "232px" } as React.CSSProperties}
    >
      <a className="skip-link" href="#main">
        Ir al contenido
      </a>
      <Sidebar className="app-sidebar">
        <SidebarHeader className="brand">
          <Brand />
        </SidebarHeader>
        <div className="store-switch">
          <Leaf />
          <div>
            <strong>{data.settings.name}</strong>
            <span>Mi negocio</span>
          </div>
        </div>
        <SidebarContent className="admin-sidebar-content">
          <MenuNav view={view} navigate={setView} />
        </SidebarContent>
        <SidebarFooter>
          <div className="sidebar-note">
            <span className="demo-label">Versión de muestra</span>
            <p>
              Precios y movimientos
              <br />
              de ejemplo para probar.
            </p>
          </div>
          <button className="nav-button" onClick={() => setView("settings")}>
            <Settings />
            Configuración
          </button>
        </SidebarFooter>
      </Sidebar>
      <div className="workspace">
        <header className="topbar">
          <div>
            <SidebarTrigger
              aria-label="Abrir menú"
              className="mobile-trigger"
            />
            <span>Mi negocio</span>
            <span className="slash">/</span>
            <strong>
              {navigation.find((n) => n.id === view)?.label || "Configuración"}
            </strong>
          </div>
        </header>
        <main id="main" className="main-content">
          <div className="page-heading">
            <div>
              <p className="date-label">
                {new Intl.DateTimeFormat("es-AR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  timeZone: "America/Argentina/Mendoza",
                }).format(new Date())}
              </p>
              <h1>{titles[view]}</h1>
              <p>{subtitles[view]}</p>
            </div>
            <div className="button-group">
              <Button className="btn primary" onClick={() => setSaleOpen(true)}>
                <Plus />
                Nueva venta
              </Button>
              <Button
                className={`btn ${caja ? "register-open" : ""}`}
                onClick={() => setRegisterOpen(true)}
              >
                <Wallet />
                {caja ? "Cerrar caja" : "Abrir caja"}
              </Button>
              <Button
                className="btn"
                onClick={() => setPurchaseOpen(true)}
                disabled={!data.suppliers.length || !data.products.length}
                title={
                  !data.suppliers.length
                    ? "Cargá un proveedor para registrar compras."
                    : undefined
                }
              >
                <ArrowDownToLine />
                Nueva compra
              </Button>
            </div>
          </div>
          {error && (
            <div className="error-banner" role="alert">
              <p>{error}</p>
              <Button
                className="btn"
                disabled={loading}
                onClick={() => { setLoading(true); void reload(); }}
              >
                {loading ? "Actualizando…" : "Actualizar datos"}
              </Button>
            </div>
          )}
          {view === "overview" ? (
            <>
              <Dashboard
                data={data}
                days={days}
                setDays={setDays}
                navigate={setView}
              />
              <div className="dashboard-actions">
                <Button className="btn" onClick={() => setCashOpen(true)}>
                  <Plus />
                  Aporte o retiro de dinero
                </Button>
                <Button className="btn" onClick={() => downloadJSON(data)}>
                  <Download />
                  Descargar respaldo
                </Button>
              </div>
            </>
          ) : view === "calendar" ? (
            <CalendarView data={data} />
          ) : view === "products" ? (
            <ProductsView data={data} save={save} />
          ) : view === "sales" ? (
            <SalesView
              data={data}
              save={save}
              newSale={() => setSaleOpen(true)}
            />
          ) : view === "expenses" ? (
            <ExpensesView data={data} save={save} />
          ) : (
            <SettingsView
              data={data}
              save={save}
              back={() => setView("overview")}
            />
          )}
        </main>
        <footer className="app-footer">
          <span>{APP_NAME} · Versión de muestra privada</span>
          <span>Importes en pesos argentinos</span>
        </footer>
      </div>
      {saleOpen && (
        <SaleEditor data={data} save={save} close={() => setSaleOpen(false)} />
      )}{" "}
      {cashOpen && <CashEditor save={save} close={() => setCashOpen(false)} />}
      {registerOpen &&
        (caja ? (
          <RegisterCloseEditor
            data={data}
            save={save}
            close={() => setRegisterOpen(false)}
          />
        ) : (
          <RegisterOpenEditor save={save} close={() => setRegisterOpen(false)} />
        ))}
      {purchaseOpen && (
        <PurchaseEditor
          data={data}
          save={save}
          close={() => setPurchaseOpen(false)}
        />
      )}
      <div className="toast-region" role="status" aria-live="polite">
        {toast && (
          <div className="app-toast">
            <Check />
            {toast}
          </div>
        )}
      </div>
    </SidebarProvider>
  );
}
function Brand() {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="brand-icon" src={appPath("/brand/icon.svg")} width={48} height={48} alt="" />
      <span className="brand-wordmark">Casa de las<strong>Tartas</strong></span>
    </>
  );
}

function MenuNav({
  view,
  navigate,
}: {
  view: string;
  navigate: (s: string) => void;
}) {
  const { setOpenMobile } = useSidebar();
  return (
    <nav aria-label="Navegación principal">
      <SidebarMenu className="nav-list">
        {navigation.map((n) => (
          <SidebarMenuItem key={n.id}>
            <SidebarMenuButton
              className="nav-button"
              isActive={view === n.id}
              onClick={() => {
                navigate(n.id);
                setOpenMobile(false);
              }}
            >
              <n.icon />
              <span>{n.label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </nav>
  );
}
const periodLabel: Record<number, string> = {
  1: "Cobrado por categoría hoy",
  7: "Cobrado por categoría en los últimos 7 días",
  30: "Cobrado por categoría en los últimos 30 días",
};
export function Dashboard({
  data,
  days,
  setDays,
  navigate,
}: {
  data: Business;
  days: number;
  setDays: (n: number) => void;
  navigate: (s: string) => void;
}) {
  const s = summary(data, days);
  const ranking = categoryRanking(data.products, s.sales);
  const chart = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    const key = dateKey(d);
    return {
      key,
      label: new Intl.DateTimeFormat("es-AR", { weekday: "short" })
        .format(d)
        .replace(".", ""),
      amount: data.sales
        .filter((v) => !v.cancelled && dateKey(new Date(v.date)) === key)
        .reduce((a, v) => a + v.total, 0),
    };
  });
  const max = Math.max(...chart.map((c) => c.amount), 1);
  return (
    <>
      <div className="section-toolbar">
        <h2>Resumen del negocio</h2>
        <div className="period-control">
          <CalendarDays />
          <select
            aria-label="Período del resumen"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={1}>Hoy</option>
            <option value={7}>Últimos 7 días</option>
            <option value={30}>Últimos 30 días</option>
          </select>
        </div>
      </div>
      <div className="metrics">
        <div className="metric positive">
          <span>
            <i className="dot success-dot" />
            Cobrado en ventas
          </span>
          <strong>{money(s.received)}</strong>
          <small>{s.sales.length} ventas en el período</small>
        </div>
        <div className="metric negative">
          <span>
            <i className="dot red-dot" />
            Pagado en compras y gastos
          </span>
          <strong>{money(s.paid)}</strong>
          <small>Dinero que salió en el período</small>
        </div>
      </div>
      <div className="dashboard-grid">
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>Las ventas de tu semana</h2>
              <p>Cobros de los últimos 7 días</p>
            </div>
            <span className="legend">
              <i className="dot brand-dot" />
              Ventas
            </span>
          </div>
          <div className="chart-scroll">
          <div
            className="chart"
            role="img"
            aria-label={chart
              .map((c) => `${c.label}: ${money(c.amount)}`)
              .join(", ")}
          >
            {chart.map((c, i) => (
              <div className="chart-column" key={c.key}>
                <span className="bar-value">{money(c.amount)}</span>
                <div
                  className={`sales-bar ${i === 6 ? "today" : ""}`}
                  style={{ height: `${(c.amount / max) * 144}px` }}
                />
                <span className={i === 6 ? "today-label" : ""}>
                  {i === 6 ? "Hoy" : c.label}
                </span>
              </div>
            ))}
          </div>
          </div>
          <div className="chart-footer">
            <span>Importes en pesos argentinos</span>
            <button className="text-link" onClick={() => navigate("sales")}>
              Ver ventas <ArrowRight />
            </button>
          </div>
        </section>
        <section className="panel stock-panel">
          <div className="panel-heading">
            <div>
              <h2>Para reponer</h2>
              <p>Productos por debajo del mínimo</p>
            </div>
            <span className="count-badge">{s.low.length}</span>
          </div>
          <div className="stock-list">
            {s.low.slice(0, 3).map((p) => (
              <div key={p.id} className="stock-row">
                <div>
                  <strong>{p.name}</strong>
                  <small>{p.variety}</small>
                </div>
                <span className="status warning">
                  {quantityLabel(p.stock, p.unit)}
                </span>
              </div>
            ))}
          </div>
          <button className="text-link" onClick={() => navigate("products")}>
            Revisar el stock <ArrowRight />
          </button>
        </section>
      </div>
      <section className="panel category-panel">
        <div className="panel-heading">
          <div>
            <h2>Categoría más vendida</h2>
            <p>{periodLabel[days] || "Del período elegido"}</p>
          </div>
          {ranking.length > 0 && (
            <span className="legend">
              <i className="dot brand-dot" />
              {ranking[0].name}
            </span>
          )}
        </div>
        {ranking.length > 0 ? (
          <div
            className="category-chart"
            role="img"
            aria-label={ranking
              .map((c) => `${c.name}: ${money(c.amount)}`)
              .join(", ")}
          >
            {ranking.map((c, i) => (
              <div className="category-row" key={c.name}>
                <span className="category-name">{c.name}</span>
                <div className="category-track">
                  <div
                    className={`category-bar ${i === 0 ? "leader" : ""}`}
                    style={{
                      width: `${Math.max((c.amount / ranking[0].amount) * 100, 2)}%`,
                    }}
                  />
                </div>
                <span className="category-amount">{money(c.amount)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="category-empty">
            Todavía no hay ventas en este período.
          </p>
        )}
      </section>
    </>
  );
}
