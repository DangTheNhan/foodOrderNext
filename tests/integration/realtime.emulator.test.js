import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import test from 'node:test';
import request from 'supertest';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import * as sdk from 'firebase/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import { createApp } from '../../services/api/src/app.js';
import { readConfig } from '../../services/api/src/config.js';
import { createFirebaseServices } from '../../services/api/src/firebase.js';
import { FirestoreOrderRepository } from '../../services/api/src/orders.js';
import { FirestoreUserRepository } from '../../services/api/src/users.js';
import { OrderChat } from '../../services/api/src/orderChat.js';
import { NotificationDelivery } from '../../services/api/src/notificationDelivery.js';
import { OutboxWorker } from '../../services/api/src/outboxWorker.js';
import { inboxFeed, messageFeed, orderFeed } from '../../apps/mobile/src/services/realtimeQueries.js';
import { has, observer } from '../helpers/firestore-observer.mjs';

const enabled = process.env.RUN_EMULATOR_TESTS === '1';
const options = { skip: !enabled, timeout: 95000 };

function local() {
  const config = readConfig();
  assert.equal(config.mode, 'emulator');
  assert.equal(config.projectId, 'demo-foodordernext');
  return config;
}

test('P05 three signed-in clients observe scoped order and chat, including reconnect', options, async t => {
  const config = local();
  const firebase = createFirebaseServices(config);
  const db = firebase.firestore;
  const prefix = 'p05-' + randomUUID().slice(0, 12);
  const uid = name => prefix + '-' + name;
  const ids = { customer: uid('customer'), merchant: uid('merchant'), driver: uid('driver'), foreign: uid('foreign') };
  const shopId = uid('shop'), foodId = uid('food');
  const notifications = new NotificationDelivery(db);
  const app = createApp({ ...firebase, userRepository: new FirestoreUserRepository(db), orderRepository: new FirestoreOrderRepository(db),
    orderChat: new OrderChat(db), notificationDelivery: notifications, logger: { error() {} } });
  const clients = {};
  const apps = [];
  const subscriptions = [];
  const orders = [];
  const createdAuth = new Set();
  const measurements = {};
  const password = 'local synthetic P05 account';
  const call = (role, method, path, body, key = randomUUID()) => {
    const req = request(app)[method]('/api/v1' + path).set('Authorization', 'Bearer ' + clients[role].token).set('Idempotency-Key', key);
    return body ? req.send(body) : req;
  };
  const success = (res, status = 200) => {
    assert.equal(res.status, status, JSON.stringify(res.body));
    return res.body.data;
  };
  const command = (role, orderId, action, body, key) => call(role, 'post', `/orders/${orderId}/${action}`, body, key);
  const listen = query => { const sub = observer(query); subscriptions.push(sub); return sub; };
  const orderRef = id => db.doc('orders/' + id);
  let first;
  try {
    for (const [name, id] of Object.entries(ids)) {
      const email = id + '@example.invalid';
      await firebase.auth.createUser({ uid: id, email, password, emailVerified: true });
      createdAuth.add(id);
      const js = initializeApp({ projectId: config.projectId, apiKey: 'local-emulator-only',
        appId: '1:000000000000:web:123456abcdef' }, id);
      apps.push(js);
      const auth = getAuth(js);
      connectAuthEmulator(auth, 'http://' + config.authEmulatorHost, { disableWarnings: true });
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const firestore = sdk.getFirestore(js);
      const [host, port] = config.firestoreEmulatorHost.split(':');
      sdk.connectFirestoreEmulator(firestore, host, Number(port));
      clients[name] = { db: firestore, token: await credential.user.getIdToken() };
      await db.doc('users/' + id).set({ active: true, role: name === 'foreign' ? 'customer' : name,
        displayName: 'P05 test ' + name, activeOrderCount: 0, createdAt: new Date(), updatedAt: new Date() });
    }
    await Promise.all([
      db.doc('shops/' + shopId).set({ ownerUid: ids.merchant, name: 'Quán P05', active: true, acceptingOrders: true,
        activeOrderCount: 0, deliveryFeeVnd: 5000, ratingSum: 0, ratingCount: 0, ratingAverage: 0 }),
      db.doc('shops/' + shopId + '/drivers/' + ids.driver).set({ active: true, approved: true }),
      db.doc('menuItems/' + foodId).set({ shopId, categoryId: 'meals', name: 'Cơm P05', nameKey: 'com p05', priceVnd: 30000,
        currency: 'VND', active: true, availablePortions: 10, reservedPortions: 0, soldPortions: 0, revision: 1 }),
      db.doc('users/' + ids.customer + '/addresses/campus').set({ label: 'Campus', receiverName: 'Synthetic', phone: '0000000000',
        addressText: 'Địa chỉ thử P05', location: null, locationSource: 'MANUAL' }),
    ]);
    const orderBody = { shopId, addressId: 'campus', paymentMethod: 'COD', expectedGrandTotalVnd: 35000,
      items: [{ foodId, quantity: 1 }] };

    await t.test('customer and shop subscribe, assigned driver receives trip and pending cancellation leaves queue', async () => {
      const customer = listen(orderFeed(sdk, clients.customer.db, { role: 'customer', uid: ids.customer }, 20));
      const pending = listen(orderFeed(sdk, clients.merchant.db, { role: 'merchant', shopId, status: 'PENDING' }, 20));
      const trips = listen(orderFeed(sdk, clients.driver.db, { role: 'driver', uid: ids.driver }, 20));
      const created = success(await call('customer', 'post', '/orders', orderBody), 201);
      first = created.orderId;
      orders.push(first);
      const createdCommit = (await orderRef(first).get()).createTime.toMillis();
      const customerHit = await customer.until(has(first));
      const merchantHit = await pending.until(has(first));
      measurements.createdToCustomerMs = customerHit.receivedAt - createdCommit;
      measurements.createdToMerchantMs = merchantHit.receivedAt - createdCommit;
      success(await command('merchant', first, 'transitions', { expectedStatusVersion: 1, targetStatus: 'ACCEPTED' }));
      await customer.until(has(first, order => order.status === 'ACCEPTED'));
      success(await command('merchant', first, 'assign-driver',
        { expectedStatusVersion: 2, expectedAssignmentVersion: 0, driverUid: ids.driver }));
      const assigned = await trips.until(has(first, order => order.assignmentStatus === 'ASSIGNED'));
      measurements.assignmentToDriverMs = assigned.receivedAt - (await orderRef(first).get()).updateTime.toMillis();
      const access = success(await call('driver', 'get', '/orders/' + first + '/access'));
      assert.equal(access.canReadChat, false);
      assert.equal((await command('driver', first, 'messages', { text: 'Before accept', clientMessageId: 'early' })).status, 403);
      await assert.rejects(sdk.getDocsFromServer(messageFeed(sdk, clients.driver.db, first, 30)), { code: 'permission-denied' });
      success(await command('driver', first, 'accept-assignment', { expectedAssignmentVersion: 1 }));
      await trips.until(has(first, order => order.assignmentStatus === 'ACCEPTED'));
      const second = success(await call('customer', 'post', '/orders', orderBody), 201).orderId;
      orders.push(second);
      await pending.until(has(second));
      const at = Date.now();
      success(await command('customer', second, 'cancel', { expectedStatusVersion: 1 }));
      await pending.until(value => !value.metadata.fromCache && value.empty, at);
      const refused = await command('customer', second, 'messages', { text: 'After cancel', clientMessageId: 'closed' });
      assert.equal(refused.body.error.code, 'CHAT_CLOSED');
    });

    await t.test('three role listeners see chat, retry is unique, ownership and inbox are private', async () => {
      const watchers = Object.fromEntries(['customer', 'merchant', 'driver'].map(role =>
        [role, listen(messageFeed(sdk, clients[role].db, first, 30))]));
      const input = { text: 'Khách nhắn về đơn', clientMessageId: 'customer-1' };
      const key = randomUUID();
      const msg = success(await command('customer', first, 'messages', input, key), 201);
      const replyBody = { text: 'Quán trả lời', clientMessageId: 'merchant-1' };
      const reply = success(await command('merchant', first, 'messages', replyBody), 201);
      const hits = await Promise.all(Object.values(watchers).map(watch => watch.until(has(reply.messageId))));
      const commitMs = (await orderRef(first).collection('messages').doc(reply.messageId).get()).createTime.toMillis();
      measurements.merchantReplyToClientMs = hits.map(hit => hit.receivedAt - commitMs);
      const duplicate = await command('customer', first, 'messages', input);
      assert.equal(success(duplicate).messageId, msg.messageId);
      assert.equal(duplicate.body.meta.idempotencyReplayed, true);
      assert.equal((await command('customer', first, 'messages', { ...input, text: 'different' }, key)).body.error.code, 'IDEMPOTENCY_KEY_REUSED');
      assert.equal((await command('customer', first, 'messages', { ...input, text: 'different' })).body.error.code, 'MESSAGE_ID_REUSED');
      assert.equal((await command('foreign', first, 'messages', input)).status, 404);
      await assert.rejects(sdk.getDocsFromServer(messageFeed(sdk, clients.foreign.db, first, 30)), { code: 'permission-denied' });
      const eventId = 'message-' + msg.messageId;
      const merchantInbox = listen(inboxFeed(sdk, clients.merchant.db, ids.merchant, 20));
      const inbox = await merchantInbox.until(has(eventId));
      const entry = inbox.value.docs.find(doc => doc.id === eventId).data();
      assert.ok(!Object.values(entry).includes(input.text));
      await assert.rejects(sdk.getDocFromServer(sdk.doc(clients.foreign.db, 'users', ids.merchant, 'notifications', eventId)),
        { code: 'permission-denied' });
      const read = success(await call('merchant', 'post', `/me/notifications/${eventId}/read`, {}));
      assert.equal(success(await call('merchant', 'post', `/me/notifications/${eventId}/read`, {})).readAt, read.readAt);
      await merchantInbox.until(has(eventId, item => !!item.readAt));
      assert.equal((await call('foreign', 'post', `/me/notifications/${eventId}/read`, {})).status, 404);
      const outbox = db.doc('notificationOutbox/' + eventId);
      assert.deepEqual((await outbox.get()).get('recipientUids').sort(), [ids.driver, ids.merchant].sort());

      await sdk.disableNetwork(clients.merchant.db);
      await watchers.merchant.until(snapshot => snapshot.metadata.fromCache);
      const during = success(await command('customer', first, 'messages', { text: 'Sau khi mất mạng', clientMessageId: 'reconnect' }), 201);
      const startedReconnect = Date.now();
      await sdk.enableNetwork(clients.merchant.db);
      const caughtUp = await watchers.merchant.until(has(during.messageId), startedReconnect);
      measurements.merchantReconnectMs = caughtUp.receivedAt - startedReconnect;
      assert.equal(caughtUp.value.docs.length, 3);
      assert.equal((await orderRef(first).collection('messages').get()).size, 3);
      const chatOutbox = await db.collection('notificationOutbox').where('orderId', '==', first).where('type', '==', 'ORDER_MESSAGE').get();
      assert.equal(chatOutbox.size, 3);
    });

    await t.test('chat cursor preserves order at tied timestamps and driver approval is checked again', async () => {
      const batch = db.batch();
      for (let i = 0; i < 33; i++) batch.set(orderRef(first).collection('messages').doc('historic-' + i), {
        senderUid: ids.customer, senderRole: 'customer', text: 'Synthetic earlier message',
        sentAt: new Date('2026-01-01T00:00:00Z'), clientMessageId: 'history-' + i,
      });
      await batch.commit();
      const firstPage = await sdk.getDocsFromServer(messageFeed(sdk, clients.customer.db, first, 30));
      const lastPage = await sdk.getDocsFromServer(messageFeed(sdk, clients.customer.db, first, 30, firstPage.docs.at(-1)));
      assert.equal(firstPage.size, 30);
      assert.equal(lastPage.size, 6);
      assert.equal(new Set([...firstPage.docs, ...lastPage.docs].map(doc => doc.id)).size, 36);
      await db.doc('users/' + ids.driver).update({ driverAuthorityVersion: 1 });
      assert.equal(success(await call('driver', 'get', '/orders/' + first + '/access')).canReadChat, false);
      assert.equal((await command('driver', first, 'messages', { text: 'Stale', clientMessageId: 'stale' })).status, 403);
      // Use a new target. A same-query getDocsFromServer can share a listener
      // already active before the dependent approval document changes.
      await assert.rejects(sdk.getDocsFromServer(messageFeed(sdk, clients.driver.db, first, 29)), { code: 'permission-denied' });
      await assert.rejects(sdk.getDocFromServer(sdk.doc(clients.driver.db, 'orders', first, 'messages', 'historic-0')),
        { code: 'permission-denied' });
    });

    await writeFile('artifacts/evidence/P05/realtime-measurements.json', JSON.stringify({
      environment: '3 separate signed-in JS Firestore clients, same Windows host and Local Emulator Suite',
      measurements, note: 'Observed snapshot time minus Firestore document commit time. Single run, not a production latency estimate.',
    }, null, 2) + '\n');
  } finally {
    subscriptions.forEach(sub => sub.unsubscribe());
    await Promise.all(apps.map(js => deleteApp(js)));
    for (const orderId of orders) {
      const outbox = await db.collection('notificationOutbox').where('orderId', '==', orderId).get();
      await Promise.all(outbox.docs.map(job => job.ref.delete()));
      await db.recursiveDelete(orderRef(orderId));
    }
    for (const id of Object.values(ids)) {
      const operations = await db.collection('operations').where('uid', '==', id).get();
      await Promise.all(operations.docs.map(op => op.ref.delete()));
      await db.recursiveDelete(db.doc('users/' + id));
      if (createdAuth.has(id)) await firebase.auth.deleteUser(id);
    }
    await db.recursiveDelete(db.doc('shops/' + shopId));
    await db.doc('menuItems/' + foodId).delete();
    await firebase.close();
  }
});

