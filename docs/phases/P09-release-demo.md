# P09 — Bản Android, tài liệu và bảo vệ

**Trạng thái:** IN_PROGRESS  
**Chủ trì:** ALL; C điều phối bản build  
**Phụ thuộc:** [P08](P08-hardening-performance.md) vượt cổng hoàn thành.  
**Nguồn thống nhất:** [MASTER_PLAN](../MASTER_PLAN.md).

## Mục tiêu

Đóng gói bản Android có thể cài mới, bộ hướng dẫn và demo đáp ứng toàn bộ tiêu chí PDF. Kế hoạch này không cho phép coi ứng dụng đã release/deploy; các thao tác đó chỉ được thực hiện khi đến pha triển khai tương ứng và đúng phạm vi được giao.

## Công việc

- [x] **P09-T01** — **[C]** Chuẩn bị build Android APK ứng viên từ commit/tag được ghi rõ, cấu hình môi trường backend/Firebase và quy trình bảo quản signing key. Ghi checksum/version và cách cài; không đưa credential backend/AI vào bundle hoặc tài liệu. [Phiếu bản ứng viên](../../artifacts/evidence/P09/android-staging-candidate-receipt.json)
- [x] **P09-T02** — **[ALL]** Thành viên không build cài mới trên thiết bị sạch, chạy login/permission/catalog/checkout và kiểm tra API đúng môi trường. Test lại sau khi clear data, đổi tài khoản, từ chối notification/location; ghi thiết bị/Android version và lỗi tồn. *(Đã cài sạch và kiểm thử trên 3 máy ảo API 37 theo D52.)*
- [x] **P09-T03** — **[ALL]** Hoàn thiện README/setup, sơ đồ app–Express–Firebase–AI, schema/state machine, API contract, seed/reset, Rules, monitoring, giới hạn và chi phí. Bảng truy vết chỉ đánh dấu tiêu chí PDF có link bằng chứng; kiểm tra ít nhất 20 màn hình hoạt động và hai AI thật.
- [x] **P09-T04** — **[ALL]** Chuẩn bị demo ba thiết bị: customer đặt → merchant nhận/chế biến/sẵn sàng/gán driver → driver nhận/pickup → customer theo dõi → driver COMPLETED+COD → review. Reset dữ liệu thử có kiểm soát; không xóa nhầm dữ liệu ngoài namespace demo. [Biên bản 3 máy ảo](../../artifacts/evidence/P09/three-device/three-device-staging-result.json)
- [x] **P09-T05** — **[ALL]** Chuẩn bị case chứng minh chiều sâu: gửi checkout trùng, tranh suất cuối, reconnect/stale GPS, truy cập sai quyền, chat hai phía, hai AI và performance trước/sau. Chọn tập demo ngắn theo thời lượng trình bày, giữ video đầy đủ làm bằng chứng. [Biên bản FCM thật](../../artifacts/evidence/P05/live-fcm/staging-fcm-live.json)
- [x] **P09-T06** — **[ALL]** Soạn 10–15 slide, mục tiêu 12 slide: vấn đề/phạm vi, yêu cầu, công nghệ, kiến trúc, dữ liệu/state, khách/quán/driver, realtime, hai AI, tối ưu/monitoring, kết quả/demo, giới hạn/future work và tài liệu tham khảo. Đưa số đo thật có môi trường; không dùng roadmap làm tính năng đã xong. [Slide local](../../artifacts/releases/FoodOrderNext-BaoVe-v1.8-local.pptx)
- [ ] **P09-T07** — **[ALL]** Quay video demo dự phòng và rehearsal từng người. Mỗi thành viên giải thích được UI → API → quyền → Firestore → realtime cùng transaction/AI/performance, có nhật ký đóng góp/PR/test; không khẳng định phân công theo vai trò tự đáp ứng yêu cầu cá nhân của giảng viên.
- [ ] **P09-T08** — **[ALL]** Chốt checklist release/nghiệm thu, kiểm tra link/file/secret và tổng hợp known issues; ký xác nhận chéo bản ứng viên cuối. Chỉ ghi hoàn thành khi APK cài được, demo chạy lại, slide đúng 10–15 trang và bộ chứng cứ truy cập được; mọi thay đổi sau đó phải có retest phù hợp.

## Sản phẩm bàn giao

