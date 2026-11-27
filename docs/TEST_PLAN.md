# Kế hoạch kiểm thử và bằng chứng FoodOrderNext

Trạng thái: **chỉ là kế hoạch**. Chưa có test mới được triển khai/chạy, chưa có benchmark và chưa chứng minh đạt các mục tiêu bên dưới. Checklist chỉ được đánh dấu khi có kết quả và bằng chứng.

Phạm vi core: React Native Android một app nhiều role, Firebase là dữ liệu chính, COD, tiền VND nguyên, một nhà hàng/giỏ tối đa 20 dòng; tài xế nhận đơn do merchant gán; GPS foreground khi app mở; AI khách hàng tư vấn menu và AI merchant phân tích review đã xác minh.

## 1. Quy ước phase, môi trường và kết quả

| Phase | Trọng tâm kiểm chứng |
|---|---|
| P00 | Foundation, cấu hình, cấu trúc, tách môi trường, dữ liệu giả lập |
| P01 | Firebase Auth, profile, user role/active, migrate dữ liệu |
| P02 | Menu, tìm/lọc, giỏ, địa chỉ, yêu thích |
| P03 | Order engine, giá/tồn kho/voucher, transaction và idempotency |
| P04 | Merchant và admin tối thiểu, phân quyền |
| P05 | Realtime, chat, FCM, inbox và deep link |
| P06 | Assigned driver, foreground GPS, hoàn thành và verified review |
| P07 | Hai workflow AI riêng biệt |
| P08 | Hardening, offline/reconnect, hiệu năng và kiểm thử hồi quy |
| P09 | Release Android, demo ba điện thoại, bàn giao |

Các môi trường dùng trong bảng:

- **Unit**: logic thuần và validation với fixture cố định.
- **Emulator**: Firebase Auth/Firestore/Storage theo cấu hình của dự án; Rules tests và integration tests tách biệt. Backend là Express local, không có Cloud Functions runtime riêng trong phạm vi lõi.
- **Android thật**: build Android trên thiết bị thật, backend/staging cấu hình đúng.
- **Staging AI**: API/model thật qua server, dữ liệu tổng hợp hoặc được phép sử dụng; không gửi bí mật và dữ liệu người dùng thật không cần thiết.
- **CI mock**: provider AI/FCM/network được stub để kiểm tra hợp đồng, timeout, schema và retry; không coi đây là bằng chứng model/push thật hoạt động.

Firebase Emulator không tự chứng minh native FCM, thông báo ở nền, Android permissions, GPS thật hoặc số liệu Firebase Performance Monitoring. Những phần đó cần ca trên Android thật. Không dùng production account để thử phá quyền, tạo tải hoặc seed hàng loạt.

Mỗi lần chạy ghi: test ID, commit/build, môi trường/project ID, dữ liệu seed/version, thiết bị/Android version, mạng, thời gian, người thực hiện, steps, expected, actual, pass/fail, issue và bằng chứng. Khi có lỗi, ghi lại thao tác tái hiện và state trước/sau, không chỉ chụp toast.

## 2. Bộ tài khoản và dữ liệu cố định

- Customer A/B; mỗi người có địa chỉ, favorites và đơn riêng.
- Merchant M1 của nhà hàng R1 và M2 của R2; không dùng cùng restaurant ID.
- Driver D1/D2 đã duyệt, D3 chưa duyệt hoặc bị khóa; có assignment rõ ràng.
- Admin AD1 và user bị khóa BL1; thử thêm token còn hiệu lực nhưng `users/{uid}.active` đã đổi.
- Món đang bán, hết hàng, bị ẩn, giá thay đổi; món R1/R2 có ID khác nhau. Tiền nguyên VND; số lượng biên 0, 1, âm, thập phân, rất lớn.
- Voucher hợp lệ, hết hạn, chưa bắt đầu, hết lượt, giới hạn mỗi user, sai nhà hàng, đơn chưa đạt min spend; thời gian server được dùng làm căn cứ.
- Đơn ở đủ trạng thái: PENDING, ACCEPTED, PREPARING, READY_FOR_PICKUP, DELIVERING, COMPLETED, CANCELLED, REJECTED.
- Review đã xác minh chỉ từ đơn COMPLETED hợp lệ; dữ liệu có khen/chê/trung tính, emoji, tiếng Việt có dấu, câu dài và prompt injection.
- Seed hiệu năng tái lập: mục tiêu **10.000 đơn và 1.000 món synthetic**, phân bố theo nhiều user/nhà hàng; thêm chat/review theo fixture. Seed vào Emulator trước, dùng staging riêng khi được cấu hình phù hợp và theo dõi chi phí. Quy mô seed là kịch bản thử, không chứng minh khả năng vận hành production ở quy mô lớn.
- Password/secret của tài khoản thử không đưa vào Git. Tệp `.env.example` chỉ có tên biến và placeholder.

