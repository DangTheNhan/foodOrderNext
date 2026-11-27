# Mô hình dữ liệu, truy vấn và quyền — FoodOrderNext

Phiên bản 1.1 · Xem [tiến độ triển khai](PROGRESS.md) cho các phần đã chạy local. Đọc cùng [MASTER_PLAN](MASTER_PLAN.md), [ARCHITECTURE](ARCHITECTURE.md), [API_CONTRACT](API_CONTRACT.md), [MIGRATION](MIGRATION.md).

## 1. Quy ước dữ liệu

- Firestore là database chính. Document ID là chuỗi ổn định; Firebase Auth UID dùng nguyên dạng cho user. ID SQL chỉ lưu legacyId khi cần migration, không dùng làm principal mới.
- Timestamps dùng Firestore Timestamp do server xác lập; lưu theo thời điểm UTC, UI/báo cáo trình bày Asia/Saigon. Interval dữ liệu dùng startInclusive/endExclusive; ngày báo cáo phải đổi biên múi giờ rõ ràng.
- Tiền là số nguyên VND: priceVnd, subtotalVnd, discountVnd, deliveryFeeVnd, grandTotalVnd, amountDueVnd; currency=VND. Reject NaN, số âm, fraction, overflow và unknown fields.
- Quantity 1–99 mỗi dòng, tối đa 20 dòng/đơn; mỗi dòng món/options đã chuẩn hóa và không trùng key. Stock đếm suất nguyên. Constants này phải được dùng chung qua schema/contract, không rải magic numbers.
- Name key: lowercase, trim/gộp khoảng trắng, bỏ dấu tiếng Việt và đổi đ thành d theo cùng thuật toán phía server; không coi đó là full-text search.
- Soft deactivate món/quán/user thay vì xóa record còn được tham chiếu. Order giữ snapshots để lịch sử không đổi theo catalog.
- Mọi mobile Firestore writes bị deny v1; API server thực hiện mutations. Storage upload có rules riêng. Không lưu password hash, OTP legacy, ID token, AI key hoặc service account trong Firestore.

## 2. Users, quyền và dữ liệu cá nhân

| Path | Trường và ràng buộc |
|---|---|
| users/{uid} | displayName, emailDisplay tùy chọn, phone, avatarPath, role=customer/merchant/driver/admin, active boolean, activeOrderCount integer server-only, defaultAddressId, settings, createdAt, updatedAt, legacyUserId tùy chọn |
| users/{uid}/addresses/{addressId} | label, receiverName, phone, addressText, location GeoPoint/null, locationSource=GPS/MANUAL, createdAt, updatedAt |
| users/{uid}/favorites/{foodId} | foodId, shopId, createdAt; foodId xác thực tồn tại |
| users/{uid}/carts/active | shopId/null, items[{foodId, quantity, optionIds}], updatedAt, version; không coi giá preview là authority |
| users/{uid}/devices/{installationId} | token, platform, notificationsEnabled, updatedAt, lastSeenAt; token private, chỉ backend đọc/ghi |
| users/{uid}/notifications/{eventId} | type, orderId, title/body tối giản, createdAt, readAt/null; không địa chỉ/GPS |
| adminAudit/{eventId} | actorUid, targetUid, action, before/after protected fields, createdAt, traceId; không secret, private |
| system/adminRegistry | activeAdminUids hoặc activeAdminCount có cập nhật nguyên tử; private, dùng chặn vô hiệu admin cuối |

Auth email là nguồn xác thực, emailDisplay nếu có chỉ để hiển thị. Profile API không cho sửa email bằng update field Firestore. Email change cần flow Firebase Auth có xác minh/re-auth riêng khi bổ sung, không giả đã đổi email đăng nhập.

Settings v1 chỉ lưu lựa chọn có tác dụng thật, ví dụ notificationsEnabled; permission hệ điều hành là trạng thái khác, không được giả granted bằng một switch. Không lưu UI Coming Soon như tính năng đã hoàn thiện.

