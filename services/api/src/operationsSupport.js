import { FieldPath, Timestamp } from 'firebase-admin/firestore';
import { digest } from './orderPricing.js';
import { ApiError, requireValidProfile } from './errors.js';
import { assertShopOwner } from './auth.js';

export const notFound = () => new ApiError(404, 'NOT_FOUND', 'Không tìm thấy dữ liệu.');
export const activeOrderConflict = () => new ApiError(409, 'ACTIVE_ORDER_CONFLICT', 'Tài khoản còn đơn đang xử lý.');
export const userRef = (db, uid) => db.collection('users').doc(uid);
export const shopRef = (db, id) => db.collection('shops').doc(id);

export function assertRole(profile, roles) {
  if (!roles.includes(profile.role)) throw new ApiError(403, 'FORBIDDEN', 'Vai trò không có quyền thực hiện.');
}

export async function scopedShop(db, tx, actor, id) {
  const ref = shopRef(db, id);
  const snapshot = tx ? await tx.get(ref) : await ref.get();
  if (!snapshot.exists) throw notFound();
  assertShopOwner(actor, snapshot.data());
  return snapshot;
}

export async function mutation(db, uid, route, key, input, roles, execute) {
  const operation = db.collection('operations').doc(digest([uid, route, key]));
  const fingerprint = digest(input);
  return db.runTransaction(async tx => {
    const [user, previous] = await tx.getAll(userRef(db, uid), operation);
    const profile = requireValidProfile(user.data());
    assertRole(profile, roles);
    if (previous.exists) {
      const op = previous.data();
      if (op.requestFingerprint !== fingerprint) throw new ApiError(409, 'IDEMPOTENCY_KEY_REUSED', 'Key đã dùng với dữ liệu khác.');
      if (op.role !== profile.role) throw notFound();
      return { data: op.resultSummary, replayed: true };
    }
    const now = Timestamp.now();
    const data = await execute(tx, { uid, profile }, now, operation.id);
    tx.create(operation, { uid, routeKey: route, role: profile.role, requestFingerprint: fingerprint, resultSummary: data, createdAt: now });
    return { data, replayed: false };
  });
}

export function audit(db, tx, id, actor, action, details, now) {
  tx.create(db.collection('adminAudit').doc(id), { actorUid: actor.uid, actorRole: actor.profile.role, action, ...details, createdAt: now });
}

const pageSize = 20;

export async function queryPage(query, { field, direction = 'asc', cursor, scope, map, timestamp = false, tx }) {
  let ordered = field ? query.orderBy(field, direction) : query;
  ordered = ordered.orderBy(FieldPath.documentId(), direction);
  if (cursor) ordered = ordered.startAfter(...readCursor(cursor, scope, field, timestamp));
  const limited = ordered.limit(pageSize + 1);
  const result = tx ? await tx.get(limited) : await limited.get();
  const page = result.docs.slice(0, pageSize);
  const last = page.at(-1);
  let next = null;
  if (result.docs.length > pageSize) {
    const value = field ? last.get(field) : null;
    const key = timestamp ? [value.seconds, value.nanoseconds] : value;
    next = Buffer.from(JSON.stringify({ id: last.id, key, scope })).toString('base64url');
  }
  return { rows: page.map(map), cursor: next };
}

function readCursor(cursor, scope, field, timestamp) {
  try {
    const { id, key, scope: given } = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (given !== scope || typeof id !== 'string' || !id || id.includes('/') || id.length > 128) throw new Error();
    if (!field) return [id];
    if (timestamp) {
      if (!Array.isArray(key) || key.length !== 2 || !key.every(Number.isInteger)) throw new Error();
      return [new Timestamp(...key), id];
    }
    if (typeof key !== 'string' || key.length > 256) throw new Error();
    return [key, id];
  } catch {
    throw new ApiError(422, 'CURSOR_INVALID', 'Trang tiếp theo không hợp lệ. Hãy tải lại danh sách.');
  }
}

export function dayWindow(day) {
  const start = new Date(day + 'T00:00:00+07:00');
  const end = new Date(start.getTime() + 86400000);
  const atLocalMidnight = new Date(start.getTime() + 7 * 3600000);
  if (!Number.isFinite(start.getTime()) || atLocalMidnight.toISOString().slice(0, 10) !== day
    || !Number.isFinite(end.getTime())) {
    throw new ApiError(422, 'DATE_INVALID', 'Chọn ngày hợp lệ theo định dạng YYYY-MM-DD.');
  }
  return { start, end };
}
