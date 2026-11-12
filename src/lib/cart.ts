"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getStickerPricing } from "./pricing";
import { getMylarPricing, mylarBagSizes } from "./mylarPricing";
import { stickerQuantity } from "./sticker-pricing";
import { checkoutTotals } from "./order-totals";

const STORAGE_KEY = "elevate_cart_v1";

export interface CartSize {
  id?: string;
  wIn?: number;
  hIn?: number;
  label?: string;
  name?: string;
  dimensions?: string;
  basePrice?: number;
  width?: number;
  height?: number;
}

export interface CartItem {
  id: string;
  productType: "sticker" | "mylar";
  size: CartSize | string;
  quantity: number;
  designFileId?: string | null | File;
  previewUrl?: string | null;
  unitPrice: number;
  subtotal: number;
  shape?: string | null;
  material?: string;
  frontDesign?: unknown;
  backDesign?: unknown;
}

export interface AddItemParams {
  productType?: "sticker" | "mylar";
  size: CartSize | string;
  material?: string;
  quantity: number;
  shape?: string | null;
  designFileId?: string | null | File;
  previewUrl?: string | null;
  frontDesign?: unknown;
  backDesign?: unknown;
}

interface CartStore {
  items: CartItem[];
  currency: string;
  addItem: (params: AddItemParams) => Promise<string>;
  updateQuantity: (id: string, quantity: number) => Promise<void>;
  refreshPrices: () => Promise<void>;
  removeItem: (id: string) => void;
  clear: () => void;
}

async function priceItem(productType: "sticker" | "mylar", size: CartSize | string, quantity: number) {
  if (productType === "sticker") return getStickerPricing(size, quantity);
  const sizeData = mylarBagSizes.find((entry) => typeof size === "object" && entry.id === size.id);
  if (!sizeData) throw new Error("Choose a valid bag size.");
  return getMylarPricing(sizeData.id, Math.max(stickerQuantity(quantity), sizeData.tiers[0].qty));
}

function roundCurrency(n: number): number {
  return Math.round(n * 100) / 100;
}

function cryptoRandom(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "id-" + Math.random().toString(36).slice(2);
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      currency: "USD",

      addItem: async ({
        productType = "sticker",
        size,
        material,
        quantity,
        shape = null,
        designFileId = null,
        previewUrl = null,
        frontDesign = null,
        backDesign = null,
      }) => {
        const price = await priceItem(productType, size, quantity);

        const id = cryptoRandom();
        const item: CartItem = {
          id,
          productType,
          size,
          quantity: price.qty,
          designFileId,
          previewUrl,
          unitPrice: price.unitPrice,
          subtotal: price.subtotal,
          shape,
        };

        if (productType === "mylar") {
          item.frontDesign = frontDesign;
          item.backDesign = backDesign;
        } else {
          item.material = material;
        }

        set({ items: [...get().items, item] });
        return id;
      },

      updateQuantity: async (id, quantity) => {
        const item = get().items.find((entry) => entry.id === id);
        if (!item) return;
        const price = await priceItem(item.productType, item.size, quantity);
        set((state) => ({ items: state.items.map((entry) => entry.id === id ? { ...entry, quantity: price.qty, unitPrice: price.unitPrice, subtotal: price.subtotal } : entry) }));
      },

      refreshPrices: async () => {
        const snapshot = get().items;
        const prices = await Promise.all(snapshot.map(async (item) => ({ id: item.id, previousQty: item.quantity, price: await priceItem(item.productType, item.size, item.quantity) })));
        set((state) => ({ items: state.items.map((item) => {
          const updated = prices.find((entry) => entry.id === item.id && entry.previousQty === item.quantity);
          return updated ? { ...item, quantity: updated.price.qty, unitPrice: updated.price.unitPrice, subtotal: updated.price.subtotal } : item;
        }) }));
      },

      removeItem: (id) => {
        set({ items: get().items.filter((i) => i.id !== id) });
      },

      clear: () => {
        set({ items: [] });
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        items: state.items,
        currency: state.currency,
      }),
    },
  ),
);

export function useCart() {
  const items = useCartStore((s) => s.items);
  const currency = useCartStore((s) => s.currency);
  const addItem = useCartStore((s) => s.addItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const refreshPrices = useCartStore((s) => s.refreshPrices);
  const removeItem = useCartStore((s) => s.removeItem);
  const clear = useCartStore((s) => s.clear);

  const totalQty = useMemo(
    () => items.reduce((a, i) => a + i.quantity, 0),
    [items],
  );

  const subtotal = useMemo(
    () => roundCurrency(items.reduce((a, i) => a + i.subtotal, 0)),
    [items],
  );

  const { shipping, tax, total } = checkoutTotals(subtotal, items.length);

  return {
    state: { items, currency },
    addItem,
    updateQuantity,
    refreshPrices,
    removeItem,
    clear,
    totalQty,
    subtotal,
    tax,
    shipping,
    total,
  };
}
