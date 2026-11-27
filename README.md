# FoodOrderNext

Ứng dụng đặt và giao đồ ăn trong khuôn viên trường, xây dựng bằng **React Native (Android)**, **Express** và **Firebase** (Auth, Cloud Firestore, Storage, FCM, Performance Monitoring).

**Cập nhật 2026-11-27.** Dự án hỗ trợ đầy đủ 4 vai trò (khách, quán, shipper, admin tối thiểu) trong một ứng dụng: đặt đơn COD tính giá phía server, giữ/hoàn tồn & voucher nguyên tử, hàng đợi realtime, chat 2 chiều, hộp thư thông báo, theo dõi vị trí foreground và 2 tính năng AI (trợ lý chọn món & phân tích đánh giá bằng Ollama hoặc fallback có nhãn).

Xem chi tiết kỹ thuật thêm tại [SETUP_LOCAL](docs/SETUP_LOCAL.md), [tiến độ](docs/PROGRESS.md), [báo cáo kiểm thử P08](docs/PHASE08_REPORT.md) và [hồ sơ bàn giao P09](docs/PHASE09_REPORT.md).

---

## Hướng dẫn cài đặt và chạy dự án

### 1. Yêu cầu môi trường

- **Node.js** `>= 22.11` (đã kiểm chứng trên Node 22.20.0 và Node 24.18.0) & **npm**.
- **JDK 21** (đã thiết lập `JAVA_HOME`).
- **Android Studio / Android SDK** (đã thiết lập `ANDROID_HOME`), gồm:
  - Android SDK Platform `36`, Build-Tools `36.0.0`, NDK `27.1.12297006`, CMake `3.22.1`.
  - Ít nhất 1 máy ảo Android Emulator `x86_64` có Google Play Services (hoặc điện thoại Android thật).
- **Ollama** (tùy chọn — chỉ cần nếu muốn chạy 2 tính năng AI bằng mô hình local thật thay vì chế độ fallback).

### 2. Cài đặt dependency và kiểm tra môi trường

Chạy tại thư mục gốc của repository:

```powershell
npm ci
npm --prefix apps/mobile ci --workspaces=false
npm run doctor
```

> Root workspace quản lý `services/api` và `packages/contracts`; `apps/mobile` dùng `node_modules` và `package-lock.json` riêng. Khi `npm run doctor` báo `OK` cả 5 dòng là máy đã sẵn sàng.

---

### 3. Chạy ứng dụng ở chế độ Local (Firebase Emulator)

Mở **4 cửa sổ PowerShell** tại thư mục gốc dự án (chế độ local chạy hoàn toàn trên project giả lập `demo-foodordernext`, không ảnh hưởng Firebase thật):

#### Terminal 1 — Khởi động Firebase Emulator Suite

```powershell
. .\scripts\dev\local-env.ps1
npm run emulators
```

