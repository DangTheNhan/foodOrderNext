# Nghiệm thu local P03 · Đơn hàng COD

Cập nhật **2026-11-19**. Đã triển khai Express và React Native cho Firebase Emulator `demo-foodordernext`.

## Luồng đã có

- Khách chọn địa chỉ và mã ưu đãi, lấy báo giá từ server, xác nhận COD và nhận mã đơn sau commit. Express đọc lại món, tùy chọn, địa chỉ, phí giao và voucher. Giá hoặc thông tin báo giá thay đổi yêu cầu xác nhận lại.
- Tạo đơn khóa phiên bản giỏ được gửi từ app. Cùng transaction giữ suất và lượt voucher, lưu snapshot, ghi event/outbox, tăng bộ đếm và dọn giỏ. Gửi lại cùng key và nội dung trả cùng mã đơn.
- Lịch sử có phân trang. Chi tiết đơn nhận trạng thái cập nhật qua Firestore. Khách có thể hủy khi PENDING. Khi giao hoàn tất và COD đã được xác nhận, khách có thể đăng một đánh giá văn bản.

| Thao tác | Vai trò và trạng thái |
|---|---|
| Tạo đơn | Khách có địa chỉ của mình. Tạo PENDING và giữ suất |
| Hủy hoặc từ chối | Khách sở hữu hủy PENDING. Chủ quán hoặc admin từ chối PENDING. Cả hai hoàn giữ chỗ một lần |
| Chuẩn bị món | Chủ quán chuyển PENDING → ACCEPTED → PREPARING → READY_FOR_PICKUP |
| Phân công và nhận chuyến | Chủ quán hoặc admin phân công tài xế đủ quyền. Tài xế được phân công nhận chuyến. Assignment có version riêng |
| Lấy món | Tài xế đã nhận chuyến chuyển READY_FOR_PICKUP → DELIVERING |
| Giao hàng | Tài xế đã nhận chuyến xác nhận đúng số tiền COD. DELIVERING → COMPLETED, xác nhận thu tiền và quyết toán giữ chỗ trong cùng commit |
| Đánh giá | Khách sở hữu đơn COMPLETED có COD_CONFIRMED. Một đơn một đánh giá. Cập nhật điểm của quán trong cùng commit |

## Kiểm thử

| Bộ kiểm tra | Kết quả | Bằng chứng |
|---|---|---|
| API, contracts, seed và migration | 45 kiểm tra đạt | [Log](../artifacts/evidence/P03/unit-tests.log) |
| React Native và ESLint | 39 ca hồi quy đạt. ESLint phạm vi P03 đạt | [Unit log](../artifacts/evidence/P03/mobile-unit-tests.log), [lint](../artifacts/evidence/P03/mobile-lint.log) |
| Firebase Emulator | 37 kiểm tra đạt. Năm nhóm P03 xác minh thay giá, retry, tranh suất cuối, tranh voucher, hủy/từ chối và vòng đời COD/review qua dữ liệu sau commit | [Log](../artifacts/evidence/P03/emulator-tests.log) |
| Android Emulator | 5 nhóm ca đạt qua hai lượt. WebView cập nhật và đóng app sau khi hủy. Lượt sau mở đúng đơn đã hủy từ lịch sử rồi kiểm tra giao COD và đánh giá | [Smoke](../artifacts/evidence/P03/android-smoke.json) |
| Đối soát dữ liệu do Android tạo | Hai đơn riêng biệt. Đơn đã hủy hoàn suất và voucher. Đơn đã giao thu 25.000 VND, ghi một lượt dùng voucher và có review | [Firestore verification](../artifacts/evidence/P03/android-firestore-verification.json) |

Ảnh từ Android gồm [báo giá COD](../artifacts/evidence/P03/android-server-quote.png), [đơn đã hủy](../artifacts/evidence/P03/android-order-cancelled.png), [đơn đã thu COD](../artifacts/evidence/P03/android-order-completed.png) và [xác nhận đã đánh giá](../artifacts/evidence/P03/android-order-reviewed.png).

## Bàn giao

- UI nghiệp vụ của quán thuộc P04. UI tài xế thuộc P06. Outbox có dữ liệu chờ worker P05.
- Đánh giá hiện dùng văn bản với alias công khai chung. Ảnh review cần luồng kiểm tra và publish media.
- Cần nhóm review transaction, kiểm thử trên thiết bị vật lý và Firebase thật. Chạy demo theo [SETUP_LOCAL](SETUP_LOCAL.md).
