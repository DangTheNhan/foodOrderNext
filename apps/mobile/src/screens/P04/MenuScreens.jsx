import React, { useCallback, useState } from 'react';
import { newIntentKey } from '../../api/clientCore';
import { useSession } from '../../auth/SessionContext';
import { customerData } from '../../services/customerData';
import { operationsData } from '../../services/operationsData';
import { uploadMenuPhoto } from '../../services/menuPhoto';
import { Button, Card, Choice, Field, FoodPhoto, Heading, Label, money, Muted, Notice, Page, PagedList,
  Row, Status, Tile, useRead } from '../P02/CustomerUI';
import { useOperation, wholeNumber } from './OperationsUI';

export function MerchantMenu({ route, navigation }) {
  const uid = useSession().user.uid;
  const { shopId } = route.params;
  const load = useCallback(cursor => operationsData.menu(uid, shopId, cursor), [shopId, uid]);
  return <PagedList load={load} refreshOnFocus empty="Quán chưa có món."
    header={<Button title="Thêm món" testID="new-menu-item" onPress={() => navigation.navigate('MenuItemEditor', { shopId })} />}
    render={food => <Tile title={food.name} testID={`merchant-food-${food.id}`} trailing={money(food.priceVnd)}
      detail={`${food.active ? 'Đang hiển thị' : 'Đã ẩn'} · Có thể bán ${food.availablePortions} · Đang giữ ${food.reservedPortions}`}
      onPress={() => navigation.navigate('MenuItemEditor', { shopId, foodId: food.id })} />} />;
}

export function MenuItemEditor({ route, navigation }) {
  const { shopId, foodId } = route.params;
  const { user, profile } = useSession();
  const load = useCallback(async () => {
    const [item, categories] = await Promise.all([foodId ? operationsData.item(user.uid, foodId) : null, customerData.categories()]);
    if (item && item.shopId !== shopId) return null;
    return { item, categories };
  }, [foodId, shopId, user.uid]);
  const resource = useRead(load);
  return <Page><Status resource={resource}>{({ item, categories }) =>
    <MenuForm item={item} categories={categories} shopId={shopId} uid={user.uid} canUpload={profile.role === 'merchant'}
      navigation={navigation} refresh={resource.retry} />}</Status></Page>;
}

