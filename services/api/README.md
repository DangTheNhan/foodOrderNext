# FoodOrderNext API

ES modules, Node 22+, Express và Firebase Admin. Ngoài hồ sơ, đơn COD, quản lý quán, chat, thông báo và GPS, P07 có hai API AI qua Ollama local. Xem [hợp đồng API](../../docs/API_CONTRACT.md) và [cách chạy AI](../../docs/SETUP_LOCAL.md#chạy-hai-tính-năng-ai).

## Chạy local

Từ root FoodOrderNext, cài workspace dependencies bằng hướng dẫn root. Khởi động Firebase Auth9099, Firestore8080 và Storage9199 emulators với project demo-foodordernext trước khi gọi API. Từ root: npm run start --workspace @foodordernext/api; dev dùng npm run dev --workspace @foodordernext/api. Cấu hình mẫu ở services/api/.env.example; không cần copy nếu dùng toàn bộ defaults. File .env được dotenv đọc từ working directory workspace, không từ home.

API mặc định bind127.0.0.1:5000. Android emulator gọi http://10.0.2.2:5000; Firebase host addresses trong backend vẫn127.0.0.1. Máy thật cần API_BIND_HOST=0.0.0.0 và cấu hình LAN/firewall có chủ đích; không tự public service.

Emulator mode là mặc định, chỉ chấp nhận demo- project và loopback host:port; không scheme hoặc remote host. GOOGLE_APPLICATION_CREDENTIALS/service-account/ADC bị từ chối trong emulator mode. Credential emulator là token owner giả chỉ có giá trị local; không có bypass verifier trong server runtime.

Cloud mode không tự bật: cần FIREBASE_MODE=production, ALLOW_PRODUCTION_FIREBASE=true, project thật và lựa chọn explicit FIREBASE_SERVICE_ACCOUNT_PATH hoặc FIREBASE_USE_APPLICATION_DEFAULT_CREDENTIALS=true. Không được có emulator env. Đây là đường cấu hình có guard, chưa được deploy/cloud-test trong P01. Không đặt service-account file/key vào repo. Startup từ chối cấu hình sai, không dump credential/error file contents.

## Endpoints hiện có

- GET /health: liveness process, không chứng minh Firestore/FCM/model sẵn sàng.
- POST /api/v1/me/bootstrap: Firebase ID token; body {} hoặc {displayName}; tạo customer/active=true khi thiếu, idempotent theo UID, không đổi profile đã có. Lần tạo201, retry200. Tài khoản chưa verified được bootstrap; tài khoản inactive không được re-activate.
- GET /api/v1/me: Firebase ID token + profile active; cho unverified đọc màn xác minh. Role/active lấy Firestore hiện hành, bỏ qua role claim tự khai.
- PATCH /api/v1/me: active + verified; body displayName/phone/avatarPath allowlist, unknown/protected fields422. Idempotency-Key16–128 ký tự bắt buộc; cùng body retry không ghi lại, khác body409. Avatar phải thuộc users/{uid}/avatars/{assetId}, tồn tại ở Storage và đúng image type/size. Nullable avatarPath/phone cho clear. Publish media công khai/UI avatar thuộc lát cắt media sau, không giả đã hoàn tất ở đây.

Success envelope: data=profile trực tiếp, meta={traceId,apiVersion,...}; error={code,message,details?} và meta.traceId. Profile DTO có uid, displayName, emailDisplay, phone, avatarPath, role, active, activeOrderCount, defaultAddressId, settings, emailVerified, createdAt/updatedAt ISO. Không export raw persistence metadata/seed markers. emailVerified lấy token đã verify; sau xác minh email app phải refresh token. Body không nhận actorUid/customerUid/role/active.

Bootstrap không cần Idempotency-Key vì unique theo UID/transaction. PATCH lưu operation fingerprint nguyên tử, trả resource projection hiện hành khi replay để không phục hồi role/active snapshot đã cũ. Idempotency record không chứa token/key raw và chưa cleanup tự động.

Các helpers requireRoles/assertShopOwner/assertAssignedDriver có sẵn để dùng pha sau, không mở endpoint admin/driver giả. Admin SDK bỏ qua Rules, vì vậy API tự kiểm active/owner; mutation cần read lại authority trong transaction. Rules là biên client độc lập.

## Kiểm thử

- npm test --workspace @foodordernext/api: node:test + supertest injection cho auth, profile, bootstrap retry, protected fields, idempotency, media ownership, errors và config guards.
- npm test --workspace @foodordernext/contracts: constants, strict input, VND/quantity/cart limits và name normalization.
- Integration thật ở tests/integration/api-auth.emulator.test.js, mặc định SKIP. Chạy từ root với RUN_EMULATOR_TESTS=1 và node --test tests/integration/api-auth.emulator.test.js khi emulators local đã chạy. Test tạo account/document namespace riêng và chỉ cleanup records của chính test; không reset toàn project.
- Fake verifier/repository chỉ xuất hiện trong tests qua dependency injection. Chúng không chứng minh Firebase transaction race; integration emulator mới kiểm điều đó. Server entry luôn dùng Firebase Admin verifier thật (bao gồm revoke check).

Chưa kiểm cloud credentials/native device từ API tests. Không coi suite P01 là nghiệm thu toàn phase/app. Firebase references: [ID tokens](https://firebase.google.com/docs/auth/admin/verify-id-tokens), [Auth emulator](https://firebase.google.com/docs/emulator-suite/connect_auth), [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions).
