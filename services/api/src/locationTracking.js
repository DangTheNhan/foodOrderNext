import { Timestamp } from 'firebase-admin/firestore';
import { ApiError } from './errors.js';

const minIntervalMs = 10_000;
const heartbeatMs = 30_000;
const minMovementMeters = 15;
const coordinateFields = ['latitude', 'longitude', 'accuracyMeters'];
const radians = value => value * Math.PI / 180;

function distanceMeters(from, to) {
  const lat = Math.sin(radians(to.latitude - from.latitude) / 2);
  const lon = Math.sin(radians(to.longitude - from.longitude) / 2);
  const square = lat ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * lon ** 2;
  return 12_742_000 * Math.asin(Math.sqrt(Math.min(1, square)));
}

export function evaluateLocation(input, current, driverUid, now) {
  const recordedAt = Date.parse(input.recordedAt);
  const previous = current?.assignmentVersion === input.expectedAssignmentVersion ? current : null;
  if (previous && input.sequence === previous.sequence && recordedAt === previous.recordedAt.toMillis()
      && coordinateFields.every(key => input[key] === previous[key])) {
    return { position: previous, replayed: true };
  }
  if (!Number.isFinite(recordedAt) || now - recordedAt > 60_000 || recordedAt - now > 10_000) {
    throw new ApiError(422, 'LOCATION_TIME_INVALID', 'Thời điểm ghi vị trí đã cũ hoặc đồng hồ thiết bị không chính xác.');
  }
  if (previous) {
    if (input.sequence <= previous.sequence || recordedAt <= previous.recordedAt.toMillis()) {
      throw new ApiError(409, 'LOCATION_OUT_OF_ORDER', 'Đã có vị trí mới hơn cho chuyến này.');
    }
    const elapsed = now - previous.receivedAt.toMillis();
    if (elapsed < minIntervalMs) {
      throw new ApiError(429, 'LOCATION_RATE_LIMITED', 'Gửi vị trí quá nhanh.', { retryAfterMs: minIntervalMs - elapsed });
    }
    if (elapsed < heartbeatMs && distanceMeters(previous, input) < minMovementMeters) {
      throw new ApiError(429, 'LOCATION_UNCHANGED', 'Vị trí chưa di chuyển đủ xa.', { retryAfterMs: heartbeatMs - elapsed });
    }
  }
  return { replayed: false, position: {
    driverUid, assignmentVersion: input.expectedAssignmentVersion, sequence: input.sequence,
    latitude: input.latitude, longitude: input.longitude, accuracyMeters: input.accuracyMeters,
    recordedAt: Timestamp.fromMillis(recordedAt), receivedAt: Timestamp.fromMillis(now),
  } };
}
