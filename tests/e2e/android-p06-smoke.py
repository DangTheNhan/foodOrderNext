"""Android GPS/COD smoke. Uses synthetic coordinates injected into a dedicated local emulator."""
import importlib
import json
import re
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from uuid import uuid4

p02 = importlib.import_module('android-p02-smoke')
p03 = importlib.import_module('android-p03-smoke')
ui = p02.ui
ui.EVIDENCE = ui.ROOT / 'artifacts/evidence/P06'
PROJECT = 'demo-foodordernext'
APP = 'com.foodordernext.app'


def api(token, method, path, body):
    req = urllib.request.Request('http://127.0.0.1:5000/api/v1' + path,
        data=json.dumps(body).encode(), method=method, headers={
            'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token,
            'Idempotency-Key': str(uuid4()),
        })
    with urllib.request.urlopen(req, timeout=25) as response:
        return json.load(response)['data']


def firestore(token, path):
    base = f'http://127.0.0.1:8080/v1/projects/{PROJECT}/databases/(default)/documents/'
    req = urllib.request.Request(base + path, headers={'Authorization': 'Bearer ' + token})
    with urllib.request.urlopen(req, timeout=15) as response:
        return json.load(response)['fields']


def create_trip(customer, merchant):
    api(merchant, 'PATCH', '/shops/shop1', {'location': {'latitude': 10.871, 'longitude': 106.771}})
    api(customer, 'PATCH', '/me/addresses/campus', {
        'location': {'latitude': 10.874, 'longitude': 106.775}, 'locationSource': 'MANUAL',
    })
    order = {'shopId': 'shop1', 'items': [{'foodId': 'shop1-rice', 'quantity': 1, 'optionIds': []}], 'addressId': 'campus'}
    quote = api(customer, 'POST', '/orders/quote', order)
    trip = api(customer, 'POST', '/orders', {
        **order, 'paymentMethod': 'COD', 'expectedGrandTotalVnd': quote['grandTotalVnd'], 'expectedQuoteKey': quote['quoteKey'],
    })
    order_id = trip['orderId']
    for version, status in enumerate(('ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP'), 1):
        p03.api_command(merchant, order_id, 'transitions', {'expectedStatusVersion': version, 'targetStatus': status})
    p03.api_command(merchant, order_id, 'assign-driver', {
        'driverUid': 'demo-driver', 'expectedStatusVersion': 4, 'expectedAssignmentVersion': 0,
    })
    return order_id, trip['amountDueVnd']


def gps(enabled):
    ui.adb('shell', 'cmd', 'location', 'set-location-enabled', str(enabled).lower(), '--user', '0')


def point(longitude, latitude):
    ui.adb('emu', 'geo', 'fix', str(longitude), str(latitude))


def permission(identifier):
    for node in ui.wait_for(identifier=identifier, timeout=12).iter('node'):
        if node.get('resource-id', '').endswith('/' + identifier):
            ui.tap_node(node)
            return
    raise AssertionError('Android permission button missing')