## 3. Foundation, auth và dữ liệu

| ID | Phase | Tình huống/thao tác | Kết quả mong đợi | Môi trường/bằng chứng |
|---|---|---|---|---|
| SETUP-01 | P00 | Cài từ clone mới theo hướng dẫn, chỉ dùng sample env | Khởi động được các thành phần cần thiết; thiếu biến có lỗi rõ; không vô tình nối production | Máy dev; log đã che secret |
| SETUP-02 | P00 | Quét file theo dõi Git và bundle/config client | Không có service-account key, model secret hoặc mật khẩu server trong source/bundle | Static check; báo cáo đường dẫn đã kiểm tra |
| DATA-01 | P01 | Seed Firestore VND mới theo đường mặc định; nếu chọn import thì chạy fixture SQL qua mapping riêng | UID/owner/ảnh/currency/timestamp và quan hệ đúng; counts khớp. Không tự đổi giá USD mẫu thành VND; nhánh import không chọn phải ghi N/A có lý do | Emulator; bảng đối chiếu |
| DATA-02 | P01 | Chạy lại migration/seed theo hợp đồng đã chọn | Không tạo bản ghi trùng ngoài chủ ý; báo lỗi record không hợp lệ và có cách rollback/reset test data | Emulator; log + counts |
| AUTH-01 | P01 | Đăng ký customer, xác minh email, đăng nhập và khởi động lại app | Session/profile nhất quán; yêu cầu xác minh được enforce đúng policy | Emulator + Android; video |
| AUTH-02 | P01 | Sai password, email trùng, email không hợp lệ, mất mạng khi login | Không vào app trái phép; thông báo phù hợp, không lộ secret; nút phục hồi được | Emulator/Android |
| AUTH-03 | P01 | Sửa role/active trong local state hoặc request đăng ký/profile | Không tự lên merchant/driver/admin; server bảo vệ field quyền | Emulator; request/response |
| AUTH-04 | P01/P04 | Khóa user test không có đơn đang xử lý, giữ token/session hợp lệ rồi gửi API và đọc Firestore riêng tư | Server kiểm tra user.role/active hiện tại; private reads bị Rules chặn theo thiết kế; claims/token cũ không đủ vượt khóa. Catalog công khai không là dữ liệu riêng tư | Emulator; API + Rules evidence |
| AUTH-05 | P01 | Đổi mật khẩu, cần re-auth; thử Google-only account | Chỉ cho thao tác phù hợp; không tạo flow đổi password giả cho tài khoản không có password | Android; account fixtures |
| AUTH-06 | P01/P08 | Logout A, login B, bấm Back, mở lại app | Không thấy cache/state/listener riêng tư của A trong UI B | Android; video |

## 4. Customer, catalog, giỏ và địa chỉ

| ID | Phase | Tình huống/thao tác | Kết quả mong đợi | Môi trường/bằng chứng |
|---|---|---|---|---|
| CAT-01 | P02 | Mở catalog lớn, cuộn nhiều trang rồi đổi filter | Trang giới hạn và cursor đúng; không tải toàn bộ; không trùng/mất dòng do nối trang sai | Emulator; query log + video |
| CAT-02 | P02 | Search prefix tiếng Việt, category và mode giá cho món; rating chỉ quán; gõ nhanh, đổi query và gửi tổ hợp chưa hỗ trợ | Query/index đúng contract; menu không giả có rating verified riêng món; tổ hợp chưa hỗ trợ bị chặn/422; debounce và response cũ không ghi đè query mới | Unit + Android |
| CAT-03 | P02 | Món bị ẩn/hết hàng/nhà hàng tạm đóng giữa lúc đang xem | UI phản ánh hợp lệ; order server kiểm tra lại, không chỉ dựa UI cũ | Emulator |
| CART-01 | P02/P03 | Thêm món R1 rồi thêm món R2 | Theo policy một nhà hàng/giỏ: cảnh báo/chuyển giỏ có xác nhận; không tạo giỏ hỗn hợp | Android |
| CART-02 | P02/P03 | 20 dòng, dòng thứ 21, số lượng âm/0/thập phân/quá lớn | UI và server cùng enforce biên; không tin kiểm tra client | Unit + API integration |
| CART-03 | P02 | Đóng/mở app, đăng nhập lại; đổi tài khoản | Giỏ và favorites được lưu đúng policy theo user; không lẫn dữ liệu | Android + Firestore assertion |
| ADDR-01 | P02 | Tạo/sửa/xóa/chọn mặc định địa chỉ; đăng nhập lại | Thay đổi tồn tại; default hợp lệ; checkout dùng snapshot địa chỉ đã chọn | Android + data assertion |
| ADDR-02 | P02 | Customer A truy cập/sửa địa chỉ/favorites của B trực tiếp | Bị chặn ở client Firestore lẫn API liên quan; không chỉ ẩn route | Emulator |

