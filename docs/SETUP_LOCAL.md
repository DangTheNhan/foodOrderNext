# Chạy FoodOrderNext trên Windows và Android Emulator

Vị trí triển khai hiện tại: `C:\Users\dangt\Documents\Codex\FoodOrderNext`. Thư mục kế hoạch cũ trong `Documents\ChatGPT\Project mobile` không nhận các thay đổi triển khai của phiên này.

Ứng dụng chạy Firebase Auth, Firestore, Storage và Express local với project **demo-foodordernext**. Có thể demo từ đặt món đến giao hàng, thu COD và đánh giá, cùng chat, hộp thư và GPS mô phỏng trên Android Emulator. Dùng Ollama local để chạy hai tính năng AI theo hướng dẫn bên dưới.

## Môi trường đã kiểm chứng

- Windows, Node **24.18.0**, npm **11.16.0**, JDK **21.0.12**.
- Android SDK compile/target **36**, min SDK **24**, Kotlin **2.1.20**, Gradle **9.3.1**.
- React Native **0.86.0**, React **19.2.3**, RNFirebase app/auth/firestore **26.4.1**.
- Android applicationId mới: **com.foodordernext.app**. Namespace/component baseline được giữ để tái sử dụng native source.
- Đã build debug x86_64 và chạy trên AVD Medium_Phone. Máy Android vật lý/iOS và Firebase cloud chưa được nghiệm thu.

## Cài dependency

Tại root:

```powershell
cd C:\Users\dangt\Documents\Codex\FoodOrderNext
npm ci
npm --prefix apps/mobile ci --workspaces=false
npm run doctor
```

Root workspace chỉ chứa API và contracts. Mobile giữ node_modules/lockfile riêng để khớp đường dẫn Gradle của baseline.

## 1. Bật Firebase Emulator — terminal thứ nhất

```powershell
cd C:\Users\dangt\Documents\Codex\FoodOrderNext
. .\scripts\dev\local-env.ps1
npm run emulators
```

Chờ dòng **All emulators ready** trước bước tiếp theo. UI: <http://127.0.0.1:4000>, Auth 9099, Firestore 8080, Storage 9199. Lần đầu có thể tải emulator/UI; không chạy seed ngay khi CLI vừa khởi động.

## 2. Nạp dữ liệu demo và bật API — terminal thứ hai

PowerShell 7, chọn mật khẩu demo ít nhất 12 ký tự:

```powershell
cd C:\Users\dangt\Documents\Codex\FoodOrderNext
. .\scripts\dev\local-env.ps1
node scripts/seed/index.mjs --dry-run --shops=3
$env:SEED_DEMO_PASSWORD = Read-Host -MaskInput 'Mật khẩu demo local (12+ ký tự)'
node scripts/seed/index.mjs --apply --shops=3
Remove-Item Env:SEED_DEMO_PASSWORD
npm run api
```

API health: <http://127.0.0.1:5000/health>. Tài khoản dùng cùng mật khẩu bạn vừa chọn:

| Email tổng hợp | Vai trò |
|---|---|
| customer@example.invalid | Khách |
| merchant1@example.invalid | Quán |
| driver@example.invalid | Shipper |
| admin@example.invalid | Admin |

Có thêm customer2, merchant2/3 và locked@example.invalid cho kiểm thử. Seed tạo 8 Auth identities và 40 domain documents cho 3 quán, cộng manifest riêng. Mọi đơn/review đều là fixture, chưa chứng minh lifecycle đặt/giao hàng đã được triển khai.

Chạy lại seed cùng dataset giữ nguyên quyền/counters/profile và không đổi password đã tồn tại. Dữ liệu local mặc định mất khi tắt emulator nếu chưa export; không có password mặc định trong source. Reset có guard riêng, xem [seed README](../scripts/seed/README.md).

## 3. Chạy Metro — terminal thứ ba

```powershell
cd C:\Users\dangt\Documents\Codex\FoodOrderNext\apps\mobile
npm start -- --reset-cache --max-workers 2
```

