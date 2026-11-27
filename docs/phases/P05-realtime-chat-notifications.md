# P05 — Realtime, chat theo đơn và thông báo

**Trạng thái:** DONE  
**Chủ trì:** C; A/B tích hợp màn hình theo vai trò  
**Phụ thuộc:** [P03](P03-order-engine.md), [P04](P04-merchant-admin.md); bản thử native từ P00.  
**Nguồn thống nhất:** [MASTER_PLAN](../MASTER_PLAN.md).

## Mục tiêu

Kết nối tương tác hai chiều: người dùng gửi command qua Express, các bên liên quan nhận thay đổi ngay bằng Firestore listener. Chat gửi qua POST /api/v1/orders/:orderId/messages để message và outbox được ghi atomically; không thêm Socket.IO hoặc Cloud Function song song. FCM là thông báo hỗ trợ, không phải nguồn trạng thái đơn.

## Công việc

- [x] **P05-T01** — **[C]** Định nghĩa eventId, order version và phạm vi listener cho customer order, merchant queue, assigned driver và chat. Query chỉ dữ liệu người dùng có quyền; unsubscribe khi đổi màn hình/tài khoản và không tạo listener trùng khi navigation rerender.
- [x] **P05-T02** — **[A]** Tích hợp listener vào chi tiết/lịch sử đơn khách, có loading/error/offline/stale và refresh sau reconnect. Không ghi trạng thái local vượt server; xử lý response command đến sau event mà không làm UI quay về trạng thái cũ.
- [x] **P05-T03** — **[B]** Tích hợp queue merchant và nhiệm vụ driver nhận dữ liệu realtime theo quyền. Kiểm tra quán đổi trạng thái thì khách/driver thấy cập nhật; khách hủy PENDING thì quán thấy đơn kết thúc mà không cần tải toàn bộ queue.
- [x] **P05-T04** — **[C]** Làm chat theo order với server xác minh participant và trạng thái được gửi; POST message có clientMessageId/idempotency. Ghi message và outbox trong cùng transaction; Firestore listener đọc chat scoped, pagination lịch sử, chống gửi trùng và hiển thị gửi lỗi/retry rõ.
- [x] **P05-T05** — **[C]** Quản lý device token theo uid/thiết bị, quyền notification, token refresh và logout. Cấu hình FCM payload mở đúng order sau kiểm tra quyền; tránh đưa địa chỉ, số điện thoại hoặc nội dung nhạy cảm vào notification ngoài màn hình khóa.
  - Đã bật `roles/firebasecloudmessaging.admin` cho `render-express-staging` và `FCM_SEND_ENABLED=true` trên Render; kiểm thử thực tế trên `Pixel_9` đạt cả 3 ca foreground (Alert mở đơn), background (nội dung chung không lộ PII, bấm mở chat) và cold start từ Recents (mở đơn), 3/3 job outbox `SENT`. [Biên bản FCM thật](../../artifacts/evidence/P05/live-fcm/staging-fcm-live.json) · [Vòng đời đăng ký](../../artifacts/evidence/P05/staging-push-device.json)
- [x] **P05-T06** — **[C]** Làm worker outbox trong kiến trúc backend Express duy nhất: claim/lock tác vụ, retry có backoff, giới hạn lần thử, lưu lỗi cuối và đường xử lý lỗi vĩnh viễn. Gửi FCM sau commit; eventId giúp chống hiển thị trùng, không tuyên bố gửi exactly-once khi provider có thể nhận lại.
- [x] **P05-T07** — **[A]** Làm inbox thông báo/read-unread có dữ liệu thật, mở đúng đơn/chat và kiểm tra lại quyền hiện tại. Mất push không làm mất trạng thái: mở app vẫn truy vấn/subscribe dữ liệu chính; push cũ không được ghi đè state mới.
- [x] **P05-T08** — **[ALL]** Kiểm thử ba thiết bị, chat hai phía, reconnect, ứng dụng background, FCM lỗi/token invalid và worker restart. Đo thời gian từ command commit đến UI nhận trên cùng môi trường; lưu kết quả thật, kiểm tra message/event/outbox không bị nhân đôi bởi retry.

Đã hoàn tất 3 máy ảo đồng thời (`Pixel_9`, `Pixel_9_2`, `Pixel_9_3` theo D52), chat 3 bên live, ngắt/nối mạng (`2,55s`), 3/3 ca FCM thật trên staging và bộ kiểm thử worker/outbox. [Biên bản 3 máy ảo](../../artifacts/evidence/P09/three-device/three-device-staging-result.json) · [Biên bản FCM thật](../../artifacts/evidence/P05/live-fcm/staging-fcm-live.json) · [Biên bản 3 phiên SDK](../../artifacts/evidence/P05/staging-realtime.json)

## Sản phẩm bàn giao

Listener lifecycle/scoped queries, chat order có API idempotent, inbox và FCM deep link, outbox worker/retry cùng hướng dẫn xử lý lỗi. Không phụ thuộc một kết nối WebSocket riêng hoặc thêm backend thứ hai.

## Kiểm thử nghiệm thu và cổng hoàn thành

1. Khách/quán gửi hành động từ thiết bị khác nhau và cùng thấy trạng thái hiện hành.
2. Chat hai phía gửi/nhận thật; gửi lại cùng clientMessageId không tạo hai message.
3. User ngoài order không đọc/gửi chat; token/quyền thay đổi được kiểm tra lại.
4. Logout/rời màn hình gỡ listener; reconnect không nhân đôi sự kiện hoặc đưa UI về version cũ.
5. Worker retry không mất outbox sau restart; lỗi FCM có trạng thái theo dõi và không rollback order.
6. Notification mở đúng đơn có quyền; mở app không nhận push vẫn thấy dữ liệu đúng.
7. Có bằng chứng realtime hai chiều từ thao tác thực, không chỉ ảnh tĩnh.

## Rủi ro

FCM có thể chậm hoặc bị chặn bởi hệ điều hành; listener/query vẫn là nguồn dữ liệu. Worker có thể xử lý lặp; dùng ID ổn định, retry có giới hạn và không coi push exactly-once. Listener rộng làm tăng đọc/chi phí; scope query và unsubscribe bắt buộc.

## Bằng chứng cần lưu

artifacts/evidence/P05/: video ba vai trò/chat hai phía, log eventId/commit/receive đã che token, lỗi/retry outbox, kết quả worker restart và FCM foreground/background/deep link. Không lưu token thiết bị trong tài liệu công khai.

## Bàn giao tiếp theo

Assigned-job notification và realtime contract cho [P06](P06-driver-tracking.md); số đo nền/listener/outbox cho [P08](P08-hardening-performance.md). Cập nhật mô tả tương tác hai chiều trong tài liệu kiến trúc và slide.

## Kết quả local

Hoàn tất 6/8 task. T05 và T08 chờ kiểm Firebase staging và ba thiết bị vật lý. Xem [báo cáo P05](../PHASE05_REPORT.md).
