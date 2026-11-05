import type { Metadata } from "next";
import { TERMS_DATE, TERMS_SECTIONS, TERMS_VERSION } from "@/lib/terms";
import styles from "./tos.module.css";
export const metadata: Metadata = { title: "Terms of Service | Elev8 Print" };
export default function TermsOfServicePage() {
  return <div className={styles["terms-of-service"]}><div className={styles.container}>
    <div className={styles["terms-header"]}><h1>Terms of Service</h1><p className={styles["last-updated"]}>Version {TERMS_VERSION} · Updated {TERMS_DATE}</p><p>Clear expectations for your artwork, proof approval, and printing order.</p></div>
    <div className={styles["terms-content"]}>
      <nav className={styles["terms-nav"]} aria-label="Terms of Service contents"><h3>Contents</h3><ul>{TERMS_SECTIONS.map(s => <li key={s.id}><a href={`#${s.id}`}>{s.title}</a></li>)}</ul></nav>
      <div className={styles["terms-text"]}>{TERMS_SECTIONS.map(s => <section id={s.id} key={s.id} className={styles["terms-section"]} style={{ scrollMarginTop: 100 }}><h2>{s.title}</h2>{s.paragraphs.map((p, i) => <p key={i}>{p}</p>)}</section>)}</div>
    </div>
  </div></div>;
}
