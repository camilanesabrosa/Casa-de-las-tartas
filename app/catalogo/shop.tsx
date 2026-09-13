"use client";
import { useEffect, useState } from "react";
import {
  Store,
  ArrowLeft,
  Plus,
  Search,
  Package,
  ShoppingBasket,
  ArrowUpRight,
  Leaf,
  Snowflake,
  Wheat,
  Utensils,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type Product,
  type Business,
  money,
  quantityLabel,
  lineTotal,
} from "@/lib/business";
import { CartLines, type CartItem } from "../components";
type CatalogProduct = Pick<
  Product,
  "id" | "name" | "variety" | "category" | "unit" | "price" | "stock"
>;
type CatalogData = {
  settings: Business["settings"];
  products: CatalogProduct[];
};
export default function Catalog() {
  const [data, setData] = useState<CatalogData | null>(null);
  const [error, setError] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("Todos");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState("");
  async function load() {
    try {
      const r = await fetch("/api/business?catalog=1", { cache: "no-store" });
      const j = (await r.json()) as CatalogData & { error?: string };
      if (!r.ok) throw new Error(j.error);
      setData(j);
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos abrir el catálogo.",
      );
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(""), 2500);
    return () => clearTimeout(t);
  }, [feedback]);
  if (!data)
    return (
      <main className="loading-screen">
        <h1>
          {error ? "No pudimos abrir el catálogo" : "Abriendo el catálogo…"}
        </h1>
        <p>{error}</p>
        {error && (
          <Button className="btn" onClick={() => void load()}>
            Volver a intentar
          </Button>
        )}
      </main>
    );
  const total = cart.reduce(
    (a, i) =>
      a +
      lineTotal(
        data.products.find((p) => p.id === i.productId)?.price || 0,
        i.quantity,
      ),
    0,
  );
  const invalid = cart.some((i) => {
    const p = data.products.find((p) => p.id === i.productId);
    return (
      !p ||
      i.quantity <= 0 ||
      i.quantity > p.stock ||
      (p.unit === "unit" && i.quantity % 1000 !== 0)
    );
  });
  const filtered = data.products.filter(
    (p) =>
      (category === "Todos" || p.category === category) &&
      `${p.name} ${p.variety}`.toLowerCase().includes(q.toLowerCase()),
  );
  function add(p: CatalogProduct) {
    const amount = p.unit === "kg" ? Math.min(250, p.stock) : 1000;
    const current = cart.find((i) => i.productId === p.id);
    if ((current?.quantity || 0) + amount > p.stock) {
      setFeedback("Ya agregaste la cantidad disponible.");
      return;
    }
    setCart(
      current
        ? cart.map((i) =>
            i.productId === p.id ? { ...i, quantity: i.quantity + amount } : i,
          )
        : [...cart, { productId: p.id, quantity: amount }],
    );
    setFeedback(`${p.name} agregado al pedido`);
  }
  const message = `Hola, soy ${name.trim()}. Quisiera hacer este pedido:\n\n${cart
    .map((i) => {
      const p = data.products.find((p) => p.id === i.productId)!;
      return `• ${p.name}${p.variety ? " · " + p.variety : ""}: ${quantityLabel(i.quantity, p.unit)} — ${money(lineTotal(p.price, i.quantity))}`;
    })
    .join(
      "\n",
    )}\n\nTotal estimado: ${money(total)}${note ? "\nNota: " + note : ""}\nCoordino disponibilidad, pago y retiro con ustedes.`;
  const enabled =
    cart.length > 0 &&
    !invalid &&
    name.trim().length > 0 &&
    data.settings.whatsapp.length >= 8;
  const icons: Record<string, typeof Package> = {
    Precocidos: Utensils,
    Congelados: Snowflake,
    Pastas: Wheat,
    Varios: Leaf,
  };
  return (
    <main className="catalog-page">
      <header className="catalog-top">
        <a href="/catalogo" className="brand">
          <span className="brand-mark">
            <Store />
          </span>
          {data.settings.name}
        </a>
        <a className="text-link" href="/">
          <ArrowLeft />
          Volver al negocio
        </a>
      </header>
      <div className="catalog-preview">
        <span>Vista previa del catálogo · Precios y cantidades de ejemplo</span>
        <span>El pedido se confirma por WhatsApp</span>
      </div>
      <section className="catalog-hero">
        <div>
          <h1>
            Tu próxima comida
            <br />
            empieza acá.
          </h1>
          <p>
            Precocidos, congelados, pastas y más. Elegí por unidad o llevá la
            cantidad que necesitás.
          </p>
        </div>
        <img
          src="/catalogo.jpg"
          alt="Ensalada con quinoa y palta, granola y limonada. Imagen ilustrativa."
          width="768"
          height="512"
        />
      </section>
      <div className="catalog-content">
        <section aria-label="Productos del catálogo">
          <div className="search-control">
            <Search />
            <Input
              aria-label="Buscar en el catálogo"
              placeholder="¿Qué tenés ganas de comer?"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="filter-row" style={{ marginTop: 16 }}>
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
          </div>
          <div className="catalog-products">
            {filtered.map((p) => {
              const Icon = icons[p.category] || Package;
              return (
                <article className="panel catalog-product" key={p.id}>
                  <span className="category-label">
                    <Icon />
                    {p.category}
                  </span>
                  <h2>{p.name}</h2>
                  <p className="variety">
                    {p.variety || "Consultá las variedades disponibles"}
                  </p>
                  <div className="catalog-price">
                    <strong>{money(p.price)}</strong>
                    <span>/ {p.unit === "kg" ? "kilo" : "unidad"}</span>
                  </div>
                  <span className="catalog-status">
                    {p.stock > 0
                      ? p.unit === "kg"
                        ? "Elegí los gramos en tu pedido"
                        : "Venta por unidad"
                      : "Sin stock por el momento"}
                  </span>
                  <Button
                    className="btn"
                    onClick={() => add(p)}
                    disabled={p.stock <= 0}
                  >
                    <Plus />
                    {p.unit === "kg" ? "Agregar 250 g" : "Agregar al pedido"}
                  </Button>
                </article>
              );
            })}
          </div>
          {!filtered.length && (
            <div className="empty">
              <h2>No encontramos productos</h2>
              <p>Probá con otro nombre o categoría.</p>
              <Button
                className="btn"
                onClick={() => {
                  setQ("");
                  setCategory("Todos");
                }}
              >
                Ver todos los productos
              </Button>
            </div>
          )}
          <p className="catalog-disclaimer">
            {data.settings.address}. El envío del pedido no reserva mercadería
            ni realiza un cobro. La disponibilidad, el peso final y el total se
            confirman con el negocio.
          </p>
        </section>
        <aside className="receipt catalog-cart" id="pedido">
          <div className="receipt-heading">
            <h2>Tu pedido</h2>
            <ShoppingBasket />
          </div>
          {cart.length ? (
            <CartLines cart={cart} products={data.products} setCart={setCart} />
          ) : (
            <div className="cart-empty">
              <ShoppingBasket />
              <p>
                Tu pedido está esperando
                <br />
                algo rico.
              </p>
            </div>
          )}
          <div className="receipt-total">
            <span>Total estimado</span>
            <strong>{money(total)}</strong>
          </div>
          <label className="field">
            <span>Tu nombre</span>
            <Input
              className="field-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Para saber quién hace el pedido"
              maxLength={100}
            />
          </label>
          <label className="field">
            <span>Una aclaración · opcional</span>
            <Input
              className="field-input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Variedad, horario de retiro…"
              maxLength={300}
            />
          </label>
          {invalid && (
            <p className="error-message">
              Revisá las cantidades: alguna supera el stock disponible o es
              cero.
            </p>
          )}
          {!data.settings.whatsapp && (
            <p className="hint-box catalog-order">
              Para probar el envío, cargá el WhatsApp del negocio en
              Configuración.
            </p>
          )}
          {enabled ? (
            <a
              className="btn primary full catalog-order"
              href={`https://wa.me/${data.settings.whatsapp}?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Continuar en WhatsApp <ArrowUpRight />
            </a>
          ) : (
            <Button className="btn primary full catalog-order" disabled>
              Continuar en WhatsApp
            </Button>
          )}
          <p>Coordinamos el pago y el retiro directamente con vos.</p>
        </aside>
      </div>
      {cart.length > 0 && (
        <a href="#pedido" className="catalog-mobile-cart">
          <span>Ver mi pedido · {cart.length} productos</span>
          <strong>{money(total)}</strong>
        </a>
      )}
      <div className="toast-region" role="status" aria-live="polite">
        {feedback && <div className="app-toast">{feedback}</div>}
      </div>
    </main>
  );
}
