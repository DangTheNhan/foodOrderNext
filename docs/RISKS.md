# Rủi ro, tín hiệu và cách giảm phạm vi

Các rủi ro là nội dung quản lý kế hoạch, chưa phải lỗi đã xảy ra trong dự án mới. Ưu tiên không để tính năng tùy chọn chiếm thời gian của hai AI/realtime/Firebase/performance bắt buộc.

| ID | Rủi ro / dấu hiệu | Cách xử lý trong kế hoạch | Owner / phase |
|---|---|---|---|
| R01 | RN baseline/native SDK không build cùng nhau | Spike Android sạch; pin sau khi build, không nâng đồng loạt; ghi matrix JDK/Node/RN/RNFirebase | C / P00 |
| R02 | Không có thiết bị/key/account/quota cho maps/AI/FCM/perf | Kiểm kê sớm; làm local/emulator/contracts song song; live integration chưa đủ thì không đánh dấu DONE | ALL / P00 |
| R03 | Cách chấm từng người khác giả định chia module | Làm rõ với giảng viên; mỗi người có lát cắt end-to-end, review và rehearsal | ALL / P00,P09 |
| R04 | Quá nhiều màn hình tĩnh, thiếu luồng | Screen inventory gắn dữ liệu/action/error; ưu tiên M2–M4 trước màn cosmetic | A+B / P02–P07 |
| R05 | API Admin SDK không chịu Security Rules | Test REST role/owner/active độc lập với emulator Rules | B+C / P01,P08 |
| R06 | Race stock/voucher hoặc retry tạo trùng | Transaction, operation fingerprint, per-user quota docs, statusVersion; concurrency tests | A+B / P03 |
| R07 | PENDING giữ suất quá lâu | Quán xử lý queue và từ chối PENDING theo chính sách; test cleanup demo có chủ đích; không âm thầm thêm timer distributed | B / P03,P04 |
| R08 | Notification trễ/trùng, app background khó demo | Outbox retry, token lifecycle, dedup, Firestore source of truth, real device cases | C / P05 |
| R09 | GPS không cập nhật khi nền hoặc quyền bị từ chối | Giới hạn foreground; manual address; stale state; không quảng bá background tracking | C / P06 |
| R10 | AI bịa ID/giá/review hoặc nhận instruction từ review | Grounding bounded candidates, structured validation, evidence IDs, input treated as data; no write tools | A+B / P07 |
| R11 | AI timeout/quota/cost | Timeout/rate limit/cache có version, usage cap, labeled deterministic fallback; ít nhất live success cho cả hai | A+B / P00,P07 |
| R12 | Search/query Firestore không tương đương SQL | Chốt prefix/tokens và supported filters; spike indexes; tránh tải collection về lọc | A+B / P00,P02 |
| R13 | Benchmark đẹp trong emulator nhưng không có giá trị thực | Cùng dataset/device/network, p50/p95/sample, staging release build; emulator chỉ logic | ALL / P08 |
| R14 | Lộ token/PII qua fixture/log/traces/AI | Dữ liệu giả; allowlist fields; secret backend; trace không chứa text/địa chỉ; read scope theo role | ALL / mọi phase |
| R15 | UID/Google/password legacy mapping sai | Demo accounts mới; dry-run/count/orphan checks; import preservation là nhánh riêng có test | B+C / P01 |
| R16 | Một người ôm native/auth/realtime/driver quá nhiều | Chia auth API/UI cho A/B; A/B chạy integration; review luân phiên; prototype sớm | ALL / mọi tuần |
| R17 | Tài liệu/checklist lệch code | PR đổi contract kèm docs; BACKLOG+PROGRESS+phase cập nhật cùng lần | ALL / mọi phase |
| R18 | Thiếu thời gian cuối kỳ | Đóng scope theo thứ tự giảm bên dưới, giữ buffer tuần 10 | ALL / rà hàng tuần |

## Thứ tự giảm phạm vi khi thiếu thời gian

1. Bỏ mọi phần ngoài lõi: payment gateway, GPS nền, auto dispatch, loyalty/group ordering/forecast, iOS, web admin riêng.
2. Giảm ba quán thành một; dùng tài xế đã gán thủ công, một loại phí ship và voucher fixed-amount đơn giản.
3. Giảm biến thể món/ảnh review; giữ text review đã xác minh để AI review vẫn có dữ liệu thật.
4. Đơn giản dashboard còn daily totals/top count, hạn chế khoảng báo cáo; vẫn có phân trang và đo hiệu năng thật.
5. Hạn chế style/polish phụ; giữ loading/error/empty/offline và accessibility cơ bản.

Không bỏ hai AI, Firebase chính, realtime hai chiều, tối ưu/Performance Monitoring, tối thiểu 20 màn có nghĩa và slide yêu cầu. Nếu deadline không cho phép đạt các tiêu chí này, ghi thiếu sót thực tế và điều chỉnh phạm vi với thông tin mới; không đổi nhãn mock thành chức năng hoàn chỉnh.

## Xử lý blocker

Trong BACKLOG ghi tác động cụ thể, việc đã thử, input còn thiếu và task không phụ thuộc có thể làm tiếp. Credentials/quyền account chỉ yêu cầu khi cần chạy dịch vụ tương ứng, không yêu cầu lại những quyết định user đã xác nhận. Không tự public/deploy hoặc tạo chi phí thay vì ghi rõ bước cấu hình còn thiếu.
