import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import request from 'supertest';
import * as sdk from 'firebase/firestore';
import { createApp } from '../../services/api/src/app.js';
import { readConfig } from '../../services/api/src/config.js';
import { createFirebaseServices } from '../../services/api/src/firebase.js';
import { FirestoreCustomerRepository } from '../../services/api/src/customer.js';
import { FirestoreUserRepository } from '../../services/api/src/users.js';
import { menuPageQuery, shopPageQuery } from '../../apps/mobile/src/services/customerQueries.js';
import { context, testEnvironment } from '../rules/helpers.mjs';

const enabled = process.env.RUN_EMULATOR_TESTS === '1';

test('P02 scoped catalog queries use the actual Firestore Rules and stable cursors', { skip: !enabled }, async () => {
  const env = await testEnvironment('customer');
  try {
    await env.withSecurityRulesDisabled(async ctx => {
      const db = ctx.firestore();
      await Promise.all([
        sdk.setDoc(sdk.doc(db, 'shops/live'), { active: true, name: 'Campus' }),
        sdk.setDoc(sdk.doc(db, 'shops/closed'), { active: false, name: 'Hidden' }),
        ...[
          ['a', 'com ga', 30000, 'live', 'meal', true], ['b', 'com ga', 30000, 'live', 'meal', true],
          ['c', 'com suon', 40000, 'live', 'meal', true], ['d', 'tra', 10000, 'live', 'drink', true],
          ['e', 'com suon', 40000, 'live', 'meal', false], ['f', 'com ga', 30000, 'closed', 'meal', true],
        ].map(([id, nameKey, priceVnd, shopId, categoryId, active]) => sdk.setDoc(sdk.doc(db, 'menuItems', id),
          { nameKey, priceVnd, shopId, categoryId, active })),
      ]);
    });
    const db = context(env, 'browser').firestore();
    const shops = await sdk.getDocs(shopPageQuery(sdk, db));
    assert.deepEqual(shops.docs.map(doc => doc.id), ['live']);
    const filter = { mode: 'name', prefix: 'Cơm', categoryId: 'meal' };
    const first = await sdk.getDocs(menuPageQuery(sdk, db, 'live', filter, null, 1));
    const next = await sdk.getDocs(menuPageQuery(sdk, db, 'live', filter, first.docs[0], 2));
    assert.deepEqual([...first.docs, ...next.docs].map(doc => doc.id), ['a', 'b', 'c']);
    const price = await sdk.getDocs(menuPageQuery(sdk, db, 'live', { mode: 'price', maxPrice: 30000, categoryId: 'meal' }));
    assert.deepEqual(price.docs.map(doc => doc.id), ['a', 'b']);
    await assert.rejects(sdk.getDocs(menuPageQuery(sdk, db, 'closed', { mode: 'browse' })), { code: 'permission-denied' });
  } finally {
    await env.clearFirestore();
    await env.cleanup();
  }
});

