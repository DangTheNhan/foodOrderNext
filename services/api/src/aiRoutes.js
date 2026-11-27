import { Router } from 'express';
import { menuAssistantInputSchema, reviewInsightsInputSchema } from '@foodordernext/contracts';
import { requireRoles, requireVerifiedEmail } from './auth.js';
import { parse } from './customer.js';

export function aiRoutes(service, { auth, active, success }) {
  const router = Router();
  const policy = [auth, active, requireVerifiedEmail];
  router.post('/menu-assistant', ...policy, requireRoles('customer'), async (req, res) => {
    success(req, res, await service.menu(req.identity.uid, parse(menuAssistantInputSchema, req.body), req.traceId));
  });
  router.post('/review-insights', ...policy, requireRoles('merchant', 'admin'), async (req, res) => {
    success(req, res, await service.reviews(req.identity.uid, parse(reviewInsightsInputSchema, req.body), req.traceId));
  });
  return router;
}
