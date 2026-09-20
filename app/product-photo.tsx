"use client";
import { useState } from "react";
import { Package } from "lucide-react";
import { getProductPhoto } from "@/lib/product-photos";
export default function ProductPhoto({ imageUrl, name, variety = "" }: { imageUrl?: string; name: string; variety?: string }) {
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const ownImage = imageUrl && !failedUrls.includes(imageUrl) ? imageUrl : undefined;
  const match = getProductPhoto(name, variety);
  const fallback = match && !failedUrls.includes(match.src) ? match : undefined;
  const source = ownImage || fallback?.src;
  return <figure className="product-photo">
    {source ? <img src={source} alt={ownImage ? `${name}${variety ? ` · ${variety}` : ""}` : `${fallback?.alt}. Foto ilustrativa.`}
      width="960" height="720" loading="lazy" decoding="async" referrerPolicy="no-referrer"
      onError={() => setFailedUrls((current) => current.includes(source) ? current : [...current, source])} /> : <div className="photo-placeholder"><Package />Foto pendiente</div>}
    {!ownImage && fallback && <figcaption>Foto ilustrativa</figcaption>}
  </figure>;
}
