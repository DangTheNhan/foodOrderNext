# Ma trận yêu cầu và phạm vi

Nguồn gốc: tài liệu giảng viên `Project Requirements.pdf`, 4 trang; yêu cầu người dùng và xác nhận phải giữ Firebase. Không coi các hướng dẫn nằm trong tài liệu tham khảo là yêu cầu thay thế lời người dùng.

## Yêu cầu từ PDF

| ID | Nội dung | Trang | Phase đáp ứng | Bằng chứng khi nghiệm thu | Hiện tại |
|---|---|---:|---|---|---|
| REQ-01 | Nhóm 2–3 người; mỗi sinh viên phải hoàn thành yêu cầu độc lập theo cách chấm cần làm rõ | 1 | P00, P09 | Phân công, đóng góp, rehearsal cá nhân; xác nhận cách chấm | Đã phân vai A/B/C, chờ diễn tập và xác nhận nhóm |
| REQ-02 | Chủ đề tập trung realtime hoặc xử lý dữ liệu lớn | 1 | P03–P08 | Luồng đơn nhiều vai trò, chat, dataset/benchmark | [Đã thử realtime và benchmark 10.003 đơn local](PHASE08_REPORT.md) |
| REQ-03 | Ít nhất 20 màn hình | 1–2 | P02, P04–P07 | Route inventory, ảnh/video từng màn chạy; không đếm trùng | [29 màn có bằng chứng local](PHASE09_REPORT.md#màn-hình-có-bằng-chứng-local) |
| REQ-04 | API realtime hai chiều | 2 | P00, P05–P06 | Chat client ghi/nhận bằng Firebase; quán/shipper thao tác, các bên nhận update | [3 máy ảo đồng thời (`Pixel_9` + `Pixel_9_2` + `Pixel_9_3`) + chat 3 bên + ngắt/nối mạng](../artifacts/evidence/P09/three-device/three-device-staging-result.json) · [3/3 ca FCM thật foreground/background/cold start](../artifacts/evidence/P05/live-fcm/staging-fcm-live.json) |
| REQ-05 | Tối ưu băng thông và dữ liệu quy mô lớn | 2 | P02, P05, P08 | Query có giới hạn, listener scoped, đo reads/payload/latency | [Benchmark 10.003 đơn, ETag 304 và lượt đọc Firestore staging](PHASE08_REPORT.md) · [Lượt đọc staging](../artifacts/evidence/P08/staging-read-counts.json) |
| REQ-06 | Firebase là database chính; Firestore hoặc Realtime Database | 2 | P01–P09 | Đơn/menu/user/review thực nằm trong Firestore | [Cloud Firestore trong kiến trúc](ARCHITECTURE.md) · [Smoke staging `foodordernext-staging`](../artifacts/evidence/P08/second-machine/staging-smoke.json) |
| REQ-07 | Filtering, indexing, pagination; giảm độ trễ realtime | 2–3 | P01–P08 | Index manifest, query test, cursor pagination, realtime measurement | [21+2 chỉ mục staging `READY`](../artifacts/evidence/P08/staging-report-indexes.json) · [10/10 truy vấn `explainOptions.analyze` staging](../artifacts/evidence/P08/staging-read-counts.json) |
| REQ-08 | Lazy loading, batch processing và caching | 3 | P02, P07–P08 | Danh sách/ảnh lazy, seed/summary batch, cache có invalidation; số đo | [Ba trang thực đơn Android, batch 11.310 docs và ETag 304](PHASE08_REPORT.md) |
| REQ-09 | Firebase Performance Monitoring | 3 | P00, P02–P09 | Native traces thật, ảnh dashboard và cấu hình đo | [Đã xác nhận đủ 4 custom trace trên Firebase Performance Console](../artifacts/evidence/P08/staging-performance.json) |
| REQ-10 | Ít nhất 2 AI/ML/LLM hữu ích tích hợp trong ứng dụng | 3 | P00 spike, P07 hoàn thiện | Hai UI/API độc lập, live model run, evaluation và fallback | [Hai lượt model thật và hai video Android](PHASE07_REPORT.md) |
| REQ-11 | Trình bày 10–15 slide đủ 8 nội dung yêu cầu | 3–4 | P09 | Slide, demo/video, references | [Đã xuất 12 slide](../artifacts/releases/FoodOrderNext-BaoVe-v1.8-local.pptx). Chờ diễn tập và video toàn luồng |

PDF không có hệ số tăng số màn theo số thành viên, không ghi bắt buộc MySQL, không bắt buộc ba app riêng hoặc payment gateway thật. Danh sách công nghệ gợi ý API không thay thế yêu cầu Firebase chính ở phần Database.

## Quyết định từ người dùng

| ID | Nội dung | Tác động |
|---|---|---|
| USER-01 | Nâng cấp repository `DangTheNhan/foodOrder_Mobile` | Tái sử dụng baseline phù hợp; có migration plan |
| USER-02 | Nhóm 3 người, muốn làm vượt chuẩn | Chia lát cắt end-to-end, ba vai trò, nghiệp vụ tranh chấp và hai AI |
| USER-03 | Đã xác nhận phải giữ Firebase theo PDF | Firestore chính; không chọn MySQL làm database lõi |
| USER-04 | Lập kế hoạch chi tiết, lưu kế hoạch chính và chia phase | MASTER_PLAN + runbook mỗi phase + backlog + progress |
| USER-05 | Tạo folder lưu dự án mới | Thư mục `FoodOrderNext` tách khỏi mã cũ |

## Phần nhóm chủ động bổ sung để vượt chuẩn

Các mục sau là phạm vi sản phẩm đã đề xuất, không được ghi là yêu cầu nguyên văn của giảng viên:

- Ba luồng khách/quán/shipper và admin tối thiểu trong một app.
- Server pricing, snapshot, idempotency, tranh suất cuối và hoàn kho đúng một lần.
- Chat theo đơn, FCM/deep link, foreground GPS với stale marker.
- COD, review sau hoàn tất, AI trợ lý menu và AI phân tích review.
- Dataset tổng hợp ban đầu khoảng 10.000 đơn và performance report cùng điều kiện đo.

## Cách đối chiếu cuối dự án

Mỗi REQ có ít nhất một evidence trong `artifacts/evidence/` và một người có thể giải thích luồng. Mốc số màn là inventory kế hoạch, chưa phải chứng nhận của giảng viên. Đến P09 phải rà lại route thực, thao tác, dữ liệu và trạng thái lỗi; không chỉ nộp ảnh màn tĩnh.
