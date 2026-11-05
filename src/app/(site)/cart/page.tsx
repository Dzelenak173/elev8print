"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart, type CartItem, type CartSize } from "@/lib/cart";
import { supabase } from "@/lib/supabase";
import { TERMS_VERSION } from "@/lib/terms";
import styles from "./cart.module.css";

const SHAPES = [
  { id: "contour", name: "Contour cut" },
  { id: "circle", name: "Circle" },
  { id: "square", name: "Square" },
  { id: "round-corners", name: "Round corners" },
  { id: "sheet", name: "Sheet" },
];

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

function getItemTitle(item: CartItem) {
  if (item.productType === "sticker") return "Custom Stickers";
  if (item.productType === "mylar") return "Custom Mylar Bags";
  return "Custom Item";
}

function getSizeLabel(size: CartSize | string) {
  if (typeof size === "object" && size !== null) {
    if (size.label) return size.label;
    if (size.wIn && size.hIn) return `${size.wIn}" × ${size.hIn}"`;
    if ("name" in size && "dimensions" in size) {
      const s = size as CartSize & { name?: string; dimensions?: string };
      if (s.name && s.dimensions) return `${s.name} (${s.dimensions})`;
    }
  }
  return "Custom Size";
}

function getShapeName(shapeId: string | null | undefined) {
  const shape = SHAPES.find((s) => s.id === shapeId);
  return shape ? shape.name : "Square";
}

