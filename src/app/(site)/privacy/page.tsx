"use client";

import styles from "./privacy.module.css";

export default function PrivacyPage() {
  return (
    <div className={styles["privacy-container"]}>
      <div className={styles["privacy-header"]}>
        <h1>Privacy Policy</h1>
        <p className={styles["last-updated"]}>Last updated: November 4, 2026</p>
      </div>

      <div className={styles["privacy-content"]}>
        <section className={styles["privacy-section"]}>
          <h2>1. Information We Collect</h2>
          <div className={styles["section-content"]}>
            <h3>Personal Information</h3>
            <p>We collect information you provide directly to us, such as when you:</p>
            <ul>
              <li>Create an account or place an order</li>
              <li>Contact us for customer support</li>
              <li>Subscribe to our newsletter</li>
              <li>Upload designs or files for printing</li>
            </ul>
            <p>This may include your name, email address, phone number, billing and shipping addresses, and payment information.</p>
            <h3>Design Files and Content</h3>
            <p>When you upload designs, images, or other content for printing services, we collect and store these files to fulfill your orders. We treat your creative content with strict confidentiality.</p>
            <h3>Proof and Approval Records</h3>
            <p>For artwork approval, we retain the proof file and revision, production specifications, relevant permission-review notes, the terms shown, the name and email entered by the signer, their approval statements or change request, and the date and time. Approval links are confidential; share them only with an authorized representative. Proof files in the approval process are accessed through time-limited links.</p>
            <h3>Automatically Collected Information</h3>
            <p>We automatically collect certain information about your device and usage, including IP address, browser type, operating system, and pages visited on our site.</p>
          </div>
        </section>

        <section className={styles["privacy-section"]}>
          <h2>2. How We Use Your Information</h2>
          <div className={styles["section-content"]}>
            <p>We use the information we collect to:</p>
            <ul>
              <li>Process and fulfill your printing orders</li>
              <li>Communicate with you about your orders and account</li>
              <li>Provide customer support and respond to inquiries</li>
              <li>Improve our services and website functionality</li>
              <li>Send promotional emails (with your consent)</li>
              <li>Prevent fraud and ensure security</li>
            </ul>
          </div>
        </section>

        <section className={styles["privacy-section"]}>
          <h2>3. Information Sharing and Disclosure</h2>
          <div className={styles["section-content"]}>
            <p>We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:</p>
            <ul>
              <li><strong>Service Providers:</strong> With trusted third-party vendors who help us operate our business (payment processors, shipping companies)</li>
              <li><strong>Legal Requirements:</strong> When required by law or to protect our rights and safety</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
            </ul>
          </div>
        </section>

        <section className={styles["privacy-section"]}>
          <h2>4. Data Security</h2>
          <div className={styles["section-content"]}>
            <p>We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. This includes:</p>
            <ul>
              <li>SSL encryption for data transmission</li>
              <li>Secure servers and databases</li>
              <li>Regular security audits and updates</li>
              <li>Limited access to personal information by employees</li>
            </ul>
          </div>
        </section>

        <section className={styles["privacy-section"]}>
          <h2>5. Your Rights and Choices</h2>
          <div className={styles["section-content"]}>
            <p>You have the right to:</p>
            <ul>
              <li>Access, update, or delete your personal information</li>
              <li>Opt out of promotional communications</li>
              <li>Request a copy of your data</li>
              <li>Withdraw consent for data processing</li>
            </ul>
          <p>To exercise these rights, please contact us at office@elev8print.com</p>
          </div>
        </section>

        <section className={styles["privacy-section"]}>
          <h2>6. Cookies and Tracking</h2>
          <div className={styles["section-content"]}>
            <p>We use cookies and similar technologies to enhance your browsing experience, analyze site traffic, and personalize content. You can control cookie settings through your browser preferences.</p>
          </div>
        </section>

        <section className={styles["privacy-section"]}>
          <h2>7. Data Retention</h2>
          <div className={styles["section-content"]}>
            <p>We retain information for as long as necessary for fulfillment, relevant reprints, legal obligations, dispute handling, and insurance or claims needs. Proofs and approval records can be kept longer than ordinary working design files so we can establish what was reviewed and authorized. Expiration of an approval link does not delete its underlying record. Contact us about access, correction, or deletion requests; some records may need to be retained for these purposes.</p>
          </div>
        </section>

        <section className={styles["privacy-section"]}>
          <h2>8. Children&apos;s Privacy</h2>
          <div className={styles["section-content"]}>
            <p>Our services are not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If we become aware that we have collected such information, we will take steps to delete it promptly.</p>
          </div>
        </section>

        <section className={styles["privacy-section"]}>
          <h2>9. International Data Transfers</h2>
          <div className={styles["section-content"]}>
            <p>Your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place to protect your information in accordance with this privacy policy.</p>
          </div>
        </section>

        <section className={styles["privacy-section"]}>
          <h2>10. Changes to This Policy</h2>
          <div className={styles["section-content"]}>
            <p>We may update this privacy policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the &quot;Last updated&quot; date. Your continued use of our services after such changes constitutes acceptance of the updated policy.</p>
          </div>
        </section>

        <section className={styles["privacy-section"]}>
          <h2>11. Contact Us</h2>
          <div className={styles["section-content"]}>
            <p>If you have any questions about this privacy policy or our data practices, please contact us:</p>
            <div className={styles["contact-info"]}>
              <p><strong>ELEV8 PRINT</strong></p>
            <p>Email: office@elev8print.com</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
