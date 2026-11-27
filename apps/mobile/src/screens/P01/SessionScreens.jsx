import React, { useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Theme } from '../../theme';
import { AuthService } from '../../services/AuthService';
import { ProfileService } from '../../services/ProfileService';
import { newIntentKey } from '../../api/clientCore';
import { useSession } from '../../auth/SessionContext';

const roleNames = { customer: 'Khách hàng', merchant: 'Nhà hàng', driver: 'Tài xế', admin: 'Quản trị viên' };
const authErrors = {
  'auth/invalid-email': 'Địa chỉ email chưa đúng.',
  'auth/invalid-credential': 'Email hoặc mật khẩu chưa đúng.',
  'auth/wrong-password': 'Email hoặc mật khẩu chưa đúng.',
  'auth/user-not-found': 'Email hoặc mật khẩu chưa đúng.',
  'auth/email-already-in-use': 'Email đã được đăng ký. Hãy đăng nhập hoặc khôi phục mật khẩu.',
  'auth/weak-password': 'Mật khẩu chưa đủ mạnh. Hãy chọn mật khẩu dài hơn.',
  'auth/too-many-requests': 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.',
  'auth/network-request-failed': 'Không kết nối được dịch vụ đăng nhập. Kiểm tra mạng rồi thử lại.',
  'auth/requires-recent-login': 'Hãy đăng nhập lại để thực hiện thao tác bảo mật này.',
  'auth/user-disabled': 'Tài khoản đã bị vô hiệu hóa. Liên hệ quản trị viên.',
  EMAIL_NOT_VERIFIED: 'Hãy xác minh email trước khi cập nhật hồ sơ.',
};
const errorMessage = error => authErrors[error.code] || error.message || 'Chưa thực hiện được. Vui lòng thử lại.';

function Page({ title, subtitle, children }) {
  return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.brand}><Text style={styles.brandIcon}>F</Text><Text style={styles.brandName}>FoodOrderNext</Text></View>
        <Text style={styles.title} accessibilityRole="header">{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
function Field({ label, testID, value, onChangeText, password, keyboardType = 'default', autoComplete, maxLength }) {
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput testID={testID} accessibilityLabel={label} style={styles.input} value={value}
      onChangeText={onChangeText} autoCapitalize="none" autoCorrect={false}
      secureTextEntry={Boolean(password)} keyboardType={keyboardType}
      autoComplete={autoComplete} maxLength={maxLength || 254} />
  </View>;
}
function Button({ title, onPress, busy, secondary, testID, disabled }) {
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={title}
    disabled={Boolean(busy || disabled)} onPress={onPress}
    style={({ pressed }) => [styles.button, secondary && styles.secondaryButton,
      (busy || disabled) && styles.disabled, pressed && styles.pressed]}>
    {busy ? <ActivityIndicator color={secondary ? Theme.colors.primary : '#fff'} /> :
      <Text style={[styles.buttonText, secondary && styles.secondaryButtonText]}>{title}</Text>}
  </Pressable>;
}
function Notice({ children, success }) {
  return children ? <Text accessibilityRole="alert" style={[styles.notice, success && styles.success]}>{children}</Text> : null;
}
function useTask() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const inFlight = useRef(false);
  return { busy, message, success, async run(task, successText) {
    if (inFlight.current) { return; }
    inFlight.current = true; setBusy(true); setMessage(''); setSuccess(false);
    try { await task(); if (successText) { setMessage(successText); setSuccess(true); } }
    catch (error) { setMessage(errorMessage(error)); }
    finally { inFlight.current = false; setBusy(false); }
  } };
}

