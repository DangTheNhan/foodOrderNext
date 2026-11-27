# P03 — Bộ máy đơn hàng, giá, tồn món và COD

**Trạng thái:** IN_REVIEW  
**Chủ trì:** A; B/C review transaction và quyền  
**Phụ thuộc:** [P01](P01-auth-data.md), cart contract từ [P02](P02-customer.md).  
**Nguồn thống nhất:** [MASTER_PLAN](../MASTER_PLAN.md).

## Mục tiêu

Đưa giá và tính nhất quán về Express/Firestore transaction. Đơn một quán, tối đa 20 dòng, tiền nguyên VND; chỉ COD trong phạm vi. Không gọi FCM hoặc AI bên trong transaction.

## Công việc

- [x] **P03-T01** — **[A]** Triển khai state machine đúng tập PENDING, ACCEPTED, PREPARING, READY_FOR_PICKUP, DELIVERING, COMPLETED, CANCELLED, REJECTED; mỗi chuyển trạng thái có actor/điều kiện/timestamp server. Chỉ customer sở hữu hủy PENDING; merchant/admin từ chối PENDING; trạng thái cuối không mở lại.
- [x] **P03-T02** — **[A]** Làm quote/create tải lại giá/optionIds hợp lệ/khả dụng từ server; tính subtotal/discount/deliveryFee/total nguyên VND. Kiểm tra một quán/tối đa 20 dòng, snapshot dòng/địa chỉ; không tin owner/role/giá/tổng từ client. Nối form checkout P02 vào API thật, chỉ mở OrderSuccess sau commit; optionGroups rỗng vẫn đặt món cơ bản được.
- [x] **P03-T03** — **[B]** Giữ suất bằng transaction ngay khi tạo PENDING; không đủ suất thì từ chối. CANCELLED/REJECTED giải phóng reservation đúng một lần, có dấu đã xử lý; retry không cộng tồn lặp, COMPLETED không hoàn tồn.
- [x] **P03-T04** — **[A]** Làm idempotency create theo uid/key và fingerprint payload. Cùng key/payload trả cùng đơn; cùng key khác payload bị từ chối; timeout client không tạo đơn mới chỉ vì chưa nhận response.
- [x] **P03-T05** — **[B]** Làm voucher tối thiểu gồm hiệu lực, quán, ngưỡng, mức giảm và giới hạn sử dụng. Kiểm tra server-side, reserve/release lượt theo hợp đồng cùng vòng đời đơn để không vượt hạn hoặc hoàn lượt lặp.
- [x] **P03-T06** — **[C]** Làm transition command kiểm tra role/restaurant/assigned driver và trạng thái hiện hành; ghi event cùng transaction. assignmentStatus ASSIGNED → ACCEPTED là field riêng; pickup READY_FOR_PICKUP → DELIVERING và ghi pickedUpAt, không thêm PICKED_UP.
- [x] **P03-T07** — **[C]** Xác nhận giao và thu COD atomically bởi driver được giao/đã nhận nhiệm vụ. DELIVERING → COMPLETED cùng số tiền COD đúng tổng phải thu, actor và timestamp; retry không ghi nhận thu tiền lần hai.
- [x] **P03-T08** — **[A]** Làm lịch sử/chi tiết/hủy đơn và review sau COMPLETED; chỉ customer sở hữu đánh giá một lần mỗi đơn. Validate rating/nội dung; lưu quan hệ order/restaurant để quán và AI đọc đúng phạm vi.
- [ ] **P03-T09** — **[ALL]** Chạy test sửa giá, gửi trùng, tranh suất cuối, cancel/reject đồng thời, nhảy trạng thái/sai actor, voucher tranh chấp và COD retry. Assert tồn/usage/event/tổng sau test, không chỉ assert HTTP status.

Staging đã kiểm tra gửi trùng, chặn khách chuyển trạng thái, COD sai và gửi lại, tồn sau hoàn tất và đánh giá. B/C còn review transaction và các ca đồng thời. [Bằng chứng API](../../artifacts/evidence/P09/staging-cod-journey.json)

## Sản phẩm bàn giao

State matrix, command API, snapshot order; transaction reservation/voucher/idempotency/event/COD; màn hình khách nối API; test tranh chấp và fixture COMPLETED/review.

## Kiểm thử nghiệm thu và cổng hoàn thành

1. Hai khách tranh suất cuối chỉ một đơn thành công, tồn không âm.
2. Retry create/cancel/reject/COD không trùng đơn, hoàn tồn, usage hoặc khoản thu.
3. Owner chỉ hủy PENDING; actor sai/nhảy trạng thái/trạng thái cuối bị chặn.
4. Đổi catalog sau đặt không đổi snapshot; số tiền/số lượng không hợp lệ bị từ chối.
5. COMPLETED luôn có COD confirmed trong cùng commit; không có đơn giao xong nhưng chưa xác nhận thu.
6. Review đúng owner/COMPLETED và duy nhất; test qua backend/emulator, không chỉ mock UI.

## Rủi ro

Transaction retry có thể lặp side effect: ghi event/outbox trong commit, gửi ngoài commit. Reservation PENDING có thể giữ lâu; trong phạm vi quán xử lý nhận/từ chối, không tự thêm cơ chế hết hạn/trạng thái mới. Giá/tồn/voucher đổi đồng thời cần phản hồi có thể phục hồi.

## Bằng chứng cần lưu

artifacts/evidence/P03/: state matrix, request/response đã che token, test concurrency/idempotency, tồn/voucher trước-sau, video checkout/hủy/review và transaction COD. Fixture không được ghi là chuyến giao thực.

## Bàn giao tiếp theo

Command/state machine cho [P04](P04-merchant-admin.md), [P05](P05-realtime-chat-notifications.md), [P06](P06-driver-tracking.md). Fixture COMPLETED/review cho phép [P07](P07-ai.md) chạy song song P06.

## Kết quả local

Xem [báo cáo P03](../PHASE03_REPORT.md) và [tiến độ](../PROGRESS.md).
