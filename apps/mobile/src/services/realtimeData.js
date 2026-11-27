import * as sdk from '@react-native-firebase/firestore';
import { getApi } from '../api/axiosClient';
import { operatorRuntime } from './operationsData';
import { customerData } from './customerData';
import { inboxFeed, messageFeed, orderFeed } from './realtimeQueries';

const page = (snapshot, count) => ({
  rows: snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })),
  cursor: snapshot.docs.length === count ? snapshot.docs.at(-1) : null,
  stale: snapshot.metadata.fromCache,
});

function watch(query, count, next, error) {
  return sdk.onSnapshot(query, { includeMetadataChanges: true }, snapshot => next(page(snapshot, count)), error);
}

function read(query, count) { return sdk.getDocsFromServer(query).then(snapshot => page(snapshot, count)); }

function permittedLocally(order, scope) {
  if (scope.role === 'customer') return order?.customerUid === scope.uid;
  if (scope.role === 'driver') return order?.driverUid === scope.uid;
  return order?.shopId === scope.shopId;
}

export const realtimeData = {
  listenOrders(scope, count, next, error) {
    const { db } = operatorRuntime(scope.uid);
    return watch(orderFeed(sdk, db, scope, count), count, next, error);
  },
  olderOrders(scope, count, cursor) {
    const { db } = operatorRuntime(scope.uid);
    return read(orderFeed(sdk, db, scope, count, cursor), count);
  },
  order(scope, orderId, next, error) {
    const { db } = operatorRuntime(scope.uid);
    return sdk.onSnapshot(sdk.doc(db, 'orders', orderId), { includeMetadataChanges: true }, snapshot => {
      if (snapshot.metadata.fromCache) { next({ stale: true }); return; }
      const data = snapshot.exists() ? snapshot.data() : null;
      next(permittedLocally(data, scope) ? { order: { ...data, id: snapshot.id } } : { empty: true });
    }, error);
  },
  listenChat(uid, orderId, count, next, error) {
    const { db } = operatorRuntime(uid);
    return watch(messageFeed(sdk, db, orderId, count), count, next, error);
  },
  olderChat(uid, orderId, count, cursor) {
    const { db } = operatorRuntime(uid);
    return read(messageFeed(sdk, db, orderId, count, cursor), count);
  },
  listenInbox(uid, count, next, error) {
    const { db } = operatorRuntime(uid);
    return watch(inboxFeed(sdk, db, uid, count), count, next, error);
  },
  olderInbox(uid, count, cursor) {
    const { db } = operatorRuntime(uid);
    return read(inboxFeed(sdk, db, uid, count, cursor), count);
  },
  async inboxEntry(uid, eventId) {
    const { db } = operatorRuntime(uid);
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(eventId ?? '')) return null;
    const snap = await sdk.getDocFromServer(sdk.doc(db, 'users', uid, 'notifications', eventId));
    return snap.exists() ? { ...snap.data(), id: snap.id } : null;
  },
  async access(uid, orderId) {
    operatorRuntime(uid);
    return (await getApi().client.get(`/orders/${encodeURIComponent(orderId)}/access`)).data.data;
  },
  send: (uid, orderId, input, key) => customerData.mutate(uid, 'post', `/orders/${orderId}/messages`, input, key),
  markRead: (uid, eventId) => customerData.mutate(uid, 'post', `/me/notifications/${eventId}/read`, {}),
};

export async function openInboxEvent(uid, eventId, navigate, expectedOrderId) {
  const entry = await realtimeData.inboxEntry(uid, eventId);
  if (!entry || (expectedOrderId && entry.orderId !== expectedOrderId)) throw new Error('Thông báo không còn khả dụng.');
  const order = await realtimeData.access(uid, entry.orderId);
  await realtimeData.markRead(uid, entry.id).catch(() => {});
  operatorRuntime(uid);
  const { orderId, shopId } = order;
  if (entry.target === 'CHAT' && order.canReadChat) navigate('OrderChat', { orderId });
  else if (order.role === 'customer') navigate('CustomerOrderDetail', { orderId });
  else if (order.role === 'driver') navigate('DriverOrderDetail', { orderId });
  else navigate('MerchantOrderDetail', { orderId, shopId });
}
