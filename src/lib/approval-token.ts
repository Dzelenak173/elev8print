import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

function encryptionKey() {
  if (!process.env.JWT_SECRET)
    throw new Error("Admin signing configuration is missing.");
  return createHash("sha256")
    .update("elev8-approval-link-v1\0" + process.env.JWT_SECRET)
    .digest();
}
export function hashApprovalToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export function createApprovalToken() {
  const token = randomBytes(32).toString("base64url");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  return {
    token,
    hash: hashApprovalToken(token),
    sealed: [
      "v1",
      iv.toString("base64url"),
      cipher.getAuthTag().toString("base64url"),
      encrypted.toString("base64url"),
    ].join("."),
  };
}
export function openApprovalToken(sealed: string) {
  const [version, nonce, tag, body] = sealed.split(".");
  if (version !== "v1" || !nonce || !tag || !body)
    throw new Error("Approval link could not be opened. Replace the link.");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(nonce, "base64url"),
  );
  cipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    cipher.update(Buffer.from(body, "base64url")),
    cipher.final(),
  ]).toString("utf8");
}
