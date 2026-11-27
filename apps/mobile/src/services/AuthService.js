import {
  createUserWithEmailAndPassword, EmailAuthProvider, getIdToken,
  reauthenticateWithCredential, reload, sendEmailVerification,
  sendPasswordResetEmail, signInWithEmailAndPassword, signOut,
  updatePassword, updateProfile,
} from '@react-native-firebase/auth';
import { getFirebaseRuntime } from '../firebase/runtime';

let sessionReady;

async function updateSession(action) {
  if (sessionReady) { throw new Error('Đang cập nhật phiên đăng nhập. Vui lòng chờ.'); }
  let release;
  sessionReady = new Promise(resolve => { release = resolve; });
  try { return await action(); }
  finally { sessionReady = undefined; release(); }
}

function currentUserFor(uid) {
  const currentUser = getFirebaseRuntime().auth.currentUser;
  if (!currentUser || currentUser.uid !== uid) {
    const error = new Error('Tài khoản đã thay đổi.');
    error.code = 'SESSION_CHANGED';
    throw error;
  }
  return currentUser;
}

export class AuthService {
  static async login(email, password) {
    return signInWithEmailAndPassword(getFirebaseRuntime().auth, email.trim(), password);
  }
  static async register(displayName, email, password) {
    return updateSession(async () => {
      const credential = await createUserWithEmailAndPassword(getFirebaseRuntime().auth, email.trim(), password);
      await updateProfile(credential.user, { displayName: displayName.trim() });
      await sendEmailVerification(credential.user);
      await getIdToken(credential.user, true);
      return credential;
    });
  }
  static async prepareSession(user) {
    // Firebase emits sign-in before updateProfile finishes during registration.
    // Bootstrap only after the entered name is present; never overwrite an
    // existing Firestore profile to repair that ordering race.
    if (sessionReady) { await sessionReady; }
    return currentUserFor(user.uid);
  }
  static async sendVerification() {
    const user = getFirebaseRuntime().auth.currentUser;
    if (!user) { throw new Error('Vui lòng đăng nhập lại.'); }
    await sendEmailVerification(user);
  }
  static async reloadSession() {
    const { auth } = getFirebaseRuntime();
    if (auth.currentUser) {
      await reload(auth.currentUser);
      await getIdToken(auth.currentUser, true);
    }
    return auth.currentUser;
  }
  static async resetPassword(email) {
    await sendPasswordResetEmail(getFirebaseRuntime().auth, email.trim());
  }
  static async changePassword(currentPassword, newPassword) {
    const user = getFirebaseRuntime().auth.currentUser;
    if (!user?.email || !user.providerData.some(provider => provider.providerId === 'password')) {
      throw new Error('Tài khoản này không sử dụng mật khẩu email.');
    }
    return updateSession(async () => {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
      await updatePassword(currentUserFor(user.uid), newPassword);
      // A password change revokes older authentication times. Establish a new
      // authenticated session before the API verifier checks revocation again.
      await reauthenticateWithCredential(currentUserFor(user.uid), EmailAuthProvider.credential(user.email, newPassword));
      await getIdToken(currentUserFor(user.uid), true);
    });
  }
  static async logout() { await signOut(getFirebaseRuntime().auth); }
}
