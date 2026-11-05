import { NextResponse } from "next/server";
import {
  ApprovalError,
  customerPortal,
  privateHeaders,
  respondToJob,
} from "@/lib/approval-server";
import { parseApprovalResponse } from "@/lib/approval-policy";
export const runtime = "nodejs";
// Customer secrets travel in POST bodies, never query strings, referrers or GET actions.
export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length")) > 1024 * 1024)
      throw new ApprovalError("Request too large.", 413);
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 1024 * 1024)
      throw new ApprovalError("Request too large.", 413);
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new ApprovalError("Invalid approval request.");
    }
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new ApprovalError("Invalid approval request.");
    if (body.action !== "lookup") {
      if (body.action !== "respond") throw new ApprovalError("Invalid action.");
      let response;
      try {
        response = parseApprovalResponse(body);
      } catch (e) {
        throw new ApprovalError(
          e instanceof Error ? e.message : "Invalid response.",
        );
      }
      await respondToJob(response);
    }
    return NextResponse.json(
      {
        records: await customerPortal(
          typeof body.token === "string" ? body.token : "",
        ),
      },
      { headers: privateHeaders },
    );
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof ApprovalError
            ? e.message
            : "Unable to load this approval. Contact Elev8 Print.",
      },
      {
        status: e instanceof ApprovalError ? e.status : 500,
        headers: privateHeaders,
      },
    );
  }
}