export function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const task = useTask();
  return <Page title="Chào bạn trở lại" subtitle="Đăng nhập để quản lý tài khoản của bạn.">
    <Field label="Email" testID="login-email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" />
    <Field label="Mật khẩu" testID="login-password" value={password} onChangeText={setPassword} password autoComplete="current-password" />
    <Notice>{task.message}</Notice>
    <Button title="Đăng nhập" testID="login-submit" busy={task.busy} onPress={() => task.run(() => {
      if (!email.trim() || !password) { throw new Error('Nhập email và mật khẩu để tiếp tục.'); }
      return AuthService.login(email, password);
    })} />
    <Button title="Quên mật khẩu?" secondary onPress={() => navigation.navigate('ResetPassword')} />
    <View style={styles.divider} />
    <Text style={styles.body}>Chưa có tài khoản?</Text>
    <Button title="Tạo tài khoản" secondary onPress={() => navigation.navigate('Register')} />
  </Page>;
}
export function RegisterScreen() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const task = useTask();
  return <Page title="Tạo tài khoản" subtitle="Tài khoản mới dành cho khách hàng. Bạn có thể xác minh email ngay sau khi đăng ký.">
    <Field label="Tên hiển thị" testID="register-name" value={displayName} onChangeText={setDisplayName} maxLength={80} autoComplete="name" />
    <Field label="Email" testID="register-email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" />
    <Field label="Mật khẩu mới (ít nhất 8 ký tự)" testID="register-password" value={password} onChangeText={setPassword} password autoComplete="new-password" />
    <Field label="Nhập lại mật khẩu" testID="register-confirm" value={confirm} onChangeText={setConfirm} password autoComplete="new-password" />
    <Notice>{task.message}</Notice>
    <Button title="Đăng ký" testID="register-submit" busy={task.busy} onPress={() => task.run(async () => {
      if (displayName.trim().length < 2) { throw new Error('Tên hiển thị cần ít nhất 2 ký tự.'); }
      if (password.length < 8 || password !== confirm) { throw new Error('Mật khẩu cần ít nhất 8 ký tự và hai lần nhập phải giống nhau.'); }
      await AuthService.register(displayName, email, password);
    })} />
  </Page>;
}
export function ResetPasswordScreen() {
  const [email, setEmail] = useState('');
  const task = useTask();
  return <Page title="Khôi phục mật khẩu" subtitle="Chúng tôi sẽ gửi hướng dẫn nếu email này có tài khoản phù hợp.">
    <Field label="Email" testID="reset-email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" />
    <Notice success={task.success}>{task.message}</Notice>
    <Button title="Gửi hướng dẫn" testID="reset-submit" busy={task.busy} onPress={() => task.run(async () => {
      if (!email.trim()) { throw new Error('Vui lòng nhập email.'); }
      try { await AuthService.resetPassword(email); } catch (error) {
        if (error.code !== 'auth/user-not-found') { throw error; }
      }
    }, 'Nếu email có tài khoản phù hợp, hướng dẫn đã được gửi. Kiểm tra hộp thư và thư rác.')} />
  </Page>;
}
export function VerifyEmailScreen() {
  const session = useSession();
  const task = useTask();
  return <Page title="Xác minh email" subtitle={`Mở liên kết xác minh được gửi đến ${session.user?.email || 'email của bạn'}, rồi quay lại đây.`}>
    <View style={styles.card}><Text style={styles.cardTitle}>Bảo vệ tài khoản của bạn</Text>
      <Text style={styles.body}>Bạn cần xác minh email trước khi dùng các chức năng của tài khoản.</Text></View>
    <Notice success={task.success}>{task.message}</Notice>
    <Button title="Tôi đã xác minh, kiểm tra lại" testID="verify-refresh" busy={task.busy} onPress={() => task.run(session.refresh)} />
    <Button title="Gửi lại email xác minh" testID="verify-resend" secondary disabled={task.busy}
      onPress={() => task.run(AuthService.sendVerification, 'Email xác minh đã được gửi lại.')} />
    <Button title="Đăng xuất" testID="logout" secondary disabled={task.busy} onPress={() => task.run(session.logout)} />
  </Page>;
}
export function SessionGateScreen() {
  const session = useSession();
  const task = useTask();
  if (session.phase === 'loading') {
    return <Page title="Đang khôi phục phiên"><ActivityIndicator size="large" color={Theme.colors.primary} /><Text style={styles.body}>Đang xác minh tài khoản và quyền truy cập.</Text></Page>;
  }
  const locked = session.phase === 'locked';
  return <Page title={locked ? 'Tài khoản chưa được phép truy cập' : 'Chưa tải được tài khoản'}
    subtitle={locked ? 'Quyền truy cập đã thay đổi hoặc tài khoản đang bị khóa. Liên hệ quản trị viên nếu cần hỗ trợ.' : session.error}>
    <Notice>{task.message}</Notice>
    <Button title="Kiểm tra lại" testID="session-retry" busy={task.busy} onPress={() => task.run(session.refresh)} />
    <Button title="Đăng xuất" testID="logout" secondary disabled={task.busy} onPress={() => task.run(session.logout)} />
  </Page>;
}
export function RoleHomeScreen({ navigation }) {
  const { profile } = useSession();
  return <Page title={`Xin chào, ${profile.displayName || 'bạn'}`} subtitle={`Khu vực ${roleNames[profile.role]}`}>
    <View style={styles.card}>
      <Text style={styles.pill}>EMAIL ĐÃ XÁC MINH</Text>
      <Text style={styles.cardTitle}>Tài khoản của bạn đã sẵn sàng</Text>
      <Text style={styles.body}>Bạn có thể xem hồ sơ, cập nhật thông tin liên hệ và quản lý mật khẩu.</Text>
    </View>
    <Button title="Hồ sơ và bảo mật" testID="open-profile" onPress={() => navigation.navigate('Profile')} />
  </Page>;
}
export function ProfileScreen({ navigation }) {
  const session = useSession();
  const task = useTask();
  const profile = session.profile;
  const passwordUser = session.user.providerData?.some(provider => provider.providerId === 'password');
  return <Page title="Hồ sơ của bạn" subtitle="Thông tin được lưu cho tài khoản hiện tại.">
    <View style={styles.card}>
      <Text style={styles.label}>Tên hiển thị</Text><Text style={styles.value}>{profile.displayName}</Text>
      <Text style={styles.label}>Email</Text><Text style={styles.value}>{session.user.email}</Text>
      <Text style={styles.label}>Điện thoại</Text><Text style={styles.value}>{profile.phone || 'Chưa cập nhật'}</Text>
      <Text style={styles.label}>Vai trò</Text><Text style={styles.value}>{roleNames[profile.role]}</Text>
    </View>
    <Button title="Chỉnh sửa hồ sơ" testID="profile-edit" onPress={() => navigation.navigate('EditProfile')} />
    {passwordUser ? <Button title="Đổi mật khẩu" testID="open-change-password" secondary onPress={() => navigation.navigate('ChangePassword')} /> : null}
    {session.phase === 'ready' ? <Button title="Thông báo đơn hàng" secondary onPress={() => navigation.navigate('NotificationSettings')} /> : null}
    <Notice>{task.message}</Notice>
    <Button title="Đăng xuất" testID="logout" secondary busy={task.busy} onPress={() => task.run(session.logout)} />
  </Page>;
}
export function EditProfileScreen({ navigation }) {
  const { profile } = useSession();
  const [displayName, setDisplayName] = useState(profile.displayName || '');
  const [phone, setPhone] = useState(profile.phone || '');
  const attempt = useRef(null);
  const task = useTask();
  return <Page title="Chỉnh sửa hồ sơ" subtitle="Tên hiển thị và số điện thoại liên hệ.">
    <Field label="Tên hiển thị" testID="profile-displayName" value={displayName} onChangeText={setDisplayName} maxLength={80} autoComplete="name" />
    <Field label="Số điện thoại (không bắt buộc)" testID="profile-phone" value={phone} onChangeText={setPhone} maxLength={20} keyboardType="phone-pad" autoComplete="tel" />
    <Notice>{task.message}</Notice>
    <Button title="Lưu thay đổi" testID="profile-save" busy={task.busy} onPress={() => task.run(async () => {
      if (displayName.trim().length < 2) { throw new Error('Tên hiển thị cần ít nhất 2 ký tự.'); }
      const values = { displayName: displayName.trim(), phone: phone.trim() };
      const fingerprint = JSON.stringify(values);
      if (attempt.current?.fingerprint !== fingerprint) { attempt.current = { fingerprint, key: newIntentKey() }; }
      await ProfileService.updateProfile(values, attempt.current.key);
      attempt.current = null;
      navigation.goBack();
    })} />
  </Page>;
}
export function ChangePasswordScreen() {
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const task = useTask();
  return <Page title="Đổi mật khẩu" subtitle="Xác minh mật khẩu hiện tại trước khi đặt mật khẩu mới.">
    <Field label="Mật khẩu hiện tại" testID="change-current" value={current} onChangeText={setCurrent} password autoComplete="current-password" />
    <Field label="Mật khẩu mới (ít nhất 8 ký tự)" testID="change-new" value={password} onChangeText={setPassword} password autoComplete="new-password" />
    <Field label="Nhập lại mật khẩu mới" testID="change-confirm" value={confirm} onChangeText={setConfirm} password autoComplete="new-password" />
    <Notice success={task.success}>{task.message}</Notice>
    <Button title="Cập nhật mật khẩu" testID="change-submit" busy={task.busy} onPress={() => task.run(async () => {
      if (!current || password.length < 8 || password !== confirm || current === password) {
        throw new Error('Nhập mật khẩu hiện tại và mật khẩu mới khác, ít nhất 8 ký tự; xác nhận phải trùng khớp.');
      }
      await AuthService.changePassword(current, password);
      setCurrent(''); setPassword(''); setConfirm('');
    }, 'Mật khẩu đã được cập nhật.')} />
  </Page>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Theme.colors.background.light }, fill: { flex: 1 },
  content: { padding: Theme.spacing.xl, paddingBottom: Theme.spacing.xxxl, flexGrow: 1 },
  brand: { flexDirection: 'row', alignItems: 'center', marginBottom: 32, gap: 10 },
  brandIcon: { color: '#fff', backgroundColor: Theme.colors.primary, fontSize: 22, fontWeight: '900', width: 38, height: 38, textAlign: 'center', lineHeight: 38, borderRadius: 12 },
  brandName: { fontSize: 19, fontWeight: '800', color: Theme.colors.text.primaryLight },
  title: { fontSize: 29, lineHeight: 36, fontWeight: '800', color: Theme.colors.text.primaryLight, marginBottom: 12 },
  subtitle: { color: '#62626b', fontSize: 15, lineHeight: 23, marginBottom: 28 },
  field: { marginBottom: 18 }, label: { fontSize: 14, fontWeight: '600', color: '#4c4c56', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: Theme.colors.border, borderRadius: Theme.radius.standard, backgroundColor: '#fff', color: '#1a1a1a', paddingHorizontal: 15, paddingVertical: 13, fontSize: 16, minHeight: 52 },
  button: { backgroundColor: Theme.colors.primary, borderRadius: Theme.radius.standard, padding: 16, alignItems: 'center', justifyContent: 'center', minHeight: 54, marginBottom: 12 },
  secondaryButton: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e4e4e8' },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 }, secondaryButtonText: { color: Theme.colors.primary },
  pressed: { opacity: 0.8 }, disabled: { opacity: 0.55 }, notice: { color: '#ad2639', lineHeight: 22, marginBottom: 16 }, success: { color: '#256b43' },
  divider: { height: 1, backgroundColor: Theme.colors.border, marginVertical: 18 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e9e9ed', borderRadius: Theme.radius.large, padding: 22, marginBottom: 24 },
  cardTitle: { fontSize: 20, fontWeight: '700', color: '#22222b', marginBottom: 12 },
  body: { fontSize: 15, lineHeight: 23, color: '#62626b', marginBottom: 14 },
  value: { fontSize: 17, color: '#22222b', marginBottom: 20 }, pill: { color: '#328252', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 18 },
});
