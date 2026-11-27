# Hợp đồng API v1 — FoodOrderNext

Phiên bản 1.6 · P01–P07 có route chạy local. Xem [tiến độ](PROGRESS.md).

## 1. Quy ước chung

- Base path: /api/v1. HTTPS khi staging/release; localhost/emulator chỉ trong môi trường dev có cấu hình rõ.
- Bearer token là Firebase ID token. Server Firebase Admin verify token, suy UID, kiểm users/{uid}.active/role và ownership hiện hành. Không nhận actorUid/role/customerUid trong body làm authority.
- API dùng JSON và field camelCase, amounts VND integer, ISO-8601 UTC cho thời điểm trong DTO. Firestore SDK nhận Timestamp qua mapper riêng; không đòi SDK trả HTTP envelope.
- Success: data chứa DTO; meta chứa traceId, apiVersion=v1 và pagination khi cần. Error: error chứa code, message và details an toàn; meta chứa traceId. Không trả raw stack, SQL, service credentials, model prompt hoặc token.
- 200 thành công/read; 201 tạo resource; 400 JSON malformed; 401 token thiếu/hết hạn/không hợp lệ; 403 inactive/role/owner không đủ; 404 resource không có hoặc cố tình không tiết lộ; 409 version/key/stock/state conflict; 422 input/domain validation; 429 rate limit; 503 dependency unavailable.
- Server không trả success trước commit. Có thể commit đã thành công nhưng response mất; client retry cùng key để lấy cùng kết quả, không tạo request mới ngay.
- Unknown/protected fields bị reject, không silently mass assign. Schema/limits phải được dùng chung giữa routes/services và test cases.

Ví dụ envelope thành công theo mô tả: data={orderId,status,statusVersion}, meta={traceId,apiVersion,idempotencyReplayed}. Ví dụ lỗi: error={code:STATUS_VERSION_CONFLICT,message,details:{currentStatus,currentStatusVersion}}, meta={traceId,apiVersion}. Đây là cấu trúc contract, không phải cấu hình hoặc mã triển khai.

## 2. Idempotency và optimistic concurrency

Các POST/PATCH tạo hay thay nghiệp vụ phải nhận Idempotency-Key do client tạo một lần cho một thao tác ý định. Độ dài key 16–128 ký tự, không chứa dữ liệu cá nhân. Retry giữ nguyên key và body. Server tạo operations ID từ uid+route+key; lưu request fingerprint và result trong cùng transaction với nghiệp vụ.

- Cùng uid/route/key và fingerprint: trả resource/result đã commit; meta.idempotencyReplayed=true; không ghi event/outbox/counters lần nữa.
- Cùng key nhưng body/params khác: 409 IDEMPOTENCY_KEY_REUSED. Không cho thay expectedStatusVersion trong retry cùng key.
- Hai requests đồng thời cùng key: transaction bảo đảm một kết quả nghiệp vụ. Nếu transaction contention vượt retry, trả conflict/retryable error an toàn để client retry cùng key.
- Không dọn operation trong thời gian demo; trước release xác định retention và công bố retry window. Không dùng TTL operation để tự expire PENDING/reservation.
- GET, POST quote và hai POST AI read-only không cần Idempotency-Key. PUT cart/device có tính thay thế theo ID nhưng vẫn chấp nhận key để retry nhất quán; bootstrap idempotent theo UID.
- POST location nhận diện điểm gửi lại bằng assignmentVersion, sequence và nội dung của điểm mới nhất. Endpoint này dùng quy tắc riêng ở mục 7.
- expectedStatusVersion bắt buộc cho order lifecycle; expectedAssignmentVersion bắt buộc cho assignment mutations. Không dùng timestamp client làm version.

## 3. Nguồn đọc và listeners

Không viết hai hệ thống lịch sử khách qua cả REST full list và Firestore full list. Chọn đường chính:

| Chức năng đọc | Đường chính |
|---|---|
| Catalog/category/shop active | Firestore query/cursor theo mode cho phép |
| Profile/address/cart/favorites chính mình | Firestore scoped GET/LISTEN; GET /me là bootstrap/hydration DTO tối thiểu |
| Lịch sử/chi tiết khách | Firestore customerUid==uid, cursor/limit; document listener khi đang xem |
| Merchant queue | Firestore shopId==shop owner được phép, active states và limit |
| Driver trips | Firestore driverUid==uid; không query unassigned orders |
| Order events/chat | Firestore subcollection scoped; chat page30, listener phần gần nhất |
| Tracking | Firestore orders/{id}/deliveryTracking/current khi DELIVERING |
| Public verified reviews | Firestore shopId/time cursor; không expose private order |
| Admin user query, merchant report, AI | REST server vì có quyền và xử lý tổng hợp |