function MenuForm({ item, categories, shopId, uid, canUpload, navigation, refresh }) {
  const [name, setName] = useState(item?.name ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [price, setPrice] = useState(String(item?.priceVnd ?? ''));
  const [categoryId, setCategory] = useState(item?.categoryId ?? '');
  const [active, setActive] = useState(item?.active ?? true);
  const [initial, setInitial] = useState('0');
  const [groups, setGroups] = useState(item?.optionGroups ?? []);
  const [imagePath, setImagePath] = useState(undefined);
  const action = useOperation(uid);
  const route = item ? `/menu-items/${item.id}` : `/shops/${shopId}/menu-items`;

  function updateGroup(id, patch) {
    setGroups(values => values.map(group => group.id === id ? { ...group, ...patch } : group));
  }
  function save() {
    action.run(async () => {
      if (!name.trim() || !categoryId) throw new Error('Điền tên món và chọn danh mục.');
      const optionGroups = groups.map(group => {
        const minSelections = wholeNumber(group.minSelections, 'Số chọn tối thiểu', 0, group.options.length);
        const maxSelections = wholeNumber(group.maxSelections, 'Số chọn tối đa', minSelections, group.options.length);
        if (!group.name.trim() || !group.options.length || maxSelections === 0) throw new Error('Nhóm cần tên và ít nhất một lựa chọn.');
        return { id: group.id, name: group.name.trim(), minSelections, maxSelections,
          options: group.options.map(option => {
            if (!option.name.trim()) throw new Error('Điền tên từng lựa chọn.');
            return { id: option.id, name: option.name.trim(), priceDeltaVnd: wholeNumber(option.priceDeltaVnd, 'Phụ phí') };
          }) };
      });
      const body = { name: name.trim(), description: description.trim(), categoryId, active,
        priceVnd: wholeNumber(price, 'Giá món'), optionGroups };
      if (item) {
        await action.write('patch', route, { ...body, expectedRevision: item.revision, ...(imagePath === undefined ? {} : { imagePath }) });
        refresh();
      } else {
        const result = await action.write('post', route, { ...body, initialAvailablePortions: wholeNumber(initial, 'Số suất', 0, 1000000) });
        navigation.replace('MenuItemEditor', { shopId, foodId: result.foodId });
      }
    });
  }
  return <>
    <Heading>{item ? item.name : 'Thêm món vào thực đơn'}</Heading>
    {item ? <>
      <FoodPhoto path={item.imagePath} name={item.name} />
      <Row>
        {canUpload ? <Button outline title="Chọn ảnh" testID="pick-menu-photo" disabled={action.busy} onPress={() => action.run(async () => {
          const pending = await uploadMenuPhoto(uid, shopId);
          if (pending) setImagePath(pending);
        })} /> : null}
        {item.imagePath || imagePath ? <Button outline title="Gỡ ảnh" disabled={action.busy} onPress={() => setImagePath(null)} /> : null}
      </Row>
      {typeof imagePath === 'string' ? <Muted>Ảnh đã tải lên. Lưu món để hiển thị ảnh.</Muted> : null}
      {imagePath === null ? <Muted>Ảnh sẽ được gỡ khi lưu.</Muted> : null}
      <Tile title="Điều chỉnh suất bán" testID="open-stock" onPress={() => navigation.navigate('StockEditor', { shopId, foodId: item.id })} />
    </> : <Field label="Số suất ban đầu" testID="menu-initial" value={initial}
      onChangeText={setInitial} keyboardType="number-pad" maxLength={7} />}
    <Field label="Tên món" testID="menu-name" value={name} onChangeText={setName} maxLength={100} />
    <Field label="Giá (VND)" testID="menu-price" value={price} onChangeText={setPrice} keyboardType="number-pad" maxLength={12} />
    <Field label="Mô tả" testID="menu-description" value={description} onChangeText={setDescription} multiline maxLength={2000} />
    <Label>Danh mục</Label>
    <Row>{categories.map(category => <Choice key={category.id} title={category.name} selected={categoryId === category.id}
      onPress={() => setCategory(category.id)} />)}</Row>
    <Row>
      <Choice title="Hiển thị món" selected={active} onPress={() => setActive(true)} />
      <Choice title="Ẩn món" selected={!active} onPress={() => setActive(false)} />
    </Row>
    {groups.map(group => <OptionGroup key={group.id} group={group}
      update={patch => updateGroup(group.id, patch)}
      remove={() => setGroups(values => values.filter(value => value.id !== group.id))} />)}
    {groups.length < 10 ? <Button outline title="Thêm nhóm tùy chọn" disabled={action.busy}
      onPress={() => setGroups(values => [...values, { id: newIntentKey(), name: '', minSelections: 0, maxSelections: 1,
        options: [{ id: newIntentKey(), name: '', priceDeltaVnd: 0 }] }])} /> : null}
    <Notice>{action.message}</Notice>
    <Button title={action.busy ? 'Đang xử lý…' : 'Lưu món'} testID="save-menu-item" disabled={action.busy} onPress={save} />
    {action.message && item ? <Button outline title="Tải lại món" onPress={refresh} /> : null}
  </>;
}

function OptionGroup({ group, update, remove }) {
  function changeOption(id, patch) {
    update({ options: group.options.map(option => option.id === id ? { ...option, ...patch } : option) });
  }
  return <Card>
    <Field label="Tên nhóm" value={group.name} onChangeText={name => update({ name })} maxLength={100} />
    <Field label="Số chọn tối thiểu" value={String(group.minSelections)} keyboardType="number-pad" maxLength={2}
      onChangeText={minSelections => update({ minSelections })} />
    <Field label="Số chọn tối đa" value={String(group.maxSelections)} keyboardType="number-pad" maxLength={2}
      onChangeText={maxSelections => update({ maxSelections })} />
    {group.options.map(option => <Card key={option.id}>
      <Field label="Tên lựa chọn" value={option.name} maxLength={100} onChangeText={name => changeOption(option.id, { name })} />
      <Field label="Phụ phí (VND)" value={String(option.priceDeltaVnd)} keyboardType="number-pad" maxLength={12}
        onChangeText={priceDeltaVnd => changeOption(option.id, { priceDeltaVnd })} />
      <Button outline title="Bỏ lựa chọn" onPress={() => update({ options: group.options.filter(value => value.id !== option.id) })} />
    </Card>)}
    <Row>
      {group.options.length < 20 ? <Button outline title="Thêm lựa chọn" onPress={() =>
        update({ options: [...group.options, { id: newIntentKey(), name: '', priceDeltaVnd: 0 }] })} /> : null}
      <Button outline title="Bỏ nhóm" onPress={remove} />
    </Row>
  </Card>;
}

export function StockEditor({ route }) {
  const uid = useSession().user.uid;
  const { foodId, shopId } = route.params;
  const resource = useRead(useCallback(async () => {
    const item = await operationsData.item(uid, foodId);
    return item.shopId === shopId ? item : null;
  }, [foodId, shopId, uid]));
  return <Page><Status resource={resource}>{item => <StockForm item={item} uid={uid} refresh={resource.retry} />}</Status></Page>;
}

function StockForm({ item, uid, refresh }) {
  const [direction, setDirection] = useState(1);
  const [number, setNumber] = useState('');
  const [reason, setReason] = useState('');
  const action = useOperation(uid);
  return <>
    <Heading>{item.name}</Heading>
    <Card>
      <Label>Có thể bán · {item.availablePortions}</Label>
      <Muted>Đang giữ cho đơn · {item.reservedPortions}</Muted>
      <Muted>Đã bán · {item.soldPortions}</Muted>
    </Card>
    <Row>
      <Choice title="Tăng suất" selected={direction === 1} onPress={() => setDirection(1)} />
      <Choice title="Giảm suất" selected={direction === -1} onPress={() => setDirection(-1)} />
    </Row>
    <Field label="Số suất điều chỉnh" testID="stock-number" keyboardType="number-pad" value={number} onChangeText={setNumber} maxLength={7} />
    <Field label="Lý do điều chỉnh" testID="stock-reason" value={reason} onChangeText={setReason} maxLength={160} />
    <Notice>{action.message}</Notice>
    <Button title="Lưu điều chỉnh" testID="save-stock" disabled={action.busy} onPress={() => action.run(async () => {
      if (reason.trim().length < 2) throw new Error('Nhập lý do điều chỉnh.');
      await action.write('post', `/menu-items/${item.id}/stock-adjustments`, { expectedRevision: item.revision,
        deltaAvailablePortions: direction * wholeNumber(number, 'Số suất', 1, 1000000), reason: reason.trim() });
      refresh();
    })} />
    {action.message ? <Button outline title="Tải tồn mới" onPress={refresh} /> : null}
  </>;
}
