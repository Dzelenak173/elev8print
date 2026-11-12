import stickerPricing, { STICKER_PRICE_VERSION } from "./stickerPricingData";

export interface PricingResult {
  unitPrice: number;
  subtotal: number;
  qty: number;
  applied?: Record<string, unknown>;
}
export type SizeInput = string | { label?: string; wIn?: number; hIn?: number } | null | undefined;
export class PricingInputError extends Error {}

export function stickerQuantity(input: number | string): number {
  const qty = typeof input === "string" && input.trim() ? Number(input) : input;
  if (typeof qty !== "number" || !Number.isSafeInteger(qty) || qty < 1 || qty > 10000) {
    throw new PricingInputError("Choose a whole-number quantity between 1 and 10,000.");
  }
  return qty;
}

export function parseStickerSize(input: SizeInput) {
  let width: number, height: number;
  if (input && typeof input === "object" && (input.wIn !== undefined || input.hIn !== undefined)) {
    width = input.wIn as number;
    height = input.hIn as number;
  } else {
    const label = typeof input === "string" ? input : input?.label;
    const normalized = String(label || "").toLowerCase().replace(/[×✕]/g, "x").replace(/["'\s]/g, "");
    const match = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/.exec(normalized);
    width = match ? Number(match[1]) : NaN;
    height = match ? Number(match[2]) : NaN;
  }
  if (typeof width !== "number" || typeof height !== "number" || !Number.isFinite(width) || !Number.isFinite(height) || width < 0.5 || height < 0.5 || width > 52 || height > 240) {
    throw new PricingInputError("Choose a width from 0.5 to 52 inches and a height from 0.5 to 240 inches.");
  }
  return { width, height, key: `${width}x${height}` };
}

export function getStickerMinimum(input: SizeInput): number {
  const { key } = parseStickerSize(input);
  return stickerPricing.find((size) => size.size === key)?.minOrder.qty || 25;
}

export function getLocalStickerPricing(input: SizeInput, qtyInput: number | string): PricingResult | undefined {
  const { key } = parseStickerSize(input);
  const requested = stickerQuantity(qtyInput);
  const data = stickerPricing.find((size) => size.size === key);
  if (!data) return undefined;
  const qty = Math.max(requested, data.minOrder.qty);
  const points = [data.minOrder, ...data.tiers];
  let total = points.at(-1)!.price * qty / points.at(-1)!.qty;
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    if (qty === point.qty) { total = point.price; break; }
    if (qty < point.qty) {
      const previous = points[i - 1];
      total = previous.price + (point.price - previous.price) * (qty - previous.qty) / (point.qty - previous.qty);
      break;
    }
  }
  const subtotal = Math.round(total * 100) / 100;
  return { qty, subtotal, unitPrice: Math.round(subtotal / qty * 10000) / 10000, applied: { type: "elev8-price-table", version: STICKER_PRICE_VERSION } };
}
