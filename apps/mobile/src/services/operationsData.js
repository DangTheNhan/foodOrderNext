import { getApi } from '../api/axiosClient';
import { getFirebaseRuntime } from '../firebase/runtime';
import { withPerformanceTrace } from '../firebase/performanceTrace';
import { customerData } from './customerData';

export function operatorRuntime(uid) {
  const runtime = getFirebaseRuntime();
  if (runtime.auth.currentUser?.uid !== uid) throw new Error('Tài khoản đã thay đổi.');
  return runtime;
}

const id = value => encodeURIComponent(value);

async function get(uid, path, params, traceName) {
  const runtime = operatorRuntime(uid);
  const read = async () => (await getApi().client.get(path, { params })).data.data;
  return traceName ? withPerformanceTrace(runtime, traceName, read) : read();
}

export const operationsData = {
  shops: (uid, cursor) => get(uid, '/shops', { cursor }),
  shop: (uid, shopId) => get(uid, `/shops/${id(shopId)}`),
  menu: (uid, shopId, cursor) => get(uid, `/shops/${id(shopId)}/menu-items`, { cursor }),
  item: (uid, foodId) => get(uid, `/menu-items/${id(foodId)}`),
  drivers: (uid, shopId, cursor) => get(uid, `/shops/${id(shopId)}/drivers`, { cursor }),
  users: (uid, filters, cursor) => get(uid, '/admin/users', { ...filters, cursor }),
  user: (uid, targetUid) => get(uid, `/admin/users/${id(targetUid)}`),
  report: (uid, shopId, day, cursor) => get(uid, `/shops/${id(shopId)}/reports/daily`,
    { day, cursor, includeTotals: cursor ? 'false' : undefined }, cursor ? 'daily_report_next' : 'daily_report_first'),
  write: customerData.mutate,
};
