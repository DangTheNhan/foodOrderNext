# Bản đồ màn hình và điều hướng FoodOrderNext

Trạng thái: **kế hoạch triển khai**, chưa có màn hình mới được lập trình hoặc kiểm thử trong thư mục này. Phạm vi chính là một ứng dụng React Native Android dùng chung cho khách hàng, nhà hàng, tài xế và quản trị viên; Firebase là nền tảng dữ liệu chính.

## 1. Cách đọc và cách đếm

- Baseline tham chiếu: repository `DangTheNhan/foodOrder_Mobile`, commit `1bc4eabed01d1b975a60cf8e66396888a4538b07`, có 27 file `*Screen.jsx` trong `FoodOrderingApp/src/screens`.
- Tái sử dụng nghĩa là giữ phần giao diện phù hợp và thay nguồn dữ liệu/nghiệp vụ; không có nghĩa tính năng hiện tại đã đáp ứng yêu cầu mới.
- Một component đăng ký ở hai stack vẫn chỉ là một màn hình. Chế độ tạo/sửa, trạng thái lọc và modal xác nhận không được nhân thành các màn hình riêng.
- Mục tiêu inventory: **37 màn hình xác thực/nghiệp vụ + 4 UI tiện ích = 41 component/route riêng** sau khi gộp danh sách. Đây là mục tiêu nhóm đề xuất, **không phải số lượng giảng viên đã công nhận**.
- Bốn UI tiện ích là Splash, Onboarding, Filter modal và OrderSuccess. Nhóm không dựa vào chúng để chứng minh phạm vi vượt mức tối thiểu.
- Có thể gộp thêm màn hình trong triển khai nếu trải nghiệm tốt hơn; phải cập nhật bảng inventory và vẫn giữ đầy đủ luồng nghiệp vụ. Chất lượng realtime, dữ liệu, AI và bằng chứng kiểm thử được ưu tiên hơn số route.

## 2. Ánh xạ toàn bộ 27 file baseline

Đường dẫn dưới đây tương đối với `FoodOrderingApp/src/screens` của repository gốc.