Firestore query defaults limit20/max50; cursor theo ordered fields + document ID. History/query error do index hoặc permission phải hiển thị rõ, không nuốt thành danh sách rỗng. Chi tiết index ở DATA_MODEL.

Search menu modes v1: browse/name/price. Name dùng normalized prefix nameKey, không substring/fuzzy/full-text. Category equality được phép theo index đã thử; price range dùng mode price. Rating filter chỉ cho danh sách quán dựa shops.ratingAverage/ratingCount từ verified order/shop reviews, khi index đã spike; không có verified per-food rating v1. Tổ hợp q+price và mọi rating filter riêng món trả422 FILTER_COMBINATION_UNSUPPORTED; UI disable, không tải toàn bộ catalog để lọc. P00/P02 phải kiểm query/index thực.

## 4. Auth, profile, cart và media

| Method/path | Actor và input | Output/quy tắc |
|---|---|---|
| POST /api/v1/me/bootstrap | Firebase user; displayName tùy chọn | Tạo profile mặc định customer nếu thiếu; không sửa role/active của profile đã có; tự phục hồi sau lỗi Auth/profile |
| GET /api/v1/me | Active user | Profile DTO, quyền navigation hiện hành; không gồm device tokens/secrets |
| PATCH /api/v1/me | Chính mình; displayName/phone/avatarPath cho phép | Không role/active/emailAuth; avatarPath phải là ảnh đã upload hợp lệ của UID |
| POST /api/v1/me/addresses | Chính mình; receiverName/phone/addressText/location tùy chọn | Tạo addressId; GPS denied vẫn dùng manual |
| PATCH /api/v1/me/addresses/:addressId | Chính mình | Cập nhật allowlist; không đổi owner |
| DELETE /api/v1/me/addresses/:addressId | Chính mình | Không sửa addressSnapshot của đơn cũ; sửa defaultAddressId nếu cần |
| PUT /api/v1/me/cart | Chính mình; shopId, items, expectedCartVersion | Max20 dòng, quantity1–99; one shop; không lưu client totals như authority |
| DELETE /api/v1/me/cart | Chính mình; expectedCartVersion | Đặt giỏ trống, tăng version và replay an toàn; không hủy đơn |
| PUT /api/v1/me/favorites/:foodId | Chính mình | Thêm nếu món tồn tại; một doc/foodId |
| DELETE /api/v1/me/favorites/:foodId | Chính mình | Bỏ favorite idempotent |
| PATCH /api/v1/me/settings | Chính mình; notificationsEnabled | Chỉ tùy chọn thực; không fake quyền OS |
| PUT /api/v1/me/devices/:installationId | Chính mình; token/platform/notificationsEnabled | Rebind đúng UID; server xử lý token refresh, không trả token qua user listing |
| DELETE /api/v1/me/devices/:installationId | Chính mình | Bỏ liên kết push thiết bị trước logout khi có mạng |
| POST /api/v1/me/notifications/:eventId/read | Chính mình | Set readAt một lần hoặc giữ thời điểm đã đọc |

Firebase Auth SDK thực hiện register/login/email verification/reset/signOut. Không triển khai /auth/login tự ký JWT, /auth/refresh legacy hoặc giữ hai phiên. User chưa verified có thể bootstrap/xem màn xác minh, nhưng create order/chat/AI/customer mutation cần verified theo policy v1. Server/rules phải thống nhất mức quyền người chưa verified.

Mutation P02 yêu cầu khách active, email verified và Idempotency-Key. Kết quả giỏ trả version mới, màn hình đọc lại Firestore theo UID. Cart mặc định version 0 khi chưa tạo doc. Khi bỏ hoặc giảm số lượng, khách có thể dọn cả những dòng đã lỗi thời. Thêm hoặc tăng số lượng xác minh quán đang nhận đơn, món cùng quán, tùy chọn hợp lệ và tổng số suất cho cùng foodId. Giữ version cũ trả `CART_VERSION_CONFLICT`.

