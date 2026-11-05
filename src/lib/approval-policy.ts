export const APPROVAL_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const UUID_PATTERN =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export const MAX_PROOF_BYTES = 2 * 1024 * 1024;
export const PRODUCTION_STATUSES = [
  "producing",
  "qc_check",
  "shipped",
  "delivered",
  "completed",
];
export const ORDER_STATUSES = [
  "received",
  "processing",
  ...PRODUCTION_STATUSES,
  "cancelled",
];
export type ProofDecision = {
  proofId: string;
  revision: number;
  proofSha256: string;
  termsVersion: string;
  action: "approve" | "request_changes";
  changeNotes: string;
};
export type ApprovalResponse = {
  token: string;
  jobVersion: number;
  signerName: string;
  signerEmail: string;
  business: string;
  consents: boolean[];
  electronicConsent: boolean;
  promotional: boolean;
  restrictions: string;
  decisions: ProofDecision[];
};
export function validEmail(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}
export function parseApprovalResponse(
  body: Record<string, unknown>,
): ApprovalResponse {
  if (
    typeof body.token !== "string" ||
    !APPROVAL_TOKEN_PATTERN.test(body.token)
  )
    throw Error("This approval link is invalid.");
  if (!Number.isSafeInteger(body.jobVersion) || Number(body.jobVersion) < 1)
    throw Error("Refresh the proofs before submitting.");
  if (
    typeof body.signerName !== "string" ||
    body.signerName.trim().length < 2 ||
    body.signerName.trim().length > 120
  )
    throw Error("Enter your full name.");
  if (!validEmail(body.signerEmail))
    throw Error("Enter the email address this order was issued to.");
  if (
    !Array.isArray(body.decisions) ||
    !body.decisions.length ||
    body.decisions.length > 200
  )
    throw Error("Choose a response for at least one design.");
  const seen = new Set<string>();
  const decisions = body.decisions.map((value: unknown): ProofDecision => {
    if (!value || typeof value !== "object")
      throw Error("Invalid design response.");
    const d = value as Record<string, unknown>;
    if (
      typeof d.proofId !== "string" ||
      !UUID_PATTERN.test(d.proofId) ||
      seen.has(d.proofId)
    )
      throw Error("Choose one response per design.");
    seen.add(d.proofId);
    if (
      !Number.isSafeInteger(d.revision) ||
      Number(d.revision) < 1 ||
      typeof d.proofSha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(d.proofSha256) ||
      typeof d.termsVersion !== "string" ||
      !d.termsVersion ||
      d.termsVersion.length > 40
    )
      throw Error("Refresh and review the current proof.");
    if (d.action !== "approve" && d.action !== "request_changes")
      throw Error("Choose approval or request changes.");
    const changeNotes =
      typeof d.changeNotes === "string" ? d.changeNotes.trim() : "";
    if (
      changeNotes.length > 4000 ||
      (d.action === "request_changes" && !changeNotes)
    )
      throw Error(
        "Describe the requested changes for each selected design (up to 4,000 characters).",
      );
    return {
      proofId: d.proofId,
      revision: Number(d.revision),
      proofSha256: d.proofSha256,
      termsVersion: d.termsVersion,
      action: d.action,
      changeNotes,
    };
  });
  const approves = decisions.some((d) => d.action === "approve");
  if (
    approves &&
    (!Array.isArray(body.consents) ||
      body.consents.length !== 3 ||
      body.consents.some((v) => v !== true) ||
      body.electronicConsent !== true)
  )
    throw Error("Confirm all three approval statements before signing.");
  if (
    new Set(
      decisions
        .filter((d) => d.action === "approve")
        .map((d) => d.termsVersion),
    ).size > 1
  )
    throw Error(
      "Select designs with the same terms version, or submit them separately.",
    );
  const business =
    typeof body.business === "string" ? body.business.trim() : "";
  const restrictions =
    typeof body.restrictions === "string" ? body.restrictions.trim() : "";
  if (business.length > 160 || restrictions.length > 4000)
    throw Error("Please shorten the business name or sharing restrictions.");
  return {
    token: body.token,
    jobVersion: Number(body.jobVersion),
    signerName: body.signerName.trim(),
    signerEmail: body.signerEmail.toLowerCase(),
    business,
    consents: approves ? [true, true, true] : [],
    electronicConsent: approves,
    promotional: approves && body.promotional === true,
    restrictions: approves && body.promotional === true ? restrictions : "",
    decisions,
  };
}
export function requireCheckoutConsent(
  body: Record<string, unknown>,
  version: string,
) {
  const c = body.acceptance as Record<string, unknown> | undefined;
  if (
    !c ||
    c.termsAccepted !== true ||
    c.rightsConfirmed !== true ||
    c.termsVersion !== version
  )
    throw Error(
      "Please accept the current terms and confirm your artwork rights before placing the order.",
    );
}
export function proofMime(b: Uint8Array): string | null {
  if (b.length >= 5 && String.fromCharCode(...b.slice(0, 5)) === "%PDF-")
    return "application/pdf";
  if (
    b.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => b[i] === n)
  )
    return "image/png";
  if (b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255)
    return "image/jpeg";
  if (
    b.length >= 12 &&
    String.fromCharCode(...b.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...b.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  return null;
}
