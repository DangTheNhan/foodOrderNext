jest.mock('../src/firebase/runtime', () => ({ getFirebaseRuntime: jest.fn() }));
jest.mock('@react-native-firebase/auth', () => ({
  createUserWithEmailAndPassword: jest.fn(), updateProfile: jest.fn(), sendEmailVerification: jest.fn(),
  sendPasswordResetEmail: jest.fn(), signInWithEmailAndPassword: jest.fn(), signOut: jest.fn(),
  getIdToken: jest.fn(), reload: jest.fn(), reauthenticateWithCredential: jest.fn(), updatePassword: jest.fn(),
  EmailAuthProvider: { credential: jest.fn(() => 'credential') },
}));
import * as firebaseAuth from '@react-native-firebase/auth';
import { getFirebaseRuntime } from '../src/firebase/runtime';
import { AuthService } from '../src/services/AuthService';

let user;
beforeEach(() => {
  jest.clearAllMocks();
  user = { uid: 'a', email: 'demo@example.test', providerData: [{ providerId: 'password' }] };
  getFirebaseRuntime.mockReturnValue({ auth: { currentUser: user } });
});
test('register uses Firebase, sets name and sends verification, never sends a role', async () => {
  firebaseAuth.createUserWithEmailAndPassword.mockResolvedValue({ user });
  await AuthService.register(' Demo ', ' demo@example.test ', 'Password123!');
  expect(firebaseAuth.createUserWithEmailAndPassword).toHaveBeenCalledWith(expect.any(Object), 'demo@example.test', 'Password123!');
  expect(firebaseAuth.updateProfile).toHaveBeenCalledWith(user, { displayName: 'Demo' });
  expect(firebaseAuth.sendEmailVerification).toHaveBeenCalledWith(user);
});
test('password update reauthenticates with old password before setting new one', async () => {
  await AuthService.changePassword('old-password', 'new-password');
  expect(firebaseAuth.EmailAuthProvider.credential).toHaveBeenCalledWith(user.email, 'old-password');
  expect(firebaseAuth.reauthenticateWithCredential.mock.invocationCallOrder[0]).toBeLessThan(firebaseAuth.updatePassword.mock.invocationCallOrder[0]);
});

test('registration sign-in waits for the entered name before preparing bootstrap', async () => {
  let finishProfile;
  firebaseAuth.createUserWithEmailAndPassword.mockResolvedValue({ user });
  firebaseAuth.updateProfile.mockImplementationOnce(() => new Promise(resolve => { finishProfile = resolve; }));
  const registration = AuthService.register('Entered name', user.email, 'Password123!');
  await Promise.resolve();
  let prepared = false;
  const pending = AuthService.prepareSession(user).then(value => { prepared = true; return value; });
  await Promise.resolve();
  expect(prepared).toBe(false);
  user.displayName = 'Entered name';
  finishProfile();
  await registration;
  await expect(pending).resolves.toMatchObject({ displayName: 'Entered name' });
});
test('failed reauthentication never updates password', async () => {
  firebaseAuth.reauthenticateWithCredential.mockRejectedValueOnce(new Error('wrong password'));
  await expect(AuthService.changePassword('wrong', 'new')).rejects.toThrow('wrong password');
  expect(firebaseAuth.updatePassword).not.toHaveBeenCalled();
});

test('password change establishes fresh authentication before resuming API hydration', async () => {
  await AuthService.changePassword('old-password', 'new-password');
  expect(firebaseAuth.EmailAuthProvider.credential).toHaveBeenNthCalledWith(2, user.email, 'new-password');
  expect(firebaseAuth.reauthenticateWithCredential.mock.invocationCallOrder[1])
    .toBeGreaterThan(firebaseAuth.updatePassword.mock.invocationCallOrder[0]);
  expect(firebaseAuth.getIdToken).toHaveBeenCalledWith(user, true);
});
test('Google-only account cannot call password flow', async () => {
  user.providerData = [{ providerId: 'google.com' }];
  await expect(AuthService.changePassword('old', 'new')).rejects.toThrow('không sử dụng');
  expect(firebaseAuth.reauthenticateWithCredential).not.toHaveBeenCalled();
});
test('verification reload forces new token for backend email_verified claim', async () => {
  await AuthService.reloadSession();
  expect(firebaseAuth.reload).toHaveBeenCalledWith(user);
  expect(firebaseAuth.getIdToken).toHaveBeenCalledWith(user, true);
});
