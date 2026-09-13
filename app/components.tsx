"use client";
import { useState, type ReactNode, type FormEvent } from "react";
import {
  Search,
  Plus,
  Minus,
  X,
  Package,
  ArrowRight,
  Check,
  Download,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type Business,
  type Product,
  type Sale,
  money,
  quantityLabel,
  lineTotal,
  varieties,
} from "@/lib/business";
import { type Action } from "@/lib/actions";
export type Save = (a: Action) => Promise<void>;
export const displayDate = (date: string) =>
  new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Mendoza",
  }).format(new Date(date));
export function Choice({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="choice" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
export function Field({
  label,
  name,
  defaultValue = "",
  type = "text",
  step,
  min,
  max,
  required = true,
  disabled = false,
  hint,
}: {
  label: string;
  name: string;
  defaultValue?: string | number;
  type?: string;
  step?: string;
  min?: number;
  max?: number;
  required?: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <Input
        className="field-input"
        name={name}
        defaultValue={defaultValue}
        type={type}
        step={step}
        min={min}
        max={max}
        required={required}
        disabled={disabled}
      />
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Modal({
  title,
  description,
  close,
  children,
  wide = false,
}: {
  title: string;
  description: string;
  close: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent className={`app-dialog ${wide ? "wide" : ""}`}>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}
export function Form({
  children,
  submit,
  label = "Guardar",
  close,
}: {
  children: ReactNode;
  submit: (f: FormData) => Promise<void>;
  label?: string;
  close: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await submit(new FormData(e.currentTarget));
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={send} className="form-stack">
      <fieldset disabled={busy}>{children}</fieldset>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <Button type="button" className="btn" onClick={close} disabled={busy}>
          Cancelar
        </Button>
        <Button type="submit" className="btn primary" disabled={busy}>
          {busy ? "Guardando…" : label}
        </Button>
      </div>
    </form>
  );
}
const string = (f: FormData, k: string) => String(f.get(k) || "");
const num = (f: FormData, k: string) => Number(f.get(k));
const cents = (f: FormData, k: string) => Math.round(num(f, k) * 100);
export function ProductEditor({
  product,
  save,
  close,
}: {
  product?: Product;
  save: Save;
  close: () => void;
}) {
  const [unit, setUnit] = useState(product?.unit || "unit");
  const [category, setCategory] = useState(product?.category || "Pastas");
  return (
    <Modal
      title={product ? "Editar producto" : "Nuevo producto"}
      description="Cada variedad tiene su propio precio y stock."
      close={close}
    >
      <Form
        close={close}
        submit={(f) =>
          save({
            type: "product",
            product: {
              id: product?.id,
              name: string(f, "name"),
              variety: string(f, "variety"),
              category,
              unit,
              price: cents(f, "price"),
              cost: cents(f, "cost"),
              stock:
                product?.stock ??
                Math.round(num(f, "stock") * (unit === "unit" ? 1000 : 1)),
              minimum: Math.round(
                num(f, "minimum") * (unit === "unit" ? 1000 : 1),
              ),
              published: f.get("published") === "on",
            },
          })
        }
      >
        <Field
          label="Nombre del producto"
          name="name"
          defaultValue={product?.name}
        />
        <label className="field">
          <span>Variedad o relleno · opcional</span>
          <Input
            name="variety"
            className="field-input"
            defaultValue={product?.variety}
            list="variety-options"
          />
          <datalist id="variety-options">
            {varieties.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </label>
        <div className="form-grid">
          <Choice
            label="Categoría"
            value={category}
            onChange={setCategory}
            options={["Precocidos", "Congelados", "Pastas", "Varios"].map(
              (value) => ({ value, label: value }),
            )}
          />
          {!product ? (
            <Choice
              label="Se vende por"
              value={unit}
              onChange={(v) => setUnit(v as Product["unit"])}
              options={[
                { value: "unit", label: "Unidad" },
                { value: "kg", label: "Peso · precio por kilo" },
              ]}
            />
          ) : (
            <div className="field">
              <span>Se vende por</span>
              <strong>
                {unit === "kg" ? "Peso · precio por kilo" : "Unidad"}
              </strong>
              <small>La unidad se conserva para cuidar el historial.</small>
            </div>
          )}
        </div>
        <div className="form-grid">
          <Field
            label={`Precio de venta por ${unit === "kg" ? "kg" : "unidad"} · $`}
            name="price"
            type="number"
            step="0.01"
            min={0.01}
            defaultValue={(product?.price || 0) / 100}
          />
          <Field
            label={`Costo por ${unit === "kg" ? "kg" : "unidad"} · $`}
            name="cost"
            type="number"
            step="0.01"
            min={0}
            defaultValue={(product?.cost || 0) / 100}
          />
        </div>
        <div className="form-grid">
          {!product && (
            <Field
              label={`Stock inicial · ${unit === "kg" ? "gramos" : "unidades"}`}
              name="stock"
              type="number"
              step="1"
              min={0}
              defaultValue={0}
            />
          )}
          <Field
            label={`Avisar cuando queden · ${unit === "kg" ? "gramos" : "unidades"}`}
            name="minimum"
            type="number"
            step="1"
            min={0}
            defaultValue={
              (product?.minimum || 0) / (unit === "unit" ? 1000 : 1)
            }
          />
        </div>
        <label className="check-field">
          <input
            type="checkbox"
            name="published"
            defaultChecked={product?.published ?? true}
          />
          Mostrar en el catálogo
        </label>
      </Form>
    </Modal>
  );
}
export function StockEditor({
  product,
  save,
  close,
}: {
  product: Product;
  save: Save;
  close: () => void;
}) {
  const [kind, setKind] = useState("in");
  return (
    <Modal
      title="Ajustar existencias"
      description={`${product.name} · Disponible: ${quantityLabel(product.stock, product.unit)}`}
      close={close}
    >
      <Form
        close={close}
        label="Guardar movimiento"
        submit={(f) =>
          save({
            type: "adjustStock",
            productId: product.id,
            quantity:
              Math.round(
                num(f, "quantity") * (product.unit === "unit" ? 1000 : 1),
              ) * (kind === "out" ? -1 : 1),
            reason: string(f, "reason"),
          })
        }
      >
        <Choice
          label="Tipo de movimiento"
          value={kind}
          onChange={setKind}
          options={[
            { value: "in", label: "Entrada · elaboración o corrección" },
            { value: "out", label: "Salida · merma o corrección" },
          ]}
        />
        <Field
          label={`Cantidad · ${product.unit === "kg" ? "gramos" : "unidades"}`}
          name="quantity"
          type="number"
          min={1}
          step="1"
          hint={
            product.unit === "kg"
              ? "Por ejemplo, 250 para un cuarto de kilo."
              : undefined
          }
        />
        <Field
          label="Motivo"
          name="reason"
          hint="Por ejemplo: elaboración del día, vencimiento o recuento."
        />
        <p className="hint-box">
          Si recibiste una compra, usá “Ingresó mercadería” en Proveedores para
          registrar también su costo y el pago.
        </p>
      </Form>
    </Modal>
  );
}
export function PurchaseEditor({
  data,
  save,
  close,
  supplierId,
}: {
  data: Business;
  save: Save;
  close: () => void;
  supplierId?: string;
}) {
  const [pid, setPid] = useState(data.products[0]?.id || "");
  const [sid, setSid] = useState(supplierId || data.suppliers[0]?.id || "");
  const p = data.products.find((p) => p.id === pid);
  return (
    <Modal
      title="Ingresó mercadería"
      description="Sumá el stock recibido y registrá cuánto pagaste."
      close={close}
    >
      <Form
        close={close}
        label="Registrar compra"
        submit={(f) =>
          save({
            type: "purchase",
            supplierId: sid,
            productId: pid,
            quantity: Math.round(
              num(f, "quantity") * (p?.unit === "unit" ? 1000 : 1),
            ),
            cost: cents(f, "cost"),
            paid: cents(f, "paid"),
          })
        }
      >
        <Choice
          label="Proveedor"
          value={sid}
          onChange={setSid}
          options={data.suppliers.map((s) => ({ value: s.id, label: s.name }))}
        />
        <Choice
          label="Producto"
          value={pid}
          onChange={setPid}
          options={data.products.map((p) => ({
            value: p.id,
            label: [p.name, p.variety].filter(Boolean).join(" · "),
          }))}
        />
        <div key={pid} className="form-grid">
          <Field
            label={`Cantidad recibida · ${p?.unit === "kg" ? "gramos" : "unidades"}`}
            name="quantity"
            type="number"
            min={1}
            step="1"
          />
          <Field
            label={`Costo por ${p?.unit === "kg" ? "kg" : "unidad"} · $`}
            name="cost"
            type="number"
            min={0.01}
            step="0.01"
            defaultValue={(p?.cost || 0) / 100}
          />
        </div>
        <Field
          label="Pagado ahora · $"
          name="paid"
          type="number"
          min={0}
          step="0.01"
          defaultValue={0}
          hint="Dejá 0 si todavía no pagaste. La diferencia queda como deuda."
        />
      </Form>
    </Modal>
  );
}
export function ExpenseEditor({
  save,
  close,
}: {
  save: Save;
  close: () => void;
}) {
  const [category, setCategory] = useState<"Fijo" | "Variable">("Variable");
  return (
    <Modal
      title="Registrar gasto"
      description="Anotá el gasto aunque todavía no lo hayas pagado."
      close={close}
    >
      <Form
        close={close}
        label="Registrar gasto"
        submit={(f) =>
          save({
            type: "expense",
            name: string(f, "name"),
            category,
            amount: cents(f, "amount"),
            paid: f.get("paid") === "on",
          })
        }
      >
        <Field label="¿En qué gastaste?" name="name" />
        <Choice
          label="Tipo de gasto"
          value={category}
          onChange={(v) => setCategory(v as "Fijo" | "Variable")}
          options={[
            { value: "Fijo", label: "Fijo · alquiler, internet, servicios" },
            {
              value: "Variable",
              label: "Variable · envases, reparaciones, otros",
            },
          ]}
        />
        <Field
          label="Importe · $"
          name="amount"
          type="number"
          min={0.01}
          step="0.01"
        />
        <label className="check-field">
          <input name="paid" type="checkbox" defaultChecked />
          Ya lo pagué
        </label>
      </Form>
    </Modal>
  );
}
export function SupplierEditor({
  save,
  close,
}: {
  save: Save;
  close: () => void;
}) {
  return (
    <Modal
      title="Nuevo proveedor"
      description="Guardá el contacto de quien te vende la mercadería."
      close={close}
    >
      <Form
        close={close}
        submit={(f) =>
          save({
            type: "supplier",
            name: string(f, "name"),
            phone: string(f, "phone"),
          })
        }
      >
        <Field label="Nombre" name="name" />
        <Field label="Teléfono · opcional" name="phone" required={false} />
      </Form>
    </Modal>
  );
}
export function PayEditor({
  id,
  balance,
  save,
  close,
}: {
  id: string;
  balance: number;
  save: Save;
  close: () => void;
}) {
  return (
    <Modal
      title="Registrar pago al proveedor"
      description={`Queda por pagar ${money(balance)}.`}
      close={close}
    >
      <Form
        close={close}
        label="Registrar pago"
        submit={(f) =>
          save({ type: "payPurchase", id, amount: cents(f, "amount") })
        }
      >
        <Field
          label="Importe del pago · $"
          name="amount"
          type="number"
          step="0.01"
          min={0.01}
          max={balance / 100}
          defaultValue={balance / 100}
        />
      </Form>
    </Modal>
  );
}
export function CashEditor({ save, close }: { save: Save; close: () => void }) {
  const [kind, setKind] = useState<"deposit" | "withdrawal">("deposit");
  return (
    <Modal
      title="Movimiento de dinero"
      description="Registrá un aporte, un saldo inicial o un retiro del negocio."
      close={close}
    >
      <Form
        close={close}
        label="Registrar movimiento"
        submit={(f) =>
          save({
            type: "cash",
            kind,
            amount: cents(f, "amount"),
            reason: string(f, "reason"),
          })
        }
      >
        <Choice
          label="Movimiento"
          value={kind}
          onChange={(v) => setKind(v as "deposit" | "withdrawal")}
          options={[
            { value: "deposit", label: "Aporte o saldo inicial" },
            { value: "withdrawal", label: "Retiro de dinero" },
          ]}
        />
        <Field
          label="Importe · $"
          name="amount"
          type="number"
          min={0.01}
          step="0.01"
        />
        <Field label="Motivo" name="reason" />
      </Form>
    </Modal>
  );
}
export type CartItem = { productId: string; quantity: number };
export function CartLines({
  cart,
  products,
  setCart,
}: {
  cart: CartItem[];
  products: Pick<
    Product,
    "id" | "name" | "unit" | "price" | "stock" | "variety" | "category"
  >[];
  setCart: (c: CartItem[]) => void;
}) {
  return (
    <div className="cart-lines">
      {cart.map((i) => {
        const p = products.find((p) => p.id === i.productId);
        if (!p) return null;
        return (
          <div className="cart-line" key={i.productId}>
            <div className="cart-line-name">
              <div>
                <strong>{p.name}</strong>
                <small>{p.variety || p.category}</small>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label={`Quitar ${p.name}`}
                onClick={() =>
                  setCart(cart.filter((c) => c.productId !== p.id))
                }
              >
                <X />
              </button>
            </div>
            <div className="cart-line-bottom">
              <label className="quantity-input">
                <input
                  aria-label={`Cantidad de ${p.name} en ${p.unit === "kg" ? "gramos" : "unidades"}`}
                  type="number"
                  min="1"
                  step="1"
                  value={i.quantity / (p.unit === "unit" ? 1000 : 1)}
                  onChange={(e) =>
                    setCart(
                      cart.map((c) =>
                        c.productId === p.id
                          ? {
                              ...c,
                              quantity: Math.max(
                                0,
                                Math.round(
                                  Number(e.target.value) *
                                    (p.unit === "unit" ? 1000 : 1),
                                ),
                              ),
                            }
                          : c,
                      ),
                    )
                  }
                />
                <span>{p.unit === "kg" ? "g" : "un."}</span>
              </label>
              <strong>{money(lineTotal(p.price, i.quantity))}</strong>
            </div>
          </div>
        );
      })}
    </div>
  );
}
export function SaleEditor({
  data,
  save,
  close,
}: {
  data: Business;
  save: Save;
  close: () => void;
}) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("Efectivo");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const total = cart.reduce(
    (a, i) =>
      a +
      lineTotal(
        data.products.find((p) => p.id === i.productId)?.price || 0,
        i.quantity,
      ),
    0,
  );
  function add(p: Product) {
    const step = p.unit === "kg" ? 250 : 1000;
    const found = cart.find((c) => c.productId === p.id);
    setCart(
      found
        ? cart.map((c) =>
            c.productId === p.id ? { ...c, quantity: c.quantity + step } : c,
          )
        : [...cart, { productId: p.id, quantity: step }],
    );
  }
  async function confirm() {
    setBusy(true);
    setError("");
    try {
      await save({ type: "sale", items: cart, method: method as "Efectivo" });
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revisá los productos.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      wide
      title="Nueva venta"
      description="Elegí los productos. Para los que se venden por peso, ingresá los gramos."
      close={close}
    >
      <div className="pos-grid">
        <section>
          <div className="search-control">
            <Search />
            <Input
              aria-label="Buscar productos para vender"
              placeholder="Buscar producto o variedad…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="pos-products">
            {data.products
              .filter((p) =>
                `${p.name} ${p.variety}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((p) => (
                <button
                  type="button"
                  className="pos-product"
                  key={p.id}
                  onClick={() => add(p)}
                  disabled={p.stock <= 0 || busy}
                >
                  <div>
                    <strong>{p.name}</strong>
                    <small>{p.variety || p.category}</small>
                    <span>
                      {money(p.price)} / {p.unit === "kg" ? "kg" : "un."}
                    </span>
                  </div>
                  <div>
                    <Plus />
                    <small>{quantityLabel(p.stock, p.unit)}</small>
                  </div>
                </button>
              ))}
          </div>
        </section>
        <section className="receipt">
          <div className="receipt-heading">
            <h3>Detalle de la venta</h3>
            <span>{cart.length} productos</span>
          </div>
          {cart.length ? (
            <CartLines cart={cart} products={data.products} setCart={setCart} />
          ) : (
            <div className="cart-empty">
              <ShoppingBasketIcon />
              <p>
                Agregá productos para
                <br />
                comenzar la venta.
              </p>
            </div>
          )}
          <div className="receipt-total">
            <span>Total a cobrar</span>
            <strong>{money(total)}</strong>
          </div>
          <Choice
            label="Medio de pago"
            value={method}
            onChange={setMethod}
            options={["Efectivo", "Transferencia", "Tarjeta"].map((value) => ({
              value,
              label: value,
            }))}
          />
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          <Button
            type="button"
            className="btn primary full"
            disabled={!cart.length || busy}
            onClick={confirm}
          >
            {busy ? (
              "Registrando…"
            ) : (
              <>
                <Check />
                Confirmar venta cobrada
              </>
            )}
          </Button>
          <p className="receipt-note">
            Confirma el cobro y descuenta el stock.
          </p>
        </section>
      </div>
    </Modal>
  );
}
function ShoppingBasketIcon() {
  return <Package />;
}
export function SaleDetail({
  sale,
  save,
  close,
}: {
  sale: Sale;
  save: Save;
  close: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <Modal
      title={`Venta ${sale.id}`}
      description={`${displayDate(sale.date)} · ${sale.method}`}
      close={close}
    >
      <div className="receipt-detail">
        {sale.items.map((i) => (
          <div key={i.productId}>
            <span>
              {i.name}
              <small>
                {quantityLabel(i.quantity, i.unit)} × {money(i.price)} /{" "}
                {i.unit === "kg" ? "kg" : "un."}
              </small>
            </span>
            <strong>{money(lineTotal(i.price, i.quantity))}</strong>
          </div>
        ))}
        <div>
          <strong>Total</strong>
          <strong>{money(sale.total)}</strong>
        </div>
      </div>
      {sale.cancelled ? (
        <p className="hint-box">
          Venta anulada. El stock y el dinero se revirtieron.
        </p>
      ) : confirm ? (
        <Form
          close={close}
          label="Sí, anular y devolver el dinero"
          submit={() => save({ type: "cancelSale", id: sale.id })}
        >
          <p className="hint-box">
            Se devolverán los productos al stock y se descontarán{" "}
            {money(sale.total)} del dinero disponible. Usá esta acción cuando el
            cobro también se haya devuelto.
          </p>
        </Form>
      ) : (
        <Button className="btn danger" onClick={() => setConfirm(true)}>
          Anular venta y devolver cobro
        </Button>
      )}
    </Modal>
  );
}
export function downloadJSON(data: Business) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mostrador-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function downloadCSV(data: Business) {
  const cell = (s: unknown) => {
    let v = String(s ?? "");
    if (/^[=+\-@]/.test(v)) v = "'" + v;
    return '"' + v.replaceAll('"', '""') + '"';
  };
  const rows = [
    [
      "Categoría",
      "Producto",
      "Variedad",
      "Unidad",
      "Precio ARS",
      "Costo ARS",
      "Stock",
      "Stock mínimo",
    ],
    ...data.products.map((p) => [
      p.category,
      p.name,
      p.variety,
      p.unit === "kg" ? "kg" : "unidad",
      p.price / 100,
      p.cost / 100,
      p.stock / 1000,
      p.minimum / 1000,
    ]),
  ];
  const blob = new Blob(
    ["\uFEFF" + rows.map((r) => r.map(cell).join(";")).join("\r\n")],
    { type: "text/csv;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mostrador-productos.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
