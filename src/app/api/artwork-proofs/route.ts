import { NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/auth";
import {
  ApprovalError,
  approvalLink,
  createArtworkProof,
  manageApprovalLink,
  privateHeaders,
  staffJob,
  staffOrder,
  staffPortal,
} from "@/lib/approval-server";
export const runtime = "nodejs";
function failure(e: unknown) {
  return NextResponse.json(
    {
      error:
        e instanceof ApprovalError
          ? e.message
          : "Unable to process this proof. Please try again.",
    },
    {
      status: e instanceof ApprovalError ? e.status : 500,
      headers: privateHeaders,
    },
  );
}
function denied(r: Request) {
  return !verifyAdminToken(r.headers.get("authorization"))
    ? NextResponse.json(
        { error: "Sign in to the admin dashboard." },
        { status: 401, headers: privateHeaders },
      )
    : null;
}
export async function GET(request: Request) {
  const auth = denied(request);
  if (auth) return auth;
  try {
    const params = new URL(request.url).searchParams;
    if (params.has("jobId"))
      return NextResponse.json(
        { records: await staffJob(params.get("jobId") || "") },
        { headers: privateHeaders },
      );
    if (params.has("orderId"))
      return NextResponse.json(
        { records: await staffOrder(params.get("orderId") || "") },
        { headers: privateHeaders },
      );
    const offset = Number(params.get("offset") || 0);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000)
      throw new ApprovalError("Invalid page.");
    return NextResponse.json(await staffPortal(offset), {
      headers: privateHeaders,
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  const auth = denied(request);
  if (auth) return auth;
  try {
    if (Number(request.headers.get("content-length")) > 3 * 1024 * 1024)
      throw new ApprovalError("Keep each proof under 2 MB.", 413);
    return NextResponse.json(
      await createArtworkProof(await request.formData()),
      { status: 201, headers: privateHeaders },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(request: Request) {
  const auth = denied(request);
  if (auth) return auth;
  try {
    const body = await request.json();
    if (body.action === "link")
      return NextResponse.json(await approvalLink(body.jobId), {
        headers: privateHeaders,
      });
    if (body.action !== "replace" && body.action !== "close")
      throw new ApprovalError("Invalid action.");
    const link = await manageApprovalLink(body.jobId, body.action);
    return NextResponse.json(
      { success: true, ...link },
      { headers: privateHeaders },
    );
  } catch (e) {
    return failure(e);
  }
}
