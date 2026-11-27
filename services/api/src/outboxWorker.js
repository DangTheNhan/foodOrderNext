import { randomUUID } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { outboxDocumentSchema } from '@foodordernext/contracts';
import { canViewOrder } from './orderChat.js';

const active = ['PENDING', 'RETRY', 'PROCESSING'];
const invalidToken = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token']);
const permanent = new Set(['messaging/mismatched-credential', 'messaging/invalid-argument', 'messaging/third-party-auth-error',
  'messaging/invalid-apns-credentials', 'messaging/authentication-error', 'messaging/invalid-recipient']);
const maxAttempts = 5;
const leaseDurationMs = 60000;
const thirtyDays = 30 * 86400000;
const nowStamp = clock => Timestamp.fromMillis(clock());
const safeCode = error => /^messaging\/[a-z0-9-]{1,70}$/.test(error?.code ?? '') ? error.code : 'DELIVERY_ERROR';
const flag = stamp => stamp?.toMillis?.() ?? 0;

function pushPayload(eventId, job) {
  return {
    data: { eventId, orderId: job.orderId },
    notification: { title: 'FoodOrderNext', body: 'Có cập nhật đơn hàng. Mở ứng dụng để xem.' },
    android: { priority: 'normal', notification: { tag: eventId, channelId: 'order-updates' } },
  };
}

export class OutboxWorker {
  constructor({ db, delivery, send, clock = Date.now, workerId = randomUUID() }) {
    this.db = db;
    this.delivery = delivery;
    this.send = send;
    this.clock = clock;
    this.workerId = workerId;
  }

  async claim(ref) {
    return this.db.runTransaction(async tx => {
      const stored = (await tx.get(ref)).data();
      const now = nowStamp(this.clock);
      if (!stored || !active.includes(stored.status) || flag(stored.nextAttemptAt) > now.toMillis()
        || (stored.status === 'PROCESSING' && flag(stored.leaseUntil) > now.toMillis())) return null;
      const job = outboxDocumentSchema.safeParse(stored);
      if (!job.success || stored.attempts >= maxAttempts) {
        tx.update(ref, { status: 'FAILED', lastErrorCode: job.success ? 'RETRY_EXHAUSTED' : 'INVALID_JOB',
          leaseOwner: null, leaseId: null, leaseUntil: null, finishedAt: now });
        return null;
      }
      const leaseId = randomUUID();
      const leaseUntil = Timestamp.fromMillis(now.toMillis() + leaseDurationMs);
      const attempts = stored.attempts + 1;
      tx.update(ref, { status: 'PROCESSING', attempts, leaseOwner: this.workerId, leaseId, leaseUntil, nextAttemptAt: leaseUntil });
      return { ...job.data, attempts, leaseId };
    });
  }

  async finish(ref, claim, patch) {
    return this.db.runTransaction(async tx => {
      const job = (await tx.get(ref)).data();
      if (job?.status !== 'PROCESSING' || job.leaseId !== claim.leaseId || job.leaseOwner !== this.workerId) return false;
      tx.update(ref, { ...patch, leaseOwner: null, leaseId: null, leaseUntil: null,
        ...(patch.status === 'RETRY' ? {} : { finishedAt: nowStamp(this.clock) }) });
      return true;
    });
  }

  failure(claim, code, delivered, retryable) {
    const status = retryable && claim.attempts < maxAttempts ? 'RETRY' : 'FAILED';
    const backoff = Math.min(600000, 15000 * 2 ** (claim.attempts - 1));
    return { status, lastErrorCode: code, deliveredTokenHashes: delivered,
      ...(status === 'RETRY' ? { nextAttemptAt: Timestamp.fromMillis(this.clock() + backoff) } : {}) };
  }

  async targets(job) {
    const order = (await this.db.collection('orders').doc(job.orderId).get()).data();
    if (!order) return [];
    const shopRef = this.db.collection('shops').doc(order.shopId);
    const [shop, ...users] = await this.db.getAll(shopRef, ...job.recipientUids.map(uid => this.db.collection('users').doc(uid)));
    const since = Timestamp.fromMillis(this.clock() - thirtyDays);
    const devices = await Promise.all(users.map(async user => {
      const profile = user.data();
      if (!canViewOrder(user.id, profile, order, shop.data()) || profile.settings?.notificationsEnabled === false) return [];
      if (profile.role === 'driver' && job.type === 'ORDER_MESSAGE') {
        const approval = (await shopRef.collection('drivers').doc(user.id).get()).data();
        if (order.assignmentStatus !== 'ACCEPTED' || approval?.approved !== true || approval.active !== true
          || (profile.driverAuthorityVersion ?? 0) !== (approval.authorityVersion ?? 0)) return [];
      }
      return this.delivery.devices(user.id, since);
    }));
    return [...new Map(devices.flat().map(device => [device.tokenHash, device])).values()];
  }

  async dispatch(ref, job) {
    if (!this.send) {
      await this.finish(ref, job, { status: 'SKIPPED', lastErrorCode: 'FCM_DISABLED' });
      return;
    }
    const delivered = new Set(Array.isArray(job.deliveredTokenHashes) ? job.deliveredTokenHashes : []);
    let devices;
    try { devices = await this.targets(job); }
    catch { await this.finish(ref, job, this.failure(job, 'TARGET_LOOKUP_FAILED', [...delivered], true)); return; }
    const payload = pushPayload(ref.id, job);
    const outcomes = await Promise.all(devices.filter(device => !delivered.has(device.tokenHash)).map(async device => {
      try {
        await sendBounded(this.send, { ...payload, token: device.token });
        delivered.add(device.tokenHash);
        return null;
      } catch (error) {
        const code = safeCode(error);
        if (invalidToken.has(code)) {
          try { await this.delivery.unbind(device.uid, device.installationId, device.tokenHash); }
          catch { return { code: 'TOKEN_CLEANUP_FAILED', retry: true }; }
          return { code, invalid: true };
        }
        return { code, retry: !permanent.has(code) };
      }
    }));
    const retrying = outcomes.find(result => result?.retry);
    const rejected = outcomes.find(result => result && !result.invalid);
    const badToken = outcomes.find(result => result?.invalid);
    if (retrying || rejected) {
      const issue = retrying ?? rejected;
      await this.finish(ref, job, this.failure(job, issue.code, [...delivered], issue.retry === true));
    } else {
      await this.finish(ref, job, { status: delivered.size ? 'SENT' : 'SKIPPED',
        deliveredTokenHashes: [...delivered], lastErrorCode: badToken?.code ?? (delivered.size ? null : 'NO_TARGETS') });
    }
  }

  async runOnce() {
    const due = await this.db.collection('notificationOutbox').where('status', 'in', active)
      .where('nextAttemptAt', '<=', nowStamp(this.clock)).orderBy('nextAttemptAt').limit(12).get();
    for (const doc of due.docs) {
      const claimed = await this.claim(doc.ref);
      if (claimed) await this.dispatch(doc.ref, claimed);
    }
  }
}

async function sendBounded(send, payload) {
  let timeout;
  try {
    await Promise.race([
      send(payload),
      new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Delivery deadline')), 15000); }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

export function startOutboxWorker(worker, logger = console) {
  let current = null;
  const timer = setInterval(() => {
    if (current) return;
    current = worker.runOnce().catch(() => logger.error?.({ event: 'outbox_poll_failed' }))
      .finally(() => { current = null; });
  }, 2000);
  timer.unref();
  return async () => { clearInterval(timer); await current; };
}
