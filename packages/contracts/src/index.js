import { z } from 'zod';

export const ROLES = Object.freeze(['customer', 'merchant', 'driver', 'admin']);
export const ORDER_STATUSES = Object.freeze(['PENDING', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'DELIVERING', 'COMPLETED', 'CANCELLED', 'REJECTED']);
export const ASSIGNMENT_STATUSES = Object.freeze(['UNASSIGNED', 'ASSIGNED', 'ACCEPTED']);
export const CURRENCY = 'VND';
export const MAX_ORDER_LINES = 20;
export const MAX_QUANTITY_PER_LINE = 99;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_CONTENT_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);
export const roleSchema = z.enum(ROLES);
export const orderStatusSchema = z.enum(ORDER_STATUSES);
export const assignmentStatusSchema = z.enum(ASSIGNMENT_STATUSES);
export const uidSchema = z.string().min(1).max(128).refine(value => !value.includes('/'), 'UID must be a document ID');
export const documentIdSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
export const quantitySchema = z.number().int().min(1).max(MAX_QUANTITY_PER_LINE);
export const moneyVndSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const counterSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const isoTimestampSchema = z.string().datetime({ offset: true });
export const firestoreTimestampSchema = z.custom(value => value instanceof Date || (value != null && typeof value.toDate === 'function'), 'Expected a Firestore Timestamp or Date');
export const settingsSchema = z.object({ notificationsEnabled: z.boolean() }).strict();
export const displayNameSchema = z.string().trim().min(1).max(100);
export const phoneSchema = z.string().trim().min(6).max(25).regex(/^[+0-9 ()-]+$/);
export const storagePathSchema = z.string().min(1).max(512).refine(value => !value.includes('://') && !value.includes('..') && !value.startsWith('/') && !value.endsWith('/'), 'Expected a storage object path');

export const profileBootstrapInputSchema = z.object({ displayName: displayNameSchema.optional() }).strict();
export const profilePatchInputSchema = z.object({
  displayName: displayNameSchema.optional(),
  phone: phoneSchema.nullable().optional(),
  avatarPath: storagePathSchema.nullable().optional(),
}).strict().refine(value => Object.keys(value).length > 0, 'Provide at least one profile field');
export const idempotencyKeySchema = z.string().min(16).max(128).regex(/^[A-Za-z0-9._:-]+$/);
export const emptyInputSchema = z.strictObject({});
export const clearCartInputSchema = z.strictObject({ expectedCartVersion: counterSchema });

// Persistence can carry seed/migration metadata. API inputs are strict and DTOs
// select fields explicitly; extra persisted metadata is never spread to clients.
export const userDocumentSchema = z.object({
  displayName: displayNameSchema,
  emailDisplay: z.string().max(254).nullable().optional(),
  phone: phoneSchema.nullable().optional(),
  avatarPath: storagePathSchema.nullable().optional(),
  role: roleSchema,
  active: z.boolean(),
  activeOrderCount: counterSchema.default(0),
  defaultAddressId: documentIdSchema.nullable().optional(),
  settings: settingsSchema.default({ notificationsEnabled: true }),
  createdAt: firestoreTimestampSchema,
  updatedAt: firestoreTimestampSchema,
}).passthrough();

