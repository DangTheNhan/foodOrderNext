"""Exercise the customer UI and actual Firebase-authenticated order commands on a clean demo seed."""

import importlib
import json
import re
import sys
import urllib.request
from datetime import datetime, timezone
from uuid import uuid4

p02 = importlib.import_module('android-p02-smoke')
ui = p02.ui
ui.EVIDENCE = ui.ROOT / 'artifacts/evidence/P03'


def order_id():
    tree = ui.wait_for(text='Mã đơn ·')
    for node in tree.iter('node'):
        match = re.fullmatch(r'Mã đơn · ([A-Za-z0-9_-]{1,128})', node.get('text', ''))
        if match:
            return match[1]
    raise AssertionError('No order ID in Android receipt')


def order_total():
    p02.meal('shop1')
    ui.click('add-to-cart')
    ui.click('open-checkout')
    ui.enter('checkout-voucher', 'DEMO10K')
    p02.back()
    ui.click('quote-order')
    ui.wait_for(text='25.000')
    ui.capture('android-server-quote.png')
    ui.click('confirm-order')
    ui.wait_for(identifier='open-order-detail')
    order = order_id()
    ui.capture('android-order-success.png')
    ui.click('open-order-detail')
    ui.wait_for(identifier='cancel-order')
    return order


def api_command(token, order, action, fields):
    url = f'http://127.0.0.1:5000/api/v1/orders/{order}/{action}'
    req = urllib.request.Request(url, data=json.dumps(fields).encode(), headers={
        'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token,
        'Idempotency-Key': str(uuid4()),
    })
    with urllib.request.urlopen(req, timeout=25) as response:
        return json.load(response)['data']


def sign_in(email):
    host = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local-emulator-only'
    return ui.http_json(host, {'email': email, 'password': ui.PASSWORD, 'returnSecureToken': True})['idToken']


def fulfill(order):
    merchant = sign_in('merchant1@example.invalid')
    driver = sign_in('driver@example.invalid')
    for version, status in enumerate(['ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP'], 1):
        api_command(merchant, order, 'transitions', {'expectedStatusVersion': version, 'targetStatus': status})
    api_command(merchant, order, 'assign-driver', {
        'driverUid': 'demo-driver', 'expectedStatusVersion': 4, 'expectedAssignmentVersion': 0,
    })
    api_command(driver, order, 'accept-assignment', {'expectedAssignmentVersion': 1})
    api_command(driver, order, 'pickup', {'expectedStatusVersion': 4, 'expectedAssignmentVersion': 2})
    cod = api_command(driver, order, 'complete', {
        'expectedStatusVersion': 5, 'expectedAssignmentVersion': 2, 'codCollectedVnd': 25000,
    })
    assert cod['status'] == 'COMPLETED' and cod['amountDueVnd'] == 25000


def main():
    if len(ui.PASSWORD) < 12:
        raise RuntimeError('Supply the local demo seed password in SEED_DEMO_PASSWORD.')
    ui.EVIDENCE.mkdir(parents=True, exist_ok=True)
    p02.login('customer@example.invalid')
    first = order_total()
    ui.record('Android creates a real order after server quote with voucher and COD')

    ui.click('cancel-order')
    ui.wait_for(text='Hủy đơn này?')
    p02.text_button('Hủy đơn')
    ui.wait_for(text='Đã hủy')
    ui.capture('android-order-cancelled.png')
    ui.record('Customer cancels pending order and Firestore records CANCELLED')
    rest(first)


def rest(first, resumed=False):
    p02.restart()
    ui.click('open-order-history')
    ui.click('order-' + first)
    ui.wait_for(text='Đã hủy')
    if resumed:
        ui.capture('android-order-cancelled.png')
        ui.record('Customer cancels pending order and Firestore records CANCELLED')
    p02.back(2)
    second = order_total()
    assert first != second
    ui.record('History survives restart and cancelled voucher can be used again')

    fulfill(second)
    ui.wait_for(text='Đã thu COD')
    ui.capture('android-order-completed.png')
    ui.record('Merchant and assigned driver commands complete COD and live view updates')

    ui.click('open-review')
    p02.text_button('5 sao')
    ui.enter('review-text', 'Mon ngon va giao dung gio')
    p02.back()
    ui.click('send-review')
    ui.wait_for(text='Bạn đã đánh giá đơn này.')
    ui.capture('android-order-reviewed.png')
    ui.record('Customer submits one verified review after completed COD')


if __name__ == '__main__':
    failure = None
    try:
        if len(sys.argv) == 3 and sys.argv[1] == '--resume-after-cancel':
            previous = json.loads((ui.EVIDENCE / 'android-smoke.json').read_text(encoding='utf-8'))
            if len(previous['cases']) != 1 or previous['cases'][0]['result'] != 'PASS':
                raise RuntimeError('Expected a checkpoint after the first order.')
            ui.RESULTS.extend(previous['cases'])
            rest(sys.argv[2], resumed=True)
        else:
            main()
    except Exception as exc:
        failure = str(exc)
        try:
            ui.capture('android-p03-failure.png')
        except Exception:
            pass
    finally:
        report = {'result': 'FAIL' if failure else 'PASS', 'cases': ui.RESULTS,
                  'atUtc': datetime.now(timezone.utc).isoformat(),
                  'environment': 'Android Emulator + Firebase Emulator + local Express'}
        if failure:
            report['failure'] = failure
        (ui.EVIDENCE / 'android-smoke.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    if failure:
        raise AssertionError(failure)
