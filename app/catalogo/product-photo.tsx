"use client";
import { useState } from "react";
import { Package } from "lucide-react";
const categoryPhotos: Record<string, { src: string; alt: string }> = {
  Precocidos: { src: "/photos/precocidos.jpg", alt: "Medallones de pollo, papas noisette y bastoncitos de muzzarella" },
  Congelados: { src: "/photos/congelados.jpg", alt: "Empanadas y medialunas" },
  Pastas: { src: "/photos/pastas.jpg", alt: "Ravioles, tallarines, ñoquis y canelones" },
  Varios: { src: "/photos/varios.jpg", alt: "Milanesa de pollo y ensalada" },
};
export default function ProductPhoto({ imageUrl, category, name }: { imageUrl?: string; category: string; name: string }) {
  const [failedUrl, setFailedUrl] = useState("");
  const ownImage = imageUrl && imageUrl !== failedUrl ? imageUrl : undefined;
  const fallback = categoryPhotos[category];
  const source = ownImage || fallback?.src;
  return <figure className="product-photo">
    {source ? <img src={source} alt={ownImage ? name : `${fallback.alt}. Foto ilustrativa de la categoría.`}
      width="960" height="720" loading="lazy" decoding="async" referrerPolicy="no-referrer"
      onError={ownImage ? () => setFailedUrl(ownImage) : undefined} /> : <div className="photo-placeholder"><Package />Foto pendiente</div>}
    {!ownImage && fallback && <figcaption>Foto ilustrativa · {category}</figcaption>}
  </figure>;
}