def logout():
    ui.click('open-profile')
    for _ in range(2):
        tree = ui.wait_for(identifier='logout')
        for node in tree.iter('node'):
            if node.get('text') == 'Open debugger to view warnings.':
                _, top, right, bottom = map(int, re.findall(r'\d+', node.get('bounds', '')))
                ui.adb('shell', 'input', 'tap', str(right + 35), str((top + bottom) // 2))
                break
        _, _, width, height = map(int, re.findall(r'\d+', next(tree.iter('node')).get('bounds', '')))
        ui.adb('shell', 'input', 'swipe', str(width // 2), str(height * 4 // 5),
               str(width // 2), str(height // 3), '400')
        ui.click('logout')
        try:
            ui.wait_for(identifier='login-email', timeout=9)
            return
        except AssertionError:
            continue
    raise AssertionError('Logout did not return to login')


def wait_fix(token, path):
    deadline = time.monotonic() + 40
    while time.monotonic() < deadline:
        point(106.773, 10.873)
        try:
            return firestore(token, path)
        except urllib.error.HTTPError as error:
            if error.code != 404:
                raise
        time.sleep(1)
    raise AssertionError('No simulated GPS fix reached Firestore')


def main(details):
    if len(ui.PASSWORD) < 12 or not ui.SERIAL.startswith('emulator-'):
        raise RuntimeError('Use a fresh demo seed and dedicated Android Emulator.')
    customer = p03.sign_in('customer@example.invalid')
    merchant = p03.sign_in('merchant1@example.invalid')
    order, expected_amount = create_trip(customer, merchant)
    order_path = 'orders/' + order
    tracking_path = order_path + '/deliveryTracking/current'
    gps(True)
    ui.login('driver@example.invalid', 'Tài xế')
    ui.click('driver-order-' + order)
    ui.click('accept-driver-trip')
    ui.wait_for(identifier='pickup-driver-trip')
    accepted = firestore(customer, order_path)
    assert accepted['status']['stringValue'] == 'READY_FOR_PICKUP'
    assert accepted['assignmentStatus']['stringValue'] == 'ACCEPTED'
    ui.click('pickup-driver-trip')
    ui.wait_for(identifier='start-driver-location')
    assert 'pickedUpAt' in firestore(customer, order_path)
    ui.record('Assigned driver accepts trip and confirms pickup in Android')

    ui.click('start-driver-location')
    permission('permission_deny_button')
    ui.wait_for(text='Cần cấp quyền vị trí chính xác')
    ui.capture('android-gps-permission-denied.png')
    gps(False)
    try:
        ui.wait_for(text='No location access', timeout=5)
    except AssertionError:
        pass
    else:
        p02.text_button('Close')
    ui.click('start-driver-location')
    permission('permission_allow_foreground_only_button')
    ui.wait_for(text='Hãy bật vị trí trên thiết bị')
    ui.record('Android shows denied location permission and disabled location services')

    gps(True)
    first = wait_fix(customer, tracking_path)
    ui.wait_for(text='Đã cập nhật vị trí')
    assert abs(first['latitude']['doubleValue'] - 10.873) < 0.00001
    ui.capture('android-driver-location.png')
    ui.record('Synthetic Android GPS reaches scoped Firestore tracking through Express')

    ui.adb('shell', 'input', 'keyevent', '3')
    for _ in range(14):
        point(106.778, 10.875)
        time.sleep(1)
    assert firestore(customer, tracking_path)['sequence'] == first['sequence']
    details['backgroundSampleWindowSeconds'] = 14
    ui.record('Android sends no new GPS updates while app is in background')
    ui.adb('shell', 'am', 'start', '-n', p02.COMPONENT)
    ui.wait_for(identifier='complete-driver-trip')
    p02.back()
    ui.wait_for(identifier='open-profile')
    logout()

    p02.login('customer@example.invalid')
    ui.click('open-order-history')
    ui.click('order-' + order)
    ui.click('open-delivery-tracking')
    ui.wait_for(identifier='delivery-map')
    ui.wait_for(text='Cập nhật lúc')
    ui.capture('android-customer-map.png')
    ui.wait_for(text='Vị trí đã cũ.', timeout=80)
    ui.capture('android-stale-location.png')
    ui.record('Customer sees scoped location and a stale marker after updates stop')

    p02.back(3)
    ui.wait_for(identifier='open-profile')
    logout()
    ui.login('driver@example.invalid', 'Tài xế')
    ui.click('driver-order-' + order)
    ui.click('complete-driver-trip')
    ui.click('confirm-driver-cod')
    ui.wait_for(text='Đã thu COD')
    completed = firestore(customer, order_path)
    assert completed['status']['stringValue'] == 'COMPLETED'
    assert completed['paymentStatus']['stringValue'] == 'COD_CONFIRMED'
    assert int(completed['codCollectedVnd']['integerValue']) == expected_amount
    assert 'codConfirmedAt' in completed
    try:
        firestore(customer, tracking_path)
        raise AssertionError('Customer can still read location after COD')
    except urllib.error.HTTPError as error:
        assert error.code == 403
    ui.capture('android-driver-cod.png')
    p02.back()
    p02.text_button('Đã giao')
    ui.wait_for(identifier='driver-order-' + order)
    ui.record('Driver confirms exact COD, sees history and customer tracking is closed')


if __name__ == '__main__':
    error = None
    evidence = {}
    ui.EVIDENCE.mkdir(parents=True, exist_ok=True)
    try:
        main(evidence)
    except Exception as exc:
        error = str(exc)
        try:
            ui.capture('android-p06-failure.png')
        except Exception:
            pass
    finally:
        result = {'result': 'FAIL' if error else 'PASS', 'cases': ui.RESULTS, 'evidence': evidence,
                  'environment': 'Android Emulator, synthetic GPS, Firebase Emulator, local Express',
                  'atUtc': datetime.now(timezone.utc).isoformat()}
        if error:
            result['failure'] = error
        (ui.EVIDENCE / 'android-smoke.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    if error:
        raise AssertionError(error)
