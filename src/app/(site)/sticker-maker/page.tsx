"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { getStickerPricing, type PricingResult } from "@/lib/pricing";
import { getStickerMinimum } from "@/lib/sticker-pricing";
import { ARTWORK_ACCEPT, artworkPreview, releaseArtworkPreview, validateArtwork } from "@/lib/cart-artwork";
import styles from "./sticker-maker.module.css";

const SHAPES = [
  { id: "contour", name: "Contour cut" },
  { id: "circle", name: "Circle" },
  { id: "square", name: "Square" },
  { id: "round-corners", name: "Round corners" },
  { id: "sheet", name: "Sheet" },
];

const PRESET_SIZES = [
  { id: "small", dimensions: '2" x 2"', width: 2, height: 2 },
  { id: "medium", dimensions: '3" x 3"', width: 3, height: 3 },
  { id: "large", dimensions: '4" x 4"', width: 4, height: 4 },
  { id: "xlarge", dimensions: '5" x 5"', width: 5, height: 5 },
  { id: "6x6", dimensions: '6" x 6"', width: 6, height: 6 },
  { id: "7x7", dimensions: '7" x 7"', width: 7, height: 7 },
  { id: "8x8", dimensions: '8" x 8"', width: 8, height: 8 },
  { id: "9x9", dimensions: '9" x 9"', width: 9, height: 9 },
  { id: "10x10", dimensions: '10" x 10"', width: 10, height: 10 },
];

const MATERIALS = [
  { id: "matte", name: "Matte Vinyl", description: "Non-reflective finish", preview: "linear-gradient(45deg, #f8f8f8, #e0e0e0)" },
  { id: "holographic", name: "Holographic", description: "Rainbow holographic effect", preview: "linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4, #ffeaa7)" },
  { id: "clear", name: "Clear", description: "Transparent background", preview: "linear-gradient(45deg, rgba(255,255,255,0.1), rgba(255,255,255,0.3))" },
  { id: "window-perf", name: "Window Perf", description: "Perforated for windows", preview: "linear-gradient(45deg, #ffffff, #f0f0f0), repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)" },
  { id: "heat-transfer", name: "Heat Transfer (Clothing)", description: "For fabric application", preview: "linear-gradient(45deg, #fbbf24, #f59e0b)" },
  { id: "wall-stickers", name: "Wall Stickers", description: "Removable wall decals", preview: "linear-gradient(45deg, #a78bfa, #8b5cf6)" },
];