Chạy bằng terminal phát triển bình thường, không đặt CI=true để Metro có thể theo dõi thay đổi. Nếu giao diện vẫn chạy code cũ, kiểm tra bundle/Metro rồi restart reset-cache; không thay dữ liệu người dùng để xử lý cache.

## 4. Mở máy ảo và cài app — terminal thứ tư

Mở AVD từ Android Studio Device Manager, rồi:

```powershell
cd C:\Users\dangt\Documents\Codex\FoodOrderNext\apps\mobile
npm run android
```

App mặc định dùng **10.0.2.2** để gọi các dịch vụ ở máy Windows. Endpoint API là `http://10.0.2.2:5000/api/v1`. APK debug được kiểm chứng cần Metro; bản x86_64 thử nghiệm không phải APK phát hành cho điện thoại ARM.

Đăng ký mới sẽ vào bước xác minh email. Với Emulator, mở đường dẫn xác minh local do Auth Emulator cung cấp; không có email thật gửi ra ngoài. Quên mật khẩu cũng có local action link. Tài khoản seed đã verified để thử nhanh các role.

## Kiểm thử

Từ root:

```powershell
npm test
# Dừng phiên emulator dùng để demo trước lệnh dưới đây:
npm run test:emulator
npm --prefix apps/mobile test -- --runInBand
npm --prefix apps/mobile run lint:p01
npm --prefix apps/mobile run lint:p02
```

Rules/API tests sử dụng phiên emulator dành riêng cho tests và có thể xóa fixture local của phiên đó. Không chạy cùng một phiên demo đang dùng. Test log có PERMISSION_DENIED từ các case cố ý từ chối là kết quả mong đợi; xem tổng pass/fail cuối log.

Nếu cổng mặc định đang bận, chạy `npm run test:emulator -- --isolated` để dùng các cổng loopback tự chọn. Benchmark P08 cũng chọn cổng riêng. Chạy lần lượt hai lệnh để số đo hiệu năng ít bị ảnh hưởng bởi tải khác. Cách tái tạo dữ liệu và đo nằm trong [checklist P08](phases/P08-hardening-performance.md).

Native E2E cần app, Metro, API và seed đang chạy. Cấp password qua môi trường, không lưu vào source:

```powershell
$env:SEED_DEMO_PASSWORD = Read-Host -MaskInput 'Mật khẩu demo đã seed'
$env:ANDROID_SERIAL = 'emulator-5556' # đổi theo adb devices
python tests/e2e/android-p01-smoke.py
# Chạy tiếp khi app đã ở màn login:
python tests/e2e/android-p01-auth.py
# P02 dùng một bộ seed mới và màn hình đăng nhập.
python tests/e2e/android-p02-smoke.py
# P03 cần seed mới và mở app ở màn hình đăng nhập.
python tests/e2e/android-p03-smoke.py
# P04 cần seed mới và mở app ở màn hình đăng nhập.
python tests/e2e/android-p04-smoke.py
# P05 cần seed mới và mở app ở màn hình đăng nhập.
python tests/e2e/android-p05-smoke.py
# P06 cần Android Emulator có APK mới, seed mới và app ở màn hình đăng nhập.
python tests/e2e/android-p06-smoke.py
Remove-Item Env:SEED_DEMO_PASSWORD
```

P04 bổ sung RNFirebase Storage và bộ chọn ảnh, vì vậy cần build lại APK sau khi cài dependency. Lượt smoke mặc định kiểm tra các phần vận hành. Nếu đã đưa ảnh JPEG/PNG/WebP mẫu vào thư viện của máy ảo, đặt `P04_PICK_PHOTO=1` trước khi chạy để kiểm tra ảnh.

P05 bổ sung RNFirebase Messaging. Build lại Android sau khi cài dependency. Local từ chối `FCM_SEND_ENABLED=true` và vẫn cập nhật hộp thư qua Firestore. Các bước bật FCM staging và thử foreground/background nằm trong [báo cáo P05](PHASE05_REPORT.md).

