import React, { useCallback, useState } from 'react';
import { useSession } from '../../auth/SessionContext';
import { operationsData } from '../../services/operationsData';
import { Button, Card, Choice, Field, Heading, Label, Muted, Notice, Page, PagedList,
  Row, Status, Tile, useRead } from '../P02/CustomerUI';
import { roleLabel, useOperation } from './OperationsUI';

const roles = Object.keys(roleLabel);

export function AdminUsers({ navigation }) {
  const uid = useSession().user.uid;
  const [draft, setDraft] = useState('');
  const [role, setRole] = useState('');
  const [active, setActive] = useState('');
  const [filters, setFilters] = useState({});
  const load = useCallback(cursor => operationsData.users(uid, filters, cursor), [uid, filters]);
  return <PagedList load={load} refreshOnFocus empty="Không tìm thấy tài khoản."
    header={<Card>
      <Field label="Đầu tên hiển thị" placeholder="Nhập đúng dấu và chữ hoa/thường" value={draft} onChangeText={setDraft} maxLength={100} />
      <Row><Choice title="Mọi vai trò" selected={!role} onPress={() => setRole('')} />
        {roles.map(value => <Choice key={value} title={roleLabel[value]} selected={role === value} onPress={() => setRole(value)} />)}</Row>
      <Row>{[['', 'Mọi trạng thái'], ['true', 'Hoạt động'], ['false', 'Đã khóa']].map(([value, label]) =>
        <Choice key={value || 'all'} title={label} selected={active === value} onPress={() => setActive(value)} />)}</Row>
      <Button outline title="Áp dụng bộ lọc" onPress={() => setFilters({
        q: draft.trim() || undefined, role: role || undefined, active: active || undefined,
      })} />
    </Card>}
    render={user => <Tile title={user.displayName} testID={`admin-user-${user.id}`}
      detail={`${roleLabel[user.role] ?? user.role} · ${user.active ? 'Hoạt động' : 'Đã khóa'}`}
      onPress={() => navigation.navigate('AdminUser', { targetUid: user.id })} />} />;
}

export function AdminUser({ route }) {
  const uid = useSession().user.uid;
  const { targetUid } = route.params;
  const resource = useRead(useCallback(() => operationsData.user(uid, targetUid), [uid, targetUid]));
  return <Page><Status resource={resource}>{user => <UserForm user={user} uid={uid} refresh={resource.retry} />}</Status></Page>;
}

function UserForm({ user, uid, refresh }) {
  const [role, setRole] = useState(user.role);
  const [active, setActive] = useState(user.active);
  const action = useOperation(uid);
  const edited = role !== user.role || active !== user.active;
  return <>
    <Heading>{user.displayName}</Heading>
    {user.email ? <Muted>{user.email}</Muted> : null}
    <Muted>Mã tài khoản · {user.id}</Muted>
    <Card>
      <Label>Đơn đang xử lý · {user.activeOrderCount}</Label>
      {user.shops.map(shop => <Muted key={shop.id}>Chủ quán · {shop.name}</Muted>)}
    </Card>
    <Label>Vai trò</Label>
    <Row>{roles.map(value => <Choice key={value} title={roleLabel[value]} selected={role === value} onPress={() => setRole(value)} />)}</Row>
    <Label>Trạng thái</Label>
    <Row>
      <Choice title="Hoạt động" selected={active} onPress={() => setActive(true)} />
      <Choice title="Khóa tài khoản" selected={!active} onPress={() => setActive(false)} />
    </Row>
    {user.activeOrderCount > 0 ? <Muted>Chờ các đơn đang xử lý kết thúc trước khi đổi quyền.</Muted> : null}
    <Notice>{action.message}</Notice>
    <Button title="Lưu quyền tài khoản" testID="save-user-permissions"
      disabled={!edited || action.busy || user.activeOrderCount > 0} onPress={() => action.run(async () => {
        await action.write('patch', `/admin/users/${encodeURIComponent(user.id)}`, {
          expectedRole: user.role, expectedActive: user.active, role, active,
        });
        refresh();
      })} />
    {action.message ? <Button outline title="Tải lại tài khoản" onPress={refresh} /> : null}
  </>;
}

export function ApproveDriver({ route, navigation }) {
  const uid = useSession().user.uid;
  const { shopId } = route.params;
  const action = useOperation(uid);
  const load = useCallback(cursor => operationsData.users(uid, { role: 'driver', active: 'true' }, cursor), [uid]);
  return <PagedList load={load} empty="Chưa có tài xế hoạt động."
    header={<Card><Label>Chọn tài xế để duyệt tại quán</Label><Notice>{action.message}</Notice></Card>}
    render={driver => <Button outline title={driver.displayName} testID={`approve-${driver.id}`} disabled={action.busy}
      onPress={() => action.run(async () => {
        await action.write('put', `/shops/${shopId}/drivers/${encodeURIComponent(driver.id)}`, { approved: true, active: true });
        navigation.goBack();
      })} />} />;
}
