# Kế hoạch chuyển dự án cũ — FoodOrderNext

Phiên bản 1.0 · PLAN_ONLY · Chưa clone/import source vào cây implementation, chưa cài dependency, tạo cloud resource, seed hoặc deploy trong bộ kế hoạch này. Trạng thái tiến độ ở [MASTER_PLAN](MASTER_PLAN.md) và PROGRESS.md; đây là hướng dẫn thực hiện về sau.

## 1. Nguồn và đích

Nguồn đã review read-only: [DangTheNhan/foodOrder_Mobile tại commit 1bc4eabed01d1b975a60cf8e66396888a4538b07](https://github.com/DangTheNhan/foodOrder_Mobile/tree/1bc4eabed01d1b975a60cf8e66396888a4538b07). Review code không chứng minh app hiện chạy được trên máy nhóm.

| Nguồn cũ | Đích dự kiến | Quyết định |
|---|---|---|
| FoodOrderingApp | apps/mobile | Giữ internals UI/theme/navigation phù hợp; refactor service/auth/listeners |
| BackendAPI | services/api | Giữ Express, cấu trúc endpoint được chuẩn hóa /api/v1; thay data/auth/business services |
| mssql + SQL schema/backup | Firestore chính | Chuyển schema/data có kiểm soát; không copy backup chứa dữ liệu cá nhân vào Git |
| JWT tự ký + OTP riêng | Firebase Auth | Một phiên duy nhất; verify Firebase ID token trong API |
| Zustand RAM cart/favorite | UI state + Firestore qua API | Hydrate theo UID, không để lẫn dữ liệu tài khoản |
| Tracking/notification/payment giả | Luồng thực trong phases | Không đếm UI placeholder là feature hoàn thành |

Không copy node_modules, build outputs, service credentials, .env có giá trị, private signing keys hoặc lịch sử cá nhân. Google public client IDs/API config không thay được authorization; restricted public keys và service secrets phải được phân loại rõ trong setup sau này.

## 2. Những phát hiện baseline cần giữ trong backlog

- Database hiện là SQL Server qua mssql, không phải MySQL. [db.js](https://github.com/DangTheNhan/foodOrder_Mobile/blob/1bc4eabed01d1b975a60cf8e66396888a4538b07/BackendAPI/db.js#L1)
- Tạo đơn nhận total_price/sub_total từ client; status endpoint chưa kiểm role/owner/transition đầy đủ. [orders.js](https://github.com/DangTheNhan/foodOrder_Mobile/blob/1bc4eabed01d1b975a60cf8e66396888a4538b07/BackendAPI/routes/orders.js#L125)
- Tracking có MOCK_COURIER, MOCK_ESTIMATED_TIME và CURRENT_STEP_INDEX cố định. [TrackOrderScreen](https://github.com/DangTheNhan/foodOrder_Mobile/blob/1bc4eabed01d1b975a60cf8e66396888a4538b07/FoodOrderingApp/src/screens/Cart/TrackOrderScreen.jsx#L14)
- PaymentScreen chọn phương thức rồi gọi create order; chưa chứng minh cổng thanh toán. Luồng mới core COD, không giữ chọn card giả thành thanh toán thành công.
- Recommendation backend ORDER BY NEWID() là ngẫu nhiên, chưa phải AI. [foods.js](https://github.com/DangTheNhan/foodOrder_Mobile/blob/1bc4eabed01d1b975a60cf8e66396888a4538b07/BackendAPI/routes/foods.js#L41)
- Cart/favorites chưa persist; cart có thể trộn shop nhưng checkout lấy shop của món đầu. Reorder Coming Soon; notifications/settings có placeholder.
- RN khai báo 0.86.0; không lấy badge/version khai báo làm bằng chứng native Firebase/maps/perf đã tương thích. [package.json](https://github.com/DangTheNhan/foodOrder_Mobile/blob/1bc4eabed01d1b975a60cf8e66396888a4538b07/FoodOrderingApp/package.json)

## 3. P00 — Import có kiểm soát và spike nền tảng

1. Ghi commit nguồn chính xác, license/attribution và repository status trước import; không ghi đè workspace/source đang có thay đổi chưa hiểu.
2. Đưa source đã lọc vào apps/mobile và services/api, giữ lịch sử nguồn/manifest mapping. Chưa refactor hàng loạt UI và database cùng một commit.
3. Kiểm scripts/dependencies/native config read-only trước khi chạy. Xác nhận Node/JDK/Android SDK/Gradle theo dependency thực; không hard-pin phiên bản đoán trong kế hoạch.
4. Build Android baseline trên máy A và một máy khác; lưu error/fix/commit. Nếu build baseline không qua, giải quyết trước khi thêm features.
5. Spike native Firebase Auth → Express verify token; hai client listener; Storage upload; FCM token/push; Performance trace native; location/maps foreground; một model request từ backend cho mỗi AI use case.
6. Spike Firestore prefix search/nameKey, category và price query modes/indexes; ghi rõ tổ hợp hỗ trợ. Không giả chuyển SQL LIKE thành contains query Firestore.
7. Chọn, pin/lock dependency versions sau spike. Giữ thay dependency/native config thành commits nhỏ, không nâng toàn bộ framework chỉ vì bản mới tồn tại.

Gate: môi trường và điểm khả thi được chứng minh hoặc có quyết định scope/giải pháp rõ; evidence ở artifacts/evidence/P00/<task-id>/. Không đánh DONE bằng việc chỉ tạo Firebase project/config.

## 4. P01 — Firebase Auth và quyền

Default đồ án: tạo tài khoản Firebase demo mới, không import tài khoản/người dùng thật từ SQL. Có bốn role giả; user tự đăng ký mặc định customer. Admin bootstrap bằng quy trình server ngoài public register, có audit/manifest; merchant/driver được admin cấp và shop owner/driver approval được seed có kiểm soát.

Các bước auth:

1. Auth observer thay check userToken AsyncStorage. Khi restart app, chờ Firebase resolve phiên trước navigation; không tự coi token cũ là phiên hợp lệ.
2. Register/login/email verification/reset password dùng Firebase SDK. Không giữ route legacy phát JWT hoặc OTP song song; UI kiểm tra email verification thật.
3. Axios token adapter lấy ID token hiện hành khi gửi, backend Firebase Admin verify và lấy UID. Retry auth có giới hạn; không tạo vòng lặp 401/refresh vô hạn.
4. POST /api/v1/me/bootstrap idempotent theo UID để tạo profile customer; một Auth account có thể tạm thiếu profile và được sửa qua retry. Client không tự truyền role/active.
5. users.active/role và shops.ownerUid là authority hiện hành; API và Rules kiểm cả active/quyền. Việc khóa/đổi role/owner có active-order conflict policy, không bỏ driver đang giao giữa chừng.
6. Logout tháo listeners, xóa UI/account state, unregister/rebind device token đúng cách; không để cart/chat/địa chỉ của user A hiện khi B đăng nhập.
7. Tests: người chưa verified, inactive, profile missing, token invalid, role tampering, owner khác shop, driver chưa gán, mất mạng giữa Auth và bootstrap.

Không commit raw token/account credential vào evidence. Thiết bị demo có tài khoản giả; mật khẩu seed không đưa vào public repository, hướng dẫn cấp local qua placeholder khi triển khai.

## 5. Nhánh tùy chọn: giữ user production cũ

Chỉ làm khi sau này có nhu cầu thực giữ account; không chặn đồ án demo. Phải inventory dữ liệu/provider và có quyết định migration riêng.

- Firebase Admin có hỗ trợ import BCRYPT; không kết luận mọi mật khẩu bắt buộc reset. Xác minh thuật toán/encoding/config thực của bcryptjs đang lưu, thử account mẫu known-password ở môi trường riêng rồi mới bulk import. Không bao giờ giải mã hoặc yêu cầu plaintext password của người dùng.
- Tạo mapping legacyUserId → Firebase uid ổn định, có uniqueness và manifest bảo mật. Import email normalized, verified flag có căn cứ; không tự đánh verified cho account cũ chưa xác minh.
- Google login legacy gộp email; Firebase provider identity cần provider UID/linking chính xác. Email trùng không tự chứng minh quyền merge hai identities; xử lý link qua flow verified/re-auth phù hợp.
- Không đưa password hashes/OTP/secret vào Firestore hoặc log. Dữ liệu export nếu có phải nằm vị trí bảo mật được phép, không artifacts/evidence công khai.
- Nếu import hash/provider không tương thích, chọn password reset/linking có kiểm soát và ghi rõ tác động; không giữ authentication server cũ như đường vòng vĩnh viễn.
- Kiểm từng batch import errors; rerun không tạo duplicate users. So sánh số account, UID mapping và sample login; không rollback Auth production bằng xóa hàng loạt tùy tiện.

Nguồn: [Firebase import users/BCRYPT](https://firebase.google.com/docs/auth/admin/import-users), [verify ID tokens](https://firebase.google.com/docs/auth/admin/verify-id-tokens).

## 6. Schema và seed Firestore

1. Chốt DATA_MODEL v1 trước seed: VND integer, exact uppercase states, statusVersion/assignmentVersion, stock/voucher reservation, public/private separation.
2. Dựng repository/service adapter Firestore phía server; không thay mỗi mssql import mà để nguyên SQL syntax/business assumptions.
3. Seed demo mới với deterministic IDs/seedVersion, 1–3 shops/ownerUid, driver approval, categories, menu portions, vouchers/counters, roles giả; dữ liệu cá nhân/location đều tổng hợp.
4. Seed dry-run in-memory/report trước ghi; khi viết script về sau phải có project/env guard, allowlist collection/dataset và confirmation phù hợp cho reset cloud. Không thêm script xóa toàn project bằng default.
5. Rules deny-by-default, all client Firestore writes deny trong v1; direct reads có user active/role/shop/assignment scope. Storage uploads là ngoại lệ có field/path/content constraints. Test Rules và API riêng vì Admin bypass Rules.
6. Indexes theo query allowlist. Ghi cấu hình vào version control khi implementation, kiểm trên emulator/staging; không chỉ bấm console rồi quên source.
7. Seed 1.000 menuItems và 10.000 synthetic orders cho workload đo P08, giữ phân bố state/shop/user/time. Đây là dataset size, không phải mục tiêu concurrency.

## 7. Nhánh tùy chọn: import catalog/đơn SQL

Ưu tiên đồ án là seed VND mới; import history cũ không cần để chứng minh yêu cầu mới. Nếu import, có mapping được review:

| Legacy | V1 | Rủi ro cần xử lý |
|---|---|---|
| Users.id | Firebase uid + legacyUserId | Remap toàn bộ order ownership; không dùng integer ID làm token principal |
| Restaurants.id | shopId + ownerUid | SQL chưa có owner thực; gán từ manifest được review |
| Foods.price/original_price | priceVnd / voucher hoặc promotion mới | Giá mẫu USD 5.99 không tự hiểu là VND; không silent rounding/conversion |
| Orders.status | Exact uppercase state | ongoing không cho biết accepted/preparing/delivering; không tự suy diễn lịch sử |
| order_date | Timestamp UTC | Xác minh timezone nguồn và parse; không phụ thuộc timezone máy chạy script |
| OrderDetails | items snapshots | Giá/tên ở thời điểm cũ có thể thiếu; không gọi dữ liệu join hiện tại là snapshot lịch sử gốc |
| User.address | addresses + order addressSnapshot | Sanitize dữ liệu cá nhân, chỉ dữ liệu có quyền giữ |

Đơn legacy không được tự trừ stock/reserve voucher lần nữa. Nếu không đủ thông tin để coi là active v1, lưu archive/import manifest read-only hoặc loại khỏi dữ liệu vận hành; không ép ongoing thành PENDING rồi cho driver giao đơn giả. Đơn archive cần UI nhãn legacy và không đi vào revenue/COD/verified AI stats nếu thiếu căn cứ.

Dry-run report: source/target counts, duplicates, orphan refs, invalid prices/qty/status/timestamp, UID/shop mapping, sample totals và các field bị bỏ. Import theo stable target IDs, ghi migrationVersion; rerun không nhân đôi. Giá trị thiếu phải có policy/manifest, không thay thành Default Address hoặc success giả.

## 8. P02–P04 — Thay service từng lát cắt

- Chuyển catalog/profile/address trước; query bounded có mapper. Giữ components/theme, sửa labels VND và trạng thái theo contract.
- Favorite/cart hydrate theo UID qua Firestore reads và API writes; client store chỉ là UI/cache, clear khi logout. One-shop cart có xác nhận thay giỏ, server vẫn validate.
- Quote/create order chuyển sang server-priced Firestore transaction; không còn total_price/sub_total tin từ app. UI chỉ báo đặt thành công sau response/listener của order đã commit.
- Implement stock/voucher counters/idempotency trước mở merchant queue; tests tranh suất cuối và per-user quota concurrent.
- Merchant nhận/chế biến/ready; assign driver và driver accept tách riêng. COMPLETED và COD xác nhận nguyên tử, terminal release/consume đúng một lần.
- Admin active/role/owner changes tuân conflict policy; không silently khóa driver hay chuyển owner trong active order.
- Review verified public sanitized sau completed; shop aggregate nếu dùng phải được tính từ reviews thật, không giữ điểm seed thành điểm đã xác minh.

Gate M2/M3 theo MASTER_PLAN; route tồn tại/UI render chưa đủ. Evidence ở artifacts/evidence/P02, P03, P04/<task-id>/ tương ứng.

## 9. P05–P07 — Realtime, native và hai AI

- Thay mock tracking/status/courier bằng assigned driver + order listener; không quay lại timer tự tiến status để demo.
- Chat POST /api/v1/orders/:orderId/messages có message+outbox atomic; scoped Firestore LISTEN nhận tin hai chiều. Không mở direct chat writes hoặc thêm Firebase trigger thứ hai.
- Worker outbox cùng services/api, stable event IDs/lease/retry; FCM token lifecycle và deep link có quyền. Native push denied không phá order/chat history.
- GPS foreground ở DELIVERING, latest small document, stale label, stop/cleanup khi terminal/logout/background; permission denied có fallback rõ. Không gọi đây là background GPS.
- Storage ảnh có pending/private rồi attach/publish qua server; resize và failure handling, không broken profile/review refs.
- AI menu dùng real candidates + JSON schema/ID/giá validation. AI review dùng verified completed-order review evidence IDs + interval/sampleSize. Hai provider call thực phải có evidence riêng; fallback gắn nhãn.
- Performance native trace có thật từ P00 và tiếp tục đo từng flow, không đợi P08 mới cài. Không log prompt/địa chỉ/token vào trace.

## 10. Cutover và rollback cho môi trường đồ án

1. Giữ baseline/source branch và migration manifest. Hệ mới dùng một environment Firebase riêng cho dev/staging; không nối nhầm demo app với production cũ.
2. Cutover theo adapter/config được review, không dual-write SQL+Firestore. Sau một lát cắt pass, code mới đọc cùng nguồn mà API mutation ghi.
3. Khi auth/order đã chuyển đầy đủ, remove mssql/query/SQL connect cùng legacy JWT/OTP endpoints khỏi runtime mới; dữ liệu SQL backup có thể giữ ngoài app theo quyền, không cần xóa nguồn cũ để chứng minh migration.
4. Rollback code dev phải đi kèm seed/dataset phù hợp. Không chạy bản SQL cũ trên orders đã tạo Firestore rồi gọi đó là restore; record mới không tự di chuyển ngược.
5. Nếu cần rollback staging: dừng mutation, ghi checkpoint/counts, chọn restore/reset dataset demo có giới hạn và redeploy bản đã pass; không xóa Auth identities hoặc cloud data thật tùy tiện.
6. Không giả tính năng đã pass khi external provider/native account chưa cấu hình. Ghi blocker/owner/next action; tiếp tục phần local độc lập được.

## 11. Nghiệm thu migration và lưu evidence

| Nhóm | Kết quả cần chứng minh |
|---|---|
| Build/auth | Build sạch, Firebase auth restore, token verify, bootstrap repair, một nguồn phiên |
| Data | Seed rerun không duplicate, UID/shop mapping đúng, prices/currency/state đúng, không secret/PII legacy trong repo |
| Quyền | User khác/merchant khác shop/driver unassigned/inactive bị chặn ở cả API và Rules |
| Race | Stock cuối, quota user/global cuối, key replay/body mismatch, hủy/reject/COD lặp không nhân đôi |
| History | Sửa tên/giá menu không đổi snapshot đơn; legacy thiếu dữ liệu được gắn nhãn, không bịa events |
| Realtime | Hai client chat thật và thao tác status; reconnect không duplicate messages/orders |
| Native | Push foreground/background/open-from-notification trên thiết bị, GPS foreground/stale/denied, Storage ảnh, Performance dashboard |
| AI | Hai use case có model thật + validation + fallback; evidence/source IDs tồn tại, không private order bị gửi đi |
| Performance | 1.000 menuItems/10.000 orders, query/index/cursor đúng, số đo trước/sau và điều kiện rõ |
| Handoff | Người thứ hai cài/build/seed/demo theo tài liệu, account giả, không cần xin credential cá nhân của máy đầu |

Mỗi evidence dùng artifacts/evidence/Pxx/<task-id>/, có commit/build/env/device/network/dataset và kết quả pass/fail. Redact secrets/tokens/PII. Cập nhật BACKLOG.csv, phase checklist và PROGRESS.md sau khi làm thật; trạng thái của tài liệu này không tự đổi các task sang DONE.

## 12. Nguồn nền tảng

[Firebase Auth import users](https://firebase.google.com/docs/auth/admin/import-users), [ID token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens), [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/rules-conditions), [transactions](https://firebase.google.com/docs/firestore/manage-data/transactions), [listeners](https://firebase.google.com/docs/firestore/query-data/listen), [RNFirebase Performance](https://rnfirebase.io/perf/usage), [FCM token management](https://firebase.google.com/docs/cloud-messaging/manage-tokens).
