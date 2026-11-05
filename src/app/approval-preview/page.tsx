import { notFound } from "next/navigation";
import ApprovalExample from "./preview-client";

export const metadata = {
  title: "Artwork approval sample | Elev8 Print",
  robots: { index: false, follow: false },
};

// Local or Vercel review builds only; the live production site returns 404.
export default function ApprovalPreviewPage() {
  if (process.env.NODE_ENV !== "development" && process.env.VERCEL_ENV !== "preview") notFound();
  return <ApprovalExample />;
}
