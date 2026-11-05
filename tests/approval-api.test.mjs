import { before, after, test, mock } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { database, order } from "./support/database.mjs";
let db,
  adminRoute,
  customerRoute,
  auth,
  operations = 0;
const files = new Map();
// The real route handlers, hashing/encryption, validation, projection and SQL
// run here. Only Supabase's HTTP/storage transport is replaced; nothing hosted
// is written and no real customer email or approval is used.
const storage = {
  from(bucket) {
    operations++;
    assert.equal(bucket, "artwork-proofs");
    return {
      async upload(path, bytes, options) {
        assert.equal(options.upsert, false);
        assert.ok(!files.has(path));
        files.set(path, {
          bytes: Buffer.from(bytes),
          mime: options.contentType,
        });
        return { error: null };
      },
      async copy(source, target) {
        assert.ok(files.has(source));
        assert.ok(!files.has(target));
        files.set(target, structuredClone(files.get(source)));
        return { error: null };
      },
      async createSignedUrls(paths, seconds) {
        assert.equal(seconds, 300);
        return {
          data: paths.map((path) => ({
            path,
            signedUrl: `https://example.invalid/private/${path}`,
          })),
          error: null,
        };
      },
    };
  },
};
function from(table) {
  operations++;
  assert.equal(table, "artwork_jobs");
  const filters = [];
  const builder = {
    select() {
      return builder;
    },
    eq(k, v) {
      filters.push([k, v]);
      return builder;
    },
    order() {
      return builder;
    },
    async rows(start = 0, limit = 50) {
      const values = [];
      const clause = filters.length
        ? " where " +
          filters
            .map(([k, v], i) => {
              assert.ok(["id", "token_hash", "order_id"].includes(k));
              values.push(v);
              return `${k}=$${i + 1}`;
            })
            .join(" and ")
        : "";
      values.push(start, limit);
      const rows = (
        await db.query(
          `select * from artwork_jobs${clause} order by created_at desc offset $${values.length - 1} limit $${values.length}`,
          values,
        )
      ).rows;
      for (const row of rows)
        row.artwork_proofs = (
          await db.query("select * from artwork_proofs where job_id=$1", [
            row.id,
          ])
        ).rows;
      return rows;
    },
    async range(start, end) {
      return { data: await builder.rows(start, end - start + 1), error: null };
    },
    async maybeSingle() {
      return { data: (await builder.rows())[0] || null, error: null };
    },
    async single() {
      return builder.maybeSingle();
    },
  };
  return builder;
}
const supabase = {
  from,
  storage,
  async rpc(name, args) {
    operations++;
    const calls = {
      create_artwork_proof: [
        "select * from public.create_artwork_proof($1::jsonb)",
        [JSON.stringify(args.p)],
      ],
      respond_to_artwork_job: [
        "select public.respond_to_artwork_job($1,$2::jsonb)",
        [args.p_hash, JSON.stringify(args.p)],
      ],
      manage_artwork_link: [
        "select public.manage_artwork_link($1,$2,$3,$4)",
        [args.p_job_id, args.p_action, args.p_hash, args.p_sealed],
      ],
    };
    assert.ok(calls[name]);
    try {
      const { rows } = await db.query(...calls[name]);
      return {
        data: name === "create_artwork_proof" ? rows : rows[0],
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: { code: error.code, message: error.message },
      };
    }
  },
};
before(async () => {
  db = await database();
  mock.module("../src/lib/supabase-admin.ts", { namedExports: { supabase } });
  process.env.JWT_SECRET = "local-api-test-key-only";
  auth = `Bearer ${jwt.sign({ role: "admin" }, process.env.JWT_SECRET)}`;
  adminRoute = await import("../src/app/api/artwork-proofs/route.ts");
  customerRoute = await import("../src/app/api/artwork-approval/route.ts");
});
after(async () => {
  mock.restoreAll();
  await db?.close();
});
const origin = "https://www.elev8print.com";
const api = (path, body, authorized = false, method = "POST") =>
  new Request(origin + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(authorized ? { Authorization: auth } : {}),
    },
    body: JSON.stringify(body),
  });
const lookup = (token) =>
  customerRoute.POST(api("/api/artwork-approval", { action: "lookup", token }));
const mutate = (jobId, action, authorized = true) =>
  adminRoute.PATCH(
    api("/api/artwork-proofs", { jobId, action }, authorized, "PATCH"),
  );
const submit = (body) =>
  customerRoute.POST(
    api("/api/artwork-approval", { action: "respond", ...body }),
  );
