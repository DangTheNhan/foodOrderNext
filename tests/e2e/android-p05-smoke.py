"""Phase 5 native realtime UI with separate authenticated API actors on the local Firebase demo."""

import importlib
import json
import time
import urllib.error
from datetime import datetime, timezone

p02 = importlib.import_module('android-p02-smoke')
p03 = importlib.import_module('android-p03-smoke')
ui = p02.ui
ui.EVIDENCE = ui.ROOT / 'artifacts/evidence/P05'


def back_to(identifier):
    p02.back()
    ui.wait_for(identifier=identifier)


def send(text):
    ui.enter('chat-draft', text)
    p02.back()
    ui.click('send-chat')
    ui.wait_for(text='Bạn')


def main(report):
    if len(ui.PASSWORD) < 12:
        raise RuntimeError('Set SEED_DEMO_PASSWORD for local demo accounts.')
    order = 'demo-pending'
    p02.login('customer@example.invalid')
    ui.click('open-order-history')
    ui.click('order-' + order)
    ui.click('open-order-chat')
    send('Khach hoi ve don P05')
    ui.record('Android customer sends a persisted order chat message')

    merchant_token = p03.sign_in('merchant1@example.invalid')
    reply = p03.api_command(merchant_token, order, 'messages', {
        'clientMessageId': 'p05-reply-from-merchant', 'text': 'Quan da nhan tin P05',
    })
    response_time = time.monotonic()
    ui.wait_for(text='Quan da nhan tin P05')
    report['merchantReplyApiResponseToUiPollMs'] = round((time.monotonic() - response_time) * 1000)
    ui.capture('android-two-way-chat.png')
    ui.record('A separately authenticated merchant reply appears in the open customer chat')

    back_to('open-order-chat')
    back_to('order-' + order)
    back_to('open-inbox')
    ui.click('open-inbox')
    event = 'message-' + reply['messageId']
    ui.wait_for(identifier='inbox-' + event)
    ui.capture('android-notification-inbox.png')
    ui.click('inbox-' + event)
    ui.wait_for(text='Quan da nhan tin P05')
    ui.record('Inbox notification opens authorized chat after checking current access')

    back_to('notification-list')
    back_to('open-inbox')
    ui.logout()
    ui.login('merchant1@example.invalid', 'Nhà hàng')
    ui.click('ops-shop-shop1')
    ui.click('open-merchant-queue')
    ui.wait_for(identifier='merchant-order-' + order)
    customer_token = p03.sign_in('customer@example.invalid')
    p03.api_command(customer_token, order, 'cancel', {'expectedStatusVersion': 1})
    response_time = time.monotonic()
    ui.wait_for(text='Chưa có đơn ở trạng thái này.')
    report['cancelApiResponseToQueueUiPollMs'] = round((time.monotonic() - response_time) * 1000)
    ui.capture('android-queue-after-cancel.png')
    ui.record('Merchant pending queue drops a cancelled customer order without refresh')
    try:
        p03.api_command(merchant_token, order, 'messages', {'clientMessageId': 'closed-native-check', 'text': 'Closed'})
        raise AssertionError('Terminal room accepted a new message')
    except urllib.error.HTTPError as error:
        assert error.code == 409

    back_to('open-merchant-queue')
    back_to('open-profile')
    ui.logout()
    ui.login('driver@example.invalid', 'Tài xế')
    ui.click('driver-order-demo-delivering')
    ui.wait_for(text='Tài xế đã nhận')
    ui.capture('android-driver-trip.png')
    ui.click('open-order-chat')
    send('Shipper dang giao P05')
    ui.capture('android-driver-chat.png')
    ui.record('Assigned driver reads trip and sends chat after accepting assignment')


if __name__ == '__main__':
    failure = None
    measurements = {}
    try:
        main(measurements)
    except Exception as exc:
        failure = str(exc)
        try:
            ui.capture('android-p05-failure.png')
        except Exception:
            pass
    finally:
        result = {'result': 'FAIL' if failure else 'PASS', 'cases': ui.RESULTS,
                  'atUtc': datetime.now(timezone.utc).isoformat(), 'measurements': measurements,
                  'environment': 'One Android Emulator, separate signed-in API actors, Local Firebase. UI measurements include ADB screen polling.'}
        if failure:
            result['failure'] = failure
        (ui.EVIDENCE / 'android-smoke.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    if failure:
        raise AssertionError(failure)
