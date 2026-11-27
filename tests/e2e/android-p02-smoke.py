"""P02 Android smoke using only the dedicated local Firebase demo environment."""

import importlib
import json
import sys
import time
from datetime import datetime, timezone

ui = importlib.import_module('android-p01-smoke')
ui.EVIDENCE = ui.ROOT / 'artifacts/evidence/P02'
COMPONENT = 'com.foodordernext.app/com.foodorderingapp.MainActivity'


def text_button(label):
    for node in ui.snapshot().iter('node'):
        if label.casefold() in (node.get('text', '').casefold(), node.get('content-desc', '').casefold()):
            ui.tap_node(node)
            return
    raise AssertionError('Button is not visible: ' + label)


def login(email):
    ui.enter('login-email', email)
    ui.enter('login-password', ui.PASSWORD)
    back()
    ui.click('login-submit')
    ui.wait_for(identifier='shop-shop1')


def back(count=1):
    for _ in range(count):
        ui.adb('shell', 'input', 'keyevent', '4')
        time.sleep(0.35)


def meal(shop):
    ui.click('shop-' + shop)
    ui.click('open-menu')
    ui.click('food-' + shop + '-rice')


def restart():
    ui.adb('shell', 'am', 'force-stop', 'com.foodordernext.app')
    ui.adb('shell', 'am', 'start', '-n', COMPONENT)
    ui.wait_for(identifier='shop-shop1', timeout=75)


def main():
    if len(ui.PASSWORD) < 12:
        raise RuntimeError('Set the password for the local demo seed.')
    if ui.locate(ui.snapshot(), 'open-profile') is not None:
        ui.logout()
    login('customer@example.invalid')
    meal('shop1')
    ui.capture('android-food.png')
    ui.click('toggle-favorite')
    ui.wait_for(text='Bỏ yêu thích')
    ui.click('add-to-cart')
    ui.wait_for(text='1 suất')
    ui.click('plus-shop1-rice')
    ui.wait_for(text='2 suất')
    ui.capture('android-cart.png')
    ui.record('Read real shop/menu/item, save favorite and update persistent cart')

    ui.click('open-checkout')
    ui.wait_for(text='Thanh toán khi nhận hàng')
    ui.click('quote-order')
    ui.wait_for(text='Thu khi nhận món')
    ui.capture('android-checkout.png')
    ui.record('Checkout preview shows own address, COD and estimated prices')

    restart()
    ui.click('open-cart')
    ui.wait_for(text='2 suất')
    back()
    ui.click('open-favorites')
    ui.wait_for(text='Cơm gà demo')
    ui.record('Cart and favorite survive a native process restart')
    back()
    remaining()


def remaining():
    meal('shop2')
    ui.click('add-to-cart')
    ui.wait_for(text='Đổi quán?')
    text_button('Giữ giỏ cũ')
    ui.wait_for(identifier='add-to-cart')
    ui.click('add-to-cart')
    ui.wait_for(text='Đổi quán?')
    text_button('Thay giỏ')
    ui.wait_for(text='Quán campus demo 2')
    ui.wait_for(text='1 suất')
    ui.record('Switching shops requires explicit choice and replaces the cart')
    restart()

    ui.click('open-profile')
    ui.click('open-addresses')
    ui.click('add-address')
    ui.enter('address-label', 'P02 Campus East')
    ui.enter('address-phone', '0900000123')
    ui.enter('address-text', 'East gate in demo campus')
    back()
    ui.click('save-address')
    ui.wait_for(text='P02 Campus East')
    ui.capture('android-addresses.png')
    ui.record('Manual address saved without location permission')

    back(2)
    ui.logout()
    login('customer2@example.invalid')
    ui.click('open-cart')
    ui.wait_for(text='Giỏ đang trống')
    back()
    ui.click('open-favorites')
    ui.wait_for(text='Bạn chưa lưu món nào.')
    back()
    ui.click('open-profile')
    ui.click('open-addresses')
    ui.wait_for(text='Khuôn viên demo')
    assert not any('P02 Campus East' in node.get('text', '') for node in ui.snapshot().iter('node'))
    ui.record('Second account sees its own cart, favorites and addresses')

    back()
    text_button('Cài đặt và hỗ trợ')
    text_button('Trợ giúp và thông tin')
    ui.wait_for(text='Hỗ trợ trong buổi demo')
    back()
    text_button('Cài đặt hệ thống của ứng dụng')
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline:
        if 'com.android.settings' in ui.adb('shell', 'dumpsys', 'activity', 'activities').split('topResumedActivity=')[-1].splitlines()[0]:
            break
        time.sleep(0.5)
    else:
        raise AssertionError('Android Settings did not open')
    ui.record('In-app help and Android application settings open')


if __name__ == '__main__':
    result = 'PASS'
    failure = None
    try:
        if sys.argv[1:] == ['--resume-after-restart']:
            previous = json.loads((ui.EVIDENCE / 'android-smoke.json').read_text(encoding='utf-8'))
            if len(previous['cases']) != 3 or previous['cases'][-1]['case'] != 'Cart and favorite survive a native process restart':
                raise RuntimeError('Checkpoint requires the first three cases and the unchanged local demo cart.')
            ui.RESULTS.extend(previous['cases'])
            restart()
            remaining()
        else:
            main()
    except Exception as exc:
        result = 'FAIL'
        failure = str(exc)
        try:
            ui.capture('android-p02-failure.png')
        except Exception:
            pass
    finally:
        report = {'result': result, 'atUtc': datetime.now(timezone.utc).isoformat(),
                  'environment': 'Android Emulator with demo-foodordernext', 'cases': ui.RESULTS}
        if failure:
            report['failure'] = failure
        (ui.EVIDENCE / 'android-smoke.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    if failure:
        raise AssertionError(failure)
