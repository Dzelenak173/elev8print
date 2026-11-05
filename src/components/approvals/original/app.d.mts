import type { PortalAdapter, WebsiteOrder } from "../../../lib/approval-client";
export function mountApproval(
  root: HTMLElement,
  adapter: PortalAdapter,
  options?: {
    kind?: "customer" | "staff" | "demo";
    websiteOrders?: WebsiteOrder[];
    selectedOrderId?: string;
  },
): () => void;
