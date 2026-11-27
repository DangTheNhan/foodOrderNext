# P00 — Phạm vi, nền tảng và thử nghiệm công nghệ

**Trạng thái:** IN_PROGRESS  
**Chủ trì:** ALL  
**Phụ thuộc:** Không.  
**Nguồn thống nhất:** [MASTER_PLAN](../MASTER_PLAN.md).

## Mục tiêu

Chốt phạm vi và chứng minh các tích hợp khó trên Android thật trước khi triển khai. Auth/build/import đã có bằng chứng local; các spike còn thiếu được ghi trong PROGRESS. Phạm vi là một app React Native theo vai trò, Android chính, Express là backend duy nhất và Firestore là database chính; không dùng MySQL. Phục vụ 1–3 quán, một quán mỗi giỏ, tối đa 20 dòng món.

## Công việc

- [x] **P00-T01** — **[ALL]** Lập bảng truy vết PDF: ít nhất 20 màn hình, realtime hai chiều, Firebase chính, tối ưu dữ liệu, Firebase Performance Monitoring, ít nhất hai AI và 10–15 slide. Tách bắt buộc khỏi mở rộng; ghi điểm cần xác nhận về câu yêu cầu mỗi sinh viên hoàn thành độc lập, không tự suy diễn nhóm ba người phải nhân số màn hình.
- [x] **P00-T02** — **[ALL]** Kiểm kê mã cũ theo UI/API/dữ liệu/bảo mật và chức năng chạy thật; lập bảng giữ/sửa/bỏ có đường dẫn chứng cứ. Chốt phần Express tái sử dụng; không sao chép secret hoặc dữ liệu cá nhân sang dự án mới.
- [ ] **P00-T03** — **[C]** Chọn cấu hình React Native/native build hỗ trợ Auth, Firestore, FCM và Performance Monitoring trên Android. Ghi phiên bản SDK/công cụ được kiểm tra từ tài liệu chính thức tại thời điểm thực hiện; cài bản thử lên máy thật.
- [x] **P00-T04** — **[A]** Thử đăng nhập Firebase Auth và gửi ID token tới Express xác minh. Chứng minh token hợp lệ được chấp nhận, token hỏng bị từ chối và client không tự cấp quyền.
- [ ] **P00-T05** — **[B]** Thử Firestore listener trên hai thiết bị với dữ liệu nhỏ, gồm cập nhật từ hai phía, unsubscribe và reconnect. Chốt app gửi command qua Express rồi nhận dữ liệu cập nhật bằng listener; mô tả rõ tương tác hai chiều bằng demo.
- [ ] **P00-T06** — **[C]** Thử FCM thật ở foreground/background và mở màn hình từ notification, xử lý quyền Android tương ứng. Tạo trace Performance Monitoring và xác minh trace xuất hiện trên console sau thời gian xử lý của dịch vụ.
  - Đã xác nhận bốn trace Android trên Firebase Console và quyền thông báo của APK trên Android Emulator. Còn quyền gửi của Render và ca nhận push. [Performance](../../artifacts/evidence/P08/staging-performance.json) · [Kiểm thử đăng ký](../../artifacts/evidence/P05/staging-push-device.json)
- [x] **P00-T07** — **[A]** Thử hai AI bắt buộc với thực đơn và review tổng hợp: trợ lý chọn món có cấu trúc và phân tích phản hồi có nguồn review. Chốt provider/model, ngân sách thử, timeout, giới hạn dữ liệu và fallback; API key chỉ ở backend. [Kết quả P07](../PHASE07_REPORT.md)
- [x] **P00-T08** — **[ALL]** Chốt danh mục màn hình có hành vi thật, luồng ba vai trò, ma trận quyền và phân công. Lịch tham khảo là 10 tuần với giả định 12–15 giờ/người/tuần và có dự phòng; không ghi ngày lịch cố định hoặc coi là cam kết.

## Sản phẩm bàn giao

- Bảng đối chiếu PDF/phạm vi, danh sách màn hình, vai trò và sơ đồ luồng.
- Khảo sát mã cũ, quyết định công nghệ và danh sách rủi ro.
- Hướng dẫn tái tạo thử nghiệm Auth/listener/FCM/Performance/AI; bản thử không được coi là tính năng hoàn chỉnh.

## Kiểm thử nghiệm thu và cổng hoàn thành

1. Thành viên khác cài được native build lên Android thật theo hướng dẫn.
2. Hai thiết bị thấy cập nhật Firestore; Express từ chối token giả.
3. Thiết bị nhận FCM và có bằng chứng trace Performance Monitoring; thiếu bằng chứng thì pha còn mở.
4. Cả hai AI tạo kết quả mẫu có ích; không dùng câu trả lời viết sẵn thay thử nghiệm.
5. Phạm vi gồm ít nhất 20 màn hình và hai AI bắt buộc; vấn đề Firebase/native chưa giải quyết phải xử lý trước chuyển pha.

## Rủi ro

Native SDK có thể không chạy trong môi trường chạy nhanh đang dùng; xử lý bằng native development build phù hợp ngay pha này. FCM/performance phụ thuộc thiết bị và cấu hình; không thay bằng ảnh UI giả. Phân công nhóm không tự đáp ứng câu yêu cầu cá nhân chưa rõ trong PDF.

## Bằng chứng cần lưu

Khi thực hiện, lưu vào artifacts/evidence/P00/: phiên bản công cụ, log build đã che thông tin nhạy cảm, video hai thiết bị, ảnh FCM/trace, mẫu AI và biên bản phạm vi. Không lưu token, API key hoặc tài khoản thật.

## Bàn giao tiếp theo

Chuyển hợp đồng công nghệ/vai trò và rủi ro sang [P01](P01-auth-data.md). [MASTER_PLAN](../MASTER_PLAN.md) là nguồn phạm vi; [PROGRESS](../PROGRESS.md) tổng hợp tiến độ; [BACKLOG](../BACKLOG.csv) lưu trạng thái từng task. Chỉ cập nhật sau khi có bằng chứng và thành viên khác kiểm tra.

## Kết quả hiện tại — 2026-11-07

Xem [PROGRESS](../PROGRESS.md), [báo cáo P01](../PHASE01_REPORT.md) và BACKLOG để phân biệt DONE/local review/cổng chưa đạt. Checkbox chỉ đánh dấu task DONE; không đánh dấu cả phase hoàn tất.
