"""Check three pages and one public image on a seeded, dedicated Android Emulator."""

import importlib
import json
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

p02 = importlib.import_module('android-p02-smoke')
ui = p02.ui
ui.EVIDENCE = ui.ROOT / 'artifacts/evidence/P08/android-menu'
FOOD = 'p08-android-food-00'


def reveal(test_id=None, text=None):
    for _ in range(12):
        tree = ui.snapshot()
        for node in tree.iter('node'):
            if (test_id and node.get('resource-id', '').split('/')[-1] == test_id) or (
                text and text in (node.get('text'), node.get('content-desc'))
            ):
                return node
        ui.adb('shell', 'input', 'swipe', '560', '1780', '560', '590', '360')
    raise AssertionError('List row or paging button was not visible.')


def image_requests():
    url = 'http://127.0.0.1:5000/api/v1/menu-items/' + FOOD + '/image'
    start = time.monotonic()
    with urllib.request.urlopen(url, timeout=15) as response:
        data = response.read()
        assert response.headers['Content-Type'] == 'image/jpeg'
        assert response.headers['Cache-Control'] == 'public, no-cache'
        etag = response.headers['ETag']
    assert data.startswith(b'\xff\xd8\xff')
    first_ms = round((time.monotonic() - start) * 1000)
    start = time.monotonic()
    try:
        urllib.request.urlopen(urllib.request.Request(url, headers={'If-None-Match': etag}), timeout=15)
    except urllib.error.HTTPError as response:
        assert response.code == 304 and not response.read()
    else:
        raise AssertionError('Conditional request should return 304.')
    return {'firstBytes': len(data), 'firstMs': first_ms, 'conditionalBytes': 0,
            'conditionalMs': round((time.monotonic() - start) * 1000)}


def main(result):
    assert ui.SERIAL.startswith('emulator-') and len(ui.PASSWORD) >= 12
    p02.login('customer@example.invalid')
    ui.click('shop-shop1')
    start = time.monotonic()
    ui.click('open-menu')
    ui.wait_for(identifier='food-' + FOOD)
    result['initialListUiMsIncludingAdb'] = round((time.monotonic() - start) * 1000)
    ui.click('food-' + FOOD)
    ui.wait_for(text='Món đo Android 00')
    time.sleep(2)
    ui.capture('android-published-photo.png')
    assert not any(node.get('text') == 'Chưa có ảnh món' for node in ui.snapshot().iter('node'))
    result['imageLocalHttp'] = image_requests()
    ui.record('Published photo renders and conditional HTTP delivers no image bytes')
    p02.back()
    timings = []
    for marker in ('p08-android-food-20', 'p08-android-food-40'):
        button = reveal(text='Xem thêm')
        start = time.monotonic()
        ui.tap_node(button)
        reveal(test_id='food-' + marker)
        timings.append(round((time.monotonic() - start) * 1000))
    result['nextPageUiMsIncludingAdbAndScroll'] = timings
    ui.capture('android-third-page.png')
    ui.record('Android virtualized catalog reveals items from pages two and three')


if __name__ == '__main__':
    ui.EVIDENCE.mkdir(parents=True, exist_ok=True)
    result = {'environment': 'Dedicated Android Emulator and local Express/Firebase with seeded menu fixture'}
    try:
        main(result)
    except Exception as error:
        result['failure'] = str(error)
        try:
            ui.capture('failure.png')
        except Exception:
            pass
        raise
    finally:
        result.update(result='FAIL' if 'failure' in result else 'PASS', cases=ui.RESULTS,
                      atUtc=datetime.now(timezone.utc).isoformat())
        (ui.EVIDENCE / 'result.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
