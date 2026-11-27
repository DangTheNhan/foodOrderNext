import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { imageUrl } from '../../services/customerData';

export const palette = { ink: '#272017', muted: '#655D52', orange: '#A33416', light: '#FDF8F1', card: '#FFFFFF', border: '#EBDDCE' };
const formatter = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
export const money = amount => formatter.format(amount);
const readError = error => error.status === 403 || error.code?.includes('permission-denied')
  ? 'Không có quyền xem dữ liệu này.'
  : 'Không tải được dữ liệu. Hãy kiểm tra kết nối.';

export function useRead(load) {
  const focused = useIsFocused();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ loading: true });
  const retry = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    if (!focused) return;
    let active = true;
    setState({ loading: true });
    load().then(data => {
      if (active) setState({ data });
    }).catch(error => {
      if (active) setState({ error: readError(error) });
    });
    return () => { active = false; };
  }, [focused, load, revision]);
  return { ...state, retry };
}

export function useAction() {
  const pending = useRef(false);
  const [state, setState] = useState({ busy: false, message: '', success: false });
  return { ...state, async run(task, success) {
    if (pending.current) return;
    pending.current = true;
    setState({ busy: true, message: '', success: false });
    try {
      await task();
      setState({ busy: false, message: success ?? '', success: true });
    } catch (error) {
      setState({ busy: false, message: error.message || 'Chưa lưu được. Hãy thử lại.', success: false });
    } finally { pending.current = false; }
  } };
}

export function Page({ children }) {
  return <SafeAreaView edges={['bottom']} style={styles.fill}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>{children}</ScrollView>
  </SafeAreaView>;
}

export function PagedList({ load, render, header, empty, onFirstPage, refreshOnFocus = false, testID }) {
  const [state, setState] = useState({ rows: [], loading: true });
  const request = useRef(0);
  const inFlight = useRef(false);
  const fetchPage = useCallback(async (cursor = null) => {
    if (cursor && inFlight.current) return;
    const id = ++request.current;
    inFlight.current = true;
    setState(previous => cursor ? { ...previous, loading: true, error: null } : { rows: [], loading: true });
    try {
      const result = await load(cursor);
      if (id !== request.current) return;
      if (!cursor) onFirstPage?.(result);
      setState(previous => {
        const rows = cursor ? [...previous.rows, ...result.rows] : result.rows;
        return { rows: [...new Map(rows.map(row => [row.id, row])).values()], cursor: result.cursor };
      });
    } catch (error) {
      if (id === request.current) setState(previous => ({ ...previous, loading: false, error: readError(error) }));
    } finally {
      if (id === request.current) inFlight.current = false;
    }
  }, [load, onFirstPage]);
  useEffect(() => {
    if (!refreshOnFocus) fetchPage();
    return () => { request.current += 1; };
  }, [fetchPage, refreshOnFocus]);
  useFocusEffect(useCallback(() => {
    if (refreshOnFocus) fetchPage();
  }, [fetchPage, refreshOnFocus]));

  const footer = state.loading ? <ActivityIndicator color={palette.orange} accessibilityLabel="Đang tải" />
    : state.error ? <><Notice>{state.error}</Notice><Button title="Thử lại" outline onPress={() => fetchPage(state.cursor)} /></>
      : state.cursor ? <Button title="Xem thêm" outline onPress={() => fetchPage(state.cursor)} /> : null;
  return <SafeAreaView edges={['bottom']} style={styles.fill}>
    <FlatList testID={testID} data={state.rows} keyExtractor={row => row.id} renderItem={({ item }) => render(item)}
      keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}
      ListHeaderComponent={header}
      ListEmptyComponent={!state.loading && !state.error ? <Muted>{empty}</Muted> : null}
      ListFooterComponent={footer} />
  </SafeAreaView>;
}

export function Status({ resource, empty, children }) {
  if (resource.loading) return <ActivityIndicator color={palette.orange} accessibilityLabel="Đang tải" />;
  if (resource.error) return <><Notice>{resource.error}</Notice><Button title="Thử lại" outline onPress={resource.retry} /></>;
  if (!resource.data) return <Muted>{empty ?? 'Dữ liệu này hiện không khả dụng.'}</Muted>;
  return children(resource.data);
}

