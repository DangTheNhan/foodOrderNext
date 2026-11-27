# Firebase local — P01

Project mặc định là demo-foodordernext. firebase.json bind Auth 9099, Firestore 8080, Storage 9199 và UI 4000 vào 127.0.0.1. Các file này chuẩn bị emulator; chưa triển khai Firebase cloud.

## Quyền đọc và ghi

- Mọi client Firestore create/update/delete bị từ chối, kể cả admin. Express dùng Admin SDK nên phải kiểm quyền riêng.
- users.role/active hiện hành là authority, không dùng role/custom claim client để bỏ qua kiểm tra. Thiếu profile hoặc inactive bị từ chối private reads.
- Profile/addresses/favorites/carts/notifications chỉ chính mình active; devices, audits, counters, registry, operations, outbox, caches và seed manifest không client-readable.
- Public catalog chỉ dữ liệu active; món còn yêu cầu quán active. Merchant đọc được menu/quán ẩn của mình, admin đọc catalog quản trị.
- Order/events cho customer owner, merchant owner hiện hành, driver active có driverUid khớp hoặc admin. Driver query chỉ cần driverUid; không có public jobs feed. Approval được server kiểm khi phân công và mutation. API quản trị sau này phải chặn thay role/active/approval làm đứt active assignment theo conflict policy.
- Driver đọc chat khi assignmentStatus ACCEPTED; customer/quán/admin đọc lịch sử có quyền kể cả terminal. Chỉ server được gửi message và phải khóa gửi terminal.
- Tracking chỉ GET current khi DELIVERING và còn quyền participant; không cho list route history.
- Review public phải sanitized và verifiedCompletedOrder. Rules không lọc field: backend/seed không được ghi UID/email/phone/orderId/địa chỉ/thanh toán vào review public.

Các query có limit/cursor theo DATA_MODEL. Rules không biến query rộng thành bộ lọc: query catalog phải active và shop scope, order phải customerUid/shopId/driverUid đúng principal. Indexes trong source là cấu hình ban đầu cho query đã chỉ định; emulator không chứng minh index đã được deploy hay hiệu năng cloud.

## Storage pending và attach

Client chỉ CREATE ảnh mới JPEG/PNG/WebP, 0 < size ≤ 5 MiB, user active và email_verified. Metadata upload phải đúng hai khóa ownerUid và state=pending. Avatar đúng UID; menu đúng merchant owner; review đúng customer có COMPLETED và COD_CONFIRMED. Không client overwrite/update/delete/list.

Pending owner được đọc riêng; chỉ backend publish sau kiểm tra path, metadata, loại ảnh thực và reference:
- Avatar published vẫn private, chỉ owner và reference users.avatarPath khớp.
- Menu published public khi metadata foodId trỏ đúng menu active, quán active và imagePath khớp object.
- Review published public khi metadata reviewId khớp order.reviewId, review verified và imagePaths chứa đúng path.

Server attach phải kiểm MIME thực/magic bytes; Rules chỉ kiểm metadata, không decode ảnh. Publish/attach khác dịch vụ không atomic: retry và cleanup orphan theo phạm vi cần được triển khai trước tính năng media hoàn chỉnh.

Không ghi URL có Firebase download token vào Firestore/DTO/log. Dùng storagePath và authenticated SDK download. Token download URLs là bearer links, không thực thi lại Rules; Rules không thể thu hồi token đã phát. Firebase Storage xử lý reserved field firebaseStorageDownloadTokens trước khi đánh giá application metadata: không được hứa Rules sẽ từ chối trường reserved này. Backend attach/publish phải loại/revoke token và không phát signed/token URL cho pending/private object. State published và metadata ứng dụng ngoài allowlist vẫn bị chặn. P01 chưa cung cấp luồng upload/publish ảnh trên app; phải kiểm chứng token lifecycle trước khi bật media ở các phase sau. Nếu sau này dùng public CDN cần chính sách riêng.

## Chạy kiểm tra local

Từ root, sau khi cài dependency theo hướng dẫn chung:

1. Khởi động emulator bằng npm run emulators.
2. Cấp FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 và FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199 cho tiến trình test.
3. Chạy node --test --test-concurrency=1 tests/rules/*.test.mjs.

Firestore Rules tests dùng demo project suffix riêng. Storage Rules tests phải dùng project demo-foodordernext giống CLI vì cross-service firestore.get của Storage emulator tra project đó; chúng clear fixture Firestore trong project local. Root runner chạy các file Rules/integration serial; seed/demo phải chạy trong phiên riêng sau đó. Không chạy tests cùng phiên demo đang dùng. Emulator có thể cảnh báo singleProjectMode cho suffix; không có truy cập cloud. Chỉ emulator được phép làm fixture/clear data.

Nguồn chính thức: [Firestore query rules](https://firebase.google.com/docs/firestore/security/rules-query), [unit tests](https://firebase.google.com/docs/rules/unit-tests), [Storage conditions](https://firebase.google.com/docs/storage/security/rules-conditions). Test emulator không thay native device FCM/Performance nghiệm thu.
