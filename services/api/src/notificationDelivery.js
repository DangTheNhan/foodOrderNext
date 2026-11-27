import { Timestamp } from 'firebase-admin/firestore';
import { ApiError, requireValidProfile } from './errors.js';
import { digest } from './orderPricing.js';

const userRef = (db, uid) => db.collection('users').doc(uid);
const deviceRef = (db, uid, installationId) => userRef(db, uid).collection('devices').doc(installationId);
const installRef = (db, id) => db.collection('notificationInstallations').doc(id);
const tokenRef = (db, hash) => db.collection('notificationTokens').doc(hash);
const sameBinding = (a, b) => !!a && !!b && a.uid === b.uid && a.installationId === b.installationId && a.tokenHash === b.tokenHash;

export class NotificationDelivery {
  constructor(db) { this.db = db; }

  saveSettings(uid, settings) {
    return this.db.runTransaction(async tx => {
      const ref = userRef(this.db, uid);
      const profile = requireValidProfile((await tx.get(ref)).data());
      const next = { ...profile.settings, ...settings };
      tx.update(ref, { settings: next, updatedAt: Timestamp.now() });
      return next;
    });
  }

  markRead(uid, eventId) {
    return this.db.runTransaction(async tx => {
      const user = userRef(this.db, uid);
      const ref = user.collection('notifications').doc(eventId);
      const [profile, inbox] = await tx.getAll(user, ref);
      requireValidProfile(profile.data());
      if (!inbox.exists) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy thông báo.');
      const saved = inbox.get('readAt');
      const readAt = saved ?? Timestamp.now();
      if (!saved) tx.update(ref, { readAt });
      return { eventId, readAt: readAt.toDate().toISOString() };
    });
  }

  bind(uid, installationId, input) {
    return this.db.runTransaction(async tx => {
      const installation = installRef(this.db, installationId);
      const tokenHash = digest(input.token);
      const token = tokenRef(this.db, tokenHash);
      const [profile, installedDoc, tokenDoc] = await tx.getAll(userRef(this.db, uid), installation, token);
      requireValidProfile(profile.data());
      const installed = installedDoc.data(), tokenOwner = tokenDoc.data();
      const formerToken = installed && installed.tokenHash !== tokenHash ? await tx.get(tokenRef(this.db, installed.tokenHash)) : null;
      const formerInstall = tokenOwner && tokenOwner.installationId !== installationId
        ? await tx.get(installRef(this.db, tokenOwner.installationId)) : null;
      const now = Timestamp.now();
      const binding = { uid, installationId, tokenHash };
      for (const previous of [installed, tokenOwner]) {
        if (previous && (previous.uid !== uid || previous.installationId !== installationId)) {
          tx.delete(deviceRef(this.db, previous.uid, previous.installationId));
        }
      }
      if (formerToken && sameBinding(formerToken.data(), installed)) tx.delete(formerToken.ref);
      if (formerInstall && sameBinding(formerInstall.data(), tokenOwner)) tx.delete(formerInstall.ref);
      tx.set(installation, binding);
      tx.set(token, binding);
      tx.set(deviceRef(this.db, uid, installationId), { ...input, tokenHash, updatedAt: now, lastSeenAt: now });
      return { installationId, bound: true };
    });
  }

  async unbind(uid, installationId, expectedTokenHash) {
    await this.db.runTransaction(async tx => {
      const device = deviceRef(this.db, uid, installationId);
      const installed = installRef(this.db, installationId);
      const [doc, reg] = await tx.getAll(device, installed);
      if (!doc.exists || (expectedTokenHash && doc.get('tokenHash') !== expectedTokenHash)) return;
      const tokenHash = doc.get('tokenHash');
      const tokenDoc = tokenHash ? await tx.get(tokenRef(this.db, tokenHash)) : null;
      const binding = { uid, installationId, tokenHash };
      tx.delete(device);
      if (sameBinding(reg.data(), binding)) tx.delete(installed);
      if (tokenDoc && sameBinding(tokenDoc.data(), binding)) tx.delete(tokenDoc.ref);
    });
    return { installationId, bound: false };
  }

  async current(uid, doc) {
    const { tokenHash, token } = doc.data();
    if (typeof tokenHash !== 'string' || typeof token !== 'string' || digest(token) !== tokenHash) return false;
    const [reg, tokenDoc] = await this.db.getAll(installRef(this.db, doc.id), tokenRef(this.db, tokenHash));
    const binding = { uid, installationId: doc.id, tokenHash };
    return sameBinding(reg.data(), binding) && sameBinding(tokenDoc.data(), binding);
  }

  async devices(uid, since) {
    const q = await userRef(this.db, uid).collection('devices').where('lastSeenAt', '>=', since)
      .orderBy('lastSeenAt', 'desc').limit(10).get();
    const devices = await Promise.all(q.docs.map(async doc => {
      if (doc.get('notificationsEnabled') !== true || !await this.current(uid, doc)) return null;
      return { uid, installationId: doc.id, token: doc.get('token'), tokenHash: doc.get('tokenHash') };
    }));
    return devices.filter(Boolean);
  }
}
