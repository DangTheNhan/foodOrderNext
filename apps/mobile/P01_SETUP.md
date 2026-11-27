# Mobile P01: Firebase Auth và hồ sơ

Phần đã có source: email/password register/login, xác minh email, reset password, đổi mật khẩu có re-auth, khôi phục native Firebase session, bootstrap customer qua Express, tải `/me`, listen profile đúng UID, fail-closed khi role/active không hợp lệ, sửa tên/điện thoại qua API và logout/đổi tài khoản dọn state riêng tư.

Đây là lát cắt P01. Customer/merchant/driver/admin hiện có landing theo role và hồ sơ/bảo mật. Catalog, checkout, merchant operations, driver tracking, chat, push và AI thuộc phase sau, chưa được đưa vào navigation. Các file UI cũ vẫn được giữ để tái sử dụng; adapter từ chối endpoint SQL-era khi vô tình gọi chúng. Không có JWT legacy hoặc `/auth/refresh` trong đường chạy mới.

## Cấu hình local an toàn

1. Từ root FoodOrderNext, cài/chạy API và Firebase emulators theo README root. Project ID phải là `demo-foodordernext`; mặc định Auth9099, Firestore8080, API5000.
2. Tại `apps/mobile`, dùng phiên bản Node theo package.json, chạy `npm ci`. Các package app/auth/firestore được pin đồng bộ RNFirebase26.4.1. Android dùng New Architecture và minSdk24 từ baseline; kiểm tra native build trước khi coi tương thích đã được xác nhận.
3. `src/config/runtime.config.js` mặc định import cấu hình demo từ file example. Android emulator truy cập máy host bằng `10.0.2.2`; API là `http://10.0.2.2:5000/api/v1`. iOS simulator default localhost nhưng iOS chưa được nghiệm thu trong P01 Android.
4. Chỉ debug có `android/app/src/debug/google-services.json`. Đây là giá trị công khai **tổng hợp, emulator-only**, không thuộc Firebase project cloud thật. Không đổi project sang cloud mà vẫn giữ demo config.
5. Điện thoại thật cần `emulatorHost` là địa chỉ LAN của máy chạy emulator; API/emulators phải bind đúng LAN và firewall/network được cấu hình phù hợp. Không mở emulator không bảo vệ ra Internet. Để mặc định khi chỉ dùng Android emulator.
6. Chạy Metro `npm start`; chạy debug Android `npm run android` theo SDK/JDK đã cấu hình. Application ID mới là `com.foodordernext.app`, không ghi đè app cũ `com.foodorderingapp.app`.
7. Với email verification/reset local: mở liên kết do Auth Emulator in trong log/Emulator UI trên máy host. Sau xác minh, quay lại app và bấm **Tôi đã xác minh, kiểm tra lại**; app reload user và force-refresh Firebase ID token cho claim `email_verified` mới.

Native Auth tự quản lý persistence. App không lưu ID token vào AsyncStorage; API lấy token từ Firebase cho từng request và chỉ force refresh/retry401 một lần. Firestore P01 dùng `persistence:false`, profile authority cache không được dùng để cấp quyền. Mọi Firestore mutation qua Express; client SDK chỉ listen/read hồ sơ theo Rules.

## Staging/release

- Cần Firebase project thật, Android app `com.foodordernext.app`, Google client config tương ứng và API HTTPS `/api/v1`.
- Cung cấp `android/app/src/release/google-services.json` cục bộ (gitignored), đổi `runtime.config.js` sang environment staging, projectId thật, API HTTPS và không có emulatorHost. Native projectId và JS projectId phải trùng.
- Gradle release từ chối config bị thiếu hoặc `demo-`; runtime từ chối emulator trong release. Không sao chép demo Google config thành staging.
- Không đưa Firebase Admin key, service account, AI API key hay token vào mobile. Firebase client config công khai không thay thế backend credentials.
- Google login chưa nối vì chưa có OAuth/SHA cấu hình của dự án mới. UI không hiển thị nút Google không hoạt động.
- Chưa tích hợp avatar upload/attach trong form P01; không cho nhập arbitrary avatar URL/path. Server vẫn là nơi kiểm soát allowlist và quyền attach media khi bổ sung Storage slice.
- FCM/Performance/GPS không được gọi là đã kiểm thử chỉ vì native Firebase app/auth/firestore đã cài.

## Kiểm tra

`npm test -- --runInBand` chạy unit với Firebase native được mock, gồm session role/verification, logout/account-switch race, stale authority, token refresh, error envelope, idempotency retry và password re-auth. Đây **không** là bằng chứng Firebase native hoặc end-to-end đã chạy.

Kiểm tra lint source P01: `npx eslint App.js src/config src/firebase src/api/clientCore.js src/api/axiosClient.js src/auth src/services/AuthService.js src/services/ProfileService.js src/stores/authStore.js src/screens/P01 src/navigation/PhaseOneNavigator.jsx __tests__`.

Hành vi cần nghiệm thu trên emulator/thiết bị: đăng ký → xác minh → landing đúng customer; logout/login/khởi động lại; reset và đổi password; edit profile có server persistence; seeded role landing; revoke active/role; lỗi mạng/profile bootstrap; request API đúng token; không thấy dữ liệu user cũ. Checklist cụ thể ở `tests/e2e/P01-MANUAL.md` từ root.

Root quản lý kết quả native build/emulator và bằng chứng P01. Chỉ ghi nhận pass khi có log/video thực, không suy kết quả từ số file hoặc unit tests.
