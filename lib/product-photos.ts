// Illustrative photos match the food and, where visible, its filling.
// Custom photos always take precedence in ProductPhoto. No category fallback.
type ProductPhoto = { src: string; alt: string };
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
const photo = (slug: string, alt: string, format = "jpg"): ProductPhoto => ({ src: `/photos/products/${slug}.${format}`, alt });
const plainPhotos: Record<string, ProductPhoto> = {
  "patitas de pollo": photo("patitas-pollo", "Patitas de pollo rebozadas, con forma de pequeños muslitos"),
  "papas noisette": photo("papas-noisette", "Papas noisette redondas y doradas"),
  "bastoncitos de muzzarella": photo("bastoncitos-muzzarella", "Bastoncitos de muzzarella rebozados, con queso fundido"),
  "caritas": photo("papas-caritas", "Papas con forma de caritas sonrientes"),
  "papas baston": photo("papas-baston", "Papas cortadas en bastones, doradas"),
  "filet a la romana": photo("filet-romana", "Filetes de pescado con rebozado a la romana"),
  "tortitas": photo("tortitas-mendocinas", "Tortitas mendocinas de panadería, redondas y saladas"),
  "pan": photo("pan", "Pan francés con corteza dorada y miga blanca"),
  "ravioles": photo("ravioles", "Ravioles frescos cuadrados, con bordes sellados"),
  "fideos": photo("fideos", "Nidos de fideos frescos tipo tallarín"),
  "sorrentinos": photo("sorrentinos", "Sorrentinos frescos de forma redonda"),
  "noquis": photo("noquis", "Ñoquis de papa con estrías de tenedor"),
  "canelones": photo("canelones", "Canelones enrollados con salsa de tomate y queso"),
  "ensaladas": photo("ensaladas", "Ensalada con lechuga, tomate, zanahoria y pepino"),
  "yogurlac": photo("yogurlac-cereales-banana", "Pote de leche con cereales y rodajas de banana", "png"),
  "yogur con cereales y banana": photo("yogurlac-cereales-banana", "Pote de leche con cereales y rodajas de banana", "png"),
  "leche con cereales y banana": photo("yogurlac-cereales-banana", "Pote de leche con cereales y rodajas de banana", "png"),
  "mendosoja": photo("mendosoja-milanesa", "Milanesas de soja rebozadas"),
  "milanesa de pollo": photo("milanesa-pollo", "Milanesas de pechuga de pollo, finas y rebozadas"),
};
const varietyPhotos: Record<string, Record<string, ProductPhoto>> = {
  "medallon de pollo": {
    "jamon y queso": photo("medallon-pollo-jamon-queso", "Medallón de pollo con relleno de jamón y queso"),
    "queso cheddar": photo("medallon-pollo-cheddar", "Medallón de pollo con relleno de queso cheddar"),
  },
  "milanesa de merluza": {
    "finas hierbas": photo("milanesa-merluza-hierbas", "Milanesa de merluza con finas hierbas en el rebozado"),
  },
  "medallon de merluza": {
    "espinaca y queso": photo("medallon-merluza-espinaca", "Medallón de merluza relleno de espinaca y queso"),
  },
  "empanadas": {
    "carne": photo("empanadas-carne", "Empanadas con relleno de carne visible"),
    "jamon y queso": photo("empanadas-jamon-queso", "Empanadas con relleno de jamón y queso visible"),
  },
  "medialunas": {
    "manteca": photo("medialunas-manteca", "Medialunas de manteca doradas y hojaldradas"),
  },
  "rollito de pollo": {
    "jamon y queso": photo("rollito-pollo-jamon-queso", "Rollito de pollo en rodajas con espiral de jamón y queso"),
  },
};
export function getProductPhoto(name: string, variety = ""): ProductPhoto | undefined {
  const key = normalize(name);
  const variants = Object.hasOwn(varietyPhotos, key) ? varietyPhotos[key] : undefined;
  if (variants) {
    const filling = normalize(variety);
    return Object.hasOwn(variants, filling) ? variants[filling] : undefined;
  }
  return Object.hasOwn(plainPhotos, key) ? plainPhotos[key] : undefined;
}
