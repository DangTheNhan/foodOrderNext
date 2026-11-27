"""Native registration, local verification handoff, change/reset password.

Uses ONLY local Auth Emulator and a unique synthetic account; no real email.
Prerequisites and environment are the same as android-p01-smoke.py.
"""
import importlib.util
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

spec = importlib.util.spec_from_file_location('p01helpers', Path(__file__).with_name('android-p01-smoke.py'))
h = importlib.util.module_from_spec(spec)
spec.loader.exec_module(h)
cases = []


def record(name):
    cases.append({'case': name, 'result': 'PASS'})
    print('PASS ' + name, flush=True)


def click_label(label):
    tree = h.snapshot()
    node = next((n for n in tree.iter('node') if n.get('content-desc') == label), None)
    if node is None:
        raise AssertionError('Missing button: ' + label)
    h.tap_node(node)


def account_call(method, body):
    return h.http_json('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:' + method + '?key=local-only', body)


def oob(email, kind):
    data = h.http_json('http://127.0.0.1:9099/emulator/v1/projects/demo-foodordernext/oobCodes')
    return next(item['oobCode'] for item in reversed(data['oobCodes'])
                if item['email'] == email and item['requestType'] == kind)


def main():
    tree = h.snapshot()
    if h.locate(tree, 'open-profile') is not None:
        h.logout()
    elif h.locate(tree, 'logout') is not None:
        h.click('logout')
    h.wait_for(identifier='login-email')
    email = 'native-' + uuid.uuid4().hex[:10] + '@example.invalid'
    password = h.PASSWORD
    if len(password) < 12:
        raise RuntimeError('Supply SEED_DEMO_PASSWORD locally.')
    click_label('Tạo tài khoản')
    for identifier, value in [('register-name', 'Native Student'), ('register-email', email),
                              ('register-password', password), ('register-confirm', password)]:
        h.enter(identifier, value)
        h.adb('shell', 'input', 'keyevent', '4')
    h.click('register-submit')
    h.wait_for(identifier='verify-refresh')
    h.capture('android-verify-email.png')
    auth = account_call('signInWithPassword', {'email': email, 'password': password, 'returnSecureToken': True})
    profile = h.http_json('http://127.0.0.1:5000/api/v1/me', token=auth['idToken'])['data']
    assert profile['role'] == 'customer' and profile['emailVerified'] is False
    assert profile['displayName'] == 'Native Student', 'Registration name was not saved to profile'
    record('Native registration creates customer profile and requires verified email')
    account_call('update', {'oobCode': oob(email, 'VERIFY_EMAIL')})
    h.click('verify-refresh')
    h.wait_for(identifier='open-profile')
    record('Native refresh accepts local email verification and loads role navigation')
    h.click('open-profile')
    h.click('open-change-password')
    new_password = password + 'New9'
    for identifier, value in [('change-current', password), ('change-new', new_password), ('change-confirm', new_password)]:
        h.enter(identifier, value)
        h.adb('shell', 'input', 'keyevent', '4')
    h.click('change-submit')
    h.wait_for(text='Mật khẩu đã được cập nhật.')
    record('Native reauthentication and change password succeed')
    h.adb('shell', 'input', 'keyevent', '4')
    h.click('logout')
    h.wait_for(identifier='login-email')
    h.PASSWORD = new_password
    h.login(email, 'Khách hàng')
    h.logout()
    record('Native login accepts changed password')
    click_label('Quên mật khẩu?')
    h.enter('reset-email', email)
    h.adb('shell', 'input', 'keyevent', '4')
    h.click('reset-submit')
    h.wait_for(text='Nếu email có tài khoản phù hợp, hướng dẫn đã được gửi.')
    reset_password = password + 'Reset9'
    account_call('resetPassword', {'oobCode': oob(email, 'PASSWORD_RESET'), 'newPassword': reset_password})
    h.adb('shell', 'input', 'keyevent', '4')
    h.PASSWORD = reset_password
    h.login(email, 'Khách hàng')
    h.logout()
    record('Native reset email + local OOB handoff + login with reset password succeed')


result = 'FAIL'
try:
    main()
    result = 'PASS'
except Exception as error:
    cases.append({'case': 'Native auth continuation', 'result': 'FAIL',
                  'reason': str(error) if isinstance(error, (AssertionError, RuntimeError)) else type(error).__name__})
    try:
        h.capture('android-auth-failure.png')
    except Exception:
        pass
finally:
    (h.EVIDENCE / 'android-auth.json').write_text(json.dumps({
        'result': result, 'atUtc': datetime.now(timezone.utc).isoformat(),
        'environment': 'LOCAL demo-foodordernext, synthetic account, Android emulator',
        'cases': cases,
    }, ensure_ascii=False, indent=2), encoding='utf-8')
if result != 'PASS':
    print('FAIL Native auth; inspect artifacts/evidence/P01/android-auth.json', flush=True)
    raise SystemExit(1)
