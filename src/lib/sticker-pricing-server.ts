import { getLocalStickerPricing, getStickerMinimum, parseStickerSize, stickerQuantity, type SizeInput, type PricingResult } from "./sticker-pricing";

// Standard sizes use the reviewed Elev8 price snapshot. Custom dimensions keep
// the existing US white-vinyl/gloss benchmark until a custom price table exists.
export async function getServerStickerPricing(input: SizeInput, quantity: number | string): Promise<PricingResult> {
  const local = getLocalStickerPricing(input, quantity);
  if (local) return local;
  const { width, height } = parseStickerSize(input);
  const qty = Math.max(stickerQuantity(quantity), getStickerMinimum(input));
  const attributes = {
    delivery: "single", sheet_type: "single", laminate: "glossy_uv", material: "white", sheet_name: "path",
    quantity: qty, market: "us", imperial_units: true,
    width_mm: Math.round(width * 25.4), height_mm: Math.round(height * 25.4), size: `${width}" x ${height}"`,
  };
  const params = new URLSearchParams({ attributes: JSON.stringify(attributes), prices: "true", lang: "us", show_vat: "false" });
  const response = await fetch(`https://api.stickerapp.com/product/create_item/custom_sticker/die_cut?${params}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("Custom-size pricing is unavailable. Please try again.");
  const data = await response.json();
  const subtotal = data?.price?.total;
  const quotedQty = Number(data?.item?.attributes?.quantity);
  if (typeof subtotal !== "number" || !Number.isFinite(subtotal) || subtotal <= 0 || !Number.isSafeInteger(quotedQty) || quotedQty < qty || quotedQty > 10000) {
    throw new Error("Custom-size pricing is unavailable. Please try again.");
  }
  return { subtotal: Math.round(subtotal * 100) / 100, qty: quotedQty, unitPrice: Math.round(subtotal / quotedQty * 10000) / 10000, applied: { type: "custom-size-benchmark" } };
}
