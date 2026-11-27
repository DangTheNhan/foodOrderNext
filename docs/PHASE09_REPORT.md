# Bàn giao FoodOrderNext v1.8

Ngày **2026-11-25**. Hồ sơ này ghi bản chạy thử local và các ca cần ký nghiệm thu cho staging.

## Tài liệu và tệp dùng khi bảo vệ

- [Slide bảo vệ 12 trang](../artifacts/releases/FoodOrderNext-BaoVe-v1.8-local.pptx)
- [APK debug x86_64 cho Android Emulator](../artifacts/releases/FoodOrderNext-v1.8-local-x86_64-debug.apk) · [Phiếu checksum và chữ ký](../artifacts/evidence/P09/android-debug-receipt.json) · [Biên bản cài sạch local](../artifacts/evidence/P09/clean-install-local.json)
- [APK staging x86_64 dùng thử](../artifacts/releases/FoodOrderNext-v1.8-staging-x86_64-test.apk) · [Phiếu checksum và chữ ký thử nghiệm](../artifacts/evidence/P09/android-staging-test-receipt.json) · [Biên bản cài sạch staging](../artifacts/evidence/P09/android-staging-smoke.json) · [Luồng ba vai trò lần lượt trên máy ảo](../artifacts/evidence/P09/android-staging-cod-journey.json)
- [Chạy local và dùng dữ liệu demo](SETUP_LOCAL.md)
- [Kiến trúc](ARCHITECTURE.md) · [Mô hình dữ liệu](DATA_MODEL.md) · [Hợp đồng API](API_CONTRACT.md) · [Kế hoạch kiểm thử](TEST_PLAN.md)
- [Hai tính năng AI và lượt chạy Ollama](PHASE07_REPORT.md) · [Benchmark trên 10.003 đơn](PHASE08_REPORT.md) · [Trạng thái từng task](BACKLOG.csv)

## Màn hình có bằng chứng local

Các route dưới đây lấy từ navigator đang chạy. Một hàng có thể dẫn đến một ca kiểm thử bao gồm nhiều màn. Cột bằng chứng ghi lượt Android đã thực hiện.

| # | Route | Hành vi đã thử | Bằng chứng |
|---:|---|---|---|
| 1 | `Login` | Đăng nhập, tải đúng phiên và vai trò | [P01](../artifacts/evidence/P01/android-smoke.json) |
| 2 | `Register` | Tạo khách, yêu cầu xác minh email | [P01 Auth](../artifacts/evidence/P01/android-auth.json) |
| 3 | `ResetPassword` | Dùng link local và đăng nhập lại | [P01 Auth](../artifacts/evidence/P01/android-auth.json) |
| 4 | `EditProfile` | Lưu rồi đọc lại thông tin qua Express | [P01](../artifacts/evidence/P01/android-smoke.json) |
| 5 | `ChangePassword` | Xác thực lại và đổi mật khẩu | [P01 Auth](../artifacts/evidence/P01/android-auth.json) |
| 6 | `customerHome` | Tải danh sách quán từ Firestore | [P02](../artifacts/evidence/P02/android-smoke.json) |
| 7 | `Shop` | Mở thông tin quán đã chọn | [P02](../artifacts/evidence/P02/android-smoke.json) |
| 8 | `ShopMenu` | Đọc thực đơn của quán | [P02](../artifacts/evidence/P02/android-smoke.json) |
| 9 | `Food` | Mở món và lưu yêu thích | [P02](../artifacts/evidence/P02/android-smoke.json) |
| 10 | `CustomerFavorites` | Danh sách lưu theo tài khoản | [P02](../artifacts/evidence/P02/android-smoke.json) |
| 11 | `CustomerCart` | Lưu lựa chọn món và tải lại sau mở app | [P02](../artifacts/evidence/P02/android-smoke.json) |
| 12 | `CheckoutDraft` | Chọn địa chỉ, nhận báo giá, tạo đơn COD | [P03](../artifacts/evidence/P03/android-smoke.json) |
| 13 | `CustomerOrderSuccess` | Hiện đơn sau khi server commit | [P03](../artifacts/evidence/P03/android-order-success.png) |
| 14 | `CustomerOrderHistory` | Đọc lịch sử sau khởi động lại | [P03](../artifacts/evidence/P03/android-smoke.json) |
| 15 | `CustomerOrderDetail` | Theo dõi trạng thái, hủy đơn chờ | [P03](../artifacts/evidence/P03/android-smoke.json) |
| 16 | `CustomerReview` | Gửi đánh giá sau thu COD | [P03](../artifacts/evidence/P03/android-smoke.json) |
| 17 | `CustomerAddressForm` | Lưu địa chỉ chữ khi chưa cấp quyền vị trí | [P02](../artifacts/evidence/P02/android-smoke.json) |
| 18 | `MenuItemEditor` | Tạo món, chọn và xuất bản ảnh | [P04](../artifacts/evidence/P04/android-smoke.json) |
| 19 | `StockEditor` | Điều chỉnh tồn và đọc giá trị đã lưu | [P04](../artifacts/evidence/P04/android-smoke.json) |
| 20 | `MerchantQueue` | Bỏ đơn đã hủy khỏi hàng chờ qua listener | [P05](../artifacts/evidence/P05/android-smoke.json) |
| 21 | `MerchantOrderDetail` | Xác nhận và đổi trạng thái đơn của quán | [P04](../artifacts/evidence/P04/android-smoke.json) |
| 22 | `AssignDriver` | Chọn tài xế đã được duyệt | [P04](../artifacts/evidence/P04/android-smoke.json) |
| 23 | `ShopReport` | Đối chiếu 65.000 VND của ngày fixture | [P04](../artifacts/evidence/P04/android-smoke.json) |
| 24 | `OrderChat` | Gửi và nhận trả lời theo đơn | [P05](../artifacts/evidence/P05/android-smoke.json) |
| 25 | `NotificationInbox` | Mở chat sau khi kiểm tra quyền hiện tại | [P05](../artifacts/evidence/P05/android-smoke.json) |
| 26 | `DriverOrderDetail` | Nhận, lấy hàng, chia sẻ vị trí mô phỏng và thu COD | [P06](../artifacts/evidence/P06/android-smoke.json) |
| 27 | `CustomerDeliveryTracking` | Hiện tọa độ theo quyền và đánh dấu vị trí cũ | [P06](../artifacts/evidence/P06/android-smoke.json) |
| 28 | `MenuAssistant` | Gợi ý từ mô hình thật rồi xác nhận thêm giỏ | [P07](../artifacts/evidence/P07/android-smoke.json) |
| 29 | `ReviewInsights` | Phân tích từ mô hình thật và mở nguồn | [P07](../artifacts/evidence/P07/android-smoke.json) |

