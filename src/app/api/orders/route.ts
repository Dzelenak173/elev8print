import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-admin";
import sgMail from "@/lib/sendgrid";
import { verifyAdminToken } from "@/lib/auth";
import { requireCheckoutConsent, validEmail } from "@/lib/approval-policy";
import { TERMS_VERSION, termsSnapshot } from "@/lib/terms";
import { quoteOrder, orderMatchesQuote } from "@/lib/checkout-pricing";
import { PricingInputError } from "@/lib/sticker-pricing";
import { OFFICE_EMAIL } from "@/lib/business-contact";

function generateTrackId() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function GET(request: Request) {
  if (!verifyAdminToken(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  }
  const { data, error } = await supabase
    .from("orders")
    .select("id,track_id,customer_name,customer_email,customer_phone,address_street,address_city,address_state,address_zip,order_notes,items,total,status,created_at,terms_version,terms_accepted_at,artwork_rights_accepted_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ orders: data }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    try { requireCheckoutConsent(body, TERMS_VERSION); }
    catch (error) { return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Accept the terms first." }, { status: 400 }); }
    const { customer, items: submittedItems, total: submittedTotal, user_id = null } = body;
    if (!customer || !validEmail(customer.email) || typeof customer.name !== "string" || !customer.name.trim() || !Array.isArray(submittedItems) || !submittedItems.length) {
      return NextResponse.json({ success: false, error: "Complete the customer and order details." }, { status: 400 });
    }
    let quote;
    try { quote = await quoteOrder(submittedItems); }
    catch (error) {
      return NextResponse.json({ success: false, error: error instanceof PricingInputError ? error.message : "Unable to verify prices. Please try again." }, { status: error instanceof PricingInputError ? 400 : 503 });
    }
    if (!orderMatchesQuote(submittedItems, submittedTotal, quote)) {
      return NextResponse.json({ success: false, code: "PRICE_CHANGED", error: "Your cart prices have changed. Review the updated prices before placing your order.", quote }, { status: 409, headers: { "Cache-Control": "no-store" } });
    }
    const { items, total } = quote;
    const acceptedAt = new Date().toISOString();
    const track_id = generateTrackId();
    const orderPayload: Record<string, unknown> = {
      track_id,
      customer_name: customer.name,
      customer_email: customer.email,
      customer_phone: customer.phone,
      address_street: customer.street,
      address_city: customer.city,
      address_state: customer.state,
      address_zip: customer.zipCode,
      order_notes: customer.notes,
      items,
      total,
      terms_version: TERMS_VERSION,
      terms_snapshot: termsSnapshot(),
      terms_accepted_at: acceptedAt,
      artwork_rights_accepted_at: acceptedAt,
    };

    if (user_id) orderPayload.user_id = user_id;

    const { data, error } = await supabase
      .from("orders")
      .insert([orderPayload])
      .select();

    if (error) throw error;

    const msg = {
      to: customer.email,
      from: {
        email: "admin@elaborate-designs.com",
        name: "Elev8 Print",
      },
      replyTo: OFFICE_EMAIL,
      subject: `Your Elev8 Print Order #${track_id} Confirmation`,
      text: `Hi ${customer.name}, thank you for your order!

Your order ID is ${track_id} and your total is $${total}.
You can track your order here: https://elev8print.com/track/${track_id}

Questions? Reply to this email or contact ${OFFICE_EMAIL}.`,

      html: `
  <div style="font-family: Arial, sans-serif; background-color:#f6f6f6; padding:30px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:auto;background:#ffffff;border-radius:8px;overflow:hidden;">
      <tr>
        <td style="background:#111827; padding:20px; text-align:center;">
          <h1 style="color:#ffffff; margin:0; font-size:24px;">Elev8 Print</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:30px;">
          <h2 style="color:#111827; margin-top:0;">Order Confirmation</h2>
          <p style="color:#4b5563; font-size:15px; line-height:1.6;">
            Hi <strong>${customer.name}</strong>,<br><br>
            Thank you for your order! We will reach out soon to collect payment and begin processing your order. Here are your order details:
          </p>

          <div style="background:#f9fafb; padding:15px; border:1px solid #e5e7eb; border-radius:6px; margin-top:15px;">
            <p style="margin:0; color:#374151; font-size:14px;">
              <strong>Order ID:</strong> ${track_id}<br>
              <strong>Total:</strong> $${total}<br>
              <strong>Email:</strong> ${customer.email}
            </p>
          </div>

          <p style="margin-top:25px; text-align:center;">
            <a href="https://elev8print.com/track/${track_id}" 
               style="display:inline-block; background:#111827; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:6px; font-size:15px;">
              Track Your Order
            </a>
          </p>

          <p style="color:#6b7280; font-size:13px; margin-top:40px; line-height:1.5;">
            If you have any questions, simply reply to this email or contact our support team at 
            <a href="mailto:${OFFICE_EMAIL}" style="color:#2563eb;">${OFFICE_EMAIL}</a>.
          </p>
        </td>
      </tr>
      <tr>
        <td style="background:#f3f4f6; padding:15px; text-align:center; color:#9ca3af; font-size:12px;">
          © ${new Date().getFullYear()} Elev8Print — All rights reserved.
        </td>
      </tr>
    </table>
  </div>`,
    };

    const adminMsg = {
      to: OFFICE_EMAIL,
      from: {
        email: "admin@elaborate-designs.com",
        name: "Elev8 Print — Order Bot",
      },
      replyTo: customer.email,
      subject: `New Order #${track_id} from ${customer.name}`,
      text: `New order received.

Order ID: ${track_id}
Customer: ${customer.name} (${customer.email})
Total: $${total}

View it in the admin panel:
https://elev8print.com/admin
`,
      html: `
    <div style="font-family: Arial, sans-serif; background:#f6f6f6; padding:24px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:auto;background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr>
          <td style="background:#111827; padding:16px; text-align:center;">
            <h2 style="color:#fff; margin:0; font-size:18px;">New Order Notification</h2>
          </td>
        </tr>
        <tr>
          <td style="padding:20px; color:#374151; font-size:14px; line-height:1.6;">
            <p style="margin:0 0 8px;"><strong>Order ID:</strong> ${track_id}</p>
            <p style="margin:0 0 8px;"><strong>Customer:</strong> ${customer.name} (${customer.email})</p>
            <p style="margin:0 0 16px;"><strong>Total:</strong> $${total}</p>
            <p style="margin:0 0 16px;">Open the admin panel to review and process this order:</p>
            <p style="margin:0; text-align:center;">
              <a href="https://elev8print.com/admin" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;">Open Admin Panel</a>
            </p>
          </td>
        </tr>
      </table>
    </div>
  `,
    };

    // Finish both send attempts before the serverless response ends. Once the
    // order is stored, a mail failure must not invite a duplicate order retry.
    const deliveries = await Promise.allSettled(
      [msg, adminMsg].map(async (message) => sgMail.send(message))
    );
    deliveries.forEach((delivery, index) => {
      if (delivery.status === "rejected") {
        console.error(
          index === 0 ? "SendGrid error" : "SendGrid admin email error",
          delivery.reason
        );
      }
    });

    return NextResponse.json({ success: true, order: data[0] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
