export function coordinateInput(latitude, longitude) {
  const decimal = value => Number(value.trim().replace(',', '.'));
  const point = { latitude: decimal(latitude), longitude: decimal(longitude) };
  if (!latitude.trim() || !longitude.trim() || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)
    || Math.abs(point.latitude) > 90 || Math.abs(point.longitude) > 180) {
    throw new Error('Nhập vĩ độ từ −90 đến 90 và kinh độ từ −180 đến 180.');
  }
  return point;
}
