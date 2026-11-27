export function orderFeed(sdk, db, scope, count, cursor) {
  const filter = {
    customer: ['customerUid', scope.uid],
    merchant: ['shopId', scope.shopId],
    admin: ['shopId', scope.shopId],
    driver: ['driverUid', scope.uid],
  }[scope.role];
  const queue = scope.role === 'merchant' || scope.role === 'admin';
  const direction = queue ? 'asc' : 'desc';
  return sdk.query(sdk.collection(db, 'orders'), sdk.where(filter[0], '==', filter[1]),
    ...(queue ? [sdk.where('status', '==', scope.status)] : []),
    ...(scope.role === 'driver' ? [sdk.where('status', 'in', scope.finished ? ['COMPLETED'] :
      ['ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'DELIVERING'])] : []),
    sdk.orderBy(scope.role === 'driver' ? 'updatedAt' : 'createdAt', direction),
    sdk.orderBy(sdk.documentId(), direction), ...(cursor ? [sdk.startAfter(cursor)] : []), sdk.limit(count));
}

export function messageFeed(sdk, db, orderId, count, cursor) {
  return sdk.query(sdk.collection(db, 'orders', orderId, 'messages'), sdk.orderBy('sentAt', 'desc'),
    sdk.orderBy(sdk.documentId(), 'desc'), ...(cursor ? [sdk.startAfter(cursor)] : []), sdk.limit(count));
}

export function inboxFeed(sdk, db, uid, count, cursor) {
  return sdk.query(sdk.collection(db, 'users', uid, 'notifications'), sdk.orderBy('createdAt', 'desc'),
    sdk.orderBy(sdk.documentId(), 'desc'), ...(cursor ? [sdk.startAfter(cursor)] : []), sdk.limit(count));
}
