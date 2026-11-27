import { Router } from 'express';
import { documentIdSchema, messageInputSchema, idempotencyKeySchema, deviceInputSchema, installationIdSchema, settingsSchema,
  emptyInputSchema } from '@foodordernext/contracts';
import { requireVerifiedEmail } from './auth.js';
import { parse } from './customer.js';
import { ApiError } from './errors.js';

export function chatRoutes(repo, { auth, active, success }) {
  const router = Router();
  router.get('/:orderId/access', auth, active, requireVerifiedEmail, async (req, res) => {
    success(req, res, await repo.access(req.identity.uid, parse(documentIdSchema, req.params.orderId)));
  });
  router.post('/:orderId/messages', auth, active, requireVerifiedEmail, async (req, res) => {
    const key = idempotencyKeySchema.safeParse(req.get('Idempotency-Key'));
    if (!key.success) throw new ApiError(422, 'IDEMPOTENCY_KEY_REQUIRED', 'Cần Idempotency-Key hợp lệ.');
    const result = await repo.send(req.identity.uid, parse(documentIdSchema, req.params.orderId),
      key.data, parse(messageInputSchema, req.body));
    success(req, res, result.data, result.replayed ? 200 : 201, { idempotencyReplayed: result.replayed });
  });
  return router;
}

export function deliveryRoutes(repo, { auth, active, success }) {
  const router = Router();
  router.patch('/settings', auth, active, requireVerifiedEmail, async (req, res) => {
    success(req, res, await repo.saveSettings(req.identity.uid, parse(settingsSchema, req.body)));
  });
  router.put('/devices/:installationId', auth, active, requireVerifiedEmail, async (req, res) => {
    success(req, res, await repo.bind(req.identity.uid,
      parse(installationIdSchema, req.params.installationId), parse(deviceInputSchema, req.body)));
  });
  router.delete('/devices/:installationId', auth, active, requireVerifiedEmail, async (req, res) => {
    parse(emptyInputSchema, req.body ?? {});
    success(req, res, await repo.unbind(req.identity.uid, parse(installationIdSchema, req.params.installationId)));
  });
  router.post('/notifications/:eventId/read', auth, active, requireVerifiedEmail, async (req, res) => {
    parse(emptyInputSchema, req.body ?? {});
    success(req, res, await repo.markRead(req.identity.uid, parse(documentIdSchema, req.params.eventId)));
  });
  return router;
}
