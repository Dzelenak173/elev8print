"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import styles from "./faq.module.css";

const CATEGORIES = [
  { id: "all", name: "All Questions" },
  { id: "ordering", name: "Ordering" },
  { id: "materials", name: "Materials" },
  { id: "design", name: "Design & Files" },
  { id: "technical", name: "Technical" },
  { id: "shipping", name: "Shipping" },
  { id: "pricing", name: "Pricing" },
];

const FAQS = [
  { id: 1, category: "ordering", question: "How do I place a custom sticker order?", answer: 'You can place an order by clicking "Make custom stickers" on our homepage, uploading your design, selecting your specifications, and completing the checkout process. Our design tool makes it easy to preview your stickers before ordering.' },
  { id: 2, category: "materials", question: "What materials do you offer for stickers?", answer: "We offer Matte Vinyl, Holographic, Clear, Window Perf, Heat Transfer (for clothing), and Wall Stickers. Each material has different properties for indoor/outdoor use, durability, and finish." },
  { id: 3, category: "design", question: "What file formats do you accept?", answer: "We accept PNG, JPG, PDF, AI, EPS, and SVG files. For best quality, we recommend vector files (AI, EPS, SVG) or high-resolution raster images (300 DPI minimum)." },
  { id: 4, category: "technical", question: "Should I use RGB or CMYK color mode?", answer: "Always use CMYK color mode for printing. RGB colors will be converted to CMYK during printing, which may cause color shifts. Design in CMYK from the start for accurate color reproduction." },
  { id: 5, category: "design", question: "What resolution should my artwork be?", answer: "Your artwork should be at least 300 DPI at the final print size. For vector files, this isn't a concern, but raster images (PNG, JPG) must be high resolution to avoid pixelation." },
  { id: 6, category: "technical", question: "What is a cutline and do I need one?", answer: "A cutline defines where your sticker will be cut. Create a vector path in a bright color (like magenta) on a separate layer. This ensures precise cutting around your design shape." },
  { id: 7, category: "design", question: "Do I need to include bleed in my design?", answer: "Yes, include 1-2mm bleed around your design edges. This prevents white edges if there's slight movement during cutting. Extend your background colors beyond the cutline." },
  { id: 8, category: "materials", question: "What's the difference between kiss-cut and die-cut?", answer: "Kiss-cut stickers are cut through the vinyl but not the backing paper, perfect for sticker sheets. Die-cut stickers are cut completely through, creating individual stickers with custom shapes." },
  { id: 9, category: "technical", question: "Can you print white ink?", answer: "Yes! Our UV printer can print white ink. It can be used for white artwork or as a base beneath color on compatible materials, including clear and holographic vinyl. Tell us where you want white ink, and we will confirm the material and white ink placement in your proof before printing." },
  { id: 10, category: "materials", question: "Are holographic stickers waterproof?", answer: "Yes, our holographic vinyl is waterproof and weather-resistant, perfect for outdoor use. The holographic effect creates a rainbow shimmer that changes with viewing angle." },
  { id: 11, category: "design", question: "How do I create a design in Photoshop?", answer: "Create a new document at 300 DPI in CMYK mode. Design your sticker, then create a cutline on a separate layer using the Pen tool. Save as PDF or high-res PNG with the cutline layer." },
  { id: 12, category: "technical", question: "What are sticker sheets?", answer: "Sticker sheets contain multiple stickers on one sheet, kiss-cut so they peel off individually. Great for variety packs, labels, or when you need multiple small stickers." },
  { id: 13, category: "materials", question: "Can I use heat transfer vinyl on any fabric?", answer: "Heat transfer vinyl works best on cotton, polyester, and cotton blends. Avoid delicate fabrics like silk or heavily textured materials. Always test on a small area first." },
  { id: 14, category: "design", question: "How small can text be on stickers?", answer: "For readability, keep text at least 6-8pt size. Smaller text may become illegible, especially on textured materials. Sans-serif fonts work better for small text than serif fonts." },
  { id: 15, category: "technical", question: "Do you offer proofs before printing?", answer: "Yes, we provide digital proofs for approval before printing. This shows exactly how your design will look, including any color adjustments needed for CMYK printing." },
  { id: 16, category: "materials", question: "How long do outdoor stickers last?", answer: "Our vinyl stickers are rated for 3-5 years outdoors with proper application. Matte and gloss vinyl offer the best durability against UV, weather, and fading." },
  { id: 17, category: "pricing", question: "Do you offer bulk discounts?", answer: "Yes! We offer volume discounts. The more you order, the better the price per unit. Contact us for custom quotes on large orders over 10,000 pieces." },
  { id: 18, category: "shipping", question: "How fast can you deliver my order?", answer: "We offer express delivery as fast as 2-4 business days. Standard shipping typically takes 5-7 business days. Rush orders can be accommodated for an additional fee." },
  { id: 19, category: "ordering", question: "Can I get a sample before placing a large order?", answer: "We offer sample packs so you can feel the quality of our materials and see how your design looks printed. This helps ensure you're completely satisfied before placing your full order." },
  { id: 20, category: "technical", question: "What if my colors don't match what I see on screen?", answer: "Monitor colors (RGB) differ from print colors (CMYK). We provide color-accurate proofs and can adjust your design to match your expectations as closely as possible within CMYK limitations." },
];

export default function FAQPage() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [openFAQs, setOpenFAQs] = useState<number[]>([]);

  const filteredFAQs = useMemo(() => {
    if (activeCategory === "all") return FAQS;
    return FAQS.filter((faq) => faq.category === activeCategory);
  }, [activeCategory]);

  const toggleFAQ = (id: number) => {
    setOpenFAQs((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  return (
    <div className={styles.faq}>
      <div className={styles.container}>
        <div className={styles["faq-header"]}>
          <h1>Frequently Asked Questions</h1>
          <p>Find answers to common questions about our custom stickers and labels</p>
        </div>

        <div className={styles["faq-content"]}>
          <div className={styles["faq-categories"]}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`${styles["category-btn"]} ${activeCategory === cat.id ? styles.active : ""}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <div className={styles["faq-list"]}>
            {filteredFAQs.map((faq) => (
              <div key={faq.id} className={styles["faq-item"]}>
                <button
                  type="button"
                  className={`${styles["faq-question"]} ${openFAQs.includes(faq.id) ? styles.active : ""}`}
                  onClick={() => toggleFAQ(faq.id)}
                >
                  <span>{faq.question}</span>
                  <svg
                    className={`${styles.chevron} ${openFAQs.includes(faq.id) ? styles.rotated : ""}`}
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="6,9 12,15 18,9" />
                  </svg>
                </button>
                <div className={`${styles["faq-answer"]} ${openFAQs.includes(faq.id) ? styles.open : ""}`}>
                  <div className={styles["answer-content"]}>
                    <p>{faq.answer}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles["faq-footer"]}>
          <h3>Still have questions?</h3>
          <p>Can&apos;t find the answer you&apos;re looking for? Our support team is here to help.</p>
          <Link className={styles["contact-btn"]} href="/contact">Contact Us</Link>
        </div>
      </div>
    </div>
  );
}
