# Nhật ký quyết định

Ngày khởi tạo: 2026-11-03. `CONFIRMED_USER` là yêu cầu/xác nhận từ người dùng; `PLANNED` là thiết kế triển khai đã lưu, có thể điều chỉnh có lý do; `OPEN` là thông tin chưa có. Không coi một lựa chọn kỹ thuật là yêu cầu nguyên văn PDF.

| ID | Trạng thái | Quyết định | Lý do / ảnh hưởng |
|---|---|---|---|
| D01 | CONFIRMED_USER | Firebase phải giữ làm database chính | Xác nhận sau khi đối chiếu PDF; MySQL không là nguồn dữ liệu lõi |
| D02 | CONFIRMED_USER | Nhóm 3 người; lập master plan theo phase và folder mới | Tổ chức công việc A/B/C; dự án `FoodOrderNext` |
| D03 | PLANNED | Một app React Native phân quyền, Android trước | Tận dụng UI, giảm chi phí ba app/iOS chưa có thiết bị |
| D04 | PLANNED | Firestore chính + Firebase Auth; giữ Express trusted backend | Tận dụng backend, tách quyền/giá khỏi client |
| D05 | PLANNED | Không dual-write SQL; demo accounts mới là đường mặc định | Giảm rủi ro mapping/đồng bộ; bảo toàn tài khoản thật chỉ nếu có yêu cầu |
| D06 | PLANNED | 1–3 quán, một khu vực; mỗi giỏ một quán, tối đa 20 dòng | Giữ transaction/checkout đơn giản, dữ liệu bounded |
| D07 | PLANNED | Giá VND nguyên và COD; không tự đổi dữ liệu USD mẫu sang VND | Seed menu VND rõ ràng; online payment optional |
| D08 | PLANNED | Reserve suất/voucher khi tạo PENDING; release đúng một lần khi CANCELLED/REJECTED | Có test tranh chấp; không tồn âm/quota lặp |
| D09 | PLANNED | Khách hủy PENDING; quán từ chối PENDING; các terminal không ghi lùi | Không thêm refund/compensation sau accepted trong v1 |
| D10 | PLANNED | Merchant/admin gán driver approved; assignment tách order status | Không mở feed đơn nhạy cảm cho mọi driver |
| D11 | PLANNED | GPS foreground, không thêm PICKED_UP status | READY_FOR_PICKUP → DELIVERING ghi pickedUpAt; UI có stale timestamp |
| D12 | PLANNED | Chat gửi API, nhận Firestore listener; API tạo message + notification job nguyên tử | Một đường ghi, không cần triển khai trigger riêng; app tương tác hai chiều và cần demo rõ |
| D13 | PLANNED | Worker notification cùng package Express; retry + event dedup | Không hứa FCM exactly-once; trạng thái thật lấy từ DB |
| D14 | PLANNED | Hai AI: menu assistant và review insights | Hai nhu cầu/input/output/evaluation độc lập, đều bắt buộc |
| D15 | PLANNED | Query search có semantics giới hạn, không giả định Firestore có SQL LIKE/full-text | Chốt prefix/tokens/index ở spike; không tải hết catalog để lọc |
| D16 | PLANNED | Mười phase P00–P09; lịch tham khảo 10 tuần | Cần hiệu chỉnh theo năng lực/deadline thực |
| D17 | OPEN | Tên thật và thời gian của A/B/C | Điền khi nhóm cung cấp; không ngăn lập kế hoạch |
| D18 | OPEN | Deadline, rubric cá nhân của giảng viên | Cần xác nhận câu mỗi sinh viên hoàn thành độc lập và cách đếm màn |
| D19 | OPEN | Firebase project/account, AI provider/model, maps provider/key | Chọn sau spike P00, ghi quota/độ tương thích và quyền truy cập |
| D20 | OPEN | Git remote/nhánh mới và source baseline mới nhất khi bắt đầu | So sánh với snapshot đã đọc, không mặc định mã GitHub không thay đổi |
| D21 | OPEN | Thiết bị Android/mạng thử và cần nghiệm thu iOS hay không | Kế hoạch hiện nghiệm thu Android; iOS là mở rộng khi có điều kiện |
| D22 | PLANNED | Mọi mutation Firestore v1 qua Express; client chỉ đọc/listen | Bao gồm cart/favorites/message/readAt; Auth và Storage vẫn dùng native SDK với kiểm soát riêng |
| D23 | PLANNED | Entity món foodId + optionIds; options đơn giản là tùy chọn | Không tạo variantId riêng; optionGroups rỗng vẫn mua được món cơ bản |
| D24 | PLANNED | P02 đóng ở catalog/cart và form checkout; P03 tích hợp đơn thật | Tránh phụ thuộc vòng; không tính checkout hoàn thiện trước P03 |
| D25 | PLANNED | Rating xác minh theo order/shop, không per-food; menu search browse/name-prefix/price | Giữ query có index và semantics rõ; tắt tổ hợp chưa hỗ trợ, không tải hết để lọc |
| D26 | PLANNED | Chặn đổi role/active/owner khi có đơn đang xử lý; bảo vệ admin cuối | Authority/counters cập nhật nguyên tử theo DATA_MODEL; test race admin với create/assign |
| D27 | IMPLEMENTED_LOCAL | 2026-11-07: tiếp tục P01 theo yêu cầu user, đồng thời làm prerequisites P00 | P00 import/build/auth đã có bằng chứng; FCM/perf/AI spikes chưa hoàn tất, P00 chưa DONE |
| D28 | IMPLEMENTED_LOCAL | Vị trí triển khai là Documents/Codex/FoodOrderNext | Sandbox phiên triển khai chỉ cho ghi Documents/Codex; đã sao chép kế hoạch, không sửa bản ChatGPT cũ |
| D29 | IMPLEMENTED_LOCAL | RNFirebase app/auth/firestore 26.4.1 với RN0.86/Kotlin2.1.20 | Đã build Android debug; chưa nâng v27 vì native floor khác baseline |
| D30 | VERIFIED_LOCAL | Storage reserved download-token metadata được nền tảng xử lý trước Rules | Không hứa Rules từ chối trường reserved; không phát token URL private/pending; media publish UI còn ngoài P01 |
| D31 | IMPLEMENTED_LOCAL | Chặn API intent đổi principal từ lúc gọi hàm đến lúc retry | UID + generation được giữ nguyên; case đổi user trước interceptor, trong token wait và retry đều được kiểm thử |
| D32 | IMPLEMENTED_LOCAL | Bootstrap chờ registration cập nhật tên vào Auth trước | Tránh sign-in event sớm tạo profile tên mặc định; không dùng bootstrap để ghi đè profile cũ |
| D33 | IMPLEMENTED_LOCAL | Refresh cùng verified user giữ navigation/form; đổi password re-auth bằng password mới | Tránh API gặp authentication time đã bị revoke; account switch/error vẫn xóa state và chặn request cũ |
| D34 | IMPLEMENTED_LOCAL | 2026-11-19: P02 dùng catalog và dữ liệu khách theo UID trên Emulator, tiếp tục nghiệm thu P00/P01 khi có môi trường nhóm | Firestore query có giới hạn, Express ghi giỏ theo version và lưu thao tác theo key. Checkout dừng ở bước kiểm tra thông tin theo D24 |
| D35 | IMPLEMENTED_LOCAL | Sổ địa chỉ tối đa 20 mục và có thể nhập tọa độ thủ công | Mục đầu làm mặc định. Xóa mặc định chọn địa chỉ còn lại theo ID. Cài đặt mở quyền hệ thống. Kênh hỗ trợ demo là thành viên trực buổi demo |
| D36 | IMPLEMENTED_LOCAL | App xác nhận quoteKey, tổng VND và version giỏ khi đặt COD | Cùng transaction giữ suất, xác nhận voucher, tạo đơn và dọn giỏ nếu khớp. Retry giữ key và payload. Khách kiểm tra lịch sử nếu app mất phiên |
| D37 | IMPLEMENTED_LOCAL | Admin có quyền từ chối PENDING theo P03-T01. Review P03 chỉ văn bản | Admin và owner dùng cùng lệnh có audit event, state version và hoàn giữ chỗ. UI quán/tài xế theo P04/P06. Ảnh review cần kiểm chứng quy trình publish |
| D38 | IMPLEMENTED_LOCAL | Admin duyệt tài xế theo quán, merchant phân công từ danh sách đủ quyền | Duyệt có version quyền tài xế và tương thích dữ liệu seed version 0. Khi khóa hoặc đổi role cần duyệt lại. Chặn thu hồi duyệt khi còn đơn |
| D39 | IMPLEMENTED_LOCAL | Ảnh menu mới dùng bản sao riêng và Express phục vụ theo tham chiếu hiện tại | Firebase Storage giữ bản tải pending và bản publish. Client tải qua Express để tránh phát token tải xuống từ bản publish. Ảnh đã gỡ giữ theo chính sách lưu trữ |
| D40 | IMPLEMENTED_LOCAL | Báo cáo tách ngày tạo đơn khỏi ngày giao hoàn tất | Ranh giới 00:00 giờ Việt Nam. Tổng COD theo completedAt và COD_CONFIRMED. Danh sách đơn tạo có phân trang |
| D41 | IMPLEMENTED_LOCAL | Inbox ghi cùng order/event hoặc message. Worker theo lease xử lý push sau commit | Firestore lưu event ổn định và việc đã đọc. Emulator ghi SKIPPED/FCM_DISABLED. Worker restart và lỗi thử qua transport kiểm thử |
| D42 | IMPLEMENTED_LOCAL | Chat dùng ID xác định theo order, UID và clientMessageId. Mở từ thông báo kiểm quyền lại | Tài xế phải nhận chuyến và đúng phiên bản duyệt. Nếu authority thay đổi app mở lại nguồn chat |
| D43 | IMPLEMENTED_LOCAL | Hàng đợi quán và chuyến tài xế có cửa sổ realtime tối đa 60. Lịch sử khách, chat và inbox dùng listener trang mới nhất và cursor đọc trang cũ | Một listener cho mỗi nguồn đang xem. Trang cũ làm mới khi ranh giới trang mới thay đổi |
| D44 | IMPLEMENTED_LOCAL | Android xin vị trí chính xác sau khi tài xế bật chia sẻ trong màn chuyến đang giao | Rời màn chuyến hoặc vào nền hủy lượt lấy vị trí và ngừng gửi. Bộ test local dùng tọa độ mô phỏng |
| D45 | IMPLEMENTED_LOCAL | Mỗi chuyến có một vị trí mới nhất, gắn assignmentVersion | Express giới hạn khoảng thời gian và khoảng cách. Xác nhận giao và COD xóa tọa độ cùng transaction |
| D46 | IMPLEMENTED_LOCAL | Màn khách vẽ sơ đồ theo tọa độ ngay trên thiết bị | Có hướng bắc, vị trí quán, điểm giao và tài xế. Ưu tiên snapshot và hiển thị điểm thiếu tọa độ. Bản local chưa có bản đồ đường phố |
| D47 | IMPLEMENTED_LOCAL | Express gọi mô hình Ollama qua loopback với JSON Schema riêng cho mỗi tính năng | Bật bằng biến môi trường server. Có deadline, giới hạn token, lượt gọi và kết quả dự phòng |
| D48 | IMPLEMENTED_LOCAL | Mô hình chọn tổ hợp món đã kiểm tra và ưu tiên chủ đề có căn cứ trong mẫu review | Express kiểm lại món, giá và tồn trước khi trả. Thống kê sao tính từ mẫu. Cache mất hiệu lực khi fingerprint nguồn đổi |
| D49 | IMPLEMENTED_LOCAL | Bản local giới hạn tối đa 20 món ứng viên và 40 đánh giá mới nhất mỗi yêu cầu | Mẫu ít hơn 3 đánh giá trả INSUFFICIENT_DATA. Mô hình gọi từ máy chạy server |
| D50 | IMPLEMENTED_LOCAL | Trang báo cáo theo ngày có thể chỉ tải danh sách đơn khi đã có cursor | App giữ tổng lấy ở trang đầu. API mặc định vẫn trả tổng cho client cũ. P08 đo và kiểm thử cả hai chế độ |
| D51 | CONFIRMED_USER | Giữ Firebase Spark và triển khai Express staging trên hosting miễn phí | Chọn Render Free tại Singapore. Đã chuẩn bị cấu hình deploy riêng. Kiểm chứng API sau khi kết nối repo và danh tính staging |

## Quy tắc thay đổi

1. Ghi vấn đề, lựa chọn, lý do, task bị ảnh hưởng và cách kiểm chứng.
2. Cập nhật MASTER_PLAN/contract liên quan trong cùng thay đổi.
3. Nếu ảnh hưởng dữ liệu tồn tại, ghi migration/compatibility; không đổi tên field/status âm thầm.
4. Không nâng trạng thái OPEN thành CONFIRMED_USER nếu chưa có câu trả lời thực.

## Mẫu bổ sung

```text
ID / ngày / người ghi:
Trạng thái:
Vấn đề và bằng chứng:
Quyết định và lựa chọn đã cân nhắc:
Ảnh hưởng phase/API/data/test:
Cách kiểm chứng / điều kiện xem lại:
```
