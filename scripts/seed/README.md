# Seed demo emulator — P01

Đường mặc định là tài khoản Firebase demo mới và dữ liệu VND tổng hợp. Không import legacy user, mật khẩu, OTP hoặc dữ liệu cá nhân. Không có cloud mode.

## Dữ liệu

Seed deterministic cho 1–3 quán (mặc định 3), menu nhỏ nguyên VND, Auth accounts và users role/active, driver approved theo quán, registry admin, địa chỉ tổng hợp, cart rỗng, voucher/counter zero, một COMPLETED/COD_CONFIRMED/review verified tổng hợp, một PENDING và một DELIVERING. Stock/sold/reserved và activeOrderCount của customer/merchant/driver/shop được đối soát; review public không có customerUid/orderId/phone/email.

Fixture COMPLETED là dữ liệu tạo sẵn, không chứng minh đã chạy lifecycle. Nhãn fake/seedVersion và đường sở hữu ở seedManifests private; UI demo phải nói rõ fixture. Một review chỉ phục vụ kiểm dữ liệu, chưa đủ ngưỡng ba review của AI insights.

Auth UIDs/email:
- demo-customer — customer@example.invalid
- demo-customer-2 — customer2@example.invalid
- demo-merchant-1..3 — merchant1..3@example.invalid (tùy số quán)
- demo-driver — driver@example.invalid
- demo-admin — admin@example.invalid
- demo-locked — locked@example.invalid (disabled/inactive)

Password được cấp qua môi trường, ít nhất 12 ký tự. Không có password mặc định, không in password hoặc token. Account seed verified chỉ ở emulator.

## Cấp môi trường (PowerShell)

Khởi động emulator từ root, rồi trong terminal local khác đặt:

    $env:GCLOUD_PROJECT = 'demo-foodordernext'
    $env:FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
    $env:FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
    $env:FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199'
    Remove-Item Env:GOOGLE_APPLICATION_CREDENTIALS -ErrorAction SilentlyContinue

Không cấp service account. Guard từ chối host khác, port khác, project khác hoặc thiếu bất kỳ emulator variable nào; guard chạy cả dry-run.

## Dry-run, apply và rerun

    node scripts/seed/index.mjs --dry-run --shops=3

Dry-run chỉ tạo/validate plan trong bộ nhớ và in summary; không khởi tạo Firebase Admin hoặc kết nối database. Để ghi local, cấp password tương tác (PowerShell 7):

    $env:SEED_DEMO_PASSWORD = Read-Host -MaskInput 'Mật khẩu demo local (12+ ký tự)'
    node scripts/seed/index.mjs --apply --shops=3
    Remove-Item Env:SEED_DEMO_PASSWORD

Seed commit Firestore bằng batch create sau preflight; collision không có manifest bị từ chối. Auth identity đã tồn tại không tự đổi password/disable. Nếu batch lỗi giữa chừng, dữ liệu Auth có thể đã được tạo; rerun kiểm UID/email và giữ identity, không tự cấp lại quyền.

Rerun cùng manifest trả PRESERVED_EXISTING_DATASET và không sửa role/active/counters/profile/menu/order. Đổi số quán hoặc thiếu document không tự sửa chắp vá, vì có thể phá authority/invariants.

## Reset có giới hạn

Chỉ emulator, chỉ dataset sở hữu và chỉ khi dữ liệu chưa drift khỏi fingerprint lúc seed:

    node scripts/seed/index.mjs --apply --shops=3 --reset --confirm-reset=demo-foodordernext/foodordernext-seed-v1

Reset cần password môi trường như apply; thiếu exact confirmation thì từ chối. Chỉ xóa document được manifest liệt kê và Auth UIDs seed, không xóa toàn project. Từ chối khi có bản ghi top-level khác trong users/shops/menuItems/orders/reviews hoặc nội dung seed đã đổi. Các subcollection do app tạo không được tự quét/xóa; nếu đã dùng app và muốn môi trường sạch, dừng emulator và tự khởi tạo một phiên emulator local mới không import dataset cũ.

Không dùng reset để bypass conflict policy trên môi trường cloud; script không hỗ trợ cloud reset.

## Kiểm tra

    node --test scripts/seed/plan.test.mjs

Kiểm pure plan/stock/counters/sanitized review và fail-closed guard không cần emulator. Smoke seed apply/rerun thực cần emulator, không coi pure tests là bằng chứng Auth/Firestore tích hợp.

## Bộ dữ liệu staging P09

`staging-demo.mjs` dùng phiên Firebase CLI đã đăng nhập và cấu hình Android release của `foodordernext-staging`. Chạy từ thư mục gốc trên Windows với PowerShell 7 (`pwsh.exe`) và đã cài các gói từ lockfile.

    node scripts/seed/staging-demo.mjs --seed-only foodordernext-staging
    node scripts/seed/staging-demo.mjs --journey foodordernext-staging