Role và active do server/admin quản lý. Bootstrap customer và admin đầu tiên có quy trình khác nhau; users document không tồn tại hoặc active=false phải fail closed cho API/private reads. Không dùng input role hoặc custom claims cũ để bỏ qua users authority.

## 3. Shops và catalog

| Path | Trường và ràng buộc |
|---|---|
| shops/{shopId} | ownerUid, name, addressText, location, active, acceptingOrders, activeOrderCount, openingHours, deliveryFeeVnd, imagePath, ratingSum, ratingCount, ratingAverage, createdAt, updatedAt |
| shops/{shopId}/drivers/{uid} | approved boolean, active boolean, approvedBy, approvedAt; users.role phải driver và active |
| categories/{categoryId} | name, nameKey, sortOrder, active |
| menuItems/{foodId} | shopId, categoryId, name, nameKey, description, priceVnd, currency=VND, active, availablePortions, reservedPortions, soldPortions, imagePath, optionGroups, tags, revision, createdAt, updatedAt |

shop.ownerUid là merchant chủ quán hiện hành. Admin có thể quản lý và merchant thao tác trong đúng phạm vi quán. Admin duyệt tài xế theo quán. Approval có authorityVersion trùng driverAuthorityVersion trên users; seed thiếu cả hai được hiểu là 0. Có đơn hoạt động thì chặn các thay đổi quyền có thể làm gián đoạn chuyến.

P02 đọc optionGroups gồm id, name, minSelections, maxSelections và options[{id,name,priceDeltaVnd}]. ID tùy chọn duy nhất trong mỗi món. API cart xác minh số lựa chọn theo nhóm. Seed hiện dùng optionGroups=[].

Stock:

- availablePortions là số có thể bán thêm; tạo đơn giảm available, tăng reserved.
- reservedPortions là số đang giữ bởi đơn chưa terminal; cancel/reject giảm reserved và trả available; completed giảm reserved và tăng sold.
- Merchant chỉ điều chỉnh phần available bằng delta có audit; không được trực tiếp viết reserved/sold hoặc đặt available âm.
- V1 reviews là theo order/shop, không per-food. shops.ratingSum/ratingCount khởi tạo0; tạo verified review tăng sum/count trong cùng transaction và tính ratingAverage=sum/count. Khi count0 hiển thị chưa có đánh giá. FoodDetail có thể liên kết đánh giá quán, không gọi đó là verified rating riêng món. Rating seed cũ chỉ có thể giữ với nhãn demo/legacy, không dùng cho filter đã xác minh.

## 4. Orders, snapshots và state

orders/{orderId} là private document:

| Nhóm | Trường |
|---|---|
| Identity | customerUid, shopId, shopNameSnapshot, driverUid/null, activeParticipantUids để đối soát counter nội bộ, legacyOrderId tùy chọn |
| State | status, statusVersion, assignmentStatus=UNASSIGNED/ASSIGNED/ACCEPTED, assignmentVersion, assignedAt/null, acceptedAssignmentAt/null |
| Items | items[{lineId, foodId, nameSnapshot, unitPriceVnd, quantity, optionsSnapshot, lineTotalVnd, imagePathSnapshot}] |
| Money | currency=VND, subtotalVnd, discountVnd, deliveryFeeVnd, grandTotalVnd, amountDueVnd |
| Reservation | stockReservation=RESERVED/RELEASED/CONSUMED, voucherId/null, voucherReservation=NONE/RESERVED/RELEASED/REDEEMED, reservationReleasedAt/null |
| Delivery | addressSnapshot{receiverName,phone,addressText,location}, shopLocationSnapshot tùy chọn/null, note tùy chọn |
| Payment | paymentMethod=COD, paymentStatus=UNPAID/COD_CONFIRMED, codCollectedVnd/null, codConfirmedBy/null, codConfirmedAt/null |
| Review | reviewId/null; không public toàn bộ order để hiển thị review |
| Time | createdAt, updatedAt, acceptedAt/null, pickedUpAt/null, completedAt/null, cancelledAt/null, rejectedAt/null |

