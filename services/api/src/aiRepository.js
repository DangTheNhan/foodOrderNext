import { Timestamp } from 'firebase-admin/firestore';
import { ApiError, requireValidProfile } from './errors.js';
import { assertRole, notFound, scopedShop, userRef } from './operationsSupport.js';
import { digest } from './orderPricing.js';
import { buildMenu } from './aiMenu.js';
import { REVIEW_SAMPLE_LIMIT, shapeReviews } from './aiReviews.js';

const DAY = 86_400_000;
const MINUTE = 60_000;
const menuReadLimit = 80;
const time = ms => Timestamp.fromMillis(ms);

function count(snapshot, window) {
  return snapshot.get('window') === window ? snapshot.get('count') : 0;
}

export class AiRepository {
  constructor(db, { allowFixture = false, clock = Date.now } = {}) {
    this.db = db;
    this.allowFixture = allowFixture;
    this.clock = clock;
  }

  authorizeReview(uid, shopId) {
    return this.db.runTransaction(async tx => {
      const profile = requireValidProfile((await tx.get(userRef(this.db, uid))).data());
      assertRole(profile, ['merchant', 'admin']);
      await scopedShop(this.db, tx, { uid, profile }, shopId);
    }, { readOnly: true });
  }

  request(uid) {
    const ref = this.db.doc('aiRequestLimits/' + digest(uid));
    return this.db.runTransaction(async tx => {
      const now = this.clock();
      const window = Math.floor(now / MINUTE);
      const used = count(await tx.get(ref), window);
      if (used >= 10) throw new ApiError(429, 'RATE_LIMITED', 'Bạn đã gửi nhiều yêu cầu. Hãy thử lại sau.',
        { retryAfterMs: (window + 1) * MINUTE - now });
      tx.set(ref, { window, count: used + 1, expiresAt: time(now + DAY) });
    });
  }

  takeAttempt(uid) {
    const global = this.db.doc('aiBudgets/global');
    const account = this.db.doc('aiBudgets/account-' + digest(uid));
    return this.db.runTransaction(async tx => {
      const now = this.clock();
      const window = Math.floor(now / DAY);
      const [all, own] = (await tx.getAll(global, account)).map(snapshot => count(snapshot, window));
      if (all >= 80 || own >= 12) return false;
      tx.set(global, { window, count: all + 1, expiresAt: time(now + 2 * DAY) });
      tx.set(account, { window, count: own + 1, expiresAt: time(now + 2 * DAY) });
      return true;
    });
  }

  menu(input) {
    const shop = this.db.doc('shops/' + input.shopId);
    const query = this.db.collection('menuItems').where('shopId', '==', input.shopId)
      .where('active', '==', true).where('availablePortions', '>', 0)
      .orderBy('availablePortions', 'desc').limit(menuReadLimit + 1);
    return this.db.runTransaction(async tx => {
      const parent = await tx.get(shop);
      if (!parent.exists || parent.get('active') !== true) throw notFound();
      if (parent.get('acceptingOrders') !== true) {
        throw new ApiError(409, 'ITEM_UNAVAILABLE', 'Quán đang tạm ngừng nhận đơn.');
      }
      const result = await tx.get(query);
      const foods = buildMenu(result.docs.slice(0, menuReadLimit).map(doc => ({ ...doc.data(), id: doc.id })), input);
      return { foods, sampled: result.size > foods.length, version: digest(foods) };
    }, { readOnly: true });
  }

  async reviews(uid, shopId, interval) {
    const query = this.db.collection('reviews').where('shopId', '==', shopId)
      .where('verifiedCompletedOrder', '==', true)
      .where('createdAt', '>=', time(Date.parse(interval.startInclusive)))
      .where('createdAt', '<', time(Date.parse(interval.endExclusive)))
      .orderBy('createdAt', 'desc').limit(REVIEW_SAMPLE_LIMIT + 1);
    return this.db.runTransaction(async tx => {
      const profile = requireValidProfile((await tx.get(userRef(this.db, uid))).data());
      assertRole(profile, ['merchant', 'admin']);
      await scopedShop(this.db, tx, { uid, profile }, shopId);
      const result = await tx.get(query);
      const reviews = shapeReviews(result.docs.slice(0, REVIEW_SAMPLE_LIMIT).map(doc => ({ ...doc.data(), id: doc.id })),
        this.allowFixture);
      return { reviews, sampled: result.size > REVIEW_SAMPLE_LIMIT, version: digest(reviews) };
    }, { readOnly: true });
  }

  async cached(collection, id, version) {
    const saved = (await this.db.collection(collection).doc(id).get()).data();
    if (saved?.version === version && saved.expiresAt?.toMillis() > this.clock()) return saved;
    return null;
  }

  async save(collection, id, version, output, ttlMs) {
    const generatedAt = new Date(this.clock()).toISOString();
    await this.db.collection(collection).doc(id).set({
      version, modelOutput: output, generatedAt, expiresAt: time(Date.parse(generatedAt) + ttlMs),
    });
    return generatedAt;
  }
}