export const coordinatesSchema = z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) }).strict();
const addressFields = z.object({ label: z.string().trim().min(1).max(40), receiverName: displayNameSchema, phone: phoneSchema, addressText: z.string().trim().min(5).max(500), location: coordinatesSchema.nullable().optional(), locationSource: z.enum(['GPS', 'MANUAL']) }).strict();
export const addressInputSchema = addressFields.refine(value => value.locationSource !== 'GPS' || value.location != null, 'GPS requires coordinates');
export const addressPatchInputSchema = addressFields.partial().extend({ makeDefault: z.literal(true).optional() }).refine(value => Object.keys(value).length > 0, 'Provide at least one address field');
export const cartLineSchema = z.object({ foodId: documentIdSchema, quantity: quantitySchema, optionIds: z.array(documentIdSchema).max(20).default([]) }).strict();
function uniqueLines(cart, ctx) {
  const seen = new Set();
  cart.items.forEach((line, index) => {
    const key = JSON.stringify([line.foodId, [...line.optionIds].sort()]);
    if (seen.has(key) || new Set(line.optionIds).size !== line.optionIds.length) ctx.addIssue({ code: 'custom', path: ['items', index], message: 'Duplicate cart line or option' });
    seen.add(key);
  });
}
export const cartInputSchema = z.object({ shopId: documentIdSchema, items: z.array(cartLineSchema).max(MAX_ORDER_LINES), expectedCartVersion: counterSchema }).strict().superRefine(uniqueLines);
const quoteFields = z.strictObject({
  shopId: documentIdSchema,
  items: z.array(cartLineSchema).min(1).max(MAX_ORDER_LINES),
  addressId: documentIdSchema,
  voucherCode: z.string().trim().min(1).max(40).optional(),
});
export const quoteInputSchema = quoteFields.superRefine(uniqueLines);
export const createOrderInputSchema = quoteFields.extend({
  note: z.string().trim().max(500).default(''),
  paymentMethod: z.literal('COD'),
  expectedGrandTotalVnd: moneyVndSchema,
  expectedCartVersion: counterSchema.optional(),
  expectedQuoteKey: z.string().regex(/^[a-f0-9]{64}$/).optional(),
}).superRefine(uniqueLines);
const statusCommand = z.strictObject({ expectedStatusVersion: counterSchema.min(1) });
const reasonCodeSchema = z.string().regex(/^[A-Z0-9_]{1,40}$/);
export const cancelOrderInputSchema = statusCommand.extend({ reasonCode: reasonCodeSchema.optional() });
export const rejectOrderInputSchema = statusCommand.extend({ reasonCode: reasonCodeSchema });
export const restaurantTransitionInputSchema = statusCommand.extend({
  targetStatus: z.enum(['ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP']),
});
export const assignmentVersionInputSchema = z.strictObject({ expectedAssignmentVersion: counterSchema });
export const pickupOrderInputSchema = statusCommand.extend(assignmentVersionInputSchema.shape);
export const assignDriverInputSchema = pickupOrderInputSchema.extend({ driverUid: uidSchema });
export const completeOrderInputSchema = pickupOrderInputSchema.extend({ codCollectedVnd: moneyVndSchema });
export const deliveryLocationInputSchema = coordinatesSchema.extend({
  accuracyMeters: z.number().min(0).max(5000),
  recordedAt: isoTimestampSchema,
  sequence: counterSchema.min(1),
  expectedAssignmentVersion: counterSchema.min(1),
});
export const menuAssistantInputSchema = z.strictObject({
  shopId: documentIdSchema,
  requestText: z.string().trim().min(1).max(1000),
  budgetVnd: moneyVndSchema.min(1).optional(),
  diners: z.number().int().min(1).max(12).default(1),
  preferences: z.array(z.enum(['VALUE', 'VARIETY'])).max(2).default([])
    .refine(values => new Set(values).size === values.length),
});
export const reviewInsightsInputSchema = z.strictObject({
  shopId: documentIdSchema,
  startInclusive: isoTimestampSchema.optional(),
  endExclusive: isoTimestampSchema.optional(),
}).refine(input => Boolean(input.startInclusive) === Boolean(input.endExclusive),
  'Provide both interval boundaries or neither');

