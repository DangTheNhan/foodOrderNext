// Query shape shared with Emulator tests. A snapshot carries both the sort
// value and document ID, so equal prices or names cannot skip a row.
export const PAGE_SIZE = 20;
export const normalizePrefix = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[đĐ]/g, 'd').toLowerCase().trim().replace(/\s+/g, ' ');

export function shopPageQuery(sdk, db, cursor, size = PAGE_SIZE) {
  return sdk.query(sdk.collection(db, 'shops'), sdk.where('active', '==', true),
    sdk.orderBy('name'), sdk.orderBy(sdk.documentId()),
    ...(cursor ? [sdk.startAfter(cursor)] : []), sdk.limit(size));
}

export function menuPageQuery(sdk, db, shopId, filter, cursor, size = PAGE_SIZE) {
  const constraints = [sdk.where('shopId', '==', shopId), sdk.where('active', '==', true)];
  if (filter.categoryId) constraints.push(sdk.where('categoryId', '==', filter.categoryId));
  const prefix = filter.mode === 'name' ? normalizePrefix(filter.prefix) : '';
  if (prefix) constraints.push(sdk.where('nameKey', '>=', prefix), sdk.where('nameKey', '<=', prefix + '\uf8ff'));
  if (filter.mode === 'price' && filter.maxPrice != null) constraints.push(sdk.where('priceVnd', '<=', filter.maxPrice));
  return sdk.query(sdk.collection(db, 'menuItems'), ...constraints,
    sdk.orderBy(filter.mode === 'price' ? 'priceVnd' : 'nameKey'), sdk.orderBy(sdk.documentId()),
    ...(cursor ? [sdk.startAfter(cursor)] : []), sdk.limit(size));
}
