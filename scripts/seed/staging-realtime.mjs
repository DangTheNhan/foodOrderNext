import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import * as sdk from 'firebase/firestore';
import { inboxFeed, messageFeed, orderFeed } from '../../apps/mobile/src/services/realtimeQueries.js';
import { has, observer } from '../../tests/helpers/firestore-observer.mjs';

export async function runStagingRealtime({ apps, users, call, shopId, foodId, admin, parent, report }) {
  sdk.setLogLevel('silent');
  const roles = Object.keys(users);
  const dbs = Object.fromEntries(roles.map(role => [role, sdk.getFirestore(apps[role])]));
  const subscriptions = [];
  const listen = query => {
    const subscription = observer(query, () => performance.now());
    subscriptions.push(subscription);
    return subscription;
  };
  const server = snapshot => !snapshot.metadata.fromCache;
  const measurements = {};
  report.realtime = { roles, environment: 'Three authenticated Firebase JS clients on the same Windows host',
    timing: 'Milliseconds from API response parsed to server-backed snapshot, measured on the same host. A negative delta means the listener arrived first.',
    measurements };
  let check = 'roleFeedsReady';
  const done = () => { report.checks[check] = 'PASS'; };

  async function measure(label, observations, responseAt) {
    const matches = await Promise.all(Object.entries(observations).map(async ([role, value]) => [role, await value]));
    measurements[label] = Object.fromEntries(matches.map(([role, hit]) => [role, Math.round(hit.receivedAt - responseAt)]));
  }

  try {
    const customer = listen(orderFeed(sdk, dbs.customer, { role: 'customer', uid: users.customer.uid }, 20));
    const pending = listen(orderFeed(sdk, dbs.merchant, { role: 'merchant', shopId, status: 'PENDING' }, 20));
    const trips = listen(orderFeed(sdk, dbs.driver, { role: 'driver', uid: users.driver.uid }, 20));
    const history = listen(orderFeed(sdk, dbs.driver, { role: 'driver', uid: users.driver.uid, finished: true }, 20));
    const inbox = listen(inboxFeed(sdk, dbs.merchant, users.merchant.uid, 20));
    await Promise.all([customer, pending, trips, history, inbox].map(watch => watch.until(server)));
    done();

    check = 'newOrderAppearsForCustomerAndMerchant';
    const input = { shopId, addressId: 'campus', items: [{ foodId, quantity: 1, optionIds: [] }] };
    const quote = (await call('customer', '/orders/quote', 200, input)).data;
    assert.equal(quote.grandTotalVnd, 35_000);
    const { data: { orderId } } = await call('customer', '/orders', 201, { ...input, paymentMethod: 'COD',
      expectedGrandTotalVnd: quote.grandTotalVnd, expectedQuoteKey: quote.quoteKey });
    const createdAt = performance.now();
    report.orderId = orderId;
    const orderPath = 'orders/' + orderId;
    const command = (role, action, body, status = 200, key) => call(role, '/' + orderPath + '/' + action, status, body, key);
    const transition = (version, targetStatus) => command('merchant', 'transitions', { expectedStatusVersion: version, targetStatus });
    await measure('createOrder', { customer: customer.until(has(orderId)), merchant: pending.until(has(orderId)) }, createdAt);
    assert(!(await trips.until(server)).value.docs.some(doc => doc.id === orderId));
    await assert.rejects(sdk.getDocFromServer(sdk.doc(dbs.driver, orderPath)), { code: 'permission-denied' });
    done();

    check = 'assignmentUpdatesRoleFeedsAndGatesChat';
    const acceptStartedAt = performance.now();
    await transition(1, 'ACCEPTED');
    const acceptedAt = performance.now();
    await Promise.all([
      customer.until(has(orderId, order => order.status === 'ACCEPTED')),
      pending.until(snapshot => server(snapshot) && !snapshot.docs.some(doc => doc.id === orderId), acceptStartedAt),
    ]);
    await command('merchant', 'assign-driver', { driverUid: users.driver.uid, expectedStatusVersion: 2, expectedAssignmentVersion: 0 });
    const assignedAt = performance.now();
    await measure('assignDriver', { driver: trips.until(has(orderId, order => order.assignmentStatus === 'ASSIGNED'), acceptedAt) },
      assignedAt);
    await assert.rejects(sdk.getDocsFromServer(messageFeed(sdk, dbs.driver, orderId, 20)), { code: 'permission-denied' });
    await command('driver', 'messages', { clientMessageId: randomUUID(), text: 'Kiểm tra trước khi nhận chuyến.' }, 403);
    await command('driver', 'accept-assignment', { expectedAssignmentVersion: 1 });
    await trips.until(has(orderId, order => order.assignmentStatus === 'ACCEPTED'));
    done();

    check = 'threeRoleChatAndRetry';
    const chat = Object.fromEntries(roles.map(role => [role, listen(messageFeed(sdk, dbs[role], orderId, 20))]));
    await Promise.all(Object.values(chat).map(watch => watch.until(snapshot => server(snapshot) && snapshot.empty)));
    const message = { clientMessageId: randomUUID(), text: 'Khách gửi tin thử trên staging.' };
    const key = randomUUID();
    const { data: first } = await command('customer', 'messages', message, 201, key);
    const firstAt = performance.now();
    await measure('customerMessage', Object.fromEntries(roles.map(role => [role, chat[role].until(has(first.messageId))])),
      firstAt);
    for (const retryKey of [key, randomUUID()]) {
      const replay = await command('customer', 'messages', message, 200, retryKey);
      assert(replay.data.messageId === first.messageId && replay.meta.idempotencyReplayed === true);
    }
    const eventId = 'message-' + first.messageId;
    const mailbox = (await inbox.until(has(eventId))).value.docs.find(doc => doc.id === eventId).data();
    assert.equal(mailbox.orderId, orderId);
    assert(!Object.values(mailbox).includes(message.text));
    await assert.rejects(sdk.getDocFromServer(sdk.doc(dbs.customer, 'users', users.merchant.uid, 'notifications', eventId)),
      { code: 'permission-denied' });
    await command('merchant', 'messages', { clientMessageId: randomUUID(), text: 'Quán đã nhận đơn thử.' }, 201);
    await Promise.all(roles.map(role => chat[role].until(snapshot => server(snapshot) && snapshot.size === 2)));
    done();

    check = 'merchantReconnectReceivesMissedDriverMessage';
    const disconnectedAt = performance.now();
    await sdk.disableNetwork(dbs.merchant);
    await chat.merchant.until(snapshot => snapshot.metadata.fromCache && snapshot.size === 2, disconnectedAt);
    const { data: third } = await command('driver', 'messages', { clientMessageId: randomUUID(), text: 'Tài xế đang tới quán thử.' }, 201);
    await Promise.all(['customer', 'driver'].map(role => chat[role].until(has(third.messageId)).then(hit => assert.equal(hit.value.size, 3))));
    const reconnectAt = performance.now();
    await sdk.enableNetwork(dbs.merchant);
    const recovered = await chat.merchant.until(has(third.messageId), reconnectAt);
    assert.equal(recovered.value.size, 3);
    measurements.merchantReconnectMs = Math.round(recovered.receivedAt - reconnectAt);
    const outbox = await admin.post('/v1/' + parent + ':runQuery', { structuredQuery: {
      from: [{ collectionId: 'notificationOutbox' }],
      where: { fieldFilter: { field: { fieldPath: 'orderId' }, op: 'EQUAL', value: { stringValue: orderId } } },
    } });
    const jobs = outbox.body.filter(row => row.document?.fields.type.stringValue === 'ORDER_MESSAGE');
    assert.equal(jobs.length, 3);
    assert.deepEqual(jobs.find(row => row.document.name.endsWith('/' + eventId)).document.fields.recipientUids.arrayValue.values
      .map(value => value.stringValue).sort(), [users.merchant.uid, users.driver.uid].sort());
    report.realtime.chatMessages = recovered.value.size;
    report.realtime.chatOutboxJobs = jobs.length;
    done();

    check = 'deliveryAndCodReachAllThreeRoles';
    await transition(2, 'PREPARING');
    await transition(3, 'READY_FOR_PICKUP');
    await command('driver', 'pickup', { expectedStatusVersion: 4, expectedAssignmentVersion: 2 });
    const merchantOrder = listen(sdk.doc(dbs.merchant, orderPath));
    await merchantOrder.until(snapshot => server(snapshot) && snapshot.data()?.status === 'DELIVERING');
    await trips.until(has(orderId, order => order.status === 'DELIVERING'));
    const completeStartedAt = performance.now();
    await command('driver', 'complete', { expectedStatusVersion: 5, expectedAssignmentVersion: 2, codCollectedVnd: quote.grandTotalVnd });
    const completedAt = performance.now();
    const paid = order => order?.status === 'COMPLETED' && order.paymentStatus === 'COD_CONFIRMED' && order.codCollectedVnd === 35_000;
    await measure('completeCod', { customer: customer.until(has(orderId, paid)),
      merchant: merchantOrder.until(snapshot => server(snapshot) && paid(snapshot.data())), driver: history.until(has(orderId, paid)) },
      completedAt);
    await trips.until(snapshot => server(snapshot) && !snapshot.docs.some(doc => doc.id === orderId), completeStartedAt);
    done();
  } catch (error) {
    report.realtime.failedCheck = check;
    throw error;
  } finally {
    for (const subscription of subscriptions) subscription.unsubscribe();
    await Promise.all(Object.values(dbs).map(sdk.terminate));
  }
}