| # | File baseline | Route đích | Cách xử lý | Phase chính |
|---|---|---|---|---|
| 01 | `Auth/SplashScreen.jsx` | `Splash` | Tái sử dụng giao diện; khôi phục Firebase session và nạp role/active; không tin role lưu local | P01 |
| 02 | `Auth/OnboardingScreen.jsx` | `Onboarding` | Tái sử dụng; lưu cờ đã xem; UI tiện ích | P02 |
| 03 | `Auth/LoginScreen.jsx` | `Login` | Thay luồng xác thực sang Firebase Auth; lỗi có thông điệp rõ ràng | P01 |
| 04 | `Auth/RegisterScreen.jsx` | `Register` | Đăng ký khách hàng; client không tự cấp role merchant/driver/admin | P01 |
| 05 | `Auth/EmailVerificationScreen.jsx` | `EmailVerification` | Chuyển sang cơ chế xác minh email Firebase; không giữ nhầm giả định OTP backend cũ | P01 |
| 06 | `Home/HomeScreen.jsx` | `CustomerHome` | Dữ liệu thật, tải giới hạn, trạng thái lỗi/cache; liên kết trợ lý menu | P02 |
| 07 | `Home/SearchScreen.jsx` | `Search` | Tìm/lọc có tác dụng, debounce, phân trang; không gọi lọc rating là AI | P02 |
| 08 | `Home/FilterScreen.jsx` | `FilterModal` | Modal dùng chung theo mode: món có danh mục/giá, quán có rating aggregate thật nếu index hỗ trợ; tắt tổ hợp chưa hỗ trợ, không đếm modal thành màn nghiệp vụ | P02 |
| 09 | `Home/FoodDetailScreen.jsx` | `FoodDetail` | Giá VND nguyên, trạng thái bán, nhà hàng, liên kết đánh giá quán đã xác minh; thêm giỏ hợp lệ | P02 |
| 10 | `Home/MenuScreen.jsx` | `FoodCatalog` | Gộp thành danh sách có tham số và phân trang | P02 |
| 11 | `Home/PopularFoodsScreen.jsx` | `FoodCatalog` | Gộp; chỉ giữ nhãn/sort phổ biến nếu có số bán và index đã kiểm chứng, nếu không thì bỏ nhãn và dùng catalog chuẩn | P02 |
| 12 | `Home/FlashSaleScreen.jsx` | `FoodCatalog` | Gộp; hiển thị dữ liệu ưu đãi hợp lệ nếu có, không dùng countdown cố định để chứng minh nghiệp vụ | P02/P03 |
| 13 | `Home/RecommendedFoodsScreen.jsx` | `FoodCatalog` | Gộp thành danh sách được chọn/đề xuất thông thường; không tuyên bố đây là AI cá nhân hóa | P02 |
| 14 | `Home/RestaurantsScreen.jsx` | `Restaurants` | Danh sách nhà hàng hoạt động, phân trang và trạng thái mở cửa | P02 |
| 15 | `Home/RestaurantDetailScreen.jsx` | `RestaurantDetail` | Thông tin, menu, review của đúng nhà hàng | P02 |
| 16 | `Home/FavoriteScreen.jsx` | `Favorites` | Lưu theo Firebase UID; tồn tại sau đăng nhập lại; không lộ danh sách user khác | P02 |
| 17 | `Cart/CartScreen.jsx` | `Cart` | Một nhà hàng/giỏ; tối đa 20 dòng; số lượng nguyên hợp lệ; lưu bền vững | P02/P03 |
| 18 | `Cart/CheckoutScreen.jsx` | `Checkout` | Chọn địa chỉ đã lưu, ghi chú, kiểm tra giỏ; server xác nhận giá/phí/voucher | P03 |
| 19 | `Cart/PaymentScreen.jsx` | `Payment` | Chỉ COD trong core; hiển thị xác nhận tổng tiền; không mô phỏng thanh toán online thành công | P03 |
| 20 | `Cart/OrderSuccessScreen.jsx` | `OrderSuccess` | Chỉ xuất hiện sau server commit; retry dùng cùng idempotency key; UI tiện ích | P03 |
| 21 | `Cart/TrackOrderScreen.jsx` | `TrackOrder` | Bỏ mock courier/ETA/current step; trạng thái thật, bản đồ vị trí foreground và timestamp | P05/P06 |
| 22 | `Order/OrderHistoryScreen.jsx` | `OrderHistory` | Query theo UID/status, cursor pagination; cache có nhãn | P03/P08 |
| 23 | `Order/OrderDetailScreen.jsx` | `CustomerOrderDetail` | Đơn thật, event history, hủy đúng điều kiện, chat và đánh giá sau hoàn thành | P03/P06 |
| 24 | `Profile/ProfileScreen.jsx` | `Profile` | Hồ sơ theo Firebase UID; liên kết địa chỉ, thông báo, hỗ trợ | P01/P02 |
| 25 | `Profile/EditProfileScreen.jsx` | `EditProfile` | Validate và lưu thay đổi thật; không cho sửa role/active bằng form này | P01 |
| 26 | `Profile/ChangePasswordScreen.jsx` | `ChangePassword` | Re-auth khi cần; chỉ hiển thị cho tài khoản có password; Google-only có hướng dẫn phù hợp | P01 |
| 27 | `Settings/SettingsScreen.jsx` | `Settings` | Preference thật; notification opt-in liên kết trạng thái permission/token; không để toggle giả | P05/P08 |

Bốn file Menu/Popular/FlashSale/Recommended trở thành một component FoodCatalog, nên 27 file baseline còn 24 component đích: 20 màn hình xác thực/nghiệp vụ và 4 UI tiện ích. Không xóa file baseline khi chưa chuyển route, kiểm tra deep link và xác nhận UI tương đương.