## 5. Order engine, stock, voucher và tiền

Chuỗi core được thử: `PENDING -> ACCEPTED -> PREPARING -> READY_FOR_PICKUP -> DELIVERING -> COMPLETED`; nhánh `PENDING -> CANCELLED` và `PENDING -> REJECTED`. Không cho client tự tạo transition ngoài hợp đồng.

| ID | Phase | Tình huống/thao tác | Kết quả mong đợi | Môi trường/bằng chứng |
|---|---|---|---|---|
| ORD-01 | P03 | Đặt đơn COD hợp lệ từ giỏ R1 | Một order và các snapshot đúng; tiền nguyên VND; event đầu PENDING; tồn kho/voucher cập nhật nhất quán | Emulator; before/after assertions |
| ORD-02 | P03 | Sửa giá, tổng, phí, giảm giá, shopId hoặc UID trong request | Server tự lấy dữ liệu có thẩm quyền, tính lại hoặc từ chối; không dùng tổng do client gửi | API integration |
| ORD-03 | P03 | Giá/tồn kho thay đổi sau lúc mở checkout | Server báo giá lại/từ chối rõ; không âm kho và không báo thành công giả | Emulator |
| ORD-04 | P03 | Hai user mua cùng lượng tồn kho cuối cùng đồng thời | Chỉ số đơn phù hợp thành công; không oversell; stock không âm | Concurrent integration; full state |
| ORD-05 | P03 | Voucher hết hạn/hết lượt/sai nhà hàng/không đủ min spend | Bị từ chối hoặc tính theo hợp đồng; thời gian server; không tăng usage sai | Unit + integration |
| ORD-06 | P03 | Hai user tranh lượt voucher cuối; cùng user gửi đồng thời | Giới hạn tổng và mỗi user vẫn đúng; order và usage atomic | Concurrent integration |
| ORD-07 | P03 | Gửi lại cùng payload và idempotency key do double tap/retry | Trả lại cùng kết quả/order; stock/voucher/event chỉ áp dụng một lần | Integration; counts |
| ORD-08 | P03 | Cùng key nhưng payload khác, gồm hai request đồng thời | Không trả thành công mơ hồ cho payload khác; phát hiện mismatch/xung đột theo hợp đồng; không có hai order | Concurrent integration; request hashes |
| ORD-09 | P03 | Timeout sau commit rồi client retry cùng key | Client tìm lại đúng order; không tạo key/order mới cho thao tác cũ | Fault-injection integration |
| ORD-10 | P03 | Lỗi giữa lúc tạo order, trừ stock và sử dụng voucher | Không tồn tại kết quả nửa chừng; transaction rollback/retry đúng | Emulator; assertions mọi collection |
| ORD-11 | P03/P04 | Cancel/reject hợp lệ, gửi lặp và tranh chấp với accept | Chỉ một transition thắng; hoàn stock/voucher theo policy đúng một lần; event audit nhất quán | Concurrent integration |
| ORD-12 | P03/P06 | Thử PENDING -> COMPLETED, rollback trạng thái, sửa timestamp/history từ client | Bị từ chối; event do server tạo; terminal state không bị chuyển tùy ý | API + Rules negative tests |
| ORD-13 | P03 | Sửa tên/giá món hoặc địa chỉ profile sau khi đã đặt | Lịch sử đơn giữ snapshot đã xác nhận; tổng cũ không thay đổi | Integration |
| ORD-14 | P03 | Gửi request giỏ rỗng, >20 dòng, trùng món, số VND thập phân/NaN hoặc thiếu trường | Validate ở server; không để dữ liệu hỏng hoặc exception lộ stack/secret | Unit + API fuzz cases có giới hạn |
| ORD-15 | P03/P08 | Offline/timeout lúc đặt đơn hoặc hủy đơn | Không báo server-confirmed khi chưa có xác nhận; hiển thị pending/unknown và reconcile bằng key/ID | Android; network toggling video |
| ORD-16 | P03/P06 | Hoàn thành và xác nhận thu COD; retry/double tap hoặc lỗi giữa hai phần | COMPLETED và ghi nhận COD cùng commit; số tiền server xác định; retry không ghi nhận doanh thu/COD lặp | Integration + fault injection |

