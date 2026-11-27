# Kết quả P08

Cập nhật **2026-11-26** · Kế hoạch **v1.8**.

## Dữ liệu và cách đo

- Chạy `npm run benchmark:local` ở thư mục dự án. Lệnh khởi tạo một phiên **demo-foodordernext-p08** trên loopback, nạp dữ liệu vào Firestore trống và tắt Emulator khi xong. Kết quả chạy lại nằm ở `work/p08-benchmark.json`. Dừng phiên chạy lỗi rồi chạy lại lệnh để tạo dữ liệu từ đầu.
- Dataset **p08-benchmark-v1** có **11.310 tài liệu**, gồm **10.003 đơn**, **1.001 đánh giá**, **279 món** và **3 quán**. 10.000 đơn sinh thêm có hai dòng món mỗi đơn. Script kiểm tra schema, tồn, trạng thái COD và tổng kỳ vọng của báo cáo. Dữ liệu nghiệp vụ được tạo tổng hợp.
- Hai lượt đo dùng cùng máy Windows, cùng fixture và Firebase Emulator qua loopback. Mỗi phép đo lưu lượt đầu, bỏ 3 lượt làm nóng, lấy 20 mẫu tiếp theo. Query đo hai trang với 20 dòng mỗi trang, kiểm tra ID không trùng. API đo từ khi gửi HTTP đến khi đọc response. Realtime đo từ khi đăng ký listener và gửi cập nhật đến khi nhận snapshot xác nhận từ server.
- Các số đo query chạy qua Firebase JS SDK trên Node. Mỗi lần đọc hai trang trả 40 tài liệu. Số đọc tính phí, composite index và hiệu năng trên Android thực tế cần nghiệm thu riêng. [Dữ liệu và số đo ban đầu](../artifacts/evidence/P08/benchmark-baseline.json) · [Số đo sau tối ưu](../artifacts/evidence/P08/benchmark-after.json)

## Số đo

| Kịch bản | p95 ban đầu (ms) | p95 sau thay đổi (ms) |
|---|---:|---:|
| Thực đơn, hai trang | 64,57 | 63,37 |
| Lịch sử khách, hai trang | 219,81 | 183,36 |
| Hàng đợi quán, hai trang | 171,33 | 144,59 |
| Đánh giá công khai, hai trang | 31,97 | 34,30 |
| Trang đầu báo cáo, kèm tổng | 176,50 | 160,31 |
| Trang tiếp báo cáo, kèm tổng | 136,69 | 153,78 |
| Trang tiếp báo cáo, chỉ danh sách đơn | — | **125,58** |
| Snapshot realtime sau cập nhật | 18,44 | 31,28 |

## Thay đổi đã kiểm chứng

Khi bấm **Xem thêm** trong báo cáo theo ngày, app yêu cầu trang đơn với `includeTotals=false`. Express giữ kiểm tra quyền và cursor, đồng thời bỏ hai truy vấn tổng hợp trên trang này. Trang đầu vẫn tính tổng. Khách gọi API theo cách cũ vẫn nhận các tổng ở tất cả các trang.

Trong cùng lượt chạy sau thay đổi, p95 trang tiếp giảm từ **153,78 ms xuống 125,58 ms** (~18%). Trang đầu của quán thử có **3.334 đơn tạo**, **3.167 đơn hoàn tất và thu COD**, tổng **290.145.000 VND**. Hai chế độ trả cùng thứ tự và dữ liệu đơn. Các kịch bản khác cho thấy độ dao động giữa lượt chạy; hiện dùng để kiểm chứng khối lượng và chủ đề cần theo dõi.

Mốc nội bộ cho lần đo lại với cùng fixture và máy gồm p95 trong 250 ms cho hai trang query, 200 ms cho trang đầu báo cáo, 150 ms cho trang chỉ danh sách đơn và 50 ms cho snapshot realtime.

## Kiểm thử sau thay đổi