export default function StickerMakerPage() {
  const router = useRouter();
  const { addItem } = useCart();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showAlert, setShowAlert] = useState(false);
  const [adding, setAdding] = useState(false);
  const [artworkError, setArtworkError] = useState("");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [selectedShape, setSelectedShape] = useState("square");
  const [selectedWidth, setSelectedWidth] = useState(2);
  const [selectedHeight, setSelectedHeight] = useState(2);
  const [selectedPreset, setSelectedPreset] = useState("small");
  const [selectedMaterial, setSelectedMaterial] = useState("matte");
  const [quantity, setQuantity] = useState(56);
  const [quote, setQuote] = useState<{ key: string; price: PricingResult; error: string }>({ key: "", price: { unitPrice: 0, subtotal: 0, qty: 0 }, error: "" });

  let minQuantity = 1;
  try { minQuantity = getStickerMinimum({ wIn: selectedWidth, hIn: selectedHeight }); } catch { /* Show the validation error in Pricing. */ }
  const effectiveQuantity = Math.max(quantity, minQuantity);
  const pricingKey = `${selectedWidth}:${selectedHeight}:${effectiveQuantity}`;
  const pricingBusy = quote.key !== pricingKey;
  const pricingError = pricingBusy ? "" : quote.error;
  const currentPricing = quote.price;
  const stickerArea = selectedWidth * selectedHeight;

  const maxSize = 200;
  const ratio = Math.min(maxSize / selectedWidth, maxSize / selectedHeight);
  const previewWidth = Math.min(selectedWidth * ratio * 20, maxSize);
  const previewHeight = Math.min(selectedHeight * ratio * 20, maxSize);

  useEffect(() => {
    let cancelled = false;
    getStickerPricing({ wIn: selectedWidth, hIn: selectedHeight }, effectiveQuantity)
      .then((price) => {
        if (!cancelled) setQuote({ key: pricingKey, price, error: "" });
      })
      .catch((error) => {
        if (!cancelled) setQuote({ key: pricingKey, price: { unitPrice: 0, subtotal: 0, qty: 0 }, error: error instanceof Error ? error.message : "Unable to calculate this price." });
      });
    return () => { cancelled = true; };
  }, [selectedWidth, selectedHeight, effectiveQuantity, pricingKey]);

  const applyPresetSize = (presetId: string) => {
    const preset = PRESET_SIZES.find((s) => s.id === presetId);
    if (preset) {
      setSelectedWidth(preset.width);
      setSelectedHeight(preset.height);
      setQuantity(getStickerMinimum({ wIn: preset.width, hIn: preset.height }));
    }
  };

  const handleFile = (file: File) => {
    try {
      validateArtwork(file);
      setArtworkError("");
      setRawFile(file);
      setUploadedImage(artworkPreview(file));
    } catch (error) {
      setArtworkError(error instanceof Error ? error.message : "Unable to open this artwork.");
    }
  };

  useEffect(() => () => releaseArtworkPreview(uploadedImage), [uploadedImage]);

  const onAddToCart = async () => {
    if (pricingBusy || pricingError || adding) return false;
    setAdding(true);
    setArtworkError("");
    try {
      await addItem({
        size: { wIn: selectedWidth, hIn: selectedHeight, label: `${selectedWidth}x${selectedHeight}` },
        material: selectedMaterial,
        quantity: effectiveQuantity,
        designFileId: rawFile,
        shape: selectedShape,
      });
      setShowAlert(true);
      setTimeout(() => setShowAlert(false), 3000);
      return true;
    } catch (error) {
      setArtworkError(error instanceof Error ? error.message : "Unable to add this item. Please try again.");
      return false;
    } finally { setAdding(false); }
  };

  const orderNow = async () => {
    if (await onAddToCart()) router.push("/cart");
  };

  return (
    <div className={styles["custom-sticker-maker"]}>
      {showAlert && (
        <div className={styles["success-alert"]}>
          <div className={styles["alert-content"]}>
            <span className={styles["alert-icon"]}>✓</span>
            <span className={styles["alert-message"]}>Sticker added to cart successfully!</span>
          </div>
        </div>
      )}

      <div className={styles.container}>
        <div className={styles["maker-header"]}>
          <h1>Custom Sticker Maker</h1>
          <p>Design and create your perfect custom stickers in minutes</p>
        </div>

        <div className={styles["maker-content"]}>
          <div className={styles["design-panel"]}>
            <div className={styles["upload-section"]}>
              <h3>Upload Your Design</h3>
              <div
                className={styles["upload-area"]}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleFile(file);
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  aria-label="Upload artwork"
                  accept={ARTWORK_ACCEPT}
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                  }}
                />
                {!rawFile ? (
                  <div className={styles["upload-placeholder"]}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7,10 12,15 17,10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    <p>Click to upload or drag and drop</p>
                    <span>PDF, AI, CDR, JPG, PNG up to 4MB</span>
                  </div>
                ) : (
                  <div className={styles["uploaded-image"]}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {uploadedImage ? <img src={uploadedImage} alt="Uploaded design" /> : <p>{rawFile.name}<br />Original file attached. Preview unavailable for this format.</p>}
                    <button
                      type="button"
                      aria-label="Remove artwork"
                      className={styles["remove-image"]}
                      onClick={(e) => {
                        e.stopPropagation();
                        setUploadedImage(null);
                        setRawFile(null);
                        setArtworkError("");
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
              {rawFile && <p>{rawFile.name}</p>}
              {artworkError && <p role="alert">{artworkError}</p>}
            </div>

            <div className={styles["design-options"]}>
              <h3>Design Options</h3>

              <div className={styles["option-group"]}>
                <label>Shape</label>
                <div className={styles["shape-options"]}>
                  {SHAPES.map((shape) => (
                    <button
                      key={shape.id}
                      type="button"
                      className={`${styles["shape-btn"]} ${selectedShape === shape.id ? styles.active : ""}`}
                      onClick={() => setSelectedShape(shape.id)}
                    >
                      {shape.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles["option-group"]}>
                <label>Size</label>
                <div className={styles["size-input-section"]}>
                  <div className={styles["preset-sizes"]}>
                    <label className={styles["preset-label"]}>Quick Select:</label>
                    <select
                      className={styles["preset-select"]}
                      value={selectedPreset}
                      onChange={(e) => {
                        setSelectedPreset(e.target.value);
                        if (e.target.value) applyPresetSize(e.target.value);
                      }}
                    >
                      <option value="">Custom Size</option>
                      {PRESET_SIZES.map((size) => (
                        <option key={size.id} value={size.id}>{size.dimensions}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles["custom-size-inputs"]}>
                    <div className={styles["size-input-group"]}>
                      <label>Width (inches)</label>
                      <input
                        type="number"
                        className={styles["size-input"]}
                        value={selectedWidth}
                        min={0.5}
                        max={52}
                        step={0.5}
                        onChange={(e) => {
                          setSelectedWidth(Number(e.target.value));
                          setSelectedPreset("");
                        }}
                      />
                    </div>
                    <div className={styles["size-input-group"]}>
                      <label>Height (inches)</label>
                      <input
                        type="number"
                        className={styles["size-input"]}
                        value={selectedHeight}
                        min={0.5}
                        max={240}
                        step={0.5}
                        onChange={(e) => {
                          setSelectedHeight(Number(e.target.value));
                          setSelectedPreset("");
                        }}
                      />
                    </div>
                  </div>
                  <div className={styles["size-display"]}>
                    <span className={styles["current-size"]}>Current Size: {selectedWidth}&quot; × {selectedHeight}&quot;</span>
                    <span className={styles["size-area"]}>Area: {stickerArea.toFixed(2)} sq in</span>
                  </div>
                </div>
              </div>

              <div className={styles["option-group"]}>
                <label>Material</label>
                <div className={styles["material-options"]}>
                  {MATERIALS.map((material) => (
                    <div
                      key={material.id}
                      className={`${styles["material-card"]} ${selectedMaterial === material.id ? styles.active : ""}`}
                      onClick={() => setSelectedMaterial(material.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && setSelectedMaterial(material.id)}
                    >
                      <div className={styles["material-preview"]} style={{ background: material.preview }} />
                      <span>{material.name}</span>
                      <small>{material.description}</small>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles["option-group"]}>
                <label>Quantity</label>
                <div className={styles["quantity-selector"]}>
                  <button type="button" onClick={() => effectiveQuantity > minQuantity && setQuantity(effectiveQuantity - 1)} disabled={effectiveQuantity <= minQuantity}>-</button>
                  <input type="number" value={effectiveQuantity} min={minQuantity} max={10000} onChange={(e) => setQuantity(Number(e.target.value))} />
                  <button type="button" onClick={() => effectiveQuantity < 10000 && setQuantity(effectiveQuantity + 1)}>+</button>
                </div>
                {minQuantity > 1 && (
                  <div className={styles["min-quantity-notice"]}>
                    Minimum order: {minQuantity} stickers for this size
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className={styles["preview-panel"]}>
            <div className={styles["preview-section"]}>
              <h3>Preview</h3>
              <div className={styles["sticker-preview"]}>
                <div
                  className={`${styles["preview-sticker"]} ${styles[selectedShape] || ""}`}
                  style={{
                    backgroundImage: uploadedImage ? `url(${uploadedImage})` : "none",
                    backgroundColor: !uploadedImage ? "#f3f4f6" : "transparent",
                    width: previewWidth,
                    height: previewHeight,
                  }}
                >
                  {!uploadedImage && (
                    <div className={styles["preview-placeholder"]}>
                      <p>{rawFile ? "Original file attached. No image preview for this format." : "Your design will appear here"}</p>
                    </div>
                  )}
                </div>
                <div className={styles["preview-info"]}>
                  <p><strong>Shape:</strong> {SHAPES.find((s) => s.id === selectedShape)?.name}</p>
                  <p><strong>Size:</strong> {selectedWidth}&quot; × {selectedHeight}&quot;</p>
                  <p><strong>Material:</strong> {MATERIALS.find((m) => m.id === selectedMaterial)?.name}</p>
                </div>
              </div>
            </div>

            <div className={styles["pricing-section"]}>
              <h3>Pricing</h3>
              <div className={styles["price-breakdown"]} aria-busy={pricingBusy}>
                {pricingBusy && <p role="status">Calculating price…</p>}
                {pricingError && <p role="alert">{pricingError}</p>}
                <div className={styles["price-row"]}>
                  <span>Price per sticker</span>
                  <span>${currentPricing.unitPrice.toFixed(2)}</span>
                </div>
                <div className={styles["price-row"]}>
                  <span>{currentPricing.qty} stickers</span>
                  <span>${currentPricing.subtotal.toFixed(2)}</span>
                </div>
                <div className={`${styles["price-row"]} ${styles.total}`}>
                  <span><strong>Total</strong></span>
                  <span><strong>${currentPricing.subtotal.toFixed(2)}</strong></span>
                </div>
                {typeof currentPricing.applied?.discount === "string" &&
                  currentPricing.applied.discount !== "—" && (
                  <div className={styles["discount-info"]}>
                    <span className={styles["discount-badge"]}>{currentPricing.applied.discount} discount applied!</span>
                  </div>
                )}
              </div>
              <div className={styles["action-buttons"]}>
                <button type="button" className={`${styles.btn} ${styles.secondary}`} onClick={onAddToCart} disabled={pricingBusy || !!pricingError || adding}>Add to Cart</button>
                <button type="button" className={`${styles.btn} ${styles.primary}`} onClick={orderNow} disabled={!rawFile || pricingBusy || !!pricingError || adding}>Order Now</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
