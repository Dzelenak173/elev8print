"use client";

import { useState } from "react";
import styles from "./contact.module.css";
import { OFFICE_EMAIL } from "@/lib/business-contact";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!name || !email || !message) {
      setError("Please fill out all required fields.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          subject: subject || "Website Inquiry",
          message,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to send message.");
      }

      setSuccess(true);
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles["contact-us"]}>
      <div className={styles.container}>
        <div className={styles["contact-header"]}>
          <h1>Contact Us</h1>
          <p>Get in touch with our team for any questions or support</p>
        </div>

        <div className={styles["contact-content"]}>
          <div className={styles["contact-form-section"]}>
            <form className={styles["contact-form"]} onSubmit={submitForm}>
              <div className={styles["form-group"]}>
                <label htmlFor="name">Full Name</label>
                <input type="text" id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className={styles["form-group"]}>
                <label htmlFor="email">Email Address</label>
                <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className={styles["form-group"]}>
                <label htmlFor="subject">Subject</label>
                <select id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} required>
                  <option value="">Select a topic</option>
                  <option value="general">General Inquiry</option>
                  <option value="order">Order Support</option>
                  <option value="technical">Technical Issue</option>
                  <option value="billing">Billing Question</option>
                  <option value="custom">Custom Order</option>
                </select>
              </div>
              <div className={styles["form-group"]}>
                <label htmlFor="message">Message</label>
                <textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} rows={6} required />
              </div>
              <button type="submit" className={styles["submit-btn"]} disabled={loading}>
                {loading ? "Sending..." : "Send Message"}
              </button>
              {success && <p style={{ color: "greenyellow" }}>✅ Message sent successfully.</p>}
              {error && <p style={{ color: "red" }}>{error}</p>}
            </form>
          </div>

          <div className={styles["contact-info"]}>
            <div className={styles["info-card"]}>
              <div className={styles["info-icon"]}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </div>
              <h3>Phone</h3>
              <p>+1 (248) 884-3965<br />Mon-Fri: 9AM-6PM EST</p>
            </div>
            <div className={styles["info-card"]}>
              <div className={styles["info-icon"]}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <h3>Email</h3>
              <p><a href={`mailto:${OFFICE_EMAIL}`}>{OFFICE_EMAIL}</a></p>
            </div>
            <div className={styles["info-card"]}>
              <div className={styles["info-icon"]}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12,6 12,12 16,14" />
                </svg>
              </div>
              <h3>Business Hours</h3>
              <p>Monday - Friday: 9:00 AM - 6:00 PM<br />Saturday: 10:00 AM - 4:00 PM<br />Sunday: Closed</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
