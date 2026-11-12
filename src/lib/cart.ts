"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getStickerPricing } from "./pricing";
import { getMylarPricing, mylarBagSizes } from "./mylarPricing";
import { stickerQuantity } from "./sticker-pricing";
import { checkoutTotals } from "./order-totals";
import { artworkPreview, deleteCartArtwork, expectsArtwork, isArtworkFile, readCartArtwork, releaseArtworkPreview, saveCartArtwork } from "./cart-artwork";

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
  artworkId?: string | null;
  artworkName?: string | null;
  artworkExpected?: boolean;
  artworkMissing?: boolean;
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
  restoreArtwork: () => Promise<CartItem[]>;
  attachArtwork: (id: string, file: File) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  clear: () => Promise<void>;
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
        frontDesign = null,
        backDesign = null,
      }) => {
        const price = await priceItem(productType, size, quantity);

        const id = cryptoRandom();
        const file = isArtworkFile(designFileId) ? designFileId : null;
        if (file) await saveCartArtwork(id, file);
        const item: CartItem = {
          id,
          productType,
          size,
          quantity: price.qty,
          designFileId: file,
          previewUrl: file ? artworkPreview(file) : null,
          artworkId: file ? id : null,
          artworkName: file?.name || null,
          artworkExpected: Boolean(designFileId),
          artworkMissing: Boolean(designFileId) && !file,
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

      restoreArtwork: async () => {
        const restored = await Promise.all(get().items.map(async (item) => {
          if (item.productType !== "sticker") return null;
          if (isArtworkFile(item.designFileId) && item.artworkId) return null;
          const key = item.artworkId || item.id;
          let file = isArtworkFile(item.designFileId) ? item.designFileId : null;
          if (file) await saveCartArtwork(key, file);
          else if (item.artworkId) file = await readCartArtwork(item.artworkId);
          return { id: item.id, previousKey: item.artworkId, key, file, expected: expectsArtwork(item) };
        }));
        set((state) => ({ items: state.items.map((item) => {
          const result = restored.find((entry) => entry?.id === item.id && entry.previousKey === item.artworkId);
          if (!result) return item;
          releaseArtworkPreview(item.previewUrl);
          return { ...item, designFileId: result.file, previewUrl: result.file ? artworkPreview(result.file) : null,
            artworkId: result.file ? result.key : item.artworkId, artworkName: result.file?.name || item.artworkName,
            artworkExpected: result.expected, artworkMissing: result.expected && !result.file };
        }) }));
        return get().items;
      },

      attachArtwork: async (id, file) => {
        if (!get().items.some((item) => item.id === id)) return;
        // Each replacement gets a new key, so an older restore cannot overwrite it.
        const key = cryptoRandom();
        await saveCartArtwork(key, file);
        const item = get().items.find((entry) => entry.id === id);
        if (!item) { await deleteCartArtwork(key); return; }
        releaseArtworkPreview(item.previewUrl);
        set((state) => ({ items: state.items.map((entry) => entry.id === id ? {
          ...entry, designFileId: file, previewUrl: artworkPreview(file), artworkId: key,
          artworkName: file.name, artworkExpected: true, artworkMissing: false,
        } : entry) }));
        if (item.artworkId) void deleteCartArtwork(item.artworkId).catch(() => { /* A leftover local draft must not undo its replacement. */ });
      },

      removeItem: async (id) => {
        const item = get().items.find((entry) => entry.id === id);
        releaseArtworkPreview(item?.previewUrl);
        set({ items: get().items.filter((i) => i.id !== id) });
        if (item?.artworkId) await deleteCartArtwork(item.artworkId).catch(() => { /* The cart item is already removed. */ });
      },

      clear: async () => {
        const items = get().items;
        items.forEach((item) => releaseArtworkPreview(item.previewUrl));
        set({ items: [] });
        await Promise.all(items.map((item) => item.artworkId ? deleteCartArtwork(item.artworkId).catch(() => { /* Best-effort local draft cleanup. */ }) : undefined));
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        items: state.items.map(({ designFileId, previewUrl, artworkMissing, ...item }) => {
          void artworkMissing;
          return { ...item, artworkExpected: expectsArtwork({ ...item, designFileId, previewUrl }) };
        }),
        currency: state.currency,
      }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<CartStore> | undefined;
        return { ...current, currency: saved?.currency || current.currency,
          items: Array.isArray(saved?.items) ? saved.items.map((item) => ({
            ...item, designFileId: null, previewUrl: null,
            artworkExpected: expectsArtwork(item), artworkMissing: expectsArtwork(item),
          })) : current.items };
      },
    },
  ),
);

export function useCart() {
  const items = useCartStore((s) => s.items);
  const currency = useCartStore((s) => s.currency);
  const addItem = useCartStore((s) => s.addItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const refreshPrices = useCartStore((s) => s.refreshPrices);
  const restoreArtwork = useCartStore((s) => s.restoreArtwork);
  const attachArtwork = useCartStore((s) => s.attachArtwork);
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
    restoreArtwork,
    attachArtwork,
    removeItem,
    clear,
    totalQty,
    subtotal,
    tax,
    shipping,
    total,
  };
}
