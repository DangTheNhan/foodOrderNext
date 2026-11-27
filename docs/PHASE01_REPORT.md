# Báo cáo triển khai P01 local

Cập nhật **2026-11-07**. Môi trường **LOCAL demo-foodordernext**; mọi tài khoản và dữ liệu thử đều tổng hợp. Trạng thái nghiệm thu tổng hợp theo [PROGRESS](PROGRESS.md).

## Phần đã có mã chạy

- Native Firebase Auth: đăng nhập/đăng ký, xác minh email, khôi phục phiên, đăng xuất, quên/đổi mật khẩu với re-authentication.
- Role navigation customer/merchant/driver/admin. P01 mở khu vực tài khoản/hồ sơ theo role; nghiệp vụ quán, đơn và giao hàng chưa được dựng ở phase này.
- Express xác minh Firebase ID token, đọc role/active từ Firestore hiện tại, bootstrap customer idempotent, GET/PATCH hồ sơ có validation và idempotency key.
- API intent giữ nguyên UID/session generation trước interceptor, trong token wait và khi retry 401; hủy và loại dữ liệu phiên trước khi đổi account.
- Contracts ESM/Zod dùng chung cho profile và các cấu trúc nền tảng; seed cũng phải qua cùng schema thay vì có định nghĩa profile riêng.
- Firestore/Storage Rules, indexes source, mặc định chặn client Firestore writes và phân quyền đọc theo owner/shop/assignment.
- Seed mới cho 1–3 quán, 8 Auth identities/40 domain documents ở cấu hình 3 quán, có manifest, dry-run, rerun giữ dữ liệu và reset có guard.
- Migration diagnostic chỉ đọc; không importer SQL hoặc dual-write. Mã UI cũ được nhập có lọc để chuyển dần ở phase sau.

## Kết quả kiểm tra

| Nhóm | Kết quả | Bằng chứng |
|---|---|---|
| API unit | 33/33 PASS | [unit-tests.log](../artifacts/evidence/P01/unit-tests.log) |
| Shared contracts | 5/5 PASS | [unit-tests.log](../artifacts/evidence/P01/unit-tests.log) |
| Seed/migration safety | 7/7 PASS | [seed-migration-tests.log](../artifacts/evidence/P01/seed-migration-tests.log) |
| React Native unit | 39/39 PASS | [mobile-unit-tests.log](../artifacts/evidence/P01/mobile-unit-tests.log) |
| Lint mã P01 và mobile tests | PASS, exit code 0 | [mobile-lint.log](../artifacts/evidence/P01/mobile-lint.log) |
| Auth/Firestore thật trong Emulator + Rules | 26/26 PASS | [emulator-tests.log](../artifacts/evidence/P01/emulator-tests.log) |
| Android native build | BUILD SUCCESSFUL, debug x86_64 | [android-build.log](../artifacts/evidence/P01/android-build.log) |
| Android smoke | 7 case PASS: login, profile, restart session, logout, merchant/driver/admin | [android-smoke.json](../artifacts/evidence/P01/android-smoke.json) |
| Native signup/verification/change/reset password | 5/5 case PASS trên Android Emulator | [android-auth.json](../artifacts/evidence/P01/android-auth.json) |
| Seed apply/rerun thật | CREATED và PRESERVED_EXISTING_DATASET | [apply](../artifacts/evidence/P01/seed-apply.log), [rerun](../artifacts/evidence/P01/seed-rerun.log) |

Các dòng PERMISSION_DENIED trong log Rules là ca cố ý kiểm tra từ chối, không phải các test bị bỏ qua. Tổng hợp cuối log mới là kết quả. Emulator có lỗi rules runtime shutdown sau khi test pass; exit code thực và tổng pass/fail được giữ nguyên, không bỏ qua lỗi test để lấy màu xanh.

