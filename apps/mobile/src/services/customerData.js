import * as sdk from '@react-native-firebase/firestore';
import { getFirebaseRuntime } from '../firebase/runtime';
import { withPerformanceTrace } from '../firebase/performanceTrace';
import { getApi } from '../api/axiosClient';
import { newIntentKey } from '../api/clientCore';
import { PAGE_SIZE, menuPageQuery, shopPageQuery } from './customerQueries';

const record = snap => snap.exists() ? { ...snap.data(), id: snap.id } : null;
const db = () => getFirebaseRuntime().db;
const get = (...path) => sdk.getDocFromServer(sdk.doc(db(), ...path)).then(record);
export const emptyCart = { shopId: null, items: [], version: 0 };
export const cartLineKey = line => JSON.stringify([line.foodId, [...line.optionIds].sort()]);
export function mergeCartLines(current, added) {
  const items = new Map(current.map(line => [cartLineKey(line), line]));
  for (const line of added) {
    const key = cartLineKey(line);
    const quantity = (items.get(key)?.quantity ?? 0) + line.quantity;
    if (quantity > 99) throw new Error('Mỗi dòng chứa tối đa 99 suất.');
    items.set(key, { ...line, quantity });
  }
  if (items.size > 20) throw new Error('Giỏ chỉ chứa tối đa 20 dòng món.');
  return [...items.values()];
}
const notVisible = error => ['firestore/permission-denied', 'permission-denied'].includes(error.code);

async function page(query) {
  const { docs } = await sdk.getDocsFromServer(query);
  return { rows: docs.map(record), cursor: docs.length === PAGE_SIZE ? docs.at(-1) : null };
}

async function publicRecord(collectionName, id) {
  try {
    const item = await get(collectionName, id);
    return item?.active === true ? item : null;
  } catch (error) {
    if (notVisible(error)) return null;
    throw error;
  }
}

function assertUid(uid) {
  if (getFirebaseRuntime().auth.currentUser?.uid !== uid) throw new Error('Tài khoản đã thay đổi.');
}

export const customerData = {
  shops: cursor => page(shopPageQuery(sdk, db(), cursor)),
  shop: id => publicRecord('shops', id),
  food: id => publicRecord('menuItems', id),
  menu(shopId, filter, cursor) {
    const runtime = getFirebaseRuntime();
    return withPerformanceTrace(runtime, 'catalog_menu_page',
      () => page(menuPageQuery(sdk, runtime.db, shopId, filter, cursor)));
  },
  async categories() {
    const q = sdk.query(sdk.collection(db(), 'categories'), sdk.where('active', '==', true),
      sdk.orderBy('sortOrder'), sdk.limit(50));
    return (await sdk.getDocsFromServer(q)).docs.map(record);
  },
  cart(uid) {
    assertUid(uid);
    return get('users', uid, 'carts', 'active').then(cart => cart ?? emptyCart);
  },
  async cartDetails(uid) {
    const cart = await customerData.cart(uid);
    const ids = [...new Set(cart.items.map(line => line.foodId))];
    const [shop, ...foods] = await Promise.all([cart.shopId ? customerData.shop(cart.shopId) : null,
      ...ids.map(customerData.food)]);
    return { cart, shop, foods: Object.fromEntries(ids.map((id, index) => [id, foods[index]])) };
  },
  async addresses(uid) {
    assertUid(uid);
    const q = sdk.query(sdk.collection(db(), 'users', uid, 'addresses'), sdk.limit(20));
    const [profile, { docs }] = await Promise.all([get('users', uid), sdk.getDocsFromServer(q)]);
    return { defaultId: profile?.defaultAddressId ?? null, rows: docs.map(record) };
  },
  async favoritePage(uid, cursor) {
    assertUid(uid);
    const q = sdk.query(sdk.collection(db(), 'users', uid, 'favorites'), sdk.orderBy(sdk.documentId()),
      ...(cursor ? [sdk.startAfter(cursor)] : []), sdk.limit(PAGE_SIZE));
    const result = await page(q);
    const foods = await Promise.all(result.rows.map(row => customerData.food(row.foodId)));
    return { ...result, rows: result.rows.map((row, i) => ({ ...row, food: foods[i] })) };
  },
  async isFavorite(uid, id) {
    assertUid(uid);
    return Boolean(await get('users', uid, 'favorites', id));
  },
  async mutate(uid, method, path, input, key = newIntentKey()) {
    const config = { headers: { 'Idempotency-Key': key } };
    const send = () => {
      assertUid(uid);
      const { client } = getApi();
      return method === 'delete'
        ? client.delete(path, { ...config, data: input })
        : client[method](path, input, config);
    };
    try {
      return (await send()).data.data;
    } catch (error) {
      // On an ambiguous transport failure, replay the exact same intent once.
      if (!['NETWORK_ERROR', 'TIMEOUT'].includes(error.code)) throw error;
      return (await send()).data.data;
    }
  },
};

export function imageUrl(path) {
  const published = /^shops\/[\w-]+\/menuPublished\/([\w-]+)\/([\w.-]+)$/.exec(path ?? '');
  if (published) {
    const { config } = getFirebaseRuntime();
    return `${config.apiBaseUrl}/menu-items/${published[1]}/image?v=${published[2]}`;
  }
  if (!/^shops\/[\w-]+\/menu\/[\w.-]+$/.test(path ?? '')) return null;
  const { app, config } = getFirebaseRuntime();
  const bucket = app.options.storageBucket;
  if (!bucket) return null;
  const origin = config.environment === 'emulator'
    ? `http://${config.emulatorHost}:9199`
    : 'https://firebasestorage.googleapis.com';
  return `${origin}/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(path)}?alt=media`;
}

export function linePreview(food, line) {
  if (!food) return null;
  const groups = Array.isArray(food.optionGroups) ? food.optionGroups : [];
  const options = groups.flatMap(group => group.options).filter(option => line.optionIds.includes(option.id));
  if (options.length !== line.optionIds.length || groups.some(group => {
    const count = group.options.filter(option => line.optionIds.includes(option.id)).length;
    return count < group.minSelections || count > group.maxSelections;
  })) return null;
  const priceVnd = food.priceVnd + options.reduce((total, option) => total + option.priceDeltaVnd, 0);
  const total = priceVnd * line.quantity;
  return Number.isSafeInteger(total) && total >= 0 ? { total, options } : null;
}