P06 bổ sung mô-đun Android lấy vị trí foreground. Build lại APK khi cập nhật Kotlin hoặc AndroidManifest. Ca P06 dùng `adb emu geo fix` với tọa độ tổng hợp và chuyển cài đặt vị trí trên máy ảo dành cho test. Có thể dùng địa chỉ bằng chữ khi quán hoặc khách chưa nhập tọa độ.

## Chạy hai tính năng AI

Hai màn hình chạy dự phòng khi API chưa cấu hình mô hình. Để chạy mô hình thật, mở Ollama trên loopback. Có thể chọn cổng 11435 nếu phiên Ollama đang dùng cổng 11434.

```powershell
$env:OLLAMA_HOST = '127.0.0.1:11435'
$env:OLLAMA_NO_CLOUD = '1'
ollama serve
```

Trong terminal khác, dùng đúng cổng để tải model và chạy thử một câu ngắn trước lượt demo. Lượt tải nguội có thể lâu trên máy dùng chung RAM/GPU.

```powershell
$env:OLLAMA_HOST = '127.0.0.1:11435'
ollama pull qwen2.5:1.5b
$warmup = @{ model = 'qwen2.5:1.5b'; stream = $false; think = $false; keep_alive = '5m'
  messages = @(@{ role = 'user'; content = 'Trả lời bằng một từ.' })
  options = @{ num_gpu = 0; num_thread = 4; num_ctx = 4096; num_predict = 12 } } | ConvertTo-Json -Depth 6
Invoke-RestMethod 'http://127.0.0.1:11435/api/chat' -Method Post -ContentType 'application/json' -Body $warmup
```

Trong terminal chạy Express, thêm cấu hình sau vào các biến Firebase Emulator ở trên. Android tiếp tục gọi Express cổng 5000.

```powershell
$env:AI_PROVIDER = 'ollama'
$env:AI_OLLAMA_HOST = '127.0.0.1:11435'
$env:AI_MODEL = 'qwen2.5:1.5b'
$env:AI_CPU_ONLY = 'true'
$env:AI_TIMEOUT_MS = '20000'
node services/api/src/server.js
```

Để thử đủ hai màn hình với dữ liệu tổng hợp, dùng phiên Firebase demo mới có seed. Chạy `python tests/e2e/android-p07-smoke.py --api-only` để tạo đơn giao/COD và gửi yêu cầu Ollama. Sau đó cài bản debug, mở app tại màn đăng nhập, chạy `python tests/e2e/android-p07-smoke.py`. Cả hai lệnh nhận mật khẩu demo từ `SEED_DEMO_PASSWORD`.

