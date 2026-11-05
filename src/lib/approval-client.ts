import type { PortalRecord } from "./approval-types";

export type WebsiteOrder = {
  id: string;
  track_id: string;
  customer_name: string;
  customer_email: string;
  status: string;
};
export type PortalInput = {
  name: string;
  email: string;
  business: string;
  consents: boolean[];
  promotional: boolean;
  restrictions: string;
};
export type PortalDecisions = Record<
  string,
  { action: "approve" | "changes" | "later"; comments?: string }
>;
export type PortalAdapter = {
  load: () => Promise<PortalRecord[]>;
  create?: (
    values: Record<string, string>,
    file: { file?: File } | null,
    baseId: string | null,
    jobId: string | null,
    orderId: string | null,
  ) => Promise<{ records: PortalRecord[]; proofId: string }>;
  respond?: (
    records: PortalRecord[],
    jobId: string,
    decisions: PortalDecisions,
    input: PortalInput,
  ) => Promise<PortalRecord[]>;
  link?: (
    jobId: string,
    action?: "link" | "replace",
  ) => Promise<{ url: string; expiresAt: string }>;
  close?: (jobId: string) => Promise<void>;
  more?: () => Promise<PortalRecord[]>;
  hasMore?: () => boolean;
  reset?: () => Promise<PortalRecord[]>;
};

async function request(path: string, init: RequestInit = {}, staff = false) {
  const headers = new Headers(init.headers);
  if (staff) {
    const token = localStorage.getItem("adminToken");
    if (!token)
      throw Error(
        "Sign in to the Orders dashboard to manage artwork approvals.",
      );
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(path, {
    ...init,
    headers,
    cache: "no-store",
    referrerPolicy: "no-referrer",
  });
  const result = await response
    .json()
    .catch(() => ({
      error: "Unable to load approvals. Refresh and try again.",
    }));
  if (!response.ok) throw Error(result.error || "Unable to load approvals.");
  return result;
}
const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
function customerToken() {
  const token = location.hash.slice(1);
  if (!/^[A-Za-z0-9_-]{43}$/.test(token))
    throw Error(
      "Open the complete private approval link sent to you by Elev8 Print.",
    );
  return token;
}
export function customerAdapter(): PortalAdapter {
  return {
    load: async () => {
      const data = await request(
        "/api/artwork-approval",
        json({ action: "lookup", token: customerToken() }),
      );
      return data.records;
    },
    respond: async (records, jobId, decisions, input) => {
      const selected = records.filter(
        (r) =>
          r.orderId === jobId &&
          r.status === "pending" &&
          decisions[r.id] &&
          decisions[r.id].action !== "later",
      );
      if (!selected.length)
        throw Error("Choose a response for at least one design.");
      const data = await request(
        "/api/artwork-approval",
        json({
          action: "respond",
          token: customerToken(),
          jobVersion: selected[0].jobVersion,
          signerName: input.name,
          signerEmail: input.email,
          business: input.business,
          consents: input.consents,
          electronicConsent: selected.some(
            (r) => decisions[r.id].action === "approve",
          ),
          promotional: input.promotional,
          restrictions: input.restrictions,
          decisions: selected.map((r) => ({
            proofId: r.id,
            revision: r.version,
            proofSha256: r.sha256,
            termsVersion: r.termsVersion,
            action:
              decisions[r.id].action === "approve"
                ? "approve"
                : "request_changes",
            changeNotes: decisions[r.id].comments || "",
          })),
        }),
      );
      return data.records;
    },
  };
}
export function staffAdapter(selectedOrderId?: string): PortalAdapter {
  let offset = 0,
    hasMore = false;
  const page = async (start: number) => {
    const data = await request(`/api/artwork-proofs?offset=${start}`, {}, true);
    offset = data.nextOffset;
    hasMore = data.hasMore;
    return data.records as PortalRecord[];
  };
  return {
    load: async () => {
      const records = await page(0);
      if (
        selectedOrderId &&
        !records.some((r) => r.websiteOrderId === selectedOrderId)
      ) {
        const data = await request(
          `/api/artwork-proofs?orderId=${encodeURIComponent(selectedOrderId)}`,
          {},
          true,
        );
        return [...records, ...data.records];
      }
      return records;
    },
    more: () => page(offset),
    hasMore: () => hasMore,
    create: async (values, file, baseId, jobId, orderId) => {
      const form = new FormData();
      for (const [key, value] of Object.entries(values)) form.set(key, value);
      if (file?.file) form.set("proof", file.file);
      if (baseId) form.set("base_proof_id", baseId);
      if (jobId) form.set("job_id", jobId);
      if (orderId) form.set("order_id", orderId);
      return request(
        "/api/artwork-proofs",
        { method: "POST", body: form },
        true,
      );
    },
    link: async (jobId, action = "link") => {
      const data = await request(
        "/api/artwork-proofs",
        { ...json({ action, jobId }), method: "PATCH" },
        true,
      );
      const origin =
        process.env.NODE_ENV === "production"
          ? "https://www.elev8print.com"
          : location.origin;
      return {
        url: `${origin}/approve#${data.token}`,
        expiresAt: data.expiresAt,
      };
    },
    close: async (jobId) => {
      await request(
        "/api/artwork-proofs",
        { ...json({ action: "close", jobId }), method: "PATCH" },
        true,
      );
    },
  };
}
