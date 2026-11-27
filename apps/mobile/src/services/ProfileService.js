import { getApi } from '../api/axiosClient';
import { newIntentKey } from '../api/clientCore';

export const ProfileService = {
  async bootstrap(displayName) {
    return (await getApi().client.post('/me/bootstrap', displayName ? { displayName: displayName.trim() } : {})).data.data;
  },
  async getProfile() { return (await getApi().client.get('/me')).data.data; },
  async updateProfile({ displayName, phone }, intentKey = newIntentKey()) {
    // Avatar upload/attach is not exposed until the Storage slice is integrated.
    return (await getApi().client.patch('/me', { displayName: displayName.trim(), phone: phone.trim() || null },
      { headers: { 'Idempotency-Key': intentKey } })).data.data;
  },
};