Các trạng thái chính xác: PENDING, ACCEPTED, PREPARING, READY_FOR_PICKUP, DELIVERING, COMPLETED, CANCELLED, REJECTED. Không trộn title case hoặc ongoing/completed của legacy vào v1.

Mọi thay đổi trạng thái đơn tăng statusVersion; assignment có assignmentVersion riêng. Khi API thay assignment đồng thời điều kiện trạng thái cũng phải được kiểm trong transaction; response có cả versions. Event giữ snapshot transition và actor; không sửa event cũ để giả lịch sử.

Active-order guard: tạo đơn tăng activeOrderCount của customer, shop owner và shop; assignment tăng counter assigned driver, reassign ASSIGNED giảm old/tăng new; terminal giảm đúng một lần cho participants/shop. Counter documents được đọc/ghi trong cùng transaction với order. Admin đổi role/active hay ownerUid phải kiểm counter=0 và ghi authority document cùng transaction; nếu còn order active trả409 ACTIVE_ORDER_CONFLICT. Assignment đã ACCEPTED không reassign trong v1. Seed/migration phải đối soát counters, không tự reset về0 trên dữ liệu active.

| Path | Nội dung |
|---|---|
| orders/{orderId}/events/{eventId} | type, fromStatus/toStatus nếu có, statusVersion/assignmentVersion, actorUid, actorRole, reasonCode/note bounded, createdAt |
| orders/{orderId}/messages/{messageId} | senderUid, senderRole, senderDisplayNameSnapshot, text, sentAt, clientMessageId; không HTML/tool instructions |
| orders/{orderId}/deliveryTracking/current | driverUid, assignmentVersion, latitude, longitude, accuracyMeters, recordedAt, receivedAt, sequence. Chỉ lưu điểm mới nhất |

Events/messages là append-only qua server. Tracking quyền đọc chỉ khi DELIVERING; server xóa document khi hoàn tất/hủy nếu có. Không giữ route history. Message text tối đa 2.000 ký tự; order note tối đa 500 ký tự. Không gửi chat khi order terminal; vẫn xem lịch sử nếu còn quyền participant.

Một order chứa tối đa 20 dòng snapshot. Event, chat và review nằm ở document riêng. Ảnh lưu path. P03 đóng gói location trong addressSnapshot thành latitude/longitude hoặc null, còn sổ địa chỉ dùng GeoPoint/null. App đọc lịch sử với customerUid, createdAt giảm dần và cursor có ID tài liệu.

P06 sao chép tọa độ quán vào đơn mới. Đơn tạo trước P06 dùng tọa độ công khai của quán nếu trường snapshot chưa có. Shop location có thể là cặp latitude/longitude hoặc GeoPoint cũ. Giữ địa chỉ dạng chữ khi người dùng chưa nhập tọa độ. Chuyến của tài xế lọc theo driverUid và trạng thái, sắp xếp updatedAt giảm dần.

## 5. Voucher và counters chống race

| Path | Trường |
|---|---|
| vouchers/{voucherId} | codeKey unique theo registry, shopId, active, startsAt, endsAt, minSubtotalVnd, discountType=FIXED/PERCENT, fixedDiscountVnd/percentBps, maxDiscountVnd, maxUses, perUserLimit, reservedCount, redeemedCount, createdAt, updatedAt |
| voucherCodes/{codeKey} | voucherId, shopId; private registry để uniqueness bằng document ID, không query-then-insert |
| vouchers/{voucherId}/userCounters/{uid} | reservedCount, redeemedCount, updatedAt; document xác định để lock cùng transaction |
| vouchers/{voucherId}/redemptions/{orderId} | uid, state=RESERVED/RELEASED/REDEEMED, discountVnd, createdAt, updatedAt |

