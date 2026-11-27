# Nghiệm thu local P06 · Tài xế và vị trí giao hàng

Cập nhật **2026-11-19**. P06 hoàn tất **7/8 hạng mục**. FoodOrderNext dùng React Native trên Android, Express và Firebase Emulator `demo-foodordernext`.

## Luồng giao hàng

- Màn tài xế chia chuyến đang xử lý và lịch sử đã giao. Cả hai truy vấn theo tài xế đang đăng nhập và phân trang bằng cursor.
- Nhận chuyến thay đổi assignmentStatus. Lấy món chuyển READY_FOR_PICKUP sang DELIVERING và ghi pickedUpAt. Khi giao, tài xế xác nhận số tiền phải thu, sau đó Express ghi COMPLETED và COD_CONFIRMED trong cùng lần commit.
- Android hỏi quyền vị trí chính xác khi tài xế bật chia sẻ. Rời màn chuyến, đưa app vào nền hoặc chuẩn bị xác nhận giao sẽ dừng lấy vị trí. Android hủy lượt đọc đang chạy khi activity pause. Kiểm tra quyền và provider theo API hệ thống. [Android LocationManager](https://developer.android.com/reference/android/location/LocationManager), [quyền vị trí trên Android](https://developer.android.com/training/permissions/requesting.html)
- Express kiểm tra đúng tài xế, quyền ở quán, phiên phân công, thứ tự, thời điểm đo và khoảng cách. Firestore giữ một điểm mới nhất. Xác nhận COD xóa điểm trong cùng transaction. Khách chỉ đọc tài liệu vị trí khi đơn đang giao.
- Màn khách hiển thị sơ đồ tọa độ quán, điểm giao, tài xế, thời gian và sai số. Điểm tài xế chuyển sang màu xám khi đã cũ hoặc dùng dữ liệu cache. Sơ đồ local có hướng bắc và tỷ lệ tương đối, chưa có bản đồ đường phố. Quán và khách có thể nhập tọa độ trong phần cài đặt/địa chỉ. Điểm chưa có tọa độ vẫn giữ địa chỉ bằng chữ.

## Kết quả kiểm thử

| Kiểm tra | Kết quả | Bằng chứng |
|---|---|---|
| Unit Express, contracts, seed/migration | 46 ca đạt | [Log](../artifacts/evidence/P06/unit-tests.log) |
| React Native | 40 ca đạt, ESLint phạm vi thay đổi đạt | [Unit](../artifacts/evidence/P06/mobile-unit-tests.log), [lint](../artifacts/evidence/P06/mobile-lint.log) |
| Firebase Emulator | 52 ca đạt, gồm vị trí đúng tài xế, lỗi thời gian, giới hạn gửi, quyền đọc theo đơn, dọn vị trí sau COD | [Log](../artifacts/evidence/P06/emulator-tests.log) |
| APK debug x86_64 | Build thành công với mô-đun GPS và quyền foreground | [Build](../artifacts/evidence/P06/android-build.log) |
| Android Emulator | 6 nhóm ca đạt. Nhận chuyến/lấy món, từ chối quyền/GPS tắt, ghi điểm mô phỏng, dừng gửi khi vào nền, vị trí cũ bên khách, xác nhận COD | [Smoke](../artifacts/evidence/P06/android-smoke.json) |

Lượt chạy dùng một Android Emulator, chuyển vai trò bằng tài khoản demo. Trong 14 giây chạy nền, script thay đổi tọa độ mô phỏng và đối chiếu sequence trên Firestore. Giá trị không đổi trong cửa sổ này. Sau khi xác nhận COD, quyền đọc vị trí qua tài khoản khách trả 403 và chuyến xuất hiện trong lịch sử của tài xế.

Ảnh từ máy ảo. [Từ chối quyền GPS](../artifacts/evidence/P06/android-gps-permission-denied.png), [chia sẻ vị trí](../artifacts/evidence/P06/android-driver-location.png), [sơ đồ ba điểm](../artifacts/evidence/P06/android-map-labels.png), [vị trí cũ bên khách](../artifacts/evidence/P06/android-stale-location.png), [đã thu COD](../artifacts/evidence/P06/android-driver-cod.png).

## Nghiệm thu thiết bị thật

Chạy một chuyến với hai thiết bị Android đăng nhập tài xế và khách. Cấp quyền khi dùng app, đi bộ trong khuôn viên, kiểm tra điểm di chuyển và thời gian cập nhật trên máy khách. Lặp với quyền bị từ chối, GPS bị tắt, app xuống nền, mạng bị ngắt và kết nối lại. Xác nhận giao/thu COD và kiểm tra điểm biến mất trong màn theo dõi. Ghi thời gian và trạng thái, dùng dữ liệu thử và tránh lưu địa chỉ thật trong bằng chứng.

Android Emulator dùng lệnh `adb emu geo fix` để tạo tọa độ mô phỏng. GPS của điện thoại thật và quyền trong môi trường staging vẫn chờ nghiệm thu. [Tài liệu Android Emulator Console](https://developer.android.com/studio/run/emulator-console#geo)
