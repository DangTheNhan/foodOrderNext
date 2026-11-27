import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Muted, Notice, palette } from '../P02/CustomerUI';

function readError(error) {
  return error.code?.includes('permission-denied') || error.status === 403
    ? 'Bạn không còn quyền xem dữ liệu này.' : 'Mất kết nối dữ liệu. Hãy thử lại.';
}

export function useScopedOrder(observe) {
  const [state, setState] = useState({ waiting: true });
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision(value => value + 1), []);
  useFocusEffect(useCallback(() => {
    let active = true;
    setState({ waiting: true, revision });
    let unsubscribe;
    try { unsubscribe = observe(next => {
      if (!active) return;
      setState(previous => next.stale ? { ...previous, waiting: !previous.order, stale: true } : next);
    }, error => { if (active) setState({ error: readError(error) }); }); }
    catch (error) { setState({ error: readError(error) }); }
    return () => { active = false; unsubscribe?.(); };
  }, [observe, revision]));
  return { ...state, retry };
}

export function useLiveFeed({ listen, older, pageSize = 20, maxWindow = 60 }) {
  const [size, setSize] = useState(pageSize);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ rows: [], initial: true });
  const live = useRef(null);
  const retry = useCallback(() => setRevision(value => value + 1), []);
  useFocusEffect(useCallback(() => {
    const handle = { revision, tail: null, cursor: null, pending: false, pagesLoaded: false };
    live.current = handle;
    setState({ rows: [], initial: true });
    let unsubscribe;
    try { unsubscribe = listen(size, snapshot => {
      if (live.current !== handle) return;
      if (snapshot.stale) {
        setState(previous => ({ ...previous, stale: true }));
        return;
      }
      const end = snapshot.cursor?.id ?? null;
      const changed = handle.tail !== end;
      if (changed) {
        handle.cursor = snapshot.cursor;
        handle.pagesLoaded = false;
      } else if (!handle.pagesLoaded) {
        handle.cursor = snapshot.cursor;
      }
      handle.tail = end;
      setState(previous => ({ rows: snapshot.rows, olderRows: changed ? [] : previous.olderRows,
        cursor: handle.cursor, loadingMore: handle.pending }));
    }, error => {
      if (live.current === handle) { live.current = null; setState({ rows: [], error: readError(error) }); }
    }); }
    catch (error) { live.current = null; setState({ rows: [], error: readError(error) }); }
    return () => { live.current = null; unsubscribe?.(); };
  }, [listen, revision, size]));

  async function more() {
    const handle = live.current;
    if (!handle?.cursor || handle.pending || state.stale) return;
    if (!older) { setSize(current => Math.min(current + pageSize, maxWindow)); return; }
    const end = handle.tail;
    handle.pending = true;
    setState(previous => ({ ...previous, loadingMore: true, pageError: null }));
    try {
      const result = await older(pageSize, handle.cursor);
      if (live.current !== handle || end !== handle.tail) return;
      handle.pagesLoaded = true;
      handle.cursor = result.cursor;
      setState(previous => ({ ...previous, olderRows: [...(previous.olderRows ?? []), ...result.rows], cursor: result.cursor }));
    } catch (error) {
      if (live.current === handle) setState(previous => ({ ...previous, pageError: readError(error) }));
    } finally {
      handle.pending = false;
      if (live.current === handle) setState(previous => ({ ...previous, loadingMore: false }));
    }
  }

  const rowsById = new Map(state.rows.map(row => [row.id, row]));
  for (const row of state.olderRows ?? []) if (!rowsById.has(row.id)) rowsById.set(row.id, row);
  const rows = [...rowsById.values()];
  return { ...state, rows, more, retry, canPage: Boolean(state.cursor && (older || size < maxWindow)),
    capped: Boolean(state.cursor && !older && size >= maxWindow) };
}

export function LiveList({ feed, header, render, empty, testID, dock }) {
  const footer = <View style={styles.gap}>
    {feed.initial ? <ActivityIndicator color={palette.orange} /> : null}
    {feed.error ? <><Notice>{feed.error}</Notice><Button outline title="Thử lại" onPress={feed.retry} /></> : null}
    {feed.pageError ? <Notice>{feed.pageError}</Notice> : null}
    {feed.canPage ? <Button outline title={feed.loadingMore ? 'Đang tải…' : 'Xem thêm'}
      disabled={feed.loadingMore || feed.stale} onPress={feed.more} /> : null}
    {feed.capped ? <Muted>Đang theo dõi tối đa 60 đơn trong lượt xem này.</Muted> : null}
  </View>;
  return <SafeAreaView edges={['bottom']} style={styles.fill}>
    <FlatList testID={testID} data={feed.rows} keyExtractor={item => item.id} renderItem={({ item }) => render(item)}
      contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled"
      ListHeaderComponent={<View style={styles.gap}>{header}
        {feed.stale ? <Notice>Đang kết nối lại. Dữ liệu có thể chưa cập nhật.</Notice> : null}</View>}
      ListEmptyComponent={!feed.initial && !feed.error && !feed.stale ? <Muted>{empty}</Muted> : null}
      ListFooterComponent={footer} />
    {dock ? <View style={styles.dock}>{dock}</View> : null}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: palette.light },
  body: { paddingHorizontal: 18, paddingVertical: 18, gap: 12 },
  gap: { gap: 8 },
  dock: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12 },
});