v1 một mã mỗi đơn; discount áp dụng subtotal món, không phí ship. FIXED và PERCENT đều cap ở subtotal và maxDiscount nếu có. PERCENT dùng percentBps số nguyên, làm tròn xuống đồng theo công thức server thống nhất. Quote dùng cùng hàm nhưng không reserve.

Tạo đơn kiểm reservedCount+redeemedCount so với maxUses ở voucher và so với perUserLimit ở userCounters, rồi tăng reserved ở cả hai trong cùng transaction. Cancel PENDING/reject PENDING giảm reserved đúng một lần, redemption thành RELEASED. Completed chuyển reserved sang redeemed ở cả hai, redemption thành REDEEMED. History query count riêng lẻ không đủ để ngăn hai checkout đồng thời của cùng user.

Thay voucher đang có reservation không được reset counters. Cần field policy/validation cho active/time/value changes; order giữ discount snapshot không tính lại theo voucher hiện tại. Không tự thu hồi reservation bằng TTL trong v1.

## 6. Reviews công khai và AI insights

reviews/{reviewId} chỉ chứa dữ liệu có thể public:

- shopId, authorAliasSnapshot không chứa email/phone, rating 1–5, text tối đa 3.000 ký tự, imagePaths tối đa 3, verifiedCompletedOrder=true, createdAt.
- Không customerUid, address, phone, GPS, payment details hoặc orderId trong public document. orders/{id}.reviewId là liên kết private.
- Backend tạo review khi customerUid đúng token, status COMPLETED, COD_CONFIRMED, reviewId đang null. Transaction tạo random reviewId, gắn vào order và tăng shop ratingSum/ratingCount/ratingAverage một lần. Merchant không thể tự đánh verified hoặc thêm review cho khách.
- v1 review append-only; sửa/xóa hoặc moderation là scope extension có policy và aggregate update riêng. Nếu nội dung không phù hợp thì xử lý theo quy trình admin có audit, không edit âm thầm nội dung nguồn của AI.

AI insights đọc reviews verified theo shopId và khoảng ngày. Model nhận mã tạm trong mẫu. Backend trả reviewId thật và đoạn nguồn đã lọc. `aiInsightCache/{cacheKey}` và `aiMenuCache/{cacheKey}` là private, lưu fingerprint nguồn, đầu ra JSON đã kiểm, generatedAt và expiresAt. Cache kiểm phiên bản nguồn trước mỗi lần sử dụng.

AI menu truy vấn ứng viên theo quán, active và availablePortions. Backend kiểm giá, tồn và tùy chọn dùng logic nghiệp vụ hiện có trước khi trả kết quả. `aiRequestLimits` và `aiBudgets` giữ count theo cửa sổ với ID tài khoản đã băm. Các collection AI khai báo TTL qua expiresAt. Express vẫn kiểm thời điểm hết hạn lúc đọc.

## 7. Idempotency và notifications

| Path | Trường và quyền |
|---|---|
| operations/{operationId} | uid, routeKey, idempotencyKeyHash, requestFingerprint, resourceId, resultSummary, createdAt, expiresAt tùy chọn; private |
| notificationOutbox/{eventId} | type, orderId, messageId tùy chọn, recipientUids, status=PENDING/PROCESSING/RETRY/SENT/FAILED/SKIPPED, attempts, nextAttemptAt, leaseOwner/leaseId/leaseUntil, deliveredTokenHashes, createdAt, finishedAt, lastErrorCode. Private |
| notificationInstallations/{installationId}, notificationTokens/{tokenHash} | uid, installationId và tokenHash xác định binding hiện hành. Private |

operationId xác định từ uid+route+key, fingerprint từ body chuẩn hóa; không lưu raw auth token. Cùng key+payload trả kết quả đã commit, khác payload trả 409. TTL nếu dùng chỉ cleanup sau thời gian retry đã công bố, không dùng để expire reservation/order. Trong scope demo có thể giữ operations suốt demo để tránh retry quá muộn tạo trùng.

