import { createSeedPlan, validateSeedPlan } from '../seed/plan.mjs';

export const datasetVersion = 'p08-benchmark-v1';
export const reportDay = '2026-01-02';
export const reportShop = 'shop1';
const orderCount = 10000;
const menuPerShop = 90;
const start = Date.parse(reportDay + 'T08:00:00+07:00');

export function createBenchmarkFixture() {
  const plan = createSeedPlan(3);
  const docs = plan.documents;
  const totals = { createdCount: 0, completedCount: 0, codVnd: 0 };
  for (let shop = 1; shop <= 3; shop += 1) {
    for (let food = 0; food < menuPerShop; food += 1) {
      const key = String(food).padStart(3, '0');
      docs[`menuItems/p08-shop${shop}-${key}`] = {
        ...docs[`menuItems/shop${shop}-rice`],
        name: 'Món kiểm thử ' + key,
        nameKey: 'mon kiem thu ' + key,
        priceVnd: 18000 + (food % 12) * 2000,
        availablePortions: 100,
        reservedPortions: 0,
        soldPortions: 0,
      };
    }
  }

  for (let index = 0; index < orderCount; index += 1) {
    const id = 'p08-order-' + String(index).padStart(5, '0');
    const shopId = 'shop' + (index % 3 + 1);
    const shop = docs[`shops/${shopId}`];
    const customerUid = index % 2 ? 'demo-customer-2' : 'demo-customer';
    const pending = index % 20 === 0;
    const createdAt = new Date(start + Math.floor(index / 3) * 10000);
    const completedAt = pending ? null : new Date(createdAt.getTime() + 1800000);
    const items = [0, 1].map(offset => {
      const foodKey = String((Math.floor(index / 3) * 2 + offset) % menuPerShop).padStart(3, '0');
      const foodId = `p08-${shopId}-${foodKey}`;
      const food = docs[`menuItems/${foodId}`];
      const quantity = offset + 1;
      food[pending ? 'reservedPortions' : 'soldPortions'] += quantity;
      return { lineId: foodId + '-plain', foodId, nameSnapshot: food.name, unitPriceVnd: food.priceVnd,
        quantity, optionsSnapshot: [], lineTotalVnd: food.priceVnd * quantity, imagePathSnapshot: null };
    });
    const subtotalVnd = items.reduce((sum, item) => sum + item.lineTotalVnd, 0);
    const grandTotalVnd = subtotalVnd + shop.deliveryFeeVnd;
    const reviewId = index % 10 === 1 ? 'p08-review-' + id.slice(-5) : null;
    if (reviewId) {
      const rating = 3 + Math.floor(index / 10) % 3;
      docs[`reviews/${reviewId}`] = { ...docs['reviews/demo-review-completed'], shopId,
        authorAliasSnapshot: 'Khách hàng', rating, createdAt: completedAt };
      shop.ratingSum += rating;
      shop.ratingCount += 1;
      shop.ratingAverage = shop.ratingSum / shop.ratingCount;
    }
    if (pending) {
      shop.activeOrderCount += 1;
      docs[`users/${customerUid}`].activeOrderCount += 1;
      docs[`users/${shop.ownerUid}`].activeOrderCount += 1;
    }
    docs[`orders/${id}`] = {
      ...docs[pending ? 'orders/demo-pending' : 'orders/demo-completed'],
      customerUid, shopId, shopNameSnapshot: shop.name, items, subtotalVnd,
      deliveryFeeVnd: shop.deliveryFeeVnd, grandTotalVnd, amountDueVnd: grandTotalVnd,
      activeParticipantUids: pending ? [customerUid, shop.ownerUid] : [],
      createdAt, updatedAt: completedAt ?? createdAt, completedAt, reviewId,
      assignedAt: pending ? null : createdAt,
      acceptedAssignmentAt: pending ? null : createdAt,
      acceptedAt: pending ? null : createdAt,
      pickedUpAt: pending ? null : createdAt,
      codConfirmedAt: completedAt, codCollectedVnd: pending ? null : grandTotalVnd,
    };
    if (shopId === reportShop) {
      totals.createdCount += 1;
      totals.completedCount += Number(!pending);
      totals.codVnd += pending ? 0 : grandTotalVnd;
    }
  }
  validateSeedPlan(plan);
  const counts = {};
  for (const path of Object.keys(docs)) {
    const collection = path.split('/')[0];
    if (path.split('/').length === 2) counts[collection] = (counts[collection] ?? 0) + 1;
  }
  return { ...plan, counts, totals };
}
