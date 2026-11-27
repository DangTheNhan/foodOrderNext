import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { userDocumentSchema } from '@foodordernext/contracts';
import { ApiError, requireValidProfile } from './errors.js';

function parseProfile(value) {
  const parsed = userDocumentSchema.safeParse(value);
  if (!parsed.success) throw new ApiError(503, 'PROFILE_INVALID', 'Hồ sơ cần được kiểm tra.');
  return parsed.data;
}

function timestampIso(value) {
  return (value instanceof Date ? value : value.toDate()).toISOString();
}

export function profileDto(uid, value, emailVerified) {
  const profile = parseProfile(value);
  return {
    uid, displayName: profile.displayName, emailDisplay: profile.emailDisplay ?? null,
    phone: profile.phone ?? null, avatarPath: profile.avatarPath ?? null,
    role: profile.role, active: profile.active, activeOrderCount: profile.activeOrderCount,
    defaultAddressId: profile.defaultAddressId ?? null, settings: profile.settings,
    emailVerified: emailVerified === true,
    createdAt: timestampIso(profile.createdAt), updatedAt: timestampIso(profile.updatedAt),
  };
}

export function createCustomerProfile(identity, input, timestamp) {
  const tokenName = typeof identity.name === 'string' ? identity.name.trim().slice(0, 100) : '';
  return {
    displayName: input.displayName ?? (tokenName || 'Khách hàng'),
    emailDisplay: typeof identity.email === 'string' ? identity.email.slice(0, 254) : null,
    phone: null, avatarPath: null, role: 'customer', active: true, activeOrderCount: 0,
    defaultAddressId: null, settings: { notificationsEnabled: true },
    createdAt: timestamp, updatedAt: timestamp,
  };
}

export function patchOperation(identity, key, patch) {
  const routeKey = 'PATCH:/api/v1/me';
  return {
    id: createHash('sha256').update(JSON.stringify([identity.uid, routeKey, key])).digest('hex'),
    fingerprint: createHash('sha256').update(JSON.stringify(Object.entries(patch).sort(([a], [b]) => a.localeCompare(b)))).digest('hex'),
    routeKey,
  };
}

export class FirestoreUserRepository {
  constructor(firestore) { this.firestore = firestore; }

  async findByUid(uid) {
    const snapshot = await this.firestore.collection('users').doc(uid).get();
    return snapshot.exists ? parseProfile(snapshot.data()) : null;
  }

  async bootstrap(identity, input) {
    const reference = this.firestore.collection('users').doc(identity.uid);
    const created = await this.firestore.runTransaction(async transaction => {
      const snapshot = await transaction.get(reference);
      if (snapshot.exists) {
        requireValidProfile(parseProfile(snapshot.data()));
        return false;
      }
      transaction.create(reference, createCustomerProfile(identity, input, FieldValue.serverTimestamp()));
      return true;
    });
    const profile = requireValidProfile(await this.findByUid(identity.uid));
    return { profile, created };
  }

  async patch(identity, patch, idempotencyKey) {
    const operation = patchOperation(identity, idempotencyKey, patch);
    const reference = this.firestore.collection('users').doc(identity.uid);
    const operationReference = this.firestore.collection('operations').doc(operation.id);
    const replayed = await this.firestore.runTransaction(async transaction => {
      const [snapshot, existingOperation] = await Promise.all([transaction.get(reference), transaction.get(operationReference)]);
      const profile = requireValidProfile(snapshot.exists ? parseProfile(snapshot.data()) : null);
      if (existingOperation.exists) {
        if (existingOperation.data().requestFingerprint !== operation.fingerprint) throw new ApiError(409, 'IDEMPOTENCY_KEY_REUSED', 'Key đã được sử dụng cho dữ liệu khác.');
        return true;
      }
      const updatedAt = FieldValue.serverTimestamp();
      transaction.update(reference, { ...patch, updatedAt });
      transaction.create(operationReference, {
        uid: identity.uid, routeKey: operation.routeKey, requestFingerprint: operation.fingerprint,
        resourceId: identity.uid, resultSummary: { uid: identity.uid }, createdAt: updatedAt,
      });
      return false;
    });
    // Return the current projection, never replay an old role/active snapshot.
    return { profile: requireValidProfile(await this.findByUid(identity.uid)), replayed };
  }
}
