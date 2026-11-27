import { IMAGE_CONTENT_TYPES, MAX_IMAGE_BYTES } from '@foodordernext/contracts';
import { ApiError } from './errors.js';

const invalid = () => new ApiError(422, 'MEDIA_INVALID', 'Ảnh chưa được tải lên hoặc định dạng ảnh không hợp lệ.');
const retry = () => new ApiError(503, 'MEDIA_SERVICE_UNAVAILABLE', 'Chưa thể xử lý ảnh. Hãy thử lại.');

function matchesImage(bytes, type) {
  if (type === 'image/jpeg') return bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  if (type === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
  return type === 'image/webp' && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
}

export function menuImagePublisher(bucket) {
  return async (uid, shopId, foodId, objectPath) => {
    const parts = objectPath.split('/');
    if (parts.length !== 4 || parts[0] !== 'shops' || parts[1] !== shopId || parts[2] !== 'menu'
      || !/^[a-z0-9_-]{16,128}\.(jpg|jpeg|png|webp)$/i.test(parts[3])) throw invalid();
    const source = bucket.file(objectPath);
    const destination = bucket.file(`shops/${shopId}/menuPublished/${foodId}/${parts[3]}`);
    try {
      const [info] = await source.getMetadata();
      const meta = info.metadata ?? {};
      if (meta.ownerUid !== uid || !IMAGE_CONTENT_TYPES.includes(info.contentType)
        || meta.state !== 'pending' || !(Number(info.size) > 0 && Number(info.size) <= MAX_IMAGE_BYTES)) throw invalid();
      const [bytes] = await bucket.file(objectPath, { generation: info.generation }).download();
      if (bytes.length > MAX_IMAGE_BYTES || !matchesImage(bytes, info.contentType)) throw invalid();
      // Copy bytes into a server-only namespace. Never copy Firebase download
      // tokens from the pending upload or expose a signed URL for this object.
      await destination.save(bytes, { resumable: false, preconditionOpts: { ifGenerationMatch: 0 },
        metadata: { contentType: info.contentType, metadata: { ownerUid: uid, state: 'published', foodId,
          sourceGeneration: String(info.generation) } } });
      return destination.name;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (Number(error.code) === 404) throw invalid();
      if (Number(error.code) === 412) {
        const [latest] = await destination.getMetadata().catch(() => { throw retry(); });
        if (latest.metadata?.ownerUid === uid && latest.metadata?.state === 'published'
          && latest.metadata?.foodId === foodId && !latest.metadata?.firebaseStorageDownloadTokens) return destination.name;
      }
      throw retry();
    }
  };
}

export function menuImageReader(bucket) {
  return async (path, foodId) => {
    try {
      const file = bucket.file(path);
      const [info] = await file.getMetadata();
      if (info.metadata?.state !== 'published' || info.metadata?.foodId !== foodId
        || !IMAGE_CONTENT_TYPES.includes(info.contentType) || Number(info.size) > MAX_IMAGE_BYTES) return null;
      const [bytes] = await bucket.file(path, { generation: info.generation }).download();
      return { bytes, contentType: info.contentType };
    } catch (error) {
      if (Number(error.code) === 404) return null;
      throw retry();
    }
  };
}
