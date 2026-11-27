# Kiến trúc mục tiêu — FoodOrderNext

Phiên bản 1.0 · PLAN_ONLY · 2026-11-03. Tài liệu này là thiết kế triển khai, chưa phải mô tả hệ thống đã chạy. Phạm vi, thứ tự phase và trạng thái thực hiện theo [MASTER_PLAN](MASTER_PLAN.md). Tên trường theo [DATA_MODEL](DATA_MODEL.md); hợp đồng theo [API_CONTRACT](API_CONTRACT.md).

## 1. Quyết định nền tảng

Một app React Native cho customer, merchant, driver, admin; một Express backend và một Firestore database nghiệp vụ chính. Seed 1–3 quán trong cùng khu vực. Android là nền tảng nghiệm thu trước.

| Thành phần | Trách nhiệm |
|---|---|
| React Native | UI, navigation theo role, validation tiện dụng, Zustand cho trạng thái UI/giỏ; Firebase client SDK cho auth, đọc/listener có rules, upload ảnh |
| Firebase Auth | Email/password, xác minh email, reset password; Google provider khi cấu hình thực đã sẵn; một nguồn phiên đăng nhập |
| Express + Firebase Admin SDK | Verify ID token, kiểm user active/role/quyền sở hữu, mutation nghiệp vụ, API AI, báo cáo có quyền |
| Firestore | Users, shops/menu, orders/events/chat, cart/favorites, vouchers/counters, reviews công khai đã lọc thông tin, outbox |
| Cloud Storage for Firebase | Ảnh đại diện, món ăn, ảnh đánh giá; path và rules riêng, lưu storagePath vào dữ liệu |
| FCM | Tín hiệu thông báo và deep link; không phải nguồn trạng thái đơn |
| Worker trong cùng package Express | Đọc notificationOutbox, gửi FCM, retry và đánh dấu kết quả; không cần microservice riêng |
| Firebase Performance qua RNFirebase native | Trace thật cho catalog, checkout, order mutation, AI và HTTP; không chỉ đo bằng console.time |
| Maps/location native | Chọn vị trí và tracking foreground theo quyền; không tự điều phối tuyến hoặc GPS nền |
| AI provider phía server | Hai endpoint thật: trợ lý menu và phân tích review; không tự đặt đơn hoặc sửa dữ liệu |

Không triển khai MySQL/SQL Server đồng thời, không dual-write, không dùng Realtime Database thứ hai, không thêm trigger Cloud Functions trùng logic Express. Nếu chọn nền tảng hosting chạy Express trên Google Cloud thì vẫn là cùng một implementation; việc hosting không tự tạo thêm một đường mutation thứ hai. MySQL chỉ có thể là mở rộng báo cáo sau phạm vi chính và cần quyết định riêng.

## 2. Luồng dữ liệu chính

1. App đăng nhập bằng Firebase Auth. Auth observer cập nhật phiên; Axios lấy ID token hiện hành khi gọi API qua HTTPS.
2. App gọi Express cho yêu cầu nghiệp vụ. Server verify token, đọc users/{uid} và quyền shop hiện tại; không lấy quyền từ body hoặc navigation.
3. Server validate, chạy transaction khi có tính nguyên tử, ghi Firestore và outbox. Trả response chuẩn sau commit.
4. Client liên quan nhận document/query snapshot qua listener Firestore có Security Rules. Reconcile bằng statusVersion và ID ổn định; response HTTP và snapshot có thể đến khác thứ tự.
5. Worker gửi FCM sau commit. App mở deep link và đọc dữ liệu có quyền; nội dung push không được quyết định trạng thái.

Tương tác hai chiều được chứng minh ở tầng ứng dụng: khách/quán/tài xế gửi yêu cầu, những bên có quyền nhận thay đổi thật và trả lời bằng yêu cầu tiếp theo. Chat gửi qua POST rồi client LISTEN messages; không tuyên bố cả hai chiều bắt buộc đều là socket write. Cần demo hai thiết bị gửi/nhận và đối chiếu diễn giải PDF trong REQUIREMENTS; nếu giảng viên yêu cầu transport khác thì ghi quyết định thay đổi trước khi sửa.

## 3. Ranh giới API và client SDK