## 6. Quyền, merchant và admin

Mỗi test quyền phải phân biệt hai đường: **SDK client/Firestore Rules** và **API server dùng Admin SDK**. API server không được dựa vào Rules để tự cấp quyền. Thử cả token hợp lệ có role sai và token cũ của tài khoản đã bị khóa/thu hồi quyền.

| ID | Phase | Tình huống/thao tác | Kết quả mong đợi | Môi trường/bằng chứng |
|---|---|---|---|---|
| RULE-01 | P01/P03 | Customer B đọc/sửa đơn A qua ID đoán được, query hoặc deep link | Không lấy dữ liệu riêng tư/không sửa được; API và Rules đều kiểm chứng | Emulator + Android |
| RULE-02 | P04 | M1 đọc queue/KPI, sửa món/đơn của R2 | Bị chặn; query không trả dữ liệu R2; restaurant ownership do server xác định | API + Rules tests |
| RULE-03 | P04 | Customer/driver gọi endpoint merchant hoặc admin trực tiếp | Bị từ chối dù UI ẩn route hay request chứa role admin | API negative tests |
| RULE-04 | P01/P04 | User tự sửa `users/{uid}.role/active`, owner restaurant, assignment | Client không ghi field được bảo vệ; server chỉ cho actor đúng quy trình | Rules + API tests |
| RULE-05 | P04/P08 | Admin duyệt/khóa/mở user; thử khi có active order, lock đồng thời create/assign và vô hiệu admin cuối; non-admin thử cùng request | Active-order guard/counters nguyên tử chặn xung đột409; admin cuối được bảo vệ; thao tác hợp lệ có audit, sai quyền bị chặn; không lộ secret | Concurrent integration + Rules |
| RULE-06 | P04/P06 | Merchant gán D1 approved; thử D3 chưa duyệt, sai nhà hàng/phạm vi theo policy hoặc bị khóa | Chỉ assignment hợp lệ thành công; server kiểm tra role/active/phạm vi | Integration |
| RULE-07 | P04/P06 | Hai thao tác gán/gán lại ASSIGNED đồng thời; thử gán lại sau assignment ACCEPTED | Một assignment thắng theo version; counters driver cũ/mới đúng; driver cũ mất quyền mới. Assignment đã ACCEPTED không được gán lại trong v1 | Concurrent integration |
| RULE-08 | P04/P08 | Tài khoản đổi role/active khi màn hình đang mở | UI reset phù hợp; API từ chối hành động trái quyền; listener không tiếp tục rò dữ liệu | Emulator + Android |
| MER-01 | P04 | Merchant tạo/sửa/ẩn món và đổi tồn kho hợp lệ | Dữ liệu chỉ R1; customer nhận trạng thái mới; validation giá/stock đủ | Android + integration |
| MER-02 | P04/P05 | Queue/KPI ở nhiều trạng thái, hủy/reject trong khoảng thời gian báo cáo | Số liệu khớp fixture, kỳ thời gian rõ, không nhân đôi sau retry/event lặp | Integration + screenshot số liệu |

## 7. Realtime, chat, FCM và reconnect