const menuReasonSchema = z.enum(['REQUEST_MATCH', 'VALUE', 'VARIETY']);
export const menuModelSchema = z.strictObject({
  suggestions: z.array(z.strictObject({
    foodId: documentIdSchema, optionIds: z.array(documentIdSchema).max(20),
    quantity: z.number().int().min(1).max(12),
    reason: menuReasonSchema,
  })).min(1).max(12),
});
export const menuSelectionSchema = planIds => z.strictObject({ planId: z.enum(planIds), reason: menuReasonSchema });
export const reviewTopicSchema = z.enum(['FOOD', 'SERVICE', 'SPEED', 'VALUE', 'PACKAGING', 'OTHER']);
export const reviewSelectionSchema = focusIds => z.strictObject({ focusId: z.enum(focusIds) });
export const reviewModelSchema = z.strictObject({
  themes: z.array(z.strictObject({
    topic: reviewTopicSchema,
    evidenceReviewIds: z.array(z.string().regex(/^r[1-9][0-9]{0,2}$/)).min(1).max(6),
  })).min(1).max(6),
});
export function modelJsonSchema(schema) {
  const { $schema, ...format } = z.toJSONSchema(schema);
  return format;
}
export const shopDocumentSchema = z.object({ ownerUid: uidSchema, name: displayNameSchema, active: z.boolean(), acceptingOrders: z.boolean(), activeOrderCount: counterSchema, deliveryFeeVnd: moneyVndSchema, ratingSum: counterSchema, ratingCount: counterSchema, ratingAverage: z.number().min(0).max(5) }).passthrough();
export const menuItemDocumentSchema = z.object({ shopId: documentIdSchema, categoryId: documentIdSchema, name: displayNameSchema, nameKey: z.string().min(1).max(100), priceVnd: moneyVndSchema, currency: z.literal(CURRENCY), active: z.boolean(), availablePortions: counterSchema, reservedPortions: counterSchema, soldPortions: counterSchema, revision: counterSchema }).passthrough();
export const orderItemSnapshotSchema = z.object({ lineId: documentIdSchema, foodId: documentIdSchema, nameSnapshot: displayNameSchema, unitPriceVnd: moneyVndSchema, quantity: quantitySchema, optionsSnapshot: z.array(z.object({ id: documentIdSchema, name: displayNameSchema, priceDeltaVnd: moneyVndSchema }).strict()).max(20), lineTotalVnd: moneyVndSchema, imagePathSnapshot: storagePathSchema.nullable().optional() }).strict();
export const orderDocumentSchema = z.object({ customerUid: uidSchema, shopId: documentIdSchema, driverUid: uidSchema.nullable(), status: orderStatusSchema, statusVersion: z.number().int().positive(), assignmentStatus: assignmentStatusSchema, assignmentVersion: counterSchema, items: z.array(orderItemSnapshotSchema).min(1).max(MAX_ORDER_LINES), currency: z.literal(CURRENCY), subtotalVnd: moneyVndSchema, discountVnd: moneyVndSchema, deliveryFeeVnd: moneyVndSchema, grandTotalVnd: moneyVndSchema, amountDueVnd: moneyVndSchema, paymentMethod: z.literal('COD'), paymentStatus: z.enum(['UNPAID', 'COD_CONFIRMED']), stockReservation: z.enum(['RESERVED', 'RELEASED', 'CONSUMED']), voucherReservation: z.enum(['NONE', 'RESERVED', 'RELEASED', 'REDEEMED']) }).passthrough().superRefine((order, ctx) => {
  if (order.status === 'COMPLETED' && order.paymentStatus !== 'COD_CONFIRMED') ctx.addIssue({ code: 'custom', path: ['paymentStatus'], message: 'COMPLETED requires COD confirmation' });
});
export const reviewInputSchema = z.object({ rating: z.number().int().min(1).max(5), text: z.string().trim().min(1).max(3000), imagePaths: z.array(storagePathSchema).max(3).default([]) }).strict();
export const messageInputSchema = z.object({ clientMessageId: documentIdSchema, text: z.string().trim().min(1).max(2000) }).strict();
export const outboxDocumentSchema = z.object({ type: z.string().min(1).max(80), orderId: documentIdSchema, recipientUids: z.array(uidSchema).min(1).max(4), status: z.enum(['PENDING', 'PROCESSING', 'RETRY', 'SENT', 'FAILED', 'SKIPPED']), attempts: counterSchema }).passthrough();
export const installationIdSchema = z.string().regex(/^[A-Za-z0-9-]{24,128}$/);
export const deviceInputSchema = z.strictObject({
  token: z.string().min(24).max(4096).regex(/^[A-Za-z0-9_.:-]+$/),
  platform: z.enum(['android', 'ios']),
  notificationsEnabled: z.boolean(),
});
export const normalizeNameKey = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().trim().replace(/\s+/g, ' ');
export const optionGroupsSchema = z.array(z.object({
  id: documentIdSchema,
  name: displayNameSchema,
  minSelections: counterSchema,
  maxSelections: counterSchema,
  options: z.array(z.object({ id: documentIdSchema, name: displayNameSchema, priceDeltaVnd: moneyVndSchema })).min(1).max(20),
}).refine(group => group.minSelections <= group.maxSelections && group.maxSelections <= group.options.length)).max(10)
  .refine(groups => {
    const ids = groups.flatMap(group => group.options.map(option => option.id));
    return new Set(ids).size === ids.length && new Set(groups.map(group => group.id)).size === groups.length;
  }, 'Option IDs must be unique within a food');