export default function CartPage() {
  const router = useRouter();
  const cart = useCart();

  const [updating, setUpdating] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutData, setCheckoutData] = useState({
    email: "",
    name: "",
    phone: "",
    street: "",
    city: "",
    state: "",
    zipCode: "",
    notes: "",
  });

  const cartItems = cart.state.items;

  const updateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1 || updating) return;
    setUpdating(true);
    try {
      await cart.updateQuantity(itemId, newQuantity);
    } catch {
      alert("Failed to update quantity. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  const removeItem = (itemId: string) => {
    if (updating) return;
    setUpdating(true);
    try {
      cart.removeItem(itemId);
    } finally {
      setUpdating(false);
    }
  };

  const closeCheckoutModal = () => {
    if (submittingOrder) return;
    setShowCheckoutModal(false);
    setTermsAccepted(false);
    setRightsConfirmed(false);
    setCheckoutError("");
    setCheckoutData({ email: "", name: "", phone: "", street: "", city: "", state: "", zipCode: "", notes: "" });
  };

  const uploadStickerFile = async (file: File, id: string) => {
    const formData = new FormData();
    formData.append("file", file, `${id}-${file.name}`);
    const res = await fetch("/api/orders/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok || !data.url) throw new Error(data.error || "Artwork upload failed.");
    return data.url as string;
  };

  const submitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cartItems.length) return;
    setCheckoutError("");
    if (!termsAccepted || !rightsConfirmed) { setCheckoutError("Please accept the terms and confirm your artwork rights."); return; }

    setSubmittingOrder(true);
    try {
      const processedItems = [];
      for (const item of cartItems) {
        const designFile = item.designFileId;
        if (item.productType === "sticker" && designFile instanceof File) {
          const url = await uploadStickerFile(designFile, item.id);
          processedItems.push({
            ...item,
            designFileUrl: url,
            previewUrl: null,
            designFileId: null,
          });
        } else {
          processedItems.push({ ...item, previewUrl: null, designFileId: null });
        }
      }

      const { data: { user } } = await supabase.auth.getUser();
      const orderPayload = {
        customer: checkoutData,
        items: processedItems,
        total: cart.total,
        user_id: user ? user.id : null,
        acceptance: { termsAccepted, rightsConfirmed, termsVersion: TERMS_VERSION },
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Unable to place the order. Please try again.");

      if (data.success) {
        cart.clear();
        router.push(`/track/${data.order.track_id}`);
      }
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Unable to place the order. Please try again.");
    } finally {
      setSubmittingOrder(false);
    }
  };

  return (
    <div className={styles["cart-page"]}>
      <div className={styles.container}>
        <div className={styles["cart-header"]}>
          <h1>Shopping Cart</h1>
          {cartItems.length === 0 ? (
            <p>Your cart is empty</p>
          ) : (
            <p>{cartItems.length} item{cartItems.length > 1 ? "s" : ""} in your cart</p>
          )}
        </div>

        {cartItems.length === 0 ? (
          <div className={styles["empty-cart"]}>
            <div className={styles["empty-icon"]}>🛒</div>
            <h2>Your cart is empty</h2>
            <p>Add some items to get started!</p>
            <div className={styles["empty-actions"]}>
              <Link href="/sticker-maker" className={`${styles.btn} ${styles.primary}`}>Create Custom Stickers</Link>
              <Link href="/mylar-maker" className={`${styles.btn} ${styles.secondary}`}>Design Mylar Bags</Link>
            </div>
          </div>
        ) : (
          <div className={styles["cart-content"]}>
            <div className={styles["cart-items"]}>
              {cartItems.map((item) => (
                <div key={item.id} className={styles["cart-item"]}>
                  <div className={styles["item-image"]}>
                    {item.productType === "mylar" ? (
                      <div className={styles["mylar-preview"]}>
                        <div className={styles["mylar-bag"]} />
                      </div>
                    ) : (
                      <div className={`${styles["sticker-preview"]} ${styles.square}`}>
                        {item.previewUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.previewUrl} alt="Sticker design" width="100%" />
                        ) : (
                          <div className={styles.placeholder}>{item.productType}</div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className={styles["item-details"]}>
                    <h3>{getItemTitle(item)}</h3>
                    <div className={styles["item-specs"]}>
                      <span>
                        {getSizeLabel(item.size)}{item.material ? ` • ${item.material}` : ""}
                      </span>
                      {item.productType === "sticker" && item.shape && (
                        <span className={styles["item-shape"]}>Shape: {getShapeName(item.shape)}</span>
                      )}
                    </div>
                  </div>
                  <div className={styles["item-quantity"]}>
                    <button type="button" onClick={() => updateQuantity(item.id, item.quantity - 1)} disabled={item.quantity <= 1 || updating}>-</button>
                    <span>{item.quantity}</span>
                    <button type="button" onClick={() => updateQuantity(item.id, item.quantity + 1)} disabled={updating}>+</button>
                  </div>
                  <div className={styles["item-price"]}>
                    <span className={styles.price}>${item.subtotal}</span>
                    <span className={styles["unit-price"]}>${item.unitPrice} each</span>
                  </div>
                  <button type="button" className={styles["remove-item"]} onClick={() => removeItem(item.id)} disabled={updating}>×</button>
                </div>
              ))}
            </div>

            <div className={styles["cart-summary"]}>
              <div className={styles["summary-card"]}>
                <h3>Order Summary</h3>
                <div className={styles["summary-row"]}>
                  <span>Subtotal ({cart.totalQty} items)</span>
                  <span>${cart.subtotal}</span>
                </div>
                <div className={styles["summary-row"]}>
                  <span>Shipping</span>
                  <span>{cart.shipping === 0 ? "Free" : `$${cart.shipping}`}</span>
                </div>
                <div className={styles["summary-row"]}>
                  <span>Tax (estimated)</span>
                  <span>${cart.tax}</span>
                </div>
                <div className={`${styles["summary-row"]} ${styles.total}`}>
                  <span><strong>Total</strong></span>
                  <span><strong>${cart.total}</strong></span>
                </div>
                {cart.shipping > 0 && (
                  <div className={styles["shipping-notice"]}>
                    <p>Add ${(50 - cart.subtotal).toFixed(2)} more for free shipping!</p>
                  </div>
                )}
                <div className={styles["checkout-actions"]}>
                  <button type="button" className={`${styles.btn} ${styles.primary} ${styles["checkout-btn"]}`} onClick={() => setShowCheckoutModal(true)} disabled={updating}>
                    Proceed to Checkout
                  </button>
                  <Link href="/sticker-maker" className={`${styles.btn} ${styles.secondary}`}>Continue Shopping</Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {showCheckoutModal && (
          <div className={styles["modal-overlay"]} onClick={closeCheckoutModal}>
            <div className={styles["modal-content"]} onClick={(e) => e.stopPropagation()}>
              <div className={styles["modal-header"]}>
                <h3>Checkout</h3>
                <button type="button" onClick={closeCheckoutModal} className={styles["close-btn"]}>&times;</button>
              </div>
              <div className={styles["modal-body"]}>
                <form onSubmit={submitOrder} className={styles["checkout-form"]}>
                  <div className={styles["form-section"]}>
                    <h4>Contact Information</h4>
                    <div className={styles["form-group"]}>
                      <label htmlFor="name">Full Name *</label>
                      <input id="name" value={checkoutData.name} onChange={(e) => setCheckoutData({ ...checkoutData, name: e.target.value })} required />
                    </div>
                    <div className={styles["form-group"]}>
                      <label htmlFor="email">Email Address *</label>
                      <input id="email" type="email" value={checkoutData.email} onChange={(e) => setCheckoutData({ ...checkoutData, email: e.target.value })} required />
                    </div>
                    <div className={styles["form-group"]}>
                      <label htmlFor="phone">Phone Number *</label>
                      <input id="phone" type="tel" value={checkoutData.phone} onChange={(e) => setCheckoutData({ ...checkoutData, phone: e.target.value })} required />
                    </div>
                  </div>

                  <div className={styles["form-section"]}>
                    <h4>Shipping Address</h4>
                    <div className={styles["form-row"]}>
                      <div className={styles["form-group"]}>
                        <label htmlFor="street">Street Address *</label>
                        <input id="street" value={checkoutData.street} onChange={(e) => setCheckoutData({ ...checkoutData, street: e.target.value })} required />
                      </div>
                      <div className={styles["form-group"]}>
                        <label htmlFor="city">City *</label>
                        <input id="city" value={checkoutData.city} onChange={(e) => setCheckoutData({ ...checkoutData, city: e.target.value })} required />
                      </div>
                      <div className={styles["form-group"]}>
                        <label htmlFor="state">State *</label>
                        <select id="state" value={checkoutData.state} onChange={(e) => setCheckoutData({ ...checkoutData, state: e.target.value })} required>
                          <option value="">Select State</option>
                          {US_STATES.map((st) => (
                            <option key={st} value={st}>{st}</option>
                          ))}
                        </select>
                      </div>
                      <div className={styles["form-group"]}>
                        <label htmlFor="zipCode">ZIP Code *</label>
                        <input id="zipCode" value={checkoutData.zipCode} onChange={(e) => setCheckoutData({ ...checkoutData, zipCode: e.target.value })} pattern="[0-9]{5}(-[0-9]{4})?" required />
                      </div>
                    </div>
                  </div>

                  <div className={styles["form-section"]}>
                    <h4>Order Notes</h4>
                    <div className={styles["form-group"]}>
                      <label htmlFor="notes">Special Instructions (Optional)</label>
                      <textarea id="notes" rows={3} value={checkoutData.notes} onChange={(e) => setCheckoutData({ ...checkoutData, notes: e.target.value })} />
                    </div>
                  </div>

                  <div className={styles["order-preview"]}>
                    <h4>Order Summary</h4>
                    <div className={styles["preview-items"]}>
                      {cartItems.map((item) => (
                        <div key={item.id} className={styles["preview-item"]}>
                          <div className={styles["preview-item-image"]}>
                            {item.productType === "mylar" ? (
                              <div className={styles["mini-mylar-preview"]}>
                                <div className={styles["mini-mylar-bag"]} />
                              </div>
                            ) : (
                              <div className={`${styles["mini-sticker-preview"]} ${styles.square}`}>
                                {item.previewUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={item.previewUrl} alt="Design preview" />
                                ) : (
                                  <div className={styles["mini-placeholder"]}>{item.productType}</div>
                                )}
                              </div>
                            )}
                          </div>
                          <div className={styles["preview-item-details"]}>
                            <span className={styles["preview-item-name"]}>{getItemTitle(item)}</span>
                            <span className={styles["preview-item-specs"]}>{getSizeLabel(item.size)}</span>
                            {item.productType === "sticker" && item.shape && (
                              <span className={styles["preview-item-shape"]}>Shape: {getShapeName(item.shape)}</span>
                            )}
                          </div>
                          <div className={styles["preview-item-quantity"]}>×{item.quantity}</div>
                          <div className={styles["preview-item-price"]}>${item.subtotal}</div>
                        </div>
                      ))}
                    </div>
                    <div className={styles["preview-subtotal"]}>
                      <div className={styles["preview-row"]}>
                        <span>Subtotal ({cart.totalQty} items)</span>
                        <span>${cart.subtotal}</span>
                      </div>
                      <div className={styles["preview-row"]}>
                        <span>Shipping</span>
                        <span>{cart.shipping === 0 ? "Free" : `$${cart.shipping}`}</span>
                      </div>
                      <div className={styles["preview-row"]}>
                        <span>Tax (estimated)</span>
                        <span>${cart.tax}</span>
                      </div>
                    </div>
                  </div>

                  <div className={styles["order-total"]}>
                    <strong>Total: ${cart.total}</strong>
                  </div>

                  <fieldset className={styles["consent-box"]}>
                    <legend>Artwork rights and terms</legend>
                    <label><input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} required /> <span>I have read and agree to the <Link href="/tos" target="_blank" rel="noopener noreferrer">Terms of Service</Link> (version {TERMS_VERSION}).</span></label>
                    <label><input type="checkbox" checked={rightsConfirmed} onChange={e => setRightsConfirmed(e.target.checked)} required /> <span>I own the artwork or have the necessary permission for its intended printing and use, and I am authorized to submit it. I can provide supporting permission if requested.</span></label>
                    <p>Placing this order does not approve artwork for printing. You will review and approve the final proof separately. Changes require a new approval.</p>
                  </fieldset>
                  {checkoutError && <p role="alert" className={styles["checkout-error"]}>{checkoutError}</p>}
                  <button type="submit" className={`${styles.btn} ${styles.primary}`} disabled={submittingOrder || !termsAccepted || !rightsConfirmed}>
                    {submittingOrder ? "Placing Order..." : "Place Order"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