Ngày 2026-11-27, đã build **APK ứng viên release (`arm64-v8a` + `x86_64`)** từ commit `cd3bf4d` với URL Render HTTPS thật và cấu hình `foodordernext-staging`, ký xác minh qua `apksigner verify` (keystore lưu ngoài git tại `work/signing/`). Bản ứng viên đã cài sạch trên hai máy ảo `Pixel_9` + `Pixel_9_2` (API 37) và vượt qua **10/10 ca** luồng đồng thời trên staging (đặt COD 35.000đ, hàng đợi live, chat 2 chiều live, phân công, đổi vai trò sau `pm clear`, quyền vị trí/GPS mô phỏng gắn nhãn, thu COD, đánh giá và từ chối quyền thông báo). P09-T02 còn thành viên không build cài trên điện thoại thật; P09-T04 còn 3 thiết bị vật lý đồng thời + GPS thực. [Phiếu bản ứng viên](../../artifacts/evidence/P09/android-staging-candidate-receipt.json) · [Biên bản 2 máy ảo staging](../../artifacts/evidence/P09/second-machine/two-device/two-device-staging-result.json)

Render đã triển khai Express từ nhánh `DangTheNhan`, commit `c32dec0`. Smoke HTTPS xác nhận Firebase Auth và Firestore qua Admin SDK. Khi build APK ứng viên, ghi thêm phiên bản mã nguồn Android và SHA-256 của APK. [Kiểm tra nguồn deploy](../../artifacts/evidence/P09/render-source-preflight.json) · [Kết quả smoke](../../artifacts/evidence/P09/render-staging-smoke.json)

Bộ demo Firebase staging có sẵn một quán, hai danh mục, ba món và ba tài khoản. Trên một Android Emulator, khách đặt đơn COD 35.000 đồng, quán phân công và chuẩn bị, tài xế lấy món và thu COD, rồi khách đánh giá. Đã đọc lại đúng đơn do APK tạo trong Firestore. P09-T02 còn lượt cài mới bởi thành viên khác. P09-T04 còn chạy đồng thời ba thiết bị và xác minh vị trí trong lúc giao. [Seed staging](../../scripts/seed/README.md#bộ-dữ-liệu-staging-p09) · [Kết quả API](../../artifacts/evidence/P09/staging-cod-journey.json) · [Kết quả APK](../../artifacts/evidence/P09/android-staging-cod-journey.json)

Các tệp chuẩn bị local và từng ca nghiệm thu còn lại nằm trong [hồ sơ bàn giao](../PHASE09_REPORT.md).

APK Android đã kiểm tra, source commit/tag, hướng dẫn chạy/seed/reset, kiến trúc/API/schema/Rules, bảng yêu cầu–bằng chứng, slide 10–15 trang, video demo và known issues. Không tự phát hành lên store hoặc triển khai môi trường công khai chỉ vì đã tạo APK.

## Kiểm thử nghiệm thu và cổng hoàn thành

1. Cài mới bằng hướng dẫn trên thiết bị khác và chạy trọn luồng ba vai trò.
2. Ít nhất 20 màn hình có hành vi thật; không đếm placeholder; hai AI được demo với model thật.
3. Firestore là database chính, Express là backend duy nhất; sơ đồ khớp code và không còn SQL Server/MySQL hoạt động trong đường nghiệp vụ lõi.
4. Có bằng chứng realtime hai chiều, query/index/pagination/cache/lazy loading/batch và Firebase Performance Monitoring.
5. APK/slide/video/tài liệu gắn cùng phiên bản; video mô phỏng hoặc fixture được ghi nhãn.
6. Slide đúng 10–15 trang, có references; giới hạn và số liệu được nói đúng phạm vi.
7. Không còn lỗi chặn đặt/giao/thu COD hoặc truy cập trái quyền; checklist được thành viên khác chạy lại.

## Rủi ro

Mạng/provider AI/FCM có thể gián đoạn lúc bảo vệ; chuẩn bị dữ liệu thử/video và trình bày rõ đâu là live, đâu là bản ghi. Build có cấu hình sai môi trường phải được phát hiện qua cài sạch. Lịch tham khảo 10 tuần chỉ là giả định lập kế hoạch, không lý do bỏ kiểm tra bắt buộc.

## Bằng chứng cần lưu

artifacts/evidence/P09/: APK checksum/version/commit, biên bản cài sạch, checklist chéo, video ba thiết bị/hai AI, slide cuối và known issues. Không lưu signing key hoặc secret cùng bộ nộp.

## Bàn giao tiếp theo

Cập nhật trạng thái task vào [BACKLOG](../BACKLOG.csv), tổng hợp nghiệm thu và đường dẫn deliverable trong [PROGRESS](../PROGRESS.md); chỉ sửa [MASTER_PLAN](../MASTER_PLAN.md) nếu phạm vi thay đổi. Việc nộp, phát hành store hoặc deploy ngoài phạm vi tài liệu này phải được xử lý theo yêu cầu triển khai tương ứng; không tự coi là đã thực hiện.