Địa chỉ gồm label, receiverName, phone, addressText, location và locationSource. Giới hạn 20 mục. Mục đầu tiên trở thành mặc định; PATCH với `{ "makeDefault": true }` chọn mục khác. Khi xóa mục mặc định, server chọn mục còn lại đầu tiên theo ID hoặc đặt null. Người dùng có thể nhập tọa độ cùng địa chỉ thủ công. Favorite lưu một doc theo foodId và UID; bỏ favorite vẫn hoạt động khi món đã bị ẩn.

Binary upload qua Storage SDK theo path và rules đã chốt, tối đa 5 MiB/image và image/jpeg/png/webp; API chỉ nhận storagePath, kiểm object tồn tại/metadata/quyền. Pending ảnh không công khai; publish/attach là thao tác server sau validation. Không nhận URL tùy ý rồi fetch từ server. Attach review/menu/avatar fail để lại orphan thì phải có cleanup có giới hạn; không giả Storage+Firestore là một transaction.

## 5. Quote và tạo đơn

POST /api/v1/orders/quote — customer active/verified, read-only.

Input gồm shopId, items[{foodId,quantity,optionIds}], addressId và voucherCode tùy chọn (tối đa 40 ký tự). Output gồm snapshots tạm, subtotalVnd, discountVnd, deliveryFeeVnd, grandTotalVnd, currency, quotedAt, availability, quoteKey và địa chỉ của chính khách. Quote chỉ đọc. Mọi điều kiện được kiểm tra lại khi tạo đơn.

POST /api/v1/orders — customer active/verified; Idempotency-Key bắt buộc.

Input gồm shopId, items như quote, addressId, note tối đa 500 ký tự, paymentMethod=COD, voucherCode tùy chọn và expectedGrandTotalVnd. Schema chỉ chấp nhận các trường trong hợp đồng. App gửi thêm expectedCartVersion và expectedQuoteKey. Server xác minh đúng giỏ rồi dọn giỏ trong cùng commit. Nếu địa chỉ hoặc chi tiết báo giá thay đổi, app yêu cầu khách xác nhận lại. Lời gọi API có thể bỏ hai trường tùy chọn khi dùng giỏ riêng, khi đó server giữ nguyên giỏ đang lưu.

Server transaction:

1. Đọc operation và tất cả shop/menu/address/voucher/userCounter cần thiết trước writes.
2. Kiểm cùng shop, acceptingOrders/active, quantity/options, stock, address owner, quota global/per-user, thời hạn voucher bằng server time.
3. Tính VND nguyên. Khi tổng hoặc quoteKey khác giá trị đã xác nhận, trả 409 PRICE_CHANGED kèm báo giá mới. Giỏ có version hoặc nội dung khác trả CART_VERSION_CONFLICT.
4. Tạo PENDING/statusVersion=1, assignmentStatus=UNASSIGNED, giữ stock/quota, lưu snapshots, event/outbox và operation result.
5. Commit rồi response 201 {orderId,status,statusVersion,grandTotalVnd,amountDueVnd,currency}. Retry cùng key lấy đúng orderId.

Món hết/không active: 409 OUT_OF_STOCK hoặc ITEM_UNAVAILABLE; voucher lỗi: 422 VOUCHER_NOT_ELIGIBLE hoặc 409 VOUCHER_QUOTA_EXHAUSTED; không âm stock/counter, không partial order. Chưa có tuyến giao phù hợp không được tự mặc định địa chỉ giả.

## 6. Lifecycle và assignment

