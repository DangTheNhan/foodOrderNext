import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

export async function verifyStagingPushDevice({ root, accounts, users, call, apiBase, admin, parent, report }) {
  const user = users.customer;
  const userPath = '/v1/' + parent + '/users/' + user.uid;
  const script = join(root, 'tests/e2e/android-staging-push.py');
  const adb = process.env.ADB_PATH;
  assert(adb, 'Set ADB_PATH for the dedicated staging emulator');
  report.pushDevice = { environment: 'Android Emulator API 37 + staging Express and Firebase Auth/Firestore',
    permission: 'Android POST_NOTIFICATIONS', testedProviderDelivery: false };
  let stage = 'baseline';

  function runUi(action) {
    const result = spawnSync('python', [script, action], {
      cwd: root,
      input: action === 'deny' ? JSON.stringify({ customer: accounts.customer }) : undefined,
      encoding: 'utf8',
      timeout: 110_000,
      env: { ...process.env, ANDROID_SERIAL: 'emulator-5562', PYTHONIOENCODING: 'utf-8', PYTHONDONTWRITEBYTECODE: '1' },
    });
    const reason = result.stderr?.trim();
    const detail = /^(Expected screen element did not appear:|Button is not visible:) [^\r\n]{1,100}$/.test(reason)
      ? reason : 'Android step failed';
    assert(result.status === 0, action + ': ' + detail);
    return result.stdout.trim();
  }

  async function devices() {
    const result = await admin.post(userPath + ':runQuery', { structuredQuery: {
      from: [{ collectionId: 'devices' }],
      select: { fields: [{ fieldPath: 'platform' }, { fieldPath: 'notificationsEnabled' }] },
      limit: 2,
    } });
    return result.body.flatMap(row => row.document ? [row.document] : []);
  }

  async function waitForCount(count) {
    let bindings;
    for (let attempt = 0; attempt < 10; attempt++) {
      bindings = await devices();
      if (bindings.length === count) return bindings;
      await delay(1500);
    }
    assert.equal(bindings.length, count, 'Unexpected number of active Android device bindings');
  }

  async function verifyPreference(expected) {
    const { data } = await call('customer', '/me', 200);
    assert.equal(data.settings.notificationsEnabled, expected);
  }

  const passed = () => { report.checks[stage] = 'PASS'; };
  try {
    await verifyPreference(false);
    assert.equal((await devices()).length, 0, 'The test account already has a bound device');
    passed();
    stage = 'permissionDenied';
    const checksum = runUi('deny');
    assert.match(checksum, /^[a-f0-9]{64}$/i);
    report.pushDevice.apkSha256 = checksum;
    await verifyPreference(true);
    assert.equal((await devices()).length, 0);
    passed();
    stage = 'permissionGranted';
    runUi('grant');
    const [binding] = await waitForCount(1);
    assert.equal(binding.fields.platform.stringValue, 'android');
    assert.equal(binding.fields.notificationsEnabled.booleanValue, true);
    passed();
    stage = 'optOutRemovesBinding';
    runUi('off');
    await verifyPreference(false);
    await waitForCount(0);
    passed();
    stage = 'optInReusesInstallation';
    runUi('on');
    const [rebound] = await waitForCount(1);
    assert.equal(rebound.name, binding.name);
    passed();
    stage = 'logoutRemovesBinding';
    runUi('logout');
    await waitForCount(0);
    passed();
  } catch (error) {
    report.pushDevice.failedCheck = stage;
    throw error;
  } finally {
    if (report.checks.baseline === 'PASS') {
      const response = await fetch(apiBase + '/me/settings', { method: 'PATCH', redirect: 'error',
        headers: { Authorization: 'Bearer ' + await user.getIdToken(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationsEnabled: false }), signal: AbortSignal.timeout(30_000) });
      assert.equal(response.status, 200, 'Could not restore the test preference');
      report.pushDevice.preferenceRestored = true;
    }
  }
}
