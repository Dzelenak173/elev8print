import { NextRequest, NextResponse } from "next/server";
import { PricingInputError } from "@/lib/sticker-pricing";
import { getServerStickerPricing } from "@/lib/sticker-pricing-server";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const result = await getServerStickerPricing({ wIn: Number(params.get("width")), hIn: Number(params.get("height")) }, params.get("qty") || "");
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const invalid = error instanceof PricingInputError;
    return NextResponse.json({ error: invalid ? error.message : "Unable to calculate this price. Please try again or contact Elev8 Print." }, { status: invalid ? 400 : 502, headers: { "Cache-Control": "no-store" } });
  }
}
