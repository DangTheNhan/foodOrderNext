import { Router } from 'express';
import {
  assignDriverInputSchema, assignmentVersionInputSchema, cancelOrderInputSchema, completeOrderInputSchema,
  createOrderInputSchema, deliveryLocationInputSchema, documentIdSchema, idempotencyKeySchema, pickupOrderInputSchema, quoteInputSchema,
  rejectOrderInputSchema, restaurantTransitionInputSchema, reviewInputSchema,
} from '@foodordernext/contracts';
import { requireRoles, requireVerifiedEmail } from './auth.js';
import { parse } from './customer.js';
import { ApiError } from './errors.js';

function intent(req) {
  const key = idempotencyKeySchema.safeParse(req.get('Idempotency-Key'));
  if (!key.success) throw new ApiError(422, 'IDEMPOTENCY_KEY_REQUIRED', 'Cần Idempotency-Key hợp lệ.');
  return key.data;
}

export function orderRoutes(repo, { auth, active, success }) {
  const router = Router();
  const privateRoute = [auth, active, requireVerifiedEmail];
  router.post('/quote', ...privateRoute, requireRoles('customer'), async (req, res) => {
    const result = await repo.quote(req.identity.uid, parse(quoteInputSchema, req.body));
    success(req, res, result);
  });
  router.post('/', ...privateRoute, requireRoles('customer'), async (req, res) => {
    const result = await repo.create(req.identity.uid, intent(req), parse(createOrderInputSchema, req.body));
    success(req, res, result.data, result.replayed ? 200 : 201, { idempotencyReplayed: result.replayed });
  });
  const commands = [
    ['cancel', cancelOrderInputSchema, ['customer']],
    ['reject', rejectOrderInputSchema, ['merchant', 'admin']],
    ['transitions', restaurantTransitionInputSchema, ['merchant']],
    ['assign-driver', assignDriverInputSchema, ['merchant', 'admin']],
    ['accept-assignment', assignmentVersionInputSchema, ['driver']],
    ['pickup', pickupOrderInputSchema, ['driver']],
    ['complete', completeOrderInputSchema, ['driver']],
  ];
  for (const [action, schema, roles] of commands) {
    router.post(`/:orderId/${action}`, ...privateRoute, requireRoles(...roles), async (req, res) => {
      const result = await repo.command(req.identity.uid, action, parse(documentIdSchema, req.params.orderId),
        intent(req), parse(schema, req.body), roles);
      success(req, res, result.data, 200, { idempotencyReplayed: result.replayed });
    });
  }
  router.post('/:orderId/location', ...privateRoute, requireRoles('driver'), async (req, res) => {
    const result = await repo.updateLocation(req.identity.uid, parse(documentIdSchema, req.params.orderId),
      parse(deliveryLocationInputSchema, req.body));
    success(req, res, result);
  });
  router.post('/:orderId/review', ...privateRoute, requireRoles('customer'), async (req, res) => {
    const result = await repo.review(req.identity.uid, parse(documentIdSchema, req.params.orderId),
      intent(req), parse(reviewInputSchema, req.body));
    success(req, res, result.data, result.replayed ? 200 : 201, { idempotencyReplayed: result.replayed });
  });
  return router;
}
