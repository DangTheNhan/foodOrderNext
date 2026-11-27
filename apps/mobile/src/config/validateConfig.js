export function validateConfig(input, { isDevelopment, platform }) {
  if (!['emulator', 'staging'].includes(input.environment) || !input.projectId) {
    throw new Error('Chọn rõ môi trường và projectId trong runtime.config.js.');
  }
  if (input.environment === 'emulator') {
    if (!isDevelopment || !input.projectId.startsWith('demo-')) {
      throw new Error('Demo Firebase chỉ được dùng với debug build và projectId demo-.');
    }
    const host = input.emulatorHost || (platform === 'android' ? '10.0.2.2' : 'localhost');
    if (!/^[a-zA-Z0-9.:-]+$/.test(host)) {
      throw new Error('Emulator host không hợp lệ.');
    }
    for (const port of [input.authPort, input.firestorePort]) {
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('Emulator port không hợp lệ.');
      }
    }
    const apiBaseUrl = input.apiBaseUrl || `http://${host}:5000/api/v1`;
    if (!/^http:\/\/[a-zA-Z0-9.:-]+\/api\/v1$/.test(apiBaseUrl)) {
      throw new Error('API emulator phải là http://host:port/api/v1.');
    }
    return { ...input, emulatorHost: host, apiBaseUrl };
  }
  if (input.projectId.startsWith('demo-') || !/^https:\/\/[^/]+\/api\/v1$/.test(input.apiBaseUrl || '') || input.emulatorHost) {
    throw new Error('Staging cần project thật, API HTTPS /api/v1 và không có emulatorHost.');
  }
  return { ...input };
}
