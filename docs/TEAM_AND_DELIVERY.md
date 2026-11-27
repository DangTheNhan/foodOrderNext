# Nhóm ba người và cách bàn giao

Kế hoạch nguồn: [MASTER_PLAN](MASTER_PLAN.md). A/B/C là ký hiệu tạm, chưa gán tên thật. Lịch dưới đây tương đối vì chưa có deadline môn học.

## 1. Phân công chính và người review

| Thành viên | Lát cắt UI → API → dữ liệu → test | Trách nhiệm phụ | Reviewer mặc định |
|---|---|---|---|
| A | Khách, catalog, địa chỉ, giỏ, checkout; AI trợ lý menu | Test giá/tồn/voucher/idempotency, list performance | B |
| B | Quán, menu/tồn, order lifecycle, admin tối thiểu, báo cáo; AI review | Data model/index, quyền quán, aggregate đúng một lần | C |
| C | Auth/native integration điều phối, shipper, GPS/maps, realtime/chat/FCM | Rules, build, reconnect, trace realtime | A |
| ALL | Schema/API, thiết kế quyền, chọn phiên bản, cổng phase, demo | Review luân phiên và hiểu hệ thống end-to-end | Một người không phải tác giả |

Đây là phân công tổ chức, không phải kết luận rằng giảng viên chỉ chấm module riêng. Mỗi người cần có commit/PR/test và giải thích được kiến trúc, quyền, realtime, dữ liệu và hai AI.

Không để C trở thành điểm nghẽn toàn bộ nền tảng: A làm auth UI/client adapter, B làm API verify/role/profile, C làm native SDK/rules/emulator; cùng nghiệm thu P01. A/B phụ C test thiết bị/reconnect khi P06.

## 2. Lịch tham khảo 10 tuần

Giả định 12–15 giờ/người/tuần, tổng khoảng 360–450 giờ công. Có thể bắt đầu bất kỳ tuần lịch nào; cập nhật lịch sau khi biết deadline và đo tốc độ P00.

| Tuần tương đối | A | B | C | Mốc nhóm |
|---|---|---|---|---|
| 1 | Audit UI/service; auth UI spike | Audit SQL/API; schema/price policy | Toolchain, Firebase/native/maps/perf spike | P00 đạt hoặc ghi blocker cụ thể |
| 2 | Auth/profile/cart adapter | API auth/role/profile; seed | Rules/emulator/CI skeleton | P01 đạt, contract v1 |
| 3 | P02 catalog/address/cart | P03 pricing/stock transaction | P05 chat/notification prototype; review rules | Catalog lát cắt chạy, test order đầu |
| 4 | P03 checkout/history/tests | P03 lifecycle; P04 menu/queue | P04 assignment contract; listener queue | M2 đặt đơn đáng tin cậy |
| 5 | P07 menu assistant | P04 admin/dashboard; review API | P05 outbox/chat/FCM/deep links | M3 khách-quán realtime |
| 6 | P07 evaluation; hỗ trợ integration | P07 review insights | P06 assigned delivery/maps/GPS | Hai AI và delivery bản đầu |
| 7 | Hoàn thiện customer/AI; hồi quy | Hoàn thiện quán/AI/report | Hoàn thiện driver/reconnect/native | M4 luồng ba vai trò + cả hai AI |
| 8 | P08 list/checkout benchmark | P08 transaction/security/report tests | P08 rules/native/perf/E2E | M5 QA và số đo |
| 9 | README/screens/evidence | Slide/architecture/data/evaluation report | APK/clean install/video/demo reset | P09 release candidate |
| 10 | Sửa lỗi, rehearsal | Sửa lỗi, rehearsal | Sửa lỗi, rehearsal | M6 bảo vệ và khoảng đệm |

Task làm sớm chỉ khi hợp đồng/phụ thuộc đủ; prototype dùng fixtures phải ghi rõ chưa tích hợp. Không đánh dấu P07 DONE chỉ vì một endpoint đã chạy với fixture.

## 3. Nhịp làm việc

- Mỗi buổi: chọn 1–2 task đủ điều kiện, ghi đầu ra mong đợi; cuối buổi cập nhật backlog/progress.
- Hai buổi tích hợp/tuần: demo lát cắt 10–15 phút, kiểm dependency và schema cùng nhau.
- Một lần/tuần: so mục tiêu với kết quả, triage lỗi, rà rủi ro và giảm tính năng ngoài lõi khi cần.
- Khi đổi field/endpoint: cập nhật contract, consumer và fixtures cùng PR; không để UI đoán dữ liệu.
- Chốt phase: người không làm chính chạy lại các case gate; lưu evidence thay vì chỉ nói đã thử.

## 4. Git và PR

