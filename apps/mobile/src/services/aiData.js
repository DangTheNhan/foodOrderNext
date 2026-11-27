import { getApi } from '../api/axiosClient';
import { operatorRuntime } from './operationsData';

export async function askAi(uid, action, input) {
  operatorRuntime(uid);
  return (await getApi().client.post('/ai/' + action, input, { timeout: 48_000 })).data.data;
}