test('P02 customer writes commit safely in Firestore', { skip: !enabled }, async t => {
  const config = readConfig();
  assert.equal(config.mode, 'emulator');
  assert.ok(config.projectId.startsWith('demo-'));
  const firebase = createFirebaseServices(config);
  const db = firebase.firestore;
  const suffix = randomUUID();
  const uid = 'p02-' + suffix;
  const other = uid + '-other';
  const shopId = uid + '-shop';
  const foodId = uid + '-food';
  const app = createApp({ userRepository: new FirestoreUserRepository(db),
    customerRepository: new FirestoreCustomerRepository(db), logger: { error() {} },
    verifyIdToken: async value => ({ uid: value === 'other' ? other : uid, email_verified: value !== 'unverified' }) });
  const call = (method, path, body, key = randomUUID(), bearer = 'customer') => {
    const req = request(app)[method]('/api/v1/me' + path).set('Authorization', 'Bearer ' + bearer).set('Idempotency-Key', key);
    return body ? req.send(body) : req;
  };
  const foodRef = db.doc('menuItems/' + foodId);
  const shopRef = db.doc('shops/' + shopId);
  const otherShop = db.doc('shops/' + shopId + '-other');
  const otherFood = db.doc('menuItems/' + foodId + '-other');
  const cartRef = db.doc('users/' + uid + '/carts/active');
  const profile = { active: true, role: 'customer', displayName: 'Synthetic', createdAt: new Date(), updatedAt: new Date() };
  const line = { foodId, quantity: 1, optionIds: ['large', 'extra'] };
  const address = { label: 'Campus', receiverName: 'Synthetic', phone: '0000000000',
    addressText: 'Synthetic campus gate', location: { latitude: 10.1, longitude: 106.1 }, locationSource: 'MANUAL' };
  try {
    await Promise.all([
      db.doc('users/' + uid).set(profile), db.doc('users/' + other).set(profile),
      shopRef.set({ active: true, acceptingOrders: true }), otherShop.set({ active: true, acceptingOrders: true }),
      otherFood.set({ shopId: otherShop.id, active: true, availablePortions: 5 }),
      foodRef.set({ shopId, active: true, availablePortions: 3, optionGroups: [
        { id: 'size', name: 'Size', minSelections: 1, maxSelections: 1, options: [{ id: 'large', name: 'Large', priceDeltaVnd: 1000 }] },
        { id: 'extra', name: 'Extra', minSelections: 0, maxSelections: 1, options: [{ id: 'extra', name: 'Extra', priceDeltaVnd: 2000 }] },
      ] }),
    ]);
    await t.test('cart normalizes options and rejects duplicates, 21 lines, stale and cross-shop writes', async () => {
      const mutation = { shopId, items: [line], expectedCartVersion: 0 };
      const key = randomUUID();
      assert.equal((await call('put', '/cart', mutation, randomUUID(), 'unverified')).status, 403);
      const invalid = [
        { ...mutation, items: [line, { ...line, optionIds: ['extra', 'large'] }] },
        { ...mutation, items: Array.from({ length: 21 }, (_, i) => ({ ...line, foodId: 'f'+i })) },
        { ...mutation, items: [{ ...line, quantity: 100 }] },
      ];
      for (const body of invalid) assert.equal((await call('put', '/cart', body)).status, 422);
      assert.equal((await call('put', '/cart', { ...mutation, shopId: otherShop.id })).body.error?.code, 'ITEM_UNAVAILABLE');
      assert.equal((await call('put', '/cart', { ...mutation, items: [{ ...line, optionIds: [] }] })).body.error?.code, 'ITEM_UNAVAILABLE');
      const response = await call('put', '/cart', mutation, key);
      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.equal((await call('put', '/cart', mutation, key)).body.meta.idempotencyReplayed, true);
      assert.equal((await call('put', '/cart', mutation)).body.error?.code, 'CART_VERSION_CONFLICT');
      assert.deepEqual((await cartRef.get()).data().items[0].optionIds, ['extra', 'large']);
      assert.equal((await call('put', '/cart', { ...mutation, expectedCartVersion: 1,
        items: [line, { ...line, quantity: 3, optionIds: ['large'] }] })).body.error?.code, 'OUT_OF_STOCK');
      const concurrent = await Promise.all([
        call('put', '/cart', { ...mutation, expectedCartVersion: 1, items: [{ ...line, quantity: 2 }] }),
        call('put', '/cart', { shopId: otherShop.id, expectedCartVersion: 1, items: [{ foodId: otherFood.id, quantity: 1 }] }),
      ]);
      assert.deepEqual(concurrent.map(res => res.status).sort(), [200, 409]);
      assert.equal((await call('delete', '/cart', { expectedCartVersion: 2 })).status, 200);
      assert.deepEqual((await cartRef.get()).data().items, []);
    });

    await t.test('address ownership, replay, defaults and coordinate validation', async () => {
      const key = randomUUID();
      const first = await call('post', '/addresses', address, key);
      assert.equal(first.status, 201, JSON.stringify(first.body));
      const id = first.body.data.addressId;
      assert.equal((await call('post', '/addresses', address, key)).body.data.addressId, id);
      assert.equal((await db.doc('users/' + uid).get()).data().defaultAddressId, id);
      assert.equal((await call('patch', '/addresses/' + id, { makeDefault: true }, randomUUID(), 'other')).status, 404);
      assert.equal((await call('patch', '/addresses/' + id, { label: 'Campus east' })).status, 200);
      assert.equal((await call('post', '/addresses', { ...address, location: { latitude: 100, longitude: 1 } })).status, 422);
      const second = await call('post', '/addresses', { ...address, location: null });
      assert.equal(second.status, 201);
      assert.equal((await call('delete', '/addresses/' + id)).status, 200);
      assert.equal((await db.doc('users/' + uid).get()).data().defaultAddressId, second.body.data.addressId);
    });

    await t.test('favorites are deduplicated and private, including after catalog deactivation', async () => {
      const path = '/favorites/' + foodId;
      assert.equal((await call('put', path)).status, 200);
      assert.equal((await call('put', path)).status, 200);
      assert.equal((await db.collection('users/' + uid + '/favorites').get()).size, 1);
      await foodRef.update({ active: false });
      assert.equal((await call('put', path, null, randomUUID(), 'other')).status, 404);
      assert.equal((await call('delete', path, null, randomUUID(), 'other')).status, 200);
      assert.equal((await db.collection('users/' + uid + '/favorites').get()).size, 1);
      assert.equal((await call('delete', path)).status, 200);
      assert.equal((await db.collection('users/' + uid + '/favorites').get()).size, 0);
    });
  } finally {
    const batch = db.batch();
    for (const ref of [foodRef, otherFood, shopRef, otherShop, cartRef, db.doc('users/' + uid), db.doc('users/' + other)]) batch.delete(ref);
    for (const id of [uid, other]) {
      for (const collection of ['addresses', 'favorites']) {
        (await db.collection('users/' + id + '/' + collection).get()).docs.forEach(doc => batch.delete(doc.ref));
      }
      (await db.collection('operations').where('uid', '==', id).get()).docs.forEach(doc => batch.delete(doc.ref));
    }
    await batch.commit();
    await firebase.close();
  }
});
