"use client";
import { appPath } from "@/lib/paths";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { useState, useEffect, useRef } from "react";
import {
  Store,
  LayoutDashboard,
  ShoppingBasket,
  Package,
  Truck,
  ReceiptText,
  Settings,
  ArrowUpRight,
  Plus,
  ArrowRight,
  CalendarDays,
  Leaf,
  Download,
  Check,
  LogOut,
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
  createDemo,
  money,
  quantityLabel,
  summary,
  dateKey,
  Business,
} from "@/lib/business";
import {
  SaleEditor,
  CashEditor,
  downloadJSON,
  displayDate,
  type Save,
} from "./components";
import {
  ProductsView,
  SalesView,
  SuppliersView,
  ExpensesView,
  SettingsView,
} from "./views";
export const navigation = [
  { id: "overview", label: "Resumen", icon: LayoutDashboard },
  { id: "sales", label: "Ventas", icon: ShoppingBasket },
  { id: "products", label: "Productos y stock", icon: Package },
  { id: "suppliers", label: "Proveedores", icon: Truck },
  { id: "expenses", label: "Gastos", icon: ReceiptText },
];
export default function BusinessApp() {
  const [data, setData] = useState<Business | null>(null);
  const [view, setView] = useState("overview");
  const [days, setDays] = useState(7);
  const [error, setError] = useState("");
  const [saleOpen, setSaleOpen] = useState(false);
  const [cashOpen, setCashOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);
  const pending = useRef<{ key: string; id: string } | null>(null);
  async function reload() {
    setLoading(true);
    try {
      const r = await fetch(appPath("/api/business"), { cache: "no-store" });
      const j = (await r.json()) as Business & { error?: string };
      if (r.status === 401) { window.location.assign(appPath("/admin/login")); return; }
      if (!r.ok) throw new Error(j.error);
      setData(j);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos cargar los datos.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void reload();
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
      if (r.status === 401) setError("Tu sesión terminó. Abrí Administración en otra pestaña e iniciá sesión para guardar este formulario.");
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
                  "suppliers",
                  "expenses",
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
                "suppliers",
                "expenses",
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
          <Store />
          mostrador.
        </div>
        <h1>
          {error ? "No pudimos abrir el negocio" : "Abriendo tu negocio…"}
        </h1>
        <p>{error || "Cargando productos, ventas y movimientos."}</p>
        {error && (
          <Button className="btn primary" onClick={() => void reload()}>
            Volver a intentar
          </Button>
        )}
      </main>
    );
  const titles: Record<string, string> = {
    overview: "Tu negocio, de un vistazo",
    sales: "Tus ventas",
    products: "Productos y stock",
    suppliers: "Compras y proveedores",
    expenses: "Los gastos del negocio",
    settings: "Configuración",
  };
  const subtitles: Record<string, string> = {
    overview: "Todo lo que necesitás para llevar el día en orden.",
    sales: "Cada venta, su cobro y los productos que salieron.",
    products: "Lo que entra, lo que sale y lo que queda.",
    suppliers: "Tu mercadería y las cuentas con quienes te abastecen.",
    expenses: "Tené a mano lo que pagaste y lo que queda pendiente.",
    settings: "Los datos que hacen que Mostrador sea tuyo.",
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
          <span className="brand-mark">
            <Store />
          </span>
          <span>
            mostrador<span className="brand-period">.</span>
          </span>
        </SidebarHeader>
        <div className="store-switch">
          <Leaf />
          <div>
            <strong>{data.settings.name}</strong>
            <span>Mi negocio</span>
          </div>
        </div>
        <SidebarContent>
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
          <div className="profile">
            <span>DP</span>
            <div>
              <strong>Usuario de prueba</strong>
              <small>Muestra compartida</small>
            </div>
          </div>
          <button className="nav-button" onClick={async () => {
            try {
              const r = await fetch(appPath("/api/session"), { method: "DELETE" });
              if (!r.ok) throw new Error("No pudimos cerrar la sesión. Volvé a intentar.");
              window.location.assign(appPath("/"));
            } catch (e) { setError(e instanceof Error ? e.message : "No pudimos cerrar la sesión."); }
          }}><LogOut /> Cerrar sesión</button>
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
          <a className="text-link" href={appPath("/")}>
            Ver catálogo <ArrowUpRight />
          </a>
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
            <Button className="btn primary" onClick={() => setSaleOpen(true)}>
              <Plus />
              Nueva venta
            </Button>
          </div>
          {error && (
            <div className="error-banner" role="alert">
              <p>{error}</p>
              <Button
                className="btn"
                disabled={loading}
                onClick={() => void reload()}
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
              <section className="panel ledger-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Últimos movimientos de dinero</h2>
                    <p>Aportes, retiros, pagos a proveedores y gastos</p>
                  </div>
                </div>
                <div className="history-list">
                  {data.payments
                    .slice(-5)
                    .reverse()
                    .map((p) => (
                      <div key={p.id}>
                        <div>
                          <strong>
                            {p.kind === "purchase"
                              ? "Pago a proveedor"
                              : p.kind === "expense"
                                ? "Pago de gasto"
                                : p.reference}
                          </strong>
                          <small>
                            {displayDate(p.date)} · {p.reference}
                          </small>
                        </div>
                        <span
                          className={
                            p.kind === "deposit" ? "positive" : "negative"
                          }
                        >
                          {p.kind === "deposit" ? "+" : "−"}
                          {money(p.amount)}
                        </span>
                      </div>
                    ))}
                </div>
              </section>
            </>
          ) : view === "products" ? (
            <ProductsView data={data} save={save} />
          ) : view === "sales" ? (
            <SalesView
              data={data}
              save={save}
              newSale={() => setSaleOpen(true)}
            />
          ) : view === "suppliers" ? (
            <SuppliersView data={data} save={save} />
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
          <span>Mostrador · Versión de muestra privada</span>
          <span>Importes en pesos argentinos</span>
        </footer>
      </div>
      {saleOpen && (
        <SaleEditor data={data} save={save} close={() => setSaleOpen(false)} />
      )}{" "}
      {cashOpen && <CashEditor save={save} close={() => setCashOpen(false)} />}
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
        <SidebarMenuItem>
          <SidebarMenuButton className="nav-button" asChild>
            <a href={appPath("/catalogo")}>
              <Store />
              <span>Catálogo digital</span>
              <ArrowUpRight />
            </a>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </nav>
  );
}
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
        <div className="metric">
          <span>
            <i className="dot brand-dot" />
            Cobrado en ventas
          </span>
          <strong>{money(s.received)}</strong>
          <small>{s.sales.length} ventas en el período</small>
        </div>
        <div className="metric">
          <span>
            <i className="dot secondary-dot" />
            Pagado en compras y gastos
          </span>
          <strong>{money(s.paid)}</strong>
          <small>Dinero que salió en el período</small>
        </div>
        <div className="metric">
          <span>
            <i className="dot amber" />
            Pendiente de pago
          </span>
          <strong>{money(s.debt)}</strong>
          <small>Deuda total al día de hoy</small>
        </div>
        <div className="metric balance">
          <span>Dinero disponible</span>
          <strong>{money(s.balance)}</strong>
          <small>Saldo acumulado · todos los medios</small>
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
          <div
            className="chart"
            role="img"
            aria-label={chart
              .map((c) => `${c.label}: ${money(c.amount)}`)
              .join(", ")}
          >
            {chart.map((c, i) => (
              <div className="chart-column" key={c.key}>
                <span className="bar-value">
                  {new Intl.NumberFormat("es-AR", {
                    notation: "compact",
                    maximumFractionDigits: 0,
                  }).format(c.amount / 100)}
                </span>
                <div
                  className={`tick-bar ${i === 6 ? "today" : ""}`}
                  style={{ height: `${Math.max((c.amount / max) * 144, 4)}px` }}
                />
                <span className={i === 6 ? "today-label" : ""}>
                  {i === 6 ? "Hoy" : c.label}
                </span>
              </div>
            ))}
          </div>
          <div className="chart-footer">
            <span>Una venta a la vez, tu negocio crece.</span>
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
      <section className="panel sales-panel">
        <div className="panel-heading">
          <div>
            <h2>Últimas ventas</h2>
            <p>Lo que pasó en tu mostrador</p>
          </div>
          <button className="text-link" onClick={() => navigate("sales")}>
            Ver todas <ArrowRight />
          </button>
        </div>
        <div className="table-scroll">
          <Table className="data-table">
            <TableHeader>
              <TableRow>
                <TableHead>Venta</TableHead>
                <TableHead>Productos</TableHead>
                <TableHead>Medio de pago</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="number">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.sales
                .slice()
                .reverse()
                .slice(0, 4)
                .map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>
                      <strong>{v.id}</strong>
                      <small>
                        {new Intl.DateTimeFormat("es-AR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "America/Argentina/Mendoza",
                        }).format(new Date(v.date))}
                      </small>
                    </TableCell>
                    <TableCell>
                      {v.items.map((i) => i.name).join(", ")}
                    </TableCell>
                    <TableCell>{v.method}</TableCell>
                    <TableCell>
                      <span
                        className={`status ${v.cancelled ? "neutral" : "success"}`}
                      >
                        {v.cancelled ? "Anulada" : "Cobrada"}
                      </span>
                    </TableCell>
                    <TableCell className="number">{money(v.total)}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </>
  );
}
