"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { mylarBagSizes, getMylarPricing } from "@/lib/mylarPricing";
import styles from "./mylar-maker.module.css";

export default function MylarMakerPage() {
  const router = useRouter();
  const { addItem } = useCart();

  const [showAlert, setShowAlert] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(16);

  const selectedSizeInfo = useMemo(
    () => mylarBagSizes.find((size) => size.id === selectedSize),
    [selectedSize],
  );

  const currentPricing = useMemo(() => {
    if (!selectedSize) return { unitPrice: 0, subtotal: 0, qty: 0 };
    return getMylarPricing(selectedSize, quantity);
  }, [selectedSize, quantity]);

  const canPlaceOrder = !!selectedSizeInfo && Number.isSafeInteger(quantity) && quantity >= (selectedSizeInfo.tiers[0]?.qty || 1) && quantity <= 10000;

  const getMinQuantity = () => {
    if (!selectedSizeInfo) return 1;
    return selectedSizeInfo.tiers[0]?.qty || 1;
  };

  const getLastApplicableTier = () => {
    if (!selectedSizeInfo) return null;
    const sortedTiers = [...selectedSizeInfo.tiers].sort((a, b) => b.qty - a.qty);
    for (const tier of sortedTiers) {
      if (quantity >= tier.qty) return tier;
    }
    return selectedSizeInfo.tiers[0];
  };

  const getNextTier = (currentTier: { qty: number }) => {
    if (!selectedSizeInfo) return null;
    const currentIndex = selectedSizeInfo.tiers.findIndex((t) => t.qty === currentTier.qty);
    return selectedSizeInfo.tiers[currentIndex + 1] || null;
  };

  const resetForm = () => {
    setSelectedSize(null);
    setQuantity(16);
  };

  const addToCart = async () => {
    if (!canPlaceOrder || !selectedSizeInfo) return;
    await addItem({
      productType: "mylar",
      size: { ...selectedSizeInfo, basePrice: currentPricing.unitPrice },
      quantity,
      previewUrl: null,
    });
    setShowAlert(true);
    setTimeout(() => setShowAlert(false), 3000);
    resetForm();
  };

  const orderNow = async () => {
    if (!canPlaceOrder) return;
    await addToCart();
    router.push("/cart");
  };

  const minQty = getMinQuantity();

  return (
    <div className={styles["mylar-page"]}>
      {showAlert && (
        <div className={styles["success-alert"]}>
          <div className={styles["alert-content"]}>
            <span className={styles["alert-icon"]}>✓</span>
            <span className={styles["alert-message"]}>Mylar bags added to cart successfully!</span>
          </div>
        </div>
      )}

      <section className={styles.hero}>
        <div className={styles.container}>
          <h1>Custom Mylar Bags</h1>
          <p>Professional mylar bags for your packaging needs. Select your size and quantity below.</p>
        </div>
      </section>

      <section className={styles.customization}>
        <div className={styles.container}>
          <h2>Customize Your Order</h2>
          <div className={styles["customization-form"]}>
            <div className={styles["form-section"]}>
              <div className={styles["design-disclaimer"]}>
                <div className={styles["disclaimer-icon"]}>📧</div>
                <div className={styles["disclaimer-content"]}>
                  <h3>Design Communication</h3>
                  <p>
                    After placing your order, our design team will contact you via email to discuss your custom design requirements and specifications. We&apos;ll work with you to create the perfect mylar bag design for your needs.
                  </p>
                </div>
              </div>
            </div>

            <div className={styles["form-section"]}>
              <h3>Bag Size</h3>
              <div className={styles["size-grid"]}>
                {mylarBagSizes.map((size) => (
                  <div
                    key={size.id}
                    className={`${styles["size-option"]} ${selectedSize === size.id ? styles.active : ""}`}
                    onClick={() => setSelectedSize(size.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && setSelectedSize(size.id)}
                  >
                    <div className={styles["size-visual"]}>
                      <div className={styles["size-bag"]} style={{ width: size.width, height: size.height }} />
                    </div>
                    <div className={styles["size-info"]}>
                      <h4>{size.name}</h4>
                      <p>{size.dimensions}</p>
                      <span className={styles["size-price"]}>Starting at ${size.basePrice.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles["form-section"]}>
              <h3>Quantity</h3>
              <div className={styles["quantity-selector"]}>
                <button type="button" onClick={() => quantity > minQty && setQuantity(quantity - 1)} disabled={quantity <= minQty}>-</button>
                <input type="number" value={quantity} min={minQty} max={10000} onChange={(e) => setQuantity(Number(e.target.value))} onBlur={() => setQuantity(Math.min(10000, Math.max(minQty, Math.floor(quantity) || minQty)))} />
                <button type="button" onClick={() => setQuantity(quantity + 1)} disabled={quantity >= 10000}>+</button>
              </div>
              {selectedSizeInfo && (
                <div className={styles["quantity-tiers"]}>
                  {selectedSizeInfo.tiers.map((tier) => {
                    const nextTier = getNextTier(tier);
                    const lastTier = getLastApplicableTier();
                    const isActive =
                      quantity >= tier.qty &&
                      (tier === lastTier || (nextTier && quantity < nextTier.qty));
                    return (
                      <div
                        key={tier.qty}
                        className={`${styles["tier-option"]} ${isActive ? styles.active : ""}`}
                        onClick={() => setQuantity(tier.qty)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === "Enter" && setQuantity(tier.qty)}
                      >
                        <span className={styles["tier-range"]}>
                          {tier.qty}{nextTier ? `-${nextTier.qty - 1}` : "+"}
                        </span>
                        <span className={styles["tier-price"]}>${tier.unitPrice.toFixed(2)} each</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className={styles["form-section"]}>
              <h3>Order Summary</h3>
              <div className={styles["order-summary"]}>
                <div className={styles["summary-row"]}>
                  <span>Size:</span>
                  <span>{selectedSizeInfo?.name || "Select size"}</span>
                </div>
                <div className={styles["summary-row"]}>
                  <span>Quantity:</span>
                  <span>{quantity} bags</span>
                </div>
                <div className={styles["summary-row"]}>
                  <span>Unit Price:</span>
                  <span>${currentPricing.unitPrice.toFixed(2)} each</span>
                </div>
                <div className={`${styles["summary-row"]} ${styles.total}`}>
                  <span>Total:</span>
                  <span>${currentPricing.subtotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className={styles["action-buttons"]}>
              <button type="button" className={styles["add-to-cart-btn"]} disabled={!canPlaceOrder} onClick={addToCart}>
                Add to Cart
              </button>
              <button type="button" className={styles["order-now-btn"]} disabled={!canPlaceOrder} onClick={orderNow}>
                Order Now
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