| ID | Phase | Tình huống/thao tác | Kết quả mong đợi | Môi trường/bằng chứng |
|---|---|---|---|---|
| RT-01 | P05 | Merchant đổi trạng thái trong khi customer mở tracking | Client cập nhật tự động; không cần refresh; ghi timestamp để đo độ trễ | 2 Android; video + logs |
| RT-02 | P05/P08 | Rời/mở màn hình nhiều lần; logout/login | Không nhân listener, không hiện event lặp; unsubscribe đúng; không nghe toàn bộ collection | Emulator + instrumentation |
| RT-03 | P05/P08 | Mất mạng, server đổi trạng thái, reconnect | Cache gắn nhãn stale/offline; đồng bộ trạng thái authoritative, không rollback bằng snapshot cũ | Android |
| RT-04 | P05/P08 | Thông tin cached cũ trong khi order/assignment/permission đã đổi | Không xác nhận lệnh dựa cache; server kiểm tra lại; UI xử lý permission-denied | Emulator + Android |
| CHAT-01 | P05 | Customer/merchant/driver được phép gửi qua `POST /api/v1/orders/:orderId/messages`, đọc/listen Firestore rồi mở lại | Hai chiều, đúng order/participants; message + outbox atomic; thứ tự và cursor history đúng | Emulator + Android |
| CHAT-02 | P05 | Outsider đọc/gửi; giả sender UID, đổi orderId hoặc member list trong API | Server từ chối trước ghi/provider; sender UID lấy từ auth; Rules chặn outsider đọc; không vượt phạm vi chat | Negative API + Rules tests |
| CHAT-03 | P05 | Bất kỳ client SDK nào create/update/delete message trực tiếp; thử sửa sender/order hoặc tin của người khác | Mọi direct client message write bị Rules từ chối, kể cả participant; chỉ Express ghi sau kiểm tra quyền | Rules + API tests |
| CHAT-04 | P05/P08 | Retry sau timeout; reconnect; gửi tin trống/quá dài | Không nhân message cho cùng client message ID; validate; trạng thái gửi/lỗi rõ | Integration + Android |
| FCM-01 | P05 | App foreground/background; đăng ký token và nhận sự kiện | Native push và inbox đúng người; nội dung không lộ thông tin nhạy cảm quá mức; ghi cấu hình thiết bị | Android thật; notification/video |
| FCM-02 | P05/P08 | Trigger/server retry và event gửi lặp; cùng user nhiều token | Không tạo nhiều notification record cho cùng business event; client dedup phù hợp; token lỗi được xử lý | CI mock + Android thật |
| FCM-03 | P05 | Từ chối permission, bật/tắt preference, mở Settings hệ điều hành | UI thể hiện trạng thái thật; preference được lưu; không coi toggle là OS permission | Android thật |
| FCM-04 | P05/P08 | Token refresh, logout, đổi từ A sang B trên cùng điện thoại | Token mapping cập nhật; B không nhận nội dung riêng tư A | Android thật |
| FCM-05 | P05/P09 | Tap thông báo/deep link khi logged out, sai role, đơn đã thu hồi quyền hoặc ID không tồn tại | Auth gate, kiểm tra quyền lại, điều hướng đúng/fallback an toàn; không leak cached order | Android thật |
| FCM-06 | P05/P09 | Thử app bị hệ điều hành dừng/thiết bị hạn chế nền theo kịch bản đã ghi | Ghi thực tế đạt/chưa đạt theo cấu hình; không suy từ emulator hoặc quảng bá bảo đảm giao push | Android thật; mô tả trạng thái app |

## 8. Tài xế, GPS foreground và review đã xác minh

| ID | Phase | Tình huống/thao tác | Kết quả mong đợi | Môi trường/bằng chứng |
|---|---|---|---|---|
| DRV-01 | P06 | D1 mở AssignedDeliveries và nhận assignment; D2 chưa được gán | Chỉ thấy đơn đã gán của mình; `assignmentStatus ASSIGNED -> ACCEPTED` riêng với order status; không có public available-jobs query | Rules/API + Android |
| DRV-02 | P06 | D1 đã nhận assignment lấy món từ READY_FOR_PICKUP, chuyển DELIVERING, hoàn thành | Transition đúng actor/state; driver chưa nhận assignment bị chặn; customer/merchant cập nhật; COD được ghi cùng lệnh hoàn tất | 3 Android + integration |
| GPS-01 | P06 | App D1 mở, cấp quyền, di chuyển thực ngoài trời hoặc test route có ghi rõ mô phỏng | Tọa độ/timestamp mới đến đúng order; throttle theo cấu hình; map customer cập nhật | Android thật; logs/video |
| GPS-02 | P06 | Từ chối/thu hồi quyền vị trí; GPS tắt hoặc không có fix | UI nói rõ; không dùng mock như dữ liệu thật; không crash hoặc báo đang tracking chính xác | Android thật |
| GPS-03 | P06 | D2/outsider đọc/ghi location của đơn D1; D1 giả orderId hoặc assignment | Bị chặn cả Rules/API; chỉ assignment hiện hành được ghi/đọc trong phạm vi cho phép | Emulator + Android |
| GPS-04 | P06/P08 | D1 tắt mạng hoặc đưa app ra nền; customer giữ map mở | Timestamp cuối và stale indicator xuất hiện theo ngưỡng; không khẳng định tracking nền | Android thật |
| GPS-05 | P06 | COMPLETED/CANCELLED/REJECTED hoặc assignment bị đổi | Dừng chia sẻ/cập nhật theo policy; driver cũ không tiếp tục gửi; không hiển thị location như còn realtime | Emulator + Android |
| GPS-06 | P06/P08 | Reconnect sau quãng mất mạng, location timestamp cũ gửi lại | Không làm vị trí mới bị ghi đè bởi dữ liệu cũ ngoài policy; dùng timestamp/sequence hợp lệ | Integration |
| REVIEW-01 | P06 | Customer A review đơn COMPLETED của mình | Một review verified gắn order/restaurant; rating hợp lệ; snapshot/nguồn đủ audit | Integration + Android |
| REVIEW-02 | P06 | B review đơn A, review trước COMPLETED, gửi trùng hoặc tự đặt verified flag | Server/Rules từ chối; chỉ review hợp lệ đi vào tập review insights | Negative integration |

