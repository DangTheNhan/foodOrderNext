"""Real Android/Emulator smoke test. Seed a fresh LOCAL demo environment first.

SEED_DEMO_PASSWORD is read only from the environment and is never logged.
Requires adb on PATH (or ADB_PATH) and an already installed debug app + Metro.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import time
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / 'artifacts/evidence/P01'
ADB = os.environ.get('ADB_PATH', 'adb')
SERIAL = os.environ.get('ANDROID_SERIAL', 'emulator-5556')
PASSWORD = os.environ.get('SEED_DEMO_PASSWORD', '')
RESULTS: list[dict] = []


def adb(*args: str, binary: bool = False):
    result = subprocess.run([ADB, '-s', SERIAL, *args], capture_output=True, timeout=40)
    if result.returncode:
        raise RuntimeError('ADB operation failed (arguments deliberately omitted).')
    return result.stdout if binary else result.stdout.decode('utf-8', errors='replace')


def snapshot():
    for attempt in range(3):
        try:
            adb('shell', 'uiautomator', 'dump', '/sdcard/p01-smoke.xml')
            return ET.fromstring(adb('exec-out', 'cat', '/sdcard/p01-smoke.xml'))
        except (ET.ParseError, RuntimeError):
            if attempt == 2:
                raise
            time.sleep(1)


def locate(tree, identifier):
    for node in tree.iter('node'):
        if node.get('resource-id') == identifier or node.get('resource-id', '').endswith('/' + identifier):
            return node
    return None


def wait_for(identifier=None, text=None, timeout=35):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        tree = snapshot()
        if identifier and locate(tree, identifier) is not None:
            return tree
        if text and any(text in node.get('text', '') for node in tree.iter('node')):
            return tree
        time.sleep(0.35)
    raise AssertionError('Expected screen element did not appear: ' + str(identifier or text))


def tap_node(node):
    bounds = list(map(int, re.findall(r'\d+', node.get('bounds', ''))))
    if len(bounds) != 4:
        raise AssertionError('Element has no visible bounds')
    adb('shell', 'input', 'tap', str((bounds[0] + bounds[2]) // 2), str((bounds[1] + bounds[3]) // 2))


def click(identifier):
    tap_node(locate(wait_for(identifier=identifier), identifier))


def enter(identifier, value):
    if not re.fullmatch(r'[A-Za-z0-9@._+ -]+', value):
        raise ValueError('Smoke input only supports bounded synthetic ASCII data.')
    node = locate(wait_for(identifier=identifier), identifier)
    previous_length = len(node.get('text', ''))
    tap_node(node)
    if previous_length:
        adb('shell', 'input', 'keyevent', '123')
        adb('shell', 'input', 'keyevent', *(['67'] * (previous_length + 2)))
    adb('shell', 'input', 'text', value.replace(' ', '%s'))


def capture(name):
    (EVIDENCE / name).write_bytes(adb('exec-out', 'screencap', '-p', binary=True))


def record(name):
    RESULTS.append({'case': name, 'result': 'PASS'})
    print('PASS ' + name, flush=True)


def login(email, label):
    wait_for(identifier='login-email')
    enter('login-email', email)
    enter('login-password', PASSWORD)
    adb('shell', 'input', 'keyevent', '4')
    click('login-submit')
    wait_for(identifier='open-profile')
    if label == 'Khách hàng':
        wait_for(text='Ăn gì hôm nay?')
    else:
        wait_for(text='Khu vực ' + label)


def logout():
    click('open-profile')
    click('logout')
    wait_for(identifier='login-email')


def http_json(url, body=None, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    request = urllib.request.Request(url, data=None if body is None else json.dumps(body).encode(), headers=headers)
    with urllib.request.urlopen(request, timeout=15) as response:
        return json.load(response)


def main():
    if len(PASSWORD) < 12:
        raise RuntimeError('Supply SEED_DEMO_PASSWORD locally (12+ characters).')
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    tree = snapshot()
    if locate(tree, 'open-profile') is not None:
        logout()
    login('customer@example.invalid', 'Khách hàng')
    capture('android-customer-home.png')
    record('Native Firebase login and customer role from Express/Firestore')
    click('open-profile')
    click('profile-edit')
    enter('profile-displayName', 'P01 Student')
    enter('profile-phone', '0900000000')
    adb('shell', 'input', 'keyevent', '4')
    click('profile-save')
    wait_for(identifier='profile-edit')
    wait_for(text='P01 Student')
    auth = http_json('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local-only',
                     {'email': 'customer@example.invalid', 'password': PASSWORD, 'returnSecureToken': True})
    profile = http_json('http://127.0.0.1:5000/api/v1/me', token=auth['idToken'])['data']
    assert profile['displayName'] == 'P01 Student' and profile['phone'] == '0900000000'
    assert profile['role'] == 'customer' and profile['active'] is True
    capture('android-profile-saved.png')
    record('Profile update persisted through authenticated Express API')
    adb('shell', 'am', 'force-stop', 'com.foodordernext.app')
    adb('shell', 'am', 'start', '-n', 'com.foodordernext.app/com.foodorderingapp.MainActivity')
    wait_for(identifier='open-profile')
    wait_for(text='P01 Student')
    record('Native Firebase session restored after application process restart')
    logout()
    record('Logout returned to login without prior profile')
    for email, role, label in [
        ('merchant1@example.invalid', 'merchant', 'Nhà hàng'),
        ('driver@example.invalid', 'driver', 'Tài xế'),
        ('admin@example.invalid', 'admin', 'Quản trị viên'),
    ]:
        login(email, label)
        capture('android-' + role + '-home.png')
        record('Native role navigation: ' + role)
        logout()
    capture('android-login.png')


def run_smoke():
    result = 'FAIL'
    try:
        main()
        result = 'PASS'
    except Exception as error:
        RESULTS.append({'case': 'Android smoke continuation', 'result': 'FAIL',
                        'reason': str(error) if isinstance(error, (AssertionError, RuntimeError)) else type(error).__name__})
        try:
            capture('android-smoke-failure.png')
        except Exception:
            pass
    finally:
        EVIDENCE.mkdir(parents=True, exist_ok=True)
        (EVIDENCE / 'android-smoke.json').write_text(json.dumps({
            'result': result, 'atUtc': datetime.now(timezone.utc).isoformat(),
            'environment': 'LOCAL demo-foodordernext, synthetic seed, Android emulator',
            'device': SERIAL, 'cases': RESULTS,
        }, ensure_ascii=False, indent=2), encoding='utf-8')
    if result != 'PASS':
        print('FAIL Android smoke; inspect artifacts/evidence/P01/android-smoke.json', flush=True)
        raise SystemExit(1)


if __name__ == '__main__':
    run_smoke()