const catalogFields = z.strictObject({
  name: displayNameSchema,
  description: z.string().trim().max(2000),
  categoryId: documentIdSchema,
  priceVnd: moneyVndSchema,
  active: z.boolean(),
  optionGroups: optionGroupsSchema,
});
export const createMenuInputSchema = catalogFields.extend({ initialAvailablePortions: counterSchema.max(1000000) });
export const patchMenuInputSchema = catalogFields.partial().extend({
  expectedRevision: counterSchema,
  imagePath: storagePathSchema.nullable().optional(),
}).refine(input => Object.keys(input).length > 1, 'Provide a field to edit');
export const stockAdjustmentSchema = z.strictObject({
  expectedRevision: counterSchema, deltaAvailablePortions: z.number().int().min(-1000000).max(1000000).refine(delta => delta !== 0),
  reason: z.string().trim().min(2).max(160),
});
export const patchShopInputSchema = z.strictObject({
  name: displayNameSchema.optional(),
  addressText: z.string().trim().min(5).max(500).optional(),
  location: coordinatesSchema.nullable().optional(),
  acceptingOrders: z.boolean().optional(),
  deliveryFeeVnd: moneyVndSchema.optional(),
  openingHours: z.strictObject({ label: z.string().trim().min(1).max(150) }).optional(),
}).refine(input => Object.keys(input).length > 0, 'Provide a field to edit');
export const driverApprovalInputSchema = z.strictObject({ approved: z.boolean(), active: z.boolean() })
  .refine(input => input.approved || !input.active, 'Active approval must be approved');
export const adminPatchUserInputSchema = z.strictObject({
  expectedRole: roleSchema,
  expectedActive: z.boolean(),
  role: roleSchema.optional(),
  active: z.boolean().optional(),
}).refine(input => input.role !== undefined || input.active !== undefined, 'Provide a field to edit');
export const opsCursorQuery = z.strictObject({ cursor: z.string().min(1).max(1500).regex(/^[A-Za-z0-9_-]+$/).optional() });
export const opsDailyQuery = opsCursorQuery.extend({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  includeTotals: z.enum(['true', 'false']).optional(),
}).refine(query => query.includeTotals !== 'false' || Boolean(query.cursor), {
  path: ['cursor'], message: 'Trang chỉ lấy danh sách đơn cần cursor.',
});
export const opsUserQuery = opsCursorQuery.extend({
  role: roleSchema.optional(), active: z.enum(['true', 'false']).transform(value => value === 'true').optional(),
  q: z.string().trim().min(1).max(100).optional(),
});
