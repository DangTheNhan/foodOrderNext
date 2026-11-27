import { Timestamp } from 'firebase-admin/firestore';
import { coordinatesSchema, orderDocumentSchema, uidSchema } from '@foodordernext/contracts';
import { ApiError, requireValidProfile } from './errors.js';
import { writeNotification } from './notificationEvents.js';
import { evaluateLocation } from './locationTracking.js';
import { dataConflict, digest, natural, normalizeLines, orderQuote, readHeldVoucher,
  reserveVoucher, settleVoucher, stockQuantities, updateStock } from './orderPricing.js';

const terminal = new Set(['CANCELLED', 'REJECTED', 'COMPLETED']);
const kitchenNext = { PENDING: 'ACCEPTED', ACCEPTED: 'PREPARING', PREPARING: 'READY_FOR_PICKUP' };
const canAssign = new Set(['ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP']);
const role = (profile, roles) => {
  if (!roles.includes(profile.role)) throw new ApiError(403, 'FORBIDDEN', 'Vai trò không có quyền thực hiện.');
};
const hidden = () => new ApiError(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng.');
const invalidTransition = () => new ApiError(409, 'INVALID_ORDER_TRANSITION', 'Đơn không thể chuyển trạng thái này.');
const userRef = (db, uid) => db.collection('users').doc(uid);

function summary(id, order) {
  return {
    orderId: id, status: order.status, statusVersion: order.statusVersion, assignmentStatus: order.assignmentStatus,
    assignmentVersion: order.assignmentVersion, updatedAt: order.updatedAt.toDate().toISOString(),
    grandTotalVnd: order.grandTotalVnd, amountDueVnd: order.amountDueVnd, currency: order.currency,
  };
}

function changeCounter(tx, snapshot, delta, now) {
  if (!snapshot.exists) throw dataConflict();
  const current = natural(snapshot.data().activeOrderCount ?? 0);
  tx.update(snapshot.ref, { activeOrderCount: natural(current + delta), updatedAt: now });
}

function writeEvent(db, tx, ref, previous, next, actor, type, now, reasonCode) {
  const eventId = `${ref.id}-s${next.statusVersion}-a${next.assignmentVersion}`;
  tx.create(ref.collection('events').doc(eventId), {
    type, fromStatus: previous?.status ?? null, toStatus: next.status,
    statusVersion: next.statusVersion, assignmentVersion: next.assignmentVersion,
    actorUid: actor.uid, actorRole: actor.role, reasonCode: reasonCode ?? null, createdAt: now,
  });
  const participants = terminal.has(next.status) ? (previous?.activeParticipantUids ?? []) : next.activeParticipantUids;
  writeNotification(db, tx, { eventId, orderId: ref.id, type, actorUid: actor.uid, status: next.status,
    recipients: [next.customerUid, ...participants], now });
}

function checkVersions(order, input) {
  if (input.expectedStatusVersion !== undefined && input.expectedStatusVersion !== order.statusVersion) {
    throw new ApiError(409, 'STATUS_VERSION_CONFLICT', 'Trạng thái đơn vừa đổi. Hãy tải lại.', {
      currentStatus: order.status, currentStatusVersion: order.statusVersion,
    });
  }
  if (input.expectedAssignmentVersion !== undefined && input.expectedAssignmentVersion !== order.assignmentVersion) {
    throw new ApiError(409, 'ASSIGNMENT_VERSION_CONFLICT', 'Phân công vừa đổi. Hãy tải lại.', {
      currentAssignmentVersion: order.assignmentVersion,
    });
  }
}

async function verifyDriver(tx, shopRef, profileSnapshot, uid) {
  const profile = profileSnapshot.data();
  const approval = (await tx.get(shopRef.collection('drivers').doc(uid))).data();
  if (profile?.active !== true || profile.role !== 'driver' || approval?.approved !== true || approval.active !== true
    || (profile.driverAuthorityVersion ?? 0) !== (approval.authorityVersion ?? 0)) {
    throw new ApiError(403, 'DRIVER_NOT_APPROVED', 'Tài xế không có quyền nhận chuyến tại quán này.');
  }
}

export class FirestoreOrderRepository {
  constructor(db, clock = Date.now) { this.db = db; this.clock = clock; }

  async run(uid, action, orderId, key, input, roles, execute) {
    const user = userRef(this.db, uid);
    const operation = this.db.collection('operations').doc(digest([uid, action, key]));
    const fingerprint = digest({ orderId, input });
    return this.db.runTransaction(async tx => {
      const [userSnapshot, saved] = await tx.getAll(user, operation);
      const profile = requireValidProfile(userSnapshot.data());
      role(profile, roles);
      if (saved.exists) {
        if (saved.data().requestFingerprint !== fingerprint) {
          throw new ApiError(409, 'IDEMPOTENCY_KEY_REUSED', 'Key đã được dùng cho nội dung khác.');
        }
        if (saved.data().role !== profile.role) throw hidden();
        return { data: saved.data().resultSummary, replayed: true };
      }
      const now = Timestamp.now();
      const result = await execute({ tx, user, userSnapshot, actor: { uid, role: profile.role }, now });
      tx.create(operation, { uid, role: profile.role, routeKey: action, requestFingerprint: fingerprint,
        resourceId: result.orderId, resultSummary: result, createdAt: now });
      return { data: result, replayed: false };
    });
  }

  quote(uid, input) {
    return this.db.runTransaction(async tx => {
      const user = userRef(this.db, uid);
      const profile = requireValidProfile((await tx.get(user)).data());
      role(profile, ['customer']);
      return (await orderQuote(this.db, tx, user, input, Timestamp.now())).dto;
    }, { readOnly: true });
  }

  create(uid, key, payload) {
    const input = { ...payload, items: normalizeLines(payload.items), voucherCode: payload.voucherCode?.toUpperCase() };
    const ref = this.db.collection('orders').doc();
    return this.run(uid, 'order:create', null, key, input, ['customer'], async ({ tx, user, userSnapshot, actor, now }) => {
      const quote = await orderQuote(this.db, tx, user, input, now);
      if (quote.dto.grandTotalVnd !== input.expectedGrandTotalVnd
        || (input.expectedQuoteKey && quote.dto.quoteKey !== input.expectedQuoteKey)) {
        throw new ApiError(409, 'PRICE_CHANGED', 'Thông tin đơn đã thay đổi. Hãy xác nhận lại.', { quote: quote.dto });
      }
      const owner = await tx.get(userRef(this.db, quote.shop.ownerUid));
      if (owner.data()?.active !== true || owner.data()?.role !== 'merchant') {
        throw new ApiError(409, 'ITEM_UNAVAILABLE', 'Quán hiện không nhận đơn.');
      }
      const cartRef = user.collection('carts').doc('active');
      if (input.expectedCartVersion !== undefined) {
        const cart = (await tx.get(cartRef)).data();
        if (!cart || cart.version !== input.expectedCartVersion || cart.shopId !== input.shopId
          || digest(normalizeLines(cart.items)) !== digest(input.items)) {
          throw new ApiError(409, 'CART_VERSION_CONFLICT', 'Giỏ đã thay đổi. Hãy tải lại trước khi đặt.');
        }
      }
      const { items, subtotalVnd, discountVnd, deliveryFeeVnd, grandTotalVnd, currency } = quote.dto;
      const point = quote.shop.location;
      const shopLocation = coordinatesSchema.safeParse({ latitude: point?.latitude, longitude: point?.longitude });
      const order = {
        customerUid: uid, shopId: input.shopId, shopNameSnapshot: quote.shop.name,
        shopLocationSnapshot: shopLocation.data ?? null,
        driverUid: null, activeParticipantUids: [uid, owner.id], status: 'PENDING', statusVersion: 1,
        assignmentStatus: 'UNASSIGNED', assignmentVersion: 0, assignedAt: null, acceptedAssignmentAt: null,
        items, subtotalVnd, discountVnd, deliveryFeeVnd, grandTotalVnd, amountDueVnd: grandTotalVnd, currency,
        stockReservation: 'RESERVED', voucherReservation: quote.voucher ? 'RESERVED' : 'NONE',
        voucherId: quote.voucher?.ref.id ?? null, reservationReleasedAt: null,
        addressSnapshot: quote.addressSnapshot, note: input.note, paymentMethod: 'COD', paymentStatus: 'UNPAID',
        codCollectedVnd: null, codConfirmedBy: null, codConfirmedAt: null, reviewId: null,
        createdAt: now, updatedAt: now, acceptedAt: null, pickedUpAt: null, completedAt: null, cancelledAt: null, rejectedAt: null,
      };
      updateStock(tx, quote.foods, quote.quantities, 'reserve', now);
      reserveVoucher(tx, quote.voucher, ref, uid, now);
      changeCounter(tx, userSnapshot, 1, now);
      changeCounter(tx, owner, 1, now);
      tx.update(quote.shopRef, { activeOrderCount: natural(quote.shop.activeOrderCount + 1), updatedAt: now });
      if (input.expectedCartVersion !== undefined) tx.set(cartRef, {
        shopId: null, items: [], version: natural(input.expectedCartVersion + 1), updatedAt: now,
      });
      tx.create(ref, order);
      writeEvent(this.db, tx, ref, null, order, actor, 'ORDER_CREATED', now);
      return summary(ref.id, order);
    });
  }

  command(uid, action, id, key, input, roles) {
    const ref = this.db.collection('orders').doc(id);
    return this.run(uid, 'order:' + action, id, key, input, roles, async ({ tx, userSnapshot, actor, now }) => {
      const order = await this.readOrder(tx, ref);
      const shopRef = this.db.collection('shops').doc(order.shopId);
      const shop = await tx.get(shopRef);
      if (actor.role === 'customer' && order.customerUid !== actor.uid) throw hidden();
      if (actor.role === 'merchant' && shop.data()?.ownerUid !== actor.uid) throw hidden();
      if (actor.role === 'driver' && order.driverUid !== actor.uid) throw hidden();
      if (terminal.has(order.status)) throw invalidTransition();
      checkVersions(order, input);
      let patch;
      if (action === 'assign-driver') {
        patch = await this.assign(tx, shopRef, order, input.driverUid, now);
      } else if (actor.role === 'driver') {
        await verifyDriver(tx, shopRef, userSnapshot, actor.uid);
        patch = await this.drive(tx, ref, shop, order, actor, action, input, now);
      } else if (action === 'cancel' || action === 'reject') {
        if (order.status !== 'PENDING') throw invalidTransition();
        patch = await this.settle(tx, ref, shop, order, action === 'cancel' ? 'CANCELLED' : 'REJECTED', now);
      } else {
        if (kitchenNext[order.status] !== input.targetStatus) throw invalidTransition();
        patch = { status: input.targetStatus, statusVersion: natural(order.statusVersion + 1),
          ...(input.targetStatus === 'ACCEPTED' ? { acceptedAt: now } : {}) };
      }
      const next = { ...order, ...patch, updatedAt: now };
      tx.update(ref, { ...patch, updatedAt: now });
      writeEvent(this.db, tx, ref, order, next, actor, 'ORDER_' + action.toUpperCase().replace(/-/g, '_'), now, input.reasonCode);
      return summary(id, next);
    });
  }

  updateLocation(uid, id, input) {
    const ref = this.db.collection('orders').doc(id);
    const tracking = ref.collection('deliveryTracking').doc('current');
    return this.db.runTransaction(async tx => {
      const user = await tx.get(userRef(this.db, uid));
      role(requireValidProfile(user.data()), ['driver']);
      const order = await this.readOrder(tx, ref);
      if (order.driverUid !== uid) throw hidden();
      checkVersions(order, input);
      if (order.status !== 'DELIVERING' || order.assignmentStatus !== 'ACCEPTED') throw invalidTransition();
      await verifyDriver(tx, this.db.collection('shops').doc(order.shopId), user, uid);
      const current = (await tx.get(tracking)).data();
      const result = evaluateLocation(input, current, uid, this.clock());
      if (!result.replayed) tx.set(tracking, result.position);
      return { orderId: id, accepted: true, receivedAt: result.position.receivedAt.toDate().toISOString() };
    });
  }

  async readOrder(tx, ref) {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) throw hidden();
    const result = orderDocumentSchema.safeParse(snapshot.data());
    if (!result.success) throw dataConflict();
    return result.data;
  }

  async assign(tx, shopRef, order, driverUid, now) {
    if (!canAssign.has(order.status)) throw invalidTransition();
    if (order.assignmentStatus === 'ACCEPTED') {
      throw new ApiError(409, 'DRIVER_ASSIGNMENT_LOCKED', 'Tài xế đã nhận chuyến.');
    }
    if (order.driverUid === driverUid) {
      throw new ApiError(409, 'DRIVER_ALREADY_ASSIGNED', 'Tài xế đã được phân công.');
    }
    const validated = uidSchema.safeParse(driverUid);
    if (!validated.success) throw dataConflict();
    const next = await tx.get(userRef(this.db, driverUid));
    const previous = order.driverUid ? await tx.get(userRef(this.db, order.driverUid)) : null;
    await verifyDriver(tx, shopRef, next, driverUid);
    if (!Array.isArray(order.activeParticipantUids) || order.activeParticipantUids.includes(driverUid)) throw dataConflict();
    const participants = order.activeParticipantUids.filter(uid => uid !== order.driverUid);
    if (previous) changeCounter(tx, previous, -1, now);
    changeCounter(tx, next, 1, now);
    return { driverUid, activeParticipantUids: [...participants, driverUid], assignmentStatus: 'ASSIGNED',
      assignmentVersion: natural(order.assignmentVersion + 1), assignedAt: now, acceptedAssignmentAt: null };
  }

  async drive(tx, ref, shop, order, actor, action, input, now) {
    if (action === 'accept-assignment') {
      if (!canAssign.has(order.status) || order.assignmentStatus !== 'ASSIGNED') throw invalidTransition();
      return { assignmentStatus: 'ACCEPTED', assignmentVersion: natural(order.assignmentVersion + 1), acceptedAssignmentAt: now };
    }
    if (order.assignmentStatus !== 'ACCEPTED') throw invalidTransition();
    if (action === 'pickup') {
      if (order.status !== 'READY_FOR_PICKUP') throw invalidTransition();
      return { status: 'DELIVERING', statusVersion: natural(order.statusVersion + 1), pickedUpAt: now };
    }
    if (order.status !== 'DELIVERING' || order.paymentStatus !== 'UNPAID') throw invalidTransition();
    if (input.codCollectedVnd !== order.amountDueVnd) {
      throw new ApiError(422, 'COD_AMOUNT_MISMATCH', 'Số tiền thu phải đúng số tiền COD của đơn.');
    }
    return { ...await this.settle(tx, ref, shop, order, 'COMPLETED', now),
      paymentStatus: 'COD_CONFIRMED', codCollectedVnd: input.codCollectedVnd, codConfirmedBy: actor.uid, codConfirmedAt: now };
  }

  async settle(tx, ref, shop, order, status, now) {
    if (order.stockReservation !== 'RESERVED' || !Array.isArray(order.activeParticipantUids)) throw dataConflict();
    const ids = [...new Set(order.activeParticipantUids)];
    if (!shop.exists || !ids.includes(order.customerUid) || !ids.includes(shop.data().ownerUid)
      || (order.driverUid && !ids.includes(order.driverUid))) throw dataConflict();
    const quantities = stockQuantities(order.items);
    const [foods, users, held] = await Promise.all([
      tx.getAll(...Array.from(quantities.keys(), id => this.db.collection('menuItems').doc(id))),
      tx.getAll(...ids.map(uid => userRef(this.db, uid))),
      readHeldVoucher(this.db, tx, ref.id, order),
    ]);
    const complete = status === 'COMPLETED';
    updateStock(tx, foods, quantities, complete ? 'consume' : 'release', now);
    settleVoucher(tx, held, complete, now);
    for (const user of users) changeCounter(tx, user, -1, now);
    changeCounter(tx, shop, -1, now);
    if (order.driverUid) tx.delete(ref.collection('deliveryTracking').doc('current'));
    return {
      status, statusVersion: natural(order.statusVersion + 1), activeParticipantUids: [],
      stockReservation: complete ? 'CONSUMED' : 'RELEASED',
      voucherReservation: held ? (complete ? 'REDEEMED' : 'RELEASED') : 'NONE',
      reservationReleasedAt: complete ? null : now,
      [{ COMPLETED: 'completedAt', CANCELLED: 'cancelledAt', REJECTED: 'rejectedAt' }[status]]: now,
    };
  }

  review(uid, id, key, input) {
    const ref = this.db.collection('orders').doc(id);
    const reviewRef = this.db.collection('reviews').doc();
    return this.run(uid, 'order:review', id, key, input, ['customer'], async ({ tx, actor, now }) => {
      const order = await this.readOrder(tx, ref);
      if (order.customerUid !== uid) throw hidden();
      if (order.status !== 'COMPLETED' || order.paymentStatus !== 'COD_CONFIRMED') throw invalidTransition();
      if (order.reviewId) throw new ApiError(409, 'REVIEW_ALREADY_EXISTS', 'Đơn đã được đánh giá.');
      if (input.imagePaths.length) throw new ApiError(422, 'REVIEW_MEDIA_NOT_AVAILABLE', 'Hiện hỗ trợ đánh giá bằng văn bản.');
      const shop = await tx.get(this.db.collection('shops').doc(order.shopId));
      if (!shop.exists) throw dataConflict();
      const ratingSum = natural(natural(shop.data().ratingSum) + input.rating);
      const ratingCount = natural(natural(shop.data().ratingCount) + 1);
      tx.create(reviewRef, { shopId: order.shopId, authorAliasSnapshot: 'Khách hàng', rating: input.rating,
        text: input.text, imagePaths: [], verifiedCompletedOrder: true, createdAt: now });
      tx.update(ref, { reviewId: reviewRef.id });
      tx.update(shop.ref, { ratingSum, ratingCount, ratingAverage: ratingSum / ratingCount, updatedAt: now });
      return { orderId: id, reviewId: reviewRef.id };
    });
  }
}
