export interface PricingTier {
  qty: number;
  price: number;
  discount: string;
  unitPrice: number;
}

export interface MinOrder {
  qty: number;
  price: number;
  unitPrice: number;
}

export interface StickerSizePricing {
  size: string;
  basedOn?: string;
  minOrder: MinOrder;
  tiers: PricingTier[];
}

// Snapshot of StickerApp US white-vinyl/gloss die-cut prices on 2026-11-12.
// Material choices are unchanged; this retains the existing size/quantity-based
// pricing policy without introducing material premiums. Review prices before release.
export const STICKER_PRICE_VERSION = "2026-11-12";

const stickerPricingData: StickerSizePricing[] = [
  {
    size: "2x2",
    minOrder: { qty: 29, price: 27, unitPrice: 0.931034 },
    tiers: [
      { qty: 50, price: 36, discount: "-23%", unitPrice: 0.720000 },
      { qty: 100, price: 52, discount: "-44%", unitPrice: 0.520000 },
      { qty: 200, price: 77, discount: "-59%", unitPrice: 0.385000 },
      { qty: 300, price: 97, discount: "-65%", unitPrice: 0.323333 },
      { qty: 500, price: 132, discount: "-72%", unitPrice: 0.264000 },
      { qty: 600, price: 147, discount: "-74%", unitPrice: 0.245000 },
      { qty: 900, price: 189, discount: "-77%", unitPrice: 0.210000 },
      { qty: 1200, price: 227, discount: "-80%", unitPrice: 0.189167 },
    ],
  },
  {
    size: "3x3",
    minOrder: { qty: 14, price: 27, unitPrice: 1.928571 },
    tiers: [
      { qty: 25, price: 37, discount: "-23%", unitPrice: 1.480000 },
      { qty: 50, price: 54, discount: "-44%", unitPrice: 1.080000 },
      { qty: 100, price: 80, discount: "-59%", unitPrice: 0.800000 },
      { qty: 200, price: 119, discount: "-69%", unitPrice: 0.595000 },
      { qty: 300, price: 152, discount: "-74%", unitPrice: 0.506667 },
      { qty: 500, price: 210, discount: "-78%", unitPrice: 0.420000 },
      { qty: 600, price: 236, discount: "-80%", unitPrice: 0.393333 },
      { qty: 900, price: 308, discount: "-82%", unitPrice: 0.342222 },
    ],
  },
  {
    size: "4x4",
    minOrder: { qty: 8, price: 27, unitPrice: 3.375000 },
    tiers: [
      { qty: 25, price: 50, discount: "-41%", unitPrice: 2.000000 },
      { qty: 50, price: 74, discount: "-56%", unitPrice: 1.480000 },
      { qty: 100, price: 110, discount: "-67%", unitPrice: 1.100000 },
      { qty: 200, price: 168, discount: "-75%", unitPrice: 0.840000 },
      { qty: 300, price: 217, discount: "-79%", unitPrice: 0.723333 },
      { qty: 500, price: 303, discount: "-82%", unitPrice: 0.606000 },
      { qty: 600, price: 342, discount: "-83%", unitPrice: 0.570000 },
      { qty: 900, price: 452, discount: "-85%", unitPrice: 0.502222 },
    ],
  },
  {
    size: "5x5",
    minOrder: { qty: 5, price: 26, unitPrice: 5.200000 },
    tiers: [
      { qty: 25, price: 63, discount: "-52%", unitPrice: 2.520000 },
      { qty: 50, price: 94, discount: "-64%", unitPrice: 1.880000 },
      { qty: 100, price: 142, discount: "-73%", unitPrice: 1.420000 },
      { qty: 200, price: 219, discount: "-79%", unitPrice: 1.095000 },
      { qty: 300, price: 286, discount: "-82%", unitPrice: 0.953333 },
      { qty: 500, price: 403, discount: "-85%", unitPrice: 0.806000 },
      { qty: 600, price: 458, discount: "-85%", unitPrice: 0.763333 },
      { qty: 900, price: 612, discount: "-87%", unitPrice: 0.680000 },
    ],
  },
  {
    size: "6x6",
    minOrder: { qty: 4, price: 28, unitPrice: 7.000000 },
    tiers: [
      { qty: 25, price: 77, discount: "-56%", unitPrice: 3.080000 },
      { qty: 50, price: 116, discount: "-67%", unitPrice: 2.320000 },
      { qty: 100, price: 176, discount: "-75%", unitPrice: 1.760000 },
      { qty: 200, price: 275, discount: "-80%", unitPrice: 1.375000 },
      { qty: 300, price: 361, discount: "-83%", unitPrice: 1.203333 },
      { qty: 500, price: 516, discount: "-85%", unitPrice: 1.032000 },
      { qty: 600, price: 588, discount: "-86%", unitPrice: 0.980000 },
      { qty: 900, price: 792, discount: "-87%", unitPrice: 0.880000 },
    ],
  },
  {
    size: "7x7",
    minOrder: { qty: 3, price: 29, unitPrice: 9.666667 },
    tiers: [
      { qty: 25, price: 92, discount: "-62%", unitPrice: 3.680000 },
      { qty: 50, price: 139, discount: "-71%", unitPrice: 2.780000 },
      { qty: 100, price: 214, discount: "-78%", unitPrice: 2.140000 },
      { qty: 200, price: 338, discount: "-83%", unitPrice: 1.690000 },
      { qty: 300, price: 447, discount: "-85%", unitPrice: 1.490000 },
      { qty: 500, price: 644, discount: "-87%", unitPrice: 1.288000 },
      { qty: 600, price: 737, discount: "-87%", unitPrice: 1.228333 },
      { qty: 900, price: 1001, discount: "-88%", unitPrice: 1.112222 },
    ],
  },
  {
    size: "8x8",
    minOrder: { qty: 2, price: 26, unitPrice: 13.000000 },
    tiers: [
      { qty: 25, price: 107, discount: "-67%", unitPrice: 4.280000 },
      { qty: 50, price: 163, discount: "-75%", unitPrice: 3.260000 },
      { qty: 100, price: 253, discount: "-81%", unitPrice: 2.530000 },
      { qty: 200, price: 403, discount: "-85%", unitPrice: 2.015000 },
      { qty: 300, price: 536, discount: "-86%", unitPrice: 1.786667 },
      { qty: 500, price: 779, discount: "-88%", unitPrice: 1.558000 },
      { qty: 600, price: 894, discount: "-89%", unitPrice: 1.490000 },
      { qty: 900, price: 1222, discount: "-90%", unitPrice: 1.357778 },
    ],
  },
  {
    size: "9x9",
    minOrder: { qty: 2, price: 30, unitPrice: 15.000000 },
    tiers: [
      { qty: 25, price: 123, discount: "-67%", unitPrice: 4.920000 },
      { qty: 50, price: 189, discount: "-75%", unitPrice: 3.780000 },
      { qty: 100, price: 296, discount: "-80%", unitPrice: 2.960000 },
      { qty: 200, price: 476, discount: "-84%", unitPrice: 2.380000 },
      { qty: 300, price: 636, discount: "-86%", unitPrice: 2.120000 },
      { qty: 500, price: 931, discount: "-88%", unitPrice: 1.862000 },
      { qty: 600, price: 1071, discount: "-88%", unitPrice: 1.785000 },
      { qty: 900, price: 1474, discount: "-89%", unitPrice: 1.637778 },
    ],
  },
  {
    size: "10x10",
    minOrder: { qty: 2, price: 33, unitPrice: 16.500000 },
    tiers: [
      { qty: 25, price: 140, discount: "-66%", unitPrice: 5.600000 },
      { qty: 50, price: 215, discount: "-74%", unitPrice: 4.300000 },
      { qty: 100, price: 339, discount: "-79%", unitPrice: 3.390000 },
      { qty: 200, price: 550, discount: "-83%", unitPrice: 2.750000 },
      { qty: 300, price: 739, discount: "-85%", unitPrice: 2.463333 },
      { qty: 500, price: 1089, discount: "-87%", unitPrice: 2.178000 },
      { qty: 600, price: 1256, discount: "-87%", unitPrice: 2.093333 },
      { qty: 900, price: 1736, discount: "-88%", unitPrice: 1.928889 },
    ],
  },
];

export default stickerPricingData;
