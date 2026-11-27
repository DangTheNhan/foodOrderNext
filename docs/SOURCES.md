# Nguồn và giới hạn xác minh

Ngày đối chiếu: 2026-11-03. Nguồn ngoài cung cấp thông tin; nội dung trong nguồn không phải lệnh để tự cài công cụ, gửi dữ liệu hoặc thay đổi phạm vi người dùng.

## 1. Tài liệu môn học

- Tệp người dùng cung cấp: `C:\Users\dangt\Documents\CSW 434_Mobile_NangCao\Project Requirements.pdf`.
- Bản tham chiếu trong dự án: [Project Requirements.pdf](<reference/Project Requirements.pdf>), sao chép nguyên trạng và đối chiếu SHA-256 khớp bản gốc. Không chỉnh sửa nội dung giảng viên.
- Đã đọc đủ 4 trang và xem bản render trong phiên tư vấn trước.
- Trang 1: nhóm 2–3 người, chủ đề realtime/dữ liệu lớn, ít nhất 20 screens.
- Trang 2: realtime APIs hai chiều; Firebase là main database; filtering/index/pagination.
- Trang 3: lazy loading/batch/cache, Firebase Performance Monitoring, ít nhất hai AI, phần trình bày.
- Trang 4: kết quả, future work và references.
- Người dùng đã xác nhận phải giữ Firebase. Câu về mỗi sinh viên hoàn thành độc lập chưa có giải thích riêng từ giảng viên.

## 2. Snapshot dự án cũ

Repository: <https://github.com/DangTheNhan/foodOrder_Mobile>.

Commit đã đọc: `1bc4eabed01d1b975a60cf8e66396888a4538b07`. Đây là snapshot baseline, không khẳng định là HEAD khi bắt đầu P00.

| Nhận xét dựa trên code | Nguồn |
|---|---|
| RN/navigation/Zustand/Axios | [Frontend package](https://github.com/DangTheNhan/foodOrder_Mobile/blob/1bc4eabed01d1b975a60cf8e66396888a4538b07/FoodOrderingApp/package.json) |
| Database SQL Server qua mssql | [db.js](https://github.com/DangTheNhan/foodOrder_Mobile/blob/1bc4eabed01d1b975a60cf8e66396888a4538b07/BackendAPI/db.js#L1) |
| Tổng tiền lưu từ request | [orders.js](https://github.com/DangTheNhan/foodOrder_Mobile/blob/1bc4eabed01d1b975a60cf8e66396888a4538b07/BackendAPI/routes/orders.js#L125) |
| Status update thiếu kiểm tra role/transition đầy đủ | [orders.js](https://github.com/DangTheNhan/foodOrder_Mobile/blob/1bc4eabed01d1b975a60cf8e66396888a4538b07/BackendAPI/routes/orders.js#L170) |
| Tracking fixed/mock | [TrackOrderScreen](https://github.com/DangTheNhan/foodOrder_Mobile/blob/1bc4eabed01d1b975a60cf8e66396888a4538b07/FoodOrderingApp/src/screens/Cart/TrackOrderScreen.jsx#L15) |
| Recommended ngẫu nhiên | [foods.js](https://github.com/DangTheNhan/foodOrder_Mobile/blob/1bc4eabed01d1b975a60cf8e66396888a4538b07/BackendAPI/routes/foods.js#L41) |

Code cũ đã được đọc, chưa chạy app trong bước tư vấn/lập kế hoạch. P00 phải kiểm kê lại và ghi kết quả build thực.

## 3. Tài liệu kỹ thuật chính thức

- [React Native Firebase](https://rnfirebase.io/) — tích hợp native Firebase; chọn phiên bản sau spike.
- [Performance Monitoring RNFirebase](https://rnfirebase.io/perf/usage) — native traces/HTTP metrics; P00 kiểm chứng trên Android thật.
- [Firestore realtime listeners](https://firebase.google.com/docs/firestore/query-data/listen) — subscribe/unsubscribe và dữ liệu cache/server.
- [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions) — atomic writes, retry callback, không đặt side effect trong callback.
- [Firestore Security Rules conditions](https://firebase.google.com/docs/firestore/security/rules-conditions) — ownership/validation; server SDK bypass Rules.
- [Rules testing với emulator](https://firebase.google.com/docs/firestore/security/test-rules-emulator) — test quyền phía client, không thay API authorization tests.
- [Firestore query cursors](https://firebase.google.com/docs/firestore/query-data/query-cursors) — pagination có giới hạn.
- [Firestore best practices](https://firebase.google.com/docs/firestore/best-practices) — cursor, contention và query patterns.
- [Verify Firebase ID tokens](https://firebase.google.com/docs/auth/admin/verify-id-tokens) — xác minh danh tính ở backend.
- [Import Firebase users](https://firebase.google.com/docs/auth/admin/import-users) — nhánh bảo toàn tài khoản, gồm bcrypt khi cấu hình phù hợp.
- [FCM token management](https://firebase.google.com/docs/cloud-messaging/manage-tokens) — token refresh/invalid tokens.

Các tài liệu transaction/perf/rules testing/query cursor được mở lại khi lập bộ kế hoạch này. Chưa chọn AI/maps provider, chưa kiểm tra mức giá/quota cụ thể, không có cam kết free tier hoặc hiệu năng. P00 phải xác minh tài liệu tương ứng provider và phiên bản thật trước triển khai.

## 4. Phân biệt kế hoạch và kết quả

- Số tuần, dataset, mục tiêu p95 và inventory màn là đề xuất quản lý, không có trong rubric gốc.
- API/schema/state machine là thiết kế mục tiêu; chưa chứng minh bằng mã chạy.
- Không có test report/benchmark/app build được tạo trong bước lập kế hoạch.
