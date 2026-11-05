import Link from "next/link";
import styles from "./footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`${styles.footerContainer} ${styles.footerGrid}`}>
        <div className={styles.footerSection}>
          <div className={styles.footerLogo}>
            <img
              src="/logo.png"
              alt="ELEV8 PRINT"
              className={styles.logoImg}
            />
          </div>
          <p className={styles.footerDescription}>
            With Elev8 Print you can create custom stickers and premium mylar
            bags tailored to your exact specifications.
          </p>
          <div className={styles.socialLinks}>
            <a
              href="https://instagram.com/elev8print"
              className={styles.socialLink}
              aria-label="Instagram"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
            </a>
          </div>
        </div>

        <div className={styles.footerSection}>
          <h3 className={styles.footerTitle}>Quick Links</h3>
          <ul className={styles.footerLinks}>
            <li>
              <Link href="/" className={styles.footerLink}>
                Home
              </Link>
            </li>
            <li>
              <Link href="/materials" className={styles.footerLink}>
                Materials
              </Link>
            </li>
            <li>
              <Link href="/sticker-maker" className={styles.footerLink}>
                Custom Stickers
              </Link>
            </li>
            <li>
              <Link href="/mylar-maker" className={styles.footerLink}>
                Mylar Bags
              </Link>
            </li>
            <li>
              <Link href="/track" className={styles.footerLink}>
                Track Order
              </Link>
            </li>
          </ul>
        </div>

        <div className={styles.footerSection}>
          <h3 className={styles.footerTitle}>Support</h3>
          <ul className={styles.footerLinks}>
            <li>
              <Link href="/contact" className={styles.footerLink}>
                Contact Us
              </Link>
            </li>
            <li>
              <Link href="/faq" className={styles.footerLink}>
                FAQ
              </Link>
            </li>
            <li>
              <Link href="/support" className={styles.footerLink}>
                Support
              </Link>
            </li>
            <li>
              <Link href="/tos" className={styles.footerLink}>
                Terms of Service
              </Link>
            </li>
          </ul>
        </div>

        <div className={styles.footerSection}>
          <h3 className={styles.footerTitle}>Contact Info</h3>
          <div className={styles.contactInfo}>
            <div className={styles.contactItem}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
              </svg>
              <span>office@elev8print.com</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.footerBottom}>
        <div className={styles.footerContainer}>
          <div className={styles.bottomContent}>
            <p className={styles.copyright}>
              © 2025 ELEV8 PRINT. All rights reserved.
            </p>
            <div className={styles.bottomLinks}>
              <Link href="/privacy" className={styles.bottomLink}>
                Privacy Policy
              </Link>
              <Link href="/tos" className={styles.bottomLink}>
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
