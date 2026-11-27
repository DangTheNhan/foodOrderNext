import { randomUUID } from 'node:crypto';
import express from 'express';
import { profileBootstrapInputSchema, profilePatchInputSchema, idempotencyKeySchema } from '@foodordernext/contracts';
import { ApiError, validationError } from './errors.js';
import { authenticate, requireActiveUser, requireVerifiedEmail } from './auth.js';
import { profileDto } from './users.js';
import { customerRoutes } from './customerRoutes.js';
import { orderRoutes } from './orderRoutes.js';
import { operationsRoutes } from './operationsRoutes.js';
import { chatRoutes, deliveryRoutes } from './realtimeRoutes.js';
import { aiRoutes } from './aiRoutes.js';

function parse(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) throw validationError(result.error);
  return result.data;
}

export function createApp({ verifyIdToken, userRepository, customerRepository, orderRepository, operations,
  orderChat, notificationDelivery, validateAvatar, ai, logger = console }) {
  if (typeof verifyIdToken !== 'function' || !userRepository) throw new Error('Auth verifier and user repository are required.');
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', false);
  app.use((req, res, next) => {
    req.traceId = randomUUID();
    res.set({ 'X-Request-ID': req.traceId, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    next();
  });
  const json = express.json({ limit: '16kb', strict: true });
  const lineItemsJson = express.json({ limit: '64kb', strict: true });
  const menuJson = express.json({ limit: '128kb', strict: true });
  app.use((req, res, next) => {
    const path = req.path.toLowerCase().replace(/\/$/, '');
    const hasLines = (req.method === 'PUT' && path === '/api/v1/me/cart')
      || (req.method === 'POST' && ['/api/v1/orders', '/api/v1/orders/quote'].includes(path));
    const hasOptions = (req.method === 'POST' && /^\/api\/v1\/shops\/[\w-]+\/menu-items$/.test(path))
      || (req.method === 'PATCH' && /^\/api\/v1\/menu-items\/[\w-]+$/.test(path));
    (hasOptions ? menuJson : hasLines ? lineItemsJson : json)(req, res, next);
  });
  const auth = authenticate(verifyIdToken);
  const active = requireActiveUser(userRepository);
  const success = (req, res, data, status = 200, extraMeta = {}) => res.status(status).json({ data, meta: { traceId: req.traceId, apiVersion: 'v1', ...extraMeta } });

  app.get('/health', (req, res) => success(req, res, { status: 'ok', service: 'foodordernext-api' }));
  app.post('/api/v1/me/bootstrap', auth, async (req, res) => {
    const input = parse(profileBootstrapInputSchema, req.body ?? {});
    const result = await userRepository.bootstrap(req.identity, input);
    success(req, res, profileDto(req.identity.uid, result.profile, req.identity.emailVerified), result.created ? 201 : 200, { created: result.created });
  });
  app.get('/api/v1/me', auth, active, (req, res) => success(req, res, profileDto(req.identity.uid, req.profile, req.identity.emailVerified)));
  app.patch('/api/v1/me', auth, active, requireVerifiedEmail, async (req, res) => {
    const patch = parse(profilePatchInputSchema, req.body);
    const keyResult = idempotencyKeySchema.safeParse(req.get('Idempotency-Key'));
    if (!keyResult.success) throw new ApiError(422, 'IDEMPOTENCY_KEY_REQUIRED', 'Cần Idempotency-Key hợp lệ (16–128 ký tự).');
    if (typeof patch.avatarPath === 'string') {
      if (!patch.avatarPath.startsWith(`users/${req.identity.uid}/avatars/`) || patch.avatarPath.split('/').length !== 4) throw new ApiError(422, 'MEDIA_INVALID', 'Ảnh không thuộc hồ sơ này.');
      if (typeof validateAvatar !== 'function') throw new ApiError(503, 'MEDIA_SERVICE_UNAVAILABLE', 'Chưa thể kiểm tra ảnh.');
      await validateAvatar(req.identity.uid, patch.avatarPath);
    }
    const result = await userRepository.patch(req.identity, patch, keyResult.data);
    success(req, res, profileDto(req.identity.uid, result.profile, req.identity.emailVerified), 200, { idempotencyReplayed: result.replayed });
  });
  if (customerRepository) app.use('/api/v1/me', customerRoutes(customerRepository, { auth, active, success }));
  if (notificationDelivery) app.use('/api/v1/me', deliveryRoutes(notificationDelivery, { auth, active, success }));
  if (orderChat) app.use('/api/v1/orders', chatRoutes(orderChat, { auth, active, success }));
  if (ai) app.use('/api/v1/ai', aiRoutes(ai, { auth, active, success }));
  if (orderRepository) app.use('/api/v1/orders', orderRoutes(orderRepository, { auth, active, success }));
  if (operations) app.use('/api/v1', operationsRoutes(operations, { auth, active, success }));
  app.use((_req, _res, next) => next(new ApiError(404, 'NOT_FOUND', 'Không tìm thấy endpoint.')));
  app.use((error, req, res, _next) => {
    let safeError = error;
    if (error.type === 'entity.parse.failed') safeError = new ApiError(400, 'INVALID_JSON', 'JSON không hợp lệ.');
    if (error.type === 'entity.too.large') safeError = new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Dữ liệu gửi quá lớn.');
    if (!(safeError instanceof ApiError)) {
      safeError = [4, 10, 14, 'aborted', 'unavailable', 'deadline-exceeded'].includes(error.code)
        ? new ApiError(503, 'DATA_SERVICE_UNAVAILABLE', 'Dịch vụ dữ liệu tạm thời không sẵn sàng.')
        : new ApiError(500, 'INTERNAL_ERROR', 'Không thể hoàn tất yêu cầu.');
    }
    if (safeError.status >= 500) logger.error?.({ event: 'api_error', traceId: req.traceId, code: safeError.code });
    res.status(safeError.status).json({ error: { code: safeError.code, message: safeError.message, ...(safeError.details ? { details: safeError.details } : {}) }, meta: { traceId: req.traceId, apiVersion: 'v1' } });
  });
  return app;
}