Định dạng JSON Schema dùng [Ollama Structured Outputs](https://docs.ollama.com/capabilities/structured-outputs). Cấu hình endpoint và số token tham khảo [Ollama Chat API](https://docs.ollama.com/api/chat).

Script smoke sửa tên/phone của customer demo và thử bốn role. Script auth tạo một account tổng hợp riêng và xử lý OOB codes qua Auth Emulator local. Không dùng chúng với tài khoản/dịch vụ thật.

## Giới hạn và xử lý lỗi đã gặp

- **Cổng 8080 đang bị chiếm:** xác định PID và command line bằng Get-NetTCPConnection/Get-CimInstance. Chỉ dừng đúng emulator local của dự án; không tắt toàn bộ java.exe vì có thể ảnh hưởng Android Studio/Gradle.
- **Storage runtime in NullPointerException khi shutdown:** phiên test có thể vẫn báo exit 0 và toàn bộ case pass; đây là lỗi shutdown của rules runtime local đã quan sát, không phải phép miễn các test thất bại. Kiểm tra không còn cổng bị giữ trước lần chạy mới.
- **PROFILE_INVALID:** seed và API cùng dùng contracts; không dùng profile mẫu thiếu/null sai trường. Dữ liệu cũ không tự được ghi đè khi chạy lại seed.
- Quy trình ảnh món kiểm tra nội dung tệp và quyền ở API; tải tệp qua Storage Emulator. Xem phạm vi đã thử trong [báo cáo P04](PHASE04_REPORT.md).
- Hộp thư hoạt động qua Firestore trên local. Push FCM và trace Firebase Performance trên Console thuộc đợt staging.

## Chuyển sang Firebase thật về sau

Project **`foodordernext-staging`** đã được tạo và đăng ký package Android **`com.foodordernext.app`** ngày 2026-11-25. Firebase CLI có alias `staging` trỏ đến project này. Dùng lại mã React Native, Express, Firestore Rules và indexes hiện có. [Cài đặt app Android staging](https://console.firebase.google.com/project/foodordernext-staging/settings/general/android:com.foodordernext.app) · [Cấu hình theo môi trường](https://firebase.google.com/docs/projects/multiprojects)

Auth Email/Password đã bật. Firestore Standard `(default)` đã tạo tại `asia-southeast1`. Đã xuất bản Rules, tạo 21 chỉ mục tổng hợp và miễn lập chỉ mục `expiresAt` ở 4 collection AI. [Auth](https://console.firebase.google.com/project/foodordernext-staging/authentication/providers) · [Rules](https://console.firebase.google.com/project/foodordernext-staging/firestore/databases/-default-/security/rules) · [Indexes](https://console.firebase.google.com/project/foodordernext-staging/firestore/databases/-default-/indexes)

1. `apps/mobile/android/app/src/release/google-services.json` đã được tải bằng Firebase CLI và kiểm tra khớp app **FoodOrderNext Android Staging**. Trên máy khác, tải tệp qua Console hoặc dùng các lệnh PowerShell bên dưới. [Cấu hình Android](https://firebase.google.com/docs/android/setup) · [Firebase CLI](https://firebase.google.com/docs/cli)
2. Chờ chỉ mục đạt `Enabled` rồi chạy truy vấn thử qua Express. Báo cáo ngày đã được kiểm tra lại sau khi hai chỉ mục đếm và cộng COD đạt `READY`. Dự án đang dùng Spark. Cloud Storage và tác vụ xóa tự động bằng TTL cần bật thanh toán. Khi nhóm quyết định dùng Cloud Storage, tạo bucket trước rồi triển khai Storage Rules với project đích `foodordernext-staging`. [Kết quả truy vấn](../artifacts/evidence/P08/staging-report-fixture.json) · [Firestore](https://firebase.google.com/docs/firestore/quotas) · [Cloud Storage](https://firebase.google.com/docs/storage/faq-and-troubleshooting)
3. Triển khai Express lên Render Free theo hướng dẫn bên dưới. Staging dùng danh tính Admin SDK riêng và cấu hình backend bỏ các biến host emulator. [Cấu hình Admin SDK](https://firebase.google.com/docs/admin/setup)
4. Đặt `FOODORDER_ANDROID_API_BASE_URL` trong phiên build release thành URL HTTPS của Express kết thúc bằng `/api/v1`. Android release lấy project ID từ Firebase native. Debug tiếp tục lấy thiết lập từ `apps/mobile/src/config/runtime.config.js`.
5. Tạo lại tài khoản và dữ liệu demo cho staging, liên kết hồ sơ Firestore với UID Auth của staging. Script seed hiện tại chỉ cho phép ghi vào Emulator. Bản export từ Emulator Suite dùng để sao lưu và khôi phục phiên local. Sau khi cấu hình staging, chạy lại luồng nghiệp vụ và nghiệm thu FCM, Performance. [Export và import dữ liệu Emulator](https://firebase.google.com/docs/emulator-suite/install_and_configure#export_and_import_emulator_data)

Từ thư mục gốc dự án, có thể lấy cấu hình Android qua Firebase CLI bằng PowerShell.

```powershell
npm exec -- firebase login
New-Item -ItemType Directory -Force apps/mobile/android/app/src/release | Out-Null
npm exec -- firebase apps:sdkconfig ANDROID 1:201222548655:android:5b7a1135f131e25d7cf85a --project foodordernext-staging --out apps/mobile/android/app/src/release/google-services.json --non-interactive
```

### Express HTTPS trên Render Free

`foodordernext-api-staging` đang dùng commit `c32dec0` từ nhánh `DangTheNhan`. Smoke qua HTTPS đã xác nhận kết nối tới `foodordernext-staging`. [Render Dashboard](https://dashboard.render.com/web/srv-dc3p73e1egvs73ebaj30) · [Kết quả smoke](../artifacts/evidence/P09/render-staging-smoke.json)

1. Chạy `node scripts/staging/export-render.mjs` ở gốc dự án để tạo thư mục nguồn chỉ gồm Express, contracts và cấu hình deploy. Dùng thư mục này làm nguồn cho repo riêng tư của nhóm. [Kết nối Git với Render](https://render.com/docs/your-first-deploy)
2. Dùng [render.yaml](../render.yaml) tạo Web Service **Free** ở Singapore. Build chạy `npm ci --omit=dev`, start chạy `npm run api`, và Render kiểm tra `/health` qua cổng được cấp. FCM và Ollama tắt ở cấu hình deploy đầu tiên. Render Free ngủ sau 15 phút không có request, nên worker thông báo chỉ chạy khi service đang hoạt động. [Blueprint](https://render.com/docs/blueprint-spec) · [Giới hạn Free](https://render.com/docs/free)
3. Cấp cho service account dành riêng cho staging quyền `roles/datastore.user` để ghi nghiệp vụ và `roles/firebaseauth.viewer` để kiểm tra token đã bị thu hồi. Lưu tệp xác thực tương ứng qua Render Secret Files với tên `foodordernext-staging-service-account.json`. [Quyền Firestore](https://docs.cloud.google.com/firestore/native/docs/security/iam) · [Quyền Auth](https://docs.cloud.google.com/iam/docs/roles-permissions/firebaseauth) · [Render Secret Files](https://render.com/docs/configure-environment-variables#secret-files)
4. Khi có URL, kiểm tra Firebase cùng API. Lệnh kiểm tra `/health`, chặn yêu cầu thiếu token, xác thực token Firebase và đọc hồ sơ qua Express. Lượt thử tạo và dọn một tài khoản Auth ngẫu nhiên. Chạy lệnh thiếu `--api-base-url` nếu chỉ muốn kiểm tra Firebase.

```powershell
$env:FOODORDER_ANDROID_API_BASE_URL = 'https://foodordernext-api-staging.onrender.com/api/v1'
node scripts/staging/firebase-smoke.mjs --api-base-url $env:FOODORDER_ANDROID_API_BASE_URL
```

### Trace và ký APK staging

- Android dùng Firebase Performance SDK và Gradle plugin. Bản debug vô hiệu hóa thu thập. Bản staging bật khi app đo thao tác đầu tiên. Trace có tên cố định `catalog_menu_page`, `order_quote`, `daily_report_first` và `daily_report_next`. Chạy từng thao tác trên staging rồi tìm các trace tương ứng trong Firebase Console. [Firebase Performance cho Android](https://firebase.google.com/docs/perf-mon/get-started-android)
- Để chẩn đoán trên máy ảo staging, đặt `FOODORDER_ANDROID_PERF_LOGCAT=true` trong phiên build release thử. Biến này bật log chẩn đoán SDK trong manifest. Sau khi chạy thao tác, dùng `adb logcat -s FirebasePerformance` và đối chiếu tên trace với Firebase Console. [Chẩn đoán Firebase Performance](https://firebase.google.com/docs/perf-mon/troubleshooting?platform=android)
- Cấp keystore staging và tên khóa qua `FOODORDER_ANDROID_KEYSTORE` và `FOODORDER_ANDROID_KEY_ALIAS`. Cấp mật khẩu qua `FOODORDER_ANDROID_STORE_PASSWORD` và `FOODORDER_ANDROID_KEY_PASSWORD` trong phiên build riêng. Giữ keystore và mật khẩu trong nơi nhóm quản lý khóa. [Ký APK Android](https://developer.android.com/studio/publish/app-signing)
- Sau khi cấu hình Firebase và HTTPS, chạy `./gradlew :app:assembleRelease` từ `apps/mobile/android`. Xác minh chữ ký bằng `apksigner verify`, ghi SHA-256 và kiểm tra cài mới theo [hồ sơ bàn giao](PHASE09_REPORT.md#kiểm-tra-apk-ứng-viên).
