# P08 — An toàn, độ ổn định và tối ưu có số đo

**Trạng thái:** DONE  
**Chủ trì:** ALL; C điều phối bằng chứng  
**Phụ thuộc:** tích hợp [P02](P02-customer.md) đến [P07](P07-ai.md); baseline bắt đầu ghi từ các pha trước.  
**Nguồn thống nhất:** [MASTER_PLAN](../MASTER_PLAN.md).

## Mục tiêu

Chứng minh app đúng quyền, giữ invariants và xử lý dữ liệu lớn hơn demo vài dòng. Tối ưu dựa số đo thật trên cùng môi trường; Firebase Performance Monitoring là bằng chứng bắt buộc. Không dùng tốc độ emulator để khẳng định latency production.

## Công việc

Bắt đầu local với **P08-T07/T08** và theo dõi lỗi cần sửa ở **P08-T09**. Sau đó chạy **P08-T01/T02** trước khi tối ưu theo **P08-T03–T05**. Xác minh **P08-T06** trong đợt nghiệm thu Firebase staging và đa thiết bị. Xem [thứ tự triển khai](../MASTER_PLAN.md#10-thứ-tự-triển-khai-từ-hiện-tại).

- [x] **P08-T01** — **[B]** Chuẩn bị dataset tổng hợp tái lập và kịch bản tải có chi phí kiểm soát, ví dụ mục tiêu 10.000 đơn với nhiều dòng đơn/review. Ghi kích thước thật, seed namespace và cách reset; emulator dùng kiểm logic, production smoke nhỏ có ngân sách và không đẩy tải không kiểm soát.
- [x] **P08-T02** — **[ALL]** Đo baseline query/API/realtime trên cấu hình cố định: thiết bị, mạng, dataset, cache nóng/lạnh, số lần chạy và điểm timestamp. Chốt mục tiêu nội bộ sau baseline; nếu đặt p95 dưới một ngưỡng thì ghi là mục tiêu, không biến thành kết quả chưa đo.
- [x] **P08-T03** — **[B]** Tối ưu Firestore query/filter/composite index/cursor cho catalog, lịch sử, queue, review và tổng ngày. Kiểm tra read count và trang tiếp theo; dùng aggregate/materialized totals theo contract, không tải toàn bộ order lên app để cộng.
- [x] **P08-T04** — **[A]** Tối ưu màn hình dữ liệu nhiều bằng virtualized/lazy loading, ảnh kích thước phù hợp, cache có TTL/invalidation và namespace uid. Chặn fetch lặp, bỏ cache khi đổi tài khoản và kiểm tra giỏ/giá cũ vẫn được quote server. [Thử Android local](../PHASE08_REPORT.md#android-local-ngày-2026-11-25)
- [x] **P08-T05** — **[C]** Tối ưu listener scope/lifecycle, tần suất GPS, payload và retry/outbox; kiểm tra worker restart, mất mạng và backoff. Batch xử lý seed/maintenance theo giới hạn SDK chính thức đang dùng, có checkpoint, không biến một lỗi thành ghi lặp toàn bộ.
- [x] **P08-T06** — **[C]** Hoàn thiện Firebase Performance Monitoring traces cho tác vụ chính và ghi số đo trước/sau cùng kịch bản; kiểm tra log/API error correlation. Đối chiếu ảnh trace trên console với thao tác Android thật, ghi rõ nơi SDK không tự đo và custom trace bổ sung.
- [x] **P08-T07** — **[ALL]** Chạy ma trận negative test cả Rules/Storage và REST: không token, giả role, cross-user/order/restaurant, driver chưa duyệt/chưa gán, sửa giá, sai state, đọc chat/vị trí, upload không đúng quyền và secret trong bundle/log. Nhớ Admin SDK bỏ qua Rules nên test REST riêng là bắt buộc.
- [x] **P08-T08** — **[ALL]** Chạy regression invariants: suất cuối, idempotency, giải phóng tồn/voucher một lần, COMPLETED+COD atomic, message+outbox atomic, listener reconnect và AI fallback. Kiểm tra dữ liệu cuối cùng, không chỉ thông báo UI; thành viên khác chạy lại case trọng yếu.
- [x] **P08-T09** — **[ALL]** Tổng hợp defect theo mức độ, sửa lỗi chặn luồng/quyền/tiền/tồn trước; chạy lại phần liên quan sau sửa. Ghi giới hạn chưa giải quyết, chi phí đọc/AI/FCM quan sát được và quyết định cắt phần mở rộng; chỉ chuyển P09 khi không còn lỗi chặn.

P08-T07 và P08-T08 đã **DONE** sau lượt chạy lại trên máy thành viên thứ hai ngày 2026-11-27 (50 unit, 46 mobile, 56 Emulator Rules/integration, benchmark 10.003 đơn và rà soát chéo mã nguồn không phát hiện lỗi chặn). Xem [biên bản máy thứ hai](../../artifacts/evidence/P08/second-machine/summary.json) và [tiến độ](../PROGRESS.md#kết-quả-p08-local).

Trong đợt local, chạy `npm run benchmark:local` tại root để nạp fixture và đo qua một phiên Emulator riêng. Lệnh ghi kết quả vào `work/p08-benchmark.json`. Xem môi trường, cách đo và bảng trước/sau trong [báo cáo P08](../PHASE08_REPORT.md).

## Sản phẩm bàn giao

Dataset/script kiểm tra, báo cáo baseline–sau tối ưu, index/query plan, trace Performance Monitoring, ma trận bảo mật/regression và defect log có bằng chứng. Kết quả phải ghi môi trường và giới hạn suy luận.

P08-T03 đã **DONE**: bổ sung hai chỉ mục đếm đơn/tổng COD, kiểm thử phân trang 21 bản ghi staging, tái lập benchmark 10.003 đơn trên máy thứ hai và đo chính xác `readOperations` phía server Firestore staging bằng `explainOptions.analyze=true` cho cả 7 nhóm truy vấn (báo cáo trang 1 tốn 23 readOps; trang 2 `includeTotals=false` tốn 1 readOp thay vì 3 readOps). [Chỉ mục Firestore](../../artifacts/evidence/P08/staging-report-indexes.json) · [Kiểm thử phân trang API](../../artifacts/evidence/P08/staging-report-fixture.json) · [Số lượt đọc Firestore staging](../../artifacts/evidence/P08/staging-read-counts.json)

P08-T06 đã xác nhận SDK Android ghi bốn custom trace và Firebase Console đã nhận dữ liệu. APK chẩn đoán chạy hai trang báo cáo trên quán mẫu có 21 bản ghi tổng hợp. Đo trước/sau dùng cùng bộ mẫu local. Ca Express local xác nhận mã lỗi và mã yêu cầu khớp giữa HTTP 500 và log. [Biên bản trace](../../artifacts/evidence/P08/staging-performance.json) · [Báo cáo trước/sau](../PHASE08_REPORT.md)

## Kiểm thử nghiệm thu và cổng hoàn thành

1. Các đường truy cập trái quyền đều bị chặn ở bề mặt tương ứng; không có secret trong app/repo/log chia sẻ.
2. Invariants tiền/tồn/voucher/idempotency/COD/chat-outbox vượt regression sau lần sửa cuối.
3. Có ít nhất một đối chiếu đo trước/sau có cùng dataset/môi trường và Firebase Performance Monitoring thật.
4. Màn hình dữ liệu lớn có pagination/lazy loading/cache phù hợp; không đọc toàn bộ để dựng một trang.
5. Tracking/listener dừng đúng vòng đời; reconnect/worker restart không phá trạng thái.
6. Lỗi chặn luồng đã đóng bằng retest; tồn tại chỉ những giới hạn đã ghi và chấp nhận trong phạm vi.

## Rủi ro

Seed/tải lớn phát sinh phí Firebase; đo trên emulator cho logic và smoke thật trong hạn mức. Số mẫu nhỏ không chứng minh khả năng phục vụ hàng nghìn người; báo cáo đúng kích thước đo. Tối ưu khi chưa đo dễ tăng độ phức tạp; chỉ thêm thành phần khi bottleneck có chứng cứ.

## Bằng chứng cần lưu

artifacts/evidence/P08/: cấu hình môi trường, seed counts, log kịch bản, bảng metric trước/sau, ảnh Performance Monitoring, negative-test report, defect/retest và danh sách giới hạn. Không ghi giá trị ước lượng vào cột kết quả thực.

## Bàn giao tiếp theo

Bản build ứng viên, checklist đã test và bằng chứng cho [P09](P09-release-demo.md). Cập nhật chỉ số/giới hạn vào MASTER_PLAN và slide; chỉ chạy lại test khi có thay đổi hoặc lỗi cần xác minh.
