import { NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/auth";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  if (!verifyAdminToken(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Sign in to the admin dashboard." }, { status: 401, headers });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid post review." }, { status: 400, headers });
  }
  const { id, status } = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (typeof id !== "string" || !id.trim() || id.length > 128 || (status !== "approved" && status !== "denied")) {
    return NextResponse.json({ error: "Choose a valid post and review status." }, { status: 400, headers });
  }

  const webhook = process.env.MAKE_POST_REVIEW_WEBHOOK_URL;
  if (!webhook) {
    return NextResponse.json({ error: "Post review is not configured. Contact the site administrator." }, { status: 503, headers });
  }

  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("Post review failed");
    return NextResponse.json({ success: true }, { headers });
  } catch {
    return NextResponse.json({ error: "Unable to update this post. Please try again." }, { status: 502, headers });
  }
}
