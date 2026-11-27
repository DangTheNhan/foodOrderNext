"""Native Phase 4 smoke on a clean local demo seed and a disposable Android AVD."""

import importlib
import json
import os
import sys
import time
import urllib.request
from datetime import datetime, timezone

p02 = importlib.import_module('android-p02-smoke')
p03 = importlib.import_module('android-p03-smoke')
ui = p02.ui
ui.EVIDENCE = ui.ROOT / 'artifacts/evidence/P04'


def api_data(email, path):
    token = p03.sign_in(email)
    return ui.http_json('http://127.0.0.1:5000/api/v1' + path, token=token)['data']


def restart_home():
    ui.adb('shell', 'am', 'force-stop', 'com.foodordernext.app')
    ui.adb('shell', 'am', 'start', '-n', p02.COMPONENT)
    ui.wait_for(identifier='open-profile', timeout=75)


def create_menu():
    ui.click('ops-shop-shop1')
    ui.click('open-merchant-menu')
    ui.click('new-menu-item')
    ui.enter('menu-initial', '4')
    ui.enter('menu-name', 'Com Thu P04')
    ui.enter('menu-price', '42000')
    p02.back()
    p02.text_button('Cơm và món chính')
    ui.click('save-menu-item')
    ui.wait_for(identifier='open-stock')
    found = api_data('merchant1@example.invalid', '/shops/shop1/menu-items')
    food = next(row for row in found['rows'] if row['name'] == 'Com Thu P04')
    assert food['availablePortions'] == 4 and food['priceVnd'] == 42000
    ui.record('Merchant creates a menu item through Express')
    return food['id']


def pick_photo():
    initial = ui.snapshot()
    for node in initial.iter('node'):
        if 'Done' in (node.get('text'), node.get('content-desc')):
            ui.tap_node(node)
            return
    if not any(node.get('content-desc', '').startswith('Photo taken') for node in initial.iter('node')):
        ui.click('pick-menu-photo')
    deadline = time.monotonic() + 25
    while time.monotonic() < deadline:
        tree = ui.snapshot()
        for node in tree.iter('node'):
            rid = node.get('resource-id', '')
            if rid.endswith('/icon_thumbnail') or rid.endswith('/photo_grid_item') or node.get('content-desc', '').startswith('Photo taken'):
                ui.tap_node(node)
                selected = ui.snapshot()
                for confirm in selected.iter('node'):
                    if 'Done' in (confirm.get('text'), confirm.get('content-desc')):
                        ui.tap_node(confirm)
                        break
                return
        time.sleep(0.5)
    raise AssertionError('No indexed photo in Android Media Picker.')


def attach_photo(food_id):
    pick_photo()
    ui.wait_for(text='Ảnh đã tải lên')
    save = ui.locate(ui.snapshot(), 'save-menu-item')
    if save is None:
        ui.adb('shell', 'input', 'swipe', '500', '2030', '500', '1160', '420')
    ui.click('save-menu-item')
    ui.wait_for(identifier='pick-menu-photo')
    item = api_data('merchant1@example.invalid', '/menu-items/' + food_id)
    assert item['imagePath'].startswith('shops/shop1/menuPublished/' + food_id + '/')
    with urllib.request.urlopen('http://127.0.0.1:5000/api/v1/menu-items/' + food_id + '/image', timeout=15) as result:
        assert result.headers['Content-Type'].startswith('image/')
    ui.record('Android selects, uploads and publishes a photo via Firebase Storage and Express')


def adjust_stock(food_id):
    ui.click('open-stock')
    ui.enter('stock-number', '2')
    ui.enter('stock-reason', 'Nap suat demo')
    p02.back()
    ui.click('save-stock')
    ui.wait_for(text='Có thể bán · 6')
    item = api_data('merchant1@example.invalid', '/menu-items/' + food_id)
    assert (item['availablePortions'], item['reservedPortions']) == (6, 0)
    ui.capture('android-merchant-stock.png')
    ui.record('Merchant adds available portions and stock screen reads the committed value')


def process_order():
    restart_home()
    ui.click('ops-shop-shop1')
    ui.click('open-merchant-queue')
    ui.click('merchant-order-demo-pending')
    ui.click('merchant-transition')
    ui.wait_for(text='Quán đã xác nhận')
    ui.click('open-assignment')
    ui.click('assign-demo-driver')
    ui.wait_for(text='Đã gán, chờ tài xế nhận')
    ui.click('merchant-transition')
    ui.wait_for(text='Đang chuẩn bị')
    ui.click('merchant-transition')
    ui.wait_for(text='Chờ tài xế lấy món')
    ui.capture('android-merchant-ready.png')
    ui.record('Merchant accepts, assigns, prepares and marks a scoped order ready')