| Endpoint | Actor/input | Điều kiện và kết quả |
|---|---|---|
| POST /api/v1/orders/:orderId/cancel | Customer của đơn; expectedStatusVersion, reasonCode tùy chọn | Chỉ PENDING→CANCELLED; release stock/voucher một lần |
| POST /api/v1/orders/:orderId/reject | Merchant owner hoặc admin; expectedStatusVersion, reasonCode | Chỉ PENDING→REJECTED; hoàn suất và lượt ưu đãi một lần |
| POST /api/v1/orders/:orderId/transitions | Merchant owner; targetStatus, expectedStatusVersion | PENDING→ACCEPTED, ACCEPTED→PREPARING, PREPARING→READY_FOR_PICKUP; không arbitrary jump |
| POST /api/v1/orders/:orderId/assign-driver | Merchant owner/admin; driverUid, expectedStatusVersion, expectedAssignmentVersion | Driver active/approved đúng shop, đơn chưa DELIVERING/terminal; assignmentStatus=ASSIGNED |
| POST /api/v1/orders/:orderId/accept-assignment | Chính assigned driver; expectedAssignmentVersion | ASSIGNED→ACCEPTED, order chưa terminal; không đổi order status |
| POST /api/v1/orders/:orderId/pickup | Assigned driver đã ACCEPTED; expectedStatusVersion, expectedAssignmentVersion | Chỉ READY_FOR_PICKUP→DELIVERING |
| POST /api/v1/orders/:orderId/complete | Assigned driver đã ACCEPTED; expectedStatusVersion, expectedAssignmentVersion, codCollectedVnd | Chỉ DELIVERING→COMPLETED; amount đúng amountDueVnd, paymentStatus=COD_CONFIRMED cùng transaction |

Merchant có thể assign khi ACCEPTED/PREPARING/READY_FOR_PICKUP; chỉ reassign nếu assignment cũ còn ASSIGNED, tăng assignmentVersion, đưa ASSIGNED và driver mới phải accept. Assignment đã ACCEPTED hoặc đơn DELIVERING bị khóa:409 DRIVER_ASSIGNMENT_LOCKED; xử lý ngoại lệ là scope extension có audit, không silently thay driver đã nhận chuyến. Admin chỉ gán/quản trị theo contract, không có API sửa arbitrary status để vượt COD.

Transitions ghi statusVersion mới, event và outbox trong cùng transaction. Assignment ghi assignmentVersion và event. Cancel/reject/completed terminal; lặp request với key cũ trả kết quả cũ; key mới trên terminal trả INVALID_ORDER_TRANSITION, không hoàn kho/quota lại. COMPLETED chuyển stock RESERVED→CONSUMED và voucher RESERVED→REDEEMED; không tăng available. Không auto-expire PENDING v1.

Response các mutation gồm orderId, status, statusVersion, assignmentStatus, assignmentVersion, updatedAt; DTO nhạy cảm chỉ trả người có quyền. Client dùng version để tránh HTTP response cũ ghi đè snapshot mới.

pickup ghi pickedUpAt cùng transition; accepted/complete/cancel/reject ghi timestamp tương ứng do server xác lập. Tạo/assignment/terminal đồng thời cập nhật users.activeOrderCount và shops.activeOrderCount theo DATA_MODEL. Admin đổi role/active/ownerUid khi counter còn active trả409 ACTIVE_ORDER_CONFLICT, không chỉ kiểm qua query ngoài transaction. Registry admin private chặn vô hiệu admin cuối. Các tests phải có race giữa admin lock và create/assign.

## 7. GPS foreground

POST /api/v1/orders/:orderId/location — assigned driver active/approved đã ACCEPTED, order DELIVERING.

- Payload gồm `latitude` từ −90 đến 90, `longitude` từ −180 đến 180, `accuracyMeters` từ 0 đến 5000, `recordedAt` ISO 8601, `sequence` số nguyên dương và `expectedAssignmentVersion`. Android lấy epoch mili giây của phép đo làm sequence. Sequence và recordedAt phải tăng trong cùng lượt phân công.
- Máy chủ từ chối thời gian đo cũ hơn 60 giây hoặc nhanh hơn đồng hồ máy chủ quá 10 giây. Giới hạn mỗi lần ghi cách nhau ít nhất 10 giây. Vị trí trong bán kính 15 m chỉ cập nhật mỗi 30 giây. Thử lại đúng dữ liệu đang lưu trả receivedAt cũ, không ghi lại.
- Kết quả có `orderId`, `accepted` và `receivedAt` do máy chủ gắn. Lỗi 429 có `retryAfterMs`. Tọa độ chỉ ghi một document `deliveryTracking/current`. Xác nhận giao và thu COD xóa document cùng transaction. Request vị trí sau khi đơn kết thúc bị từ chối.
- Android lấy và gửi vị trí khi màn chuyến có focus, app foreground và tài xế bật chia sẻ. Khách có thể nhập địa chỉ bằng tay. Xác nhận giao/thu COD vẫn dùng command riêng của vòng đời đơn.

## 8. Chat và thông báo