export function Button({ title, onPress, disabled, outline, testID }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: Boolean(disabled) }}
    testID={testID} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, outline && styles.outline, (disabled || pressed) && styles.dim]}>
    <Text style={[styles.buttonText, outline && styles.outlineText]}>{title}</Text>
  </Pressable>;
}

export function Field({ label, value, onChangeText, keyboardType, maxLength, multiline, testID, placeholder, editable = true }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text>
    <TextInput style={styles.input} accessibilityLabel={label} testID={testID}
      placeholder={placeholder} placeholderTextColor={palette.muted}
      value={value} onChangeText={onChangeText} keyboardType={keyboardType}
      multiline={multiline} maxLength={maxLength} editable={editable} />
  </View>;
}

export const Heading = ({ children }) => <Text accessibilityRole="header" style={styles.heading}>{children}</Text>;
export const Label = ({ children }) => <Text style={styles.label}>{children}</Text>;
export const Muted = ({ children, testID }) => <Text style={styles.muted} testID={testID}>{children}</Text>;
export const Notice = ({ children, success }) => children ? <Text accessibilityRole="alert"
  style={[styles.notice, success && styles.success]}>{children}</Text> : null;
export const Card = ({ children }) => <View style={styles.card}>{children}</View>;
export const Row = ({ children }) => <View style={styles.row}>{children}</View>;

export function Choice({ title, selected, onPress }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress}
    style={[styles.choice, selected && styles.selected]}>
    <Text style={styles.outlineText}>{title}</Text>
  </Pressable>;
}

export function Tile({ title, detail, trailing, onPress, testID }) {
  return <Pressable accessibilityRole="button" testID={testID} onPress={onPress}
    style={({ pressed }) => [styles.tile, pressed && styles.dim]}>
    <View style={styles.copy}><Label>{title}</Label>{detail ? <Muted>{detail}</Muted> : null}</View>
    <Text style={styles.outlineText}>{trailing ?? '›'}</Text>
  </Pressable>;
}

export function FoodPhoto({ path, name }) {
  const uri = imageUrl(path);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  return uri && !failed ? <Image accessibilityLabel={name} source={{ uri }} style={styles.photo} onError={() => setFailed(true)} />
    : <View style={styles.photoFallback}><Muted>Chưa có ảnh món</Muted></View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: palette.light },
  body: { paddingHorizontal: 18, paddingVertical: 18, gap: 12 },
  heading: { color: palette.ink, fontWeight: '800', fontSize: 28 },
  label: { color: palette.ink, fontWeight: '700', fontSize: 16 },
  muted: { color: palette.muted, fontSize: 14, lineHeight: 20 },
  card: { backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border, borderRadius: 16, padding: 14, gap: 9 },
  tile: { backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border, borderRadius: 14,
    minHeight: 62, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  copy: { flex: 1, gap: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  field: { gap: 6 },
  input: { backgroundColor: palette.card, color: palette.ink, borderRadius: 12, borderColor: palette.border,
    borderWidth: 1, minHeight: 46, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  button: { backgroundColor: palette.orange, borderRadius: 12, minHeight: 45, paddingHorizontal: 14, paddingVertical: 10,
    alignItems: 'center', justifyContent: 'center' },
  outline: { backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  outlineText: { color: palette.orange, fontSize: 14, fontWeight: '700' },
  dim: { opacity: 0.55 },
  choice: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, backgroundColor: palette.card,
    borderWidth: 1, borderColor: palette.border, borderRadius: 20 },
  selected: { backgroundColor: '#FCE5D5', borderColor: palette.orange },
  notice: { color: '#8C2816', backgroundColor: '#FBE7DC', borderRadius: 10, padding: 11 },
  success: { color: '#245139', backgroundColor: '#E5F2E8' },
  photo: { width: '100%', height: 200, borderRadius: 14 },
  photoFallback: { minHeight: 78, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3E8DA', borderRadius: 14 },
});
