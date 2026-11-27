import { createHash } from 'node:crypto';
import { addressInputSchema, menuItemDocumentSchema, shopDocumentSchema, storagePathSchema } from '@foodordernext/contracts';
import { selectOptions } from './customer.js';
import { ApiError } from './errors.js';

export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const dataConflict = () => new ApiError(409, 'ORDER_DATA_CONFLICT', 'Dữ liệu đơn cần được kiểm tra.');
const unavailable = () => new ApiError(409, 'ITEM_UNAVAILABLE', 'Quán hoặc món hiện không nhận đơn. Hãy kiểm tra giỏ.');
const voucherInvalid = () => new ApiError(422, 'VOUCHER_NOT_ELIGIBLE', 'Mã ưu đãi không áp dụng cho đơn này.');

export function natural(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw dataConflict();
  return value;
}

export function normalizeLines(items) {
  const entries = items.map(({ foodId, quantity, optionIds }) => ({ foodId, quantity, optionIds: [...optionIds].sort() }));
  return entries.sort((a, b) => key(a).localeCompare(key(b)));
}

const key = line => JSON.stringify([line.foodId, line.optionIds]);

export function stockQuantities(items) {
  const counts = new Map();
  for (const line of items) counts.set(line.foodId, (counts.get(line.foodId) ?? 0) + line.quantity);
  return counts;
}

function dateMillis(value) { return typeof value?.toMillis === 'function' ? value.toMillis() : NaN; }

async function readVoucher(db, tx, uid, shopId, code, subtotal, now) {
  if (!code) return null;
  const codeKey = code.toUpperCase();
  if (!/^[A-Z0-9_-]{1,40}$/.test(codeKey)) throw voucherInvalid();
  const definition = (await tx.get(db.collection('voucherCodes').doc(codeKey))).data();
  if (!definition || definition.shopId !== shopId) throw voucherInvalid();
  const ref = db.collection('vouchers').doc(definition.voucherId);
  const userRef = ref.collection('userCounters').doc(uid);
  const [snapshot, counter] = await tx.getAll(ref, userRef);
  const voucher = snapshot.data();
  if (voucher?.active !== true || voucher.codeKey !== codeKey || voucher.shopId !== shopId
    || !(dateMillis(voucher.startsAt) <= now.toMillis() && now.toMillis() < dateMillis(voucher.endsAt))
    || subtotal < natural(voucher.minSubtotalVnd)) throw voucherInvalid();
  const limits = counter.data() ?? { reservedCount: 0, redeemedCount: 0 };
  if (natural(natural(voucher.reservedCount) + natural(voucher.redeemedCount)) >= natural(voucher.maxUses)
    || natural(natural(limits.reservedCount) + natural(limits.redeemedCount)) >= natural(voucher.perUserLimit)) {
    throw new ApiError(409, 'VOUCHER_QUOTA_EXHAUSTED', 'Mã ưu đãi đã hết lượt sử dụng.');
  }
  let discount;
  if (voucher.discountType === 'FIXED') {
    discount = natural(voucher.fixedDiscountVnd);
  } else if (voucher.discountType === 'PERCENT' && natural(voucher.percentBps) <= 10000) {
    discount = Number(BigInt(subtotal) * BigInt(voucher.percentBps) / 10000n);
  } else {
    throw voucherInvalid();
  }
  const discountVnd = Math.min(subtotal, discount, voucher.maxDiscountVnd == null ? subtotal : natural(voucher.maxDiscountVnd));
  return { ref, userRef, voucher, limits, discountVnd };
}

