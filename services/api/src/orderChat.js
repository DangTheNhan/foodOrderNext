import { Timestamp } from 'firebase-admin/firestore';
import { ApiError, requireValidProfile } from './errors.js';
import { digest } from './orderPricing.js';
import { writeNotification } from './notificationEvents.js';

const terminal = new Set(['CANCELLED', 'REJECTED', 'COMPLETED']);
const missing = () => new ApiError(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng.');
const notAllowed = () => new ApiError(403, 'CHAT_FORBIDDEN', 'Phiên này không có quyền trò chuyện về đơn.');
const messageDto = (messageId, data) => ({ messageId, clientMessageId: data.clientMessageId, sentAt: data.sentAt.toDate().toISOString() });
const userRef = (db, uid) => db.collection('users').doc(uid);

export function canViewOrder(uid, profile, order, shop) {
  if (!profile?.active || !order) return false;
  if (profile.role === 'customer') return order.customerUid === uid;
  if (profile.role === 'merchant') return shop?.ownerUid === uid;
  if (profile.role === 'driver') return order.driverUid === uid;
  return profile.role === 'admin';
}

async function chatScope(db, tx, orderId, uid, profile) {
  const ref = db.collection('orders').doc(orderId);
  const order = (await tx.get(ref)).data();
  if (!order) throw missing();
  const shopRef = db.collection('shops').doc(order.shopId);
  const shop = (await tx.get(shopRef)).data();
  if (!canViewOrder(uid, profile, order, shop)) throw missing();
  let driver = null;
  if (order.driverUid && order.assignmentStatus === 'ACCEPTED') {
    const [driverDoc, approvalDoc] = await tx.getAll(userRef(db, order.driverUid), shopRef.collection('drivers').doc(order.driverUid));
    const driverProfile = driverDoc.data();
    const approval = approvalDoc.data();
    if (driverProfile?.role === 'driver' && driverProfile.active === true && approval?.approved === true && approval.active === true
      && (driverProfile.driverAuthorityVersion ?? 0) === (approval.authorityVersion ?? 0)) driver = order.driverUid;
  }
  const canReadChat = profile.role !== 'driver' || driver === uid;
  return { ref, order, shop, driver, canReadChat, canSend: canReadChat && profile.role !== 'admin' && !terminal.has(order.status) };
}

export class OrderChat {
  constructor(db) { this.db = db; }

  access(uid, orderId) {
    return this.db.runTransaction(async tx => {
      const profile = requireValidProfile((await tx.get(userRef(this.db, uid))).data());
      const scope = await chatScope(this.db, tx, orderId, uid, profile);
      return { orderId, shopId: scope.order.shopId, role: profile.role, canReadChat: scope.canReadChat, canSend: scope.canSend };
    }, { readOnly: true });
  }

  send(uid, orderId, key, input) {
    const messageId = digest([orderId, uid, input.clientMessageId]);
    const operation = this.db.collection('operations').doc(digest([uid, 'order:message', key]));
    const fingerprint = digest({ orderId, ...input });
    return this.db.runTransaction(async tx => {
      const profile = requireValidProfile((await tx.get(userRef(this.db, uid))).data());
      const scope = await chatScope(this.db, tx, orderId, uid, profile);
      if (!scope.canReadChat || profile.role === 'admin') throw notAllowed();
      const ref = scope.ref.collection('messages').doc(messageId);
      const [previous, stored] = await tx.getAll(operation, ref);
      if (previous.exists) {
        if (previous.get('requestFingerprint') !== fingerprint) {
          throw new ApiError(409, 'IDEMPOTENCY_KEY_REUSED', 'Key đã được sử dụng với nội dung khác.');
        }
        return { data: previous.get('resultSummary'), replayed: true };
      }
      if (stored.exists && stored.get('text') !== input.text) {
        throw new ApiError(409, 'MESSAGE_ID_REUSED', 'Mã tin nhắn đã được dùng cho nội dung khác.');
      }
      if (!stored.exists && !scope.canSend) throw new ApiError(409, 'CHAT_CLOSED', 'Cuộc trò chuyện của đơn này đã đóng.');
      const now = Timestamp.now();
      const message = stored.exists ? stored.data() : {
        clientMessageId: input.clientMessageId, text: input.text, senderUid: uid, senderRole: profile.role,
        senderDisplayNameSnapshot: String(profile.displayName || 'Người dùng').slice(0, 100), sentAt: now,
      };
      const result = messageDto(messageId, message);
      if (!stored.exists) {
        tx.create(ref, message);
        writeNotification(this.db, tx, { eventId: 'message-' + messageId, orderId, type: 'ORDER_MESSAGE', actorUid: uid,
          recipients: [scope.order.customerUid, scope.shop?.ownerUid, scope.driver], messageId, now });
      }
      tx.create(operation, { uid, routeKey: 'order:message', requestFingerprint: fingerprint,
        resourceId: messageId, resultSummary: result, createdAt: now });
      return { data: result, replayed: stored.exists };
    });
  }
}