- **56 ca Firebase Emulator** gồm report qua biên ngày Việt Nam, thứ tự trang, scope owner, cursor sai ngày, reconnect, GPS và outbox. **50 ca API/contracts/seed** và **43 ca React Native** đạt. Case mới kiểm tra màn báo cáo giữ tổng ở trang đầu khi bấm xem thêm. [Emulator](../artifacts/evidence/P08/emulator-after.log) · [Unit](../artifacts/evidence/P08/unit-after.log) · [React Native](../artifacts/evidence/P08/mobile-after.log)
- ESLint trên các tệp mobile liên quan trả exit 0 và đã dựng lại Android JS bundle debug. [Metro](../artifacts/evidence/P08/metro-after.log)
- Hai lỗi quy trình được xử lý bằng cách dùng cổng loopback tự chọn và đồng bộ test helper với chế độ cổng riêng. Storage runtime vẫn ghi lỗi shutdown sau khi lệnh kiểm thử trả kết quả đạt.
- Đã chạy lại lệnh benchmark mặc định từ đầu, tạo đủ dữ liệu và ghi kết quả vào thư mục `work`. [Log tái lập](../artifacts/evidence/P08/benchmark-reproduction.log)

## Nghiệm thu tiếp theo

- Review chéo tối ưu báo cáo và ca phân quyền, transaction.
- Các ca worker restart, retry, reconnect và quyền GPS có trong suite local. Còn đo GPS và FCM đa thiết bị, số lượt đọc Firestore trên staging.
- Bản ứng viên phát hành và tài liệu demo cuối theo P09 sau cổng nghiệm thu P08.

## Android local ngày 2026-11-25

- **Thực đơn và ảnh.** Thực đơn tải được ba trang trên Medium_Phone với 45 món fixture bổ sung. Ảnh xuất bản hiển thị trong chi tiết món. HTTP qua loopback trả 537.318 byte trong lần đầu và 0 byte thân phản hồi khi revalidate bằng ETag. Hai lượt đo là 94 và 62 ms. Số đo thao tác UI trong tệp kết quả gồm ADB và cuộn. [Kết quả](../artifacts/evidence/P08/android-menu/result.json) · [Ảnh món](../artifacts/evidence/P08/android-menu/android-published-photo.png) · [Trang ba](../artifacts/evidence/P08/android-menu/android-third-page.png)
- **GPS và COD.** Sáu ca Android đạt gồm quyền, tọa độ mô phỏng, tạm dừng khi xuống nền trong cửa sổ quan sát 14 giây, vị trí cũ phía khách và đóng theo dõi sau khi thu COD. Từ lúc bắt đầu bơm tọa độ đến lần đọc theo quyền thành công là 13.860 ms, gồm acquire và polling. [Kết quả](../artifacts/evidence/P08/android-gps/result.json)
- **Firebase Performance.** Đã build Android với SDK và thêm bốn custom trace cho thực đơn, báo giá và hai kiểu trang báo cáo. Trace bật theo cấu hình staging. Android debug tắt thu thập. [Cách kiểm tra Console](SETUP_LOCAL.md#trace-và-ký-apk-staging)
- **Hồi quy mới nhất.** 56 ca Firebase Emulator, 50 ca API/contracts/seed và 46 ca React Native đạt. Bản APK qua cài sạch trên AVD. [Emulator](../artifacts/evidence/P08/emulator-final.log) · [Unit](../artifacts/evidence/P08/unit-final.log) · [React Native](../artifacts/evidence/P08/mobile-perf-instrumentation.log) · [Cài sạch](../artifacts/evidence/P09/clean-install-local.json)

## Android staging ngày 2026-11-26

- Firestore đã thêm hai chỉ mục cho phép đếm đơn tạo và cộng COD. Cả API và APK dùng được hai trang báo cáo với bộ mẫu 21 bản ghi. API trả 20 rồi 1 dòng, tổng hợp đúng 1.365.000 đồng COD. [Hai chỉ mục](../artifacts/evidence/P08/staging-report-indexes.json) · [Kết quả API](../artifacts/evidence/P08/staging-report-fixture.json)
- APK chẩn đoán trên Android Emulator API 37 ghi bốn trace. Firebase Performance Console nhận đủ `catalog_menu_page`, `order_quote`, `daily_report_first` và `daily_report_next`. Bảng Console có ít mẫu và gồm một lượt báo cáo lỗi trước khi bổ sung chỉ mục. Bảng p95 local ở trên dùng các lượt đo trước và sau cùng môi trường. [Biên bản Performance](../artifacts/evidence/P08/staging-performance.json)
- Express local đã kiểm tra HTTP 500 dùng cùng `X-Request-ID` trong header, JSON phản hồi và log. Log chỉ giữ mã lỗi và mã yêu cầu. [Kết quả đối chiếu](../artifacts/evidence/P08/staging-performance.json)