## 9. Hai workflow AI: CI và đánh giá thật tách biệt

Lưu fixture đánh giá có version trong thư mục dữ liệu test phù hợp; không chứa thông tin thật không được phép dùng. CI mock chỉ kiểm tra xử lý ứng dụng. Trước P09, phải chạy một vòng staging với provider/model thật, ghi model/version cấu hình, prompt version, thời điểm, số mẫu, kết quả và lỗi.

Tập đề xuất ban đầu: **20 câu hỏi menu** (ngân sách, khẩu vị, món đang hết, yêu cầu không có, tiếng Việt có dấu, nội dung gây nhiễu) và **10 tập review** có đáp án/chủ đề tham chiếu do nhóm tự gắn nhãn. Số mẫu là mức khởi đầu đề xuất, chưa phải bộ đánh giá đã xây dựng hoặc kết quả đạt.

| ID | Phase | Tình huống/thao tác | Kết quả mong đợi | Môi trường/bằng chứng |
|---|---|---|---|---|
| AI-MENU-01 | P07 | Hỏi món theo ngân sách/khẩu vị từ menu R1 | Món trả về tồn tại, đúng nhà hàng, đang bán; giá lấy server; bấm mở/thêm giỏ được | CI mock + staging AI |
| AI-MENU-02 | P07 | Provider trả ID sai, hết hàng, giá bịa, schema lỗi | Server loại/từ chối/reconcile; không tạo order/giỏ với món giả; fallback được ghi rõ | Contract tests |
| AI-MENU-03 | P07 | Câu hỏi không có món phù hợp hoặc menu không đủ dữ liệu | Nói rõ thiếu/không tìm thấy; không bịa món hoặc lời hứa an toàn/thành phần chưa có dữ liệu | Staging AI; human rubric |
| AI-MENU-04 | P07 | Prompt injection trong input/menu; yêu cầu đọc dữ liệu người khác hoặc tự đặt đơn | Không lộ secret/dữ liệu riêng tư; không thực thi hành động ngoài quyền; user vẫn phải xác nhận thêm giỏ/đặt | Security/contract + staging |
| AI-REV-01 | P07 | M1 phân tích review verified của R1 trong khoảng thời gian chọn | Có số mẫu/phạm vi, nhóm điểm tốt/vấn đề, dẫn chứng tương ứng và đề xuất; không pha dữ liệu R2 | CI mock + staging AI |
| AI-REV-02 | P07 | M2/customer gửi shopId R1 hoặc reviewIDs thuộc R1 | Bị từ chối trước provider; truy vấn AI không tạo đường bypass quyền | API integration |
| AI-REV-03 | P07 | Không có review, ít review hoặc tất cả chỉ rating không có nội dung | Hiển thị insufficient data/giới hạn; không tự tạo xu hướng hoặc câu trích dẫn | Contract + staging |
| AI-REV-04 | P07 | Review chứa chỉ dẫn đổi role, lộ key hoặc bịa trích dẫn | Review được xem là dữ liệu; dẫn chứng chỉ từ input hợp lệ; không thực thi chỉ dẫn | Contract + staging |
| AI-COM-01 | P07/P08 | Timeout/429/5xx, user retry nhiều lần | Retry có giới hạn, rate limit và thông điệp phù hợp; không duplicate chi phí vô hạn; không ghi fallback là AI thành công | CI mock + staging có kiểm soát |
| AI-COM-02 | P07 | Kiểm tra app bundle/log/request, server logs | API key chỉ ở server; che/redact dữ liệu nhạy cảm; output schema được validate | Static + integration |
| AI-EVAL-01 | P07/P09 | Chạy dataset cố định, hai thành viên review kết quả độc lập | Báo tỷ lệ ID hợp lệ, constraint đúng, dẫn chứng đúng, hữu ích và latency/lỗi; lưu cả failure; không chỉ chọn demo đẹp | Staging AI; bảng đánh giá |