Ảnh đã kiểm tra trực quan: [hồ sơ lưu thật](../artifacts/evidence/P01/android-profile-saved.png), [khách](../artifacts/evidence/P01/android-customer-home.png), [quán](../artifacts/evidence/P01/android-merchant-home.png), [shipper](../artifacts/evidence/P01/android-driver-home.png), [admin](../artifacts/evidence/P01/android-admin-home.png).

## Các lỗi được phát hiện và sửa trong quá trình nghiệm thu

1. **Admin emulator credential:** custom token provider không được Firestore Admin chấp nhận; chuyển sang credential class SDK hỗ trợ và explicit emulator hosts. Đã kiểm chứng bằng transaction Auth/Firestore thật trong Emulator.
2. **Storage upload overwrite:** bổ sung resource==null cho create-only. Reserved download-token metadata được nền tảng xử lý trước Rules, nên không tuyên bố Rules sẽ chặn trường reserved; ứng dụng P01 chưa mở upload/publish UI.
3. **Đổi tài khoản trong retry:** chặn body/idempotency key của A được gửi bằng token B; có regression cho cả trước interceptor và trong token wait.
4. **AsyncStorage 3.x:** dùng removeMany thay API multiRemove cũ; test bằng mock chính thức của phiên bản đã cài và kiểm tra không xóa preference không liên quan.
5. **Seed/profile không cùng schema:** phone rỗng làm API PROFILE_INVALID; dùng null và validate seed qua shared contract. Không thay guard để ép seed đè dữ liệu người dùng.
6. **Đăng ký và tên:** Auth phát sign-in trước updateProfile; thêm registration barrier trước bootstrap, giữ nguyên tính idempotent và không ghi đè profile cũ.
7. **Metro phục vụ bundle cũ:** xác nhận bằng nội dung bundle rồi restart reset-cache khi cần; đây là bước tooling, không sửa dữ liệu để che lỗi runtime.
8. **Đổi mật khẩu và token revocation:** tạo lại authentication time bằng re-auth mật khẩu mới trước khi tiếp tục API; giữ form của cùng tài khoản khi refresh để không mất thông báo hoàn thành. Mọi command vẫn kiểm quyền server, lỗi vẫn xóa UI riêng tư.

## Giới hạn và việc còn lại

- Chưa có Firebase project/native config thật của nhóm; không deploy cloud hoặc bật billing trong phiên này.
- Đã chạy Android Emulator; chưa kiểm tra điện thoại vật lý, iOS hoặc máy phát triển thứ hai của thành viên nhóm.
- Storage MIME/size Rules không xác minh được magic bytes và không tự thu hồi bearer download URL. Media attach/publish hoàn chỉnh phải được triển khai trước khi mở upload ở các phase sau.
- P00 còn FCM/Performance/AI feasibility spikes; P01 không phải bằng chứng hoàn tất chúng.
- Các API catalog/cart/order/voucher/driver/admin nghiệp vụ vẫn theo P02–P06; hai AI theo P07. Fixture COMPLETED không phải kết quả chạy lifecycle.
- Role/active/approval management khi có đơn active phải theo conflict policy ở DATA_MODEL khi đến P04; P01 hiện chỉ có auth/ownership helpers và seed server có quyền.

## Bàn giao

Chạy từ [SETUP_LOCAL](SETUP_LOCAL.md). Đối chiếu checkbox P01/BACKLOG và thử setup trên máy thứ hai trước khi đổi cả phase sang DONE. Tiếp tục các spike P00 còn lại và chuẩn bị P02 catalog theo hợp đồng hiện có; không nhập source hoặc làm lại nền tảng đã có.

Sau nghiệm thu đã dừng API/Metro/Firebase Emulator và AVD do phiên này mở, xóa file mật khẩu demo tạm. Khởi động lại theo SETUP_LOCAL và chọn mật khẩu seed của bạn; không có dịch vụ cloud hoặc demo local tiếp tục chạy từ phiên kiểm thử này.
