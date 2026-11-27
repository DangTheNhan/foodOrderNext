import { Router } from 'express';
import {
  addressInputSchema, addressPatchInputSchema, documentIdSchema,
  idempotencyKeySchema, emptyInputSchema, clearCartInputSchema, cartInputSchema,
} from '@foodordernext/contracts';
import { requireRoles, requireVerifiedEmail } from './auth.js';
import { parse } from './customer.js';
import { ApiError } from './errors.js';

export function customerRoutes(repository, { auth, active, success }) {
  const router = Router();

  function route(method, path, parseInput, apply, status = 200) {
    router[method](path, auth, active, requireVerifiedEmail, requireRoles('customer'), async (req, res) => {
      const key = idempotencyKeySchema.safeParse(req.get('Idempotency-Key'));
      if (!key.success) throw new ApiError(422, 'IDEMPOTENCY_KEY_REQUIRED', 'Cần Idempotency-Key hợp lệ.');
      const id = req.params.id === undefined ? null : parse(documentIdSchema, req.params.id);
      const input = parse(parseInput ?? emptyInputSchema, req.body ?? {});
      const result = await repository.mutate(req.identity.uid, [method, path].join(':'),
        key.data, { id, input }, (tx, user, profile) => apply(tx, user, profile, id, input));
      success(req, res, result.data, result.replayed ? 200 : status, { idempotencyReplayed: result.replayed });
    });
  }

  route('put', '/cart', cartInputSchema, (tx, user, _, __, input) => repository.putCart(tx, user, input));
  route('delete', '/cart', clearCartInputSchema,
    (tx, user, _, __, input) => repository.clearCart(tx, user, input.expectedCartVersion));
  route('post', '/addresses', addressInputSchema,
    (tx, user, profile, _, input) => repository.createAddress(tx, user, profile, input), 201);
  route('patch', '/addresses/:id', addressPatchInputSchema,
    (tx, user, _, id, input) => repository.patchAddress(tx, user, id, input));
  route('delete', '/addresses/:id', null, (tx, user, profile, id) => repository.deleteAddress(tx, user, profile, id));
  route('put', '/favorites/:id', null, (tx, user, _, id) => repository.favorite(tx, user, id, true));
  route('delete', '/favorites/:id', null, (tx, user, _, id) => repository.favorite(tx, user, id, false));
  return router;
}
