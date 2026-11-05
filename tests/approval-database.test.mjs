import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  database,
  proofInput,
  order,
  issue,
  job,
  response,
  decision,
  row,
  produce,
  hash,
} from "./support/database.mjs";
let db;
before(async () => {
  db = await database();
});
after(async () => {
  await db?.close();
});
const link = (id, action, token = hash(randomUUID())) =>
  db.query("select public.manage_artwork_link($1,$2,$3,$4)", [
    id,
    action,
    token,
    "test-sealed-replacement",
  ]);

test("every current design must be approved before a linked order can enter production", async () => {
  const id = await order(db);
  await assert.rejects(produce(db, id), /Production is on hold/);
  const a = proofInput(id),
    pa = await issue(db, a),
    b = proofInput(id, a.job_id),
    pb = await issue(db, b);
  await response(db, a, [pa]);
  await assert.rejects(produce(db, id), /every current design/);
  await response(db, a, [pb]);
  await produce(db, id);
  for (const field of ["items", "order_notes", "customer_email"]) {
    const val =
      field === "items"
        ? JSON.stringify([{ quantity: 101 }])
        : "changed@example.com";
    await assert.rejects(
      db.query(`update public.orders set ${field}=$1 where id=$2`, [val, id]),
      /Production is on hold/,
    );
  }
});
test("one stable job link covers added designs and independent revisions, retaining other approvals", async () => {
  const id = await order(db),
    a = proofInput(id),
    pa = await issue(db, a),
    initial = await job(db, a.job_id),
    b = proofInput(id, a.job_id),
    pb = await issue(db, b);
  await response(db, a, [pa, pb]);
  await produce(db, id);
  const revisedInput = proofInput(id, a.job_id, { base_proof_id: pa.id }),
    revision = await issue(db, revisedInput),
    j = await job(db, a.job_id);
  assert.equal(revision.revision, 2);
  assert.equal(revision.design_id, pa.design_id);
  assert.equal(j.token_hash, initial.token_hash);
  assert.equal(j.token_sealed, initial.token_sealed);
  assert.equal((await row(db, pb.id)).status, "approved");
  assert.equal((await row(db, pa.id)).status, "approved");
  assert.equal(
    (await db.query("select status from orders where id=$1", [id])).rows[0]
      .status,
    "processing",
  );
  await assert.rejects(produce(db, id), /Production is on hold/);
  await assert.rejects(response(db, a, [pa]), /stale/);
  await response(db, a, [revision]);
  await produce(db, id);
});
test("mixed approve, request changes and decide later is atomic with separate promotional permission", async () => {
  const a = proofInput(),
    pa = await issue(db, a),
    b = proofInput(null, a.job_id),
    pb = await issue(db, b),
    c = proofInput(null, a.job_id),
    pc = await issue(db, c);
  await response(db, a, [], {
    decisions: [decision(pa), decision(pb, "request_changes")],
    promotional: true,
    restrictions: "Do not post before launch.",
  });
  const ra = await row(db, pa.id),
    rb = await row(db, pb.id),
    rc = await row(db, pc.id);
  assert.equal(ra.status, "approved");
  assert.equal(rb.status, "changes_requested");
  assert.equal(rc.status, "pending");
  assert.equal(ra.submission_id, rb.submission_id);
  assert.equal(ra.responded_at.getTime(), rb.responded_at.getTime());
  assert.deepEqual(ra.approved_proof_ids, [pa.id]);
  assert.equal(ra.promotional, true);
  assert.equal(ra.promotional_restrictions, "Do not post before launch.");
  assert.equal(rb.promotional, false);
  assert.equal(rb.terms_accepted, false);
  assert.equal(rb.electronic_consent, false);
  assert.equal(rb.promotional_restrictions, "");
  const revised = await issue(
    db,
    proofInput(null, a.job_id, { base_proof_id: pa.id }),
  );
  assert.equal(revised.promotional, false);
  assert.equal(revised.responded_at, null);
});
test("a bad selection rolls back the entire batch without recording partial approvals", async () => {
  const a = proofInput(),
    pa = await issue(db, a),
    b = proofInput(null, a.job_id),
    pb = await issue(db, b);
  for (const bad of [
    decision(pb, "request_changes", { changeNotes: "" }),
    decision(pb, "approve", { proofSha256: hash("wrong") }),
    decision(pb, "approve", { revision: 9 }),
    decision(pb, "approve", { termsVersion: "old" }),
    decision({ ...pb, id: randomUUID() }),
  ]) {
    await assert.rejects(
      response(db, a, [], { decisions: [decision(pa), bad] }),
    );
    assert.equal((await row(db, pa.id)).status, "pending");
    assert.equal((await row(db, pb.id)).status, "pending");
  }
  const foreign = proofInput(),
    pf = await issue(db, foreign);
  await assert.rejects(
    response(db, a, [], { decisions: [decision(pa), decision(pf)] }),
    /another order/,
  );
  assert.equal((await row(db, pa.id)).status, "pending");
  await assert.rejects(
    response(db, a, [], { decisions: [decision(pa), decision(pa)] }),
    /one response/,
  );
});
test("recipient, strict consents and current manifest version are checked by PostgreSQL", async () => {
  const a = proofInput(),
    pa = await issue(db, a),
    before = await job(db, a.job_id);
  await issue(db, proofInput(null, a.job_id));
  await assert.rejects(
    response(db, a, [pa], { jobVersion: before.version }),
    /Designs changed/,
  );
  await assert.rejects(
    response(db, a, [pa], { signerEmail: "other@example.com" }),
    /email this order/,
  );
  for (const patch of [
    { consents: [true, true, "true"] },
    { consents: [true, true] },
    { electronicConsent: "true" },
    { consents: [] },
  ])
    await assert.rejects(
      response(db, a, [pa], patch),
      /three approval statements/,
    );
  await response(db, a, [pa]);
  await assert.rejects(response(db, a, [pa]), /already has a response/);
});
test("change-only responses do not require approval consents and do not authorize printing", async () => {
  const id = await order(db),
    a = proofInput(id),
    pa = await issue(db, a);
  await response(db, a, [], {
    decisions: [decision(pa, "request_changes")],
    consents: [],
    electronicConsent: false,
    promotional: true,
  });
  const record = await row(db, pa.id);
  assert.equal(record.promotional, false);
  assert.equal(record.rights_confirmed, false);
  assert.equal(record.proof_approved, false);
  await assert.rejects(produce(db, id), /Production is on hold/);
});
test("changing website specifications requires fresh proofs and a stale revision cannot be revised", async () => {
  const id = await order(db),
    a = proofInput(id),
    pa = await issue(db, a);
  await db.query("update orders set order_notes='Gloss instead' where id=$1", [
    id,
  ]);
  await assert.rejects(response(db, a, [pa]), /specifications changed/);
  const revised = await issue(
    db,
    proofInput(id, a.job_id, { base_proof_id: pa.id }),
  );
  assert.equal((await row(db, pa.id)).status, "superseded");
  await assert.rejects(
    issue(db, proofInput(id, a.job_id, { base_proof_id: pa.id })),
    /newer proof/,
  );
  await response(db, a, [revised]);
  await produce(db, id);
});
test("link replacement invalidates the old token; closure and expiry retain all signed evidence", async () => {
  const a = proofInput(),
    pa = await issue(db, a);
  await response(db, a, [pa]);
  const newHash = hash("replacement");
  await link(a.job_id, "replace", newHash);
  await assert.rejects(response(db, a, [pa]), /closed or expired/);
  assert.equal((await row(db, pa.id)).status, "approved");
  await link(a.job_id, "close");
  assert.ok((await job(db, a.job_id)).cancelled_at);
  await assert.rejects(issue(db, proofInput(null, a.job_id)), /closed/);
  await assert.rejects(link(a.job_id, "replace"), /closed/);
  const exp = proofInput(),
    pe = await issue(db, exp);
  await db.query(
    "update artwork_jobs set expires_at=now()-interval '1 day' where id=$1",
    [exp.job_id],
  );
  await assert.rejects(response(db, exp, [pe]), /closed or expired/);
});
test("signed records, reviewed files, terms, and linked orders cannot be edited away", async () => {
  const id = await order(db),
    a = proofInput(id),
    pa = await issue(db, a);
  await response(db, a, [pa]);
  for (const [field, value] of [
    ["signer_name", "Changed"],
    ["proof_sha256", hash("changed")],
    ["promotional", true],
  ])
    await assert.rejects(
      db.query(`update artwork_proofs set ${field}=$1 where id=$2`, [
        value,
        pa.id,
      ]),
      /Retain proof/,
    );
  await assert.rejects(
    db.query("delete from artwork_proofs where id=$1", [pa.id]),
    /Retain proof/,
  );
  await assert.rejects(
    db.query("delete from orders where id=$1", [id]),
    /foreign key/,
  );
  const b = proofInput(),
    pb = await issue(db, b);
  await assert.rejects(
    db.query("update artwork_proofs set print_specs='{}' where id=$1", [pb.id]),
    /immutable/,
  );
});
test("cancelled and fulfilled orders reject new proofs and prevent accidental approval", async () => {
  const id = await order(db),
    a = proofInput(id),
    pa = await issue(db, a);
  await db.query("update orders set status='cancelled' where id=$1", [id]);
  await assert.rejects(response(db, a, [pa]), /cancelled/);
  await assert.rejects(issue(db, proofInput(id, a.job_id)), /closed/);
  const id2 = await order(db),
    b = proofInput(id2),
    pb = await issue(db, b);
  await response(db, b, [pb]);
  await produce(db, id2);
  await db.query("update orders set status='shipped' where id=$1", [id2]);
  await assert.rejects(issue(db, proofInput(id2, b.job_id)), /closed/);
});
test("different versions of agreement cannot silently share one approval signature", async () => {
  const a = proofInput(),
    pa = await issue(db, a),
    snapshot = structuredClone(a.terms_snapshot);
  snapshot.version = "future-version";
  const pb = await issue(
    db,
    proofInput(null, a.job_id, {
      terms_version: snapshot.version,
      terms_snapshot: snapshot,
    }),
  );
  await assert.rejects(response(db, a, [pa, pb]), /same terms version/);
  assert.equal((await row(db, pa.id)).status, "pending");
});
test("anonymous/customer roles cannot read evidence, call mutations, or reach proof storage through broad old policies", async () => {
  for (const role of ["anon", "authenticated"]) {
    await db.exec("set role " + role);
    try {
      for (const table of [
        "artwork_jobs",
        "artwork_designs",
        "artwork_proofs",
      ]) {
        await assert.rejects(
          db.query("select * from public." + table),
          /permission denied/,
        );
        await assert.rejects(
          db.query("delete from public." + table),
          /permission denied/,
        );
      }
      for (const sql of [
        "select public.create_artwork_proof('{}')",
        "select public.respond_to_artwork_job('x','{}')",
        `select public.manage_artwork_link('${randomUUID()}','close')`,
      ])
        await assert.rejects(db.query(sql), /permission denied/);
      await assert.rejects(
        db.query(
          "insert into storage.objects(bucket_id,name) values('artwork-proofs','forged.pdf')",
        ),
        /row-level security/,
      );
      await db.query(
        "insert into storage.objects(bucket_id,name) values('designs','allowed.png')",
      );
    } finally {
      await db.exec("reset role");
    }
  }
  const b = (
    await db.query("select * from storage.buckets where id='artwork-proofs'")
  ).rows[0];
  assert.equal(b.public, false);
  assert.equal(Number(b.file_size_limit), 2097152);
});
test("service-role execution works with invoker security and limited table/function grants", async () => {
  const id = await order(db),
    a = proofInput(id);
  await db.exec("set role service_role");
  try {
    const p = await issue(db, a);
    await response(db, a, [p]);
    await produce(db, id);
    await link(a.job_id, "close");
  } finally {
    await db.exec("reset role");
  }
  assert.equal(
    (await db.query("select status from orders where id=$1", [id])).rows[0]
      .status,
    "processing",
  );
});
