import { before, beforeEach, after, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { TERMS_VERSION } from '../src/lib/terms.ts';
let POST, writes, messages;
before(async () => {
  mock.module('../src/lib/supabase-admin.ts', { namedExports: { supabase: { from(table) {
    assert.equal(table, 'orders');
    return { insert(rows) { writes.push(...rows); return { async select() { return { data: [{ id: 'fictional-order', ...rows[0] }], error: null }; } }; } };
  } } } });
  mock.module('../src/lib/sendgrid.ts', { defaultExport: { async send(message) { messages.push(message); } } });
  ({ POST } = await import('../src/app/api/orders/route.ts'));
});
beforeEach(() => { writes = []; messages = []; });
after(() => mock.restoreAll());
const item = { id: 'fictional-item', productType: 'sticker', size: { wIn: 2, hIn: 2 }, quantity: 500, material: 'matte', shape: 'square', unitPrice: .264, subtotal: 132 };
function request(changes = {}) {
  return new Request('https://example.invalid/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer: { name: 'Fictional test customer', email: 'fictional@example.invalid', state: 'MI' }, items: [item], total: 148.42, acceptance: { termsAccepted: true, rightsConfirmed: true, termsVersion: TERMS_VERSION }, ...changes }) });
}
test('stale price is returned for explicit review without storing an order or sending email', async () => {
  const response = await POST(request({ items: [{ ...item, subtotal: 115, unitPrice: .23 }], total: 130.4 }));
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.code, 'PRICE_CHANGED');
  assert.equal(body.quote.subtotal, 132);
  assert.equal(body.quote.total, 148.42);
  assert.equal(writes.length, 0);
  assert.equal(messages.length, 0);
});
test('altered totals and line prices cannot reach the database or email service', async () => {
  for (const changes of [{ total: .01 }, { total: null }, { total: '148.42' }, { items: [{ ...item, subtotal: .01 }] }, { items: [{ ...item, unitPrice: .001 }] }]) {
    assert.equal((await POST(request(changes))).status, 409);
  }
  assert.equal(writes.length, 0);
  assert.equal(messages.length, 0);
});
test('invalid product choices, counts and bag minimums are rejected without side effects', async () => {
  for (const bad of [{ ...item, quantity: -1 }, { ...item, quantity: 1.5 }, { ...item, material: 'invented' }, { ...item, shape: 'invented' }, { productType: 'mylar', size: { id: 'eighth' }, quantity: 1 }]) {
    assert.equal((await POST(request({ items: [bad] }))).status, 400);
  }
  assert.equal(writes.length, 0);
  assert.equal(messages.length, 0);
});
test('valid order stores server-calculated prices and retains both required consents', async () => {
  const response = await POST(request());
  assert.equal(response.status, 200);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].total, 148.42);
  assert.equal(writes[0].items[0].subtotal, 132);
  assert.equal(writes[0].terms_version, TERMS_VERSION);
  assert.ok(writes[0].terms_accepted_at);
  assert.ok(writes[0].artwork_rights_accepted_at);
  assert.equal(messages.length, 2);
  assert.match(messages[0].text, /148\.42/);
});
test('pricing changes do not bypass artwork-rights or terms acceptance', async () => {
  assert.equal((await POST(request({ acceptance: { termsAccepted: true, rightsConfirmed: false, termsVersion: TERMS_VERSION } }))).status, 400);
  assert.equal(writes.length, 0);
  assert.equal(messages.length, 0);
});
