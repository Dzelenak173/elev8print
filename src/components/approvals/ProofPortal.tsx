"use client";

import { useEffect, useRef } from "react";
import {
  customerAdapter,
  staffAdapter,
  type PortalAdapter,
  type WebsiteOrder,
} from "@/lib/approval-client";
import { mountApproval } from "./original/app.mjs";
import "./original/style.css";

const EMPTY_ORDERS: WebsiteOrder[] = [];
export default function ProofPortal({
  staff = false,
  demo = false,
  websiteOrders = EMPTY_ORDERS,
  selectedOrderId,
}: {
  staff?: boolean;
  demo?: boolean;
  websiteOrders?: WebsiteOrder[];
  selectedOrderId?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let stopped = false,
      unmount: (() => void) | undefined;
    async function mount() {
      const adapter: PortalAdapter = demo
        ? (await import("./original/demo.mjs")).demoAdapter()
        : staff
          ? staffAdapter(selectedOrderId)
          : customerAdapter();
      if (stopped || !root.current) return;
      unmount = mountApproval(root.current, adapter, {
        kind: demo ? "demo" : staff ? "staff" : "customer",
        websiteOrders,
        selectedOrderId,
      });
    }
    mount();
    return () => {
      stopped = true;
      unmount?.();
    };
  }, [staff, demo, websiteOrders, selectedOrderId]);
  return (
    <div ref={root} className="artwork-portal">
      <p role="status">Loading artwork approvals…</p>
    </div>
  );
}