test('P05 outbox lease, retry, token rotation and failures using injected transport', options, async t => {
  const firebase = createFirebaseServices(local());
  const db = firebase.firestore;
  const delivery = new NotificationDelivery(db);
  const prefix = 'p05worker-' + randomUUID();
  const customer = prefix + '-customer', merchant = prefix + '-merchant';
  const shopId = prefix + '-shop', orderId = prefix + '-order';
  const tokens = Object.fromEntries(['good', 'retry', 'invalid', 'new', 'move'].map(name => [name, 'synthetic-' + prefix + '-' + name]));
  const installs = ['good', 'retry', 'invalid', 'move', 'alt'].map(name => prefix + '-' + name);
  const paths = [];
  const jobs = [];
  let current = Date.now() + 1000;
  const clock = () => current;
  const sendTimes = new Map();
  const sentEvents = [];
  const failure = code => Object.assign(new Error('Injected provider failure'), { code });
  const create = async (name, extra = {}) => {
    const ref = db.doc('notificationOutbox/' + prefix + '-' + name);
    jobs.push(ref);
    await ref.set({ type: 'ORDER_MESSAGE', orderId, recipientUids: [customer, merchant], status: 'PENDING',
      attempts: 0, nextAttemptAt: Timestamp.fromMillis(current), createdAt: Timestamp.fromMillis(current), ...extra });
    return ref;
  };
  const bind = (uid, token, install) => delivery.bind(uid, install, { token, platform: 'android', notificationsEnabled: true });
  const app = createApp({ userRepository: new FirestoreUserRepository(db), notificationDelivery: delivery,
    verifyIdToken: async uid => ({ uid, email_verified: true }), logger: { error() {} } });
  const storedDevice = (uid, install) => db.doc(`users/${uid}/devices/${install}`).get();
  try {
    for (const [uid, role] of [[customer, 'customer'], [merchant, 'merchant']]) {
      const ref = db.doc('users/' + uid);
      paths.push(ref);
      await ref.set({ displayName: role, role, active: true, createdAt: new Date(), updatedAt: new Date(),
        settings: { notificationsEnabled: true } });
    }
    const shop = db.doc('shops/' + shopId), order = db.doc('orders/' + orderId);
    paths.push(shop, order);
    await shop.set({ ownerUid: merchant });
    await order.set({ shopId, customerUid: customer, driverUid: null });
    await t.test('device API moves binding on account switch and unlink only affects caller', async () => {
      const requestDevice = (who, method, id, body) => {
        const req = request(app)[method]('/api/v1/me/devices/' + id).set('Authorization', 'Bearer ' + who);
        return body ? req.send(body) : req;
      };
      const input = { token: tokens.move, notificationsEnabled: true, platform: 'android' };
      const first = await requestDevice(customer, 'put', installs[3], input);
      assert.equal(first.status, 200);
      assert.equal(first.body.data.token, undefined);
      assert.equal((await requestDevice(merchant, 'put', installs[3], input)).status, 200);
      assert.equal((await storedDevice(customer, installs[3])).exists, false);
      assert.equal((await requestDevice(customer, 'delete', installs[3])).status, 200);
      assert.equal((await storedDevice(merchant, installs[3])).exists, true);
      assert.equal((await requestDevice(merchant, 'put', installs[4], input)).status, 200);
      assert.equal((await storedDevice(merchant, installs[3])).exists, false);
      await requestDevice(merchant, 'delete', installs[4]);
    });

    await t.test('retries remember delivered tokens and invalid token cleanup preserves a newer binding', async () => {
      await bind(merchant, tokens.good, installs[0]);
      await bind(merchant, tokens.retry, installs[1]);
      await bind(customer, tokens.invalid, installs[2]);
      const send = async payload => {
        assert.deepEqual(Object.keys(payload.data).sort(), ['eventId', 'orderId']);
        assert.equal(payload.android.notification.tag, payload.data.eventId);
        assert.equal(payload.data.orderId, orderId);
        sentEvents.push(payload.data.eventId);
        const count = (sendTimes.get(payload.token) ?? 0) + 1;
        sendTimes.set(payload.token, count);
        if (payload.token === tokens.invalid) {
          await bind(customer, tokens.new, installs[2]);
          throw failure('messaging/registration-token-not-registered');
        }
        if (payload.token === tokens.retry && count === 1) throw failure('messaging/server-unavailable');
      };
      const job = await create('retry');
      await new OutboxWorker({ db, delivery, send, clock }).runOnce();
      assert.equal((await job.get()).get('status'), 'RETRY');
      assert.equal((await job.get()).get('deliveredTokenHashes').length, 1);
      assert.equal((await storedDevice(customer, installs[2])).get('token') === tokens.new, true);
      current += 16000;
      await new OutboxWorker({ db, delivery, send, clock }).runOnce();
      const result = (await job.get()).data();
      assert.equal(result.status, 'SENT');
      assert.equal(result.attempts, 2);
      assert.equal(sendTimes.get(tokens.good), 1);
      assert.equal(sendTimes.get(tokens.retry), 2);
      assert.equal(sendTimes.get(tokens.new), 1);
      assert.ok(sentEvents.every(event => event === job.id));
    });

    await t.test('expired lease is reclaimed, stale worker cannot finish, permanent and disabled paths are explicit', async () => {
      const job = await create('lease');
      const first = new OutboxWorker({ db, delivery, send: async () => {}, clock });
      const rebooted = new OutboxWorker({ db, delivery, send: async () => {}, clock });
      const claimed = await first.claim(job);
      assert.ok(claimed);
      assert.equal(await rebooted.claim(job), null);
      current += 61000;
      await rebooted.runOnce();
      assert.equal((await job.get()).get('status'), 'SENT');
      assert.equal(await first.finish(job, claimed, { status: 'FAILED' }), false);
      const bad = await create('permanent');
      await new OutboxWorker({ db, delivery, clock, send: async () => { throw failure('messaging/invalid-argument'); } }).runOnce();
      assert.equal((await bad.get()).get('status'), 'FAILED');
      assert.equal((await bad.get()).get('attempts'), 1);
      const exhausted = await create('exhausted', { attempts: 4 });
      await new OutboxWorker({ db, delivery, clock, send: async () => { throw failure('messaging/server-unavailable'); } }).runOnce();
      assert.equal((await exhausted.get()).get('status'), 'FAILED');
      assert.equal((await exhausted.get()).get('attempts'), 5);
      const localOnly = await create('local');
      await new OutboxWorker({ db, delivery, clock, send: null }).runOnce();
      assert.equal((await localOnly.get()).get('status'), 'SKIPPED');
      assert.equal((await localOnly.get()).get('lastErrorCode'), 'FCM_DISABLED');
    });
  } finally {
    for (const uid of [customer, merchant]) for (const install of installs) await delivery.unbind(uid, install);
    await Promise.all(jobs.map(job => job.delete()));
    for (const ref of paths) await db.recursiveDelete(ref);
    await firebase.close();
  }
});
