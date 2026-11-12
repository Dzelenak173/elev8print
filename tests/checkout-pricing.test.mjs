import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { getStickerPricing } from '../src/lib/pricing.ts';
import { getLocalStickerPricing, parseStickerSize } from '../src/lib/sticker-pricing.ts';
import { quoteOrder, orderMatchesQuote } from '../src/lib/checkout-pricing.ts';
import { checkoutTotals, FREE_SHIPPING_SUBTOTAL } from '../src/lib/order-totals.ts';
import { GET as pricingGET } from '../src/app/api/pricing/route.ts';

const storage = new Map();
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
globalThis.window = { localStorage: globalThis.localStorage };
const { useCartStore } = await import('../src/lib/cart.ts');
const originalFetch = globalThis.fetch;
const sticker = (overrides = {}) => ({ id: 'fictional-item', productType: 'sticker', size: { wIn: 2, hIn: 2, label: '2x2' }, quantity: 500, material: 'matte', shape: 'square', unitPrice: 0.264, subtotal: 132, ...overrides });
beforeEach(() => useCartStore.setState({ items: [] }));
afterEach(() => { globalThis.fetch = originalFetch; });

test('maker, object-size cart, quantity edits, API and server order all agree on $132', async () => {
  globalThis.fetch = async () => { throw new Error('Standard-size prices must not depend on a live third-party call'); };
  const maker = await getStickerPricing('2" × 2"', 500);
  assert.equal(maker.subtotal, 132);
  const id = await useCartStore.getState().addItem(sticker());
  assert.equal(useCartStore.getState().items[0].subtotal, maker.subtotal);
  await useCartStore.getState().updateQuantity(id, 300);
  assert.equal(useCartStore.getState().items[0].subtotal, 97);
  await useCartStore.getState().updateQuantity(id, 500);
  assert.equal(useCartStore.getState().items[0].subtotal, maker.subtotal);
  const api = await pricingGET(new NextRequest('https://example.invalid/api/pricing?width=2&height=2&qty=500'));
  assert.equal((await api.json()).subtotal, 132);
  const quote = await quoteOrder(useCartStore.getState().items);
  assert.equal(quote.subtotal, 132);
  assert.equal(quote.tax, 7.92);
  assert.equal(quote.total, 148.42);
  assert.ok(orderMatchesQuote(useCartStore.getState().items, quote.total, quote));
});

test('published benchmark totals are exact; intermediate quantities do not drop in total price', () => {
  for (const [size, total] of [['2x2',132],['3x3',210],['4x4',303],['5x5',403],['6x6',516],['7x7',644],['8x8',779],['9x9',931],['10x10',1089]]) {
    assert.equal(getLocalStickerPricing(size, 500).subtotal, total);
    let previous = 0;
    for (let qty = 1; qty <= 1300; qty++) {
      const price = getLocalStickerPricing(size, qty);
      assert.ok(price.subtotal >= previous, `${size} quantity ${qty} decreased its total`);
      previous = price.subtotal;
    }
  }
});

test('all six existing material choices remain accepted without invented premiums', async () => {
  for (const material of ['matte','holographic','clear','window-perf','heat-transfer','wall-stickers']) {
    assert.equal((await quoteOrder([sticker({ material })])).subtotal, 132);
  }
});

test('stored old prices refresh without discarding artwork still held in memory', async () => {
  const file = new File(['fictional test artwork'], 'fictional.png', { type: 'image/png' });
  useCartStore.setState({ items: [sticker({ subtotal: 115, unitPrice: .23, designFileId: file })] });
  await useCartStore.getState().refreshPrices();
  assert.equal(useCartStore.getState().items[0].subtotal, 132);
  assert.equal(useCartStore.getState().items[0].designFileId, file);
  assert.equal(JSON.parse(storage.get('elevate_cart_v1')).state.items[0].subtotal, 132);
});

test('a delayed quantity quote cannot resurrect a removed item or discard a newly added one', async () => {
  let respond;
  globalThis.fetch = () => new Promise(resolve => { respond = resolve; });
  useCartStore.setState({ items: [sticker({ size: { wIn: 2.6, hIn: 1.4 } })] });
  const pending = useCartStore.getState().updateQuantity('fictional-item', 600);
  useCartStore.getState().removeItem('fictional-item');
  const added = await useCartStore.getState().addItem(sticker());
  respond(Response.json({ subtotal: 140, unitPrice: .2333, qty: 600 }));
  await pending;
  assert.deepEqual(useCartStore.getState().items.map(item => item.id), [added]);
});

