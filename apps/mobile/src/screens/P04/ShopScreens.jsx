import React, { useCallback, useState } from 'react';
import { coordinateInput } from '../../services/coordinateInput';
import { useSession } from '../../auth/SessionContext';
import { operationsData } from '../../services/operationsData';
import { statusLabel } from '../../services/orderData';
import { Button, Card, Choice, Field, Heading, Label, money, Muted, Notice, Page, PagedList,
  Row, Status, Tile, useRead } from '../P02/CustomerUI';
import { useOperation, wholeNumber } from './OperationsUI';

export function OperationsHome({ navigation }) {
  const { user, profile } = useSession();
  const admin = profile.role === 'admin';
  const load = useCallback(cursor => operationsData.shops(user.uid, cursor), [user.uid]);
  return <PagedList load={load} refreshOnFocus empty="Chưa có quán trong phạm vi của tài khoản."
    header={<Card>
      <Heading>{admin ? 'Khu vực Quản trị viên' : 'Khu vực Nhà hàng'}</Heading>
      {admin ? <Button title="Quản lý tài khoản" testID="open-admin-users" onPress={() => navigation.navigate('AdminUsers')} /> : null}
      <Button outline title="Thông báo" testID="open-inbox" onPress={() => navigation.navigate('NotificationInbox')} />
      <Button outline title="Hồ sơ và bảo mật" testID="open-profile" onPress={() => navigation.navigate('Profile')} />
    </Card>}
    render={shop => <Tile title={shop.name} testID={`ops-shop-${shop.id}`}
      detail={shop.acceptingOrders ? 'Đang nhận đơn' : 'Tạm ngừng nhận đơn'}
      onPress={() => navigation.navigate('OperationsShop', { shopId: shop.id })} />} />;
}

export function OperationsShop({ navigation, route }) {
  const { user, profile } = useSession();
  const { shopId } = route.params;
  const resource = useRead(useCallback(() => operationsData.shop(user.uid, shopId), [shopId, user.uid]));
  const open = screen => navigation.navigate(screen, { shopId });
  return <Page><Status resource={resource}>{shop => <>
    <Heading>{shop.name}</Heading>
    <Muted>{shop.acceptingOrders ? 'Đang nhận đơn' : 'Tạm ngừng nhận đơn'}</Muted>
    <Tile title="Hàng đợi đơn" testID="open-merchant-queue" onPress={() => open('MerchantQueue')} />
    <Tile title="Quản lý thực đơn" testID="open-merchant-menu" onPress={() => open('MerchantMenu')} />
    <Tile title="Cài đặt quán" onPress={() => open('ShopSettings')} />
    <Tile title="Tài xế của quán" testID="open-shop-drivers" onPress={() => open('ShopDrivers')} />
    <Tile title="Báo cáo theo ngày" testID="open-daily-report" onPress={() => open('ShopReport')} />
    <Tile title="Phân tích đánh giá" testID="open-review-insights" onPress={() => open('ReviewInsights')} />
    {profile.role === 'admin' ? <Muted>Quản trị viên có thể duyệt tài xế cho quán này.</Muted> : null}
  </>}</Status></Page>;
}

export function ShopSettings({ route, navigation }) {
  const uid = useSession().user.uid;
  const { shopId } = route.params;
  const resource = useRead(useCallback(() => operationsData.shop(uid, shopId), [uid, shopId]));
  return <Page><Status resource={resource}>{shop => <ShopSettingsForm shop={shop} uid={uid} onSaved={navigation.goBack} />}</Status></Page>;
}

function ShopSettingsForm({ shop, uid, onSaved }) {
  const action = useOperation(uid);
  const [name, setName] = useState(shop.name);
  const [address, setAddress] = useState(shop.addressText ?? '');
  const [hours, setHours] = useState(shop.openingHours?.label ?? '');
  const [fee, setFee] = useState(String(shop.deliveryFeeVnd ?? 0));
  const [accepting, setAccepting] = useState(shop.acceptingOrders === true);
  const [coordinates, setCoordinates] = useState(Boolean(shop.location));
  const [latitude, setLatitude] = useState(String(shop.location?.latitude ?? ''));
  const [longitude, setLongitude] = useState(String(shop.location?.longitude ?? ''));
  return <>
    <Field label="Tên quán" value={name} onChangeText={setName} maxLength={100} />
    <Field label="Địa chỉ" value={address} onChangeText={setAddress} maxLength={500} />
    <Button outline title={coordinates ? 'Bỏ tọa độ quán' : 'Nhập tọa độ quán'} onPress={() => setCoordinates(value => !value)} />
    {coordinates ? <>
      <Field label="Vĩ độ của quán" value={latitude} onChangeText={setLatitude} maxLength={24} />
      <Field label="Kinh độ của quán" value={longitude} onChangeText={setLongitude} maxLength={24} />
    </> : null}
    <Field label="Giờ hoạt động" value={hours} onChangeText={setHours} maxLength={150} />
    <Field label="Phí giao (VND)" value={fee} onChangeText={setFee} keyboardType="number-pad" maxLength={12} />
    <Row>
      <Choice title="Nhận đơn" selected={accepting} onPress={() => setAccepting(true)} />
      <Choice title="Tạm ngừng" selected={!accepting} onPress={() => setAccepting(false)} />
    </Row>
    <Notice>{action.message}</Notice>
    <Button title="Lưu cài đặt quán" disabled={action.busy} onPress={() => action.run(async () => {
      if (!name.trim() || address.trim().length < 5 || !hours.trim()) throw new Error('Điền tên quán, địa chỉ và giờ hoạt động.');
      await action.write('patch', `/shops/${shop.id}`, { name, addressText: address,
        location: coordinates ? coordinateInput(latitude, longitude) : null,
        openingHours: { label: hours }, deliveryFeeVnd: wholeNumber(fee, 'Phí giao'), acceptingOrders: accepting });
      onSaved();
    })} />
  </>;
}

const vietnamToday = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);

export function ShopReport({ navigation, route }) {
  const uid = useSession().user.uid;
  const { shopId } = route.params;
  const [draft, setDraft] = useState(vietnamToday);
  const [day, setDay] = useState(draft);
  return <ReportList key={JSON.stringify([uid, shopId, day])} uid={uid} day={day} shopId={shopId} navigation={navigation}
    search={<>
      <Field label="Ngày (YYYY-MM-DD)" testID="report-day" value={draft} onChangeText={setDraft} maxLength={10} />
      <Button outline title="Xem ngày" onPress={() => setDay(draft.trim())} />
    </>} />;
}

function ReportList({ uid, day, shopId, navigation, search }) {
  const [totals, setTotals] = useState(null);
  const load = useCallback(cursor => operationsData.report(uid, shopId, day, cursor), [uid, shopId, day]);
  return <PagedList load={load} onFirstPage={setTotals} refreshOnFocus empty="Không có đơn tạo trong ngày."
    header={<Card>{search}{totals ? <>
      <Label>{totals.day} · Giờ Việt Nam</Label>
      <Muted>Đơn tạo trong ngày · {totals.createdCount}</Muted>
      <Muted>Đơn giao và thu COD trong ngày · {totals.completedCount}</Muted>
      <Label>COD đã thu · {money(totals.codVnd)}</Label>
    </> : null}</Card>}
    render={order => <Tile title={statusLabel[order.status]} detail={order.id} trailing={money(order.grandTotalVnd)}
      onPress={() => navigation.navigate('MerchantOrderDetail', { shopId, orderId: order.id })} />} />;
}