Rubric đề xuất mỗi kết quả: factual validity, đúng ràng buộc, đúng phạm vi quyền, dẫn chứng/giải thích, có ích cho thao tác tiếp theo. Với review insights, đối chiếu chủ đề model nêu với nhãn tham chiếu và kiểm tra toàn bộ dẫn chứng. Không ghi tỷ lệ đạt hoặc kết luận model tốt khi chưa chạy.

## 10. Hiệu năng và độ ổn định

Các con số sau là **giả thuyết/mục tiêu đề xuất**, không phải SLA và chưa phải số đo đạt được:

- Trang đầu đọc tối đa 20 bản ghi nghiệp vụ trong query chuẩn; mục tiêu tải trang đầu <=2 giây trên thiết bị/mạng đã ghi rõ.
- Realtime thay đổi trạng thái: mục tiêu p95 <=2 giây trên Wi-Fi ổn định trong kịch bản đo đã mô tả.
- Dữ liệu seed 10.000 đơn/1.000 món; kết luận chỉ trong phạm vi dataset, thiết bị, mạng và mức đồng thời đã thử.

| ID | Phase | Kịch bản và phép đo | Bằng chứng/điều kiện |
|---|---|---|---|
| PERF-01 | P08 | Catalog/order history từ seed lớn: cold/warm load, trang đầu 20, nhiều trang, đổi filter | Đo release Android; số query/reads, thời gian first usable content, p50/p95 nếu đủ mẫu; không tải toàn bộ collection |
| PERF-02 | P08 | Ít nhất 30 lần thay đổi trạng thái độc lập, ghi server commit time và client nhận/render | Tính p50/p95 và n; mô tả clock/time-sync, mạng, thiết bị; tránh lấy đồng hồ hai máy chưa hiệu chỉnh rồi kết luận chính xác |
| PERF-03 | P08 | 20 lượt mở/đóng route tracking/chat và chuyển tài khoản | Theo dõi listener còn hoạt động, duplicate events, memory tăng bất thường và reads; kiểm chứng cleanup |
| PERF-04 | P08 | Đo trước/sau pagination/cache/throttle/ảnh tối ưu với cùng dataset và điều kiện | Bảng so sánh có phương pháp; ghi cả cache lạnh/ấm; không so hai tình huống mạng khác nhau |
| PERF-05 | P08 | Firebase Performance traces cho `load_catalog`, `place_order`, `load_order_history`, luồng AI theo thiết kế | Android thật, ảnh console/log trace và build/version; chỉ cài SDK chưa đủ chứng minh đã thu thập dữ liệu |
| PERF-06 | P08 | Mạng chậm, packet loss/mất mạng có kiểm soát, GPS update bị dồn | UI phục hồi, timeout hợp lý, server không duplicate lệnh; không dùng bài đo này để hứa realtime <=2 giây trên mọi mạng |

Lưu số đo thô CSV/JSON, công thức tính percentile, ảnh Firebase Performance, cấu hình release và ghi chú ngoại lệ. Debug build, Emulator và Android release được báo cáo riêng. Nếu không đạt mục tiêu, báo số đo thật và nguyên nhân; không đổi nhãn thành đạt.

## 11. Release, hồi quy và demo ba điện thoại

