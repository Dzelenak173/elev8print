import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-admin";
import { verifyAdminToken } from "@/lib/auth";

export async function DELETE(
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

    const { error } = await supabase.from("orders").delete().eq("id", id);

    if (error?.code === "23503") return NextResponse.json({ success: false, error: "This order has proof records. Cancel the order instead so its approval history is retained." }, { status: 409 });
    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: `Order ${id} deleted.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
