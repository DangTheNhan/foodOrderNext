# P06 — Nhiệm vụ shipper và vị trí giao hàng

**Trạng thái:** DONE  
**Chủ trì:** C  
**Phụ thuộc:** assignment từ [P04](P04-merchant-admin.md), trạng thái/COD từ [P03](P03-order-engine.md), realtime/notification từ [P05](P05-realtime-chat-notifications.md).  
**Nguồn thống nhất:** [MASTER_PLAN](../MASTER_PLAN.md).

## Mục tiêu

Driver chỉ xử lý nhiệm vụ được merchant/admin phân công. Theo dõi GPS foreground trên Android và hiển thị vị trí có độ mới rõ ràng; không yêu cầu background GPS hoặc bảng việc công khai. Đây là phạm vi giao trong khuôn viên trường, không xây tự ghép tài xế.

## Công việc

- [x] **P06-T01** — **[C]** Làm danh sách/chi tiết nhiệm vụ chỉ theo driverUid hiện tại, có đơn mới, đang giao và lịch sử phù hợp. Không hiển thị available jobs cho mọi driver; API và Rules cùng chặn người chưa được giao.
- [x] **P06-T02** — **[C]** Làm nhận nhiệm vụ assignmentStatus ASSIGNED → ACCEPTED qua API; giữ riêng với order status ACCEPTED của quán. Chỉ driver đã duyệt/được gán nhận nhiệm vụ; không cho tự chọn orderId để chiếm đơn.
- [x] **P06-T03** — **[C]** Làm pickup khi order READY_FOR_PICKUP và assignment đã ACCEPTED; command chuyển thẳng DELIVERING, ghi pickedUpAt. Chặn quét/nhấn sớm, sai tài xế và retry; không thêm trạng thái PICKED_UP.
- [x] **P06-T04** — **[C]** Tích hợp quyền vị trí foreground, lấy tọa độ khi đang giao và giải thích hành động khi quyền bị từ chối/GPS tắt. Chỉ gửi khi app đang hoạt động và chuyến phù hợp; app xuống nền phải hiển thị giới hạn theo dõi khi người dùng quay lại, không giả vờ vẫn có vị trí mới.
- [x] **P06-T05** — **[C]** Gửi vị trí qua API scoped, validate lat/lng, timestamp/sequence và giới hạn tần suất/khoảng cách. Backend ghi latest position với receivedAt server; loại update cũ, không ghi lịch sử dày đặc không có nhu cầu, dừng khi order kết thúc.
- [x] **P06-T06** — **[A]** Làm bản đồ theo dõi cho khách, điểm quán/địa chỉ/shipper và thời điểm cập nhật gần nhất. Có marker stale theo ngưỡng cấu hình, trạng thái chưa có vị trí/mất quyền/mất mạng; không nội suy đường đi giả hoặc gọi ETA cố định là AI.
- [x] **P06-T07** — **[C]** Làm xác nhận giao và COD đúng command P03: driver được giao chuyển DELIVERING → COMPLETED cùng COD confirmed atomically. UI cho xem số phải thu nguyên VND, xác nhận rõ, chống double tap/retry và tắt tracking sau thành công.
- [x] **P06-T08** — **[ALL]** Chạy chuyến thử foreground trên thiết bị thật và test GPS tắt/quyền từ chối/mạng rớt/vị trí cũ/sai driver/gửi sau hoàn tất. Nếu dùng mô phỏng tọa độ để lặp test phải gắn nhãn, tách video GPS thật khỏi mô phỏng và không gọi mô phỏng là theo dõi thực.

Ngày 2026-11-27 (theo quyết định D52 dùng 3 Android Emulator API 37): đã kiểm thử trọn ca từ chối/cấp quyền vị trí, chia sẻ tọa độ mô phỏng gắn nhãn `EMULATED_GPS_ADB_GEO_FIX` trên `Pixel_9_3` hiện live trên `Pixel_9`, ngắt/nối mạng khi thu COD (`reconnect 2,55s`) và các ca âm tính trong bộ Emulator/staging. [Biên bản 3 máy ảo](../../artifacts/evidence/P09/three-device/three-device-staging-result.json)

## Sản phẩm bàn giao

Assigned-job UI/API, assignment acceptance, pickup/delivery/COD, foreground tracking, bản đồ khách và stale UX; tài liệu quyền/giới hạn theo dõi và retention vị trí.

## Kiểm thử nghiệm thu và cổng hoàn thành

1. Driver chỉ thấy đơn được gán; chưa duyệt/không được gán không nhận/gửi tọa độ/chuyển trạng thái.
2. ASSIGNED → ACCEPTED không tự đổi trạng thái chế biến của quán.
3. Pickup chỉ từ READY_FOR_PICKUP và ghi pickedUpAt; không có state phụ ngoài hợp đồng.
4. Vị trí thật cập nhật trên thiết bị khách; vị trí cũ được đánh dấu stale, không giả có dữ liệu mới.
5. Update cũ/sai tọa độ/quá tần suất/sau kết thúc bị xử lý theo contract.
6. Hoàn tất và COD cùng commit; retry không thu hai lần; tracking dừng và không đọc vị trí ngoài quyền.

## Rủi ro

GPS trong nhà/khuôn viên có thể sai; hiển thị độ mới và không hứa chính xác tuyến đường. Hệ điều hành ngắt foreground app khi xuống nền là giới hạn phạm vi, không lén thêm background permission. Map provider/network có thể lỗi; địa chỉ và thông tin nhiệm vụ vẫn phải xem được.

## Bằng chứng cần lưu

artifacts/evidence/P06/: video nhiệm vụ/giao/COD, video hai thiết bị có GPS thật, mẫu vị trí đã làm mờ nếu cần, negative test quyền/stale và chứng cứ tracking dừng. Ghi rõ mô phỏng ở mọi kết quả dùng fixture.

## Bàn giao tiếp theo

Luồng COMPLETED thật và số đo GPS cho [P08](P08-hardening-performance.md). [P07](P07-ai.md) có thể phát triển song song pha này bằng fixture COMPLETED/review đã có từ P01/P03.

## Kết quả local

Hoàn tất 7/8 task. T08 chờ kiểm GPS và mất mạng trên thiết bị thật. Sơ đồ local dùng tọa độ và hướng bắc. Xem [báo cáo P06](../PHASE06_REPORT.md).
