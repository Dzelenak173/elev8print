import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { ARTWORK_MAX_BYTES, saveCartArtwork, readCartArtwork, deleteCartArtwork, validateArtwork } from '../src/lib/cart-artwork.ts';
import { prepareCheckoutItems, uploadCartArtwork } from '../src/lib/checkout-artwork.ts';
import * as artworkStorage from '../src/lib/cart-artwork.ts';

const storage = new Map();
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
globalThis.window = { localStorage: globalThis.localStorage };
let readGate = null;
let readStarted = null;
mock.module(new URL('../src/lib/cart-artwork.ts', import.meta.url).href, { namedExports: {
  ...artworkStorage,
  readCartArtwork: async (id) => {
    const result = await artworkStorage.readCartArtwork(id);
    if (readGate) { readStarted?.(); await readGate; }
    return result;
  },
} });
const { useCartStore } = await import('../src/lib/cart.ts');
const originalFetch = globalThis.fetch;
const originalPut = IDBObjectStore.prototype.put;
const bytes = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 255, 0, 128, 19, 24]);
const file = (name = 'fictional-design.png', content = bytes, type = 'image/png') => new File([content], name, { type, lastModified: 1730000000000 });
const params = (overrides = {}) => ({ size: { wIn: 2, hIn: 2 }, material: 'matte', quantity: 500, designFileId: file(), ...overrides });
const hash = data => createHash('sha256').update(Buffer.from(data)).digest('hex');

beforeEach(() => {
  readGate = null;
  readStarted = null;
  globalThis.indexedDB = new IDBFactory();
  storage.clear();
  useCartStore.setState({ items: [] });
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  IDBObjectStore.prototype.put = originalPut;
});

async function reloadCart() {
  const persisted = storage.get('elevate_cart_v1');
  useCartStore.setState({ items: [] });
  storage.set('elevate_cart_v1', persisted);
  await useCartStore.persist.rehydrate();
  return useCartStore.getState().restoreArtwork();
}

test('original bytes survive JSON cart hydration and reach the actual upload FormData unchanged', async () => {
  const id = await useCartStore.getState().addItem(params());
  const json = storage.get('elevate_cart_v1');
  assert.ok(json.length < 1000, 'localStorage contains small metadata, not a base64 image');
  const saved = JSON.parse(json).state.items[0];
  assert.equal(saved.artworkName, 'fictional-design.png');
  assert.equal(saved.artworkExpected, true);
  assert.equal('previewUrl' in saved, false);
  assert.equal('designFileId' in saved, false);
  assert.doesNotMatch(json, /data:|blob:/);

  const restored = await reloadCart();
  const original = restored[0].designFileId;
  assert.ok(original instanceof File);
  assert.equal(original.name, 'fictional-design.png');
  assert.equal(original.type, 'image/png');
  assert.equal(original.lastModified, 1730000000000);
  assert.equal(hash(await original.arrayBuffer()), hash(bytes));
  assert.match(restored[0].previewUrl, /^blob:/);
  assert.equal(restored[0].artworkMissing, false);

  let uploads = 0;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/orders/upload');
    assert.equal(options.method, 'POST');
    const uploaded = options.body.get('file');
    assert.equal(uploaded.name, `${id}-fictional-design.png`);
    assert.equal(uploaded.type, 'image/png');
    assert.equal(hash(await uploaded.arrayBuffer()), hash(bytes));
    uploads++;
    return Response.json({ url: 'https://example.invalid/original.png' });
  };
  const orderItems = await prepareCheckoutItems(restored, uploadCartArtwork);
  assert.equal(uploads, 1);
  assert.equal(orderItems[0].designFileUrl, 'https://example.invalid/original.png');
  assert.equal(orderItems[0].designFileId, null);
  assert.equal(orderItems[0].previewUrl, null);
  assert.equal('artworkId' in orderItems[0], false);
  assert.equal(orderItems[0].subtotal, 132);
});

test('a missing saved original blocks the entire cart before any uploads; reattachment fixes it', async () => {
  const id = await useCartStore.getState().addItem(params());
  await useCartStore.getState().addItem(params());
  await deleteCartArtwork(id);
  let items = await reloadCart();
  assert.equal(items[0].artworkMissing, true);
  let uploads = 0;
  await assert.rejects(prepareCheckoutItems(items, async () => { uploads++; return 'unexpected'; }), /Attach the artwork again/);
  assert.equal(uploads, 0);
  await useCartStore.getState().attachArtwork(id, file('reattached.png'));
  items = await reloadCart();
  assert.equal(items[0].artworkMissing, false);
  assert.equal(items[0].designFileId.name, 'reattached.png');
});

test('legacy JSON-serialized File objects and preview-only carts retain specs and request reattachment', async () => {
  for (const legacy of [{ designFileId: {}, previewUrl: 'data:image/png;base64,AA==' }, { previewUrl: 'blob:expired' }]) {
    storage.set('elevate_cart_v1', JSON.stringify({ version: 0, state: { currency: 'USD', items: [{ id: 'old-cart', productType: 'sticker', size: { wIn: 2, hIn: 2 }, material: 'matte', quantity: 500, subtotal: 115, unitPrice: .23, ...legacy }] } }));
    await useCartStore.persist.rehydrate();
    const items = await useCartStore.getState().restoreArtwork();
    assert.equal(items[0].artworkMissing, true);
    assert.equal(items[0].quantity, 500);
    assert.equal(items[0].previewUrl, null);
    await assert.rejects(prepareCheckoutItems(items, async () => 'unexpected'), /Attach the artwork again/);
    await useCartStore.getState().refreshPrices();
    assert.equal(useCartStore.getState().items[0].subtotal, 132);
  }
});

