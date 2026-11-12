// Existing shipping and estimated-tax settings. Changing fulfillment/tax policy
// is a separate release; Pirate Ship does not offer a checkout-rate API.
export const FREE_SHIPPING_SUBTOTAL = 150;
export const FLAT_SHIPPING = 8.5;
export const ESTIMATED_TAX_RATE = 0.06;
export function roundMoney(value: number) { return Math.round(value * 100) / 100; }
export function checkoutTotals(subtotal: number, itemCount: number) {
  const shipping = itemCount && subtotal < FREE_SHIPPING_SUBTOTAL ? FLAT_SHIPPING : 0;
  const tax = roundMoney(subtotal * ESTIMATED_TAX_RATE);
  return { subtotal, shipping, tax, total: roundMoney(subtotal + shipping + tax) };
}
