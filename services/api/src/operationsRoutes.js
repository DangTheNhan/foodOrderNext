import { Router } from 'express';
import {
  adminPatchUserInputSchema, createMenuInputSchema, documentIdSchema, driverApprovalInputSchema, idempotencyKeySchema,
  opsCursorQuery, opsDailyQuery, opsUserQuery, patchMenuInputSchema, patchShopInputSchema, stockAdjustmentSchema, uidSchema,
} from '@foodordernext/contracts';
import { requireRoles, requireVerifiedEmail } from './auth.js';
import { parse } from './customer.js';
import { ApiError } from './errors.js';

const operators = ['merchant', 'admin'];
const admin = ['admin'];
const shopId = req => parse(documentIdSchema, req.params.shopId);
const foodId = req => parse(documentIdSchema, req.params.foodId);
const targetUid = req => parse(uidSchema, req.params.uid);
const actor = req => ({ uid: req.identity.uid, profile: req.profile });
const cursor = req => parse(opsCursorQuery, req.query).cursor;

export function operationsRoutes({ catalog, adminUsers }, { auth, active, success }) {
  const router = Router();

  function read(path, roles, get) {
    router.get(path, auth, active, requireVerifiedEmail, requireRoles(...roles), async (req, res) => {
      success(req, res, await get(req));
    });
  }
  function write(method, path, schema, roles, change, status = 200) {
    router[method](path, auth, active, requireVerifiedEmail, requireRoles(...roles), async (req, res) => {
      const key = idempotencyKeySchema.safeParse(req.get('Idempotency-Key'));
      if (!key.success) throw new ApiError(422, 'IDEMPOTENCY_KEY_REQUIRED', 'Cần Idempotency-Key hợp lệ.');
      const result = await change(req, key.data, parse(schema, req.body));
      success(req, res, result.data, result.replayed ? 200 : status, { idempotencyReplayed: result.replayed });
    });
  }

  read('/shops', operators, req => catalog.shops(actor(req), cursor(req)));
  read('/shops/:shopId', operators, req => catalog.shop(actor(req), shopId(req)));
  write('patch', '/shops/:shopId', patchShopInputSchema, operators,
    (req, key, input) => catalog.patchShop(req.identity.uid, shopId(req), key, input));
  read('/shops/:shopId/menu-items', operators, req => catalog.menu(actor(req), shopId(req), cursor(req)));
  router.get('/menu-items/:foodId/image', async (req, res) => {
    const image = await catalog.publicImage(foodId(req));
    res.set('Cache-Control', 'public, no-cache').type(image.contentType).send(image.bytes);
  });
  read('/menu-items/:foodId', operators, req => catalog.item(actor(req), foodId(req)));
  write('post', '/shops/:shopId/menu-items', createMenuInputSchema, operators,
    (req, key, input) => catalog.createMenu(req.identity.uid, shopId(req), key, input), 201);
  write('patch', '/menu-items/:foodId', patchMenuInputSchema, operators,
    (req, key, input) => catalog.patchMenu(actor(req), foodId(req), key, input));
  write('post', '/menu-items/:foodId/stock-adjustments', stockAdjustmentSchema, operators,
    (req, key, input) => catalog.stock(req.identity.uid, foodId(req), key, input));
  read('/shops/:shopId/drivers', operators, req => catalog.drivers(actor(req), shopId(req), cursor(req)));
  write('put', '/shops/:shopId/drivers/:uid', driverApprovalInputSchema, admin,
    (req, key, input) => catalog.approveDriver(req.identity.uid, shopId(req), targetUid(req), key, input));
  read('/shops/:shopId/reports/daily', operators, req => {
    const { day, cursor: next, includeTotals } = parse(opsDailyQuery, req.query);
    return adminUsers.daily(actor(req), shopId(req), day, next, includeTotals !== 'false');
  });
  read('/admin/users', admin, req => adminUsers.users(parse(opsUserQuery, req.query)));
  read('/admin/users/:uid', admin, req => adminUsers.user(targetUid(req)));
  write('patch', '/admin/users/:uid', adminPatchUserInputSchema, admin,
    (req, key, input) => adminUsers.patchUser(req.identity.uid, targetUid(req), key, input));
  return router;
}