| Dữ liệu/thao tác | Đường đi v1 |
|---|---|
| Đăng ký/đăng nhập/xác minh/reset mật khẩu | Firebase Auth SDK, không giữ JWT tự phát hành cũ |
| Bootstrap profile, cập nhật profile/địa chỉ/cart/favorites/settings | Express; role/active luôn server quản lý |
| Catalog, profile/địa chỉ/cart/favorites của mình | Firestore scoped reads; query/pagination theo DATA_MODEL |
| Lịch sử/chi tiết đơn của khách | Firestore scoped LISTEN/GET; không thêm REST list toàn bộ lịch sử khách trùng chức năng |
| Queue quán, chuyến driver | Firestore query shopId hoặc driverUid đúng quyền; giới hạn và phân trang |
| Tạo/quote/hủy/chuyển trạng thái/gán driver/nhận chuyến/COD | Express; transaction và idempotency |
| Tin nhắn | POST Express để message + outbox nguyên tử; client chỉ LISTEN/GET lịch sử, không direct write |
| Vị trí driver | POST Express; listener document nhỏ riêng cho các bên khi DELIVERING |
| CRUD menu/voucher, quản trị user/role/active, review, báo cáo, AI | Express |
| Upload binary ảnh | Storage SDK theo rules; attach storagePath bằng API xác thực sau upload |
| Inbox notifications | Firestore scoped reads; mark-read qua API |

V1 chủ động cho mọi Firestore writes từ mobile đi qua Express để giảm hai nơi triển khai cùng quy tắc. Firestore client rules chặn writes; Storage uploads là ngoại lệ có rules loại ảnh/kích thước/path/quyền. Nếu sau này cần direct write cho trường rủi ro thấp, phải cập nhật contract, field allowlist và tests trước; không mở allow write theo role chung.

## 4. Xác thực và phân quyền

- UID Firebase là khóa chủ thể; ID người dùng SQL cũ chỉ là legacyUserId phục vụ mapping.
- Tài khoản tự đăng ký mặc định customer. Bootstrap admin là thao tác server có kiểm soát; người dùng không tự gửi role để nâng quyền.
- users/{uid}.role và active là authority hiện hành. Không dựa duy nhất vào custom claims cũ. API kiểm active/role mỗi mutation; rules dùng users document tương ứng để kiểm quyền đọc.
- Merchant phải active và là shops/{shopId}.ownerUid. Admin active có quyền quản trị theo endpoint; mọi thay role/active phải có audit event tối giản.
- Driver phải active, được duyệt trong shops/{shopId}/drivers/{uid}, và được merchant/admin gán vào đơn. Không có feed công khai đơn chưa nhận chứa địa chỉ.
- Driver đã gán có thể đọc đơn được giao; assignmentStatus=ACCEPTED mới đủ điều kiện chat như driver và bắt đầu giao. V1 chỉ reassign khi assignment còn ASSIGNED; assignment đã ACCEPTED bị khóa, không silently đổi driver đang nhận chuyến. Người bị thay assignment mất quyền mới theo rules/API hiện tại; dữ liệu đã đọc/cache cần quản lý theo tài khoản.
- Admin đổi role/active hoặc shop ownerUid phải trả 409 ACTIVE_ORDER_CONFLICT khi user/shop còn active order. users.activeOrderCount và shops.activeOrderCount được cập nhật nguyên tử với tạo/assignment/terminal để chặn race, không query lịch sử rồi thay quyền ngoài transaction. Không khóa admin cuối cùng; registry admin private kiểm trong cùng transaction.
- Firebase Auth và Firestore profile không có transaction chung: bootstrap profile phải idempotent và tự phục hồi khi Auth thành công nhưng profile chưa tạo.
- Logout tháo toàn bộ listeners, xóa UI/cache thuộc tài khoản, bỏ liên kết device token bằng server trước khi signOut khi có mạng; lần đăng nhập sau phải rebind token đúng UID. Không để giỏ/địa chỉ/tin nhắn người trước xuất hiện.
- Admin SDK bỏ qua Firestore Security Rules. Vì vậy test rules không thay cho test API authorization. Server kiểm lại ownership và trạng thái ngay trong transaction khi có race.

## 5. Order engine và tiền

Một giỏ chỉ một shop, tối đa 20 dòng; quantity là số nguyên dương với mức tối đa v1 được validation cùng client/server. Stock là số suất món nguyên, không quản lý nguyên liệu/phương án kho phức tạp. Tiền dùng VND số nguyên; không phép tính float phần trăm tùy tiện.

Luồng chuẩn: PENDING → ACCEPTED → PREPARING → READY_FOR_PICKUP → DELIVERING → COMPLETED. Customer chỉ hủy PENDING thành CANCELLED; merchant chỉ từ chối PENDING thành REJECTED. COMPLETED, CANCELLED, REJECTED là terminal. Không có PICKED_UP hoặc tự chuyển đơn bằng timer.