POST /api/v1/orders/:orderId/messages — customer của đơn, merchant owner hoặc assigned driver đã accept; tất cả active, order chưa terminal.

Input: clientMessageId ổn định, text trim 1–2.000 ký tự. Header Idempotency-Key bắt buộc. Server suy senderUid/role/name; không nhận recipients hoặc sender từ client. Transaction đọc order/quyền và operation, tạo message với sentAt server, inbox/outbox event cho participants phù hợp và result. Không gửi FCM trong transaction.

Response 201 {messageId,clientMessageId,sentAt}. Client LISTEN messages đúng order; dedup ID, pending/sent/error rõ. Cùng clientMessageId/uid/order không được tạo tin thứ hai dù app vô tình đổi header key; cần deterministic message uniqueness record/document ID hoặc key scope cố định. Terminal khóa gửi nhưng giữ lịch sử có quyền.

Worker cùng Express package claim job bằng lease, retry có backoff, lưu mã lỗi ngắn và loại invalid FCM token. EventId ổn định tạo một inbox record; crash gửi lại có thể trùng push nên app dedup. Push chỉ thông báo event/orderId, không gửi địa chỉ/phone/vị trí/text nhạy cảm trên lock screen. Tap deep link phải auth+fetch/listen lại, không trust status từ push.

GET /api/v1/orders/:orderId/access trả orderId, shopId, role, canReadChat và canSend cho người đang có quyền. Tài xế cần assignment ACCEPTED và duyệt còn hiệu lực để đọc chat. Admin đọc được chat theo vai trò và không gửi tin.

Settings, PUT device và DELETE device là thao tác idempotent trên trạng thái hiện tại và áp dụng cho các vai trò active, email verified. POST đánh dấu đã đọc giữ nguyên readAt sau lần đầu. Token chỉ lưu ở backend. Binding hiện hành theo installationId và token hash dùng để đổi tài khoản trên cùng thiết bị.

Worker dùng tối đa 10 device gần đây mỗi người nhận và kiểm lại quyền hiện tại. Các trạng thái cuối là SENT, FAILED và SKIPPED. SKIPPED có mã FCM_DISABLED hoặc NO_TARGETS khi dùng local hoặc thiếu thiết bị đủ điều kiện. Inbox ghi cùng sự kiện và giữ nguyên qua retry. Payload FCM chỉ có eventId, orderId và nội dung chung.

## 9. Catalog, stock, voucher, admin và báo cáo

| Method/path | Quyền/đầu vào chính |
|---|---|
| POST /api/v1/shops/:shopId/menu-items | Merchant owner/admin; catalog fields allowlist và initial availablePortions |
| PATCH /api/v1/menu-items/:foodId | Merchant owner/admin; name/description/price/category/active/media/options, expectedRevision; không reserved/sold counters |
| POST /api/v1/menu-items/:foodId/stock-adjustments | Merchant owner/admin; deltaAvailablePortions integer, reason, expectedRevision; không âm available |
| PATCH /api/v1/shops/:shopId | Owner/admin; acceptingOrders/openingHours/delivery fee và location tùy chọn; ownerUid chỉ admin có audit |
| POST /api/v1/shops/:shopId/vouchers | Owner/admin; voucher definition; unique code registry trong transaction |
| PATCH /api/v1/vouchers/:voucherId | Owner/admin; allowlist definition, không counters; bảo toàn reservations |
| PUT /api/v1/shops/:shopId/drivers/:driverUid | Admin duyệt/thu hồi theo quán. Target là driver active. Thu hồi quyền hiện hành bị chặn khi tài xế còn đơn đang xử lý |
| GET /api/v1/admin/users | Admin active; bounded q/filter/cursor, không tokens/hash/địa chỉ lịch sử |
| PATCH /api/v1/admin/users/:uid | Admin active. expectedRole và expectedActive bắt buộc. Role/active thay đổi trong transaction có audit, bộ đếm đơn và registry admin |
| GET /api/v1/shops/:shopId/reports/daily | Owner/admin, day=YYYY-MM-DD theo Asia/Ho_Chi_Minh. Thêm cursor để xem các đơn tạo trong ngày |

P04 bổ sung GET /shops, /shops/:shopId, /shops/:shopId/menu-items, /menu-items/:foodId, /shops/:shopId/drivers và /admin/users/:uid theo quyền trong bảng. Danh sách tối đa 20 mục/trang. Bộ lọc admin dùng role, active, và đầu displayName khớp đúng dấu/chữ hoa thường. Các route cấu hình voucher vẫn ở hợp đồng dự kiến.

