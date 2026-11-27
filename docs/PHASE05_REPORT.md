# Nghiệm thu P05 · Realtime, chat và thông báo

Cập nhật **2026-11-19**. P05 hoàn tất **6/8 task**. P05 dùng Express để ghi command và Firestore để đồng bộ trạng thái. Môi trường local dùng Firebase Emulator `demo-foodordernext`.

- Đơn khách, hàng đợi quán và chuyến tài xế dùng query theo quyền. Listener gỡ khi rời màn hình hoặc đổi phiên. Chi tiết giữ trạng thái gần nhất khi mất kết nối, hiển thị nhãn chưa cập nhật và khóa thao tác cho đến khi xác nhận lại.
- Chat gửi qua Express, phân trang theo thời điểm và ID. Khách sở hữu, chủ quán và tài xế có chuyến đã nhận và còn được duyệt có thể gửi trong đơn đang hoạt động. Admin có quyền đọc. Khi đơn kết thúc, chat giữ lịch sử và đóng gửi tin mới.
- Message, inbox và outbox ghi cùng transaction. Retry cùng clientMessageId và nội dung trả cùng tin. Hộp thư có trạng thái đã đọc và đọc lại quyền trước khi mở đơn hoặc chat.
- Worker nằm trong Express, lấy lease 60 giây, retry theo backoff, tối đa 5 lần. Worker xử lý token hết hiệu lực theo binding hiện tại, giữ dấu token đã gửi và dùng eventId để giảm trùng. Chế độ local kết thúc trạng thái push ở SKIPPED với mã FCM_DISABLED. Hộp thư vẫn chạy.

## Kết quả kiểm thử

| Bộ kiểm tra | Kết quả | Bằng chứng |
|---|---|---|
| Unit API, contracts, seed/migration | 46 kiểm tra đạt, gồm chốt từ chối FCM trong demo | [Log](../artifacts/evidence/P05/unit-tests.log) |
| React Native | 39 ca hồi quy đạt, ESLint phạm vi P05 đạt | [Unit](../artifacts/evidence/P05/mobile-unit-tests.log), [lint](../artifacts/evidence/P05/mobile-lint.log) |
| Firebase Emulator | 51 kiểm tra đạt. Ba client Auth độc lập nhận đơn/chat, thử ngắt và nối lại Firestore, phân trang, quyền chat, token và worker restart | [Log](../artifacts/evidence/P05/emulator-tests.log) |
| Android APK debug x86_64 | BUILD SUCCESSFUL với RNFirebase Messaging và kênh order-updates | [Build](../artifacts/evidence/P05/android-build.log) |
| Android Emulator | 5 nhóm ca đạt. Khách gửi và nhận chat, mở chat từ hộp thư. Quán thấy đơn đã hủy rời hàng đợi. Tài xế mở và gửi chat cho chuyến đã được nhận trong dữ liệu mẫu | [Smoke](../artifacts/evidence/P05/android-smoke.json) |
| Đối chiếu Firestore sau smoke | Hai tin của khách và quán, một tin của tài xế, hộp thư đã đọc, đơn CANCELLED và ba job chat SKIPPED khi FCM tắt | [Kết quả](../artifacts/evidence/P05/android-firestore-check.json) |
| Khởi động lại Android | 3/3 lần mở lại về đúng danh sách chuyến của tài xế sau khi chuyển khóa phiên xuống nhóm màn hình | [Kết quả](../artifacts/evidence/P05/android-restarts.json) |

Trong lượt thử ba client SDK trên cùng máy, thời gian từ commit tới listener là 85–87 ms khi tạo đơn, 59 ms khi gán tài xế và 35–36 ms khi quán trả lời. Quán nhận tin mới trong 27 ms tính từ lúc bật lại mạng SDK. Đây là một lượt local với đồng hồ cùng máy. [Số đo](../artifacts/evidence/P05/realtime-measurements.json)

Ảnh từ máy ảo trong lượt chạy đạt. [Chat hai chiều](../artifacts/evidence/P05/android-two-way-chat.png), [hộp thư](../artifacts/evidence/P05/android-notification-inbox.png), [hàng đợi sau khi hủy](../artifacts/evidence/P05/android-queue-after-cancel.png), [chi tiết chuyến](../artifacts/evidence/P05/android-driver-trip.png), [chat tài xế](../artifacts/evidence/P05/android-driver-chat.png).

