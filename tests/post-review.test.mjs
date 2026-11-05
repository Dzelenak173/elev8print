import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { POST } from "../src/app/api/posts/review/route.ts";

const originalFetch = globalThis.fetch;
const originalSecret = process.env.JWT_SECRET;
const originalWebhook = process.env.MAKE_POST_REVIEW_WEBHOOK_URL;
let calls;

beforeEach(() => {
  calls = [];
  process.env.JWT_SECRET = "local-post-review-test-key";
  process.env.MAKE_POST_REVIEW_WEBHOOK_URL = "https://example.invalid/private-post-review";
  globalThis.fetch = async (...args) => {
    calls.push(args);
    return new Response("Accepted", { status: 200 });
  };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
  if (originalWebhook === undefined) delete process.env.MAKE_POST_REVIEW_WEBHOOK_URL;
  else process.env.MAKE_POST_REVIEW_WEBHOOK_URL = originalWebhook;
});

function request(body, role = "admin") {
  const headers = { "Content-Type": "application/json" };
  if (role) headers.Authorization = `Bearer ${jwt.sign({ role }, process.env.JWT_SECRET)}`;
  return new Request("http://localhost/api/posts/review", { method: "POST", headers, body: JSON.stringify(body) });
}

test("post review denies anonymous and non-admin calls without contacting the webhook", async () => {
  for (const role of [null, "customer"]) {
    const response = await POST(request({ id: "post-1", status: "approved" }, role));
    assert.equal(response.status, 401);
  }
  assert.equal(calls.length, 0);
});

test("post review rejects malformed JSON and invalid decisions before any webhook call", async () => {
  const invalid = request({}, "admin");
  invalid.json = async () => { throw new SyntaxError("Invalid JSON"); };
  assert.equal((await POST(invalid)).status, 400);
  for (const body of [null, { id: "", status: "approved" }, { id: "post-1", status: "published" }, { id: "x".repeat(129), status: "denied" }]) {
    assert.equal((await POST(request(body))).status, 400);
  }
  assert.equal(calls.length, 0);
});

test("post review reports missing server configuration without contacting an external service", async () => {
  delete process.env.MAKE_POST_REVIEW_WEBHOOK_URL;
  assert.equal((await POST(request({ id: "post-1", status: "approved" }))).status, 503);
  assert.equal(calls.length, 0);
});

test("post review forwards only the selected decision and keeps webhook details out of responses", async () => {
  for (const status of ["approved", "denied"]) {
    const response = await POST(request({ id: "post-1", status, ignored: "extra" }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true });
    const [url, options] = calls.at(-1);
    assert.equal(url, process.env.MAKE_POST_REVIEW_WEBHOOK_URL);
    assert.deepEqual(JSON.parse(options.body), { id: "post-1", status });
    assert.equal(options.redirect, "error");
    assert.equal(response.headers.get("cache-control"), "private, no-store");
  }
});

test("post review returns a generic failure when the upstream service rejects or throws", async () => {
  for (const reject of [false, true]) {
    globalThis.fetch = async () => {
      if (reject) throw new Error(process.env.MAKE_POST_REVIEW_WEBHOOK_URL);
      return new Response("Sensitive upstream details", { status: 500 });
    };
    const response = await POST(request({ id: "post-1", status: "approved" }));
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: "Unable to update this post. Please try again." });
  }
});
