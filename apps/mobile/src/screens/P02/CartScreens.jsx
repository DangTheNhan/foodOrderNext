import React, { useCallback } from 'react';
import { useSession } from '../../auth/SessionContext';
import { cartLineKey, customerData, linePreview } from '../../services/customerData';
import { Button, Card, Heading, Label, money, Muted, Notice,
  Page, Row, Status, Tile, useAction, useRead } from './CustomerUI';

function cartTotals({ cart, shop, foods }) {
  const quantities = new Map();
  for (const line of cart.items) quantities.set(line.foodId, (quantities.get(line.foodId) ?? 0) + line.quantity);
  let subtotal = 0;
  let valid = Boolean(shop?.acceptingOrders);
  for (const line of cart.items) {
    const food = foods[line.foodId];
    const preview = linePreview(food, line);
    if (!preview || food?.shopId !== cart.shopId || (food?.availablePortions ?? 0) < quantities.get(line.foodId)) valid = false;
    if (preview) subtotal += preview.total;
  }
  return { subtotal, valid: valid && Number.isSafeInteger(subtotal + shop?.deliveryFeeVnd), quantities };
}

export function CartScreen({ navigation }) {
  const { user } = useSession();
  const resource = useRead(useCallback(() => customerData.cartDetails(user.uid), [user.uid]));
  const action = useAction();

  function change(cart, line, quantity) {
    action.run(async () => {
      const key = cartLineKey(line);
      const items = quantity === 0 ? cart.items.filter(item => cartLineKey(item) !== key)
        : cart.items.map(item => cartLineKey(item) === key ? { ...item, quantity } : item);
      if (items.length) {
        await customerData.mutate(user.uid, 'put', '/me/cart', { shopId: cart.shopId, items, expectedCartVersion: cart.version });
      } else {
        await customerData.mutate(user.uid, 'delete', '/me/cart', { expectedCartVersion: cart.version });
      }
      resource.retry();
    });
  }
  return <Page>
    <Notice>{action.message}</Notice>
    {action.message ? <Button title="Tải lại giỏ" outline onPress={resource.retry} /> : null}
    <Status resource={resource}>{data => {
      const { cart, shop, foods } = data;
      if (!cart.items.length) return <><Heading>Giỏ đang trống</Heading>
        <Button title="Chọn món" onPress={() => navigation.popToTop()} /></>;
      const { subtotal, valid, quantities } = cartTotals(data);
      return <>
        <Heading>{shop?.name || 'Quán không còn hoạt động'}</Heading>
        {cart.items.map(line => {
          const food = foods[line.foodId];
          const preview = linePreview(food, line);
          const enough = (food?.availablePortions ?? 0) > quantities.get(line.foodId);
          return <Card key={cartLineKey(line)}>
            <Label>{food?.name || 'Món không còn hiển thị'}</Label>
            {preview?.options.length ? <Muted>{preview.options.map(option => option.name).join(' · ')}</Muted> : null}
            <Muted>{preview ? money(preview.total) : 'Món hoặc tùy chọn không còn khả dụng'}</Muted>
            <Row>
              <Button outline title="− 1" disabled={action.busy || line.quantity <= 1} onPress={() => change(cart, line, line.quantity - 1)} />
              <Label>{line.quantity} suất</Label>
              <Button outline title="+ 1" testID={`plus-${line.foodId}`} disabled={action.busy || !preview || !enough || line.quantity >= 99 || !shop?.acceptingOrders}
                onPress={() => change(cart, line, line.quantity + 1)} />
              <Button outline title="Xóa món" disabled={action.busy} onPress={() => change(cart, line, 0)} />
            </Row>
          </Card>;
        })}
        <Card>
          <Label>Tạm tính tiền món · {money(subtotal)}</Label>
          {shop ? <Muted>Phí giao dự kiến · {money(shop.deliveryFeeVnd)}</Muted> : null}
          {!valid ? <Notice>Hãy kiểm tra lại các món, số suất hoặc tình trạng nhận đơn của quán.</Notice> : null}
        </Card>
        <Button title="Thanh toán COD" testID="open-checkout" disabled={!valid || action.busy}
          onPress={() => navigation.navigate('CheckoutDraft')} />
      </>;
    }}</Status>
  </Page>;
}

export function CustomerAccountScreen({ navigation }) {
  const session = useSession();
  const action = useAction();
  return <Page>
    <Heading>{session.profile.displayName}</Heading>
    <Card><Muted>{session.user.email}</Muted><Muted>{session.profile.phone || 'Chưa cập nhật số điện thoại'}</Muted></Card>
    <Tile title="Chỉnh sửa hồ sơ" testID="profile-edit" onPress={() => navigation.navigate('EditProfile')} />
    <Tile title="Sổ địa chỉ" testID="open-addresses" onPress={() => navigation.navigate('CustomerAddresses')} />
    {session.user.providerData?.some(provider => provider.providerId === 'password') ?
      <Tile title="Đổi mật khẩu" testID="open-change-password" onPress={() => navigation.navigate('ChangePassword')} /> : null}
    <Tile title="Cài đặt và hỗ trợ" onPress={() => navigation.navigate('CustomerSettings')} />
    <Notice>{action.message}</Notice>
    <Button outline title="Đăng xuất" testID="logout" disabled={action.busy} onPress={() => action.run(session.logout)} />
  </Page>;
}