function issueRequest(patch = {}, authorized = true, file = true) {
  const form = new FormData();
  for (const [k, v] of Object.entries({
    order: "Fictional API test job",
    customer: "Sample Customer",
    email: "sample@example.com",
    designName: "Fictional test design",
    product: "Stickers",
    quantity: "100",
    width: "3",
    height: "3",
    units: "in",
    material: "White vinyl",
    finish: "Matte",
    special: "No spot UV",
    notes: "Test only",
    reviewer_name: "Test Reviewer",
    review_notes: "Original test artwork and rights checked.",
    review_confirmed: "true",
    ...patch,
  }))
    form.set(k, v);
  if (file)
    form.set(
      "proof",
      new File(
        [Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3])],
        "sample.png",
        { type: "image/png" },
      ),
    );
  return new Request(origin + "/api/artwork-proofs", {
    method: "POST",
    headers: authorized ? { Authorization: auth } : {},
    body: form,
  });
}
function body(token, records, actions = {}) {
  return {
    token,
    jobVersion: records[0].jobVersion,
    signerName: "Sample Customer",
    signerEmail: "sample@example.com",
    business: "Test Business",
    consents: [true, true, true],
    electronicConsent: true,
    promotional: false,
    restrictions: "",
    decisions: records.map((r) => ({
      proofId: r.id,
      revision: r.version,
      proofSha256: r.sha256,
      termsVersion: r.termsVersion,
      action: actions[r.id] || "approve",
      changeNotes: "Move cut line.",
    })),
  };
}
async function create(patch = {}, file = true) {
  const res = await adminRoute.POST(issueRequest(patch, true, file));
  assert.equal(res.status, 201, await res.clone().text());
  return res.json();
}
async function access(jobId) {
  const res = await mutate(jobId, "link");
  assert.equal(res.status, 200, await res.clone().text());
  return (await res.json()).token;
}

