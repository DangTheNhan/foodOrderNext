# Tiến độ và điểm tiếp tục

Cập nhật **2026-11-27** · Plan **v1.8**.

## Hiện tại

- Thư mục active: `C:\Users\dangt\Documents\Codex\FoodOrderNext`.
- Đã triển khai P01 local: Firebase Auth, Express API, Firestore/Storage Rules, contracts, seed, role navigation và profile.
- Đã triển khai luồng khách P02 local gồm quán, thực đơn, giỏ, yêu thích, địa chỉ và chuẩn bị thanh toán COD.
- P00 đã đối chiếu spike AI với P07. Nghiệm thu FCM, Performance và realtime đa thiết bị phụ thuộc staging.
- Bản Android local đã cài sạch và qua thử ảnh, phân trang, quyền GPS mô phỏng và COD. Project staging `foodordernext-staging` đã được tạo và app Android `com.foodordernext.app` đã đăng ký. [Cài đặt app trong Firebase Console](https://console.firebase.google.com/project/foodordernext-staging/settings/general/android:com.foodordernext.app)
- Staging đã bật Auth Email/Password và tạo Firestore Standard ở Singapore (`asia-southeast1`). Rules Playground từ chối mô phỏng đọc đơn hàng chưa đăng nhập. Firestore có 21 chỉ mục tổng hợp và 4 miễn lập chỉ mục `expiresAt`. Hai chỉ mục bổ sung cho báo cáo ngày đã `READY`. [Cấu hình ban đầu](../artifacts/evidence/P01/firebase-staging.json) · [Chỉ mục báo cáo](../artifacts/evidence/P08/staging-report-indexes.json)
- Đã tải `google-services.json` bằng Firebase CLI vào thư mục Android release và đối chiếu project ID, app ID và package. Cấu hình debug vẫn trỏ tới `demo-foodordernext`. [Hướng dẫn setup staging](SETUP_LOCAL.md#chuyển-sang-firebase-thật-về-sau)
- Kiểm tra trực tiếp trên Firebase staging đạt đăng ký, đăng nhập, truy vấn ghép `categories` và `shops`, cùng hai ca chặn đọc đơn. Hai truy vấn trả về 0 vì chưa có dữ liệu demo khớp. Tài khoản thử đã được dọn. [Kết quả Firebase](../artifacts/evidence/P01/firebase-staging-smoke.json)
- Express đã triển khai trên Render Free tại Singapore từ nhánh `DangTheNhan`, commit `c32dec0`. Smoke staging đạt `/health`, chặn yêu cầu thiếu token và xác minh token Firebase qua Express trước khi đọc hồ sơ Firestore. Tài khoản thử đã được dọn. [API HTTPS](https://foodordernext-api-staging.onrender.com/health) · [Kết quả smoke](../artifacts/evidence/P09/render-staging-smoke.json)
- APK staging x86_64 đã được cài sạch trên Android Emulator API 37. Đăng nhập, tạo hồ sơ qua Express HTTPS, đọc Firestore, khôi phục phiên và đăng xuất đều đạt. Lượt kiểm thử dùng tài khoản tổng hợp được cấp trạng thái xác minh qua Firebase CLI. Tài khoản và hồ sơ thử đã được dọn. [APK dùng thử](../artifacts/releases/FoodOrderNext-v1.8-staging-x86_64-test.apk) · [Kết quả Android staging](../artifacts/evidence/P09/android-staging-smoke.json)
- Firebase staging đã có bộ dữ liệu `p09-staging-demo-v1` với một quán, hai danh mục, ba món và ba vai trò thử. Lượt chạy qua Express HTTPS xác nhận tạo đơn một lần khi gửi lại, phân công tài xế, đọc tọa độ tổng hợp, từ chối COD sai, thu đúng 35.000 đồng, đối soát tồn và đăng đánh giá. [Quy trình seed](../scripts/seed/README.md#bộ-dữ-liệu-staging-p09) · [Kết quả API](../artifacts/evidence/P09/staging-cod-journey.json)
- APK staging đã chạy qua khách, quán và tài xế lần lượt trên cùng một Android Emulator. Đơn `AW1BpN9HzblyZu3BAaqG` được tạo trên app và đã đối chiếu trong Firestore với trạng thái `COMPLETED`, `COD_CONFIRMED`, số tiền 35.000 đồng và đánh giá đã xác minh. [Bằng chứng Android](../artifacts/evidence/P09/android-staging-cod-journey.json)
- Ba phiên SDK chạy đồng thời trên staging đã nhận đơn, phân công, chat và kết quả COD. Lượt thử xác nhận tin nhắn gửi lặp không nhân đôi và quán nhận được tin sau khi kết nối lại. Bộ hồi quy Firebase Emulator đạt 56/56 ca. [Biên bản realtime](../artifacts/evidence/P05/staging-realtime.json)
- Đã xử lý lỗi HTTP 500 của báo cáo ngày bằng hai chỉ mục Firestore. Khi thử với 21 bản ghi tổng hợp, API trả 20 dòng rồi 1 dòng và tổng COD 1.365.000 đồng. [Bằng chứng kiểm tra báo cáo](../artifacts/evidence/P08/staging-report-fixture.json)
- APK chẩn đoán đã tải thành công cả hai trang báo cáo. Firebase Performance Console có đủ bốn trace Android cho thực đơn, báo giá, trang đầu và trang sau của báo cáo. [Biên bản Performance](../artifacts/evidence/P08/staging-performance.json)
- FCM HTTP v1 đang bật trên Firebase. Kiểm tra stage cho thấy worker bỏ qua lần gửi vì `FCM_SEND_ENABLED` và tài khoản Render còn cần quyền gửi FCM. [Điều kiện chạy push](../artifacts/evidence/P05/staging-push-preflight.json)
- APK staging trên Android Emulator API 37 đã qua kiểm tra quyền thông báo và vòng đời đăng ký. Từ chối quyền không sinh đăng ký, cấp quyền tạo đăng ký Android, tắt thông báo và đăng xuất gỡ đăng ký. Tài khoản demo đã về tùy chọn tắt. [Kiểm thử đăng ký thiết bị](../artifacts/evidence/P05/staging-push-device.json)
- Ngày **2026-11-27**, máy thành viên thứ hai (Windows, Node 22.20.0, JDK 21.0.7, Android SDK) đã dựng lại từ gói bàn giao (`npm ci`, `apps/mobile npm ci`, `npm run doctor` OK, `seed --dry-run` đạt và chặn seed cloud khi thiếu biến emulator), chạy đạt **50/50 unit**, **46/46 mobile Jest**, **ESLint P01/P02 exit 0**, **56/56 Firebase Emulator & Rules**, và tái lập benchmark **10.003 đơn** (`dailyReportNextRowsOnly` p95 **119,15 ms** vs `dailyReportNext` **131,69 ms**; realtime snapshot p95 **20,05 ms**). Đã tải `google-services.json` bản release qua Firebase CLI, chạy smoke `foodordernext-staging` + Render HTTPS đạt **11/11 ca**, đo số lượt đọc Firestore thực tế bằng `explainOptions.analyze=true` trên staging (báo cáo trang 1: 23 readOps; trang 2 `includeTotals=false`: 1 readOp vs 3 readOps), build và ký xác minh **APK ứng viên release (`arm64-v8a` + `x86_64`)** từ commit `cd3bf4d`, và chạy đạt **10/10 ca đồng thời trên 2 máy ảo `Pixel_9` + `Pixel_9_2`** (đơn COD 35.000đ, hàng đợi live, chat 2 chiều live, phân công, đổi tài khoản sau `pm clear`, quyền vị trí + GPS mô phỏng gắn nhãn, thu COD live, đánh giá và từ chối quyền thông báo; dọn sạch 3 tài khoản và 37 docs tạm). Kiểm tra IAM xác nhận `render-express-staging` vẫn chưa có quyền gửi FCM và 30 job outbox gần nhất vẫn là `SKIPPED:FCM_DISABLED`. [Biên bản máy thứ hai](../artifacts/evidence/P08/second-machine/summary.json) · [Lượt đọc staging](../artifacts/evidence/P08/staging-read-counts.json) · [Phiếu APK ứng viên](../artifacts/evidence/P09/android-staging-candidate-receipt.json) · [Biên bản 2 máy ảo](../artifacts/evidence/P09/second-machine/two-device/two-device-staging-result.json) · [Kiểm tra IAM/FCM](../artifacts/evidence/P08/second-machine/staging-iam-fcm-check.json)
- Ngày **2026-11-27 (chiều)**, theo quyết định **`D52`** (chạy 3 máy ảo Android, không dùng máy vật lý): đã cấp thành công **`roles/firebasecloudmessaging.admin`** (HTTP 200) cho `render-express-staging@foodordernext-staging.iam.gserviceaccount.com`, tạo & khởi động máy ảo thứ 3 (`Pixel_9_3`), và chạy đạt **9/9 ca đồng thời trên 3 máy ảo (`Pixel_9` khách, `Pixel_9_2` quán, `Pixel_9_3` tài xế)** trên `foodordernext-staging` + Render HTTPS: đăng nhập đồng thời, bật thông báo/đăng ký token FCM, đặt COD `35.000 đ`, đồng bộ đơn/phân công live (`2,20–2,28s`), **chat 3 bên đồng thời**, GPS mô phỏng gắn nhãn `EMULATED_GPS_ADB_GEO_FIX`, **ngắt mạng & kết nối lại (`2,55s`)** khi thu COD, đánh giá 5 sao và quay xong **video toàn luồng 3 máy ảo** (`FoodOrderNext-3Device-Staging-Demo.mp4`, `3,34 MB`). Toàn bộ 3 tài khoản và 43 docs thử tạm đã được dọn sạch. Probe `notificationOutbox` xác nhận Render vẫn đang đặt `FCM_SEND_ENABLED=false` (`SKIPPED:FCM_DISABLED`). [Biên bản 3 máy ảo](../artifacts/evidence/P09/three-device/three-device-staging-result.json)
- Ngày **2026-11-27 (tối)**, sau khi bật `FCM_SEND_ENABLED=true` trên Render (`foodordernext-api-staging`): đã nghiệm thu đạt **3/3 ca FCM thật** trên `Pixel_9` (API 37 + Google Play Services): (1) **foreground** hiện Alert và bấm `MỞ` vào đúng `Chi tiết đơn`, (2) **background** về thanh thông báo Android với nội dung bảo mật chung (không lộ tin nhắn/PII) và bấm mở thẳng vào `OrderChat`, (3) **cold start** sau khi vuốt đóng app từ Recents (`pidof = NONE`) nhận push và chạm mở lạnh thẳng vào `Chi tiết đơn` (`Đang chuẩn bị`). Cả 3 job `notificationOutbox` đều đạt `status: SENT`, `deliveredCount: 1`; toàn bộ 4 outbox job, 3 tài khoản và 19 docs tạm đã được dọn sạch. [Biên bản FCM thật](../artifacts/evidence/P05/live-fcm/staging-fcm-live.json)
- Backlog **82/84 task DONE** (**9/10 phase DONE**: P00–P08). Chỉ còn 2 đầu việc nhân sự ở P09 (diễn tập trình bày 3 thành viên và ký xác nhận chéo cuối). Xem [hồ sơ bàn giao P09](PHASE09_REPORT.md) để lấy APK, slide và video.

## Bằng chứng kiểm tra

- API 33 + contracts 5 PASS: `artifacts/evidence/P01/unit-tests.log`.
- Seed/migration 7 PASS: `artifacts/evidence/P01/seed-migration-tests.log`.
- Mobile 39 PASS, 5 suites: `artifacts/evidence/P01/mobile-unit-tests.log`.
- Emulator 26 PASS gồm Auth/Firestore thật và 20 Rules cases: `artifacts/evidence/P01/emulator-tests.log`.
- Android debug BUILD SUCCESSFUL: `artifacts/evidence/P01/android-build.log`.
- Native smoke 7 PASS (4 role, profile, logout/restart): `artifacts/evidence/P01/android-smoke.json`.
- Native signup/verify/change/reset password: **PASS**, 5 case; xem `artifacts/evidence/P01/android-auth.json`.
- Seed 8 fake identities/40 domain docs và manifest; các đơn/review là fixture, không phải lifecycle đã chạy.
- Lint P01 exit 0. Backlog/checklist/link/evidence đã đối chiếu: `artifacts/evidence/P01/handoff-validation.json`.

## Trạng thái phase

| Phase | Trạng thái | Ghi chú |
|---|---|---|
| P00 | DONE | Đủ import, build APK ứng viên (D52), Auth, realtime 3 máy ảo, AI, 4 trace Performance Console và 3/3 ca FCM thật. |
| P01 | DONE | Đã xác nhận Android, Express, Firebase staging và dựng lại + review chéo trên máy thành viên thứ hai. |
| P02 | DONE | Catalog, giỏ, địa chỉ, yêu thích, review chéo và kiểm thử staging trên máy ảo theo D52 đã hoàn tất. |
| P03 | DONE | Luồng COD, chống đặt trùng, tồn và đánh giá đã chạy staging; đã review chéo và chạy lại toàn bộ ca transaction trên máy thứ hai. |
| P04 | DONE | Quán xử lý trạng thái, giao việc và báo cáo ngày 21 đơn đạt staging; đã review chéo quyền admin/quán và chạy lại trên máy thứ hai. |
| P05 | DONE | Đạt 3 máy ảo đồng thời, chat 3 bên, ngắt/nối mạng (`2,55s`), 3/3 ca FCM thật (foreground/background/cold start, không lộ PII) và outbox worker. |
| P06 | DONE | Đã kiểm thử trọn ca quyền vị trí, GPS mô phỏng gắn nhãn `EMULATED_GPS` giữa `Pixel_9_3` và `Pixel_9`, ngắt/nối mạng và thu COD trên staging theo D52. |
| P07 | DONE | Hai luồng AI hỗ trợ khách và quán. Xem báo cáo P07 |
| P08 | DONE | Đủ benchmark 10.003 đơn, lượt đọc Firestore staging, 4 trace Performance Console, hồi quy 2 máy, 3 máy ảo và FCM thật; không còn lỗi chặn. |
| P09 | IN_PROGRESS | 6/8 task DONE (`T01`–`T06`): APK ứng viên, cài sạch 3 máy ảo, tài liệu/README, demo 3 máy ảo + video toàn luồng 3,34 MB, case chiều sâu và 12 slide. Chỉ còn `T07` (diễn tập 3 thành viên & nhật ký đóng góp) và `T08` (ký xác nhận chéo cuối). |

## Tiếp tục từ đâu

1. **Diễn tập bảo vệ 3 thành viên (`P09-T07`).** Cả 3 thành viên diễn tập theo [kịch bản 10 phút](PHASE09_REPORT.md#kịch-bản-trình-bày) (dùng 3 máy ảo `Pixel_9`/`Pixel_9_2`/`Pixel_9_3` hoặc video dự phòng `FoodOrderNext-3Device-Staging-Demo.mp4` + 2 video AI P07) và điền nhật ký đóng góp cá nhân.
2. **Chốt ký xác nhận chéo & dọn gói bàn giao cũ (`P09-T08`).** Di chuyển thư mục bản sao `FoodOrderNext-BanGiao-2026-11-27-v2/` ra khỏi repo trước khi commit/push, kiểm tra lại link/file/slide cuối và ký xác nhận chéo để đóng P09.

Xem [thứ tự triển khai trong kế hoạch chính](MASTER_PLAN.md#10-thứ-tự-triển-khai-từ-hiện-tại) và [checklist P08](phases/P08-hardening-performance.md).

Tài khoản demo staging đang dùng thông tin truy cập mã hóa bằng tài khoản Windows đã chạy seed. Nhóm cần chuẩn bị cách lưu và chia sẻ quyền truy cập trước buổi nghiệm thu cùng nhau.

`BACKLOG.csv` là trạng thái task; MASTER_PLAN là scope; báo cáo P01 mô tả phần chạy được và giới hạn. DONE yêu cầu evidence, không dựa vào số file hoặc màn UI tạo ra.

## Kết quả P02

- Android Emulator đạt 7 nhóm ca. Tổng trạng thái lượt chạy là PASS. Xem [báo cáo P02](PHASE02_REPORT.md).
- Emulator suite 31 ca, unit backend và thư viện 45 ca, mobile 39 ca.
- Ca Android bổ sung đạt khi ảnh bị thiếu, nhóm tùy chọn là bắt buộc và giá giỏ đổi theo lựa chọn.
- P03 đã dùng giỏ và địa chỉ P02 cho báo giá và tạo đơn.

## Kết quả P03

- Firebase Emulator đạt 37 kiểm tra, backend unit đạt 45, mobile unit đạt 39. Android đạt 5 nhóm ca.
- Đơn COD, hủy, phân công, thu đúng tiền và đánh giá đã chạy với dữ liệu demo. Xem [báo cáo P03](PHASE03_REPORT.md).
- P04 đã nối hàng đợi và phân công vào API P03.

## Kết quả P04

- Firebase Emulator 43 kiểm tra đạt, backend unit 45, mobile unit 39. Android debug build thành công và 7 nhóm ca đạt.
- Đã kiểm tra quyền quán, chỉnh tồn, ảnh, giao việc, admin cuối và đối soát biên ngày COD. Xem [báo cáo P04](PHASE04_REPORT.md).
- P05 đã dùng hàng đợi, quyền phân công và trạng thái đơn của P04.

## Kết quả P05

- Firebase Emulator 51 ca đạt, unit API/contracts/seed 46, mobile unit 39. Android debug build và 5 nhóm ca trên emulator đạt.
- Đã kiểm chat hai chiều, hộp thư và live order theo vai trò. Worker đã qua kiểm tra retry, token hết hiệu lực và restart với transport test. Xem [báo cáo P05](PHASE05_REPORT.md).
- Realtime ba vai trò đã đạt với ba phiên SDK trên Firebase staging. P05-T05 và P05-T08 còn nghiệm thu push và UI đa thiết bị. [Biên bản staging](../artifacts/evidence/P05/staging-realtime.json)

## Kết quả P06

- Firebase Emulator 52 ca đạt, unit API/contracts/seed 46, mobile unit 40. Android build thành công và 6 nhóm ca với GPS mô phỏng đạt.
- Đã qua luồng nhận chuyến, lấy món, cập nhật vị trí, ảnh điểm cũ, giao và thu COD. Xem [báo cáo P06](PHASE06_REPORT.md).
- P06-T08 chờ thử GPS thật và mất mạng trên thiết bị.

## Kết quả P07

- Firebase Emulator 56 ca đạt, unit API/contracts/seed 50, mobile unit 42.
- Model Ollama đã xử lý hai yêu cầu thực. Có 4 nhóm ca Android đạt.
- Xem kết quả và giới hạn tại [báo cáo P07](PHASE07_REPORT.md).

## Kết quả P08 local

- Lượt chạy ngày **2026-11-21** đạt **56 ca Firebase Emulator**, **50 ca API/contracts/seed** và **42 ca React Native**. Các ca chạy lại gồm quyền ở API và Rules, cạnh tranh tồn/voucher, đặt trùng, thu COD, chat/outbox, kết nối lại và AI fallback. [Emulator](../artifacts/evidence/P08/local-regression/emulator-pass.log) · [Unit](../artifacts/evidence/P08/local-regression/unit.log) · [Mobile](../artifacts/evidence/P08/local-regression/mobile.log)
- Đã dựng lại Android JS bundle debug. Lượt quét chọn lọc không phát hiện mẫu private key/token trong phạm vi quét hoặc tên cấu hình dành riêng cho backend trong bundle. [Metro](../artifacts/evidence/P08/local-regression/metro-bundle.log) · [Kết quả quét](../artifacts/evidence/P08/local-regression/bundle-audit.log)
- Lượt unit ban đầu bị chặn loopback. Lượt chạy lại có quyền loopback trả exit 0. Storage rules runtime ghi lỗi khi shutdown sau khi toàn bộ test Emulator đã báo đạt.
- P08-T01/T02 hoàn thành bằng kịch bản benchmark local tái lập. Tối ưu trang tiếp báo cáo ngày giảm p95 từ **153,78 ms** xuống **125,58 ms** trong cùng lượt đo, giảm hai truy vấn tổng hợp mỗi trang. Hồi quy sau thay đổi đạt 56 ca Emulator, 50 ca API/contracts/seed và 43 ca React Native. [Báo cáo P08](PHASE08_REPORT.md)

Ngày **2026-11-25**, bản kiểm thử Android đã tải ba trang thực đơn, hiển thị ảnh, nhận tọa độ mô phỏng, thấy vị trí cũ và xác nhận COD. Ảnh revalidate trả 304 với 0 byte thân phản hồi. Suite cuối đạt **56** ca Firebase Emulator, **50** ca API/contracts/seed và **46** ca React Native. [Bằng chứng Android và hồi quy](PHASE08_REPORT.md#android-local-ngày-2026-11-25)