## 3. Màn hình mới

| # | Route/component | Vai trò | Nghiệp vụ tối thiểu | Phase |
|---|---|---|---|---|
| N01 | `Addresses` | Customer | Danh sách, địa chỉ mặc định, tạo/sửa/xóa trong form hoặc sheet; lưu bền vững; không đếm form thành route riêng | P02 |
| N02 | `Notifications` | Vai trò liên quan | Inbox theo người nhận, đọc/chưa đọc, mở đúng đơn; FCM chỉ là tín hiệu, dữ liệu inbox vẫn kiểm tra quyền | P05 |
| N03 | `OrderChat` | Người tham gia đơn | Gửi qua Express, đọc/listen Firestore, phân trang lịch sử; client không tự gán sender UID hoặc thêm thành viên | P05 |
| N04 | `MenuAssistant` | Customer | AI hiểu nhu cầu, đề xuất món thực có thể mở chi tiết/thêm giỏ; server xác minh ID/giá/trạng thái bán | P07 |
| N05 | `SubmitReview` | Customer | Chỉ đánh giá đơn COMPLETED thuộc mình, một review/đơn; nội dung thật phục vụ AI review insights | P03/P06 |
| N06 | `SupportAbout` | Mọi role | Cách dùng, liên hệ hỗ trợ có hành động thật, giới thiệu, thông tin dữ liệu/vị trí; không dùng Coming Soon | P02/P08 |
| N07 | `MerchantDashboard` | Merchant | KPI của đúng nhà hàng, đơn đang hoạt động; số liệu có kỳ thời gian và nguồn rõ ràng | P04/P05 |
| N08 | `MerchantOrderQueue` | Merchant | Danh sách theo trạng thái, trang đầu giới hạn; realtime chỉ cho tập đơn đang xử lý | P04/P05 |
| N09 | `MerchantOrderDetail` | Merchant | Accept/reject/prepare/ready, lịch sử; sheet gán tài xế đã được duyệt; không tạo chợ chuyến công khai | P04/P06 |
| N10 | `MerchantMenu` | Merchant | CRUD món của nhà hàng mình, bật/tắt bán, tồn kho; không sửa món của nhà hàng khác | P04 |
| N11 | `FoodEditor` | Merchant | Dùng chung tạo/sửa; validate tên, giá VND nguyên, danh mục, ảnh, tồn kho | P04 |
| N12 | `ReviewInsights` | Merchant | AI tóm tắt review đã xác minh của nhà hàng, nhóm vấn đề/điểm tốt, dẫn chứng và đề xuất; lọc khoảng thời gian | P07 |
| N13 | `AssignedDeliveries` | Driver | Chỉ danh sách đơn đã được merchant gán cho tài xế này; không có Public/Available Jobs | P06 |
| N14 | `DeliveryJobDetail` | Driver | Xác nhận nhận assignment riêng với trạng thái đơn, địa chỉ tối thiểu cần thiết, liên hệ/chat; kiểm tra quyền mỗi thao tác | P06 |
| N15 | `ActiveDelivery` | Driver | Xác nhận lấy món, bắt đầu DELIVERING, hoàn thành; GPS foreground khi app mở; trạng thái permission/offline rõ ràng | P06 |
| N16 | `DeliveryHistory` | Driver | Đơn terminal vẫn có driverUid là UID hiện tại; cursor pagination. Đơn đã đổi sang driver khác không còn xuất hiện; v1 không có projection lịch sử assignment riêng | P06/P08 |
| N17 | `UserManagement` | Admin | Danh sách/search/filter, duyệt role theo quy trình, khóa/mở user; nhật ký thay đổi; editor/confirm trong sheet | P04 |

## 4. Inventory mục tiêu không trùng

