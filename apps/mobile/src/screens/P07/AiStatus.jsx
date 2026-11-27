import React from 'react';
import { Label, Muted } from '../P02/CustomerUI';

export function AiStatus({ result, date }) {
  const source = result.generatedBy === 'MODEL' ? 'Kết quả từ mô hình AI' : 'Kết quả dự phòng';
  return <>
    <Label>{source}</Label>
    <Muted>{new Date(date).toLocaleString('vi-VN')}{result.cached ? ' · Đã lưu từ lượt trước' : ''}</Muted>
  </>;
}
