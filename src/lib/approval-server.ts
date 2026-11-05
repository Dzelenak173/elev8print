import { createHash, randomUUID } from "node:crypto";
import { supabase } from "./supabase-admin";
import { TERMS_VERSION, termsSnapshot } from "./terms";
import {
  APPROVAL_TOKEN_PATTERN,
  MAX_PROOF_BYTES,
  UUID_PATTERN,
  proofMime,
  validEmail,
  type ApprovalResponse,
} from "./approval-policy";
import {
  createApprovalToken,
  hashApprovalToken,
  openApprovalToken,
} from "./approval-token";
import type {
  ArtworkJob,
  ArtworkProof,
  PortalRecord,
  PrintSpecs,
} from "./approval-types";
export class ApprovalError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
export const privateHeaders = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};
function databaseError(error: { code?: string; message?: string }): never {
  if (error.code === "P0001")
    throw new ApprovalError(
      error.message || "Please refresh the current proofs.",
      409,
    );
  if (error.code === "23505")
    throw new ApprovalError(
      "This website order already has an approval job. Open it and add a design or revision.",
      409,
    );
  console.error(
    "Artwork approval database error:",
    error.code || "unavailable",
  );
  throw new ApprovalError(
    "Artwork approvals are temporarily unavailable. Please contact Elev8 Print.",
    503,
  );
}
function text(form: FormData, key: string, min: number, max: number) {
  const v = form.get(key);
  if (typeof v !== "string" || v.trim().length < min || v.trim().length > max)
    throw new ApprovalError(`Complete ${key} (${min}-${max} characters).`);
  return v.trim();
}
function optionalUuid(form: FormData, key: string) {
  const value = String(form.get(key) || "");
  if (value && !UUID_PATTERN.test(value))
    throw new ApprovalError("Choose a valid job, order or proof.");
  return value;
}
function specs(form: FormData): PrintSpecs {
  const number = (key: string, max: number, whole = false) => {
    const v = Number(form.get(key));
    if (
      !Number.isFinite(v) ||
      v <= 0 ||
      v > max ||
      (whole && !Number.isInteger(v))
    )
      throw new ApprovalError(`Enter a valid ${key}.`);
    return v;
  };
  const units = form.get("units");
  if (units !== "in" && units !== "mm" && units !== "cm")
    throw new ApprovalError("Choose inches, mm or cm.");
  return {
    product: text(form, "product", 1, 120),
    quantity: number("quantity", 10000000, true),
    width: number("width", 100000),
    height: number("height", 100000),
    units,
    material: text(form, "material", 1, 160),
    finish: text(form, "finish", 1, 160),
    special: text(form, "special", 0, 4000),
    notes: text(form, "notes", 0, 4000),
  };
}
async function jobById(id: string): Promise<ArtworkJob> {
  if (!UUID_PATTERN.test(id)) throw new ApprovalError("Invalid approval job.");
  const { data, error } = await supabase
    .from("artwork_jobs")
    .select("*, artwork_proofs(*)")
    .eq("id", id)
    .single();
  if (error) databaseError(error);
  return data as ArtworkJob;
}
async function portalRecords(
  jobs: ArtworkJob[],
  staff: boolean,
): Promise<PortalRecord[]> {
  const paths = jobs.flatMap((j) => j.artwork_proofs.map((p) => p.proof_path));
  const links = new Map<string, string>();
  for (let i = 0; i < paths.length; i += 100) {
    const { data, error } = await supabase.storage
      .from("artwork-proofs")
      .createSignedUrls(paths.slice(i, i + 100), 300);
    if (error) databaseError(error);
    for (const f of data || []) {
      if (f.error || !f.signedUrl)
        throw new ApprovalError(
          "A proof file is unavailable. Contact Elev8 Print.",
          503,
        );
      links.set(f.path || "", f.signedUrl);
    }
  }
  return jobs
    .flatMap((j) =>
      j.artwork_proofs.map(
        (p): PortalRecord => ({
          ...p.print_specs,
          id: p.id,
          orderId: j.id,
          websiteOrderId: j.order_id,
          jobVersion: j.version,
          designId: p.design_id,
          designName: p.design_name,
          order: j.reference,
          customer: j.customer_name,
          email: j.customer_email,
          version: p.revision,
          proof: links.get(p.proof_path) || "",
          filename: p.proof_filename,
          type: p.proof_mime,
          sha256: p.proof_sha256,
          status: p.status === "changes_requested" ? "changes" : p.status,
          created: p.created_at,
          termsVersion: p.terms_version,
          terms: p.terms_snapshot.approvalTerms,
          fullTerms: p.terms_snapshot.sections,
          consents: p.terms_snapshot.approvalStatements,
          promoText: p.terms_snapshot.promotionalText,
          promoNote: p.terms_snapshot.promotionalNote,
          signatureText: p.terms_snapshot.signatureText,
          linkExpiresAt: j.expires_at,
          jobClosed: !!j.cancelled_at,
          ...(staff
            ? {
                reviewer: p.reviewer_name,
                reviewNotes: p.review_notes,
                reviewedAt: p.reviewed_at,
              }
            : {}),
          ...(p.responded_at
            ? {
                response: {
                  name: p.signer_name || "",
                  email: p.signer_email || "",
                  business: p.signer_business || "",
                  at: p.responded_at,
                  consents:
                    p.status === "approved"
                      ? [p.proof_approved, p.rights_confirmed, p.terms_accepted]
                      : [],
                  promotional: p.promotional,
                  restrictions: p.promotional_restrictions,
                  comments: p.change_notes || "",
                  termsVersion: p.terms_version,
                  batchId: p.submission_id || "",
                  approvedProofIds: p.approved_proof_ids || [],
                },
              }
            : {}),
        }),
      ),
    )
    .sort(
      (a, b) =>
        Date.parse(b.created) - Date.parse(a.created) ||
        a.id.localeCompare(b.id),
    );
}
export async function staffPortal(offset = 0) {
  const { data, error } = await supabase
    .from("artwork_jobs")
    .select("*, artwork_proofs(*)")
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .range(offset, offset + 49);
  if (error) databaseError(error);
  const jobs = data as ArtworkJob[];
  return {
    records: await portalRecords(jobs, true),
    hasMore: jobs.length === 50,
    nextOffset: offset + jobs.length,
  };
}
export async function staffJob(jobId: string) {
  return portalRecords([await jobById(jobId)], true);
}
export async function staffOrder(orderId: string) {
  if (!UUID_PATTERN.test(orderId))
    throw new ApprovalError("Invalid website order.");
  const { data, error } = await supabase
    .from("artwork_jobs")
    .select("*, artwork_proofs(*)")
    .eq("order_id", orderId)
    .maybeSingle();
  if (error) databaseError(error);
  return data ? portalRecords([data as ArtworkJob], true) : [];
}
export async function customerPortal(token: string) {
  if (!APPROVAL_TOKEN_PATTERN.test(token))
    throw new ApprovalError(
      "Open the complete approval link sent by Elev8 Print.",
      404,
    );
  const { data, error } = await supabase
    .from("artwork_jobs")
    .select("*, artwork_proofs(*)")
    .eq("token_hash", hashApprovalToken(token))
    .maybeSingle();
  if (error) databaseError(error);
  if (!data)
    throw new ApprovalError(
      "This approval link was not found. Contact Elev8 Print.",
      404,
    );
  const job = data as ArtworkJob;
  if (job.cancelled_at || Date.parse(job.expires_at) <= Date.now())
    throw new ApprovalError(
      "This approval link is closed or expired. Contact Elev8 Print for a replacement.",
      410,
    );
  const records = await portalRecords([job], false);
  if (!records.length)
    throw new ApprovalError("No proofs are available for this job.", 404);
  return records;
}
export async function createArtworkProof(form: FormData) {
  if (form.get("review_confirmed") !== "true")
    throw new ApprovalError(
      "Complete the internal artwork and rights review first.",
    );
  const reference = text(form, "order", 1, 160),
    customerName = text(form, "customer", 2, 120),
    email = text(form, "email", 3, 254).toLowerCase();
  if (!validEmail(email))
    throw new ApprovalError("Enter a valid customer email.");
  const designName = text(form, "designName", 1, 160),
    printSpecs = specs(form),
    reviewerName = text(form, "reviewer_name", 2, 120),
    reviewNotes = text(form, "review_notes", 10, 4000);
  const jobId = optionalUuid(form, "job_id") || randomUUID(),
    orderId = optionalUuid(form, "order_id"),
    baseId = optionalUuid(form, "base_proof_id"),
    proofId = randomUUID(),
    designId = randomUUID();
  // Existing files can only be reused from the same authorized job / revision.
  let file = form.get("proof"),
    path = "",
    mime = "",
    filename = "",
    sha = "";
  if (file instanceof File && file.size) {
    if (file.size > MAX_PROOF_BYTES)
      throw new ApprovalError("Choose a proof no larger than 2 MB.");
    const bytes = Buffer.from(await file.arrayBuffer());
    mime = proofMime(bytes) || "";
    if (!mime) throw new ApprovalError("Use a PDF, PNG, JPG or WebP proof.");
    const ext = (
      {
        "application/pdf": "pdf",
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/webp": "webp",
      } as Record<string, string>
    )[mime];
    path = `${jobId}/${proofId}.${ext}`;
    filename = file.name.slice(0, 200);
    sha = createHash("sha256").update(bytes).digest("hex");
    const { error } = await supabase.storage
      .from("artwork-proofs")
      .upload(path, bytes, {
        contentType: mime,
        upsert: false,
        cacheControl: "0",
      });
    if (error) databaseError(error);
  } else if (baseId) {
    const job = await jobById(jobId),
      base = job.artwork_proofs.find((p) => p.id === baseId);
    if (!base) throw new ApprovalError("Choose a proof from this job.");
    // New object identity preserves the reviewed file while permitting spec-only revisions.
    const newPath = `${jobId}/${proofId}.${base.proof_path.split(".").pop()}`;
    const { error } = await supabase.storage
      .from("artwork-proofs")
      .copy(base.proof_path, newPath);
    if (error) databaseError(error);
    path = newPath;
    mime = base.proof_mime;
    filename = base.proof_filename;
    sha = base.proof_sha256;
  } else throw new ApprovalError("Upload the artwork proof.");
  const access = createApprovalToken();
  const { data, error } = await supabase.rpc("create_artwork_proof", {
    p: {
      id: proofId,
      job_id: jobId,
      order_id: orderId || null,
      base_proof_id: baseId || null,
      design_id: designId,
      design_name: designName,
      reference,
      customer_name: customerName,
      customer_email: email,
      token_hash: access.hash,
      token_sealed: access.sealed,
      proof_path: path,
      proof_filename: filename,
      proof_mime: mime,
      proof_sha256: sha,
      print_specs: printSpecs,
      terms_version: TERMS_VERSION,
      terms_snapshot: termsSnapshot(),
      reviewer_name: reviewerName,
      review_notes: reviewNotes,
      review_confirmed: true,
    },
  });
  // Never delete an uploaded object after an ambiguous RPC response: it may already be referenced by a committed proof.
  if (error) databaseError(error);
  const proof = (Array.isArray(data) ? data[0] : data) as ArtworkProof | null;
  if (!proof?.id)
    throw new ApprovalError(
      "The proof may have been saved. Refresh the job history before trying again.",
      503,
    );
  return {
    proofId: proof.id,
    jobId: proof.job_id,
    records: await staffJob(proof.job_id),
  };
}
export async function respondToJob(response: ApprovalResponse) {
  const { error } = await supabase.rpc("respond_to_artwork_job", {
    p_hash: hashApprovalToken(response.token),
    p: response,
  });
  if (error) databaseError(error);
}
export async function approvalLink(jobId: string) {
  const job = await jobById(jobId);
  if (job.cancelled_at || Date.parse(job.expires_at) <= Date.now())
    throw new ApprovalError(
      "This link is closed or expired. Replace an expired link before sending it.",
      410,
    );
  try {
    const token = openApprovalToken(job.token_sealed);
    if (hashApprovalToken(token) !== job.token_hash)
      throw Error("Link mismatch");
    return { token, expiresAt: job.expires_at };
  } catch {
    throw new ApprovalError(
      "This saved link cannot be opened. Replace it to issue a new link.",
      409,
    );
  }
}
export async function manageApprovalLink(
  jobId: string,
  action: "replace" | "close",
) {
  if (!UUID_PATTERN.test(jobId))
    throw new ApprovalError("Invalid approval job.");
  const access = action === "replace" ? createApprovalToken() : null;
  const { error } = await supabase.rpc("manage_artwork_link", {
    p_job_id: jobId,
    p_action: action,
    p_hash: access?.hash || null,
    p_sealed: access?.sealed || null,
  });
  if (error) databaseError(error);
  return action === "replace" ? approvalLink(jobId) : null;
}
