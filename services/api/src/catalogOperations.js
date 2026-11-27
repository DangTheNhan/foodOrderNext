import { natural } from './orderPricing.js';
import { normalizeNameKey } from '@foodordernext/contracts';
import { ApiError } from './errors.js';
import { audit, mutation, notFound, queryPage, scopedShop, userRef, activeOrderConflict } from './operationsSupport.js';

const operators = ['merchant', 'admin'];
const idOf = snapshot => ({ ...snapshot.data(), id: snapshot.id });

function checkRevision(food, expectedRevision) {
  if (food.revision !== expectedRevision) {
    throw new ApiError(409, 'MENU_REVISION_CONFLICT', 'Món vừa thay đổi. Hãy tải lại trước khi lưu.', { currentRevision: food.revision });
  }
}

async function category(db, tx, id, requireActive = true) {
  const meta = (await tx.get(db.collection('categories').doc(id))).data();
  if (!meta || (requireActive && meta.active !== true)) {
    throw new ApiError(422, 'CATEGORY_UNAVAILABLE', 'Chọn danh mục đang hoạt động.');
  }
}

function nameFields(name) {
  const nameKey = normalizeNameKey(name);
  if (!nameKey) throw new ApiError(422, 'NAME_INVALID', 'Tên món không hợp lệ.');
  return { name, nameKey };
}

export class CatalogOperations {
  constructor(db, publishMenuImage, readMenuImage) {
    this.db = db;
    this.publishMenuImage = publishMenuImage;
    this.readMenuImage = readMenuImage;
  }

  shops(actor, cursor) {
    const all = this.db.collection('shops');
    const scoped = actor.profile.role === 'admin' ? all : all.where('ownerUid', '==', actor.uid);
    return queryPage(scoped, { field: 'name', cursor, scope: 'shops:' + actor.uid + ':' + actor.profile.role, map: idOf });
  }

  async shop(actor, id) {
    const data = idOf(await scopedShop(this.db, null, actor, id));
    const point = data.location;
    return { ...data, location: point ? { latitude: point.latitude, longitude: point.longitude } : null };
  }

  patchShop(uid, id, key, input) {
    return mutation(this.db, uid, 'shop:patch', key, { id, input }, operators, async (tx, actor, now, auditId) => {
      const shop = await scopedShop(this.db, tx, actor, id);
      if (input.acceptingOrders === true) {
        const owner = (await tx.get(userRef(this.db, shop.get('ownerUid')))).data();
        if (owner?.active !== true || owner.role !== 'merchant' || shop.get('active') !== true) {
          throw new ApiError(409, 'SHOP_UNAVAILABLE', 'Quán hoặc tài khoản chủ quán chưa hoạt động.');
        }
      }
      tx.update(shop.ref, { ...input, updatedAt: now });
      audit(this.db, tx, auditId, actor, 'SHOP_UPDATED', { shopId: id, fields: Object.keys(input) }, now);
      return { shopId: id };
    });
  }

  async menu(actor, shopId, cursor) {
    await scopedShop(this.db, null, actor, shopId);
    return queryPage(this.db.collection('menuItems').where('shopId', '==', shopId), {
      field: 'nameKey', cursor, scope: 'menu:' + shopId, map: idOf,
    });
  }

  async item(actor, foodId) {
    const doc = await this.db.collection('menuItems').doc(foodId).get();
    if (!doc.exists) throw notFound();
    await scopedShop(this.db, null, actor, doc.get('shopId'));
    return idOf(doc);
  }

  async publicImage(foodId) {
    const food = (await this.db.collection('menuItems').doc(foodId).get()).data();
    if (food?.active !== true || !food.imagePath?.startsWith(`shops/${food.shopId}/menuPublished/${foodId}/`)) throw notFound();
    const shop = await this.db.collection('shops').doc(food.shopId).get();
    if (shop.get('active') !== true || !this.readMenuImage) throw notFound();
    const result = await this.readMenuImage(food.imagePath, foodId);
    if (!result) throw notFound();
    return result;
  }

  createMenu(uid, shopId, key, input) {
    const ref = this.db.collection('menuItems').doc();
    return mutation(this.db, uid, 'menu:create', key, { shopId, input }, operators, async (tx, actor, now, auditId) => {
      await scopedShop(this.db, tx, actor, shopId);
      await category(this.db, tx, input.categoryId);
      const { initialAvailablePortions, ...fields } = input;
      tx.create(ref, { ...fields, ...nameFields(input.name), shopId, imagePath: null, currency: 'VND', tags: [],
        availablePortions: initialAvailablePortions, reservedPortions: 0, soldPortions: 0, revision: 1,
        createdAt: now, updatedAt: now });
      audit(this.db, tx, auditId, actor, 'MENU_CREATED', { shopId, foodId: ref.id }, now);
      return { foodId: ref.id, revision: 1 };
    });
  }

