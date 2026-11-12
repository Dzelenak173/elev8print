import { getMylarPricing, mylarBagSizes } from "./mylarPricing";
import { parseStickerSize, PricingInputError, stickerQuantity } from "./sticker-pricing";
import { getServerStickerPricing } from "./sticker-pricing-server";
import { checkoutTotals, roundMoney } from "./order-totals";

const MATERIALS = new Set(["matte", "holographic", "clear", "window-perf", "heat-transfer", "wall-stickers"]);
const SHAPES = new Set(["contour", "circle", "square", "round-corners", "sheet"]);
type InputItem = Record<string, unknown>;

export async function quoteOrder(input: unknown) {
  if (!Array.isArray(input) || !input.length || input.length > 100) throw new PricingInputError("Choose between 1 and 100 order items.");
  const items = await Promise.all(input.map(async (value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new PricingInputError("Invalid order item.");
    const item = value as InputItem;
    const qty = stickerQuantity(item.quantity as number);
    if (typeof item.quantity !== "number") throw new PricingInputError("Invalid item quantity.");
    if (item.productType === "mylar") {
      const sizeId = item.size && typeof item.size === "object" ? (item.size as Record<string, unknown>).id : undefined;
      const size = mylarBagSizes.find((entry) => entry.id === sizeId);
      if (!size || qty < size.tiers[0].qty) throw new PricingInputError("Choose a valid bag size and its minimum quantity.");
      const price = getMylarPricing(size.id, qty);
      return { ...item, size: { ...size }, quantity: price.qty, unitPrice: price.unitPrice, subtotal: price.subtotal };
    }
    if (item.productType !== "sticker" || !MATERIALS.has(String(item.material)) || !SHAPES.has(String(item.shape))) throw new PricingInputError("Choose a valid sticker material and shape.");
    const size = parseStickerSize(item.size as Parameters<typeof parseStickerSize>[0]);
    const price = await getServerStickerPricing(item.size as Parameters<typeof parseStickerSize>[0], qty);
    if (price.qty !== qty) throw new PricingInputError(`The minimum quantity for this sticker size is ${price.qty}. Update your cart.`);
    return { ...item, size: { wIn: size.width, hIn: size.height, label: size.key }, quantity: price.qty, unitPrice: price.unitPrice, subtotal: price.subtotal };
  }));
  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.subtotal, 0));
  return { items, ...checkoutTotals(subtotal, items.length) };
}

export function orderMatchesQuote(items: InputItem[], total: unknown, quote: Awaited<ReturnType<typeof quoteOrder>>) {
  return typeof total === "number" && Number.isFinite(total) && Math.abs(total - quote.total) < 0.00001 && items.every((item, index) =>
    typeof item.subtotal === "number" && Math.abs(item.subtotal - quote.items[index].subtotal) < 0.00001 &&
    typeof item.unitPrice === "number" && Math.abs(item.unitPrice - quote.items[index].unitPrice) < 0.00001);
}
