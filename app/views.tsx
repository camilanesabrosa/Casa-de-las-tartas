"use client";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { useState } from "react";
import {
  Search,
  Plus,
  Download,
  Package,
  History,
  ArrowDownToLine,
  Check,
  Phone,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type Business,
  type Product,
  type Sale,
  money,
  quantityLabel,
  summary,
  lineTotal,
} from "@/lib/business";
import {
  type Save,
  ProductEditor,
  StockEditor,
  PurchaseEditor,
  SupplierEditor,
  ExpenseEditor,
  PayEditor,
  SaleDetail,
  Modal,
  Form,
  Field,
  displayDate,
  downloadCSV,
  downloadJSON,
} from "./components";
export function ProductsView({ data, save }: { data: Business; save: Save }) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("Todos");
  const [low, setLow] = useState(false);
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [stock, setStock] = useState<Product | null>(null);
  const [history, setHistory] = useState<Product | null>(null);
  const products = data.products.filter(
    (p) =>
      (category === "Todos" || p.category === category) &&
      (!low || p.stock <= p.minimum) &&
      `${p.name} ${p.variety}`.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <div className="view-toolbar">
        <div className="search-control">
          <Search />
          <Input
            aria-label="Buscar en productos"
            placeholder="Buscar producto o variedad…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="button-group">
          <Button className="btn" onClick={() => downloadCSV(data)}>
            <Download />
            Exportar
          </Button>
          <Button className="btn primary" onClick={() => setEditing("new")}>
            <Plus />
            Nuevo producto
          </Button>
        </div>
      </div>
      <div className="filter-row">
        <Tabs value={category} onValueChange={setCategory}>
          <TabsList className="filter-tabs">
            {["Todos", "Precocidos", "Congelados", "Pastas", "Varios"].map(
              (c) => (
                <TabsTrigger key={c} value={c}>
                  {c}
                </TabsTrigger>
              ),
            )}
          </TabsList>
        </Tabs>
        <label className="check-field">
          <input
            type="checkbox"
            checked={low}
            onChange={(e) => setLow(e.target.checked)}
          />
          Solo para reponer
        </label>
      </div>
      <div className="quiet-summary">
        <span>{products.length} variedades</span>
        <span>
          Mercadería a costo actual <strong>{money(summary(data).cost)}</strong>
        </span>
      </div>
      <section className="panel">
        <div className="table-scroll">
          <Table className="data-table">
            <TableHeader>
              <TableRow>
                <TableHead>Producto y variedad</TableHead>
                <TableHead>Venta por</TableHead>
                <TableHead className="number">Precio</TableHead>
                <TableHead className="number">Stock</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <button
                      className="table-product"
                      onClick={() => setEditing(p)}
                    >
                      <strong>{p.name}</strong>
                      <small>{p.variety || p.category}</small>
                    </button>
                  </TableCell>
                  <TableCell>{p.unit === "kg" ? "Kilo" : "Unidad"}</TableCell>
                  <TableCell className="number">{money(p.price)}</TableCell>
                  <TableCell className="number">
                    {quantityLabel(p.stock, p.unit)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`status ${p.stock === 0 ? "error" : p.stock <= p.minimum ? "warning" : "success"}`}
                    >
                      {p.stock === 0
                        ? "Sin stock"
                        : p.stock <= p.minimum
                          ? "Reponer"
                          : "Disponible"}
                    </span>
                    {!p.published && <small>Oculto del catálogo</small>}
                  </TableCell>
                  <TableCell>
                    <div className="button-group">
                      <button className="text-link" onClick={() => setStock(p)}>
                        Ajustar
                      </button>
                      <button
                        className="icon-button"
                        onClick={() => setHistory(p)}
                        aria-label={`Historial de ${p.name}`}
                      >
                        <History />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {!products.length && (
          <div className="empty">
            <Package />
            <h3>No hay productos con esos filtros</h3>
            <p>Probá con otro nombre o categoría.</p>
            <Button
              className="btn"
              onClick={() => {
                setQ("");
                setCategory("Todos");
                setLow(false);
              }}
            >
              Quitar filtros
            </Button>
          </div>
        )}
      </section>
      <p className="footnote">
        Los precios y las existencias iniciales son de ejemplo. Los nombres
        provienen del listado del negocio.
      </p>
      {editing && (
        <ProductEditor
          product={editing === "new" ? undefined : editing}
          save={save}
          close={() => setEditing(null)}
        />
      )}{" "}
      {stock && (
        <StockEditor product={stock} save={save} close={() => setStock(null)} />
      )}{" "}
      {history && (
        <Modal
          title={`Movimientos · ${history.name}`}
          description="Cada entrada y salida explica las existencias del producto."
          close={() => setHistory(null)}
        >
          <div className="history-list">
            {data.movements
              .filter((m) => m.productId === history.id)
              .slice()
              .reverse()
              .map((m) => (
                <div key={m.id}>
                  <div>
                    <strong>{m.reason}</strong>
                    <small>{displayDate(m.date)}</small>
                  </div>
                  <span className={m.quantity < 0 ? "negative" : "positive"}>
                    {m.quantity > 0 ? "+" : "−"}
                    {quantityLabel(Math.abs(m.quantity), history.unit)}
                  </span>
                </div>
              ))}
          </div>
        </Modal>
      )}
    </>
  );
}
export function SalesView({
  data,
  save,
  newSale,
}: {
  data: Business;
  save: Save;
  newSale: () => void;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("Todas");
  const [sale, setSale] = useState<Sale | null>(null);
  const sales = data.sales
    .filter(
      (s) =>
        (filter === "Todas" ||
          (filter === "Anuladas" ? s.cancelled : !s.cancelled)) &&
        `${s.id} ${s.items.map((i) => i.name).join(" ")}`
          .toLowerCase()
          .includes(q.toLowerCase()),
    )
    .slice()
    .reverse();
  return (
    <>
      <div className="view-toolbar">
        <div className="search-control">
          <Search />
          <Input
            aria-label="Buscar ventas"
            placeholder="Buscar venta o producto…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList className="filter-tabs">
            {["Todas", "Cobradas", "Anuladas"].map((c) => (
              <TabsTrigger key={c} value={c}>
                {c}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <section className="panel">
        <div className="table-scroll">
          <Table className="data-table">
            <TableHeader>
              <TableRow>
                <TableHead>Venta</TableHead>
                <TableHead>Productos</TableHead>
                <TableHead>Medio de pago</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="number">Total</TableHead>
                <TableHead>Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>
                    <strong>{v.id}</strong>
                    <small>{displayDate(v.date)}</small>
                  </TableCell>
                  <TableCell>
                    {v.items.length === 1
                      ? v.items[0].name
                      : `${v.items.length} productos`}
                    <small>
                      {v.items
                        .map((i) => quantityLabel(i.quantity, i.unit))
                        .join(" + ")}
                    </small>
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
                  <TableCell>
                    <button className="text-link" onClick={() => setSale(v)}>
                      Ver <ArrowRight />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {!sales.length && (
          <div className="empty">
            <h3>No hay ventas para mostrar</h3>
            <p>Las ventas que registres aparecerán acá.</p>
            <Button className="btn primary" onClick={newSale}>
              Nueva venta
            </Button>
          </div>
        )}
      </section>
      {sale && (
        <SaleDetail sale={sale} save={save} close={() => setSale(null)} />
      )}
    </>
  );
}
export function SuppliersView({ data, save }: { data: Business; save: Save }) {
  const [add, setAdd] = useState(false);
  const [purchase, setPurchase] = useState(false);
  const [pay, setPay] = useState<Business["purchases"][number] | null>(null);
  const debt = data.purchases.reduce((a, p) => a + p.total - p.paid, 0);
  return (
    <>
      <div className="view-toolbar">
        <div>
          <p className="muted">Total pendiente a proveedores</p>
          <div className="big-number">{money(debt)}</div>
        </div>
        <div className="button-group">
          <Button className="btn" onClick={() => setAdd(true)}>
            <Plus />
            Proveedor
          </Button>
          <Button
            className="btn primary"
            onClick={() => setPurchase(true)}
            disabled={!data.suppliers.length || !data.products.length}
          >
            <ArrowDownToLine />
            Ingresó mercadería
          </Button>
        </div>
      </div>
      <div className="supplier-grid">
        {data.suppliers.map((s) => {
          const owed = data.purchases
            .filter((p) => p.supplierId === s.id)
            .reduce((a, p) => a + p.total - p.paid, 0);
          return (
            <article key={s.id} className="panel supplier-card">
              <h3>{s.name}</h3>
              <p className="muted">{s.phone || "Sin teléfono cargado"}</p>
              <div className="supplier-balance">
                <span>Pendiente</span>
                <strong>{money(owed)}</strong>
              </div>
            </article>
          );
        })}
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Compras y pagos</h2>
            <p>
              La mercadería entra una sola vez. Los pagos se registran aparte.
            </p>
          </div>
        </div>
        <div className="table-scroll">
          <Table className="data-table">
            <TableHeader>
              <TableRow>
                <TableHead>Proveedor / compra</TableHead>
                <TableHead>Mercadería</TableHead>
                <TableHead className="number">Total</TableHead>
                <TableHead className="number">Pagado</TableHead>
                <TableHead className="number">Pendiente</TableHead>
                <TableHead>Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.purchases
                .slice()
                .reverse()
                .map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <strong>
                        {
                          data.suppliers.find((s) => s.id === p.supplierId)
                            ?.name
                        }
                      </strong>
                      <small>
                        {p.id} · {displayDate(p.date)}
                      </small>
                    </TableCell>
                    <TableCell>
                      {data.products.find((pr) => pr.id === p.productId)?.name}
                      <small>
                        {quantityLabel(
                          p.quantity,
                          data.products.find((pr) => pr.id === p.productId)
                            ?.unit || "unit",
                        )}
                      </small>
                    </TableCell>
                    <TableCell className="number">{money(p.total)}</TableCell>
                    <TableCell className="number">{money(p.paid)}</TableCell>
                    <TableCell className="number">
                      {money(p.total - p.paid)}
                    </TableCell>
                    <TableCell>
                      {p.paid < p.total ? (
                        <button className="text-link" onClick={() => setPay(p)}>
                          Registrar pago
                        </button>
                      ) : (
                        <span className="status success">Pagada</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
        {!data.purchases.length && (
          <div className="empty">
            <p>Todavía no registraste compras.</p>
          </div>
        )}
      </section>
      {add && <SupplierEditor save={save} close={() => setAdd(false)} />}{" "}
      {purchase && (
        <PurchaseEditor
          data={data}
          save={save}
          close={() => setPurchase(false)}
        />
      )}{" "}
      {pay && (
        <PayEditor
          id={pay.id}
          balance={pay.total - pay.paid}
          save={save}
          close={() => setPay(null)}
        />
      )}
    </>
  );
}
export function ExpensesView({ data, save }: { data: Business; save: Save }) {
  const [add, setAdd] = useState(false);
  const [pay, setPay] = useState<Business["expenses"][number] | null>(null);
  const [filter, setFilter] = useState("Todos");
  const items = data.expenses.filter(
    (e) =>
      filter === "Todos" ||
      (filter === "Pendientes" ? !e.paid : e.category === filter),
  );
  return (
    <>
      <div className="view-toolbar">
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList className="filter-tabs">
            {["Todos", "Fijo", "Variable", "Pendientes"].map((c) => (
              <TabsTrigger key={c} value={c}>
                {c === "Fijo" ? "Fijos" : c === "Variable" ? "Variables" : c}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button className="btn primary" onClick={() => setAdd(true)}>
          <Plus />
          Registrar gasto
        </Button>
      </div>
      <section className="panel">
        <div className="table-scroll">
          <Table className="data-table">
            <TableHeader>
              <TableRow>
                <TableHead>Gasto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="number">Importe</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items
                .slice()
                .reverse()
                .map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <strong>{e.name}</strong>
                      <small>{displayDate(e.date)}</small>
                    </TableCell>
                    <TableCell>{e.category}</TableCell>
                    <TableCell className="number">{money(e.amount)}</TableCell>
                    <TableCell>
                      <span
                        className={`status ${e.paid ? "success" : "warning"}`}
                      >
                        {e.paid ? "Pagado" : "Pendiente"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {!e.paid && (
                        <button className="text-link" onClick={() => setPay(e)}>
                          Marcar como pagado
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
        {!items.length && (
          <div className="empty">
            <h3>No hay gastos en esta selección</h3>
            <p>Registrá los gastos fijos y variables del negocio.</p>
          </div>
        )}
      </section>
      {add && <ExpenseEditor save={save} close={() => setAdd(false)} />}{" "}
      {pay && (
        <Modal
          title="Pagar gasto"
          description={`${pay.name} · ${money(pay.amount)}`}
          close={() => setPay(null)}
        >
          <Form
            close={() => setPay(null)}
            label="Confirmar pago"
            submit={() => save({ type: "payExpense", id: pay.id })}
          >
            <p>El importe se descontará del dinero disponible.</p>
          </Form>
        </Modal>
      )}
    </>
  );
}
export function SettingsView({
  data,
  save,
  back,
}: {
  data: Business;
  save: Save;
  back: () => void;
}) {
  return (
    <div className="settings-grid">
      <section className="panel settings-panel">
        <h2>Datos del negocio</h2>
        <p className="muted">Se muestran en la vista del catálogo.</p>
        <Form
          close={back}
          label="Guardar configuración"
          submit={(f) =>
            save({
              type: "settings",
              name: String(f.get("name")),
              whatsapp: String(f.get("whatsapp") || "").replace(/[^\d]/g, ""),
              address: String(f.get("address") || ""),
            })
          }
        >
          <Field
            label="Nombre del negocio"
            name="name"
            defaultValue={data.settings.name}
          />
          <Field
            label="WhatsApp para pedidos · opcional"
            name="whatsapp"
            type="tel"
            required={false}
            defaultValue={data.settings.whatsapp}
            hint="Número internacional. Ejemplo de formato argentino: 5492611234567."
          />
          <Field
            label="Dirección o indicación de retiro · opcional"
            name="address"
            required={false}
            defaultValue={data.settings.address}
          />
        </Form>
      </section>
      <section className="panel settings-panel">
        <h2>Tus datos</h2>
        <p className="muted">
          Descargá una copia de ventas, productos, compras, pagos y gastos.
        </p>
        <Button className="btn" onClick={() => downloadJSON(data)}>
          <Download />
          Descargar respaldo completo
        </Button>
        <Button className="btn" onClick={() => downloadCSV(data)}>
          <Download />
          Exportar productos a CSV
        </Button>
        <div className="hint-box">
          Esta es una muestra privada. Los nombres se cargaron desde tu listado;
          las unidades de venta, los precios y los movimientos deben revisarse
          antes de usarla en el local.
        </div>
      </section>
    </div>
  );
}
