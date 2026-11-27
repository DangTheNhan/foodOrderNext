# Native P01 smoke checklist

Trạng thái: checklist chuẩn bị; các ô chưa đánh dấu không phải kết quả test. Ghi build/commit, Android version, thiết bị/emulator, project demo/staging, backend URL và evidence path trước khi chạy. Chỉ dùng tài khoản synthetic; không commit password/token hoặc link reset password vào Git.

## Điều kiện

- [ ] Firebase Auth/Firestore emulators cùng project `demo-foodordernext`; Rules và API P01 đang chạy.
- [ ] Build Android applicationId `com.foodordernext.app`, Metro/API/emulator có thể kết nối từ thiết bị.
- [ ] Có fixture customer, merchant, driver, admin, inactive user theo quy trình seed root; mọi role cấp bằng server/seed, không sửa từ app.

## Luồng có trạng thái thật

| ID | Thao tác | Kết quả mong đợi | Kết quả/evidence |
|---|---|---|---|
| NATIVE-AUTH-01 | Đăng ký email mới với tên, mật khẩu/confirm hợp lệ | Firebase user tạo; server bootstrap customer; màn xác minh; chưa mở workspace chưa verified | Chưa chạy |
| NATIVE-AUTH-02 | Mở liên kết Auth Emulator, xác minh rồi bấm kiểm tra lại | Reload + ID token mới; landing customer có profile Firestore đúng UID | Chưa chạy |
| NATIVE-AUTH-03 | Đóng/mở app hoặc force-stop rồi khởi động | Native Firebase session khôi phục, server kiểm active/role; không cần JWT local | Chưa chạy |
| NATIVE-AUTH-04 | Logout rồi login seeded merchant/driver/admin lần lượt | Landing role tương ứng; chỉ hồ sơ/bảo mật P01 được mở; không vào tab SQL-era | Chưa chạy |
| NATIVE-AUTH-05 | Sửa tên/phone; xem Firestore, logout/login lại | PATCH /me qua API có token/key; dữ liệu giữ đúng; role/emailAuth/active không đổi | Chưa chạy |
| NATIVE-AUTH-06 | Đổi password với current sai rồi đúng | Sai không cập nhật; đúng re-auth rồi update; dùng password mới đăng nhập được | Chưa chạy |
| NATIVE-AUTH-07 | Logout, reset password, mở link emulator và đặt mới | Reset không tự đăng nhập; password mới hoạt động; thông điệp không tiết lộ account tồn tại | Chưa chạy |
| NATIVE-AUTH-08 | Giữ profile mở, backend/seed có quyền đổi active=false trên tài khoản không có active order | Live authority/permission-denied dỡ private UI; API bị403; retry không tự mở lại role cũ | Chưa chạy |
| NATIVE-AUTH-09 | Mất mạng/API lúc bootstrap, rồi phục hồi và retry | Không ở loading vô hạn; có lỗi/retry; profile thiếu có thể tự bootstrap lại; không báo thành công giả | Chưa chạy |
| NATIVE-AUTH-10 | Đổi user A→B trong khi request/profile listener A đang chậm | Không áp dữ liệu A vào B; pending request cancel, stale callback bị bỏ, navigation reset | Chưa chạy |
| NATIVE-AUTH-11 | UI register/profile thử chèn role/active bằng API client riêng | Server reject protected fields; user không nâng quyền, Rules deny Firestore writes | Chưa chạy |
| NATIVE-AUTH-12 | Kiểm tra log/network đã redact và cấu hình build | Không log/store ID token/password; debug demo đúng project; release demo bị chặn | Chưa chạy |

TestID UI có sẵn: `login-email`, `login-password`, `login-submit`, `register-name`, `register-email`, `register-password`, `register-confirm`, `register-submit`, `reset-email`, `reset-submit`, `verify-refresh`, `verify-resend`, `session-retry`, `open-profile`, `profile-edit`, `profile-displayName`, `profile-phone`, `profile-save`, `open-change-password`, `change-current`, `change-new`, `change-confirm`, `change-submit`, `logout`.

Unit mock/native APK build/backend API tests có ý nghĩa khác nhau; báo cáo riêng. Emulator Firebase không chứng minh FCM/Performance/GPS thật. Google login, avatar attach và nghiệp vụ P02–P07 chưa được tính vào checklist đã hoàn tất.