Quán đọc hàng đợi Firestore theo shopId/status và lấy cùng phiên bản trạng thái đã đọc để gọi P03. Admin quản lý tài xế đủ quyền theo quán. Khi khóa hoặc đổi vai trò tài xế, version quyền trên user tăng. Driver approval chỉ hợp lệ khi version trùng user. Snapshot cũ chưa có version được hiểu là 0.

Để gắn ảnh, merchant lưu món trước, tải file pending qua Storage SDK rồi PATCH imagePath với expectedRevision. Server chép ảnh đã kiểm vào path riêng. GET /api/v1/menu-items/:foodId/image trả bytes ảnh hiện tại khi quán và món active. Gỡ ảnh dùng imagePath=null. File cũ giữ riêng. Hỗ trợ ảnh từ các đường dẫn cũ được giữ để đọc dữ liệu đã có.

Report tính tổng bằng Firestore count/sum trên một ngày. createdCount đếm createdAt trong ngày. completedCount và codVnd dựa completedAt, status COMPLETED và COD_CONFIRMED. Danh sách đính kèm là các đơn tạo trong ngày. Đo trên 10.000 orders thuộc P08.

Ảnh món công khai có `ETag` và yêu cầu revalidation khi client dùng lại cache. Server kiểm ảnh vẫn được gắn vào món và quán đang mở quyền đọc trước khi trả 304. Gỡ ảnh hoặc ẩn món trả 404. Dữ liệu API có quyền tiếp tục dùng `no-store`. [HTTP Caching](https://www.rfc-editor.org/rfc/rfc9111.html)

Mặc định, mỗi response báo cáo có tổng số đơn và COD. Với cursor từ trang trước, client có thể gửi thêm `includeTotals=false` để chỉ nhận `day`, `timezone`, `rows` và `cursor`. App giữ tổng từ trang đầu và cập nhật khi mở lại báo cáo hoặc chọn ngày khác. Quyền truy cập và phạm vi cursor đều được kiểm tra cho mỗi trang. Khi triển khai, cập nhật Express trước bản app dùng tham số này.

## 10. Review hợp lệ

POST /api/v1/orders/:orderId/review — đúng customer active/verified; Idempotency-Key.

Input P03 gồm rating nguyên 1–5 và text tối đa 3.000 ký tự. imagePaths để trống đến khi có luồng kiểm tra và công bố ảnh. Transaction kiểm COMPLETED, COD_CONFIRMED, order.reviewId null, tạo public review, gắn reviewId vào private order và cập nhật ratingSum/ratingCount/ratingAverage của quán. Một order một review. Public document gồm alias chung “Khách hàng” và các trường review của quán.

409 REVIEW_ALREADY_EXISTS cho key mới khi đã có; key cũ trả reviewId cũ. Không nhận verified flag từ client. API của merchant không cho tự thêm verified review. AI insights chỉ dùng review tạo theo nguyên tắc này hoặc fixture có nhãn trong development.

## 11. AI menu assistant bắt buộc

POST /api/v1/ai/menu-assistant — customer active/verified; rate-limited.

Input gồm shopId, requestText tối đa 1.000 ký tự, budgetVnd tùy chọn, diners từ 1 đến 12 và preferences tùy chọn gồm VALUE hoặc VARIETY. Server lấy tối đa 80 món đang bán và còn suất để chọn tối đa 20 món ứng viên. Model chỉ nhận một yêu cầu và danh sách ứng viên.

Backend đọc candidate menu active/còn availablePortions, giới hạn tập dữ liệu theo ngân sách/preferences/query. Gửi dữ liệu cần thiết tới model thật và yêu cầu structured JSON. Kiểm schema, foodIds/options tồn tại trong candidates đúng shop, quantity hợp lệ, giá/tổng tính lại, không vượt budget nếu đây là hard constraint. Không tin giá hoặc stock do model viết.

Kết quả gồm suggestions[{foodId,name,optionIds,optionNames,quantity,reason,unitPriceVnd,lineTotalVnd}], subtotalVnd, currency, explanation, generatedBy=MODEL/FALLBACK, fallbackReason/null, sourceRevision, quotedAt, sampled, cached, usage và traceId. Ngân sách tính tiền món và tùy chọn. Phí giao xuất hiện ở checkout.

Allergy/nutrition chỉ nêu theo dữ liệu menu thực, không đảm bảo an toàn thực phẩm bằng suy đoán. Menu không có món phù hợp phải nói không tìm thấy. Client xác nhận thêm giỏ, checkout revalidate như đơn bình thường. Timeout/invalid JSON/IDs không hợp lệ: bounded retry tối đa theo config rồi deterministic filter fallback có nhãn; không tạo món hoặc gọi create order tự động.

## 12. AI review insights bắt buộc

POST /api/v1/ai/review-insights — merchant owner của shop hoặc admin active; rate-limited.

Input gồm shopId và hai mốc ISO startInclusive, endExclusive. Mặc định 30 ngày tính theo giờ Việt Nam, tối đa 90 ngày. Lấy tối đa 40 review verified mới nhất, với sampled=true nếu còn dữ liệu ngoài mẫu. Dưới 3 review trả 422 INSUFFICIENT_DATA cùng sampleSize.

Kết quả gồm shopId, interval, sampleSize, fixtureCount, sampled, totalMatched=null, themes[{topic,label,sentiment,evidenceReviewIds}], sources, summary, suggestedActions, generatedBy, fallbackReason, generatedAt, cached, usage và traceId. Sentiment thể hiện điểm sao của các nguồn trích dẫn. Tóm tắt dựa trên số mẫu và điểm trung bình tính ở backend.

Server kiểm toàn bộ evidence IDs thuộc tập input và đúng interval; không chấp nhận quote không có trong nguồn. Không gửi UID, phone, address, GPS hay private order vào model. Text review là dữ liệu không tin cậy; prompt injection không được thay role/tool/policy. Cache theo shop+interval+input version, không gọi model mỗi render. Fallback có nhãn, evidence vẫn phải thật.

Cả hai AI phải có evidence request thành công tới provider thật, schema tests, timeout/error/fallback tests và bộ đánh giá output. Mock phục vụ unit test không được tính là AI integration đã nghiệm thu. Model timeout/cost cap nằm phía server; không hard-pin tên model/version trước khi xác nhận account/provider thực ở P00.

## 13. Error codes tối thiểu và kiểm thử

Nhóm auth: AUTH_REQUIRED, TOKEN_INVALID, USER_INACTIVE, EMAIL_NOT_VERIFIED, FORBIDDEN. Nhóm input: VALIDATION_ERROR, FILTER_COMBINATION_UNSUPPORTED, MEDIA_INVALID. Nhóm order: PRICE_CHANGED, OUT_OF_STOCK, ITEM_UNAVAILABLE, CART_SHOP_MISMATCH, INVALID_ORDER_TRANSITION, STATUS_VERSION_CONFLICT, ASSIGNMENT_VERSION_CONFLICT, DRIVER_NOT_APPROVED, DRIVER_NOT_ASSIGNED, COD_AMOUNT_MISMATCH. Nhóm retry: IDEMPOTENCY_KEY_REUSED, RETRYABLE_CONFLICT, RATE_LIMITED. Nhóm review/AI: REVIEW_ALREADY_EXISTS, INSUFFICIENT_DATA, AI_UNAVAILABLE, AI_OUTPUT_INVALID.

Acceptance bắt buộc: replay hai requests cùng key; key/body khác; hai customers mua suất cuối; hai requests cùng user tranh perUserLimit cuối; cancel/reject/complete lặp; user/merchant/driver khác đọc hoặc mutate sai order; inactive user; response HTTP cũ sau snapshot mới; send chat retry; unauthorized GPS; public review không lộ dữ liệu private; AI IDs/evidence giả bị chặn. Kết quả test và screenshots/logs đã lọc lưu artifacts/evidence/Pxx/<task-id>/ theo phase.

## 14. Nguồn

[Firebase ID token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens), [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions), [Security Rules](https://firebase.google.com/docs/firestore/security/rules-conditions), [listeners](https://firebase.google.com/docs/firestore/query-data/listen), [FCM token management](https://firebase.google.com/docs/cloud-messaging/manage-tokens). Endpoint và business policies là hợp đồng v1 do nhóm lựa chọn, chưa phải API có sẵn trong repository nguồn.
