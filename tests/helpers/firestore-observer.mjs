import { onSnapshot } from 'firebase/firestore';

export function observer(query, now = Date.now) {
  const values = [];
  let settle;
  let failure;
  const unsubscribe = onSnapshot(query, { includeMetadataChanges: true }, value => {
    values.push({ value, receivedAt: now() });
    settle?.();
  }, error => { failure = error; settle?.(); });
  return {
    unsubscribe,
    until(predicate, after = 0) {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          settle = null;
          reject(failure ?? new Error('Timed out waiting for scoped snapshot'));
        }, 17_000);
        settle = () => {
          try {
            if (failure) throw failure;
            const hit = values.find(({ value, receivedAt }) => receivedAt >= after && predicate(value));
            if (!hit) return;
            clearTimeout(timeout);
            settle = null;
            resolve(hit);
          } catch (error) {
            clearTimeout(timeout);
            settle = null;
            reject(error);
          }
        };
        settle();
      });
    },
  };
}

export const has = (id, predicate = () => true) => value => !value.metadata.fromCache
  && value.docs.some(doc => doc.id === id && predicate(doc.data()));
