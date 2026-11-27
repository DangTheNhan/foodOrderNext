# P01 — Xác thực, phân quyền và dữ liệu Firebase

**Trạng thái:** DONE  
**Chủ trì:** ALL; C điều phối tích hợp  
**Phụ thuộc:** P00 đang tiếp tục; user yêu cầu triển khai P01 local song song theo D27. Cổng FCM/perf/AI của P00 chưa được coi là đã đạt.  
**Nguồn thống nhất:** [MASTER_PLAN](../MASTER_PLAN.md).

## Mục tiêu

Tạo danh tính, quyền và hợp đồng dữ liệu dùng chung. Firebase Auth quản lý danh tính, Firestore lưu nghiệp vụ chính, Express xác minh token và kiểm tra quyền. Không thiết lập MySQL hoặc ghi đồng thời hai database.

## Công việc

- [x] **P01-T01** — **[C]** Chuẩn hóa local/test, Firebase project, Emulator Suite và cấu hình Express/React Native. Tạo mẫu môi trường không secret và hướng dẫn khởi động; key dịch vụ/AI chỉ có ở backend hoặc kho secret.
- [x] **P01-T02** — **[A]** Triển khai đăng ký/đăng nhập/đăng xuất/khôi phục mật khẩu và phiên bằng Firebase Auth; điều hướng loading/unauthenticated/authenticated và lỗi có hướng xử lý.
- [x] **P01-T03** — **[C]** Xây middleware xác minh ID token và quyền server-side: customer/merchant/driver/admin, tài khoản duyệt/khóa. Chỉ admin cấp vai trò và duyệt driver; không tin userId/role do client tự khai.
- [x] **P01-T04** — **[B]** Chốt schema/ID/server timestamp cho tài khoản, địa chỉ, quán, món và optionGroups tùy chọn, stock, giỏ, đơn/dòng đơn, reservation, voucher, review, chat, notifications và outbox. Tiền nguyên VND; đơn một quán, tối đa 20 dòng; khóa dòng foodId/optionIds, snapshot giá/tên/options/địa chỉ; không tạo entity variantId riêng.
- [x] **P01-T05** — **[B]** Chốt validation, mã lỗi, cursor pagination, response và index. Tách dữ liệu public, owner, merchant và assigned driver; mutation nghiệp vụ qua Express, Firebase client chỉ đọc các phạm vi được Rules cho phép.
- [x] **P01-T06** — **[C]** Viết Firestore/Storage Rules mặc định từ chối ngoài hợp đồng và test emulator. Tài liệu nhắc Admin SDK bỏ qua Rules: Express vẫn phải kiểm tra owner/role/restaurant/assignment trên từng request.
- [x] **P01-T07** — **[B]** Chuẩn bị seed tái lập cho 1–3 quán, thực đơn, các vai trò và admin; thêm fixture COMPLETED/review để AI làm song song. Nhãn dữ liệu tổng hợp, namespace/ID kiểm soát và chặn chạy seed nhầm production.
- [x] **P01-T08** — **[ALL]** Lập ánh xạ migration từ mã/dữ liệu cũ: trường, ID, ảnh, đơn vị VND và kiểm tra tổng. Dùng dry-run và nguồn sao lưu; nếu không có dữ liệu hợp lệ ghi rõ dùng seed. Không di chuyển mật khẩu plaintext hoặc bật dual-write.
- [x] **P01-T09** — **[ALL]** Kiểm thử lát cắt đăng nhập → hồ sơ → API bảo vệ → đọc Firestore; thành viên khác chạy lại setup/reset và negative test cấp quyền giả, tài khoản khóa, truy cập dữ liệu người khác.

## Sản phẩm bàn giao

- Auth/role navigation, middleware, Rules và kiểm thử tương ứng.
- Schema/field dictionary, API contract và index quản lý phiên bản.
- Seed/fixture, kế hoạch migration/dry-run và hướng dẫn môi trường sạch.

## Kiểm thử nghiệm thu và cổng hoàn thành

1. Tạo tài khoản, khôi phục phiên, đăng xuất và khôi phục mật khẩu hoạt động.
2. Token thiếu/giả bị chặn; khách không tự nâng quyền; tài khoản khóa không mutation.
3. Client và API đều chặn truy cập riêng của người khác, kể cả API dùng Admin SDK.
4. Thành viên khác dựng local và nạp cùng seed theo tài liệu.
5. Schema đủ mô tả toàn bộ luồng đơn và hai AI; không đánh dấu các nghiệp vụ pha sau đã chạy.

## Rủi ro

Quyền có thể cũ khi cache/claims thay đổi; chốt tải lại và kiểm tra server cho thao tác quan trọng. Rules và API có thể lệch quyền; dùng cùng ma trận kiểm thử. Dữ liệu migration bẩn phải được báo cáo, không âm thầm bỏ qua.

## Bằng chứng cần lưu

artifacts/evidence/P01/: schema, log seed/dry-run và số lượng bản ghi, báo cáo Rules/API negative test, video Auth, xác nhận setup bởi thành viên khác. Che token và thông tin truy cập.

## Bàn giao tiếp theo

[P02](P02-customer.md) dùng catalog/hồ sơ/địa chỉ; [P03](P03-order-engine.md) dùng order/stock/permission. Mọi đổi hợp đồng phải đồng bộ tài liệu và thông báo cả nhóm.

## Kết quả hiện tại — 2026-11-07

Xem [PROGRESS](../PROGRESS.md), [báo cáo P01](../PHASE01_REPORT.md) và BACKLOG để phân biệt DONE/local review/cổng chưa đạt. Checkbox chỉ đánh dấu task DONE; không đánh dấu cả phase hoàn tất.

Ngày 2026-11-25 đã xác nhận Auth Email/Password, Firestore Standard và Rules staging. Mô phỏng đọc đơn hàng chưa đăng nhập bị từ chối. Đã tải cấu hình Android release và đối chiếu đúng app. Ngày 2026-11-26, Express qua HTTPS đã xác minh token Firebase và đọc hồ sơ Firestore. [Bằng chứng Firebase staging](../../artifacts/evidence/P01/firebase-staging.json) · [Smoke Express](../../artifacts/evidence/P09/render-staging-smoke.json)

Kiểm thử SDK trên cloud đã tạo, đăng nhập và dọn tài khoản thử. Hai truy vấn ghép công khai chạy được và Rules chặn đọc đơn khi thiếu phiên hoặc hồ sơ. APK staging cài sạch, đăng nhập và khởi tạo hồ sơ qua Express. Ngày 2026-11-27, máy thành viên thứ hai đã dựng lại môi trường sạch (`npm ci`, `doctor`, `seed --dry-run`), chạy đạt 50/50 unit, 46/46 mobile, 56/56 Emulator Rules/Auth và rà soát chéo Rules/middleware quyền. [Smoke Firebase staging](../../artifacts/evidence/P01/firebase-staging-smoke.json) · [Smoke Android staging](../../artifacts/evidence/P09/android-staging-smoke.json) · [Xác nhận máy thứ hai](../../artifacts/evidence/P08/second-machine/summary.json)