def read_report():
    restart_home()
    ui.click('ops-shop-shop1')
    ui.click('open-daily-report')
    ui.enter('report-day', '2026-01-01')
    p02.back()
    p02.text_button('Xem ngày')
    ui.wait_for(text='65.000')
    ui.wait_for(text='Đơn giao và thu COD trong ngày · 1')
    ui.capture('android-merchant-daily.png')
    ui.record('Daily report shows exactly one delivered COD order and 65,000 VND for seed day')


def administer(already_listed=False):
    if not already_listed:
        restart_home()
        ui.logout()
        ui.login('admin@example.invalid', 'Quản trị viên')
        ui.click('open-admin-users')
    p02.text_button('Đã khóa')
    p02.text_button('Áp dụng bộ lọc')
    ui.click('admin-user-demo-locked')
    p02.text_button('Tài xế')
    p02.text_button('Hoạt động')
    ui.click('save-user-permissions')
    ui.wait_for(identifier='save-user-permissions')
    target = api_data('admin@example.invalid', '/admin/users/demo-locked')
    assert target['role'] == 'driver' and target['active'] is True
    ui.capture('android-admin-authority.png')
    restart_home()
    ui.click('ops-shop-shop3')
    ui.click('open-shop-drivers')
    ui.click('open-driver-approval')
    ui.click('approve-demo-locked')
    ui.wait_for(text='Tài khoản khóa demo')
    drivers = api_data('admin@example.invalid', '/shops/shop3/drivers')['rows']
    assert any(row['id'] == 'demo-locked' and row['assignable'] for row in drivers)
    ui.record('Admin changes role and active state, then approves the real driver for a selected shop')


def check_catalog(food_id):
    restart_home()
    ui.logout()
    p02.login('customer@example.invalid')
    ui.click('shop-shop1')
    ui.click('open-menu')
    ui.click('food-' + food_id)
    ui.wait_for(text='Com Thu P04')
    ui.wait_for(text='Còn 6 suất')
    ui.capture('android-customer-updated-menu.png')
    ui.record('Customer sees the merchant item and updated available portions')


def main():
    if len(ui.PASSWORD) < 12:
        raise RuntimeError('Set the local demo seed password.')
    ui.login('merchant1@example.invalid', 'Nhà hàng')
    food_id = create_menu()
    remaining(food_id)


def remaining(food_id):
    if os.environ.get('P04_PICK_PHOTO') == '1':
        attach_photo(food_id)
    adjust_stock(food_id)
    process_order()
    read_report()
    administer()
    check_catalog(food_id)


if __name__ == '__main__':
    failure = None
    try:
        if sys.argv[1:] == ['--resume-after-menu'] or sys.argv[1:] == ['--resume-after-report']:
            previous = json.loads((ui.EVIDENCE / 'android-smoke.json').read_text(encoding='utf-8'))
            checkpoint = sys.argv[1]
            last_case = ('Merchant creates a menu item through Express' if checkpoint == '--resume-after-menu'
                         else 'Daily report shows exactly one delivered COD order and 65,000 VND for seed day')
            if not previous['cases'] or previous['cases'][-1]['case'] != last_case:
                raise RuntimeError('Saved report does not match this checkpoint.')
            ui.RESULTS.extend(previous['cases'])
            menu = api_data('merchant1@example.invalid', '/shops/shop1/menu-items')
            food_id = next(row['id'] for row in menu['rows'] if row['name'] == 'Com Thu P04')
            if checkpoint == '--resume-after-menu':
                remaining(food_id)
            else:
                administer(already_listed=True)
                check_catalog(food_id)
        else:
            main()
    except Exception as exc:
        failure = str(exc)
        try:
            ui.capture('android-p04-failure.png')
        except Exception:
            pass
    finally:
        evidence = {'result': 'FAIL' if failure else 'PASS', 'cases': ui.RESULTS,
                    'atUtc': datetime.now(timezone.utc).isoformat(),
                    'environment': 'Android Emulator + local Firebase + Express'}
        if failure:
            evidence['failure'] = failure
        (ui.EVIDENCE / 'android-smoke.json').write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    if failure:
        raise AssertionError(failure)
