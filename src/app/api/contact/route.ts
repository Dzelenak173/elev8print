import { NextResponse } from "next/server";
import sgMail from "@/lib/sendgrid";
import { OFFICE_EMAIL } from "@/lib/business-contact";

function isEmail(s = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      name = "",
      email = "",
      phone = "",
      subject = "New Contact Form",
      message = "",
    } = body || {};

    if (!name.trim() || !isEmail(email) || !message.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Name, valid email, and message are required.",
        },
        { status: 400 }
      );
    }

    const safeName = name.trim();
    const safeMsg = message.trim();
    const safePhone = String(phone || "").trim();

    const textBody = `New website inquiry

From: ${safeName} <${email}>
Phone: ${safePhone || "N/A"}
Subject: ${subject}

Message:
${safeMsg}
`;

    const htmlBody = `
      <div style="font-family:Arial, sans-serif; background:#f6f6f6; padding:24px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:auto;background:#ffffff;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background:#111827; padding:16px; text-align:center;">
              <h2 style="color:#fff;margin:0;font-size:18px;">New Contact Form Submission</h2>
            </td>
          </tr>
          <tr>
            <td style="padding:20px; color:#374151; font-size:14px; line-height:1.6;">
              <p style="margin:0 0 8px;"><strong>Name:</strong> ${safeName}</p>
              <p style="margin:0 0 8px;"><strong>Email:</strong> ${email}</p>
              <p style="margin:0 0 16px;"><strong>Phone:</strong> ${safePhone || "N/A"}</p>
              <p style="margin:0 0 8px;"><strong>Subject:</strong> ${subject}</p>
              <p style="margin:12px 0 0;"><strong>Message:</strong></p>
              <p style="white-space:pre-wrap;margin:8px 0 0;">${safeMsg.replace(/</g, "&lt;")}</p>
            </td>
          </tr>
        </table>
      </div>
    `;

    await sgMail.send({
      to: OFFICE_EMAIL,
      // Retain the existing SendGrid sender; changing the receiving inbox does
      // not establish that the new address is an authorized sender.
      from: { email: "admin@elaborate-designs.com", name: "Elev8 Print — Website" },
      replyTo: email,
      subject: `[Contact] ${subject} — ${safeName}`,
      text: textBody,
      html: htmlBody,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("SendGrid contact error", err);
    return NextResponse.json(
      { success: false, error: "Failed to send message" },
      { status: 500 }
    );
  }
}
