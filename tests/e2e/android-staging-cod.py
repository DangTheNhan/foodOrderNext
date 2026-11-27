"""Exercise checkout, fulfillment and review on the dedicated staging AVD using synthetic credentials on stdin."""

import hashlib
import importlib
import json
import re
import sys
from datetime import datetime, timezone

p03 = importlib.import_module('android-p03-smoke')
p02 = p03.p02
ui = p03.ui
ui.EVIDENCE = ui.ROOT / 'artifacts/evidence/P09'
package = 'com.foodordernext.app'
dataset = 'p09-staging-demo-v1'
shop = dataset + '-shop'
report = {'projectId': 'foodordernext-staging', 'datasetId': dataset, 'serial': ui.SERIAL,
          'checkedAt': datetime.now(timezone.utc).isoformat(), 'result': 'FAIL', 'cases': ui.RESULTS}


def fresh_login(accounts, role, label):
    user = accounts[role]
    assert re.fullmatch(dataset + '-' + role + r'-[0-9a-f]{16}', user['uid'])
    assert user['email'] == user['uid'] + '@example.invalid'
    assert re.fullmatch(r'Z8a[0-9a-f]{36}', user['password'])
    assert 'Success' in ui.adb('shell', 'pm', 'clear', package)
    ui.adb('shell', 'am', 'start', '-W', '-n', p02.COMPONENT)
    ui.PASSWORD = user['password']
    ui.login(user['email'], label)
    ui.PASSWORD = ''


def install_staging_test_apk():
    assert ui.SERIAL == 'emulator-5562' and ui.adb('emu', 'avd', 'name').splitlines()[0] == 'FoodOrderStagingSmoke'
    receipt = json.loads((ui.EVIDENCE / 'android-staging-test-receipt.json').read_text(encoding='utf-8-sig'))
    assert receipt['testOnly'] and receipt['signedAndVerified']
    assert receipt['apiBaseUrl'] == 'https://foodordernext-api-staging.onrender.com/api/v1'
    apk = ui.ROOT / receipt['artifact']
    assert hashlib.sha256(apk.read_bytes()).hexdigest().lower() == receipt['sha256'].lower()
    assert 'Success' in ui.adb('install', '-r', str(apk))
    return receipt['sha256']


def journey(accounts):
    report['apkSha256'] = install_staging_test_apk()

    fresh_login(accounts, 'customer', 'Khách hàng')
    ui.click('shop-' + shop)
    ui.click('open-menu')
    ui.click('food-' + dataset + '-rice')
    ui.click('add-to-cart')
    ui.click('open-checkout')
    ui.click('quote-order')
    ui.wait_for(text='35.000')
    ui.click('confirm-order')
    ui.wait_for(identifier='open-order-detail')
    order = p03.order_id()
    report['orderId'] = order
    ui.capture('staging-cod-customer-order.png')
    ui.record('Khách đặt đơn COD 35.000 đồng từ thực đơn staging')

    fresh_login(accounts, 'merchant', 'Nhà hàng')
    ui.click('ops-shop-' + shop)
    ui.click('open-merchant-queue')
    ui.click('merchant-order-' + order)
    ui.click('merchant-transition')
    ui.wait_for(text='Quán đã xác nhận')
    ui.click('open-assignment')
    ui.click('assign-' + accounts['driver']['uid'])
    ui.wait_for(text='Đã gán, chờ tài xế nhận')
    ui.click('merchant-transition')
    ui.wait_for(text='Đang chuẩn bị')
    ui.click('merchant-transition')
    ui.wait_for(text='Chờ tài xế lấy món')
    ui.capture('staging-cod-merchant-ready.png')
    ui.record('Quán nhận đơn, phân công tài xế và báo món đã sẵn sàng')

    fresh_login(accounts, 'driver', 'Tài xế')
    ui.click('driver-order-' + order)
    ui.click('accept-driver-trip')
    ui.click('pickup-driver-trip')
    ui.click('complete-driver-trip')
    ui.click('confirm-driver-cod')
    ui.wait_for(text='Đã thu COD')
    ui.capture('staging-cod-driver-completed.png')
    ui.record('Tài xế nhận chuyến, xác nhận lấy món và thu COD')

    fresh_login(accounts, 'customer', 'Khách hàng')
    ui.click('open-order-history')
    ui.click('order-' + order)
    ui.wait_for(text='Đã thu COD')
    ui.click('open-review')
    p02.text_button('5 sao')
    ui.enter('review-text', 'Kiem thu APK staging')
    p02.back()
    ui.click('send-review')
    ui.wait_for(text='Bạn đã đánh giá đơn này.')
    ui.capture('staging-cod-customer-reviewed.png')
    ui.record('Khách mở lại đơn đã thu COD và gửi đánh giá sau giao')
    ui.adb('shell', 'pm', 'clear', package)
    report['result'] = 'PASS'


if __name__ == '__main__':
    try:
        journey(json.load(sys.stdin))
    except (AssertionError, RuntimeError, OSError, ValueError) as error:
        report['failure'] = type(error).__name__
        if str(error).startswith(('Expected screen element did not appear:', 'Button is not visible:')):
            report['failure'] += ': ' + str(error)
    finally:
        proof = ui.EVIDENCE / 'android-staging-cod-journey.json' if report['result'] == 'PASS' else ui.ROOT / 'work/p09-staging-demo-v1/android-journey-failure.json'
        proof.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(json.dumps(report, ensure_ascii=False), flush=True)
    sys.exit(report['result'] != 'PASS')
