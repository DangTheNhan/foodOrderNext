import axios from 'axios';

export class ApiError extends Error {
  constructor(code, message, status = 0, traceId = null, details = null) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.traceId = traceId;
    this.details = details;
  }
}
export function toApiError(error) {
  if (error instanceof ApiError) {
    return error;
  }
  const body = error.response?.data;
  return new ApiError(body?.error?.code || (error.code === 'ERR_CANCELED' ? 'SESSION_CHANGED' : 'NETWORK_ERROR'),
    body?.error?.message || 'Không kết nối được máy chủ. Kiểm tra mạng và thử lại.',
    error.response?.status || 0, body?.meta?.traceId || null, body?.error?.details ?? null);
}

// Requests ask native Firebase for an ID token; no token is stored by this client.
export function createFirebaseApiClient({ baseURL, getCurrentUser, getToken, adapter }) {
  const pending = new Set();
  let generation = 0;
  const client = axios.create({ baseURL, timeout: 12000, headers: { 'Content-Type': 'application/json' }, ...(adapter ? { adapter } : {}) });
  client.interceptors.request.use(async config => {
    const caller = config._callerSignal;
    if (caller?.aborted) throw new ApiError('REQUEST_CANCELLED', 'Yêu cầu đã dừng.');
    const user = getCurrentUser();
    if (!user) {
      throw new ApiError('AUTH_REQUIRED', 'Vui lòng đăng nhập.');
    }
    if (config._principalUid !== undefined &&
      (config._principalUid !== user.uid || config._sessionGeneration !== generation)) {
      throw new ApiError('SESSION_CHANGED', 'Tài khoản đã thay đổi.');
    }
    config._principalUid = user.uid;
    config._sessionGeneration = generation;
    const token = await getToken(user, Boolean(config._forceRefresh));
    if (getCurrentUser()?.uid !== config._principalUid || config._sessionGeneration !== generation) {
      throw new ApiError('SESSION_CHANGED', 'Tài khoản đã thay đổi.');
    }
    config.headers.Authorization = `Bearer ${token}`;
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (caller?.aborted) abort();
    else caller?.addEventListener('abort', abort, { once: true });
    config.signal = controller.signal;
    config._controller = controller;
    config._cleanupSignal = () => caller?.removeEventListener('abort', abort);
    pending.add(controller);
    return config;
  });
  client.interceptors.response.use(response => {
    pending.delete(response.config._controller);
    response.config._cleanupSignal?.();
    if (getCurrentUser()?.uid !== response.config._principalUid || response.config._sessionGeneration !== generation) {
      throw new ApiError('SESSION_CHANGED', 'Bỏ qua dữ liệu của phiên trước.');
    }
    if (!response.data || !Object.prototype.hasOwnProperty.call(response.data, 'data')) {
      throw new ApiError('INVALID_RESPONSE', 'Máy chủ trả dữ liệu không đúng hợp đồng.');
    }
    return response;
  }, async error => {
    const config = error.config;
    pending.delete(config?._controller);
    config?._cleanupSignal?.();
    if (config && (getCurrentUser()?.uid !== config._principalUid || config._sessionGeneration !== generation)) {
      throw new ApiError('SESSION_CHANGED', 'Tài khoản đã thay đổi.');
    }
    if (error.response?.status === 401 && config && !config._forceRefresh) {
      return client.request({ ...config, _forceRefresh: true });
    }
    throw toApiError(error);
  });

  // Bind the intent when a caller invokes a method, before Axios schedules its
  // asynchronous interceptor chain. A later account cannot inherit that intent.
  const pinIntent = config => {
    const uid = getCurrentUser()?.uid;
    if (!uid) { throw new ApiError('AUTH_REQUIRED', 'Vui lòng đăng nhập.'); }
    if (config?._principalUid !== undefined &&
      (config._principalUid !== uid || config._sessionGeneration !== generation)) {
      throw new ApiError('SESSION_CHANGED', 'Tài khoản đã thay đổi.');
    }
    return { ...config, _callerSignal: config?._callerSignal ?? config?.signal,
      _principalUid: uid, _sessionGeneration: generation };
  };
  const scopedClient = { interceptors: client.interceptors };
  for (const method of ['get', 'delete', 'head', 'options']) {
    scopedClient[method] = (url, config) => {
      try { return client[method](url, pinIntent(config)); }
      catch (error) { return Promise.reject(error); }
    };
  }
  for (const method of ['post', 'patch', 'put']) {
    scopedClient[method] = (url, data, config) => {
      try { return client[method](url, data, pinIntent(config)); }
      catch (error) { return Promise.reject(error); }
    };
  }
  scopedClient.request = config => {
    try { return client.request(pinIntent(config)); }
    catch (error) { return Promise.reject(error); }
  };
  return {
    client: scopedClient,
    cancelPending() {
      generation += 1;
      pending.forEach(controller => controller.abort());
      pending.clear();
    },
  };
}
// Non-secret key per intent; retain the key/body while retrying the same action.
export function newIntentKey() {
  return `mobile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
