import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import {
  parseApprovalResponse,
  requireCheckoutConsent,
  proofMime,
} from "../src/lib/approval-policy.ts";
import { verifyAdminToken } from "../src/lib/auth.ts";
import {
  createApprovalToken,
  hashApprovalToken,
  openApprovalToken,
} from "../src/lib/approval-token.ts";
import { termsSnapshot, TERMS_VERSION } from "../src/lib/terms.ts";
const decision = {
  proofId: randomUUID(),
  revision: 1,
  proofSha256: "b".repeat(64),
  termsVersion: TERMS_VERSION,
  action: "approve",
  changeNotes: "",
};
const response = {
  token: "a".repeat(43),
  jobVersion: 2,
  signerName: "Sample Customer",
  signerEmail: "SAMPLE@example.com",
  consents: [true, true, true],
  electronicConsent: true,
  promotional: false,
  decisions: [decision],
};
test("all three explicit statements and signature intent are required for an approval", () => {
  assert.equal(
    parseApprovalResponse(response).signerEmail,
    "sample@example.com",
  );
  for (const value of [false, undefined, "true", 1]) {
    assert.throws(() =>
      parseApprovalResponse({ ...response, consents: [true, true, value] }),
    );
    assert.throws(() =>
      parseApprovalResponse({ ...response, electronicConsent: value }),
    );
  }
  for (const patch of [
    { token: "short" },
    { jobVersion: 1.1 },
    { signerName: "" },
    { signerEmail: "invalid" },
    { decisions: [] },
    { decisions: [decision, decision] },
    { decisions: [{ ...decision, revision: 1.1 }] },
    { decisions: [{ ...decision, proofSha256: "bad" }] },
  ])
    assert.throws(() => parseApprovalResponse({ ...response, ...patch }));
});
test("changes require comments and never inherit approval or promotional consent", () => {
  const changed = {
    ...response,
    consents: [],
    electronicConsent: false,
    promotional: true,
    restrictions: "Not allowed",
    decisions: [
      {
        ...decision,
        action: "request_changes",
        changeNotes: "  Move cut line.  ",
      },
    ],
  };
  const parsed = parseApprovalResponse(changed);
  assert.equal(parsed.decisions[0].changeNotes, "Move cut line.");
  assert.equal(parsed.promotional, false);
  assert.equal(parsed.restrictions, "");
  assert.equal(parsed.electronicConsent, false);
  assert.throws(() =>
    parseApprovalResponse({
      ...changed,
      decisions: [{ ...changed.decisions[0], changeNotes: " " }],
    }),
  );
});
test("promotional consent is strictly opt-in, version scoped and restrictions require that opt-in", () => {
  assert.equal(
    parseApprovalResponse({
      ...response,
      promotional: "true",
      restrictions: "test",
    }).promotional,
    false,
  );
  assert.equal(
    parseApprovalResponse({
      ...response,
      promotional: false,
      restrictions: "test",
    }).restrictions,
    "",
  );
  assert.equal(
    parseApprovalResponse({
      ...response,
      promotional: true,
      restrictions: "  After launch  ",
    }).restrictions,
    "After launch",
  );
  assert.throws(() =>
    parseApprovalResponse({
      ...response,
      decisions: [
        decision,
        { ...decision, proofId: randomUUID(), termsVersion: "different" },
      ],
    }),
  );
});
test("checkout requires both statements and the same retained version of the full terms", () => {
  const acceptance = {
    termsAccepted: true,
    rightsConfirmed: true,
    termsVersion: TERMS_VERSION,
  };
  requireCheckoutConsent({ acceptance }, TERMS_VERSION);
  for (const patch of [
    { termsVersion: "old" },
    { termsAccepted: false },
    { rightsConfirmed: "true" },
  ])
    assert.throws(() =>
      requireCheckoutConsent(
        { acceptance: { ...acceptance, ...patch } },
        TERMS_VERSION,
      ),
    );
  assert.throws(() => requireCheckoutConsent({}, TERMS_VERSION));
  const snapshot = termsSnapshot();
  assert.equal(snapshot.version, TERMS_VERSION);
  assert.equal(snapshot.sections.length, 11);
  assert.equal(snapshot.approvalStatements.length, 3);
  assert.equal(snapshot.approvalTerms.length, 4);
});
test("file type is identified by bytes rather than a renamed filename", () => {
  assert.equal(
    proofMime(new TextEncoder().encode("%PDF-1.7")),
    "application/pdf",
  );
  assert.equal(
    proofMime(Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])),
    "image/png",
  );
  assert.equal(proofMime(Uint8Array.from([255, 216, 255, 1])), "image/jpeg");
  assert.equal(
    proofMime(new TextEncoder().encode("RIFFxxxxWEBP")),
    "image/webp",
  );
  assert.equal(
    proofMime(new TextEncoder().encode("<script>bad</script>")),
    null,
  );
});
test("saved links use authenticated encryption, reject tampering and fail safely after key rotation", () => {
  process.env.JWT_SECRET = "test-only-original-key";
  const a = createApprovalToken(),
    b = createApprovalToken();
  assert.match(a.token, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(a.token, b.token);
  assert.equal(a.hash, hashApprovalToken(a.token));
  assert.equal(openApprovalToken(a.sealed), a.token);
  assert.ok(!a.sealed.includes(a.token));
  const parts = a.sealed.split(".");
  parts[3] = (parts[3][0] === "A" ? "B" : "A") + parts[3].slice(1);
  assert.throws(() => openApprovalToken(parts.join(".")));
  process.env.JWT_SECRET = "test-only-new-key";
  assert.throws(() => openApprovalToken(a.sealed));
});
test("admin auth rejects signed customer, expired and malformed tokens", () => {
  process.env.JWT_SECRET = "test-only-auth-key";
  for (const value of [
    null,
    "Bearer broken",
    `Bearer ${jwt.sign({ role: "customer" }, process.env.JWT_SECRET)}`,
    `Bearer ${jwt.sign({ role: "admin" }, process.env.JWT_SECRET, { expiresIn: -1 })}`,
  ])
    assert.equal(verifyAdminToken(value), null);
  assert.equal(
    verifyAdminToken(
      `Bearer ${jwt.sign({ role: "admin" }, process.env.JWT_SECRET)}`,
    ).role,
    "admin",
  );
});
