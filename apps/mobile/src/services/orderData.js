import { getApi } from '../api/axiosClient';
import { getFirebaseRuntime } from '../firebase/runtime';
import { withPerformanceTrace } from '../firebase/performanceTrace';
import { customerData } from './customerData';

export const statusLabel = {
  PENDING: 'Chờ quán xác nhận', ACCEPTED: 'Quán đã xác nhận', PREPARING: 'Đang chuẩn bị',
  READY_FOR_PICKUP: 'Chờ tài xế lấy món', DELIVERING: 'Đang giao', COMPLETED: 'Đã giao',
  CANCELLED: 'Đã hủy', REJECTED: 'Quán từ chối',
};

function ownRuntime(uid) {
  const runtime = getFirebaseRuntime();
  if (runtime.auth.currentUser?.uid !== uid) throw new Error('Tài khoản đã thay đổi.');
  return runtime;
}

export const orderData = {
  async quote(uid, payload) {
    return withPerformanceTrace(ownRuntime(uid), 'order_quote',
      async () => (await getApi().client.post('/orders/quote', payload)).data.data);
  },
  place: (uid, input, key) => customerData.mutate(uid, 'post', '/orders', input, key),
  cancel: (uid, id, version, key) => customerData.mutate(uid, 'post', `/orders/${id}/cancel`, { expectedStatusVersion: version }, key),
  review: (uid, id, input, key) => customerData.mutate(uid, 'post', `/orders/${id}/review`, input, key),
};
