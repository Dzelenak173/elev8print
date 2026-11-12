import type { CartItem } from "./cart";
import { expectsArtwork, isArtworkFile, validateArtwork } from "./cart-artwork";

export async function uploadCartArtwork(file: File, id: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", file, `${id}-${file.name}`);
  const response = await fetch("/api/orders/upload", { method: "POST", body: formData });
  const data = await response.json();
  if (!response.ok || typeof data.url !== "string" || !data.url) throw new Error(data.error || "Artwork upload failed.");
  return data.url;
}

export async function prepareCheckoutItems(items: CartItem[], upload: (file: File, id: string) => Promise<string>) {
  // Check the whole cart before uploading anything or creating an order.
  for (const item of items) {
    if (item.productType !== "sticker") continue;
    if (expectsArtwork(item) && !isArtworkFile(item.designFileId)) {
      throw new Error(`Attach the artwork again for ${item.artworkName || "your sticker design"} before placing this order.`);
    }
    if (isArtworkFile(item.designFileId)) validateArtwork(item.designFileId);
  }

  return Promise.all(items.map(async (item) => {
    const { artworkId, artworkName, artworkExpected, artworkMissing, designFileId, previewUrl, ...details } = item;
    void artworkId; void artworkName; void artworkExpected; void artworkMissing; void previewUrl;
    const designFileUrl = item.productType === "sticker" && isArtworkFile(designFileId)
      ? await upload(designFileId, item.id) : undefined;
    return { ...details, designFileId: null, previewUrl: null, ...(designFileUrl ? { designFileUrl } : {}) };
  }));
}
