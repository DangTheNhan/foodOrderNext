import { useRef } from 'react';
import { newIntentKey } from '../../api/clientCore';
import { operationsData } from '../../services/operationsData';
import { useAction } from '../P02/CustomerUI';

export const roleLabel = { customer: 'Khách hàng', merchant: 'Nhà hàng', driver: 'Tài xế', admin: 'Quản trị viên' };
export const assignmentLabel = { UNASSIGNED: 'Chưa gán', ASSIGNED: 'Đã gán, chờ tài xế nhận', ACCEPTED: 'Tài xế đã nhận' };

export function wholeNumber(input, name, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const value = Number(String(input).trim());
  if (!/^\d+$/.test(String(input).trim()) || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} phải là số nguyên từ ${min} đến ${max}.`);
  }
  return value;
}

export function useOperation(uid) {
  const action = useAction();
  const last = useRef(null);
  return { ...action, async write(method, path, body) {
    const signature = JSON.stringify([method, path, body]);
    if (signature !== last.current?.signature) last.current = { signature, key: newIntentKey() };
    const result = await operationsData.write(uid, method, path, body, last.current.key);
    last.current = null;
    return result;
  } };
}
