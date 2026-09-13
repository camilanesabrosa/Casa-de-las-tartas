import type { Business, Product } from "./business";

export type CatalogProduct = Pick<Product,
  "id" | "name" | "variety" | "category" | "unit" | "price" | "stock" | "imageUrl"
>;
export type CatalogData = {
  settings: Business["settings"];
  products: CatalogProduct[];
};

export function publicCatalog(data: Business): CatalogData {
  return {
    settings: data.settings,
    products: data.products.filter((p) => p.published).map(
      ({ id, name, variety, category, unit, price, stock, imageUrl }) =>
        ({ id, name, variety, category, unit, price, stock, imageUrl }),
    ),
  };
}
