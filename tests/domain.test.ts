import test from 'node:test';
import assert from 'node:assert/strict';
import { contactSchema, defaults, emptyContact, estimate, furniture, itemTotal, mergeItem, ownerUpdateSchema, requestSchema } from '../src/lib/domain';

test('percentages compound before half-up rounding per unit', () => {
  const tariffs = { ...defaults.tariffs, prices: { ...defaults.tariffs.prices, mattress: [101, 2800] as [number, number] }, secondSidePercent: 49, heavyPercent: 31 };
  assert.equal(itemTotal({ ...furniture('mattress'), second: true, heavy: true, qty: 2 }, tariffs), 394);
  assert.equal(itemTotal({ ...furniture('mattress'), second: true, heavy: true, qty: 2 }, defaults.tariffs), 7600);
  const half = { ...tariffs, heavyPercent: 50 };
  assert.equal(itemTotal({ ...furniture('mattress'), heavy: true, qty: 2 }, half), 304);
});

test('minimum covers cleaning; travel separate; mixed and manual estimates keep unknown amounts null', () => {
  const chair = furniture('chair');
  const manual = { ...furniture('other'), qty: 2, description: 'Банкетка' };
  assert.deepEqual(estimate([chair, manual], defaults.tariffs, true), {
    lines: [650, null], subtotal: 650, minimumAdjustment: 1150, travel: 700, total: 2500, manualCount: 2,
  });
  assert.deepEqual(estimate([manual], defaults.tariffs, true), {
    lines: [null], subtotal: 0, minimumAdjustment: 0, travel: 700, total: null, manualCount: 2,
  });
  assert.equal(estimate([], defaults.tariffs, true).travel, 0);
});

test('deduplicates matching baskets, retains options and caps quantities', () => {
  const sofa = furniture('sofa');
  assert.equal(mergeItem([sofa], { ...sofa, qty: 2 })?.[0].qty, 3);
  assert.equal(mergeItem([sofa], { ...sofa, heavy: true })?.length, 2);
  assert.equal(mergeItem([{ ...sofa, qty: 99 }], sofa), null);
});

test('dates, manual photos, consent and agreed status are checked at the boundary', () => {
  const contact = { ...emptyContact, name: 'Тест', phone: '+1 202 555 0104', address: 'Тестовая улица, 1', consent: true };
  assert.equal(contactSchema.safeParse({ ...contact, time: '13:20' }).success, false);
  assert.equal(contactSchema.safeParse({ ...contact, date: '2030-02-30' }).success, false);
  assert.equal(contactSchema.safeParse({ ...contact, date: '2032-02-29' }).success, true);
  assert.equal(requestSchema.safeParse({ key: crypto.randomUUID(), items: [{ ...furniture('other'), description: 'Образец' }], contact, photos: [] }).success, false);
  const update = { status: 'agreed', finalPrice: null, note: '', agreedDate: '', agreedTime: '' };
  assert.equal(ownerUpdateSchema.safeParse(update).success, false);
  assert.equal(ownerUpdateSchema.safeParse({ ...update, finalPrice: 3500, agreedDate: '2030-02-25', agreedTime: '14:40' }).success, true);
});