Tạo PENDING phải reserve stock/quota voucher trong cùng transaction với order, event, idempotency result, outbox. Lưu snapshot tên/đơn giá/món/options/address và breakdown phí/giảm/tổng. Client gửi IDs và số lượng; quote chỉ là preview, create tính lại và yêu cầu xác nhận nếu tổng hiện hành khác expectedGrandTotalVnd.

Cancel/reject hợp lệ release reservation đúng một lần và ghi event/outbox trong transaction. Per-user voucher counter nằm ở document xác định theo voucher+uid để chặn đồng thời vượt limit; không đếm lịch sử bằng query rồi mới ghi. Không tự expire PENDING v1; đơn demo bị bỏ quên phải được customer hủy hoặc merchant reject qua thao tác hợp lệ, có log. Nếu thêm expiry cần state/reservation/worker/tests riêng.

Assignment tách khỏi order status: merchant/admin gán driver được duyệt → ASSIGNED; đúng driver xác nhận → ACCEPTED. READY_FOR_PICKUP → DELIVERING chỉ bởi driver được gán đã ACCEPTED. Driver hoàn tất phải đồng thời xác nhận số COD đã thu đúng amountDueVnd và ghi paymentStatus=COD_CONFIRMED; không có trạng thái COMPLETED mà thiếu xác nhận COD trong luồng v1.

Mọi transaction đọc trước khi ghi và có thể được retry. Không gửi FCM/gọi AI/maps/payment hoặc thay UI bên trong callback transaction. Cần version/expectedStatusVersion, key ổn định và payload fingerprint; không dựa vào disable nút để chống trùng.

## 6. Chat, outbox và FCM

- Chat text tối đa theo API_CONTRACT, thuộc order, sender được server suy từ token. Chỉ participants hiện hành và active được đọc; chỉ gửi khi order chưa terminal. Khách và merchant gửi hai chiều; driver sau khi nhận assignment có thể tham gia.
- Express lưu tin nhắn, hộp thư người nhận và outbox cùng một transaction. Listener hiển thị tin đã lưu. Tin gửi lỗi giữ clientMessageId và idempotency key để thử lại.
- Outbox có eventId ổn định, recipients, type, status, attempts và nextAttemptAt. Worker giữ lease trong Firestore, gửi push sau commit và ghi kết quả theo lease hiện hành. Local ghi SKIPPED với mã FCM_DISABLED. Xem [báo cáo kiểm thử P05](PHASE05_REPORT.md).
- Crash sau send trước mark có thể gây gửi lại. App dedup bằng eventId; chỉ hứa nghiệp vụ đúng một lần, không hứa FCM exactly-once. Inbox có cùng eventId để không trùng bản ghi.
- Token FCM được cập nhật khi refresh, đăng nhập/đăng xuất và khi quyền thông báo thay đổi; loại token invalid. Push ghi nội dung tối giản, không địa chỉ/GPS/phone; nhấn mở app rồi xác thực và đọc order.
- Permission denied, FCM lỗi hoặc AI lỗi không được rollback đơn đã commit. Realtime/inbox vẫn phản ánh nguồn dữ liệu thật.

## 7. GPS và quyền riêng tư

- Chọn địa chỉ khách cho phép GPS có xin quyền đúng lúc; từ chối quyền vẫn nhập/chọn pin thủ công được.
- Android lấy vị trí chính xác khi tài xế đã nhận chuyến, đơn đang giao và màn chuyến đang mở. Vào nền hoặc rời màn hình hủy lượt lấy vị trí và dừng gửi mới.
- Chỉ lưu vị trí mới nhất trong orders/{id}/deliveryTracking/current. Express kiểm tra driver, phiên phân công, thứ tự, độ tuổi, sai số và khoảng cách trước khi ghi.
- Customer, merchant chủ shop, driver được gán và admin active chỉ đọc tracking khi DELIVERING. Kết thúc chuyến làm rule mất quyền live tracking, dừng native updates/listeners; xóa tracking bằng thao tác server cùng hoàn tất/hủy nếu document có tồn tại. Không giữ lại dữ liệu hành trình cho mục tiêu không có trong đồ án.
- UI hiển thị thời điểm máy chủ nhận và sai số thiết bị báo. Sau 60 giây hoặc khi Firestore báo cache, vị trí gần nhất chuyển sang trạng thái cũ.
- Sơ đồ tọa độ nội bộ hiển thị các điểm theo tỷ lệ và hướng bắc. Tọa độ theo dõi đi giữa app, Express và Firebase.

## 8. Hai AI bắt buộc

AI menu: backend lấy candidate menu có thật, active/còn stock đúng shop, giới hạn dữ liệu và budget. Model trả JSON theo schema; server kiểm IDs/options/prices/tổng/ngân sách. Kết quả chỉ gợi ý để khách xác nhận thêm giỏ; không gọi create order thay khách.

