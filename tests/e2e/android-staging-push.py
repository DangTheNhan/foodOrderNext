"""Exercise the notification settings on the dedicated Android staging emulator."""

import importlib
import json
import sys

smoke = importlib.import_module('android-staging-cod')
ui, p02 = smoke.ui, smoke.p02


def permission_button(button):
    tree = ui.wait_for(identifier=button)
    ui.tap_node(ui.locate(tree, button))


def run(action):
    assert ui.SERIAL == 'emulator-5562'
    assert ui.adb('emu', 'avd', 'name').splitlines()[0] == 'FoodOrderStagingSmoke'
    if action == 'deny':
        accounts = json.load(sys.stdin)
        checksum = smoke.install_staging_test_apk()
        modal = ui.locate(ui.snapshot(), 'android:id/aerr_wait')
        if modal is not None:
            ui.tap_node(modal)
        smoke.fresh_login(accounts, 'customer', 'Khách hàng')
        ui.click('open-profile')
        ui.wait_for(text='Cài đặt và hỗ trợ')
        p02.text_button('Cài đặt và hỗ trợ')
        ui.wait_for(text='Thông báo đơn hàng')
        p02.text_button('Thông báo đơn hàng')
        ui.wait_for(text='Đã tắt thông báo đẩy')
        p02.text_button('Bật thông báo đẩy')
        permission_button('permission_deny_button')
        ui.wait_for(text='Thiết bị chưa cấp quyền thông báo.')
        print(checksum)
    elif action == 'grant':
        p02.text_button('Cấp quyền thông báo')
        permission_button('permission_allow_button')
        ui.wait_for(text='Thiết bị đã cấp quyền thông báo.')
    elif action == 'off':
        p02.text_button('Tắt thông báo đẩy')
        ui.wait_for(text='Đã tắt thông báo đẩy')
    elif action == 'on':
        p02.text_button('Bật thông báo đẩy')
        ui.wait_for(text='Đã bật thông báo đẩy')
        ui.wait_for(text='Thiết bị đã cấp quyền thông báo.')
    elif action == 'logout':
        p02.back(2)
        ui.click('logout')
        ui.wait_for(identifier='login-email')
    else:
        raise ValueError('Unknown staging push UI action')


if __name__ == '__main__':
    try:
        run(sys.argv[1])
    except (AssertionError, RuntimeError, ValueError) as error:
        description = str(error)
        if description.startswith(('Expected screen element did not appear:', 'Button is not visible:')):
            print(description, file=sys.stderr)
        else:
            print(type(error).__name__, file=sys.stderr)
        sys.exit(1)
