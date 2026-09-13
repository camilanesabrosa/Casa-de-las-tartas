import type { Business, Product } from "./business";

export type CatalogProduct = Pick<Product,
  "id" | "name" | "variety" | "category" | "unit" | "price" | "stock" | "imageUrl"
>;
export type CatalogData = {
  settings: Business["settings"];
  products: CatalogProduct[];
};

export const NEW_PRODUCT_NAME = "Yogur con cereales y banana";
export const isNewCatalogProduct = (product: Pick<Product, "name">) =>
  ["yogurlac", NEW_PRODUCT_NAME.toLowerCase()].includes(product.name.trim().toLowerCase());

export function publicCatalog(data: Business): CatalogData {
  return {
    settings: data.settings,
    products: data.products.filter((p) => p.published).map(
      ({ id, name, variety, category, unit, price, stock, imageUrl }) =>
        ({ id, name: isNewCatalogProduct({ name }) ? NEW_PRODUCT_NAME : name, variety, category, unit, price, stock, imageUrl }),
    ).sort((a, b) => Number(isNewCatalogProduct(b)) - Number(isNewCatalogProduct(a))),
  };
}