export async function orderQuote(db, tx, user, input, now) {
  const items = normalizeLines(input.items);
  const quantities = stockQuantities(items);
  const shopRef = db.collection('shops').doc(input.shopId);
  const addressRef = user.collection('addresses').doc(input.addressId);
  const [shopSnapshot, address, ...foods] = await tx.getAll(shopRef, addressRef,
    ...Array.from(quantities.keys(), foodId => db.collection('menuItems').doc(foodId)));
  const shop = shopDocumentSchema.safeParse(shopSnapshot.data());
  if (!shop.success || !shop.data.active || !shop.data.acceptingOrders) throw unavailable();
  const saved = address.data();
  const coordinates = saved?.location;
  const addressInput = saved && addressInputSchema.safeParse({
    label: saved.label, receiverName: saved.receiverName, phone: saved.phone, addressText: saved.addressText,
    locationSource: saved.locationSource, location: coordinates ? { latitude: coordinates.latitude, longitude: coordinates.longitude } : null,
  });
  if (!addressInput?.success) throw new ApiError(422, 'ADDRESS_INVALID', 'Chọn địa chỉ hợp lệ trong sổ địa chỉ của bạn.');
  const { receiverName, phone, addressText, location } = addressInput.data;
  const addressSnapshot = { receiverName, phone, addressText, location };
  const foodById = new Map();
  for (const doc of foods) {
    const data = menuItemDocumentSchema.safeParse(doc.data());
    if (!data.success || !data.data.active || data.data.shopId !== input.shopId) throw unavailable();
    if (data.data.availablePortions < quantities.get(doc.id)) {
      throw new ApiError(409, 'OUT_OF_STOCK', 'Một món không còn đủ suất.', { foodId: doc.id });
    }
    foodById.set(doc.id, data.data);
  }
  const snapshots = items.map((line, index) => {
    const food = foodById.get(line.foodId);
    const optionsSnapshot = selectOptions(food, line.optionIds);
    const unitPriceVnd = natural(food.priceVnd + optionsSnapshot.reduce((total, option) => natural(total + option.priceDeltaVnd), 0));
    const image = storagePathSchema.safeParse(food.imagePath);
    return { lineId: `line-${index + 1}`, foodId: line.foodId, nameSnapshot: food.name, quantity: line.quantity,
      optionsSnapshot, unitPriceVnd, lineTotalVnd: natural(unitPriceVnd * line.quantity), imagePathSnapshot: image.success ? image.data : null };
  });
  const subtotalVnd = snapshots.reduce((sum, item) => natural(sum + item.lineTotalVnd), 0);
  const voucher = await readVoucher(db, tx, user.id, input.shopId, input.voucherCode, subtotalVnd, now);
  const discountVnd = voucher?.discountVnd ?? 0;
  const deliveryFeeVnd = shop.data.deliveryFeeVnd;
  const grandTotalVnd = natural(subtotalVnd - discountVnd + deliveryFeeVnd);
  const totals = { subtotalVnd, discountVnd, deliveryFeeVnd, grandTotalVnd, currency: 'VND' };
  const quoteKey = digest({ shopId: input.shopId, addressId: input.addressId, addressSnapshot,
    items: snapshots, ...totals, voucherId: voucher?.ref.id ?? null });
  return {
    shopRef, shop: shop.data, addressSnapshot, voucher, quantities, foods,
    dto: { items: snapshots, ...totals, address: addressSnapshot, shopName: shop.data.name, quoteKey,
      quotedAt: now.toDate().toISOString(), availability: 'AVAILABLE' },
  };
}

export function updateStock(tx, foods, quantities, action, now) {
  for (const food of foods) {
    const data = food.data();
    if (!data) throw dataConflict();
    const quantity = quantities.get(food.id);
    const available = natural(data.availablePortions);
    const reserved = natural(data.reservedPortions);
    const sold = natural(data.soldPortions);
    tx.update(food.ref, {
      availablePortions: natural(available + (action === 'reserve' ? -quantity : action === 'release' ? quantity : 0)),
      reservedPortions: natural(reserved + (action === 'reserve' ? quantity : -quantity)),
      soldPortions: natural(sold + (action === 'consume' ? quantity : 0)),
      revision: natural(natural(data.revision) + 1), updatedAt: now,
    });
  }
}

export function reserveVoucher(tx, choice, order, uid, now) {
  if (!choice) return;
  const { ref, userRef, voucher, limits, discountVnd } = choice;
  tx.update(ref, { reservedCount: natural(voucher.reservedCount + 1), updatedAt: now });
  tx.set(userRef, { reservedCount: natural(limits.reservedCount + 1), redeemedCount: limits.redeemedCount, updatedAt: now }, { merge: true });
  tx.create(ref.collection('redemptions').doc(order.id), { uid, state: 'RESERVED', discountVnd, createdAt: now, updatedAt: now });
}

export async function readHeldVoucher(db, tx, orderId, order) {
  if (order.voucherReservation === 'NONE' && !order.voucherId) return null;
  if (order.voucherReservation !== 'RESERVED' || !order.voucherId) throw dataConflict();
  const ref = db.collection('vouchers').doc(order.voucherId);
  const refs = [ref, ref.collection('userCounters').doc(order.customerUid), ref.collection('redemptions').doc(orderId)];
  const [voucher, counter, redemption] = await tx.getAll(...refs);
  if (!voucher.exists || !counter.exists || redemption.data()?.uid !== order.customerUid
    || redemption.data()?.state !== 'RESERVED') throw dataConflict();
  return { voucher, counter, redemption };
}

export function settleVoucher(tx, held, redeemed, now) {
  if (!held) return;
  for (const snapshot of [held.voucher, held.counter]) {
    const { reservedCount, redeemedCount } = snapshot.data();
    tx.update(snapshot.ref, { reservedCount: natural(natural(reservedCount) - 1),
      redeemedCount: natural(natural(redeemedCount) + Number(redeemed)), updatedAt: now });
  }
  tx.update(held.redemption.ref, { state: redeemed ? 'REDEEMED' : 'RELEASED', updatedAt: now });
}
