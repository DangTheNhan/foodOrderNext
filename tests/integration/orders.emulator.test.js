import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import request from 'supertest';
import { createApp } from '../../services/api/src/app.js';
import { readConfig } from '../../services/api/src/config.js';
import { createFirebaseServices } from '../../services/api/src/firebase.js';
import { FirestoreOrderRepository } from '../../services/api/src/orders.js';
import { FirestoreUserRepository } from '../../services/api/src/users.js';

test('P03 order engine commits state, stock, voucher and COD atomically', { skip: process.env.RUN_EMULATOR_TESTS !== '1' }, async t => {
  const config = readConfig();
  assert.equal(config.mode, 'emulator');
  assert.equal(config.projectId, 'demo-foodordernext');
  const { firestore: db, close } = createFirebaseServices(config);
  const tag = 'p03-' + randomUUID().slice(0, 12);
  const id = suffix => tag + '-' + suffix;
  const shopId = id('shop'), foodId = id('food'), voucherId = id('voucher');
  const first = id('first'), second = id('second'), merchant = id('merchant'), driver = id('driver'),
    driver2 = id('driver2'), admin = id('admin'), otherMerchant = id('othermerchant');
  const uids = [first, second, merchant, driver, driver2, admin, otherMerchant];
  const known = new Set(uids);
  const user = uid => db.doc('users/' + uid);
  const shop = db.doc('shops/' + shopId);
  const food = db.doc('menuItems/' + foodId);
  const voucher = db.doc('vouchers/' + voucherId);
  const codeKey = tag.toUpperCase();
  const registry = db.doc('voucherCodes/' + codeKey);
  const order = orderId => db.doc('orders/' + orderId);
  const now = new Date();
  let locationNow = Date.now();
  const repository = new FirestoreOrderRepository(db, () => locationNow);
  const app = createApp({ userRepository: new FirestoreUserRepository(db), orderRepository: repository,
    verifyIdToken: async token => {
      if (!known.has(token)) throw new Error('Unknown test identity');
      return { uid: token, email_verified: true };
    }, logger: { error() {} } });
  const post = (uid, path, payload, key = randomUUID()) =>
    request(app).post('/api/v1/orders' + path).set('Authorization', 'Bearer ' + uid).set('Idempotency-Key', key).send(payload);
  const base = { shopId, items: [{ foodId, quantity: 1, optionIds: [] }], addressId: 'campus' };
  const quote = async (uid, extra = {}) => {
    const result = await post(uid, '/quote', { ...base, ...extra });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    return result.body.data;
  };
  const purchase = (q, extra = {}) => ({ ...base, paymentMethod: 'COD', expectedGrandTotalVnd: q.grandTotalVnd,
    expectedQuoteKey: q.quoteKey, ...extra });
  const command = (uid, orderId, action, body, key) => post(uid, '/' + orderId + '/' + action, body, key);
  const activeCount = async ref => (await ref.get()).data().activeOrderCount;
  const stock = async () => {
    const { availablePortions, reservedPortions, soldPortions } = (await food.get()).data();
    return [availablePortions, reservedPortions, soldPortions];
  };
  const quota = async ref => {
    const { reservedCount, redeemedCount } = (await ref.get()).data() ?? { reservedCount: 0, redeemedCount: 0 };
    return [reservedCount, redeemedCount];
  };
  const customerCounter = uid => voucher.collection('userCounters').doc(uid);
  const orderIds = new Set();
  const created = response => {
    assert.equal(response.status, 201, JSON.stringify(response.body));
    orderIds.add(response.body.data.orderId);
    return response.body.data.orderId;
  };

  try {
    const roles = ['customer', 'customer', 'merchant', 'driver', 'driver', 'admin', 'merchant'];
    await Promise.all(uids.map((uid, index) => user(uid).set({
      active: true, role: roles[index], displayName: 'Tài khoản thử', createdAt: now, updatedAt: now, activeOrderCount: 0,
    })));
    await Promise.all([
      shop.set({ ownerUid: merchant, active: true, acceptingOrders: true, name: 'Quán thử P03', activeOrderCount: 0,
        deliveryFeeVnd: 5000, ratingSum: 0, ratingCount: 0, ratingAverage: 0 }),
      food.set({ shopId, active: true, categoryId: 'meals', name: 'Cơm thử', nameKey: 'com thu', priceVnd: 30000,
        currency: 'VND', availablePortions: 10, reservedPortions: 0, soldPortions: 0, revision: 1 }),
      registry.set({ shopId, voucherId }),
      voucher.set({ shopId, codeKey, active: true, startsAt: new Date(now.getTime() - 86400000),
        endsAt: new Date(now.getTime() + 86400000), minSubtotalVnd: 30000, discountType: 'PERCENT',
        percentBps: 1250, maxDiscountVnd: 3500, maxUses: 1, perUserLimit: 1, reservedCount: 0, redeemedCount: 0 }),
      ...[first, second].map(uid => user(uid).collection('addresses').doc('campus').set({ label: 'Khuôn viên', receiverName: 'Người nhận thử',
        phone: '0000000000', addressText: 'Địa chỉ thử tại khuôn viên', location: null, locationSource: 'MANUAL' })),
      user(second).collection('addresses').doc('exclusive').set({ label: 'Khác', receiverName: 'Người nhận thử',
        phone: '0000000000', addressText: 'Địa chỉ riêng thử', location: null, locationSource: 'MANUAL' }),
      ...[driver, driver2].map(uid => shop.collection('drivers').doc(uid).set({ active: true, approved: uid === driver, approvedBy: admin })),
    ]);

    await t.test('quote reads real data, validates own address and rejects stale price without reserving', async () => {
      const fresh = await quote(first, { voucherCode: codeKey });
      assert.equal(fresh.discountVnd, 3500);
      assert.equal(fresh.grandTotalVnd, 31500);
      assert.equal((await post(first, '/quote', { ...base, addressId: 'exclusive' })).body.error.code, 'ADDRESS_INVALID');
      assert.equal((await post(first, '/quote', { ...base, items: [...base.items, ...base.items] })).status, 422);
      assert.equal((await post(first, '/quote', { ...base, voucherCode: 'UNKNOWN' })).body.error.code, 'VOUCHER_NOT_ELIGIBLE');
      assert.equal((await post(first, '', { ...purchase(fresh), customerUid: second })).status, 422);
      await food.update({ priceVnd: 32000 });
      const response = await post(first, '', purchase(fresh, { voucherCode: codeKey }));
      assert.equal(response.body.error.code, 'PRICE_CHANGED');
      assert.equal(response.body.error.details.quote.grandTotalVnd, 33500);
      assert.deepEqual(await stock(), [10, 0, 0]);
      assert.deepEqual(await quota(voucher), [0, 0]);
      await food.update({ priceVnd: 30000 });
    });

    await t.test('retry and competing request keys consume one cart version and preserve item snapshot', async () => {
      const cart = user(first).collection('carts').doc('active');
      await cart.set({ shopId, items: base.items, version: 4 });
      const key = randomUUID();
      const input = purchase(await quote(first), { expectedCartVersion: 4 });
      const responses = await Promise.all([post(first, '', input, key), post(first, '', input, key)]);
      assert.deepEqual(responses.map(res => res.status).sort(), [200, 201]);
      const orderId = created(responses.find(res => res.status === 201));
      assert.equal(responses.find(res => res.status === 200).body.data.orderId, orderId);
      assert.equal(responses.find(res => res.status === 200).body.meta.idempotencyReplayed, true);
      assert.equal((await post(first, '', input)).body.error.code, 'CART_VERSION_CONFLICT');
      assert.equal((await post(first, '', { ...input, note: 'modified' }, key)).body.error.code, 'IDEMPOTENCY_KEY_REUSED');
      assert.deepEqual((await cart.get()).data().items, []);
      assert.equal((await cart.get()).data().version, 5);
      await food.update({ name: 'Tên món mới', priceVnd: 35500 });
      assert.equal((await order(orderId).get()).data().items[0].nameSnapshot, 'Cơm thử');
      assert.equal((await order(orderId).get()).data().grandTotalVnd, 35000);
      assert.equal((await command(second, orderId, 'cancel', { expectedStatusVersion: 1 })).status, 404);
      assert.equal((await command(first, orderId, 'cancel', { expectedStatusVersion: 1 })).status, 200);
      assert.deepEqual(await stock(), [10, 0, 0]);
      await food.update({ name: 'Cơm thử', priceVnd: 30000 });
    });

    await t.test('two customers race for the last portion without overselling', async () => {
      await food.update({ availablePortions: 1 });
      const input = purchase(await quote(first));
      const otherInput = purchase(await quote(second));
      const responses = await Promise.all([post(first, '', input), post(second, '', otherInput)]);
      assert.deepEqual(responses.map(res => res.status).sort(), [201, 409]);
      const successIndex = responses.findIndex(res => res.status === 201);
      const orderId = created(responses[successIndex]);
      assert.equal(responses[1 - successIndex].body.error.code, 'OUT_OF_STOCK');
      assert.deepEqual(await stock(), [0, 1, 0]);
      assert.equal(await activeCount(shop), 1);
      assert.equal((await command(merchant, orderId, 'reject', { expectedStatusVersion: 1, reasonCode: 'CAPACITY' })).status, 200);
      assert.deepEqual(await stock(), [1, 0, 0]);
      await food.update({ availablePortions: 10 });
    });

    await t.test('voucher quota contention and simultaneous cancel/reject release each reservation once', async () => {
      const extra = { voucherCode: codeKey };
      const [q1, q2] = await Promise.all([quote(first, extra), quote(second, extra)]);
      const responses = await Promise.all([post(first, '', purchase(q1, extra)), post(second, '', purchase(q2, extra))]);
      assert.deepEqual(responses.map(res => res.status).sort(), [201, 409]);
      const successIndex = responses.findIndex(res => res.status === 201);
      const owner = successIndex === 0 ? first : second;
      const orderId = created(responses[successIndex]);
      assert.equal(responses[1 - successIndex].body.error.code, 'VOUCHER_QUOTA_EXHAUSTED');
      assert.deepEqual(await quota(voucher), [1, 0]);
      assert.deepEqual(await quota(customerCounter(owner)), [1, 0]);
      assert.equal((await voucher.collection('redemptions').doc(orderId).get()).data().state, 'RESERVED');
      const cancelKey = randomUUID(), rejectKey = randomUUID();
      const attempts = await Promise.all([
        command(owner, orderId, 'cancel', { expectedStatusVersion: 1 }, cancelKey),
        command(merchant, orderId, 'reject', { expectedStatusVersion: 1, reasonCode: 'CAPACITY' }, rejectKey),
      ]);
      assert.deepEqual(attempts.map(res => res.status).sort(), [200, 409]);
      const cancelled = attempts[0].status === 200;
      const replay = cancelled ? await command(owner, orderId, 'cancel', { expectedStatusVersion: 1 }, cancelKey)
        : await command(merchant, orderId, 'reject', { expectedStatusVersion: 1, reasonCode: 'CAPACITY' }, rejectKey);
      assert.equal(replay.body.meta.idempotencyReplayed, true);
      assert.deepEqual(await stock(), [10, 0, 0]);
      assert.deepEqual(await quota(voucher), [0, 0]);
      assert.deepEqual(await quota(customerCounter(owner)), [0, 0]);
      assert.equal((await voucher.collection('redemptions').doc(orderId).get()).data().state, 'RELEASED');
      assert.equal((await order(orderId).collection('events').get()).size, 2);
      assert.equal((await db.collection('notificationOutbox').where('orderId', '==', orderId).get()).size, 2);
      assert.equal(await activeCount(shop), 0);
    });

    await t.test('ownership, assignment versions, exact COD and review enforced through a full lifecycle', async journey => {
      await voucher.update({ maxUses: 2 });
      const extra = { voucherCode: codeKey };
      const input = purchase(await quote(first, extra), extra);
      const orderId = created(await post(first, '', input));
      assert.equal((await post(first, '/quote', { ...base, ...extra })).body.error.code, 'VOUCHER_QUOTA_EXHAUSTED');
      const transition = (uid, targetStatus, expectedStatusVersion) =>
        command(uid, orderId, 'transitions', { targetStatus, expectedStatusVersion });
      assert.equal((await transition(merchant, 'PREPARING', 1)).body.error.code, 'INVALID_ORDER_TRANSITION');
      assert.equal((await transition(otherMerchant, 'ACCEPTED', 1)).status, 404);
      assert.equal((await transition(admin, 'ACCEPTED', 1)).status, 403);
      assert.equal((await transition(merchant, 'ACCEPTED', 1)).status, 200);
      const assign = (driverUid, expectedAssignmentVersion) =>
        command(merchant, orderId, 'assign-driver', { driverUid, expectedStatusVersion: 2, expectedAssignmentVersion });
      assert.equal((await assign(driver2, 0)).body.error.code, 'DRIVER_NOT_APPROVED');
      assert.equal((await assign(driver, 0)).status, 200);
      await shop.collection('drivers').doc(driver2).update({ approved: true });
      assert.equal((await assign(driver2, 1)).status, 200);
      assert.equal(await activeCount(user(driver)), 0);
      assert.equal(await activeCount(user(driver2)), 1);
      assert.equal((await command(driver, orderId, 'accept-assignment', { expectedAssignmentVersion: 2 })).status, 404);
      assert.equal((await command(driver2, orderId, 'accept-assignment', { expectedAssignmentVersion: 1 })).body.error.code, 'ASSIGNMENT_VERSION_CONFLICT');
      assert.equal((await command(driver2, orderId, 'accept-assignment', { expectedAssignmentVersion: 2 })).status, 200);
      assert.equal((await assign(driver, 3)).body.error.code, 'DRIVER_ASSIGNMENT_LOCKED');
      assert.equal((await command(driver2, orderId, 'pickup', { expectedStatusVersion: 2, expectedAssignmentVersion: 3 })).status, 409);
      assert.equal((await transition(merchant, 'PREPARING', 2)).status, 200);
      assert.equal((await transition(merchant, 'READY_FOR_PICKUP', 3)).status, 200);
      const location = (extra = {}) => ({
        latitude: 10.001, longitude: 106.001, accuracyMeters: 7, sequence: locationNow,
        recordedAt: new Date(locationNow).toISOString(), expectedAssignmentVersion: 3, ...extra,
      });
      const sendLocation = (uid, fix = location()) => command(uid, orderId, 'location', fix);
      assert.equal((await sendLocation(driver2)).body.error.code, 'INVALID_ORDER_TRANSITION');
      assert.equal((await command(driver, orderId, 'pickup', { expectedStatusVersion: 4, expectedAssignmentVersion: 3 })).status, 404);
      assert.equal((await command(driver2, orderId, 'pickup', { expectedStatusVersion: 4, expectedAssignmentVersion: 3 })).status, 200);
      assert.ok((await order(orderId).get()).get('pickedUpAt'));
      const tracking = order(orderId).collection('deliveryTracking').doc('current');
      await journey.test('foreground location validates driver, assignment, coordinates, clock, replay and movement', async () => {
        assert.equal((await sendLocation(driver)).status, 404);
        assert.equal((await sendLocation(first)).status, 403);
        assert.equal((await sendLocation(driver2, location({ latitude: 91 }))).status, 422);
        assert.equal((await sendLocation(driver2, location({ driverUid: driver }))).status, 422);
        assert.equal((await sendLocation(driver2, location({ expectedAssignmentVersion: 2 }))).body.error.code, 'ASSIGNMENT_VERSION_CONFLICT');
        await shop.collection('drivers').doc(driver2).update({ approved: false });
        assert.equal((await sendLocation(driver2)).body.error.code, 'DRIVER_NOT_APPROVED');
        await shop.collection('drivers').doc(driver2).update({ approved: true });
        const stale = location({ recordedAt: new Date(locationNow - 61_000).toISOString() });
        assert.equal((await sendLocation(driver2, stale)).body.error.code, 'LOCATION_TIME_INVALID');
        const future = location({ recordedAt: new Date(locationNow + 11_000).toISOString() });
        assert.equal((await sendLocation(driver2, future)).body.error.code, 'LOCATION_TIME_INVALID');
        const initial = location();
        const firstFix = await sendLocation(driver2, initial);
        assert.equal(firstFix.status, 200);
        assert.equal((await sendLocation(driver2, initial)).body.data.receivedAt, firstFix.body.data.receivedAt);
        assert.equal((await sendLocation(driver2, { ...initial, latitude: 10.01 })).body.error.code, 'LOCATION_OUT_OF_ORDER');
        locationNow += 1000;
        assert.equal((await sendLocation(driver2, location({ latitude: 10.01 }))).body.error.code, 'LOCATION_RATE_LIMITED');
        locationNow += 10_000;
        assert.equal((await sendLocation(driver2)).body.error.code, 'LOCATION_UNCHANGED');
        assert.equal((await sendLocation(driver2, location({ latitude: 10.01 }))).status, 200);
        locationNow += 30_000;
        assert.equal((await sendLocation(driver2, location({ latitude: 10.01 }))).status, 200);
        const recorded = (await tracking.get()).data();
        assert.equal(recorded.sequence, locationNow);
        assert.equal(recorded.driverUid, driver2);
        assert.equal(recorded.receivedAt.toMillis(), locationNow);
        assert.equal((await tracking.parent.get()).size, 1);
      });
      const cod = { expectedStatusVersion: 5, expectedAssignmentVersion: 3, codCollectedVnd: input.expectedGrandTotalVnd };
      assert.equal((await command(driver2, orderId, 'complete', { ...cod, codCollectedVnd: 1 })).body.error.code, 'COD_AMOUNT_MISMATCH');
      assert.equal((await order(orderId).get()).data().paymentStatus, 'UNPAID');
      const key = randomUUID();
      assert.equal((await command(driver2, orderId, 'complete', cod, key)).status, 200);
      assert.equal((await command(driver2, orderId, 'complete', cod, key)).body.meta.idempotencyReplayed, true);
      assert.equal((await command(driver2, orderId, 'complete', cod)).body.error.code, 'INVALID_ORDER_TRANSITION');
      const stored = (await order(orderId).get()).data();
      assert.equal(stored.status, 'COMPLETED');
      assert.equal(stored.paymentStatus, 'COD_CONFIRMED');
      assert.equal(stored.codCollectedVnd, stored.amountDueVnd);
      assert.equal(stored.codConfirmedBy, driver2);
      assert.deepEqual(await stock(), [9, 0, 1]);
      assert.deepEqual(await quota(voucher), [0, 1]);
      assert.deepEqual(await quota(customerCounter(first)), [0, 1]);
      assert.equal((await voucher.collection('redemptions').doc(orderId).get()).data().state, 'REDEEMED');
      for (const ref of [shop, user(first), user(merchant), user(driver2)]) assert.equal(await activeCount(ref), 0);
      assert.equal((await tracking.get()).exists, false);
      assert.equal((await sendLocation(driver2)).body.error.code, 'INVALID_ORDER_TRANSITION');
      assert.equal((await order(orderId).collection('events').get()).size, 9);
      const review = { rating: 5, text: 'Món hợp khẩu vị.' };
      assert.equal((await command(second, orderId, 'review', review)).status, 404);
      const responses = await Promise.all([command(first, orderId, 'review', review), command(first, orderId, 'review', review)]);
      assert.deepEqual(responses.map(res => res.status).sort(), [201, 409]);
      const reviewId = responses.find(res => res.status === 201).body.data.reviewId;
      const published = (await db.doc('reviews/' + reviewId).get()).data();
      assert.equal(published.verifiedCompletedOrder, true);
      for (const field of ['customerUid', 'phone', 'orderId', 'addressSnapshot']) assert.equal(published[field], undefined);
      assert.equal((await shop.get()).data().ratingCount, 1);
      assert.equal((await shop.get()).data().ratingAverage, 5);
    });
  } finally {
    const orders = await db.collection('orders').where('shopId', '==', shopId).get();
    for (const doc of orders.docs) {
      orderIds.add(doc.id);
      if (doc.data().reviewId) await db.doc('reviews/' + doc.data().reviewId).delete();
      await db.recursiveDelete(doc.ref);
    }
    const batch = db.batch();
    for (const uid of uids) {
      const ops = await db.collection('operations').where('uid', '==', uid).get();
      ops.docs.forEach(doc => batch.delete(doc.ref));
    }
    for (const orderId of orderIds) {
      const outbox = await db.collection('notificationOutbox').where('orderId', '==', orderId).get();
      outbox.docs.forEach(doc => batch.delete(doc.ref));
    }
    batch.delete(food).delete(registry);
    await batch.commit();
    for (const ref of [...uids.map(user), shop, voucher]) await db.recursiveDelete(ref);
    await close();
  }
});