| Nhóm | Route được đếm | Số |
|---|---|---:|
| Auth | Login, Register, EmailVerification | 3 |
| Khám phá | CustomerHome, Search, FoodDetail, FoodCatalog, Restaurants, RestaurantDetail, Favorites | 7 |
| Giỏ/đặt/theo dõi | Cart, Checkout, Payment, TrackOrder | 4 |
| Đơn hàng khách | OrderHistory, CustomerOrderDetail | 2 |
| Hồ sơ/cài đặt dùng chung | Profile, EditProfile, ChangePassword, Settings | 4 |
| Bổ sung khách/dùng chung | Addresses, Notifications, OrderChat, MenuAssistant, SubmitReview, SupportAbout | 6 |
| Nhà hàng | MerchantDashboard, MerchantOrderQueue, MerchantOrderDetail, MerchantMenu, FoodEditor, ReviewInsights | 6 |
| Tài xế | AssignedDeliveries, DeliveryJobDetail, ActiveDelivery, DeliveryHistory | 4 |
| Quản trị tối thiểu | UserManagement | 1 |
| **Tổng xác thực/nghiệp vụ** | Không nhân route dùng chung theo role | **37** |
| UI tiện ích | Splash, Onboarding, FilterModal, OrderSuccess | 4 |
| **Tổng inventory component** | 24 baseline sau gộp + 17 mới | **41** |

## 5. Cây điều hướng đề xuất

```text
RootNavigator
  Bootstrap: Splash -> kiểm tra Firebase session + users/{uid}.role/active
  AuthStack: Onboarding, Login, Register, EmailVerification
  CustomerTabs: CustomerHome, Restaurants, Favorites, Cart, Profile
    CatalogStack: Search, FilterModal, FoodCatalog, FoodDetail, RestaurantDetail
    CheckoutStack: Checkout, Payment, OrderSuccess
    CustomerOrderStack: OrderHistory, CustomerOrderDetail, TrackOrder, SubmitReview
    MenuAssistant
  MerchantTabs: MerchantDashboard, MerchantOrderQueue, MerchantMenu, Profile
    MerchantOrderDetail [sheet chọn approved driver]
    FoodEditor [create/edit dùng chung]
    ReviewInsights
  DriverTabs: AssignedDeliveries, ActiveDelivery, DeliveryHistory, Profile
    DeliveryJobDetail
  AdminStack: UserManagement, Profile
  SharedAuthorizedRoutes: Addresses, Notifications, OrderChat,
    EditProfile, ChangePassword, Settings, SupportAbout
```

SharedAuthorizedRoutes chỉ có nghĩa dùng chung component. Quyền truy cập và query vẫn phụ thuộc user, nhà hàng, assignment và đơn cụ thể.

## 6. Quy tắc hành vi liên màn hình

### Nguồn sự thật và quyền

- `users/{uid}.role` và `active` do server quản lý là nguồn quyền chính. Token claims có thể là dữ liệu bổ trợ; không dùng claims cũ hoặc role local làm căn cứ duy nhất.
- Server kiểm tra user còn active, role, restaurant ownership, order participant/driver assignment cho từng lệnh. Firestore Rules kiểm soát truy cập client; server dùng Admin SDK vẫn phải kiểm tra quyền ở API vì đường đó không được Rules bảo vệ thay.
- Đăng ký thông thường tạo customer. Admin/merchant/driver được duyệt qua quy trình có quyền; không có màn hình tự nâng role.
- Route chỉ truyền ID và lựa chọn UI, ví dụ `TrackOrder({orderId})`. Không tin `total`, `status`, `uid`, `shopId` trong route để cấp quyền hoặc quyết định nghiệp vụ.
- Đổi tài khoản/đăng xuất hủy listeners, clear state riêng tư và reset navigator. Nút Back không quay lại dữ liệu của user trước.

### Đặt đơn và trạng thái

