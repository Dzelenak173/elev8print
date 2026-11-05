import { APPROVAL_AGREEMENT } from "./approval-agreement";
export const TERMS_VERSION = "2026-11-05";
export const TERMS_DATE = "November 5, 2026";
export type TermsSection = { id: string; title: string; paragraphs: string[] };
// Display and retain the same text. Publish a new version for every change.
export const TERMS_SECTIONS: TermsSection[] = [
  {
    id: "acceptance",
    title: "1. About these terms",
    paragraphs: [
      "These Terms of Service apply to printing and related services provided by Elaborate Designs Inc., doing business as Elev8 Print (we, us, or our), through elev8print.com and orders arranged by email, message, or in person.",
      "Read these terms before placing an order or approving a proof. We request your express acceptance when you submit an online order and when you approve a final proof. The version presented at acceptance is retained with the order or proof record.",
    ],
  },
  {
    id: "services",
    title: "2. Our services",
    paragraphs: [
      "We provide custom stickers, labels, mylar bags, jar and packaging labels, decals, apparel decoration, design assistance, and related printing services. The products, quantities, materials, dimensions, finishes, prices, and delivery arrangements for your job are set out in its quote, invoice, and final proof specifications.",
    ],
  },
  {
    id: "orders",
    title: "3. Orders, payment, and timing",
    paragraphs: [
      "Orders are subject to our acceptance. Payment methods, amounts, and due dates are provided with your quote or invoice. Do not enter payment card information in an artwork approval form.",
      "Submitting an order, uploading artwork, or making payment does not approve a proof or authorize production. Production begins only after the required customer proof approval, our internal review, and any required payment are complete.",
      "Production and shipping times are separate. An estimate depends on receiving usable artwork, required permissions, payment, and final written approval. We will discuss material changes to the scope or price before proceeding with them.",
    ],
  },
  {
    id: "proofs",
    title: "4. Proof review and written approval",
    paragraphs: [
      "Before final printing, review every page and item in the proof and its written specifications. Check the artwork, wording, spelling, numbers, dimensions, quantity, layout, cut lines, material, and any white ink, spot UV, or other finishes specified for the job. Ask us about anything that is missing or unclear before approving.",
      "An on-screen proof shows the intended layout. Screen color and appearance may differ from physical materials, inks, textures, and finishes. If exact color or another critical physical characteristic is essential, tell us before approval so an appropriate sample or other agreed reference can be arranged.",
      "Approval applies only to the identified proof revision and specifications. Silence, payment, an earlier proof approval, or a general instruction to print is not approval of a revised proof.",
      "Request changes before approving if anything needs correction. Any later change affecting artwork or production specifications requires a new proof revision and new written approval. Contact us immediately to request a hold if work has already begun; a change may affect timing and cost, which we will confirm with you.",
    ],
  },
  {
    id: "intellectual",
    title: "5. Artwork rights and permission to print",
    paragraphs: [
      "You retain any intellectual property rights you hold in the material you provide. You represent that you own the material or have permission covering the intended reproduction, quantity, products, and commercial use, including relevant copyright, trademark, image, likeness, font, and other third-party rights. If you act for a business or another person, you confirm that you are authorized to do so.",
      "You authorize us and production providers assisting with your job to reproduce and make necessary production preparations to the approved material solely to fulfill the agreed job. This is not a transfer of ownership or permission to use your artwork for unrelated marketing.",
      "A file downloaded online, a purchased physical item, a similar design, or possession of an image does not by itself establish permission to reproduce it. We may request a license, written authorization, or other supporting information and may hold or decline work where rights or legality remain uncertain.",
      "Your rights confirmation and proof approval do not grant rights you do not have, resolve a third-party rights claim, or replace our review of identified concerns. Do not submit material for reproduction without the necessary rights.",
    ],
  },
  {
    id: "prohibited",
    title: "6. Material we may decline",
    paragraphs: [
      "Do not submit unlawful material, material that infringes another person's rights, false information, malicious files, or instructions intended to evade applicable law. We may refuse or pause a job to investigate a concern, request additional information, or comply with legal obligations. Approval is not a certification of regulatory or labeling compliance.",
    ],
  },
  {
    id: "errors",
    title: "7. Questions, corrections, and production concerns",
    paragraphs: [
      "Contact us promptly if a proof, order, or finished product appears incorrect. We review concerns against the approved proof, specifications, and circumstances. Proof approval records what you authorized; it does not waive rights that cannot lawfully be waived or excuse us from producing the agreed work.",
    ],
  },
  {
    id: "accounts",
    title: "8. Accounts and approval links",
    paragraphs: [
      "Provide accurate contact information and protect your account credentials. Approval links are confidential access links for the intended customer or their authorized representative. Do not publish or forward a link to an unauthorized person. Contact us if a link reaches the wrong recipient, expires, or needs to be replaced.",
    ],
  },
  {
    id: "records",
    title: "9. Electronic approval and records",
    paragraphs: [
      "When choosing to approve electronically, you consent to using electronic records for that approval and intend your typed name and submission to record your approval. The record includes your name and email, the date and time, the proof revision and file identifier, the specifications, the terms version, and the statements you accepted. You can save or print a copy. Contact us before approval if you need an alternative written approval method.",
      "We retain relevant proof, permission-review, and approval records for order fulfillment, reprints, dispute handling, and legal or insurance needs as described in our Privacy Policy. A request for changed artwork creates a new approval requirement; it does not erase the earlier record.",
    ],
  },
  {
    id: "limitation",
    title: "10. Limitation of liability",
    paragraphs: [
      "To the extent permitted by applicable law, Elev8 Print and its directors, employees, partners, agents, suppliers, and affiliates are not liable for indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, use, goodwill, or other intangible losses arising from use of our services.",
      "To the extent permitted by applicable law, our total liability arising out of these terms or our services will not exceed the amount you paid us in the twelve months preceding the event giving rise to the liability. These limitations do not apply where prohibited by law and do not exclude rights or liabilities that cannot lawfully be excluded.",
    ],
  },
  {
    id: "contact",
    title: "11. Contact and privacy",
    paragraphs: [
      "Elev8 Print. Email: office@elev8print.com.",
      "Our Privacy Policy at elev8print.com/privacy explains how we handle personal information. Contact us with questions about a job, these terms, your approval, or your records.",
    ],
  },
];
export function termsSnapshot() {
  return {
    version: TERMS_VERSION,
    sections: TERMS_SECTIONS,
    ...APPROVAL_AGREEMENT,
  };
}
