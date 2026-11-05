// Presentation preserved from the approved October 20 multi-design preview.
// Source: 66960e271d7fb34b6c35ae9cb5533e94bfbb90c9. Persistence is supplied by an adapter.
import {
  currentDesigns,
  BATCH_CONSENTS,
  BATCH_PROMO,
  BATCH_SIGNATURE,
  PROMO_NOTE,
} from "./model.mjs";
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function mountApproval(root, adapter, options = {}) {
  const $ = (s) => root.querySelector(s),
    $$ = (s) => root.querySelectorAll(s);
  const modeKind = options.kind || "customer",
    isDemo = modeKind === "demo";
  const websiteOrders = options.websiteOrders || [];
  const disabledState = new WeakMap();
  let records = [],
    selected = "",
    mode = modeKind === "staff" ? "studio" : "customer",
    editing = false,
    baseId = null,
    draftFile = null,
    addOrderId = null;
  let websiteOrderId = options.selectedOrderId || null,
    decisions = {},
    identity = {},
    disposed = false,
    busy = false,
    toastTimer;
  const objectUrls = new Set();
  root.innerHTML =
    '<div id="app"></div><div id="toast" role="status" aria-live="polite"></div>';
  const empty = {
    orderId: "",
    order: "New order",
    customer: "",
    email: "",
    designName: "",
    status: "pending",
  };
  const p = () => records.find((x) => x.id === selected) || records[0] || empty;
  function clearReview() {
    decisions = {};
    identity = {
      name: "",
      email: "",
      business: "",
      consents: [false, false, false],
      promotional: false,
      restrictions: "",
    };
  }
  clearReview();
  function merge(next) {
    const ids = new Set(next.map((x) => x.orderId));
    records = [...next, ...records.filter((x) => !ids.has(x.orderId))];
  }
  function setRecords(next) {
    records = next;
    if (!records.some((x) => x.id === selected))
      selected = records[0]?.id || "";
  }
  function releaseDraft() {
    if (draftFile?.proof?.startsWith("blob:")) {
      URL.revokeObjectURL(draftFile.proof);
      objectUrls.delete(draftFile.proof);
    }
    draftFile = null;
  }
  const labels = {
    pending: "Awaiting approval",
    approved: "Approved",
    changes: "Changes requested",
    superseded: "Replaced by newer proof",
  };
  function toast(msg) {
    if (disposed) return;
    $("#toast").textContent = msg;
    $("#toast").style.display = "block";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      if (!disposed) $("#toast").style.display = "none";
    }, 6000);
  }
  function setBusy(value) {
    busy = value;
    root.setAttribute("aria-busy", String(value));
    $$("button,input,select,textarea").forEach((e) => {
      if (value) {
        disabledState.set(e, e.disabled);
        e.disabled = true;
      } else if (disabledState.has(e)) {
        e.disabled = disabledState.get(e);
        disabledState.delete(e);
      }
    });
  }
  function fullTerms(x) {
    return x.fullTerms?.length
      ? `<details><summary>Full order terms · ${esc(x.termsVersion)}</summary>${x.fullTerms.map((t) => `<h3>${esc(t.title)}</h3><p>${t.paragraphs.map((p) => esc(p)).join("<br><br>")}</p>`).join("")}</details>`
      : "";
  }
  function header() {
    return `${isDemo ? '<div class="demo"><span><span class="demo-dot"></span><b>WORKING PREVIEW</b><span class="demo-detail">Sample workflow · Test data only · No emails sent</span></span><button id="about">How to try it</button></div>' : ""}<header class="header"><div class="header-inner"><div class="brand"><img src="/approval-assets/logo.png" alt="Elev8 Print"><span class="brand-text">Artwork approval</span></div><nav class="tabs" aria-label="Artwork approval screens">${modeKind !== "customer" ? `<button data-mode="studio" class="${mode === "studio" ? "active" : ""}">Your workspace</button>` : ""}${modeKind !== "staff" ? `<button data-mode="customer" class="${mode === "customer" ? "active" : ""}">Customer view</button>` : ""}<button data-mode="receipt" class="${mode === "receipt" ? "active" : ""}">Receipt</button>${!isDemo ? '<button id="refresh">Refresh</button>' : ""}</nav></div></header>`;
  }
  function orderPicker() {
    const allowed = websiteOrders.filter(
      (o) =>
        !["shipped", "delivered", "completed", "cancelled"].includes(o.status),
    );
    return `<div class="field wide" style="margin-bottom:20px"><label for="website-order">Website order</label><select id="website-order"><option value="">Manual / offline order</option>${allowed.map((o) => `<option value="${esc(o.id)}" ${o.id === websiteOrderId ? "selected" : ""}>${esc(o.track_id || o.id.slice(-8))} · ${esc(o.customer_name)}</option>`).join("")}</select><p class="note">Linked approvals appear with this order and control its production hold.</p></div>`;
  }
  function reviewFields() {
    return `<section class="internal-review"><h3 class="editor-title"><span class="num">4</span> Internal review</h3>${field("Reviewed by", "reviewer_name", "")}<div class="field"><label for="review-notes">Artwork rights and proof review notes *</label><textarea id="review-notes" name="review_notes" minlength="10" maxlength="4000" required placeholder="Record the rights checks, any permission evidence and production review."></textarea></div><label class="checkbox"><input type="checkbox" name="review_confirmed" required><span>I have reviewed the exact proof, print specifications and any artwork rights concerns before requesting customer approval.</span></label></section>`;
  }
  function status(x) {
    return `<span class="status ${x.status}">${labels[x.status]}</span>`;
  }
  function date(v) {
    return new Date(v).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  }
  function specs(x) {
    return `<dl class="spec-grid">${[
      ["Product", x.product],
      ["Quantity", Number(x.quantity).toLocaleString() + " pieces"],
      ["Finished size", `${x.width} × ${x.height} ${x.units}`],
      ["Material", x.material],
      ["Finish", x.finish],
      ["Proof version", String(x.version).padStart(2, "0")],
    ]
      .map(
        ([a, b]) => `<div class="spec"><dt>${a}</dt><dd>${esc(b)}</dd></div>`,
      )
      .join(
        "",
      )}</dl>${x.special ? `<div class="special"><b>SPECIAL PRINTING DETAILS</b><p>${esc(x.special)}</p></div>` : ""}${x.notes ? `<p class="note" style="margin-top:14px">${esc(x.notes)}</p>` : ""}`;
  }
  function terms(x) {
    return x.terms
      .map(([h, t]) => `<h3>${esc(h)}</h3><p>${esc(t)}</p>`)
      .join("");
  }
  function proofVisual(x, small = false) {
    return x.type === "application/pdf"
      ? `<div class="proof-canvas pdf"><iframe title="Artwork proof PDF" src="${esc(x.proof)}"></iframe><p class="note">If the PDF does not appear, use Download proof above to review every page.</p></div>`
      : `<div class="proof-canvas"><img src="${esc(x.proof)}" alt="Artwork proof for ${esc(x.product)}, version ${x.version}"></div>`;
  }
  function orderDesigns() {
    return currentDesigns(records, p().orderId);
  }
  function orderSummary() {
    const all = orderDesigns(),
      approved = all.filter((x) => x.status === "approved").length,
      changes = all.filter((x) => x.status === "changes").length;
    return `<span class="status ${approved === all.length ? "approved" : changes ? "changes" : ""}">${approved} of ${all.length} approved${changes ? " · " + changes + " need changes" : ""}</span>`;
  }
  function designGallery(receiptMode = false) {
    const all = orderDesigns();
    return `<section class="design-gallery ${receiptMode ? "no-print" : ""}" aria-label="Designs in this order"><div class="gallery-heading"><div><h2>${receiptMode ? "Order records" : "Designs in your order"}</h2><p class="note">${receiptMode ? "Each design keeps its own version and response history." : "Open each design to inspect the artwork and specifications. Choose a response for each one."}</p></div><span class="tag">ONE ORDER · ${all.length} ${all.length === 1 ? "DESIGN" : "DESIGNS"}</span></div><div class="design-grid">${all.map((x, i) => `<article class="design-tile ${x.designId === p().designId ? "selected" : ""}"><button class="design-open" data-design="${x.id}" aria-label="View ${esc(x.designName)}"><span class="design-thumb">${x.type === "application/pdf" ? '<span class="pdf-thumb">PDF</span>' : `<img src="${esc(x.proof)}" alt="${esc(x.designName)} thumbnail">`}</span><span class="design-text"><strong>${esc(x.designName)}</strong><small>${esc(x.product)} · v${x.version}</small><small>${x.quantity} pieces · ${x.width} × ${x.height} ${x.units}</small></span></button>${!receiptMode && x.status === "pending" ? `<label class="decision-label" for="decision-${x.id}">Your response</label><select class="decision-select" id="decision-${x.id}" data-decision="${x.id}" aria-label="Response for ${esc(x.designName)}"><option value="later" ${!decisions[x.id] || decisions[x.id].action === "later" ? "selected" : ""}>Decide later</option><option value="approve" ${decisions[x.id]?.action === "approve" ? "selected" : ""}>Approve this design</option><option value="changes" ${decisions[x.id]?.action === "changes" ? "selected" : ""}>Request changes</option></select>` : `<div class="design-status">${status(x)}</div>`}</article>`).join("")}</div></section>`;
  }
  function customer() {
    const x = p();
    return `<div class="intro"><div><div class="eyebrow">${esc(x.order)} / ARTWORK REVIEW</div><h1>Good to print?</h1><p>One order. Every design, approved with confidence.</p></div>${orderSummary()}</div>${isDemo && orderDesigns().length === 1 ? '<div class="notice">This order currently has one design. Add more in Your workspace, or <button class="text-btn" id="sample-order">try a three-design example →</button></div>' : ""}${designGallery()}<div class="grid"><div class="stack"><section class="card"><div class="card-head"><div class="proof-meta"><h2>${esc(x.designName)}</h2><span class="tag">PROOF ${String(x.version).padStart(2, "0")}</span></div><div class="actions">${x.type !== "application/pdf" ? '<button class="text-btn" id="zoom">Enlarge ↗</button>' : ""}<a class="text-btn" href="${esc(x.proof)}" download="${esc(x.filename)}">Download ↓</a></div></div>${proofVisual(x)}<div class="proof-footer"><span>${esc(x.filename)}</span><span>Digital proof · Not shown at actual size</span></div></section><section class="card"><div class="body"><div class="section-top"><span class="num">1</span><h2>Check this design’s details</h2></div>${specs(x)}${x.response ? `<div class="rule"></div><p class="note">${labels[x.status]} by ${esc(x.response.name)} · ${date(x.response.at)}</p>${x.response.comments ? `<div class="revision-note">${esc(x.response.comments)}</div>` : ""}` : ""}<div class="rule"></div><div class="checks">${["Spelling & numbers", "Artwork & placement", "Size & orientation", "Cut lines & codes"].map((t) => `<span class="check-item"><span class="tick">✓</span>${t}</span>`).join("")}</div><div class="callout">Screen colors and special finishes can differ from the printed result. Need a color match or physical sample? Request it before approval.</div><details class="terms" open><summary>Artwork rights & approval terms</summary><div class="terms-content"><p>These terms apply separately to each design and proof version you approve. Your submitted receipt identifies those designs.</p>${terms(x)}${fullTerms(x)}<p>Terms version: ${esc(x.termsVersion)}</p></div></details></div></section></div><aside class="card approve-card"><div class="body">${batchForm()}</div></aside></div>`;
  }
  function batchForm() {
    const pending = orderDesigns().filter((x) => x.status === "pending");
    if (!pending.length)
      return `<div class="state-card"><div class="state-icon">✓</div><h2>Responses recorded.</h2><p>All current designs have a response. Designs with requested changes remain on hold until a revised proof is approved.</p><button class="btn primary full" data-mode="receipt">View order records →</button></div>`;
    const chosen = pending.filter(
        (x) => decisions[x.id] && decisions[x.id].action !== "later",
      ),
      approved = chosen.filter((x) => decisions[x.id].action === "approve"),
      changes = chosen.filter((x) => decisions[x.id].action === "changes");
    const agreement = approved[0] || p();
    return `<div class="section-top"><span class="num">2</span><h2>Submit your responses</h2></div><p class="note">Choose a response on the design cards above. You can approve some designs and request changes to others.</p><div class="response-summary"><strong>${approved.length} to approve</strong><span>${changes.length} to revise · ${pending.length - chosen.length} left for later</span></div><form id="batch-approval" novalidate>${chosen.map((x) => `<div class="chosen-design"><strong>${decisions[x.id].action === "approve" ? "✓" : "↗"} ${esc(x.designName)} <small>v${x.version}</small></strong><span>${decisions[x.id].action === "approve" ? "Approve" : "Request changes"}</span>${decisions[x.id].action === "changes" ? `<div class="field"><label for="comments-${x.id}">What needs changing? *</label><textarea maxlength="4000" id="comments-${x.id}" data-comments="${x.id}" placeholder="Describe the changes for this design…">${esc(decisions[x.id].comments || "")}</textarea></div>` : ""}</div>`).join("")}${approved.length ? `<div class="rule"></div>${(agreement.consents || BATCH_CONSENTS).map((c, i) => `<label class="checkbox"><input type="checkbox" name="consent${i}" ${identity.consents[i] ? "checked" : ""}><span>${esc(c)}</span></label>`).join("")}` : '<div class="callout" style="margin:16px 0">Change requests do not approve artwork or grant promotional permission.</div>'}<div class="fields"><div class="field wide"><label for="fullname">Full name *</label><input maxlength="120" id="fullname" name="name" autocomplete="name" required placeholder="Your full name" value="${esc(identity.name)}"></div><div class="field wide"><label for="email">Email address *</label><input id="email" name="email" type="email" autocomplete="email" required placeholder="you@company.com" value="${esc(identity.email)}"></div><div class="field wide"><label for="business">Business <span class="note">(optional)</span></label><input maxlength="160" id="business" name="business" autocomplete="organization" placeholder="Business name" value="${esc(identity.business)}"></div></div>${approved.length ? `<div class="optional"><div class="optional-title">Let us showcase your order <span>Optional</span></div><label class="checkbox"><input type="checkbox" id="promotional" name="promotional" ${identity.promotional ? "checked" : ""}><span>${esc(agreement.promoText || BATCH_PROMO)}</span></label><p class="note">${esc(agreement.promoNote || PROMO_NOTE)} This choice does not apply to future revisions or designs left unapproved.</p><div class="field ${identity.promotional ? "" : "hidden"}" id="restrictions-field" style="margin-top:12px"><label for="restrictions">Launch date or sharing restrictions</label><textarea maxlength="4000" id="restrictions" name="restrictions" placeholder="For example: Please don’t share before November 15.">${esc(identity.restrictions)}</textarea></div></div><p class="signature-note">${esc(agreement.signatureText || BATCH_SIGNATURE)}</p>` : ""}<div id="form-error" role="alert"></div><button class="btn primary full" type="submit" ${!chosen.length ? "disabled" : ""}>Submit Responses →</button><p class="micro">Nothing is approved until you submit. Decide Later leaves that design on hold.</p></form>`;
  }
  function field(
    label,
    name,
    value,
    type = "text",
    required = true,
    wide = false,
  ) {
    return `<div class="field ${wide ? "wide" : ""}"><label for="s-${name}">${label}${required ? " *" : ""}</label><input id="s-${name}" name="${name}" type="${type}" value="${esc(value)}" ${required ? "required" : ""} ${type === "number" ? 'min="0.01" step="any"' : ""}></div>`;
  }
  function studio() {
    const x = p();
    return `<div class="intro"><div><div class="eyebrow">ELEV8 PRINT / PROOF STUDIO</div><h1>A clear path to print.</h1><p>Add your designs. Send one link. Keep every approval.</p></div><button class="btn primary" id="new">+ New order</button></div><div class="studio"><aside class="studio-side"><h3>Orders & designs</h3><p>${isDemo ? "Sample records for this review" : "Private customer approval records"}</p><div class="order-list">${records.map((a) => `<button class="order-item ${a.id === selected ? "active" : ""}" data-select="${a.id}"><strong>${esc(a.order)}</strong><span class="sub">${esc(a.designName)} · v${a.version}</span>${status(a)}</button>`).join("")}</div><p style="margin-top:18px">Create a new version for artwork or specification changes. Earlier responses stay in the history.</p>${isDemo ? '<button class="text-btn" id="reset" style="margin-top:14px">Reset demo</button>' : ""}${adapter.hasMore?.() ? '<button class="btn" id="more">Load older jobs</button>' : ""}</aside><section class="card studio-main">${editing || !records.length ? editor() : `<div class="card-head"><div><h2>${esc(x.designName)} <span class="tag">VERSION ${x.version}</span></h2><p class="note">${esc(x.order)} · ${orderDesigns().length} designs in this order</p><p class="note">${esc(x.customer)} · ${esc(x.email)}</p></div>${status(x)}</div><div class="body">${x.status === "changes" ? `<div class="revision-note" style="margin:0 0 20px"><strong>Customer requested changes</strong><br>${esc(x.response.comments)}</div>` : ""}${isDemo ? '<div class="notice">Sample preview only. No customer records or emails are created.</div>' : `<div class="notice">${x.jobClosed ? "This approval job is closed." : "Private link expires " + date(x.linkExpiresAt) + ". Copy the link and send it to the customer when ready."}</div>`}${specs(x)}<div class="upload">${x.type !== "application/pdf" ? `<img src="${esc(x.proof)}" alt="Proof thumbnail">` : "<span>PDF</span>"}<div><h3>${esc(x.filename)}</h3><p>Uploaded proof · Version ${x.version}</p><a class="text-btn" href="${esc(x.proof)}" download="${esc(x.filename)}">Download proof ↓</a></div></div><div class="actions">${isDemo ? '<button class="btn primary" data-mode="customer">Open customer preview →</button>' : '<button class="btn primary" id="open-customer">Open customer link ↗</button>'}<button class="btn" id="copy">Copy customer link</button><button class="btn" id="add-design">+ Add design to order</button><button class="btn" id="revision">Create revision</button>${x.response ? '<button class="btn" data-mode="receipt">View response</button>' : ""}</div>${!isDemo && !x.jobClosed ? '<div class="actions"><button class="text-btn" id="replace-link">Replace / renew link</button><button class="text-btn" id="close-job">Close approval job</button></div>' : ""}<div class="rule"></div><h3>Activity</h3><p class="note" style="margin-top:12px">Proof ${x.version} created · ${date(x.created)}</p>${x.response ? `<p class="note">${labels[x.status]} by ${esc(x.response.name)} · ${date(x.response.at)}</p>` : ""}<div class="special"><b>PRINT RELEASE</b><p>${records.some((a) => a.designId === x.designId && a.version > x.version) ? "Historical version. Check this design’s latest proof before production." : x.status === "approved" ? (orderDesigns().every((a) => a.status === "approved") ? "Every current design has an approval. Staff must still verify the production file, payment and order requirements before printing." : "This design is approved. Hold the order until the remaining current designs are approved.") : "Hold for customer approval. This proof is not cleared for printing."}</p></div></div>`}</section></div>`;
  }
  function editor() {
    const x = baseId ? records.find((a) => a.id === baseId) : null;
    const shared = addOrderId
      ? records.find((a) => a.orderId === addOrderId)
      : null;
    const linked = websiteOrders.find((o) => o.id === websiteOrderId);
    const d = x || {
      order: shared?.order || linked?.track_id || "",
      customer: shared?.customer || linked?.customer_name || "",
      email: shared?.email || linked?.customer_email || "",
      designName: "",
      product: "Die-cut stickers",
      quantity: 250,
      width: 3,
      height: 3,
      units: "in",
      material: "Holographic vinyl",
      finish: "Gloss laminate",
      special: "",
      notes: "",
    };
    return `<div class="card-head"><h2>${x ? "Revise " + esc(x.designName) : shared ? "Add design to " + esc(shared.order) : "Prepare a new order"}</h2><span class="tag">${x ? "NEW VERSION" : "DRAFT"}</span></div><div class="body"><form id="editor"><h3 class="editor-title"><span class="num">1</span> Order & customer</h3>${!isDemo && !x && !shared ? orderPicker() : ""}<div class="fields">${field("Order number", "order", d.order)}${field("Customer or business", "customer", d.customer)}${field("Customer email", "email", d.email, "email", true, true)}</div><h3 class="editor-title"><span class="num">2</span> Print specifications</h3><div class="fields">${field("Design name", "designName", d.designName, "text", true, true)}${field("Product", "product", d.product)}${field("Quantity", "quantity", d.quantity, "number")}${field("Finished width", "width", d.width, "number")}${field("Finished height", "height", d.height, "number")}<div class="field"><label for="s-units">Units *</label><select name="units" id="s-units">${["in", "mm", "cm"].map((u) => `<option ${d.units === u ? "selected" : ""}>${u}</option>`).join("")}</select></div>${field("Material", "material", d.material)}${field("Finish", "finish", d.finish, "text", true, true)}<div class="field wide"><label for="s-special">Special printing details</label><textarea id="s-special" name="special" placeholder="White ink placement, spot UV, cut instructions…">${esc(d.special)}</textarea></div><div class="field wide"><label for="s-notes">Additional customer notes</label><textarea id="s-notes" name="notes">${esc(d.notes)}</textarea></div></div><h3 class="editor-title"><span class="num">3</span> Artwork proof</h3><div class="upload"><div><h3 id="file-name">${x ? esc(x.filename) : "Choose a proof file"}</h3><p>PNG, JPG, WebP or PDF · Up to 2 MB</p><input aria-label="Upload artwork proof" type="file" id="file" accept="image/png,image/jpeg,image/webp,application/pdf"><p class="note" id="file-status">${x ? "Current proof will be reused unless you upload a replacement." : isDemo ? "Or use our sample artwork to test the process." : "Upload the exact proof the customer should review."}</p>${isDemo && !x ? '<button type="button" id="use-sample" class="text-btn">Use sample artwork</button>' : ""}</div></div>${!isDemo ? reviewFields() : ""}<div class="notice">Publishing a revision creates a fresh approval request. Previous approvals remain attached to their original version.</div><div id="editor-error" role="alert"></div><div class="editor-footer"><span class="note">All designs in this order share one ${isDemo ? "demo" : "private customer"} link.</span><div class="actions"><button type="button" class="btn" id="cancel-edit">Cancel</button><button type="submit" class="btn primary">Create ${x ? "revision" : "design"} →</button></div></div></form></div>`;
  }
  function singleReceipt() {
    const x = p(),
      a = x.response;
    if (!a)
      return `<div class="card empty"><div class="eyebrow">APPROVAL RECORD</div><h2>No response yet.</h2><p>Responses appear here after the customer submits them.</p>${modeKind !== "staff" ? '<button class="btn primary" data-mode="customer">Open customer view →</button>' : '<button class="btn" data-mode="studio">Back to workspace</button>'}</div>`;
    return `<div class="receipt"><div class="download-actions"><button class="btn primary" id="print">Print / Save PDF</button><button class="btn" id="export">Download order records (.json)</button>${modeKind !== "customer" ? '<button class="btn" data-mode="studio">Back to workspace</button>' : '<button class="btn" data-mode="customer">Back to designs</button>'}</div><article class="card"><div class="body"><div class="receipt-head"><div><div class="eyebrow">ELEV8 PRINT / ${isDemo ? "DEMO" : "APPROVAL"} RECORD</div><h1>${x.status === "approved" ? "Design approval receipt" : "Artwork revision request"}</h1><p class="note" style="margin-top:10px">${esc(x.order)} · ${esc(x.designName)} · Proof ${x.version}<br>Recorded ${date(a.at)}</p></div>${status(x)}</div>${isDemo ? '<div class="notice" style="margin:20px 0">Sample review only. This record is not a live production authorization.</div>' : ""}<div class="receipt-data"><div><h3>Customer response</h3><p style="margin-top:10px">${esc(a.name)}<br>${esc(a.email)}${a.business ? "<br>" + esc(a.business) : ""}</p><p class="note" style="margin-top:10px">Record ID: ${esc(x.id)}${!isDemo ? "<br>Submission: " + esc(a.batchId) + "<br>Recorded (UTC): " + esc(a.at) : ""}</p></div><div>${x.type === "application/pdf" ? `<a href="${esc(x.proof)}" download="${esc(x.filename)}">Download approved proof PDF</a>` : `<img class="receipt-image" src="${esc(x.proof)}" alt="Exact proof associated with this response">`}<p class="note">${esc(x.filename)}</p>${x.sha256 ? `<p class="note proof-fingerprint">File SHA-256: ${esc(x.sha256)}</p>` : ""}</div></div><div class="rule"></div><h3>Recorded print specifications</h3>${specs(x)}<div class="rule"></div>${
      x.status === "approved"
        ? `<h3>Confirmed statements</h3>${
            a.approvedProofIds
              ? `<p class="note">Approved in this submission: ${a.approvedProofIds
                  .map((id) => {
                    const v = records.find((r) => r.id === id);
                    return v
                      ? esc(v.designName) + " (v" + v.version + ")"
                      : esc(id);
                  })
                  .join(", ")}.</p>`
              : ""
          }${x.consents.map((c) => `<p class="checkbox"><span class="tick">✓</span>${esc(c)}</p>`).join("")}<p class="note">${esc(x.signatureText)}</p><div class="special"><b>PROMOTIONAL PERMISSION: ${a.promotional ? "GRANTED" : "NOT GRANTED"}</b>${a.promotional ? `<p>${esc(x.promoText)}</p><p>${esc(x.promoNote)}</p><p style="margin-top:8px"><strong>Restrictions:</strong> ${esc(a.restrictions || "None entered.")}</p>` : "<p>Order fulfillment only. No promotional permission was granted.</p>"}</div><div class="receipt-terms"><h3>Agreement accepted · ${esc(x.termsVersion)}</h3>${terms(x)}${fullTerms(x)}</div>`
        : `<h3>Requested changes</h3><div class="revision-note">${esc(a.comments)}</div><p class="note" style="margin-top:14px">No approval, electronic signature of approval, or promotional consent was recorded with this request.</p>`
    }${modeKind === "staff" && x.reviewer ? `<div class="rule"></div><h3>Internal review</h3><p>${esc(x.reviewer)} · ${date(x.reviewedAt)}</p><p>${esc(x.reviewNotes)}</p>` : ""}<div class="rule"></div><p class="note">This record applies only to proof ${x.version} and the specifications above. Any subsequent revision requires a new approval.</p></div></article></div>`;
  }
  function receipt() {
    const x = p(),
      history = records
        .filter((a) => a.designId === x.designId)
        .sort((a, b) => b.version - a.version);
    return `<div class="intro no-print"><div><div class="eyebrow">${esc(x.order)} / APPROVAL HISTORY</div><h1>Every design. Every decision.</h1><p>Responses stay attached to the exact design and version reviewed.</p></div>${orderSummary()}</div>${designGallery(true)}<div class="version-nav no-print"><strong>${esc(x.designName)}</strong>${history.map((a) => `<button class="btn ${a.id === selected ? "primary" : ""}" data-version="${a.id}">Version ${a.version} · ${labels[a.status]}</button>`).join("")}</div>${singleReceipt()}`;
  }
  function render() {
    if (disposed) return;
    $("#app").innerHTML =
      header() +
      `<main class="workspace">${mode === "studio" ? studio() : records.length ? (mode === "customer" ? customer() : receipt()) : '<section class="card empty"><h2>No approval proofs available.</h2><p>Contact Elev8 Print for your private approval link.</p></section>'}<footer class="footer"><span>Prepared with care. Printed with approval.</span><span>ELEV8 PRINT · ARTWORK APPROVAL</span></footer></main>`;
    bind();
  }
  function nav(value) {
    if (busy) return;
    if (
      (modeKind === "customer" && value === "studio") ||
      (modeKind === "staff" && value === "customer")
    )
      return;
    mode = value;
    editing = false;
    if (value === "customer") {
      const latest = orderDesigns().find((a) => a.designId === p().designId);
      if (latest) selected = latest.id;
    }
    render();
    root.scrollIntoView({ block: "start" });
  }
  function dialog(body, cls = "") {
    const d = document.createElement("dialog");
    d.className = cls;
    d.innerHTML = body;
    root.append(d);
    d.showModal();
    d.addEventListener("close", () => d.remove());
    d.querySelectorAll("[data-close]").forEach(
      (b) => (b.onclick = () => d.close()),
    );
    return d;
  }
  function inputValues(form) {
    const f = new FormData(form);
    return {
      name: String(f.get("name") || ""),
      email: String(f.get("email") || ""),
      business: String(f.get("business") || ""),
      consents: [0, 1, 2].map((i) => f.get("consent" + i) === "on"),
      promotional: f.get("promotional") === "on",
      restrictions: String(f.get("restrictions") || ""),
    };
  }
  function showError(id, e) {
    if (disposed) return;
    const el = $(id);
    if (!el) {
      toast(e.message || String(e));
      return;
    }
    el.innerHTML = `<div class="error">${esc(e.message || e)}${id === "#form-error" && !isDemo ? "<br>If your connection was interrupted, refresh to check whether your response was recorded before submitting again." : ""}</div>`;
    el.scrollIntoView({ block: "nearest" });
  }
  async function load() {
    if (busy) return;
    setBusy(true);
    try {
      setRecords(await adapter.load());
      clearReview();
      if (websiteOrderId && modeKind === "staff") {
        const linked = records.find((x) => x.websiteOrderId === websiteOrderId);
        if (linked) {
          selected = linked.id;
          editing = false;
        } else {
          editing = true;
        }
      }
      if (!records.length && modeKind === "staff") editing = true;
      if (!selected) selected = records[0]?.id || "";
      render();
    } catch (e) {
      setRecords([]);
      clearReview();
      if (!disposed)
        $("#app").innerHTML =
          header() +
          `<main class="workspace"><section class="card empty"><h1>Artwork approval</h1><div role="alert" class="error">${esc(e.message)}</div><button class="btn" id="retry">Try again</button></section></main>`;
      bind();
    } finally {
      if (!disposed) {
        setBusy(false);
        if ($("#retry")) $("#retry").onclick = load;
      }
    }
  }
  async function showLink(action = "link", open = false) {
    if (busy) return;
    setBusy(true);
    try {
      const link = await adapter.link(p().orderId, action);
      if (disposed) return;
      const d = dialog(
        `<h2>${isDemo ? "Demo link" : "Private customer link"} ready</h2><p>${isDemo ? "For this sample preview only." : "This link opens only this job and its designs, including future revisions. Anyone with the complete link can access the job; send it only to the intended customer."}</p><p class="note">${link.expiresAt ? "Expires " + date(link.expiresAt) : "No real customer records are created."}</p><div class="field" style="margin-top:16px"><label for="customer-url">Customer link</label><input id="customer-url" readonly value="${esc(link.url)}"></div><div class="actions"><button class="btn" data-close>Close</button><button class="btn primary" id="copy-confirm">Copy link</button>${open ? `<a class="btn" href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">Open customer page ↗</a>` : ""}</div>`,
      );
      d.querySelector("#copy-confirm").onclick = async () => {
        try {
          await navigator.clipboard.writeText(link.url);
          toast("Customer link copied. No email has been sent.");
          d.close();
        } catch {
          d.querySelector("#customer-url").select();
          toast("Select and copy the link above.");
        }
      };
    } catch (e) {
      toast(e.message);
    } finally {
      if (!disposed) setBusy(false);
    }
  }
  function bind() {
    $$("[data-mode]").forEach((b) => (b.onclick = () => nav(b.dataset.mode)));
    if ($("#about"))
      $("#about").onclick = () =>
        dialog(
          '<h2>Try the complete approval flow</h2><p>Open Your workspace to create an order, add designs or revise one design. In Customer view choose Approve, Request changes or Decide later for each design, then submit the selected responses. The three agreement checkboxes and optional promotional permission cover only the approved designs in that submission. Receipt preserves each response and version.</p><p>This sample resets when you reload. No real approvals or emails are created.</p><div class="actions"><button class="btn primary" data-close>Got it</button></div>',
        );
    if ($("#zoom"))
      $("#zoom").onclick = () =>
        dialog(
          `<div class="actions" style="margin:0 0 15px"><button class="btn" data-close>Close</button></div><img src="${esc(p().proof)}" alt="Enlarged artwork proof">`,
          "zoom",
        );
    if ($("#promotional"))
      $("#promotional").onchange = (e) =>
        $("#restrictions-field").classList.toggle("hidden", !e.target.checked);
    if ($("#new"))
      $("#new").onclick = () => {
        editing = true;
        baseId = null;
        addOrderId = null;
        websiteOrderId = null;
        releaseDraft();
        render();
      };
    $$("[data-select]").forEach(
      (b) =>
        (b.onclick = () => {
          if (
            records.find((x) => x.id === b.dataset.select).orderId !==
            p().orderId
          )
            clearReview();
          selected = b.dataset.select;
          editing = false;
          releaseDraft();
          render();
        }),
    );
    if ($("#revision"))
      $("#revision").onclick = () => {
        baseId = selected;
        addOrderId = null;
        editing = true;
        releaseDraft();
        render();
      };
    if ($("#cancel-edit"))
      $("#cancel-edit").onclick = () => {
        editing = records.length === 0;
        releaseDraft();
        render();
      };
    if ($("#use-sample"))
      $("#use-sample").onclick = () => {
        releaseDraft();
        draftFile = {
          proof: "/approval-assets/sample-proof.svg",
          filename: "make-good-things-proof.svg",
          type: "image/svg+xml",
        };
        $("#file-name").textContent = draftFile.filename;
        $("#file-status").textContent = "Sample artwork selected.";
        $("#file").value = "";
      };
    if ($("#file"))
      $("#file").onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          if (
            ![
              "image/png",
              "image/jpeg",
              "image/webp",
              "application/pdf",
            ].includes(file.type)
          )
            throw Error("Choose a PNG, JPG, WebP or PDF file.");
          if (file.size > 2 * 1024 * 1024)
            throw Error("Choose a proof no larger than 2 MB.");
          releaseDraft();
          const proof = URL.createObjectURL(file);
          objectUrls.add(proof);
          draftFile = { file, proof, filename: file.name, type: file.type };
          $("#file-name").textContent = file.name;
          $("#file-status").textContent = "Ready to save with your proof.";
          $("#editor-error").innerHTML = "";
        } catch (err) {
          e.target.value = "";
          releaseDraft();
          showError("#editor-error", err);
        }
      };
    if ($("#website-order"))
      $("#website-order").onchange = (e) => {
        websiteOrderId = e.target.value || null;
        const existing = records.find(
          (r) => r.websiteOrderId === websiteOrderId,
        );
        if (existing) {
          selected = existing.id;
          editing = false;
          clearReview();
          render();
          toast(
            "Opened the existing approval job for this order. Add a design or revision here.",
          );
          return;
        }
        const order = websiteOrders.find((o) => o.id === websiteOrderId);
        for (const [key, value] of [
          ["order", order?.track_id || ""],
          ["customer", order?.customer_name || ""],
          ["email", order?.customer_email || ""],
        ]) {
          $("#s-" + key).value = value;
          $("#s-" + key).readOnly = !!order;
        }
      };
    const editor = $("#editor");
    if (editor) {
      if (baseId || addOrderId || websiteOrderId) {
        for (const key of ["order", "customer", "email"])
          $("#s-" + key).readOnly = true;
      }
      $("#s-quantity").step = "1";
      $("#s-quantity").min = "1";
      editor.onsubmit = async (e) => {
        e.preventDefault();
        if (busy) return;
        const values = Object.fromEntries(new FormData(editor));
        if (!isDemo)
          values.review_confirmed =
            values.review_confirmed === "on" ? "true" : "false";
        const base = records.find((x) => x.id === baseId),
          shared = records.find((x) => x.orderId === addOrderId);
        setBusy(true);
        try {
          const result = await adapter.create(
            values,
            draftFile,
            baseId,
            base?.orderId || addOrderId,
            base?.websiteOrderId || shared?.websiteOrderId || websiteOrderId,
          );
          if (disposed) return;
          merge(result.records);
          selected = result.proofId;
          editing = false;
          baseId = null;
          addOrderId = null;
          releaseDraft();
          clearReview();
          render();
          toast(
            "Proof saved. Copy the customer link when it is ready to send.",
          );
        } catch (err) {
          showError("#editor-error", err);
        } finally {
          if (!disposed) setBusy(false);
        }
      };
    }
    if ($("#copy")) $("#copy").onclick = () => showLink();
    if ($("#open-customer"))
      $("#open-customer").onclick = () => showLink("link", true);
    if ($("#replace-link"))
      $("#replace-link").onclick = () => {
        const d = dialog(
          '<h2>Replace this private link?</h2><p>The previous customer link will stop working. Saved responses remain in the history. The replacement will expire in 30 days.</p><div class="actions"><button class="btn" data-close>Keep current link</button><button class="btn primary" id="confirm-replace">Replace link</button></div>',
        );
        d.querySelector("#confirm-replace").onclick = () => {
          d.close();
          showLink("replace");
        };
      };
    if ($("#close-job"))
      $("#close-job").onclick = () => {
        const d = dialog(
          '<h2>Close this approval job?</h2><p>The customer link will stop working and production will remain on hold. Proofs and recorded responses will be retained. Closing cannot be undone here.</p><div class="actions"><button class="btn" data-close>Keep open</button><button class="btn primary" id="confirm-close">Close job</button></div>',
        );
        d.querySelector("#confirm-close").onclick = async () => {
          d.close();
          setBusy(true);
          try {
            await adapter.close(p().orderId);
            busy = false;
            await load();
            toast("Approval job closed. Records retained.");
          } catch (e) {
            toast(e.message);
          } finally {
            if (!disposed) setBusy(false);
          }
        };
      };
    if ($("#reset"))
      $("#reset").onclick = async () => {
        setRecords(await adapter.reset());
        selected = records[0]?.id || "";
        clearReview();
        editing = false;
        render();
      };
    if ($("#refresh")) $("#refresh").onclick = load;
    if ($("#more"))
      $("#more").onclick = async () => {
        setBusy(true);
        try {
          const next = await adapter.more();
          if (!disposed) {
            merge(next);
            render();
          }
        } catch (e) {
          toast(e.message);
        } finally {
          if (!disposed) setBusy(false);
        }
      };
    if ($("#print")) $("#print").onclick = () => window.print();
    if ($("#export"))
      $("#export").onclick = async () => {
        if (busy) return;
        setBusy(true);
        try {
          const orderId = p().orderId,
            all = structuredClone(records.filter((x) => x.orderId === orderId));
          let bytes = 0;
          for (const x of all) {
            const response = await fetch(x.proof, {
              referrerPolicy: "no-referrer",
            });
            if (!response.ok)
              throw Error(
                "A proof download expired. Refresh this job, then export again.",
              );
            const blob = await response.blob();
            bytes += blob.size;
            if (bytes > 100 * 1024 * 1024)
              throw Error(
                "This job history exceeds the 100 MB export limit. Print individual receipts instead.",
              );
            x.proof = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          }
          const data = {
            demoOnly: isDemo,
            source: isDemo ? "Sample review" : "Elev8 Print approval records",
            exportedAt: new Date().toISOString(),
            orderId,
            records: all,
          };
          const blob = new Blob([JSON.stringify(data, null, 2)], {
              type: "application/json",
            }),
            url = URL.createObjectURL(blob),
            a = document.createElement("a");
          objectUrls.add(url);
          a.href = url;
          a.download = `elev8-${p().order.replace(/[^a-z0-9-]/gi, "-")}-all-design-records.json`;
          a.click();
          setTimeout(() => {
            URL.revokeObjectURL(url);
            objectUrls.delete(url);
          }, 2000);
        } catch (err) {
          toast(err.message || "Could not export the order records.");
        } finally {
          if (!disposed) setBusy(false);
        }
      };
    if ($("#sample-order"))
      $("#sample-order").onclick = async () => {
        setRecords(await adapter.reset());
        selected = records[0].id;
        clearReview();
        nav("customer");
      };
    if ($("#add-design"))
      $("#add-design").onclick = () => {
        addOrderId = p().orderId;
        baseId = null;
        releaseDraft();
        editing = true;
        render();
      };
    $$("[data-design]").forEach(
      (b) =>
        (b.onclick = () => {
          selected = b.dataset.design;
          render();
        }),
    );
    $$("[data-version]").forEach(
      (b) =>
        (b.onclick = () => {
          selected = b.dataset.version;
          render();
        }),
    );
    $$("[data-decision]").forEach(
      (el) =>
        (el.onchange = () => {
          decisions[el.dataset.decision] = {
            action: el.value,
            comments: decisions[el.dataset.decision]?.comments || "",
          };
          identity.consents = [false, false, false];
          identity.promotional = false;
          identity.restrictions = "";
          render();
        }),
    );
    const batch = $("#batch-approval");
    if (batch) {
      batch.oninput = () => {
        identity = inputValues(batch);
        $$("[data-comments]").forEach(
          (t) => (decisions[t.dataset.comments].comments = t.value),
        );
      };
      batch.onsubmit = async (e) => {
        e.preventDefault();
        if (busy) return;
        identity = inputValues(batch);
        $$("[data-comments]").forEach(
          (t) => (decisions[t.dataset.comments].comments = t.value),
        );
        setBusy(true);
        try {
          const next = await adapter.respond(
            records,
            p().orderId,
            decisions,
            identity,
          );
          if (disposed) return;
          const first = Object.keys(decisions).find(
            (id) => decisions[id].action !== "later",
          );
          merge(next);
          if (first) selected = first;
          clearReview();
          busy = false;
          nav("receipt");
          toast(
            "Selected responses recorded. Unapproved designs stay on hold.",
          );
        } catch (err) {
          showError("#form-error", err);
        } finally {
          if (!disposed) setBusy(false);
        }
      };
    }
  }
  const hashChange = () => {
    if (modeKind === "customer") load();
  };
  if (modeKind === "customer")
    window.addEventListener("hashchange", hashChange);
  load();
  return () => {
    disposed = true;
    clearTimeout(toastTimer);
    window.removeEventListener("hashchange", hashChange);
    for (const url of objectUrls) URL.revokeObjectURL(url);
    root.querySelectorAll("dialog").forEach((d) => d.remove());
    root.innerHTML = "";
  };
}