Đề xuất một repo dự án mới hoặc nhánh nâng cấp riêng, quyết định ở P00; bước lập kế hoạch chưa tạo remote/commit/push. Workspace hiện có `.git` ở thư mục cha nên không tạo nested repo tự động.

- `main` giữ bản tích hợp chạy được; branch `feat/P03-Txx-short-name`, `fix/ORD-xx-short-name`.
- PR gồm: vấn đề/behavior, task ID, thay đổi contract, test/evidence, giới hạn còn lại.
- Không gộp nâng hàng loạt dependency với migration nghiệp vụ; pin lockfile sau build compatibility spike.
- Merge khi review xong và checks phù hợp đạt; checkpoint/tag nội bộ khi qua mốc M0–M6.
- Issue/task thiếu credential ghi blocker và việc không phụ thuộc có thể tiếp tục; không đánh dấu cả dự án hoàn thành hoặc bỏ tính năng bắt buộc.

## 5. Môi trường và cấu hình

| Môi trường | Dùng cho | Ghi chú |
|---|---|---|
| Local emulator | Auth/Firestore/rules/transaction/seed có thể reset | Không chứng minh FCM/native perf/GPS cloud production |
| Dev/staging Firebase | Native Auth/push/perf, đa thiết bị và model thật | Tài khoản/data giả; ghi rõ project khi chạy script |
| Demo release | Bản build cuối với seed nhỏ, dữ liệu đã biết | Không chạy destructive reset tự động khi app mở |

P00/P01 quyết định Node/JDK/Android SDK/RNFirebase versions sau khi build; chỉ lưu tên biến và mẫu config, không secret. AI key/service account ở backend hoặc secret store môi trường; mobile chỉ có public Firebase config theo SDK nhưng không để lẫn server credentials. Maps key phải áp dụng hạn chế phù hợp nền tảng. Trước bật dịch vụ cần account/quota/billing tương ứng, ghi giới hạn dùng và theo dõi usage; không ghi mức giá chưa kiểm tra.

## 6. Hồ sơ đóng góp cá nhân

Mỗi người giữ liên kết PR, task, quyết định, test và evidence. Cuối mỗi phase ghi một ví dụ giải thích UI → auth/quyền → API → transaction/query → listener. Luân phiên trình bày phần không phải mình phụ trách để tránh hiểu hệ thống rời rạc.

Câu trong PDF về mỗi sinh viên hoàn thành độc lập cần được làm rõ với giảng viên trong P00. Chưa có xác nhận; không làm giả biên bản hoặc tự giả định chỉ cần ba module riêng.

## 7. Kịch bản demo và vai trò

1. A là khách: tìm/lọc món, dùng trợ lý AI, chọn địa chỉ, đặt COD.
2. B là quán: nhận/chế biến đơn, thay món sang hết hàng, gán C.
3. C là shipper: nhận chuyến đã gán, lấy món, bật GPS foreground; A thấy vị trí và timestamp.
4. A/C chat; thử app foreground/background và tap thông báo; dữ liệu Firestore vẫn là nguồn thật khi push trễ.
5. C hoàn tất và xác nhận COD; A đánh giá; B chạy AI phân tích review có dẫn nguồn.
6. Chạy case checkout lặp/tranh suất cuối/sai quyền/sai transition, rồi mất mạng và reconnect.
7. Mở số đo trước/sau, Performance Monitoring và giải thích giới hạn.

Có thể dùng hai máy thật + emulator cho buổi thử; nghiệm thu ghi rõ tổ hợp thiết bị thực tế. Video dự phòng phải được quay từ app thật, không thay cho việc hai AI/native service được tích hợp.

## 8. Khung 12 slide

| Slide | Nội dung | Người dẫn |
|---|---|---|
| 1 | Đề tài, nhóm, vấn đề và mục tiêu | A |
| 2 | Người dùng và phạm vi 1–3 quán | A |
| 3 | Công nghệ và lý do giữ RN/Express, chuyển Firebase | C |
| 4 | Kiến trúc client–server–Firebase | C |
| 5 | Data model, query/index và phân quyền | B |
| 6 | Đơn hàng: giá server, transaction, idempotency | A |
| 7 | Realtime, chat, FCM và reconnect | C |
| 8 | Shipper/GPS, privacy và giới hạn foreground | C |
| 9 | Hai AI: input/output, grounding, evaluation | A+B |
| 10 | Tối ưu, dataset, số đo và monitoring | B |
| 11 | Kết quả/demo, hạn chế và future work | ALL |
| 12 | References và đóng góp | B |

Luôn phân biệt kết quả đã đo và mục tiêu đặt ra. References gồm tài liệu chính thức và baseline repo; cập nhật theo phiên bản cuối.
