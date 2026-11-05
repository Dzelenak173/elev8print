// Development-only adapter. No API calls, durable approval records or emails.
import {
  sampleOrder,
  respondBatch,
  addProof,
  BATCH_CONSENTS,
  BATCH_PROMO,
  BATCH_SIGNATURE,
} from "./model.mjs";
function samples() {
  return sampleOrder().map((x) => ({
    ...x,
    proof: "/approval-assets/" + x.proof,
    consents: [...BATCH_CONSENTS],
    promoText: BATCH_PROMO,
    signatureText: BATCH_SIGNATURE,
  }));
}
/** @returns {import('../../../lib/approval-client').PortalAdapter} */
export function demoAdapter() {
  let records = samples();
  return {
    load: async () => structuredClone(records),
    create: async (values, file, baseId, jobId) => {
      const base = records.find((x) => x.id === baseId),
        art =
          file ||
          (base
            ? { proof: base.proof, filename: base.filename, type: base.type }
            : null);
      if (!art) throw Error("Upload a proof or choose the sample artwork.");
      const fields = {
        ...values,
        ...art,
        quantity: Number(values.quantity),
        width: Number(values.width),
        height: Number(values.height),
      };
      if (art.file)
        fields.proof = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(art.file);
        });
      const result = addProof(records, fields, baseId, jobId);
      records = result.records;
      for (const x of records) {
        if (x.status === "pending") {
          x.consents = [...BATCH_CONSENTS];
          x.promoText = BATCH_PROMO;
          x.signatureText = BATCH_SIGNATURE;
        }
      }
      return { records: structuredClone(records), proofId: result.proof.id };
    },
    respond: async (_records, jobId, decisions, input) => {
      records = respondBatch(records, jobId, decisions, input);
      return structuredClone(records);
    },
    link: async () => ({
      url: location.origin + "/approval-preview",
      expiresAt: "",
    }),
    reset: async () => {
      records = samples();
      return structuredClone(records);
    },
  };
}