test("all staff endpoints authenticate before any database or storage operation", async () => {
  const before = operations;
  assert.equal(
    (await adminRoute.GET(new Request(origin + "/api/artwork-proofs"))).status,
    401,
  );
  assert.equal((await adminRoute.POST(issueRequest({}, false))).status, 401);
  assert.equal((await mutate(randomUUID(), "replace", false)).status, 401);
  assert.equal(operations, before);
});
test("internal review and real file bytes are required before issuing any proof", async () => {
  assert.equal(
    (await adminRoute.POST(issueRequest({ review_confirmed: "false" }))).status,
    400,
  );
  const request = issueRequest(),
    form = await request.formData();
  form.set(
    "proof",
    new File(["<script>bad</script>"], "looks-like.png", { type: "image/png" }),
  );
  const rejected = await adminRoute.POST(
    new Request(origin + "/api/artwork-proofs", {
      method: "POST",
      headers: { Authorization: auth },
      body: form,
    }),
  );
  assert.equal(rejected.status, 400);
  assert.equal(
    (await adminRoute.POST(issueRequest({ quantity: "1.5" }))).status,
    400,
  );
});
test("multi-design issue, private lookup, batch response and staff readback use the same server records", async () => {
  const a = await create(),
    b = await create({ job_id: a.jobId, designName: "Second design" }),
    c = await create({ job_id: a.jobId, designName: "Later design" }),
    token = await access(a.jobId);
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  const saved = (
    await db.query("select * from artwork_jobs where id=$1", [a.jobId])
  ).rows[0];
  assert.equal(
    saved.token_hash,
    createHash("sha256").update(token).digest("hex"),
  );
  assert.ok(!saved.token_sealed.includes(token));
  const view = await lookup(token);
  assert.equal(view.status, 200);
  assert.match(view.headers.get("cache-control"), /no-store/);
  assert.equal(view.headers.get("referrer-policy"), "no-referrer");
  const records = (await view.json()).records;
  assert.equal(records.length, 3);
  for (const r of records) {
    for (const field of [
      "token_hash",
      "token_sealed",
      "proof_path",
      "review_notes",
      "reviewer_name",
      "reviewer",
      "reviewNotes",
      "reviewedAt",
      "order_snapshot",
    ])
      assert.equal(r[field], undefined);
    assert.ok(r.proof);
    assert.equal(r.consents.length, 3);
    assert.equal(r.fullTerms.length, 11);
    const file = (
      await db.query("select proof_path from artwork_proofs where id=$1", [
        r.id,
      ])
    ).rows[0];
    assert.equal(
      r.sha256,
      createHash("sha256")
        .update(files.get(file.proof_path).bytes)
        .digest("hex"),
    );
  }
  const chosen = records.filter((r) => r.id !== c.proofId),
    payload = body(token, chosen, { [b.proofId]: "request_changes" });
  assert.equal(
    (await submit({ ...payload, signerEmail: "wrong@example.com" })).status,
    409,
  );
  assert.equal(
    (await submit({ ...payload, consents: [true, true, "true"] })).status,
    400,
  );
  const accepted = await submit({
    ...payload,
    promotional: true,
    restrictions: "After launch only.",
  });
  assert.equal(accepted.status, 200, await accepted.clone().text());
  const receipt = (await accepted.json()).records;
  const approved = receipt.find((r) => r.id === a.proofId),
    changes = receipt.find((r) => r.id === b.proofId);
  assert.equal(approved.status, "approved");
  assert.equal(changes.status, "changes");
  assert.equal(receipt.find((r) => r.id === c.proofId).status, "pending");
  assert.equal(approved.response.batchId, changes.response.batchId);
  assert.equal(approved.response.promotional, true);
  assert.equal(changes.response.promotional, false);
  assert.equal(approved.response.restrictions, "After launch only.");
  assert.equal((await submit(payload)).status, 409);
  const staff = await adminRoute.GET(
    new Request(origin + "/api/artwork-proofs?jobId=" + a.jobId, {
      headers: { Authorization: auth },
    }),
  );
  const staffRecords = (await staff.json()).records;
  assert.equal(staffRecords.length, 3);
  assert.equal(
    staffRecords.find((r) => r.id === a.proofId).reviewer,
    "Test Reviewer",
  );
});
test("spec-only revision reuses exact file bytes, preserves history and the stable customer link", async () => {
  const a = await create(),
    token = await access(a.jobId);
  const records = (await (await lookup(token)).json()).records;
  assert.equal((await submit(body(token, records))).status, 200);
  const revision = await create(
    { job_id: a.jobId, base_proof_id: a.proofId, finish: "Gloss" },
    false,
  );
  assert.equal(await access(a.jobId), token);
  const current = revision.records.find((r) => r.id === revision.proofId),
    old = revision.records.find((r) => r.id === a.proofId);
  assert.equal(current.version, 2);
  assert.equal(old.status, "approved");
  assert.equal(current.status, "pending");
  assert.equal(current.sha256, old.sha256);
  assert.equal(current.finish, "Gloss");
  assert.equal(current.response, undefined);
  const stored = (
    await db.query("select proof_path from artwork_proofs where job_id=$1", [
      a.jobId,
    ])
  ).rows;
  assert.notEqual(stored[0].proof_path, stored[1].proof_path);
});
test("renewal invalidates old access and closure retains signed receipts", async () => {
  const a = await create(),
    token = await access(a.jobId),
    records = (await (await lookup(token)).json()).records;
  await submit(body(token, records));
  const renewal = await mutate(a.jobId, "replace");
  assert.equal(renewal.status, 200);
  const next = (await renewal.json()).token;
  assert.notEqual(next, token);
  assert.equal((await lookup(token)).status, 404);
  assert.equal((await lookup(next)).status, 200);
  assert.equal((await mutate(a.jobId, "close")).status, 200);
  assert.equal((await lookup(next)).status, 410);
  assert.equal(
    (
      await db.query("select status from artwork_proofs where id=$1", [
        a.proofId,
      ])
    ).rows[0].status,
    "approved",
  );
});
test("website order lookup opens the existing job without exposing other jobs to a customer", async () => {
  const id = await order(db),
    a = await create({ order_id: id });
  const found = await adminRoute.GET(
    new Request(origin + "/api/artwork-proofs?orderId=" + id, {
      headers: { Authorization: auth },
    }),
  );
  assert.equal((await found.json()).records[0].orderId, a.jobId);
  assert.equal(
    (await (await lookup(await access(a.jobId))).json()).records.length,
    1,
  );
  const empty = await adminRoute.GET(
    new Request(origin + "/api/artwork-proofs?orderId=" + randomUUID(), {
      headers: { Authorization: auth },
    }),
  );
  assert.deepEqual((await empty.json()).records, []);
});
test("malformed, oversize and arbitrary customer actions never mutate records", async () => {
  assert.equal((await lookup("short")).status, 404);
  assert.equal(
    (
      await customerRoute.POST(
        api("/api/artwork-approval", {
          action: "close",
          token: "a".repeat(43),
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await customerRoute.POST(
        new Request(origin + "/api/artwork-approval", {
          method: "POST",
          body: "{broken",
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await customerRoute.POST(
        new Request(origin + "/api/artwork-approval", {
          method: "POST",
          body: " ".repeat(1024 * 1024 + 1),
        }),
      )
    ).status,
    413,
  );
});
