import { connectStorageEmulator, getStorage, putFile, ref } from '@react-native-firebase/storage';
import { launchImageLibrary } from 'react-native-image-picker';
import { newIntentKey } from '../api/clientCore';
import { operatorRuntime } from './operationsData';

const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
let storage;

export async function uploadMenuPhoto(uid, shopId) {
  const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, maxWidth: 1400, maxHeight: 1400,
    quality: 0.85, restrictMimeTypes: Object.keys(extensions) });
  if (result.didCancel) return null;
  const asset = result.assets?.[0];
  if (result.errorCode || !asset || !extensions[asset.type] || !asset.uri?.startsWith('file://')
    || !asset.fileSize || asset.fileSize > 5 * 1024 * 1024) {
    throw new Error('Chọn ảnh JPEG, PNG hoặc WebP tối đa 5 MiB.');
  }
  const { app, config } = operatorRuntime(uid);
  if (!storage) {
    storage = getStorage(app);
    if (config.environment === 'emulator') connectStorageEmulator(storage, config.emulatorHost, 9199);
  }
  const imagePath = `shops/${shopId}/menu/${newIntentKey()}.${extensions[asset.type]}`;
  const target = ref(storage, imagePath);
  try {
    await putFile(target, decodeURI(asset.uri.slice('file://'.length)), {
      contentType: asset.type, customMetadata: { ownerUid: uid, state: 'pending' },
    });
  } catch {
    throw new Error('Chưa tải được ảnh. Kiểm tra kết nối hoặc quyền của quán rồi chọn lại.');
  }
  operatorRuntime(uid);
  return imagePath;
}
