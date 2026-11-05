import { readFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { termsSnapshot, TERMS_VERSION } from "../../src/lib/terms.ts";
export const hash = (value) => createHash("sha256").update(value).digest("hex");
export async function database() {
  const db = new PGlite();
  await db.exec(`
  create role anon;create role authenticated;create role service_role bypassrls;
  grant usage on schema public to anon,authenticated,service_role;
  create table public.orders(id uuid primary key default gen_random_uuid(),customer_email text not null,items jsonb not null default '[]',order_notes text,status text not null default 'received');
  grant select,insert,update,delete on public.orders to service_role;
  create schema storage;grant usage on schema storage to anon,authenticated,service_role;
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
  alter table storage.objects enable row level security;
  grant select,insert,update,delete on storage.objects to anon,authenticated,service_role;
  create policy old_broad_policy on storage.objects for all to anon,authenticated using(true) with check(true);
 `);
  await db.exec(
    await readFile(
      new URL(
        "../../supabase/migrations/20261104183841_artwork_approval.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  return db;
}
export function proofInput(orderId = null, jobId = randomUUID(), patch = {}) {
  const id = randomUUID();
  return {
    id,
    job_id: jobId,
    order_id: orderId,
    design_id: randomUUID(),
    design_name: "Test design " + id.slice(0, 4),
    token_hash: hash(jobId),
    token_sealed: "test-sealed-link",
    reference: "Fictional test job",
    customer_name: "Sample Customer",
    customer_email: "sample@example.com",
    proof_path: `${jobId}/${id}.pdf`,
    proof_filename: "sample.pdf",
    proof_mime: "application/pdf",
    proof_sha256: hash("test " + id),
    print_specs: {
      product: "Stickers",
      quantity: 100,
      width: 3,
      height: 3,
      units: "in",
      material: "White vinyl",
      finish: "Matte",
      special: "No spot UV",
      notes: "Test",
    },
    terms_version: TERMS_VERSION,
    terms_snapshot: termsSnapshot(),
    reviewer_name: "Test Reviewer",
    review_notes: "Original test design and rights reviewed.",
    review_confirmed: true,
    ...patch,
  };
}
export async function order(db) {
  const id = randomUUID();
  await db.query(
    "insert into public.orders(id,customer_email,items,order_notes) values($1,$2,$3,$4)",
    [
      id,
      "sample@example.com",
      JSON.stringify([{ product: "Sticker", quantity: 100 }]),
      "Matte",
    ],
  );
  return id;
}
export async function issue(db, p) {
  return (
    await db.query("select * from public.create_artwork_proof($1::jsonb)", [
      JSON.stringify(p),
    ])
  ).rows[0];
}
export async function job(db, id) {
  return (await db.query("select * from public.artwork_jobs where id=$1", [id]))
    .rows[0];
}
export function decision(p, action = "approve", patch = {}) {
  return {
    proofId: p.id,
    revision: p.revision,
    proofSha256: p.proof_sha256,
    termsVersion: p.terms_version,
    action,
    changeNotes:
      action === "request_changes" ? "Move the cut line outward." : "",
    ...patch,
  };
}
export async function response(db, p, proofs, patch = {}) {
  const j = await job(db, p.job_id);
  const body = {
    jobVersion: j.version,
    signerName: "Sample Customer",
    signerEmail: "sample@example.com",
    business: "Test Company",
    consents: [true, true, true],
    electronicConsent: true,
    promotional: false,
    restrictions: "",
    decisions: proofs.map((x) => decision(x)),
    ...patch,
  };
  return (
    await db.query(
      "select public.respond_to_artwork_job($1,$2::jsonb) as count",
      [p.token_hash, JSON.stringify(body)],
    )
  ).rows[0];
}
export async function row(db, id) {
  return (
    await db.query("select * from public.artwork_proofs where id=$1", [id])
  ).rows[0];
}
export async function produce(db, id) {
  return db.query("update public.orders set status='producing' where id=$1", [
    id,
  ]);
}
