import React, { useState } from 'react';
import { useSession } from '../../auth/SessionContext';
import { askAi } from '../../services/aiData';
import { Button, Card, Field, Heading, Label, Muted, Notice, Page, Tile, useAction } from '../P02/CustomerUI';
import { AiStatus } from './AiStatus';

const day = 86_400_000;
const today = offset => new Date(Date.now() + 7 * 3600_000 + offset * day).toISOString().slice(0, 10);
const sentimentLabel = { POSITIVE: 'Điểm sao thiên về tích cực', NEGATIVE: 'Điểm sao thấp',
  NEUTRAL: 'Điểm sao trung tính', MIXED: 'Điểm sao trái chiều' };

function parseDate(value) {
  const date = value.trim();
  const ms = Date.parse(date + 'T00:00:00+07:00');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(ms) ||
    new Date(ms + 7 * 3600_000).toISOString().slice(0, 10) !== date) throw new Error('Nhập ngày theo mẫu YYYY-MM-DD.');
  return ms;
}

export function ReviewInsights({ route }) {
  const uid = useSession().user.uid;
  const { shopId } = route.params;
  const [start, setStart] = useState(() => today(-29));
  const [end, setEnd] = useState(() => today(0));
  const [result, setResult] = useState(null);
  const [shortage, setShortage] = useState(null);
  const [opened, setOpened] = useState(null);
  const query = useAction();

  function edit(setter, text) {
    setter(text);
    setResult(null);
    setShortage(null);
    setOpened(null);
  }

  function run() {
    query.run(async () => {
      const from = parseDate(start);
      const until = parseDate(end) + day;
      if (until <= from || until - from > 90 * day) throw new Error('Chọn khoảng ngày tối đa 90 ngày.');
      setResult(null);
      setShortage(null);
      setOpened(null);
      try {
        setResult(await askAi(uid, 'review-insights', { shopId, startInclusive: new Date(from).toISOString(),
          endExclusive: new Date(until).toISOString() }));
      } catch (error) {
        if (error.code !== 'INSUFFICIENT_DATA') throw error;
        setShortage(error.details?.sampleSize ?? 0);
      }
    });
  }

  const sources = new Map(result?.sources.map(source => [source.reviewId, source]));
  return <Page>
    <Heading>Phân tích đánh giá</Heading>
    <Card>
      <Field label="Từ ngày (YYYY-MM-DD)" testID="insights-start" value={start} maxLength={10}
        editable={!query.busy} onChangeText={text => edit(setStart, text)} />
      <Field label="Đến hết ngày (YYYY-MM-DD)" testID="insights-end" value={end} maxLength={10}
        editable={!query.busy} onChangeText={text => edit(setEnd, text)} />
      <Muted>Khoảng ngày tính theo giờ Việt Nam.</Muted>
      <Button title={query.busy ? 'Đang phân tích…' : 'Phân tích'} testID="run-review-insights" disabled={query.busy} onPress={run} />
      <Notice>{query.message}</Notice>
    </Card>
    {shortage !== null ? <Card><Label>Chưa đủ đánh giá</Label>
      <Muted>{shortage} đánh giá đã xác minh trong khoảng ngày đã chọn. Cần ít nhất 3 đánh giá.</Muted>
    </Card> : null}
    {result ? <>
      <Card>
        <AiStatus result={result} date={result.generatedAt} />
        <Muted>{result.summary}</Muted>
        {result.sampled ? <Muted>Đã lấy mẫu các đánh giá gần nhất trong khoảng ngày.</Muted> : null}
        {result.fixtureCount ? <Muted>Có {result.fixtureCount} đánh giá mẫu dùng cho demo.</Muted> : null}
      </Card>
      {result.themes.map(theme => <Card key={theme.topic}>
        <Label>{theme.label}</Label>
        <Muted>{sentimentLabel[theme.sentiment]}</Muted>
        {theme.evidenceReviewIds.map((id, index) => {
          const source = sources.get(id);
          if (!source) return null;
          const sourceKey = theme.topic + ':' + id;
          return <React.Fragment key={id}>
            <Tile title={`Mở đánh giá nguồn ${index + 1}`} trailing={source.rating + ' sao'}
              testID={`insight-source-${theme.topic}-${index}`}
              onPress={() => setOpened(value => value === sourceKey ? null : sourceKey)} />
            {opened === sourceKey ? <Card>
              <Muted>{new Date(source.createdAt).toLocaleDateString('vi-VN')}{source.fixture ? ' · Dữ liệu mẫu' : ''}</Muted>
              <Muted testID="insight-source-text">{source.text}</Muted>
            </Card> : null}
          </React.Fragment>;
        })}
      </Card>)}
      {result.suggestedActions.length ? <Card>
        <Label>Việc có thể thử</Label>
        {result.suggestedActions.map(action => <Muted key={action}>{action}</Muted>)}
      </Card> : null}
    </> : null}
  </Page>;
}