AI review insights: chỉ merchant chủ shop/admin, reviews verified từ đơn COMPLETED trong interval; trả themes/sentiment/summary và evidence review IDs. Server xác nhận evidence thuộc input, không thêm review/quote bịa. Cache theo shop+interval+input version; không gửi UID, địa chỉ, phone hoặc GPS sang model.

Hai endpoint đều có giới hạn request/token/time/cost, structured validation và deterministic fallback gắn nhãn. Phải có bằng chứng model thật chạy thành công cho từng use case; fallback không được ghi là AI thành công. Text người dùng/review là dữ liệu không tin cậy, không cho phép instruction trong đó tạo quyền/tool/write action.

## 9. Tổ chức mã và môi trường khi triển khai

Source sau import đã lọc nằm ở apps/mobile và services/api; giữ internals/components phù hợp từ FoodOrderingApp và BackendAPI cũ. Mobile tách adapters API/Firebase, feature hooks và stores; tránh listener nằm rải rác không cleanup. Backend tách routes/controllers/services/repositories/middleware/worker; mutation dùng shared authorization và validation. Không cần áp dụng đầy đủ framework mới hoặc đổi toàn bộ JS sang TS để đạt scope.

Các placeholder cấu hình trong kế hoạch: FIREBASE_PROJECT_ID, API_BASE_URL, FIREBASE_SERVICE_CREDENTIAL_SOURCE, AI_PROVIDER, AI_MODEL, AI_API_KEY, MAPS_KEY_RESTRICTED, ENV_NAME. Đây là tên chưa có giá trị; không tạo file credential hoặc runnable config trong bộ kế hoạch.

P00 xác minh RN khai báo 0.86.0 với native Firebase Auth/Firestore/FCM/Storage/Performance/maps trên thiết bị; chọn và lock phiên bản sau spike. Emulator Suite dùng Auth/Firestore/Storage/rules/transaction tests. FCM, Performance dashboard, maps và model thực cần staging/thiết bị và tài khoản dịch vụ thật; emulator không thay bằng chứng native đó.

## 10. Tải, quan sát và nghiệm thu

- Dataset tổng hợp đề xuất 1.000 menuItems và 10.000 orders; ghi rõ số lượng từng collection, phân bố shop/user/status/time, seed version. Không gọi đây là 10.000 người dùng đồng thời.
- Catalog/history dùng limit/cursor/index; search chỉ prefix chuẩn hóa với tổ hợp hỗ trợ đã spike, không giả Firestore là SQL LIKE/full-text. Không tải toàn bộ catalog để lọc client.
- Listener chỉ mở màn có nhu cầu, giới hạn active set, cleanup khi blur/logout. UI dùng FlatList/pagination/image resize/cache; không giữ listener 10.000 đơn.
- Đo cùng thiết bị/build/mạng/dataset trước/sau; ghi p50/p95/sample size/read counts hoặc proxy có giới hạn. Mục tiêu nội bộ chưa đo không được ghi là đạt.
- Performance trace có tên cố định ít cardinality; không attribute UID, address, token, prompt hoặc review text. HTTP errors dùng traceId không lộ stack/secret.
- Acceptance bắt buộc: giá client bị sửa; stock cuối tranh nhau; retry cùng key; hủy/reject lặp; sai owner/shop/assignment; role/active bị sửa; chat duplicate/offline; GPS stale/denied; AI invalid IDs/evidence; build sạch máy thứ hai.

## 11. Nguồn đối chiếu

- Baseline code đã đọc, chưa xác nhận runtime: [repository commit 1bc4eab](https://github.com/DangTheNhan/foodOrder_Mobile/tree/1bc4eabed01d1b975a60cf8e66396888a4538b07).
- Firebase: [verify ID token](https://firebase.google.com/docs/auth/admin/verify-id-tokens), [Security Rules và server bypass](https://firebase.google.com/docs/firestore/security/rules-conditions), [transactions](https://firebase.google.com/docs/firestore/manage-data/transactions), [listeners](https://firebase.google.com/docs/firestore/query-data/listen).
- Native/media: [Storage Security](https://firebase.google.com/docs/storage/security), [FCM token management](https://firebase.google.com/docs/cloud-messaging/manage-tokens), [RNFirebase Performance](https://rnfirebase.io/perf/usage).

Các lựa chọn nghiệp vụ trong tài liệu là thiết kế của nhóm cho scope v1; link nền tảng không có nghĩa chức năng đã được triển khai hoặc đã vượt kiểm thử.
