import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import supertest from 'supertest';
import { Timestamp } from 'firebase-admin/firestore';
import { createApp } from '../../services/api/src/app.js';
import { AiRepository } from '../../services/api/src/aiRepository.js';
import { FoodOrderAi } from '../../services/api/src/aiService.js';
import { readConfig } from '../../services/api/src/config.js';
import { createFirebaseServices } from '../../services/api/src/firebase.js';
import { FirestoreUserRepository } from '../../services/api/src/users.js';
import { digest } from '../../services/api/src/orderPricing.js';

test('P07 scoped data, cache, fallback and quotas on Firebase Emulator', { skip: process.env.RUN_EMULATOR_TESTS !== '1' }, async t => {
  const config = readConfig();
  assert.equal(config.mode, 'emulator');
  assert.equal(config.projectId, 'demo-foodordernext');
  const { firestore: db, close } = createFirebaseServices(config);
  const prefix = 'p07-' + randomUUID().slice(0, 10);
  const customer = prefix + '-buyer', merchant = prefix + '-merchant', outsider = prefix + '-outsider';
  const shopId = prefix + '-shop', otherShop = prefix + '-other', food = prefix + '-rice';
  const docs = [];
  const models = { menu: 0, reviews: 0 };
  const modelIdentity = prefix + '-transport';
  let invalid = false;
  let now = Date.now();
  const clock = () => now;
  const stock = db.doc('menuItems/' + food);
  const repo = new AiRepository(db, { allowFixture: true, clock });
  const gateway = { config: { identity: modelIdentity }, async generate({ kind, data, takeAttempt }) {
    models[kind]++;
    if (!await takeAttempt()) return { failure: 'AI_BUDGET_REACHED' };
    if (kind === 'menu') {
      return { value: { planId: data.plans[0].planId, reason: 'REQUEST_MATCH' } };
    }
    return { value: { focusId: invalid ? 'SPEED_r99' : 'SPEED_r1' } };
  } };
  const app = createApp({ userRepository: new FirestoreUserRepository(db),
    verifyIdToken: async uid => ({ uid, email_verified: true }), ai: new FoodOrderAi(repo, gateway, clock), logger: { error() {} } });
  const post = (uid, path, body) => supertest(app).post('/api/v1/ai/' + path).set('Authorization', 'Bearer ' + uid).send(body);
  const stamp = Timestamp.fromMillis(now);
  const menu = { shopId, requestText: 'Cơm gà', diners: 2, budgetVnd: 90_000 };
  const review = { shopId, startInclusive: new Date(now - 86400_000).toISOString(),
    endExclusive: new Date(now + 86400_000).toISOString() };
  const reviewId = index => prefix + '-review-' + index;
  const cache = [
    db.doc('aiMenuCache/' + digest(['menu-v2', modelIdentity, customer, { ...menu, preferences: [] }])),
    db.doc('aiInsightCache/' + digest(['reviews-v2', modelIdentity, merchant, shopId,
      { startInclusive: review.startInclusive, endExclusive: review.endExclusive }])),
  ];
  async function write(path, value) {
    const ref = db.doc(path);
    docs.push(ref);
    await ref.set(value);
  }
  const writeReview = (index, attrs) => write('reviews/' + reviewId(index), {
    shopId, createdAt: Timestamp.fromMillis(now - index * 1000), text: 'Giao nhanh', rating: 5,
    verifiedCompletedOrder: true, ...attrs,
  });
  try {
    await Promise.all([
      ...[[customer, 'customer'], [merchant, 'merchant'], [outsider, 'merchant']].map(([uid, role]) => write('users/' + uid, {
        active: true, displayName: 'Demo', role, createdAt: stamp, updatedAt: stamp,
      })),
      write('shops/' + shopId, { ownerUid: merchant, active: true, acceptingOrders: true }),
      write('shops/' + otherShop, { ownerUid: outsider, active: true, acceptingOrders: true }),
      ...[[food, shopId, 8], [prefix + '-sold-out', shopId, 0], [prefix + '-wrong-shop', otherShop, 20]]
        .map(([id, catalogShop, availablePortions]) => write('menuItems/' + id, {
          name: 'Cơm gà', nameKey: 'com ga', shopId: catalogShop, categoryId: 'meal', priceVnd: 30_000,
          active: true, currency: 'VND', availablePortions, reservedPortions: 0, soldPortions: 0, revision: 1,
        })),
    ]);
    await t.test('menu cache reprices after stock revision and cannot write orders/cart', async () => {
      assert.equal((await post(merchant, 'menu-assistant', menu)).status, 403);
      const first = await post(customer, 'menu-assistant', menu);
      assert.equal(first.status, 200, JSON.stringify(first.body));
      assert.equal(first.body.data.generatedBy, 'MODEL');
      assert.equal(first.body.data.suggestions[0].foodId, food);
      assert.equal(first.body.data.subtotalVnd, 60_000);
      assert.equal((await post(customer, 'menu-assistant', menu)).body.data.cached, true);
      assert.equal(models.menu, 1);
      await stock.update({ priceVnd: 40_000, revision: 2 });
      const reprice = (await post(customer, 'menu-assistant', menu)).body.data;
      assert.equal(reprice.subtotalVnd, 80_000);
      assert.equal(reprice.cached, false);
      assert.notEqual(reprice.sourceRevision, first.body.data.sourceRevision);
      assert.equal((await db.doc('users/' + customer + '/carts/active').get()).exists, false);
      const cheap = (await post(customer, 'menu-assistant', { ...menu, budgetVnd: 100 })).body.data;
      assert.equal(cheap.generatedBy, 'FALLBACK');
      assert.deepEqual(cheap.suggestions, []);
    });
    await t.test('review samples exclude unverified and other shops and invalid evidence falls back', async () => {
      assert.equal((await post(outsider, 'review-insights', review)).status, 403);
      assert.equal((await post(customer, 'review-insights', review)).status, 403);
      await Promise.all([writeReview(1, {}), writeReview(2, { shopId: otherShop }),
        writeReview(3, { verifiedCompletedOrder: false })]);
      const insufficient = await post(merchant, 'review-insights', review);
      assert.equal(insufficient.body.error.code, 'INSUFFICIENT_DATA');
      assert.equal(insufficient.body.error.details.sampleSize, 1);
      assert.equal(models.reviews, 0);
      await Promise.all([writeReview(4, { text: 'Giao quá chậm', rating: 1, syntheticFixture: true }),
        writeReview(5, { text: 'Món ngon', rating: 4 })]);
      const result = (await post(merchant, 'review-insights', review)).body.data;
      assert.equal(result.generatedBy, 'MODEL');
      assert.equal(result.sampleSize, 3);
      assert.equal(result.fixtureCount, 1);
      assert.deepEqual(result.themes[0].evidenceReviewIds, [reviewId(1), reviewId(4)]);
      assert.equal(result.themes[0].sentiment, 'MIXED');
      assert.equal((await post(merchant, 'review-insights', review)).body.data.cached, true);
      await writeReview(6, { text: 'Nhân viên thân thiện', rating: 5 });
      invalid = true;
      const fallback = (await post(merchant, 'review-insights', review)).body.data;
      assert.equal(fallback.generatedBy, 'FALLBACK');
      assert.equal(fallback.fallbackReason, 'AI_OUTPUT_INVALID');
      assert.equal(fallback.sampleSize, 4);
      assert.ok(fallback.sources.every(source => ![reviewId(2), reviewId(3)].includes(source.reviewId)));
    });
    await t.test('concurrent requests respect the persistent minute limit and window rollover', async () => {
      for (let n = 0; n < 9; n++) await repo.request(outsider);
      const attempts = await Promise.allSettled([repo.request(outsider), repo.request(outsider)]);
      assert.equal(attempts.filter(attempt => attempt.status === 'fulfilled').length, 1);
      assert.equal(attempts.find(attempt => attempt.status === 'rejected').reason.code, 'RATE_LIMITED');
      now += 60_000;
      await repo.request(outsider);
    });
  } finally {
    await Promise.all([...docs, ...cache,
      ...[customer, merchant, outsider].map(uid => db.doc('aiRequestLimits/' + digest(uid))),
      ...[customer, merchant].map(uid => db.doc('aiBudgets/account-' + digest(uid))),
      db.doc('aiBudgets/global'),
    ].map(ref => ref.delete()));
    await close();
  }
});
