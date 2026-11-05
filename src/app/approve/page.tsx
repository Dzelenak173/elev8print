import type { Metadata } from "next";
import ProofPortal from "@/components/approvals/ProofPortal";
export const metadata: Metadata = {
  title: "Artwork approval | Elev8 Print",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function ApprovalPage() {
  return <ProofPortal />;
}
