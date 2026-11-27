import React, { useCallback, useRef, useState } from 'react';
import { coordinateInput } from '../../services/coordinateInput';
import { Alert, Linking } from 'react-native';
import { newIntentKey } from '../../api/clientCore';
import { useSession } from '../../auth/SessionContext';
import { customerData } from '../../services/customerData';
import { Button, Card, Field, Heading, Label, Muted, Notice, Page, Row,
  Status, Tile, useAction, useRead } from './CustomerUI';

export function AddressesScreen({ navigation }) {
  const { user } = useSession();
  const resource = useRead(useCallback(() => customerData.addresses(user.uid), [user.uid]));
  const action = useAction();
  async function change(method, id, body) {
    await customerData.mutate(user.uid, method, `/me/addresses/${id}`, body);
    resource.retry();
  }
  function remove(id) {
    Alert.alert('Xóa địa chỉ?', 'Địa chỉ sẽ được gỡ khỏi sổ địa chỉ của bạn.', [
      { text: 'Giữ lại', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: () => action.run(() => change('delete', id)) },
    ]);
  }
  return <Page>
    <Heading>Địa chỉ nhận hàng</Heading>
    <Button title="Thêm địa chỉ" testID="add-address" onPress={() => navigation.navigate('CustomerAddressForm')} />
    <Notice>{action.message}</Notice>
    <Status resource={resource}>{({ rows, defaultId }) => rows.length ? rows.map(row => <Card key={row.id}>
      <Label>{row.label}{defaultId === row.id ? ' · Mặc định' : ''}</Label>
      <Muted>{row.receiverName} · {row.phone}</Muted>
      <Muted>{row.addressText}</Muted>
      <Row>
        <Button outline title="Sửa" onPress={() => navigation.navigate('CustomerAddressForm', { addressId: row.id })} />
        {defaultId !== row.id ? <Button outline title="Đặt mặc định" disabled={action.busy}
          onPress={() => action.run(() => change('patch', row.id, { makeDefault: true }))} /> : null}
        <Button outline title="Xóa" disabled={action.busy} onPress={() => remove(row.id)} />
      </Row>
    </Card>) : <Muted>Bạn chưa lưu địa chỉ nào.</Muted>}</Status>
  </Page>;
}

export function AddressFormScreen({ navigation, route }) {
  const { user, profile } = useSession();
  const addressId = route.params?.addressId;
  const load = useCallback(async () => {
    if (!addressId) return { receiverName: profile.displayName, phone: profile.phone ?? '' };
    return (await customerData.addresses(user.uid)).rows.find(row => row.id === addressId);
  }, [addressId, profile.displayName, profile.phone, user.uid]);
  const resource = useRead(load);
  return <Page><Status resource={resource} empty="Địa chỉ này đã bị xóa.">{initial =>
    <AddressEditor initial={initial} uid={user.uid} addressId={addressId} navigation={navigation} />}</Status></Page>;
}

function AddressEditor({ initial, uid, addressId, navigation }) {
  const [label, setLabel] = useState(initial.label ?? '');
  const [name, setName] = useState(initial.receiverName ?? '');
  const [phone, setPhone] = useState(initial.phone ?? '');
  const [address, setAddress] = useState(initial.addressText ?? '');
  const [coordinates, setCoordinates] = useState(Boolean(initial.location));
  const [latitude, setLatitude] = useState(String(initial.location?.latitude ?? ''));
  const [longitude, setLongitude] = useState(String(initial.location?.longitude ?? ''));
  const intent = useRef(null);
  const action = useAction();
  const submit = () => action.run(async () => {
    if (!label.trim() || !name.trim() || !/^[+0-9 ()-]{6,25}$/.test(phone.trim()) || address.trim().length < 5) {
      throw new Error('Điền nhãn, tên, số điện thoại hợp lệ và địa chỉ ít nhất 5 ký tự.');
    }
    const location = coordinates ? coordinateInput(latitude, longitude) : null;
    const sameLocation = location?.latitude === initial.location?.latitude && location?.longitude === initial.location?.longitude;
    const body = { label: label.trim(), receiverName: name.trim(), phone: phone.trim(),
      addressText: address.trim(), location, locationSource: sameLocation ? initial.locationSource ?? 'MANUAL' : 'MANUAL' };
    const fingerprint = JSON.stringify(body);
    if (intent.current?.fingerprint !== fingerprint) intent.current = { fingerprint, key: newIntentKey() };
    await customerData.mutate(uid, addressId ? 'patch' : 'post',
      addressId ? `/me/addresses/${addressId}` : '/me/addresses', body, intent.current.key);
    navigation.goBack();
  });
  return <>
    <Field label="Nhãn địa chỉ" testID="address-label" value={label} onChangeText={setLabel} maxLength={40} />
    <Field label="Tên người nhận" value={name} onChangeText={setName} maxLength={100} />
    <Field label="Số điện thoại" testID="address-phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={25} />
    <Field label="Địa chỉ chi tiết" testID="address-text" value={address} onChangeText={setAddress} multiline maxLength={500} />
    <Button outline title={coordinates ? 'Bỏ tọa độ' : 'Nhập tọa độ tùy chọn'} onPress={() => setCoordinates(value => !value)} />
    {coordinates ? <>
      <Field label="Vĩ độ" value={latitude} onChangeText={setLatitude} maxLength={24} />
      <Field label="Kinh độ" value={longitude} onChangeText={setLongitude} maxLength={24} />
    </> : null}
    <Notice>{action.message}</Notice>
    <Button title="Lưu địa chỉ" testID="save-address" disabled={action.busy} onPress={submit} />
  </>;
}

export function SettingsScreen({ navigation }) {
  const action = useAction();
  return <Page>
    <Tile title="Thông báo đơn hàng" onPress={() => navigation.navigate('NotificationSettings')} />
    <Tile title="Cài đặt hệ thống của ứng dụng" detail="Mở quyền và tùy chọn ứng dụng trên thiết bị"
      onPress={() => action.run(() => Linking.openSettings())} />
    <Tile title="Trợ giúp và thông tin" onPress={() => navigation.navigate('CustomerHelp')} />
    <Notice>{action.message}</Notice>
  </Page>;
}

export function HelpScreen() {
  return <Page>
    <Heading>Trợ giúp</Heading>
    <Card><Label>Chọn món và giỏ</Label><Muted>Mở một quán, chọn món còn suất và kiểm tra phí giao dự kiến trong giỏ.</Muted></Card>
    <Card><Label>Đặt, hủy và nhận món</Label><Muted>Sau khi tính năng đặt đơn được mở, bạn có thể hủy khi quán chưa xác nhận và thanh toán COD lúc nhận hàng.</Muted></Card>
    <Card><Label>Hỗ trợ trong buổi demo</Label><Muted>Liên hệ thành viên nhóm phụ trách demo khi gặp lỗi. Ghi lại màn hình và bước thao tác để nhóm kiểm tra.</Muted></Card>
    <Muted>FoodOrderNext · {require('../../../package.json').version}</Muted>
  </Page>;
}