Chờ đến khi hiện **`All emulators ready`** (Emulator UI: <http://127.0.0.1:4000>, Auth `9099`, Firestore `8080`, Storage `9199`).

#### Terminal 2 — Nạp dữ liệu demo và chạy Express API

```powershell
. .\scripts\dev\local-env.ps1
node scripts/seed/index.mjs --dry-run --shops=3
$env:SEED_DEMO_PASSWORD = Read-Host -MaskInput 'Nhap mat khau demo local (>= 12 ky tu)'
node scripts/seed/index.mjs --apply --shops=3
Remove-Item Env:SEED_DEMO_PASSWORD
npm run api
```

Kiểm tra API sẵn sàng tại <http://127.0.0.1:5000/health>. Các tài khoản demo (dùng chung mật khẩu bạn vừa nhập):

| Email tổng hợp | Vai trò |
|---|---|
| `customer@example.invalid` | Khách hàng (`customer2@example.invalid` cho ca 2 khách) |
| `merchant1@example.invalid` | Chủ quán (`merchant2`, `merchant3` cho quán khác) |
| `driver@example.invalid` | Shipper đã duyệt |
| `admin@example.invalid` | Admin |

#### Terminal 3 — Khởi động Metro Bundler

```powershell
cd apps\mobile
npm start -- --reset-cache --max-workers 2
```

#### Terminal 4 — Mở máy ảo và cài app Android Debug

Khởi động AVD trong Android Studio Device Manager, rồi chạy:

```powershell
cd apps\mobile
npm run android
```

*(App debug trên Android Emulator tự kết nối tới Express qua `http://10.0.2.2:5000/api/v1` và Firebase Emulator qua `10.0.2.2`.)*

---

### 4. Bật 2 tính năng AI thật bằng Ollama local (tùy chọn)

Mặc định nếu chưa cấu hình biến `AI_PROVIDER`, hai màn hình AI sẽ chạy ở chế độ dự phòng (fallback có gắn nhãn). Để chạy với mô hình thật `qwen2.5:1.5b` trên loopback:

```powershell
# Terminal Ollama
$env:OLLAMA_HOST = '127.0.0.1:11435'
$env:OLLAMA_NO_CLOUD = '1'
ollama serve
```

Tải mô hình ở terminal khác:

```powershell
$env:OLLAMA_HOST = '127.0.0.1:11435'
ollama pull qwen2.5:1.5b
```

Sau đó khởi động Express ở **Terminal 2** với các biến cấu hình AI (cùng phiên đã nạp `local-env.ps1`):

```powershell
$env:AI_PROVIDER = 'ollama'
$env:AI_OLLAMA_HOST = '127.0.0.1:11435'
$env:AI_MODEL = 'qwen2.5:1.5b'
$env:AI_CPU_ONLY = 'true'
$env:AI_TIMEOUT_MS = '20000'
npm run api
```

---

### 5. Chạy kiểm thử tự động và benchmark

Chạy tại thư mục gốc dự án:

```powershell
# 1. Unit test API, contracts, seed & migration (50 ca)
npm test

# 2. Unit test & ESLint phía React Native (46 ca)
npm --prefix apps/mobile test -- --runInBand
npm --prefix apps/mobile run lint:p01
npm --prefix apps/mobile run lint:p02

# 3. Bộ kiểm thử Firebase Emulator + Security Rules (56 ca, cổng độc lập)
npm run test:emulator -- --isolated

# 4. Benchmark local tái lập với 10.003 đơn / 11.310 tài liệu
npm run benchmark:local
```

Kết quả benchmark được xuất ra `work/p08-benchmark.json`.

---

### 6. Chạy bản Staging (`foodordernext-staging`) & Build/Cài APK Release

Project staging dùng Firebase **`foodordernext-staging`** (`asia-southeast1`) và Express HTTPS tại <https://foodordernext-api-staging.onrender.com/health>.

#### Cài nhanh APK ứng viên lên Android Emulator / điện thoại thật

```powershell
adb install -r artifacts\releases\FoodOrderNext-v1.8-staging-arm64-x86_64-candidate.apk
```

*(Tệp APK và slide nằm trong `artifacts/releases/` — được `.gitignore` bỏ qua khỏi Git và bàn giao riêng theo gói release.)*

#### Kết nối Firebase staging & kiểm tra smoke

Cần tài khoản Google có quyền trên project `foodordernext-staging`:

```powershell
npx -y firebase-tools@latest login
New-Item -ItemType Directory -Force apps\mobile\android\app\src\release | Out-Null
npx -y firebase-tools@latest apps:sdkconfig ANDROID 1:201222548655:android:5b7a1135f131e25d7cf85a --project foodordernext-staging --out apps/mobile/android/app/src/release/google-services.json --non-interactive

node scripts/staging/firebase-smoke.mjs --api-base-url https://foodordernext-api-staging.onrender.com/api/v1
```

#### Build lại APK Release staging (`arm64-v8a` + `x86_64`)

Đảm bảo đã có `apps/mobile/android/app/src/release/google-services.json` và keystore ký của nhóm (lưu ngoài Git, ví dụ `work/signing/`):

```powershell
$env:FOODORDER_ANDROID_API_BASE_URL = 'https://foodordernext-api-staging.onrender.com/api/v1'
$env:FOODORDER_ANDROID_KEYSTORE = 'C:\duong-dan\toi\foodordernext-group-release.keystore'
$env:FOODORDER_ANDROID_KEY_ALIAS = 'foodordernext-release'
$env:FOODORDER_ANDROID_STORE_PASSWORD = Read-Host -MaskInput 'Store password'
$env:FOODORDER_ANDROID_KEY_PASSWORD = Read-Host -MaskInput 'Key password'

Push-Location apps\mobile\android
.\gradlew.bat ":app:assembleRelease" "-PreactNativeArchitectures=arm64-v8a,x86_64" "--no-daemon"
Pop-Location
```

APK đầu ra nằm tại `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`. Không commit `google-services.json` bản release, file `.keystore`/`.jks`, service account JSON hoặc mật khẩu vào Git.

---

## Bắt đầu đọc tài liệu dự án

1. Đọc [kế hoạch chính](docs/MASTER_PLAN.md).
2. Xem [tiến độ và bước tiếp theo](docs/PROGRESS.md).
3. Xem hướng dẫn cấu hình chi tiết & xử lý lỗi tại [SETUP_LOCAL](docs/SETUP_LOCAL.md).
4. Theo dõi từng đầu việc trong [backlog](docs/BACKLOG.csv).

Kế hoạch chính là nguồn thống nhất về phạm vi và thứ tự triển khai. Thay đổi phạm vi phải cập nhật kế hoạch và nhật ký quyết định trước khi kéo theo thay đổi các phase.

## Tài liệu triển khai

| Tài liệu | Mục đích |
|---|---|
| [MASTER_PLAN](docs/MASTER_PLAN.md) | Mục tiêu, phạm vi, lộ trình, mốc nghiệm thu |
| [REQUIREMENTS](docs/REQUIREMENTS.md) | Đối chiếu PDF, yêu cầu người dùng và bằng chứng cần có |
| [ARCHITECTURE](docs/ARCHITECTURE.md) | Kiến trúc, trách nhiệm client/server/Firebase |
| [DATA_MODEL](docs/DATA_MODEL.md) | Collection, trường dữ liệu, truy vấn và index |
| [API_CONTRACT](docs/API_CONTRACT.md) | Hợp đồng API, lỗi, phân quyền và idempotency |
| [SCREEN_MAP](docs/SCREEN_MAP.md) | Danh sách màn hình và kế hoạch tái sử dụng UI |
| [MIGRATION](docs/MIGRATION.md) | Chuyển từ dự án SQL Server cũ sang Firebase |
| [TEST_PLAN](docs/TEST_PLAN.md) | Kiểm thử chức năng, quyền, realtime, AI, hiệu năng |
| [TEAM_AND_DELIVERY](docs/TEAM_AND_DELIVERY.md) | Phân công ba người, lịch tham khảo, Git và demo |
| [RISKS](docs/RISKS.md) | Rủi ro và phương án giảm phạm vi |
| [DECISIONS](docs/DECISIONS.md) | Quyết định đã thống nhất và điểm chưa xác định |
| [PROGRESS](docs/PROGRESS.md) | Trạng thái hiện tại và hướng dẫn tiếp tục |
| [SOURCES](docs/SOURCES.md) | Tài liệu gốc, snapshot mã cũ và tài liệu kỹ thuật |

## Cấu trúc dành cho mã nguồn

```text
apps/mobile/            React Native Android trước; iOS sau nếu có điều kiện
services/api/           Express API và worker thông báo trong cùng package
packages/contracts/    Kiểu dữ liệu và validation dùng chung
firebase/              Firestore/Storage Rules và indexes đã có ở P01
scripts/seed/          Seed dữ liệu giả lập tái tạo được
scripts/migration/     Công cụ chuyển dữ liệu sau khi đã kiểm tra schema
tests/                 Rules, integration, E2E, performance
data/fixtures/         Dữ liệu tổng hợp, không chứa thông tin người thật
artifacts/evidence/    Bằng chứng kiểm thử và số đo theo phase
artifacts/releases/    Bản build, slide, video khi đến P09
docs/phases/           Checklist và cổng nghiệm thu cho 10 phase
```

Root workspace gồm API/contracts; mobile có node_modules và lockfile riêng. Dùng `npm ci` tại root và `npm --prefix apps/mobile ci --workspaces=false`. Cấu hình debug mặc định chỉ dành cho Firebase Emulator local.

## Nguồn dự án cũ

- Repository: <https://github.com/DangTheNhan/foodOrder_Mobile>
- Snapshot đã đọc: `1bc4eabed01d1b975a60cf8e66396888a4538b07`.
- Baseline cũ: React Native + Express + **Microsoft SQL Server**.
- Đã nhập 142 tracked mobile files có lọc; runtime mới dùng Firebase. Dự án cũ được giữ nguyên để đối chiếu.
