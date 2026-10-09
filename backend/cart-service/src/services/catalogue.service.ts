// =====================================================================
// [FIX VULN-04] Server-side catalogue lookup for cart-service.
//
// WAS: cart accepted `price` and `name` from the client and stored them
// verbatim -> price tampering (EV-C2, TC-BB-057/058).
//
// FIX: the cart re-fetches the authoritative product record (price/name/
// image) from the menu/catalogue service and never trusts a client-supplied
// price. If the product is unknown or the lookup fails, the add is rejected.
//
// NOTE: `axios` is already a declared dependency of cart-service.
// =====================================================================
import axios from 'axios';

export interface CatalogueProduct {
  productId: string;
  name: string;
  price: number;
  image_url?: string;
}

const MENU_SERVICE_URL = process.env.MENU_SERVICE_URL || 'http://localhost:3001';

export const getProductById = async (productId: string): Promise<CatalogueProduct | null> => {
  if (typeof productId !== 'string' || !productId) return null;

  try {
    const { data } = await axios.get(`${MENU_SERVICE_URL}/api/menu-items/${productId}`);
    if (!data || typeof data.price !== 'number') return null;
    return {
      productId,
      name: data.name ?? 'Unknown product',
      price: data.price,
      image_url: data.image_url,
    };
  } catch {
    return null; // fail closed: never fall back to a client-supplied price
  }
};