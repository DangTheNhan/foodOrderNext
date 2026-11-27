import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import request from 'supertest';
import { createApp } from '../../services/api/src/app.js';
import { readConfig } from '../../services/api/src/config.js';
import { createFirebaseServices } from '../../services/api/src/firebase.js';
import { CatalogOperations } from '../../services/api/src/catalogOperations.js';
import { AdminOperations } from '../../services/api/src/adminOperations.js';
import { FirestoreOrderRepository } from '../../services/api/src/orders.js';
import { FirestoreUserRepository } from '../../services/api/src/users.js';

test('P04 operations scope, audit, media and daily report', { skip: process.env.RUN_EMULATOR_TESTS !== '1' }, async t => {
  const config = readConfig();
  assert.equal(config.mode, 'emulator');
  assert.equal(config.projectId, 'demo-foodordernext');
  const { firestore: db, storage, publishMenuImage, readMenuImage, close } = createFirebaseServices(config);
  const prefix = 'p04-' + randomUUID().slice(0, 11);
  const id = suffix => prefix + '-' + suffix;
  const [merchant, other, customer, driver, admin, deputy] = ['merchant', 'other', 'customer', 'driver', 'admin', 'deputy'].map(id);
  const people = [merchant, other, customer, driver, admin, deputy];
  const shop = db.doc('shops/' + id('shop')), hiddenShop = db.doc('shops/' + id('other-shop'));
  const category = db.doc('categories/' + id('meals'));
  const registry = db.doc('system/adminRegistry');
  const user = uid => db.doc('users/' + uid);
  const written = new Set();
  const app = createApp({ userRepository: new FirestoreUserRepository(db), orderRepository: new FirestoreOrderRepository(db),
    operations: { catalog: new CatalogOperations(db, publishMenuImage, readMenuImage), adminUsers: new AdminOperations(db) },
    verifyIdToken: async token => {
      if (!people.includes(token)) throw new Error('Unknown test identity');
      return { uid: token, email_verified: true };
    }, logger: { error() {} } });

  const api = (uid, method, path, body, key = randomUUID()) => {
    const req = request(app)[method]('/api/v1' + path).set('Authorization', 'Bearer ' + uid).set('Idempotency-Key', key);
    return body ? req.send(body) : req;
  };
  const target = '/shops/' + shop.id;
  const bucket = storage.bucket();
  const images = [];
  const data = (response, status = 200) => {
    assert.equal(response.status, status, JSON.stringify(response.body));
    return response.body.data;
  };
  const expect = (response, code) => assert.equal(response.body.error?.code, code, JSON.stringify(response.body));
  const now = new Date();
  assert.equal((await registry.get()).exists, false, 'Run against a fresh emulator; this test requires its own registry');
  let foodId;
  try {
    const roles = ['merchant', 'merchant', 'customer', 'driver', 'admin', 'customer'];
    await Promise.all(people.map((uid, i) => user(uid).set({ role: roles[i], active: true, displayName: 'Người thử ' + i,
      emailDisplay: uid + '@example.invalid', activeOrderCount: 0, createdAt: now, updatedAt: now, internal: 'not-a-dto-field' })));
    const shopFields = { name: 'Quán P04', active: true, acceptingOrders: true, activeOrderCount: 0,
      deliveryFeeVnd: 5000, ratingSum: 0, ratingCount: 0, ratingAverage: 0, addressText: 'Địa chỉ thử' };
    await Promise.all([
      registry.set({ activeAdminUids: [admin], activeAdminCount: 1, updatedAt: now }),
      shop.set({ ...shopFields, ownerUid: merchant }), hiddenShop.set({ ...shopFields, ownerUid: other }),
      category.set({ name: 'Đồ ăn', nameKey: 'do an', active: true, sortOrder: 1 }),
    ]);

    await t.test('shop scopes and strict menu mutations preserve reservation and record audit', async () => {
      assert.deepEqual(data(await api(merchant, 'get', '/shops')).rows.map(row => row.id), [shop.id]);
      assert.equal((await api(customer, 'get', target)).status, 403);
      assert.equal((await api(other, 'get', target + '/menu-items')).status, 403);
      assert.equal((await api(other, 'patch', target, { acceptingOrders: false })).status, 403);
      const body = { name: 'Cơm Quán P04', description: 'Nội dung thử', priceVnd: 41000, categoryId: category.id,
        active: true, initialAvailablePortions: 4, optionGroups: [{ id: 'size', name: 'Khẩu phần', minSelections: 0, maxSelections: 1,
          options: [{ id: 'large', name: 'Lớn', priceDeltaVnd: 5000 }] }] };
      assert.equal((await api(driver, 'post', target + '/menu-items', body)).status, 403);
      assert.equal((await api(merchant, 'post', target + '/menu-items', { ...body, priceVnd: 41000.5 })).status, 422);
      expect(await api(merchant, 'post', target + '/menu-items', { ...body, categoryId: 'missing' }), 'CATEGORY_UNAVAILABLE');

      const key = randomUUID();
      const item = data(await api(merchant, 'post', target + '/menu-items', body, key), 201);
      foodId = item.foodId;
      written.add('menuItems/' + foodId);
      const replay = await api(merchant, 'post', target + '/menu-items', body, key);
      assert.equal(replay.body.meta.idempotencyReplayed, true);
      assert.equal(replay.body.data.foodId, foodId);
      const path = '/menu-items/' + foodId;
      const stored = db.doc('menuItems/' + foodId);
      await stored.update({ reservedPortions: 2, soldPortions: 3 });
      assert.equal((await api(other, 'patch', path, { expectedRevision: 1, active: false })).status, 403);
      assert.equal((await api(merchant, 'patch', path, { expectedRevision: 1, reservedPortions: 0 })).status, 422);
      expect(await api(merchant, 'post', path + '/stock-adjustments', { expectedRevision: 1, deltaAvailablePortions: -5, reason: 'Hết' }), 'STOCK_OUT_OF_RANGE');
      const stock = data(await api(merchant, 'post', path + '/stock-adjustments', { expectedRevision: 1, deltaAvailablePortions: -4, reason: 'Tạm hết' }));
      assert.equal(stock.availablePortions, 0);
      expect(await api(merchant, 'patch', path, { expectedRevision: 1, priceVnd: 44000 }), 'MENU_REVISION_CONFLICT');
      data(await api(merchant, 'patch', path, { expectedRevision: 2, active: false, priceVnd: 44000 }));
      const latest = (await stored.get()).data();
      assert.equal(latest.active, false);
      assert.equal(latest.availablePortions, 0);
      assert.equal(latest.reservedPortions, 2);
      assert.equal(latest.soldPortions, 3);
      assert.equal(latest.nameKey, 'com quan p04');
      const audit = await db.collection('adminAudit').where('foodId', '==', foodId).get();
      assert.deepEqual(audit.docs.map(doc => doc.get('action')).sort(), ['MENU_CREATED', 'MENU_UPDATED', 'STOCK_ADJUSTED']);
    });

    await t.test('published media must be owner-uploaded and exact current attach', async () => {
      const mk = async (asset, bytes, uid = merchant) => {
        const path = `shops/${shop.id}/menu/${asset}-${prefix}.png`;
        images.push(path);
        await bucket.file(path).save(bytes, { metadata: { contentType: 'image/png', metadata: { ownerUid: uid, state: 'pending' } } });
        return path;
      };
      const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jMZ0AAAAASUVORK5CYII=', 'base64');
      const corrupt = await mk('bad-image-p04', Buffer.from('not an image'));
      const foreign = await mk('foreign-image-p04', image, other);
      const path = await mk('valid-image-p04', image);
      const menu = '/menu-items/' + foodId;
      const publicUrl = 'http://' + config.storageEmulatorHost + '/v0/b/' + bucket.name + '/o/' + encodeURIComponent(path) + '?alt=media';
      assert.notEqual((await fetch(publicUrl)).status, 200);
      expect(await api(merchant, 'patch', menu, { expectedRevision: 3, imagePath: corrupt }), 'MEDIA_INVALID');
      expect(await api(merchant, 'patch', menu, { expectedRevision: 3, imagePath: foreign }), 'MEDIA_INVALID');
      const intent = randomUUID();
      const input = { expectedRevision: 3, imagePath: path, active: true };
      const response = await api(merchant, 'patch', menu, input, intent);
      const { revision } = data(response);
      const stored = await db.doc('menuItems/' + foodId).get();
      const published = stored.get('imagePath');
      images.push(published);
      assert.notEqual(path, published);
      const directUrl = 'http://' + config.storageEmulatorHost + '/v0/b/' + bucket.name + '/o/' + encodeURIComponent(published) + '?alt=media';
      assert.notEqual((await fetch(directUrl)).status, 200);
      assert.notEqual((await fetch(publicUrl)).status, 200);
      const picture = await request(app).get('/api/v1' + menu + '/image');
      assert.equal(picture.status, 200);
      assert.equal(picture.headers['content-type'], 'image/png');
      assert.equal(picture.headers['cache-control'], 'public, no-cache');
      assert.deepEqual(picture.body, image);
      const cached = await request(app).get('/api/v1' + menu + '/image').set('If-None-Match', picture.headers.etag);
      assert.equal(cached.status, 304);
      assert.equal(cached.text ?? '', '');
      const [meta] = await bucket.file(published).getMetadata();
      assert.equal(meta.metadata.foodId, foodId);
      assert.ok(!meta.metadata.firebaseStorageDownloadTokens);
      assert.equal((await api(merchant, 'patch', menu, input, intent)).body.meta.idempotencyReplayed, true);
      data(await api(merchant, 'patch', menu, { expectedRevision: revision, imagePath: null }));
      const removed = await request(app).get('/api/v1' + menu + '/image').set('If-None-Match', picture.headers.etag);
      assert.equal(removed.status, 404);
      assert.equal(removed.headers['cache-control'], 'no-store');
      assert.ok((await bucket.file(published).exists())[0], 'old attachment retained for snapshots/retention');
    });

    await t.test('approval is admin-only and authority changes invalidate old approvals', async () => {
      const approval = target + '/drivers/' + driver;
      assert.equal((await api(merchant, 'put', approval, { approved: true, active: true })).status, 403);
      data(await api(admin, 'put', approval, { approved: true, active: true }));
      assert.deepEqual(data(await api(merchant, 'get', target + '/drivers')).rows.map(row => row.id), [driver]);
      await user(driver).update({ activeOrderCount: 1 });
      expect(await api(admin, 'put', approval, { approved: false, active: false }), 'ACTIVE_ORDER_CONFLICT');
      const edit = '/admin/users/' + driver;
      expect(await api(admin, 'patch', edit, { expectedRole: 'driver', expectedActive: true, active: false }), 'ACTIVE_ORDER_CONFLICT');
      await user(driver).update({ activeOrderCount: 0 });
      data(await api(admin, 'patch', edit, { expectedRole: 'driver', expectedActive: true, active: false }));
      data(await api(admin, 'patch', edit, { expectedRole: 'driver', expectedActive: false, active: true }));
      assert.equal(data(await api(merchant, 'get', target + '/drivers')).rows.length, 0);
      const orderRef = db.doc('orders/' + id('assign'));
      written.add(orderRef.path);
      await orderRef.set({ customerUid: customer, shopId: shop.id, status: 'ACCEPTED', driverUid: null,
        statusVersion: 2, assignmentStatus: 'UNASSIGNED', assignmentVersion: 0, activeParticipantUids: [customer, merchant],
        paymentMethod: 'COD', paymentStatus: 'UNPAID', currency: 'VND', subtotalVnd: 44000, grandTotalVnd: 49000,
        discountVnd: 0, deliveryFeeVnd: 5000, amountDueVnd: 49000, stockReservation: 'RESERVED', voucherReservation: 'NONE',
        createdAt: now, updatedAt: now, items: [{ lineId: 'line-1', foodId, nameSnapshot: 'Món cũ', unitPriceVnd: 44000,
          quantity: 1, lineTotalVnd: 44000, optionsSnapshot: [] }] });
      const assign = '/orders/' + orderRef.id + '/assign-driver';
      const payload = { driverUid: driver, expectedStatusVersion: 2, expectedAssignmentVersion: 0 };
      expect(await api(merchant, 'post', assign, payload), 'DRIVER_NOT_APPROVED');
      assert.equal((await api(other, 'post', assign, payload)).status, 404);
      data(await api(admin, 'put', approval, { approved: true, active: true }));
      assert.equal(data(await api(merchant, 'post', assign, payload)).assignmentStatus, 'ASSIGNED');
      assert.equal((await orderRef.get()).get('status'), 'ACCEPTED');
      expect(await api(admin, 'put', approval, { approved: false, active: false }), 'ACTIVE_ORDER_CONFLICT');
    });

    await t.test('admin DTO filters and concurrent authority updates preserve one active admin', async () => {
      assert.equal((await api(customer, 'get', '/admin/users')).status, 403);
      const result = data(await api(admin, 'get', '/admin/users?role=merchant&active=true&q=' + encodeURIComponent('Người thử')));
      assert.equal(result.rows.filter(row => row.id.startsWith(prefix)).length, 2);
      assert.equal(result.rows[0].internal, undefined);
      const dto = data(await api(admin, 'get', '/admin/users/' + merchant));
      assert.deepEqual(dto.shops.map(row => row.id), [shop.id]);
      assert.equal(dto.phone, undefined);
      expect(await api(admin, 'patch', '/admin/users/' + admin,
        { expectedRole: 'admin', expectedActive: true, active: false }), 'LAST_ADMIN');
      expect(await api(admin, 'patch', '/admin/users/' + merchant,
        { expectedRole: 'merchant', expectedActive: true, role: 'customer' }), 'SHOP_OWNER_CONFLICT');
      data(await api(admin, 'patch', '/admin/users/' + deputy,
        { expectedRole: 'customer', expectedActive: true, role: 'admin' }));
      const lock = { expectedRole: 'admin', expectedActive: true, active: false };
      const concurrent = await Promise.all([
        api(admin, 'patch', '/admin/users/' + deputy, lock), api(deputy, 'patch', '/admin/users/' + admin, lock),
      ]);
      assert.deepEqual(concurrent.map(row => row.status).sort(), [200, 403]);
      const remaining = (await registry.get()).data().activeAdminUids;
      assert.equal(remaining.length, 1);
      assert.equal((await user(remaining[0]).get()).get('active'), true);
      assert.equal((await db.collection('adminAudit').where('action', '==', 'USER_AUTHORITY_UPDATED').get()).docs
        .filter(doc => people.includes(doc.get('targetUid'))).length, 4);
    });

    await t.test('day boundary separates created count and settled COD, independent of page size', async () => {
      const day = '2026-01-02';
      const start = Date.parse('2026-01-01T17:00:00Z'), end = start + 86400000;
      const entries = [
        [start - 1, start, 'COMPLETED', 'COD_CONFIRMED', 50000],
        [start, null, 'PENDING', 'UNPAID', 0],
        [end - 1, null, 'CANCELLED', 'UNPAID', 0],
        [start + 1, start + 50, 'COMPLETED', 'UNPAID', 50000],
        [end, end, 'COMPLETED', 'COD_CONFIRMED', 90000],
        [start + 20, end - 1, 'COMPLETED', 'COD_CONFIRMED', 42000],
        ...Array.from({ length: 18 }, (_, i) => [start + 100 + i, null, 'PENDING', 'UNPAID', 0]),
      ];
      await Promise.all(entries.map(([createdAt, completedAt, status, paymentStatus, codCollectedVnd], i) => {
        const ref = db.doc('orders/' + id('report-' + i));
        written.add(ref.path);
        return ref.set({ shopId: shop.id, createdAt: new Date(createdAt), completedAt: completedAt == null ? null : new Date(completedAt),
          status, paymentStatus, codCollectedVnd, grandTotalVnd: 51000 });
      }));
      const path = target + '/reports/daily?day=' + day;
      const report = data(await api(merchant, 'get', path));
      assert.deepEqual([report.createdCount, report.completedCount, report.codVnd], [22, 2, 92000]);
      assert.equal(report.rows.length, 20);
      const next = data(await api(merchant, 'get', path + '&cursor=' + report.cursor));
      assert.equal(next.rows.length, 2);
      assert.equal(new Set([...report.rows, ...next.rows].map(row => row.id)).size, 22);
      assert.equal(next.codVnd, 92000);
      const pageOnlyPath = path + '&cursor=' + report.cursor + '&includeTotals=false';
      const pageOnly = data(await api(merchant, 'get', pageOnlyPath));
      assert.deepEqual(pageOnly, { day, timezone: 'Asia/Ho_Chi_Minh', rows: next.rows, cursor: next.cursor });
      expect(await api(merchant, 'get', path + '&includeTotals=false'), 'VALIDATION_ERROR');
      expect(await api(merchant, 'get', pageOnlyPath.replace(day, '2026-01-03')), 'CURSOR_INVALID');
      assert.equal((await api(other, 'get', pageOnlyPath)).status, 403);
      expect(await api(merchant, 'get', target + '/reports/daily?day=2026-02-31'), 'DATE_INVALID');
      expect(await api(merchant, 'get', target + '/reports/daily?day=2026-01-03&cursor=' + report.cursor), 'CURSOR_INVALID');
      assert.equal((await api(other, 'get', path)).status, 403);
    });
  } finally {
    for (const path of images) await bucket.file(path).delete({ ignoreNotFound: true });
    for (const path of written) await db.recursiveDelete(db.doc(path));
    const batch = db.batch();
    for (const uid of people) {
      const [ops, audits] = await Promise.all([
        db.collection('operations').where('uid', '==', uid).get(),
        db.collection('adminAudit').where('actorUid', '==', uid).get(),
      ]);
      [...ops.docs, ...audits.docs].forEach(doc => batch.delete(doc.ref));
    }
    const outbox = await db.collection('notificationOutbox').where('orderId', '==', id('assign')).get();
    outbox.docs.forEach(doc => batch.delete(doc.ref));
    batch.delete(registry).delete(category);
    await batch.commit();
    for (const ref of [shop, hiddenShop, ...people.map(user)]) await db.recursiveDelete(ref);
    await close();
  }
});
