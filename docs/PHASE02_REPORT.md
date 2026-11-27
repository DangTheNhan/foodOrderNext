# Triển khai P02 trên môi trường local

Cập nhật **2026-11-19**. Môi trường Android Emulator, Firebase Emulator `demo-foodordernext` và Express chạy trên cùng máy Windows. Tài khoản, địa chỉ và catalog đều là dữ liệu demo.

## Phần đã triển khai

- Trang khách và danh sách quán, giờ hoạt động, tình trạng nhận đơn, phí giao và điểm tổng hợp của quán.
- Thực đơn theo quán và danh mục. Truy vấn theo đầu tên món bỏ dấu hoặc theo giá tăng dần, có nút tải trang và thử lại. Cursor gồm giá hoặc tên và ID tài liệu.
- Chi tiết món, số suất, ảnh công khai nếu có và trạng thái thiếu ảnh. Các nhóm tùy chọn hiện theo dữ liệu món. Seed hiện để trống tùy chọn và ảnh.
- Giỏ lưu bền vững theo UID. Các dòng trùng món và tùy chọn được gộp. Khách xác nhận trước khi thay quán. Express kiểm tra phiên bản, giới hạn số dòng, số lượng, suất còn lại và tùy chọn. Giá trên màn là dự kiến.
- Sổ địa chỉ thêm, sửa, xóa, chọn mặc định, có thể nhập tọa độ thủ công. Yêu thích được lưu theo UID và cho phép bỏ món đã ẩn.
- Màn chuẩn bị thanh toán chọn địa chỉ, nhập ghi chú và mã ưu đãi, xem lại COD. Schema đầu vào quote và create nằm trong contracts. Phase 3 triển khai xác nhận giá, tính ưu đãi và tạo đơn.
- Hồ sơ dẫn tới bảo mật, địa chỉ, đăng xuất, cài đặt ứng dụng trong Android và mục trợ giúp. Hỗ trợ demo qua thành viên trực. Preference push và gửi thông báo thuộc phần tích hợp FCM sau.

## Kiểm thử

| Nhóm | Kết quả | Bằng chứng |
|---|---|---|
| API, contracts, seed/migration | 45 kiểm tra đạt | [Log](../artifacts/evidence/P02/unit-tests.log) |
| Firestore/Auth/Storage Emulator | 31 kiểm tra đạt. P02 gồm query phân trang với giá/tên trùng, khóa phiên bản giỏ, địa chỉ riêng và yêu thích | [Log](../artifacts/evidence/P02/emulator-tests.log) |
| React Native | 39 kiểm tra hồi quy đạt, ESLint phạm vi P02 đạt | [ESLint](../artifacts/evidence/P02/mobile-lint.log) |
| Android JavaScript và luồng khách | 7 nhóm ca đạt qua hai lượt. Google Play Services cập nhật và đóng app giữa lượt đầu. Lượt tiếp theo đã dùng giỏ lưu từ lượt trước và kiểm tra phần còn lại | [Smoke report](../artifacts/evidence/P02/android-smoke.json) |
| Tùy chọn món và ảnh thiếu trên Android | Đạt. Tùy chọn bắt buộc khóa nút thêm, giá giỏ gồm phụ phí lựa chọn và ảnh thiếu có hiển thị thay thế | [Kết quả](../artifacts/evidence/P02/android-option.json) |

Ảnh trên máy ảo gồm [giỏ hàng](../artifacts/evidence/P02/android-cart.png), [chuẩn bị thanh toán](../artifacts/evidence/P02/android-checkout.png), [sổ địa chỉ](../artifacts/evidence/P02/android-addresses.png) và [tùy chọn món](../artifacts/evidence/P02/android-option-and-photo-fallback.png).

## Nghiệm thu còn mở

- Cần kiểm tra lại composite indexes với dự án Firebase thật. Firestore Emulator chạy được các query hợp lệ mà không kiểm tra index này. [Tài liệu Firebase](https://firebase.google.com/docs/emulator-suite/connect_firestore#how_the_cloud_firestore_emulator_differs_from_production)
- Cần B/C review hợp đồng giỏ và địa chỉ, kiểm tra mạng chậm và thử trên thiết bị thật. P00 và P01 vẫn có các hạng mục nghiệm thu riêng.
- Dùng APK debug đã build ở P01 và JavaScript P02 qua Metro. Chạy từ [hướng dẫn local](SETUP_LOCAL.md).