test('custom-size price follows client → API → benchmark, and checkout verifies the same value', async () => {
  let upstreamCalls = 0;
  globalThis.fetch = async (url) => {
    if (String(url).startsWith('/api/pricing?')) return pricingGET(new NextRequest('https://example.invalid' + url));
    const parsed = new URL(url);
    assert.equal(parsed.hostname, 'api.stickerapp.com');
    const attributes = JSON.parse(parsed.searchParams.get('attributes'));
    assert.equal(attributes.width_mm, 66);
    assert.equal(attributes.height_mm, 36);
    upstreamCalls++;
    return Response.json({ price: { total: 126 }, item: { attributes: { quantity: 500 } } });
  };
  const item = sticker({ size: { wIn: 2.6, hIn: 1.4 }, subtotal: 126, unitPrice: .252 });
  assert.equal((await getStickerPricing(item.size, 500)).subtotal, 126);
  assert.equal((await quoteOrder([item])).subtotal, 126);
  assert.equal(upstreamCalls, 2);
});

test('invalid quantities and sizes are rejected before any external quote', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('Unexpected external call'); };
  for (const qty of [0, -1, 1.5, NaN, Infinity, 10001, '', '500oops']) await assert.rejects(getStickerPricing('2x2', qty));
  for (const size of ['bad', '0x2', '-2x2', '53x2', '2x241', { wIn: '2', hIn: 2 }, { wIn: NaN, hIn: 2 }]) await assert.rejects(getStickerPricing(size, 500));
  assert.deepEqual(parseStickerSize({ wIn: 3, hIn: 4, label: '2x2' }), { width: 3, height: 4, key: '3x4' });
  const response = await pricingGET(new NextRequest('https://example.invalid/api/pricing?width=2&height=2&qty=500oops'));
  assert.equal(response.status, 400);
  assert.equal(calls, 0);
});

test('benchmark errors cannot turn into a zero-price item or leak upstream details', async () => {
  for (const result of [new Response('private upstream details', { status: 500 }), Response.json({ price: { total: -1 }, item: { attributes: { quantity: 500 } } }), Response.json({ price: { total: 126 } })]) {
    globalThis.fetch = async () => result;
    const response = await pricingGET(new NextRequest('https://example.invalid/api/pricing?width=2.6&height=1.4&qty=500'));
    assert.equal(response.status, 502);
    assert.doesNotMatch(JSON.stringify(await response.json()), /private upstream/);
  }
});

test('bag minimum is enforced by cart updates and server validation', async () => {
  const id = await useCartStore.getState().addItem({ productType: 'mylar', size: { id: 'eighth' }, quantity: 16 });
  await useCartStore.getState().updateQuantity(id, 1);
  assert.equal(useCartStore.getState().items[0].quantity, 16);
  assert.equal((await quoteOrder(useCartStore.getState().items)).subtotal, 32);
  await assert.rejects(quoteOrder([{ productType: 'mylar', size: { id: 'eighth' }, quantity: 1 }]));
  await assert.rejects(quoteOrder([{ productType: 'mylar', size: { id: 'eighth' }, quantity: 16.5 }]));
  await assert.rejects(quoteOrder([{ productType: 'mylar', size: { id: 'invented', basePrice: .01 }, quantity: 16 }]));
});

test('shipping notice and calculations share the $150 threshold; estimated tax remains 6%', () => {
  assert.equal(FREE_SHIPPING_SUBTOTAL, 150);
  assert.deepEqual(checkoutTotals(76, 2), { subtotal: 76, shipping: 8.5, tax: 4.56, total: 89.06 });
  assert.equal(FREE_SHIPPING_SUBTOTAL - 76, 74);
  assert.equal(checkoutTotals(150, 1).shipping, 0);
  assert.equal(checkoutTotals(0, 0).total, 0);
});

test('browser-supplied total, line totals and unit prices never override authoritative prices', async () => {
  const quote = await quoteOrder([sticker()]);
  assert.equal(orderMatchesQuote([sticker()], .01, quote), false);
  assert.equal(orderMatchesQuote([sticker({ subtotal: 1 })], quote.total, quote), false);
  assert.equal(orderMatchesQuote([sticker({ unitPrice: .001 })], quote.total, quote), false);
  assert.equal(orderMatchesQuote([sticker()], String(quote.total), quote), false);
});