  async patchMenu(actor, foodId, key, input) {
    // Cloud Storage metadata cannot share the Firestore transaction. Public get
    // still requires the exact live Firestore pointer, including on failures.
    let published = input.imagePath;
    if (input.imagePath) {
      const food = await this.item(actor, foodId);
      if (typeof this.publishMenuImage !== 'function') throw new ApiError(503, 'MEDIA_SERVICE_UNAVAILABLE', 'Chưa thể kiểm tra ảnh.');
      published = await this.publishMenuImage(actor.uid, food.shopId, foodId, input.imagePath);
    }
    return mutation(this.db, actor.uid, 'menu:patch', key, { foodId, input }, operators, async (tx, operator, now, auditId) => {
      const ref = this.db.collection('menuItems').doc(foodId);
      const food = (await tx.get(ref)).data();
      if (!food) throw notFound();
      await scopedShop(this.db, tx, operator, food.shopId);
      checkRevision(food, input.expectedRevision);
      if ((input.categoryId && input.categoryId !== food.categoryId) || (input.active === true && food.active === false)) {
        await category(this.db, tx, input.categoryId ?? food.categoryId);
      }
      const { expectedRevision, ...fields } = input;
      const revision = natural(expectedRevision + 1);
      const patch = { ...fields, ...(fields.name ? nameFields(fields.name) : {}),
        ...(published !== undefined ? { imagePath: published } : {}) };
      tx.update(ref, { ...patch, revision, updatedAt: now });
      audit(this.db, tx, auditId, operator, 'MENU_UPDATED', {
        shopId: food.shopId, foodId, revision, fields: Object.keys(fields),
        ...(fields.imagePath !== undefined ? { previousImagePath: food.imagePath ?? null } : {}),
      }, now);
      return { foodId, revision };
    });
  }

  stock(uid, foodId, key, input) {
    return mutation(this.db, uid, 'menu:stock', key, { foodId, input }, operators, async (tx, actor, now, auditId) => {
      const ref = this.db.collection('menuItems').doc(foodId);
      const food = (await tx.get(ref)).data();
      if (!food) throw notFound();
      await scopedShop(this.db, tx, actor, food.shopId);
      checkRevision(food, input.expectedRevision);
      const current = natural(food.availablePortions);
      const next = current + input.deltaAvailablePortions;
      if (next < 0 || !Number.isSafeInteger(next) || next > 1000000) {
        throw new ApiError(422, 'STOCK_OUT_OF_RANGE', 'Số suất có thể bán phải từ 0 đến 1.000.000.');
      }
      const revision = natural(food.revision + 1);
      tx.update(ref, { availablePortions: next, revision, updatedAt: now });
      audit(this.db, tx, auditId, actor, 'STOCK_ADJUSTED', { shopId: food.shopId, foodId, previous: current, next,
        reservedAtAdjustment: natural(food.reservedPortions), reason: input.reason, revision }, now);
      return { foodId, revision, availablePortions: next };
    });
  }

  async drivers(actor, shopId, cursor) {
    const shop = await scopedShop(this.db, null, actor, shopId);
    const base = shop.ref.collection('drivers');
    const approvals = actor.profile.role === 'admin' ? base : base.where('approved', '==', true).where('active', '==', true);
    const result = await queryPage(approvals, { cursor, scope: 'drivers:' + shopId + ':' + actor.profile.role, map: idOf });
    const snapshots = result.rows.length ? await this.db.getAll(...result.rows.map(row => userRef(this.db, row.id))) : [];
    const rows = result.rows.map((row, index) => {
      const target = snapshots[index].data();
      const current = target?.active === true && target.role === 'driver'
        && (target.driverAuthorityVersion ?? 0) === (row.authorityVersion ?? 0);
      return { id: row.id, name: target?.displayName ?? row.id, approved: current && row.approved === true,
        active: current && row.active === true, assignable: current && row.approved === true && row.active === true };
    });
    return { ...result, rows: actor.profile.role === 'admin' ? rows : rows.filter(row => row.assignable) };
  }

  approveDriver(uid, shopId, driverUid, key, input) {
    return mutation(this.db, uid, 'shop:driver-approval', key, { shopId, driverUid, input }, ['admin'], async (tx, actor, now, auditId) => {
      const shop = await scopedShop(this.db, tx, actor, shopId);
      const ref = shop.ref.collection('drivers').doc(driverUid);
      const [user, current] = await tx.getAll(userRef(this.db, driverUid), ref);
      const target = user.data();
      if (target?.role !== 'driver' || target.active !== true) throw new ApiError(422, 'DRIVER_UNAVAILABLE', 'Chọn tài xế đang hoạt động.');
      const before = current.exists ? { approved: current.get('approved') === true, active: current.get('active') === true } : null;
      if ((!input.approved || !input.active) && before?.approved && before.active && natural(target.activeOrderCount ?? 0) > 0) {
        throw activeOrderConflict();
      }
      tx.set(ref, { ...input, authorityVersion: natural(target.driverAuthorityVersion ?? 0), approvedBy: uid, approvedAt: now });
      audit(this.db, tx, auditId, actor, 'DRIVER_APPROVAL_UPDATED', { shopId, targetUid: driverUid, before, after: input }, now);
      return { shopId, driverUid, ...input };
    });
  }
}

export async function ownedShops(db, uid) {
  return (await db.collection('shops').where('ownerUid', '==', uid).limit(20).get()).docs.map(shop => ({ id: shop.id, name: shop.get('name') }));
}
