# Nghiệm thu local P04 · Vận hành quán và quản trị

Cập nhật **2026-11-19**. Bản local dùng Firebase Emulator, Express và Android debug.

- Chủ quán mở đúng quán được cấp, chỉnh thông tin và bật/tạm ngừng nhận đơn. Hàng đợi đọc Firestore theo quán và trạng thái. Chi tiết theo dõi một đơn và dùng các lệnh P03 để nhận, từ chối, chế biến, báo món sẵn sàng và phân công.
- Thực đơn có tạo, sửa, ẩn, chọn danh mục hiện có, nhóm tùy chọn, ảnh và giá VND. Điều chỉnh số suất có thể bán bằng chênh lệch và lý do. Firestore giữ riêng suất đã đặt và suất đã bán. Admin có thể sửa món, chủ quán thực hiện bước tải ảnh bằng bộ chọn ảnh.
- Admin xem và lọc tài khoản, xem quán sở hữu, đổi vai trò, khóa/mở và duyệt tài xế theo quán. Thay đổi quyền đi cùng audit. Các tài khoản còn đơn, chủ quán còn sở hữu quán khi đổi vai trò, và admin cuối cùng có kiểm tra riêng.
- Báo cáo một ngày theo giờ Việt Nam. Số đơn tạo dựa trên createdAt. Số giao và thu COD cùng tổng tiền dựa trên completedAt và COD_CONFIRMED. Danh sách đơn tạo phân trang 20 mục. Số tổng hợp do Firestore tính.

## Kiểm thử

| Bộ kiểm tra | Kết quả | Bằng chứng |
|---|---|---|
| API, contracts và seed/migration | 45 kiểm tra đạt | [Unit log](../artifacts/evidence/P04/unit-tests.log) |
| React Native và ESLint | 39 ca hồi quy đạt. Lint phạm vi P04 đạt | [Unit log](../artifacts/evidence/P04/mobile-unit-tests.log), [lint](../artifacts/evidence/P04/mobile-lint.log) |
| Firebase Emulator | 43 kiểm tra đạt. P04 kiểm phạm vi chéo quán, bảo toàn tồn, ảnh pending/published, duyệt tài xế, tranh chấp admin cuối và doanh thu tại biên ngày | [Log](../artifacts/evidence/P04/emulator-tests.log) |
| Android debug x86_64 | BUILD SUCCESSFUL với RNFirebase Storage và image picker | [Build log](../artifacts/evidence/P04/android-build.log) |
| Android Emulator | 7 nhóm ca đạt qua các lần chạy tiếp trên cùng dữ liệu. Script được chỉnh để xác nhận thumbnail trong bộ chọn ảnh và dùng bộ lọc tài khoản đã khóa | [Smoke report](../artifacts/evidence/P04/android-smoke.json) |
| Đối soát sau thao tác Android | Món có 6 suất bán và ảnh, đơn đã gán và chờ lấy món, quyền được duyệt ở đúng quán, báo cáo 65.000 VND và đủ audit | [Firestore verification](../artifacts/evidence/P04/android-firestore-verification.json) |

Ảnh từ máy ảo gồm [tồn món](../artifacts/evidence/P04/android-merchant-stock.png), [đơn chờ lấy](../artifacts/evidence/P04/android-merchant-ready.png), [báo cáo COD](../artifacts/evidence/P04/android-merchant-daily.png), [quản trị quyền](../artifacts/evidence/P04/android-admin-authority.png) và [món kèm ảnh kiểm thử trên app khách](../artifacts/evidence/P04/android-customer-updated-menu.png).

## Chính sách ảnh

Ảnh chọn từ máy được gửi vào path pending của quán. Express kiểm quyền, MIME, kích thước và chữ ký định dạng đầu tệp. Server chép bytes sang vùng menuPublished riêng rồi cập nhật tham chiếu Firestore theo phiên bản món. Express chỉ phục vụ ảnh hiện tại của món đang hiển thị. File cũ được giữ cho lịch sử và xử lý lưu trữ sau. Việc gỡ ảnh được kiểm bằng yêu cầu HTTP sau khi đổi tham chiếu.

Cách tải file trong app dựa trên [RNFirebase Cloud Storage](https://rnfirebase.io/storage/usage) và bộ chọn ảnh của [React Native Image Picker](https://github.com/react-native-image-picker/react-native-image-picker).

## Bàn giao

- P05 tiếp tục listener hàng đợi, chat và worker thông báo. P06 dùng lệnh phân công P03 và danh sách đã duyệt của P04 để làm UI tài xế.
- Cần nghiệm thu với nhóm, thiết bị vật lý và composite indexes đã deploy trên Firebase thật. Report chưa đo với 10.000 đơn.
- SDK Storage ghi cảnh báo số listener của luồng tải ảnh trong lượt Android. Kiểm thử chức năng đạt. P08 cần đo các lượt tải ảnh liên tiếp và bộ nhớ của API.
- Thiết lập mới từ [hướng dẫn local](SETUP_LOCAL.md).
