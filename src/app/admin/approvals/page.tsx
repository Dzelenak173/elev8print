import { redirect } from "next/navigation";
import { UUID_PATTERN } from "@/lib/approval-policy";
export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string | string[] }>;
}) {
  const { order } = await searchParams;
  redirect(
    "/admin?tab=approvals" +
      (typeof order === "string" && UUID_PATTERN.test(order)
        ? "&order=" + encodeURIComponent(order)
        : ""),
  );
}