Nguồn route là [PhaseOneNavigator.jsx](../apps/mobile/src/navigation/PhaseOneNavigator.jsx). Bằng chứng này phục vụ chuẩn bị bảo vệ. Nhóm đối chiếu lại trên bản ứng viên cuối khi nghiệm thu.

## Kịch bản trình bày

| Thời lượng | Vai trò | Thao tác và bằng chứng phải thấy |
|---|---|---|
| 0–2 phút | A, khách | Mở quán, lọc, nhờ AI chọn món, xác nhận giỏ rồi đặt COD. Giữ lại mã đơn và số tiền báo giá. |
| 2–4 phút | B, quán | Nhận cùng mã đơn, cập nhật chế biến và sẵn sàng. Chọn tài xế đã duyệt và gửi một tin nhắn. |
| 4–6 phút | C, tài xế | Nhận chuyến, lấy món, bật vị trí foreground. Để A đối chiếu timestamp. Chia sẻ vị trí tới khi C thu đúng COD. |
| 6–8 phút | A và B | A đánh giá đơn đã giao. B chạy AI với khoảng ngày có tối thiểu ba đánh giá, rồi mở một nguồn. |
| 8–10 phút | Cả nhóm | Trình bày ca đặt trùng, tranh suất cuối, vượt quyền và reconnect. So sánh số đo báo cáo ngày trong cùng lượt local. |

Demo local dùng dữ liệu tổng hợp trong phiên Emulator riêng. Để có đủ đánh giá cho AI, chuẩn bị mẫu theo [hướng dẫn local](SETUP_LOCAL.md#chạy-hai-tính-năng-ai). Khi cần phát lại, mở [trích đoạn GPS mô phỏng 60 giây](../artifacts/releases/FoodOrderNext-GPS-local.mp4), [video trợ lý món](../artifacts/evidence/P07/android-menu-flow.mp4) hoặc [video đánh giá nguồn](../artifacts/evidence/P07/android-review-flow.mp4). Luồng ba thiết bị, FCM, Firebase Performance và video toàn luồng cuối là các mục nghiệm thu staging.

## Kiểm tra APK ứng viên

APK local đã được cài trên một Android Emulator sau khi xóa dữ liệu app. Phiếu build có SHA-256 và manifest mã nguồn vì thư mục dự án hiện chưa có commit Git. APK này cần Metro, Express và Firebase Emulator. Kiểm tra bước tác vụ Google Services của release xác nhận build dừng khi thiếu cấu hình Firebase staging. [Log preflight](../artifacts/evidence/P09/release-preflight.log)

1. Ghi commit hoặc tag, version, application ID và SHA-256 APK. Dùng bản staging đã ký và API HTTPS cùng Firebase project.
2. Thành viên khác cài mới trên thiết bị thử, quay lại màn đăng nhập sau khi đổi tài khoản và thử từ chối quyền thông báo, vị trí.
3. Chạy vòng đời bộ ba trên cùng một đơn. Lưu thời điểm, mẫu thiết bị, Android version, số tiền COD, kết quả FCM và ảnh trace trong Console.
4. Ghi người thực hiện, người xác nhận, lỗi còn mở và đường dẫn evidence. Nhóm diễn tập đổi vai để mỗi người giải thích được luồng UI, quyền, Express, Firestore và AI.

| Việc cần người xác nhận | Bằng chứng để chốt |
|---|---|
| Môi trường cloud | Project ID, API HTTPS, bản Firebase Rules/indexes đã deploy và dashboard Performance |
| Cài bản ứng viên | Model thiết bị, Android version, checksum, ca cài sạch, đổi tài khoản và từ chối quyền |
| Demo ba thiết bị | Video vòng đời, FCM foreground/background/cold start và hai AI có nguồn |
| Review chéo | Kết quả chạy lại từ thành viên khác và nhật ký đóng góp đã điền |
