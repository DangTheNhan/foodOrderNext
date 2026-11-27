# P04 — Vận hành quán và admin tối thiểu

**Trạng thái:** IN_REVIEW  
**Chủ trì:** B  
**Phụ thuộc:** [P03](P03-order-engine.md) có command/state contract chạy được; schema và quyền từ [P01](P01-auth-data.md).  
**Nguồn thống nhất:** [MASTER_PLAN](../MASTER_PLAN.md).

## Mục tiêu

Cho quán vận hành thực đơn và xử lý đơn đúng state machine; admin quản lý người dùng tối thiểu. Giữ trong một app theo vai trò, không xây dashboard web riêng. Số liệu ngày dựa đơn COMPLETED/COD đã xác nhận, không gọi toàn bộ đơn PENDING là doanh thu.

## Công việc

- [x] **P04-T01** — **[B]** Làm khu vực merchant và kiểm tra restaurant scope trên API. Người quản lý chỉ xem/sửa quán được cấp; chọn shopId trên client không đủ để mở quyền.
- [x] **P04-T02** — **[B]** Làm CRUD món của quán và tùy chọn đơn giản nếu có, ảnh, giá nguyên VND và khả dụng; chọn danh mục đã seed, không cho merchant sửa danh mục toàn hệ thống. Validate dữ liệu ở server; ẩn món có lịch sử thay vì phá snapshot order; cập nhật ảnh dùng Storage contract, xử lý lỗi upload và ảnh không còn dùng.
- [x] **P04-T03** — **[B]** Làm chỉnh suất/tồn và tạm hết món qua API có audit. Phân biệt lượng đã reserve với lượng có thể bán; không cho thao tác điều chỉnh làm âm tồn hoặc mất reservation đang giữ, không ghi đè số tồn từ UI cũ.
- [x] **P04-T04** — **[B]** Làm hàng đợi đơn phân theo trạng thái và chi tiết order với snapshot/địa chỉ/ghi chú. Nối nhận/từ chối/chế biến/sẵn sàng vào command P03; chống double tap, xử lý đơn đã được thiết bị khác cập nhật.
- [x] **P04-T05** — **[B]** Làm gán tài xế bởi merchant/admin từ danh sách driver đã được duyệt, kiểm tra phạm vi và trạng thái đơn hợp lệ. Ghi driverUid và assignmentStatus ASSIGNED riêng với order status; không cung cấp bảng việc công khai để driver tự nhận, không âm thầm đổi tài xế đã nhận nhiệm vụ.
- [x] **P04-T06** — **[B]** Làm admin user management tối thiểu: danh sách/lọc, xem vai trò/quán, duyệt driver, cấp vai trò hợp lệ và khóa/mở tài khoản có audit. Cấm client tự cấp quyền; xử lý xung đột khi khóa tài khoản có đơn đang hoạt động theo quy tắc được ghi rõ.
- [x] **P04-T07** — **[B]** Làm tổng quan ngày tối thiểu: số đơn, số COMPLETED, tổng COD confirmed và danh sách đơn liên quan theo múi giờ Asia/Ho_Chi_Minh. Dùng truy vấn/tổng hợp có giới hạn, nhãn số liệu rõ; đối soát với fixture thay vì tính từ những dòng UI đã tải.
- [ ] **P04-T08** — **[ALL]** Chạy cross-role test merchant/admin: CRUD phản ánh trên catalog khách, quán khác bị chặn, driver chưa duyệt không được gán, transition sai bị chặn và tổng ngày khớp dữ liệu nguồn. Chuẩn bị hợp đồng event/giao việc cho P05/P06.

APK staging đã xác nhận quán nhận đơn, gán tài xế và báo món sẵn sàng. Còn ca quyền chéo của admin/quán và đối soát theo ngày. [Bằng chứng APK](../../artifacts/evidence/P09/android-staging-cod-journey.json)

## Sản phẩm bàn giao

Merchant screens/CRUD/queue/assignment, admin user management tối thiểu, dashboard tổng ngày và audit thao tác nhạy cảm. Không bao gồm đối soát nhiều bên, hoa hồng hoặc marketplace đăng ký quán tự động.

## Kiểm thử nghiệm thu và cổng hoàn thành

1. Tạo/sửa/ẩn món phản ánh ở catalog; đơn cũ giữ snapshot.
2. Merchant không đổi shopId để quản lý quán khác; customer/driver không gọi API quản trị.
3. Chỉ nhận/từ chối PENDING; chuyển PREPARING/READY_FOR_PICKUP theo state machine.
4. Chỉ merchant/admin gán driver đã duyệt; assignmentStatus độc lập với trạng thái đơn.
5. Điều chỉnh tồn không phá reservation hoặc làm âm số có thể bán.
6. Tổng ngày khớp tập fixture có đơn cuối ngày, đơn hủy và COD confirmed; admin thao tác có dấu vết.

## Rủi ro

UI đồng thời có thể dùng dữ liệu cũ: server kiểm tra trạng thái/version. Tổng ngày có thể lệch nếu chọn sai múi giờ hoặc đếm pending: chốt field nguồn và test biên ngày. Phạm vi admin dễ phình: chỉ quản lý người dùng/quyền và hỗ trợ vận hành tối thiểu.

## Bằng chứng cần lưu

artifacts/evidence/P04/: video CRUD/queue/assignment/admin, báo cáo cross-restaurant authorization, snapshot tồn trước-sau, audit đã bỏ thông tin nhạy cảm và bảng đối soát tổng ngày.

## Bàn giao tiếp theo

Event/queue/assignment contract cho [P05](P05-realtime-chat-notifications.md), nhiệm vụ ASSIGNED cho [P06](P06-driver-tracking.md), quyền đọc review/quán cho [P07](P07-ai.md).

## Kết quả local

Xem [báo cáo P04](../PHASE04_REPORT.md) và [tiến độ](../PROGRESS.md).