Lệnh đầu tạo một quán, hai danh mục, ba món và ba tài khoản tổng hợp với quyền khách, quán, tài xế. Tài khoản được đánh dấu email đã xác minh để chạy demo. Lượt tạo Firestore dùng một commit với điều kiện từng tài liệu chưa tồn tại. Khi chạy lại cùng bộ dữ liệu, script đối chiếu manifest và giữ các tài liệu đã có. [Firestore REST commit](https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/commit)

Mật khẩu ngẫu nhiên lưu dưới dạng mã hóa DPAPI trong `work/p09-staging-demo-v1/accounts.dpapi`, đọc bằng đúng tài khoản Windows đã tạo tệp. `work/` nằm ngoài Git. Lượt `--journey` tạo và giao một đơn thử qua Render HTTPS, thử gửi lặp đặt đơn và hoàn tất, kiểm số tiền COD, tồn kho và đánh giá trong Firestore. Dữ liệu đơn và đánh giá thử được giữ lại trên quán demo. Biên bản JSON nằm trong `artifacts/evidence/P09/`.

Nếu lượt thử dừng khi đơn demo còn ở `DELIVERING`, truyền mã đơn do script in ra làm đối số cuối của `--journey` để hoàn tất chính đơn đó. Script kiểm quán, khách, tài xế, món và phiên bản trạng thái trước khi tiếp tục.

Để chạy UI staging trên máy ảo riêng `FoodOrderStagingSmoke` đã bật ở cổng `5562`, đặt `ADB_PATH` nếu `adb` chưa có trong `PATH`. Dùng PowerShell 7 trên cùng tài khoản Windows đã chạy seed.

    $env:ANDROID_SERIAL = 'emulator-5562'
    $env:PYTHONIOENCODING = 'utf-8'
    $protected = ConvertTo-SecureString (Get-Content -Raw -LiteralPath 'work/p09-staging-demo-v1/accounts.dpapi')
    $identity = New-Object System.Net.NetworkCredential('demo', $protected)
    $identity.Password | python tests/e2e/android-staging-cod.py
    Remove-Variable protected, identity

Kiểm thử dò đúng máy ảo, xác minh SHA-256 APK staging rồi xóa dữ liệu ứng dụng giữa các vai trò. Mỗi lượt tạo một đơn mới và ghi biên bản cùng ảnh vào `artifacts/evidence/P09/`.

Để thử các truy vấn realtime của app trên Firebase thật, chạy từ cùng tài khoản Windows sau bước seed.

    node scripts/seed/staging-demo.mjs --realtime foodordernext-staging

Lượt thử mở ba phiên SDK đồng thời, tạo một đơn demo, thử chat hai chiều, ngắt mạng SDK của quán, kết nối lại và hoàn tất COD. Biên bản `artifacts/evidence/P05/staging-realtime.json` đo từ lúc đọc phản hồi Express đến callback Firestore có dữ liệu từ máy chủ. Số âm nghĩa là callback đến trước phản hồi Express.

Để đo trang kế tiếp của báo cáo trên staging, dùng lệnh dưới đây sau bước seed. Bộ mẫu có 21 bản ghi lịch sử tổng hợp, thuộc quán riêng `p08-staging-report-v1` và ngày **02/01/2026**. Quán mẫu không nhận đơn. Lượt chạy lại giữ bộ mẫu và kiểm tra API trả 20 dòng ở trang đầu, một dòng ở trang sau.

    node scripts/seed/staging-demo.mjs --report-fixture foodordernext-staging

Trong APK chẩn đoán, đăng nhập vai trò quán rồi mở **P08 · Quán mẫu phân trang**. Chọn **Báo cáo theo ngày**, nhập `2026-01-02` và bấm **Xem ngày**. Cuộn tới **Xem thêm** để chạy trace trang kế tiếp. [Bật log chẩn đoán](../../docs/SETUP_LOCAL.md#trace-và-ký-apk-staging)

Để thử vòng đời đăng ký thiết bị Android trên staging, bật AVD `FoodOrderStagingSmoke` ở cổng `5562`. Đặt `ADB_PATH` thành đường dẫn tới `adb.exe` và dùng máy Windows đã chạy seed.

    node scripts/seed/staging-demo.mjs --push-device foodordernext-staging

Lượt thử xác minh SHA-256 APK, đăng nhập khách demo, thử từ chối rồi cấp quyền Android, tắt/bật thông báo và đăng xuất. Script kiểm tra đăng ký trên Firestore bằng phép đọc giới hạn trường và khôi phục tùy chọn demo sau lượt chạy. Biên bản `artifacts/evidence/P05/staging-push-device.json` ghi vòng đời đăng ký. Ca nhận thông báo từ Firebase dùng checklist P05 riêng.
