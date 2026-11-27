import { createHash } from 'node:crypto';
import { FieldValue, GeoPoint } from 'firebase-admin/firestore';
import { addressInputSchema, optionGroupsSchema } from '@foodordernext/contracts';
import { ApiError, requireValidProfile, validationError } from './errors.js';

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const lineKey = line => JSON.stringify([line.foodId, [...line.optionIds].sort()]);
const missing = () => new ApiError(404, 'NOT_FOUND', 'Không tìm thấy dữ liệu.');
const unavailable = () => new ApiError(409, 'ITEM_UNAVAILABLE', 'Quán, món hoặc tùy chọn đã thay đổi. Hãy xem lại thực đơn.');
const timestamp = () => FieldValue.serverTimestamp();

export function parse(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success) throw validationError(result.error);
  return result.data;
}

function addressRecord(input) {
  return {
    ...input,
    location: input.location ? new GeoPoint(input.location.latitude, input.location.longitude) : null,
    updatedAt: timestamp(),
  };
}

export function selectOptions(food, optionIds) {
  const groups = optionGroupsSchema.safeParse(food.optionGroups ?? []);
  if (!groups.success) throw unavailable();
  const options = new Map(groups.data.flatMap(group => group.options.map(option => [option.id, option])));
  if (optionIds.some(id => !options.has(id))) throw unavailable();
  for (const group of groups.data) {
    const count = group.options.filter(option => optionIds.includes(option.id)).length;
    if (count < group.minSelections || count > group.maxSelections) throw unavailable();
  }
  return [...optionIds].sort().map(id => options.get(id));
}

export class FirestoreCustomerRepository {
  constructor(db) { this.db = db; }

  async mutate(uid, routeKey, key, input, apply) {
    const user = this.db.collection('users').doc(uid);
    const operation = this.db.collection('operations').doc(digest([uid, routeKey, key]));
    const requestFingerprint = digest(input);
    return this.db.runTransaction(async tx => {
      const [profileSnapshot, saved] = await tx.getAll(user, operation);
      const profile = requireValidProfile(profileSnapshot.data());
      if (profile.role !== 'customer') throw new ApiError(403, 'FORBIDDEN', 'Thao tác dành cho khách hàng.');
      if (saved.exists) {
        if (saved.data().requestFingerprint !== requestFingerprint) {
          throw new ApiError(409, 'IDEMPOTENCY_KEY_REUSED', 'Key đã được dùng cho nội dung khác.');
        }
        return { data: saved.data().resultSummary, replayed: true };
      }
      const data = await apply(tx, user, profile);
      tx.create(operation, { uid, routeKey, requestFingerprint, resultSummary: data, createdAt: timestamp() });
      return { data, replayed: false };
    });
  }

  async putCart(tx, user, input) {
    const ref = user.collection('carts').doc('active');
    const stored = (await tx.get(ref)).data();
    const version = stored?.version ?? 0;
    if (input.expectedCartVersion !== version) {
      throw new ApiError(409, 'CART_VERSION_CONFLICT', 'Giỏ đã đổi trên thiết bị khác. Hãy tải lại.', { version });
    }
    const items = input.items.map(line => ({ ...line, optionIds: [...line.optionIds].sort() }));
    const previous = new Map((stored?.shopId === input.shopId ? stored.items : []).map(line => [lineKey(line), line.quantity]));
    const increases = items.filter(line => line.quantity > (previous.get(lineKey(line)) ?? 0));
    if (increases.length) {
      const ids = [...new Set(increases.map(line => line.foodId))];
      const [shop, ...foods] = await tx.getAll(this.db.collection('shops').doc(input.shopId),
        ...ids.map(id => this.db.collection('menuItems').doc(id)));
      if (shop.data()?.active !== true || shop.data()?.acceptingOrders !== true) throw unavailable();
      const byId = new Map(foods.map(snapshot => [snapshot.id, snapshot.data()]));
      for (const line of increases) {
        const food = byId.get(line.foodId);
        if (food?.active !== true || food.shopId !== input.shopId) throw unavailable();
        selectOptions(food, line.optionIds);
      }
      for (const id of ids) {
        const quantity = items.filter(line => line.foodId === id).reduce((sum, line) => sum + line.quantity, 0);
        const available = byId.get(id).availablePortions;
        if (!Number.isSafeInteger(available) || quantity > available) {
          throw new ApiError(409, 'OUT_OF_STOCK', 'Món không còn đủ suất theo số lượng đã chọn.');
        }
      }
    }
    const result = { version: version + 1 };
    tx.set(ref, { shopId: items.length ? input.shopId : null, items, ...result, updatedAt: timestamp() });
    return result;
  }

  clearCart(tx, user, expectedCartVersion) {
    return this.putCart(tx, user, { shopId: null, items: [], expectedCartVersion });
  }

  async createAddress(tx, user, profile, input) {
    const addresses = user.collection('addresses');
    const existing = await tx.get(addresses.limit(20));
    if (existing.size >= 20) throw new ApiError(422, 'ADDRESS_LIMIT', 'Sổ địa chỉ đã có 20 mục.');
    const ref = addresses.doc();
    tx.create(ref, { ...addressRecord(input), createdAt: timestamp() });
    // Serialize creates with edits/deletes via the profile, including when the
    // existing default stays the same, so the address count stays bounded.
    tx.update(user, { defaultAddressId: profile.defaultAddressId ?? ref.id, updatedAt: timestamp() });
    return { addressId: ref.id };
  }

  async patchAddress(tx, user, id, input) {
    const ref = user.collection('addresses').doc(id);
    const current = (await tx.get(ref)).data();
    if (!current) throw missing();
    const { makeDefault, ...fields } = input;
    if (Object.keys(fields).length) {
      const merged = Object.fromEntries(addressFieldNames.map(field => [field, fields[field] !== undefined ? fields[field] : current[field]]));
      if (merged.location) {
        merged.location = { latitude: merged.location.latitude, longitude: merged.location.longitude };
      }
      tx.update(ref, addressRecord(parse(addressInputSchema, merged)));
    }
    if (makeDefault) tx.update(user, { defaultAddressId: id, updatedAt: timestamp() });
    return { addressId: id };
  }

  async deleteAddress(tx, user, profile, id) {
    const addresses = user.collection('addresses');
    const ref = addresses.doc(id);
    if (!(await tx.get(ref)).exists) throw missing();
    if (profile.defaultAddressId === id) {
      const others = await tx.get(addresses.orderBy('__name__').limit(2));
      const next = others.docs.find(snapshot => snapshot.id !== id);
      tx.update(user, { defaultAddressId: next?.id ?? null, updatedAt: timestamp() });
    }
    tx.delete(ref);
    return { addressId: id };
  }

  async favorite(tx, user, id, enabled) {
    const ref = user.collection('favorites').doc(id);
    if (!enabled) {
      tx.delete(ref);
      return { foodId: id, saved: false };
    }
    if (!(await tx.get(ref)).exists) {
      const food = (await tx.get(this.db.collection('menuItems').doc(id))).data();
      if (food?.active !== true) throw missing();
      const shop = (await tx.get(this.db.collection('shops').doc(food.shopId))).data();
      if (shop?.active !== true) throw missing();
      tx.create(ref, { foodId: id, shopId: food.shopId, createdAt: timestamp() });
    }
    return { foodId: id, saved: true };
  }

}

const addressFieldNames = ['label', 'receiverName', 'phone', 'addressText', 'location', 'locationSource'];
