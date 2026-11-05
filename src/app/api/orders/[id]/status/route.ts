import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-admin";
import { verifyAdminToken } from "@/lib/auth";
import { ORDER_STATUSES } from "@/lib/approval-policy";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = verifyAdminToken(request.headers.get("authorization"));
  if (!admin) {
    const authHeader = request.headers.get("authorization");
    return NextResponse.json(
      { error: authHeader ? "Invalid or expired token" : "Unauthorized" },
      { status: authHeader ? 403 : 401 }
    );
  }

  try {
    const { id } = await params;
    const { status } = await request.json();

    if (typeof status !== "string" || !ORDER_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: "Choose a valid order status." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", id)
      .select();

    if (error?.code === "P0001") return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    if (error) throw error;

    if (!data || data.length === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, order: data[0] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
