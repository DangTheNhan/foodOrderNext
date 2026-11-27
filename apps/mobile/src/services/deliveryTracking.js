import { doc, getDocFromServer, onSnapshot } from '@react-native-firebase/firestore';
import { getApi } from '../api/axiosClient';
import { operatorRuntime } from './operationsData';

export function observeDelivery(uid, orderId, next, error) {
  const { db } = operatorRuntime(uid);
  return onSnapshot(doc(db, 'orders', orderId, 'deliveryTracking', 'current'), { includeMetadataChanges: true },
    snapshot => next(snapshot.metadata.fromCache ? { stale: true } : { position: snapshot.data() }), error);
}

export async function shopPoint(uid, shopId) {
  const { db } = operatorRuntime(uid);
  return (await getDocFromServer(doc(db, 'shops', shopId))).data()?.location ?? null;
}

export async function sendDeliveryFix(uid, orderId, fix, expectedAssignmentVersion, signal) {
  operatorRuntime(uid);
  const { latitude, longitude, accuracyMeters, recordedAtMs } = fix;
  const response = await getApi().client.post(`/orders/${encodeURIComponent(orderId)}/location`, {
    latitude, longitude, accuracyMeters, recordedAt: new Date(recordedAtMs).toISOString(),
    sequence: recordedAtMs, expectedAssignmentVersion,
  }, { signal });
  return response.data.data;
}
