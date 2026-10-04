import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductsView } from "../app/views";
import { applyAction } from "../lib/actions";
import { createFreshBusiness } from "../lib/business";

test("categorías: la tabla muestra los nombres editados y mantiene las letras después de eliminar", () => {
  let data = applyAction(createFreshBusiness(), { type: "renameProductCategory", name: "Precocidos", newName: "Listos" });
  data = applyAction(data, { type: "deleteProductCategory", name: "Congelados", targetCategory: "Listos" });
  const html = renderToStaticMarkup(<ProductsView data={data} save={async () => {}} />);
  assert.ok(html.includes("Listos · A"));
  assert.ok(html.includes("Pastas · C"));
  assert.ok(html.includes("Tartas · E"));
  assert.ok(!html.includes("Precocidos"));
  assert.ok(!html.includes("Congelados"));
  assert.ok(html.includes("Categorías"));
  assert.ok(html.includes('aria-label="Editar producto:'));
});

test("categorías: una lista vacía no vuelve a mostrar las categorías iniciales", () => {
  const data = { ...createFreshBusiness(), products: [], productCategories: [], productCategoryCodes: {} };
  const html = renderToStaticMarkup(<ProductsView data={data} save={async () => {}} />);
  assert.ok(html.includes("Categorías"));
  assert.ok(html.includes("Nuevo producto"));
  assert.ok(html.includes("No hay productos con esos filtros"));
  assert.ok(!html.includes("Pastas · C"));
});
