import { randomUUID } from 'node:crypto';
import { initializeApp, applicationDefault, cert, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getMessaging } from 'firebase-admin/messaging';
import { IMAGE_CONTENT_TYPES, MAX_IMAGE_BYTES } from '@foodordernext/contracts';
import { ApiError } from './errors.js';
import { menuImagePublisher, menuImageReader } from './menuMedia.js';

export function createFirebaseServices(config) {
  if (config.mode === 'emulator') {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = config.authEmulatorHost;
    process.env.FIRESTORE_EMULATOR_HOST = config.firestoreEmulatorHost;
    process.env.FIREBASE_STORAGE_EMULATOR_HOST = config.storageEmulatorHost;
    process.env.STORAGE_EMULATOR_HOST = `http://${config.storageEmulatorHost}`;
  }
  // Firestore Admin accepts its supported credential classes, not a handwritten
  // token provider. The explicit emulator hosts route local RPCs without a key.
  const credential = config.mode === 'production' && config.serviceAccountPath
    ? cert(config.serviceAccountPath) : applicationDefault();
  const app = initializeApp({ projectId: config.projectId, storageBucket: config.storageBucket, credential }, `api-${randomUUID()}`);
  const auth = getAuth(app);
  const firestore = getFirestore(app);
  const storage = getStorage(app);
  return {
    auth, firestore, storage,
    publishMenuImage: menuImagePublisher(storage.bucket()),
    readMenuImage: menuImageReader(storage.bucket()),
    sendPush: config.mode === 'production' && config.fcmEnabled ? message => getMessaging(app).send(message) : null,
    verifyIdToken: token => auth.verifyIdToken(token, true),
    async validateAvatar(uid, objectPath) {
      if (!objectPath.startsWith(`users/${uid}/avatars/`) || objectPath.split('/').length !== 4) throw new ApiError(422, 'MEDIA_INVALID', 'Ảnh không thuộc hồ sơ này.');
      let metadata;
      try { [metadata] = await storage.bucket().file(objectPath).getMetadata(); }
      catch (error) {
        if (Number(error.code) === 404) throw new ApiError(422, 'MEDIA_INVALID', 'Ảnh chưa được tải lên.');
        throw new ApiError(503, 'MEDIA_SERVICE_UNAVAILABLE', 'Chưa thể kiểm tra ảnh.');
      }
      if (!IMAGE_CONTENT_TYPES.includes(metadata.contentType) || Number(metadata.size) > MAX_IMAGE_BYTES || Number(metadata.size) <= 0) throw new ApiError(422, 'MEDIA_INVALID', 'Ảnh không đúng định dạng hoặc kích thước.');
    },
    close: async () => { await firestore.terminate(); await deleteApp(app); },
  };
}
