"use client";

import { useRef, useState } from "react";
import {
  Archive,
  ArrowDownToLine,
  History,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type Business,
  type Product,
  type PurchaseInvoice,
  normalizeBusiness,
  type Supplier,
  dateKey,
  lineTotal,
  money,
  quantityLabel,
} from "@/lib/business";
import { Choice, Field, Form, Modal, PayEditor, PaymentMethodChoice, type Save } from "./components";

const NEW = "__new__";
const ALL = "__all__";
const text = (form: FormData, name: string) => String(form.get(name) || "");
const invoiceDate = (date: string) =>
  new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Argentina/Mendoza",
  }).format(new Date(date));
type DraftLine = {
  key: number;
  productId: string;
  unit: Product["unit"];
  quantity: string;
  cost: string;
};
const draftLine = (key: number, product?: Product): DraftLine => ({
  key,
  productId: product?.id || NEW,
  unit: product?.unit || "unit",
  quantity: "1",
  cost: product?.cost ? String(product.cost / 100) : "",
});
function draftTotal(line: DraftLine) {
  const cost = Math.round(Number(line.cost) * 100);
  const quantity = Math.round(Number(line.quantity) * 1000);
  if (
    !Number.isSafeInteger(cost) ||
    !Number.isSafeInteger(quantity) ||
    cost <= 0 ||
    quantity <= 0
  )
    return 0;
  try {
    return lineTotal(cost, quantity);
  } catch {
    return 0;
  }
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
  const suppliers = data.suppliers.filter((s) => !s.archived);
  const [sid, setSid] = useState(supplierId || suppliers[0]?.id || NEW);
  const [supplierName, setSupplierName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [lines, setLines] = useState<DraftLine[]>(() => [
    draftLine(0, data.products[0]),
  ]);
  const nextKey = useRef(1);
  const [paid, setPaid] = useState("0");
  const [method, setMethod] = useState<string>("Efectivo");
  const total = lines.reduce((sum, line) => sum + draftTotal(line), 0);
  const paidCents = Math.round(Number(paid) * 100) || 0;
  const update = (key: number, patch: Partial<DraftLine>) =>
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  return (
    <Modal
      wide
      title="Registrar compra"
      description="Cargá los artículos de la factura. Al guardar, se suman al stock y queda registrado el pago y el saldo pendiente."
      close={close}
    >
      <Form
        close={close}
        label="Registrar compra"
        submit={(form) =>
          save({
            type: "purchase",
            supplierId: sid === NEW ? undefined : sid,
            supplier:
              sid === NEW
                ? {
                    name: text(form, "supplier-name"),
                    phone: text(form, "supplier-phone"),
                  }
                : undefined,
            date: text(form, "date"),
            invoiceNumber: text(form, "invoice-number"),
            paid: paidCents,
            method: method as "Efectivo" | "Transferencia" | "Tarjeta",
            items: lines.map((line) => ({
              ...(line.productId === NEW
                ? {
                    product: {
                      name: text(form, `name-${line.key}`),
                      variety: text(form, `variety-${line.key}`),
                      category: text(form, `category-${line.key}`),
                      unit: line.unit,
                    },
                  }
                : { productId: line.productId }),
              quantity: Math.round(Number(line.quantity) * 1000),
              cost: Math.round(Number(line.cost) * 100),
            })),
          })
        }
      >
        <section className="purchase-supplier" aria-label="Proveedor de la compra">
          {sid === NEW ? (
            <>
              <div className="purchase-supplier-heading">
                <h3>Nuevo proveedor</h3>
                {suppliers.length > 0 && (
                  <Button type="button" className="btn" onClick={() => setSid(suppliers[0].id)}>
                    Elegir un proveedor existente
                  </Button>
                )}
              </div>
              <p className="muted">Se guardará como proveedor al registrar esta compra.</p>
              <div className="form-grid">
                <label className="field">
                  <span>Nombre del proveedor</span>
                  <Input className="field-input" name="supplier-name" required
                    value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
                </label>
                <label className="field">
                  <span>Teléfono · opcional</span>
                  <Input className="field-input" name="supplier-phone" type="tel"
                    value={supplierPhone} onChange={(e) => setSupplierPhone(e.target.value)} />
                </label>
              </div>
            </>
          ) : (
            <>
              <Choice label="Proveedor de la compra" value={sid} onChange={setSid}
                options={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
              <Button type="button" className="btn" onClick={() => setSid(NEW)}>
                <Plus />Crear un proveedor nuevo
              </Button>
            </>
          )}
        </section>
        <div className="form-grid">
          <Field
            label="Fecha de la compra"
            name="date"
            type="date"
            defaultValue={dateKey()}
          />
          <Field
            label="N.º de factura o comprobante · opcional"
            name="invoice-number"
            required={false}
          />
        </div>
        <section className="purchase-lines" aria-label="Artículos de la compra">
          <h3>Artículos recibidos</h3>
          {lines.map((line, index) => (
            <div className="purchase-line" key={line.key}>
              <div className="purchase-line-heading">
                <span>Artículo {index + 1}</span>
                <Button
                  className="icon-button"
                  variant="ghost"
                  type="button"
                  aria-label={`Quitar artículo ${index + 1}`}
                  disabled={lines.length === 1}
                  onClick={() =>
                    setLines((current) =>
                      current.filter((item) => item.key !== line.key),
                    )
                  }
                >
                  <X />
                </Button>
              </div>
              <Choice
                label={`Producto ${index + 1}`}
                value={line.productId}
                onChange={(productId) => {
                  const product = data.products.find((p) => p.id === productId);
                  update(line.key, {
                    ...draftLine(line.key, product),
                    productId,
                  });
                }}
                options={[
                  ...data.products.map((p) => ({
                    value: p.id,
                    label: [p.name, p.variety].filter(Boolean).join(" · "),
                  })),
                  { value: NEW, label: "+ Nuevo producto" },
                ]}
              />
              {line.productId === NEW && (
                <div className="purchase-new-product">
                  <div className="form-grid">
                    <Field
                      label={`Nombre del producto ${index + 1}`}
                      name={`name-${line.key}`}
                    />
                    <Field
                      label="Variedad o relleno · opcional"
                      name={`variety-${line.key}`}
                      required={false}
                    />
                    <Field
                      label="Categoría"
                      name={`category-${line.key}`}
                      defaultValue="Varios"
                    />
                    <Choice
                      label={`Unidad del producto ${index + 1}`}
                      value={line.unit}
                      onChange={(unit) =>
                        update(line.key, {
                          unit: unit as Product["unit"],
                          quantity: "1",
                        })
                      }
                      options={[
                        { value: "unit", label: "Unidad" },
                        { value: "kg", label: "Kilo" },
                      ]}
                    />
                  </div>
                  <p className="muted">
                    El producto se crea con el stock de esta compra. Después
                    cargá su precio de venta en Productos para venderlo o
                    publicarlo.
                  </p>
                </div>
              )}
              <div className="purchase-line-amounts">
                <label className="field">
                  <span>
                    Cantidad {index + 1} ·{" "}
                    {line.unit === "kg" ? "kg" : "unidades"}
                  </span>
                  <Input
                    className="field-input"
                    name={`quantity-${line.key}`}
                    aria-label={`Cantidad ${index + 1} · ${line.unit === "kg" ? "kg" : "unidades"}`}
                    type="number"
                    required
                    min={line.unit === "kg" ? 0.001 : 1}
                    step={line.unit === "kg" ? "0.001" : "1"}
                    value={line.quantity}
                    onChange={(e) =>
                      update(line.key, { quantity: e.target.value })
                    }
                  />
                  {line.unit === "kg" && (
                    <small>0,25 kg equivale a 250 gramos.</small>
                  )}
                </label>
                <label className="field">
                  <span>
                    Costo {index + 1} por {line.unit === "kg" ? "kg" : "unidad"}{" "}
                    · $
                  </span>
                  <Input
                    className="field-input"
                    name={`cost-${line.key}`}
                    type="number"
                    required
                    min={0.01}
                    step="0.01"
                    value={line.cost}
                    onChange={(e) => update(line.key, { cost: e.target.value })}
                  />
                </label>
                <div className="purchase-line-subtotal">
                  <span>Subtotal</span>
                  <strong>{money(draftTotal(line))}</strong>
                </div>
              </div>
            </div>
          ))}
          <Button
            className="btn"
            type="button"
            disabled={lines.length >= 100}
            onClick={() => {
              const fresh = draftLine(nextKey.current++, data.products[0]);
              setLines((current) => [...current, fresh]);
            }}
          >
            <Plus />
            Agregar artículo
          </Button>
        </section>
        <div className="purchase-payment">
          <label className="field">
            <span>Pagado ahora · $</span>
            <Input
              className="field-input"
              name="paid"
              aria-label="Pagado ahora · $"
              type="number"
              min={0}
              max={total / 100}
              step="0.01"
              required
              value={paid}
              onChange={(e) => setPaid(e.target.value)}
            />
            <small>
              Dejá 0 si no pagaste. Podés registrar otros pagos después.
            </small>
          </label>
          <Button
            className="btn"
            type="button"
            disabled={!total}
            onClick={() => setPaid(String(total / 100))}
          >
            Pagar todo
          </Button>
        </div>
        {paidCents > 0 && <PaymentMethodChoice value={method} onChange={setMethod} />}
        <div className="purchase-totals" aria-live="polite">
          <div>
            <span>Total de la compra</span>
            <strong>{money(total)}</strong>
          </div>
          <div>
            <span>Pagado ahora</span>
            <strong>{money(paidCents)}</strong>
          </div>
          <div>
            <span>Queda por pagar</span>
            <strong>{money(Math.max(0, total - paidCents))}</strong>
          </div>
        </div>
      </Form>
    </Modal>
  );
}

export function SupplierEditor({
  supplier,
  save,
  close,
}: {
  supplier?: Supplier;
  save: Save;
  close: () => void;
}) {
  return (
    <Modal
      title={supplier ? "Editar proveedor" : "Nuevo proveedor"}
      description="Guardá el contacto de quien te vende la mercadería."
      close={close}
    >
      <Form
        close={close}
        submit={(form) =>
          save({
            type: "supplier",
            id: supplier?.id,
            name: text(form, "name"),
            phone: text(form, "phone"),
          })
        }
      >
        <Field label="Nombre" name="name" defaultValue={supplier?.name} />
        <Field
          label="Teléfono · opcional"
          name="phone"
          defaultValue={supplier?.phone}
          required={false}
        />
      </Form>
    </Modal>
  );
}

function PurchaseDetail({
  purchase,
  data,
  close,
  pay,
}: {
  purchase: PurchaseInvoice;
  data: Business;
  close: () => void;
  pay: () => void;
}) {
  const payments = data.payments
    .filter((p) => p.kind === "purchase" && p.reference === purchase.id)
    .sort((a, b) => a.date.localeCompare(b.date));
  return (
    <Modal
      wide
      title={
        purchase.invoiceNumber
          ? `Comprobante ${purchase.invoiceNumber}`
          : `Compra ${purchase.id}`
      }
      description={`${purchase.supplierName} · ${invoiceDate(purchase.date)}`}
      close={close}
    >
      <div className="table-scroll">
        <Table className="data-table purchase-detail-table">
          <TableHeader>
            <TableRow>
              <TableHead>Artículo</TableHead>
              <TableHead className="number">Cantidad</TableHead>
              <TableHead className="number">Costo unitario</TableHead>
              <TableHead className="number">Subtotal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchase.items.map((item, index) => (
              <TableRow key={index}>
                <TableCell>{item.name}</TableCell>
                <TableCell className="number">
                  {quantityLabel(item.quantity, item.unit)}
                </TableCell>
                <TableCell className="number">
                  {money(item.cost)}
                  <small>por {item.unit === "kg" ? "kg" : "unidad"}</small>
                </TableCell>
                <TableCell className="number">{money(item.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="purchase-totals">
        <div>
          <span>Total comprado</span>
          <strong>{money(purchase.total)}</strong>
        </div>
        <div>
          <span>Total pagado</span>
          <strong>{money(purchase.paid)}</strong>
        </div>
        <div>
          <span>Pendiente</span>
          <strong>{money(purchase.total - purchase.paid)}</strong>
        </div>
      </div>
      <section className="purchase-payment-history">
        <h3>Pagos de esta compra</h3>
        {payments.length ? (
          <ul>
            {payments.map((payment) => (
              <li key={payment.id}>
                <span>
                  {invoiceDate(payment.date)}
                  <small>{payment.id}{payment.method ? ` · ${payment.method}` : ""}</small>
                </span>
                <strong>{money(payment.amount)}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Todavía no registraste pagos.</p>
        )}
      </section>
      <div className="form-actions">
        <Button className="btn" onClick={close}>
          Cerrar
        </Button>
        {purchase.paid < purchase.total ? (
          <Button className="btn primary" onClick={pay}>
            Registrar pago
          </Button>
        ) : (
          <span className="status success">Pagada</span>
        )}
      </div>
    </Modal>
  );
}

export function SuppliersView({ data: original, save }: { data: Business; save: Save }) {
  const data = normalizeBusiness(original);
  const [editing, setEditing] = useState<Supplier | "new" | null>(null);
  const [changing, setChanging] = useState<{
    supplier: Supplier;
    restore?: boolean;
  } | null>(null);
  const [purchaseFor, setPurchaseFor] = useState<string | null>(null);
  const [payId, setPayId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [filter, setFilter] = useState(ALL);
  const [showArchived, setShowArchived] = useState(false);
  const suppliersById = new Map(data.suppliers.map((s) => [s.id, s]));
  const purchases = data.purchases
    .filter((p) => filter === ALL || p.supplierId === filter)
    .sort((a, b) => b.date.localeCompare(a.date));
  const accounts = new Map<
    string,
    { total: number; paid: number; count: number; latest?: string }
  >();
  for (const purchase of data.purchases) {
    const account = accounts.get(purchase.supplierId) || {
      total: 0,
      paid: 0,
      count: 0,
    };
    account.total += purchase.total;
    account.paid += purchase.paid;
    account.count++;
    if (!account.latest || Date.parse(purchase.date) > Date.parse(account.latest)) {
      account.latest = purchase.date;
    }
    accounts.set(purchase.supplierId, account);
  }
  const total = purchases.reduce((sum, p) => sum + p.total, 0);
  const paid = purchases.reduce((sum, p) => sum + p.paid, 0);
  const debt = data.purchases.reduce((sum, p) => sum + p.total - p.paid, 0);
  const paying = data.purchases.find((p) => p.id === payId);
  const detail = data.purchases.find((p) => p.id === detailId);
  return (
    <>
      <div className="view-toolbar">
        <div>
          <p className="muted">Total pendiente a proveedores</p>
          <div className="big-number">{money(debt)}</div>
        </div>
        <div className="button-group">
          <Button className="btn" onClick={() => setEditing("new")}>
            <Plus />
            Nuevo proveedor
          </Button>
          <Button className="btn primary" onClick={() => setPurchaseFor("")}>
            <ArrowDownToLine />
            Registrar compra
          </Button>
        </div>
      </div>
      {data.suppliers.some((s) => s.archived) && (
        <label className="check-field supplier-archive-filter">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Mostrar proveedores dados de baja
        </label>
      )}
      <div className="supplier-grid">
        {data.suppliers
          .filter((s) => showArchived || !s.archived)
          .map((supplier) => {
            const account = accounts.get(supplier.id) || {
              total: 0,
              paid: 0,
              count: 0,
              latest: undefined,
            };
            return (
              <article
                key={supplier.id}
                className="panel supplier-card supplier-account"
              >
                <div className="supplier-contact">
                  <div className="supplier-heading">
                    <h3>{supplier.name}</h3>
                    {supplier.archived && <span className="status">De baja</span>}
                  </div>
                  <p className="muted">{supplier.phone || "Sin teléfono cargado"}</p>
                  <p className="supplier-history-meta">
                    {account.count ? `${account.count} ${account.count === 1 ? "compra" : "compras"}` : "Sin compras registradas"}
                    {account.latest && ` · Última: ${invoiceDate(account.latest)}`}
                  </p>
                </div>
                <dl className="supplier-amounts">
                  <div>
                    <dt>Total comprado</dt>
                    <dd>{money(account.total)}</dd>
                  </div>
                  <div>
                    <dt>Total pagado</dt>
                    <dd>{money(account.paid)}</dd>
                  </div>
                  <div className="supplier-pending">
                    <dt>Pendiente</dt>
                    <dd>{money(account.total - account.paid)}</dd>
                  </div>
                </dl>
                <div className="supplier-actions">
                  <Button
                    className="btn"
                    onClick={() => {
                      setFilter(supplier.id);
                      document
                        .getElementById("purchase-history")
                        ?.scrollIntoView({ block: "start" });
                    }}
                  >
                    <History />
                    Ver compras
                  </Button>
                  <Button
                    className="icon-button"
                    variant="ghost"
                    aria-label={`Editar ${supplier.name}`}
                    onClick={() => setEditing(supplier)}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    className="icon-button"
                    variant="ghost"
                    aria-label={`${supplier.archived ? "Reactivar" : account.count ? "Dar de baja" : "Eliminar"} ${supplier.name}`}
                    onClick={() =>
                      setChanging({
                        supplier,
                        restore: Boolean(supplier.archived),
                      })
                    }
                  >
                    {supplier.archived ? (
                      <RotateCcw />
                    ) : account.count ? (
                      <Archive />
                    ) : (
                      <Trash2 />
                    )}
                  </Button>
                </div>
              </article>
            );
          })}
      </div>
      {!data.suppliers.some((s) => !s.archived) && (
        <div className="empty">
          <p>
            No hay proveedores activos. Podés cargar uno nuevo al registrar la
            compra.
          </p>
        </div>
      )}
      <section className="panel" id="purchase-history">
        <div className="panel-heading purchase-history-heading">
          <div>
            <h2>Compras y pagos</h2>
            <p>Abrí una compra para ver sus artículos, costos y pagos.</p>
          </div>
          <Choice
            label="Filtrar por proveedor"
            value={filter}
            onChange={setFilter}
            options={[
              { value: ALL, label: "Todos los proveedores" },
              ...data.suppliers.map((s) => ({
                value: s.id,
                label: `${s.name}${s.archived ? " · de baja" : ""}`,
              })),
            ]}
          />
        </div>
        <div className="quiet-summary purchase-history-summary">
          <span>{purchases.length} compras</span>
          <span>
            Comprado <strong>{money(total)}</strong>
          </span>
          <span>
            Pagado <strong>{money(paid)}</strong>
          </span>
          <span>
            Pendiente <strong>{money(total - paid)}</strong>
          </span>
        </div>
        <div className="table-scroll">
          <Table className="data-table">
            <TableHeader>
              <TableRow>
                <TableHead>Proveedor / comprobante</TableHead>
                <TableHead>Artículos</TableHead>
                <TableHead className="number">Total</TableHead>
                <TableHead className="number">Pagado</TableHead>
                <TableHead className="number">Pendiente</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchases.map((purchase) => (
                <TableRow key={purchase.id}>
                  <TableCell>
                    <strong>
                      {suppliersById.get(purchase.supplierId)?.name ||
                        purchase.supplierName}
                    </strong>
                    <small>
                      {purchase.invoiceNumber || purchase.id} ·{" "}
                      {invoiceDate(purchase.date)}
                    </small>
                  </TableCell>
                  <TableCell>
                    {purchase.items.slice(0, 2).map((item, index) => (
                      <small className="purchase-item-summary" key={index}>
                        {item.name} · {quantityLabel(item.quantity, item.unit)}
                      </small>
                    ))}
                    {purchase.items.length > 2 && (
                      <small>Y {purchase.items.length - 2} artículos más</small>
                    )}
                  </TableCell>
                  <TableCell className="number">
                    {money(purchase.total)}
                  </TableCell>
                  <TableCell className="number">
                    {money(purchase.paid)}
                  </TableCell>
                  <TableCell className="number">
                    {money(purchase.total - purchase.paid)}
                  </TableCell>
                  <TableCell>
                    <div className="purchase-table-actions">
                      <button
                        className="text-link"
                        onClick={() => setDetailId(purchase.id)}
                        aria-label={`Ver detalle de ${purchase.invoiceNumber || purchase.id}`}
                      >
                        Ver detalle
                      </button>
                      {purchase.paid < purchase.total ? (
                        <button
                          className="text-link"
                          onClick={() => setPayId(purchase.id)}
                        >
                          Registrar pago
                        </button>
                      ) : (
                        <span className="status success">Pagada</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {!purchases.length && (
          <div className="empty">
            <p>
              {filter === ALL
                ? "Todavía no registraste compras."
                : "Este proveedor todavía no tiene compras registradas."}
            </p>
          </div>
        )}
      </section>
      {editing && (
        <SupplierEditor
          supplier={editing === "new" ? undefined : editing}
          save={save}
          close={() => setEditing(null)}
        />
      )}
      {purchaseFor !== null && (
        <PurchaseEditor
          data={data}
          supplierId={purchaseFor || undefined}
          save={save}
          close={() => setPurchaseFor(null)}
        />
      )}
      {paying && (
        <PayEditor
          id={paying.id}
          balance={paying.total - paying.paid}
          save={save}
          close={() => setPayId(null)}
        />
      )}
      {detail && (
        <PurchaseDetail
          purchase={detail}
          data={data}
          close={() => setDetailId(null)}
          pay={() => {
            setDetailId(null);
            setPayId(detail.id);
          }}
        />
      )}
      {changing && (
        <Modal
          title={
            changing.restore
              ? "Reactivar proveedor"
              : accounts.get(changing.supplier.id)?.count
                ? "Dar de baja al proveedor"
                : "Eliminar proveedor"
          }
          description={changing.supplier.name}
          close={() => setChanging(null)}
        >
          <Form
            close={() => setChanging(null)}
            label={
              changing.restore
                ? "Reactivar proveedor"
                : accounts.get(changing.supplier.id)?.count
                  ? "Dar de baja"
                  : "Eliminar proveedor"
            }
            submit={() =>
              save({
                type: changing.restore ? "restoreSupplier" : "removeSupplier",
                id: changing.supplier.id,
              })
            }
          >
            <p>
              {changing.restore
                ? "Vas a poder registrar nuevas compras a este proveedor."
                : accounts.get(changing.supplier.id)?.count
                  ? "Se conservan sus compras, artículos, pagos y deudas. Podés seguir pagando sus compras y consultar el historial. Para volver a comprarle, reactivá el proveedor."
                  : "Este proveedor no tiene compras registradas. Se eliminará su contacto."}
            </p>
          </Form>
        </Modal>
      )}
    </>
  );
}
