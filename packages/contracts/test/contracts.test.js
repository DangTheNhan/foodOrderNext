import assert from 'node:assert/strict';
import test from 'node:test';
import { ORDER_STATUSES, ASSIGNMENT_STATUSES, profileBootstrapInputSchema, profilePatchInputSchema, cartInputSchema, quantitySchema, moneyVndSchema, normalizeNameKey } from '../src/index.js';

test('domain statuses and assignment states have exact shared names', () => {
  assert.equal(ORDER_STATUSES.length, 8);
  assert.ok(ORDER_STATUSES.includes('READY_FOR_PICKUP'));
  assert.ok(!ORDER_STATUSES.includes('PICKED_UP'));
  assert.deepEqual(ASSIGNMENT_STATUSES, ['UNASSIGNED', 'ASSIGNED', 'ACCEPTED']);
});
test('public profile input schemas cannot set authority fields', () => {
  assert.equal(profileBootstrapInputSchema.safeParse({ role: 'admin' }).success, false);
  assert.equal(profilePatchInputSchema.safeParse({ active: true }).success, false);
  assert.equal(profilePatchInputSchema.safeParse({}).success, false);
  assert.deepEqual(profilePatchInputSchema.parse({ displayName: ' Bạn ' }), { displayName: 'Bạn' });
});
test('VND and portions reject fractions, negatives and unsafe values', () => {
  for (const value of [-1, 1.2, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.equal(moneyVndSchema.safeParse(value).success, false);
  assert.equal(moneyVndSchema.parse(45000), 45000);
  for (const value of [0, 100, 1.5]) assert.equal(quantitySchema.safeParse(value).success, false);
});
test('cart bounds and normalized line uniqueness are enforced', () => {
  const line = { foodId: 'food-1', quantity: 1, optionIds: ['o1', 'o2'] };
  assert.equal(cartInputSchema.safeParse({ shopId: 'shop-1', expectedCartVersion: 0, items: [line, { ...line, optionIds: ['o2', 'o1'] }] }).success, false);
  assert.equal(cartInputSchema.safeParse({ shopId: 'shop-1', expectedCartVersion: 0, items: Array.from({ length: 21 }, (_, i) => ({ foodId: `food-${i}`, quantity: 1 })) }).success, false);
});
test('name key normalization supports Vietnamese prefix semantics', () => {
  assert.equal(normalizeNameKey('  Đậu   HŨ sốt  '), 'dau hu sot');
});