- Core dùng COD, tiền VND nguyên, một nhà hàng/giỏ, tối đa 20 dòng. Giá, voucher, phí và tồn kho được xác minh ở server; client chỉ trình bày bản báo giá.
- Chuỗi chính: `PENDING -> ACCEPTED -> PREPARING -> READY_FOR_PICKUP -> DELIVERING -> COMPLETED`.
- Nhánh kết thúc: `PENDING -> REJECTED` do merchant; `PENDING -> CANCELLED` theo chính sách hủy của core. Nếu master plan bổ sung hủy sau ACCEPTED, phải xác định actor, hoàn kho/voucher và test riêng trước triển khai; không tự mở transition trên UI.
- Merchant/admin theo quyền đã chốt chỉ gán tài xế đã được duyệt. `assignmentStatus` có luồng `ASSIGNED -> ACCEPTED` riêng; không nhầm với `order.status = ACCEPTED`. Chỉ tài xế đang được gán và đã nhận assignment mới lấy món từ READY_FOR_PICKUP để chuyển DELIVERING. Không có màn hình tự nhận chuyến công khai.
- Hoàn thành giao và xác nhận thu COD là cùng lệnh server nguyên tử; UI không ghi COMPLETED trước khi server xác nhận. Retry không ghi nhận COD nhiều lần.
- Tên, giá món và địa chỉ trong đơn là snapshot đã xác nhận; chỉnh profile/menu sau này không âm thầm đổi lịch sử đơn.
- Khi timeout, UI giữ trạng thái chưa rõ kết quả và kiểm tra lại bằng idempotency key; không tạo key mới chỉ để thử lại cùng yêu cầu.

### Realtime, offline và thông báo

- Listener theo đúng user/merchant/assigned driver, có filter/limit và unsubscribe. Không nghe toàn bộ collection đơn hàng hoặc vị trí.
- Dữ liệu cache có nhãn offline/thời điểm cập nhật. Không báo đặt đơn/hủy/giao thành công trước khi server chấp nhận.
- FCM có thể trễ/lặp; inbox/event ID được dùng để chống thông báo trùng ở tầng nghiệp vụ. Tap notification/deep link phải đăng nhập và kiểm tra quyền lại.
- Preference notification được lưu theo user. Hiển thị riêng permission hệ điều hành, lựa chọn trong app và khả năng nhận push; bật toggle không được giả vờ hệ điều hành đã cấp quyền.
- Gửi chat qua `POST /api/v1/orders/:orderId/messages` trên Express; server kiểm tra participant và sender từ auth, ghi message cùng outbox nguyên tử. Client chỉ đọc/listen message qua Firestore; **mọi ghi message trực tiếp từ client SDK đều bị Rules từ chối**. Lịch sử có phân trang; message không được sửa để đổi sender/order hoặc ghi đè nội dung người khác.

### GPS và bản đồ

- Core chỉ cập nhật GPS khi ứng dụng tài xế đang mở/foreground và quyền vị trí phù hợp đã cấp. Không quảng bá background service, killed-app tracking hoặc theo dõi liên tục khi chưa triển khai/kiểm thử.
- Bản đồ khách hiển thị thời điểm vị trí cuối và nhãn stale khi quá ngưỡng cấu hình. Nếu không có vị trí thì nói rõ chưa có, không dùng tọa độ mock để mô tả realtime.
- Chỉ chia sẻ vị trí liên quan đến đơn đang giao cho đúng người có quyền. Chấm dứt cập nhật/chia sẻ theo policy khi COMPLETED/CANCELLED/REJECTED hoặc assignment bị thu hồi.

### Hai AI bắt buộc

- `MenuAssistant` là workflow AI cho khách hàng: hiểu yêu cầu và trả kết quả dựa trên menu thật. Chỉ thêm giỏ sau thao tác rõ ràng của người dùng; không để model tự tạo đơn.
- `ReviewInsights` là workflow AI riêng cho merchant: phân tích review đã xác minh của nhà hàng, hiển thị phạm vi và số mẫu, dẫn chứng, điểm tốt/vấn đề và đề xuất. Không nhầm với recommendation lọc rating.
- Nội dung review/chat/menu là dữ liệu không đáng tin cậy; không được thực thi chỉ dẫn cài trong đó. API key/model secret nằm ở server; output AI được kiểm tra schema và phạm vi dữ liệu.
- Có loading, timeout, retry giới hạn, empty/insufficient-data và fallback rõ ràng. Không ghi nhãn kết quả tĩnh/fallback là AI đã chạy thành công.