test('orders that never had artwork remain optional, and PDFs keep their original without a broken image preview', async () => {
  await useCartStore.getState().addItem(params({ designFileId: null }));
  await useCartStore.getState().addItem(params({ designFileId: file('original.pdf', '%PDF fictional', 'application/pdf') }));
  const items = await reloadCart();
  assert.equal(items[0].artworkMissing, false);
  assert.equal(items[1].previewUrl, null);
  assert.equal(await items[1].designFileId.text(), '%PDF fictional');
  let uploads = 0;
  const result = await prepareCheckoutItems(items, async () => { uploads++; return 'https://example.invalid/original.pdf'; });
  assert.equal(uploads, 1);
  assert.equal('designFileUrl' in result[0], false);
});

test('invalid, empty and oversized files fail before a cart row is added', async () => {
  for (const invalid of [file('bad.exe'), file('empty.png', ''), file('huge.png', new Uint8Array(ARTWORK_MAX_BYTES + 1))]) {
    await assert.rejects(useCartStore.getState().addItem(params({ designFileId: invalid })));
    assert.equal(useCartStore.getState().items.length, 0);
  }
  validateArtwork(file('at-limit.png', new Uint8Array(ARTWORK_MAX_BYTES)));
});

test('unavailable storage and transaction commit failures cannot leave a row claiming its artwork was saved', async () => {
  globalThis.indexedDB = undefined;
  await assert.rejects(useCartStore.getState().addItem(params()), /Allow site storage/);
  assert.equal(useCartStore.getState().items.length, 0);
  globalThis.indexedDB = new IDBFactory();
  IDBObjectStore.prototype.put = function (...args) {
    const request = originalPut.apply(this, args);
    request.addEventListener('success', () => this.transaction.abort());
    return request;
  };
  await assert.rejects(saveCartArtwork('aborted', file()), /Allow site storage/);
  assert.equal(await readCartArtwork('aborted'), null);
  await assert.rejects(useCartStore.getState().addItem(params()), /Allow site storage/);
  assert.equal(useCartStore.getState().items.length, 0);
});

test('replacement survives an older restore finishing later without resetting price or quantity edits', async () => {
  const id = await useCartStore.getState().addItem(params());
  const saved = storage.get('elevate_cart_v1');
  useCartStore.setState({ items: [] });
  storage.set('elevate_cart_v1', saved);
  await useCartStore.persist.rehydrate();
  let releaseRead;
  readGate = new Promise(resolve => { releaseRead = resolve; });
  const started = new Promise(resolve => { readStarted = resolve; });
  const pending = useCartStore.getState().restoreArtwork();
  await started;
  await useCartStore.getState().attachArtwork(id, file('revision.png', 'new bytes'));
  await useCartStore.getState().updateQuantity(id, 300);
  releaseRead();
  await pending;
  const item = useCartStore.getState().items[0];
  assert.equal(item.artworkName, 'revision.png');
  assert.equal(item.quantity, 300);
  assert.equal(item.subtotal, 97);
  assert.equal(await item.designFileId.text(), 'new bytes');
});

test('removing, replacing and clearing cart rows clean their saved local files', async () => {
  const id = await useCartStore.getState().addItem(params());
  await useCartStore.getState().attachArtwork(id, file('revision.png'));
  // Replacement cleanup is asynchronous; the subsequent transaction observes it.
  assert.equal(await readCartArtwork(id), null);
  const replacementKey = useCartStore.getState().items[0].artworkId;
  await useCartStore.getState().removeItem(id);
  assert.equal(await readCartArtwork(replacementKey), null);
  const second = await useCartStore.getState().addItem(params());
  await useCartStore.getState().clear();
  assert.equal(await readCartArtwork(second), null);
  assert.equal(useCartStore.getState().items.length, 0);
});

test('an older restore cannot bring a removed item back into the cart', async () => {
  const id = await useCartStore.getState().addItem(params());
  const saved = storage.get('elevate_cart_v1');
  useCartStore.setState({ items: [] });
  storage.set('elevate_cart_v1', saved);
  await useCartStore.persist.rehydrate();
  let releaseRead;
  readGate = new Promise(resolve => { releaseRead = resolve; });
  const started = new Promise(resolve => { readStarted = resolve; });
  const pending = useCartStore.getState().restoreArtwork();
  await started;
  await useCartStore.getState().removeItem(id);
  releaseRead();
  await pending;
  assert.equal(useCartStore.getState().items.length, 0);
});

test('an upload failure rejects preparation instead of silently omitting the original', async () => {
  await useCartStore.getState().addItem(params());
  globalThis.fetch = async () => Response.json({ error: 'Upload unavailable' }, { status: 503 });
  await assert.rejects(prepareCheckoutItems(useCartStore.getState().items, uploadCartArtwork), /Upload unavailable/);
  assert.ok(useCartStore.getState().items[0].designFileId instanceof File);
});