Một lượt mở lại trước khi sửa điều hướng gặp SIGSEGV trong React Native Fabric. Lượt smoke và ba lần mở lại sau sửa đều đạt trên cùng máy ảo. [Log lượt bị gián đoạn](../artifacts/evidence/P05/android-native-crash.log)

## Nghiệm thu FCM thật

1. Dùng Firebase staging của nhóm và Android có Google Play Services. Cấu hình ứng dụng Android cùng project với backend, gắn cấu hình native staging và API HTTPS.
2. Triển khai Firestore Rules và indexes. Backend dùng credential có quyền gửi FCM. Đặt `FCM_SEND_ENABLED=true` cùng cấu hình cloud đã mô tả trong SETUP_LOCAL. Giữ cấu hình demo riêng.
3. Với tài khoản riêng cho khách, quán và tài xế, kiểm tra bật/tắt trong app, quyền Android, foreground, background, mở từ trạng thái app đã tắt và đổi tài khoản trên cùng máy. Kiểm tra bấm thông báo cũ sau khi mất quyền. Ghi eventId và kết quả, bỏ token khỏi bằng chứng.
4. Hộp thư là đường khôi phục khi push bị chặn. Nếu mất mạng khi đăng xuất, gỡ binding phía server có thể chưa hoàn tất. Lần đăng nhập sau sẽ đổi binding thiết bị, worker kiểm tra quyền và tag khóa màn hình chỉ hiển thị nội dung chung.

Kiểm tra staging ngày 26/11/2026 xác nhận FCM HTTP v1 đã bật. Worker ghi `SKIPPED:FCM_DISABLED` cho cả 11 job của đơn realtime. Service account Render chỉ có hai vai trò trực tiếp cho Firestore và đọc Firebase Auth. Cần cấp quyền gửi FCM trong phạm vi project staging và bật `FCM_SEND_ENABLED` trên Render trước khi chạy ca nhận push. [Bằng chứng staging](../artifacts/evidence/P05/staging-push-preflight.json) · [Quyền IAM của FCM](https://docs.cloud.google.com/iam/docs/roles-permissions/firebasecloudmessaging)

Kiểm thử APK staging trên Android Emulator API 37 xác nhận quyền Android điều khiển đăng ký của thiết bị. Tắt thông báo gỡ đăng ký. Bật lại tái sử dụng cùng cài đặt. Đăng xuất xóa đăng ký, sau đó script đưa tùy chọn khách demo về tắt. Biên bản ghi các trường trạng thái của đăng ký. Ca nhận và bấm mở push trên Android còn chờ cấu hình quyền gửi staging. [Biên bản Android](../artifacts/evidence/P05/staging-push-device.json)

Các ca worker dùng mã lỗi từ transport được bơm trong test. Lượt này chưa gửi push đến Firebase thật và chưa dùng ba thiết bị vật lý. Tham khảo [RNFirebase Messaging usage](https://rnfirebase.io/messaging/usage), [xử lý thao tác từ thông báo](https://rnfirebase.io/messaging/notifications) và [mã lỗi FCM](https://firebase.google.com/docs/cloud-messaging/error-codes).

## Realtime trên staging

Ngày 26/11/2026, ba phiên Auth chạy đồng thời trên cùng máy và dùng các truy vấn Firestore của app. Khách và quán nhận đơn mới. Tài xế nhận chuyến sau khi được gán và chỉ đọc chat sau khi nhận chuyến. Cả ba nhìn thấy trạng thái đã giao và thu COD.

Gửi lại tin chỉ giữ một bản. Ba tin thử tạo ba job chat trong outbox. Hộp thư của quán không đọc được từ phiên khách. Khi quán ngắt mạng SDK, khách và tài xế nhận tin mới, còn quán nhận đủ ba tin **188 ms** sau khi bật lại mạng SDK. [Biên bản staging](../artifacts/evidence/P05/staging-realtime.json)

Trong lượt đo này, hai listener thấy đơn mới sau phản hồi API **59–64 ms**. Ba listener thấy trạng thái thu COD sau phản hồi API **30–91 ms**. Đây là thời gian từ phản hồi API đến callback SDK trong một lượt đo cùng máy. Còn nghiệm thu FCM và chạy các màn Android đồng thời trên nhiều thiết bị.