## 7. Điều kiện hoàn thành mỗi màn hình

### Trạng thái triển khai P02 local

| Màn có route vào từ app | Trạng thái |
|---|---|
| Trang khách và danh sách quán, thông tin quán, thực đơn/tìm theo tên/giá, chi tiết món | Đọc catalog Firestore với lọc và phân trang |
| Yêu thích và giỏ hàng | Lưu theo tài khoản, chỉnh qua Express |
| Hồ sơ, sổ địa chỉ và form thêm/sửa | Đọc tài khoản hiện tại, lưu và chọn mặc định |
| Thanh toán COD | Chọn địa chỉ, ghi chú và ưu đãi. P03 đã nối báo giá và tạo đơn |
| Cài đặt, trợ giúp và phiên bản | Mở cài đặt hệ thống và hướng dẫn demo trong app |

Xem mức nghiệm thu trong [báo cáo P02](PHASE02_REPORT.md). Các route gộp hoặc tiện ích vẫn theo điều kiện đếm của tài liệu yêu cầu.

P03 đã thêm màn xác nhận đơn sau commit, lịch sử phân trang, chi tiết nhận trạng thái Firestore, hủy khi PENDING và đánh giá văn bản sau khi giao và thu COD. Xem [báo cáo P03](PHASE03_REPORT.md).

P04 đã thêm danh sách quán trong phạm vi quyền, cài đặt quán, sửa món/ảnh/tùy chọn, chỉnh suất, hàng đợi và chi tiết xử lý đơn, gán và duyệt tài xế, báo cáo ngày và quản trị tài khoản. Xem [báo cáo P04](PHASE04_REPORT.md).

P05 thêm chat theo đơn, hộp thư, cài đặt thông báo và danh sách/chi tiết chuyến được gán. Lịch sử đơn khách và hàng đợi quán cập nhật theo listener. Xem [báo cáo P05](PHASE05_REPORT.md).

P06 thêm lịch sử chuyến, xác nhận lấy món và thu COD trong chi tiết chuyến. Từ chi tiết đơn đang giao, khách mở màn Vị trí giao hàng và xem sơ đồ theo tọa độ. Xem [báo cáo P06](PHASE06_REPORT.md).

P07 thêm Trợ lý chọn món từ trang quán và Phân tích đánh giá từ Vận hành quán. Khách có bước xác nhận giỏ, quán có màn chọn ngày và mở đánh giá nguồn. Xem [báo cáo P07](PHASE07_REPORT.md).

- [ ] Có route vào/ra thực, Back đúng và kiểm tra quyền/deep link nếu áp dụng.
- [ ] Tương tác chính lưu/đọc dữ liệu thật đúng UID/restaurant/order; không còn mock trong đường demo.
- [ ] Có loading, empty, lỗi, offline và permission-denied phù hợp.
- [ ] Tiền/số lượng/ngày giờ nhất quán; form validate; nút không gửi lặp vô hạn.
- [ ] Dữ liệu dài có pagination/virtualized list; listener được dọn khi rời màn hình.
- [ ] Thử bằng ít nhất hai tài khoản để kiểm tra rò dữ liệu hoặc state còn sót.
- [ ] Có test case và bằng chứng tương ứng trong `TEST_PLAN.md`; ảnh screenshot không thay thế việc xác minh dữ liệu/quyền.
- [ ] Inventory ghi rõ route đã hoàn thành, chưa hoàn thành hoặc tiện ích; không tự đánh dấu hoàn thành dựa trên số file.

