import { getLocalStickerPricing, parseStickerSize, stickerQuantity, type SizeInput, type PricingResult } from "./sticker-pricing";

export type { PricingResult } from "./sticker-pricing";

export async function getStickerPricing(sizeInput: SizeInput, qtyInput: number | string): Promise<PricingResult> {
  const local = getLocalStickerPricing(sizeInput, qtyInput);
  if (local) return local;
  const { width, height } = parseStickerSize(sizeInput);
  const qty = stickerQuantity(qtyInput);
  const params = new URLSearchParams({ width: String(width), height: String(height), qty: String(qty) });
  const res = await fetch(`/api/pricing?${params}`, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Unable to calculate this price. Please try again.");
  if (!Number.isFinite(data.subtotal) || data.subtotal <= 0 || !Number.isFinite(data.unitPrice) || data.unitPrice <= 0 || !Number.isSafeInteger(data.qty) || data.qty < qty || data.qty > 10000) {
    throw new Error("Unable to calculate this price. Please try again.");
  }
  return data;
}