eventId xác định từ event nghiệp vụ và đối tượng; một document inbox/eventId mỗi user. Worker có lease/retry, gọi FCM ngoài transaction; app dedup eventId. SENT chỉ nghĩa worker đã nhận kết quả gửi thành công từ FCM, không có nghĩa người dùng đã đọc hoặc thiết bị đã chắc chắn nhận.

## 8. Query patterns và indexes dự kiến

Mọi query dùng limit/cursor; mặc định 20 bản ghi, tối đa 50 trừ chat page 30. Cursor gồm ordered fields và document ID để xử lý cùng timestamp. Chỉ commit index cấu hình sau spike thực ở P00/P02; bảng sau là thiết kế cần kiểm chứng, không khẳng định index đã tạo.

P02 đã chạy query shop active và menu theo quán với browse, prefix và giá tăng dần, kể cả kết hợp danh mục. Kiểm thử Emulator xác nhận Rules và cursor. Cần Firebase thật để kiểm tra composite indexes sau khi deploy. [Tài liệu giới hạn của Firestore Emulator](https://firebase.google.com/docs/emulator-suite/connect_firestore#how_the_cloud_firestore_emulator_differs_from_production)

| Màn/luồng | Query và index dự kiến |
|---|---|
| Danh mục | categories active==true, sortOrder ASC |
| Catalog browse | menuItems shopId==S, active==true, nameKey ASC, document ID ASC; thêm categoryId equality khi chọn category |
| Search name prefix | shopId==S, active==true, nameKey prefix range, nameKey ASC, document ID ASC; categoryId equality là biến thể riêng |
| Giá | shopId==S, active==true, priceVnd range/order ASC hoặc DESC, document ID cùng hướng; categoryId equality là biến thể |
| Rating quán | shops active==true, ratingCount>0 theo query/index đã thử, ratingAverage minimum/order DESC; không filter rating riêng món trong v1 |
| History customer | orders customerUid==U, createdAt DESC, document ID DESC; thêm status equality chỉ nếu UI cần và index đã thử |
| Queue merchant | orders shopId==S, status IN tập active cố định, createdAt ASC, document ID ASC |
| Driver assigned | orders driverUid==U, status IN tập active, updatedAt DESC, document ID DESC; assignmentStatus filter chỉ thêm nếu index đã thử |
| Merchant report | orders shopId==S, status==COMPLETED, completedAt range/order; backend bounded interval, chỉ COD_CONFIRMED trong tính doanh thu |
| Chat | orders/{id}/messages sentAt DESC, document ID DESC, limit30; reverse UI để hiển thị từ cũ đến mới |
| Events | orders/{id}/events createdAt ASC, document ID ASC |
| Reviews/insights | reviews shopId==S, verifiedCompletedOrder==true, createdAt range/order DESC, document ID DESC |
| Worker | notificationOutbox status IN PENDING/RETRY, nextAttemptAt ASC; lease recovery query riêng nếu cần |
| Notifications | users/{uid}/notifications createdAt DESC, document ID DESC |

Các mode search menu v1: browse/name/price. Name prefix không đồng nghĩa substring, fuzzy, từ giữa tên hoặc full-text. Rating chỉ áp dụng danh sách quán từ shop aggregate thật, nếu query/index đã spike; không filter rating riêng món. Không hỗ trợ đồng thời q prefix + price range hoặc rating range trong menu v1; UI tắt tổ hợp đó, API trả FILTER_COMBINATION_UNSUPPORTED. Không tải tất cả records để lọc client hoặc lọc sau limit rồi tuyên bố kết quả đầy đủ.

Index tăng write/storage cost và có giới hạn nền tảng; chỉ thêm tổ hợp có query/test thật. Những trường snapshot/text dài không cần query có thể đề xuất index exemption trong implementation, sau khi kiểm tra query thực.

## 9. Ma trận đọc/ghi

| Collection | Client đọc | Client ghi Firestore |
|---|---|---|
| Active shop/category/menu | Public fields đã thiết kế; query active đúng rules | Deny |
| users/profile/addresses/cart/favorites | Chính mình active; admin listing qua API | Deny |
| devices/operations/outbox/adminAudit/voucher counters/cache | Deny, backend trả DTO tối thiểu khi cần | Deny |
| orders/events/messages | Customer của đơn, owner merchant của shop, assigned driver hợp lệ, admin; tất cả active | Deny |
| deliveryTracking/current | Participants hiện hành, active, order DELIVERING | Deny |
| reviews | Public sanitized verified reviews | Deny |
| notifications | Đúng user active | Deny |
| Voucher definitions | Bounded DTO qua API, không expose counters/user usage | Deny |

Rules không lọc field nhạy cảm của document. Dùng collection/document tách dữ liệu công khai/private; query scope phải chứng minh được điều kiện rules. Rules đọc users active và shops owner để áp dụng quyền hiện hành; chi phí lookup/caching và giới hạn access calls phải đo trong emulator/staging.

Storage: path users/{uid}/avatars/{assetId}, shops/{shopId}/menu/{assetId}, reviews/{uid}/{orderId}/{assetId}. Upload image/jpeg, image/png hoặc image/webp tối đa 5 MiB/file, app resize/compress mục tiêu ≤1 MiB. Server attach kiểm object path/metadata/quyền; không chỉ tin URL client. Pending objects private; chỉ backend có quyền đánh dấu published sau validation/attach. Storage Rules cấm client tự set/update published metadata. Review ảnh chỉ public sau review đã xác thực; không public nguyên folder đang upload pending. Publish/Firestore attach không nguyên tử xuyên dịch vụ, cần retry/cleanup orphan và kiểm reference trước publish.

## 10. Seed, dataset và acceptance dữ liệu

- Seed v1 có tài khoản giả bốn role, 1–3 shops, drivers approved, menu/stock/VND, vouchers và đơn ở các state; fixtures có seedVersion và fake flag trong manifest riêng.
- Không seed role bằng client tự đăng ký. Seed/rerun có stable IDs, cleanup có giới hạn theo dataset, không xóa tùy tiện Firebase project thật.
- Dataset hiệu năng tổng hợp đề xuất 1.000 menuItems và 10.000 orders; ghi counts từng collection, phân bố shop/status/time và timestamp generation. Seed catalog/order history riêng để đo từng điểm nghẽn; không nhầm dataset size với concurrent users.
- Synthetic COMPLETED orders có thể tạo review fixture để phát triển AI, nhưng nghiệm thu phải có review qua luồng đặt/giao/COD thật. Không đưa fixture thẳng thành bằng chứng luồng hoạt động.
- Kiểm invariants: stock không âm; reservation terminal đúng; counters không âm; per-user/global limit không vượt; COMPLETED luôn COD_CONFIRMED; price snapshot bất biến; order 1 shop; review chỉ một và verified; không public dữ liệu cá nhân.
- Emulator dùng kiểm rules/concurrency/seed. FCM/Performance/maps/model thật và số đo production-like cần staging/thiết bị; kết quả emulator không được đổi tên thành benchmark production.

## 11. Nguồn

[Firestore data structure](https://firebase.google.com/docs/firestore/manage-data/structure-data), [indexes](https://firebase.google.com/docs/firestore/query-data/indexing), [query cursors](https://firebase.google.com/docs/firestore/query-data/query-cursors), [Security Rules](https://firebase.google.com/docs/firestore/security/rules-conditions), [transactions](https://firebase.google.com/docs/firestore/manage-data/transactions), [Storage Security](https://firebase.google.com/docs/storage/security). Các field/business rules cụ thể là thiết kế v1 của nhóm.
