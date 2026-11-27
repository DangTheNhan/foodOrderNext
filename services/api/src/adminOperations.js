import { AggregateField } from 'firebase-admin/firestore';
import { natural, dataConflict } from './orderPricing.js';
import { ApiError } from './errors.js';
import { activeOrderConflict, audit, dayWindow, mutation, notFound, queryPage, scopedShop, userRef } from './operationsSupport.js';
import { ownedShops } from './catalogOperations.js';

function userDto(id, data) {
  return { id, displayName: data.displayName, email: data.emailDisplay ?? null, role: data.role,
    active: data.active === true, activeOrderCount: data.activeOrderCount ?? 0 };
}

export class AdminOperations {
  constructor(db) { this.db = db; }

  users({ role, active, q, cursor }) {
    let query = this.db.collection('users');
    if (role) query = query.where('role', '==', role);
    if (active !== undefined) query = query.where('active', '==', active);
    if (q) query = query.where('displayName', '>=', q).where('displayName', '<=', q + '\uf8ff');
    return queryPage(query, { field: 'displayName', cursor,
      scope: JSON.stringify(['users', role, active, q]), map: doc => userDto(doc.id, doc.data()) });
  }

  async user(uid) {
    const snapshot = await userRef(this.db, uid).get();
    if (!snapshot.exists) throw notFound();
    return { ...userDto(uid, snapshot.data()), shops: await ownedShops(this.db, uid) };
  }

  patchUser(uid, targetUid, key, input) {
    return mutation(this.db, uid, 'admin:user-patch', key, { targetUid, input }, ['admin'], async (tx, actor, now, auditId) => {
      const ref = userRef(this.db, targetUid);
      const target = (await tx.get(ref)).data();
      if (!target) throw notFound();
      const before = { role: target.role, active: target.active };
      if (before.role !== input.expectedRole || before.active !== input.expectedActive) {
        throw new ApiError(409, 'USER_VERSION_CONFLICT', 'Tài khoản vừa thay đổi. Hãy tải lại.');
      }
      const after = { role: input.role ?? before.role, active: input.active ?? before.active };
      if (before.role === after.role && before.active === after.active) return { id: targetUid, ...after };
      if (natural(target.activeOrderCount ?? 0) !== 0) throw activeOrderConflict();
      const shops = before.role === 'merchant' ? await tx.get(this.db.collection('shops').where('ownerUid', '==', targetUid).limit(21)) : null;
      if (shops?.size && after.role !== 'merchant') throw new ApiError(409, 'SHOP_OWNER_CONFLICT', 'Cần chuyển quyền sở hữu quán trước khi đổi vai trò chủ quán.');
      if (shops?.size > 20) throw dataConflict();
      let registry;
      const wasAdmin = before.role === 'admin' && before.active;
      const isAdmin = after.role === 'admin' && after.active;
      if (wasAdmin !== isAdmin) {
        const registryRef = this.db.doc('system/adminRegistry');
        const stored = (await tx.get(registryRef)).data();
        if (!Array.isArray(stored?.activeAdminUids) || stored.activeAdminUids.length !== stored.activeAdminCount
          || new Set(stored.activeAdminUids).size !== stored.activeAdminCount || !stored.activeAdminUids.includes(uid)
          || stored.activeAdminUids.includes(targetUid) !== wasAdmin) throw dataConflict();
        const members = isAdmin ? [...stored.activeAdminUids, targetUid] : stored.activeAdminUids.filter(id => id !== targetUid);
        if (!members.length) throw new ApiError(409, 'LAST_ADMIN', 'Cần giữ ít nhất một admin đang hoạt động.');
        registry = { ref: registryRef, activeAdminUids: members, activeAdminCount: members.length };
      }
      const authorityChanged = before.role === 'driver' || after.role === 'driver';
      tx.update(ref, { ...after, ...(authorityChanged ? { driverAuthorityVersion: natural(natural(target.driverAuthorityVersion ?? 0) + 1) } : {}), updatedAt: now });
      if (registry) tx.update(registry.ref, { activeAdminUids: registry.activeAdminUids, activeAdminCount: registry.activeAdminCount, updatedAt: now });
      if (!after.active) for (const shop of shops?.docs ?? []) tx.update(shop.ref, { acceptingOrders: false, updatedAt: now });
      audit(this.db, tx, auditId, actor, 'USER_AUTHORITY_UPDATED', { targetUid, before, after }, now);
      return { id: targetUid, ...after };
    });
  }

  daily(actor, shopId, day, cursor, includeTotals = true) {
    const { start, end } = dayWindow(day);
    return this.db.runTransaction(async tx => {
      await scopedShop(this.db, tx, actor, shopId);
      const base = this.db.collection('orders').where('shopId', '==', shopId);
      const created = base.where('createdAt', '>=', start).where('createdAt', '<', end);
      const page = queryPage(created, { field: 'createdAt', direction: 'desc', timestamp: true, cursor, scope: 'daily:' + shopId + ':' + day, tx,
        map: doc => ({ id: doc.id, status: doc.get('status'), createdAt: doc.get('createdAt').toDate().toISOString(),
          grandTotalVnd: doc.get('grandTotalVnd'), paymentStatus: doc.get('paymentStatus') }) });
      const metadata = { day, timezone: 'Asia/Ho_Chi_Minh' };
      if (!includeTotals) return { ...metadata, ...await page };
      const settled = base.where('status', '==', 'COMPLETED').where('paymentStatus', '==', 'COD_CONFIRMED')
        .where('completedAt', '>=', start).where('completedAt', '<', end);
      const [count, completed, rows] = await Promise.all([
        tx.get(created.count()),
        tx.get(settled.aggregate({ completedCount: AggregateField.count(), codVnd: AggregateField.sum('codCollectedVnd') })),
        page,
      ]);
      return { ...metadata, createdCount: count.data().count,
        completedCount: completed.data().completedCount, codVnd: natural(completed.data().codVnd ?? 0), ...rows };
    }, { readOnly: true });
  }
}