| ID | Phase | Thao tác | Điều kiện đạt |
|---|---|---|---|
| REL-01 | P09 | Build Android release từ commit được gắn nhãn, cài sạch trên thiết bị mục tiêu | Mở được app, đúng Firebase/staging, không kèm debug secret; checklist cài đặt tái lập |
| REL-02 | P09 | Smoke auth/catalog/order/merchant/driver/chat/2 AI sau build release | Không dùng kết quả debug cũ để thay; ghi build thực và pass/fail |
| REL-03 | P09 | Kiểm tra permission prompts, error boundary/crash, startup và phục hồi app | Không crash trên luồng demo; lỗi được xử lý; giới hạn nền/GPS được nói đúng |
| REL-04 | P09 | Đối chiếu SCREEN_MAP, requirement matrix, dữ liệu demo và slide | Route đã hoàn thành có bằng chứng; phần chưa xong ghi rõ; presentation 10–15 slide do kế hoạch bàn giao quản lý |

### Kịch bản demo chính

Chuẩn bị ba điện thoại Android: **A customer**, **B merchant R1**, **C driver D1 đã duyệt**; một cách đăng nhập admin riêng để demo user management sau luồng chính. Ghi build, mạng và ID seed. Không giả vờ admin là tài khoản merchant được tự nâng quyền.

1. A mở menu và MenuAssistant, hỏi một nhu cầu có món phù hợp trong fixture. Mở món thật từ kết quả, thêm giỏ; địa chỉ/favorites đã lưu vẫn còn sau mở lại app.
2. A checkout COD, thấy giá VND do server xác nhận, đặt đúng một đơn. B nhận đơn trong queue mà không refresh.
3. B ACCEPTED -> PREPARING -> READY_FOR_PICKUP; A thấy timeline đổi. B gán D1 approved; C thấy đơn trong **AssignedDeliveries** và nhận assignment (field riêng với order status), không có danh sách chuyến công khai.
4. A/B/C chat theo quyền participant; thử thông báo inbox/deep link và một push trên thiết bị đã cấu hình permission.
5. C xác nhận lấy món -> DELIVERING. Giữ app C mở/foreground, cập nhật GPS; A xem map và timestamp. Tạm ngắt mạng C để A thấy stale, sau đó reconnect. Nói rõ đây là foreground tracking.
6. C hoàn thành -> COMPLETED. A gửi một verified review. B mở ReviewInsights, chọn tập review đủ mẫu và chạy workflow AI thứ hai; đối chiếu số mẫu/dẫn chứng.
7. Minh họa một ca từ chối quyền có chuẩn bị, ví dụ customer B không xem đơn A hoặc M2 không đọc đơn R1; không sửa role bằng màn hình dev để bỏ qua quyền.
8. Mở admin UserManagement để khóa một test user; chứng minh API/đọc client bị hạn chế theo policy. Kết thúc bằng bảng đo Performance và số liệu thực đã thu thập, không chỉ screenshot giao diện.

Kịch bản dự phòng: dùng fixture tổng hợp, cached dataset và ghi rõ phần model/push/network đang unavailable. Video dự phòng được gắn nhãn quay trước; không mô tả video/mock là luồng trực tiếp.

## 12. Cổng nghiệm thu và lưu bằng chứng

- P01–P04: happy path cùng các negative authorization tests phải đạt trước khi thêm AI/realtime UI vào luồng chính.
- P03: ORD-04, ORD-06–ORD-12 là cổng bắt buộc cho tính đúng đắn transaction/concurrency/idempotency.
- P05–P06: có bằng chứng trên Android thật cho realtime, FCM permissions/deep link và foreground GPS; Emulator pass không thay thế.
- P07: cả MenuAssistant và ReviewInsights đã tích hợp, chạy model thật ít nhất một vòng đánh giá có lưu kết quả; CI mock không thay thế.
- P08–P09: chạy hồi quy các ca quyền, atomic order và offline/reconnect trên build cuối; đo release Android; lỗi nghiêm trọng rò dữ liệu, tạo đơn/trừ stock/voucher lặp hoặc vượt role phải được sửa trước bàn giao.
- Mọi test bị bỏ qua có lý do, ảnh hưởng và cách demo thay thế; không đánh dấu pass khi chưa chạy.

Thư mục bằng chứng đề xuất: `artifacts/evidence/Pxx/<run-id>/` chứa `run-summary.md`, kết quả tự động, log đã che dữ liệu nhạy cảm, ảnh/video và số đo thô. Tên run có ngày, commit ngắn và môi trường. Chỉ lưu dữ liệu synthetic hoặc được phép; không commit token/service-account key vào artifact.

Đây là chiến lược kiểm chứng dự kiến. Khi triển khai, bổ sung test thực phù hợp với code, không viết test chỉ lặp lại chi tiết implementation hoặc dùng screenshot để thay việc kiểm tra quyền và dữ liệu.
