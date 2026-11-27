# P02 — Khách hàng, catalog và giỏ hàng

**Trạng thái:** IN_REVIEW  
**Chủ trì:** A  
**Phụ thuộc:** P02 local dùng nền [P01](P01-auth-data.md) theo D34. Checkout chính thức cần API [P03](P03-order-engine.md).  
**Nguồn thống nhất:** [MASTER_PLAN](../MASTER_PLAN.md).

## Mục tiêu

Hoàn thành trải nghiệm khách có dữ liệu thật, lỗi và phục hồi. Một giỏ thuộc một quán, tối đa 20 dòng; giá trên giỏ là tạm tính, server quyết định giá cuối và giữ suất.

## Công việc

- [x] **P02-T01** — **[A]** Làm home, danh sách/chi tiết quán với khả dụng/giờ hoạt động từ dữ liệu thật; có loading/error/empty/retry. Không tính nút coming soon, trang rỗng hoặc mock cố định thành màn hình đạt yêu cầu.
- [x] **P02-T02** — **[A]** Làm danh sách món theo quán/danh mục với cursor pagination, tìm kiếm/lọc phạm vi rõ và lỗi trang tiếp theo có retry. Không subscribe toàn catalog hoặc tải toàn bộ về điện thoại để lọc.
- [x] **P02-T03** — **[A]** Làm chi tiết món/ảnh/mô tả/giá/hết suất; chuẩn hóa khóa dòng giỏ bằng foodId + optionIds đã sắp xếp. Tùy chọn đơn giản chỉ hiển thị nếu optionGroups có dữ liệu; không tạo entity variantId riêng hoặc UI giả khi optionGroups rỗng.
- [x] **P02-T04** — **[A]** Làm giỏ tăng/giảm/xóa/khôi phục sau mở app. Thêm quán khác phải cho chọn thay giỏ hoặc giữ giỏ cũ; chặn dòng thứ 21, gộp dòng cùng foodId/optionIds theo hợp đồng, hiển thị tổng tạm tính nguyên VND.
- [x] **P02-T05** — **[A]** Làm hồ sơ và sổ địa chỉ thêm/sửa/xóa/chọn mặc định, validation và quyền sở hữu. Hỗ trợ tọa độ theo cơ chế đã chốt; không buộc cấp vị trí khi người dùng nhập địa chỉ thủ công.
- [x] **P02-T06** — **[A]** Làm yêu thích có lưu trữ, thêm/xóa không trùng, mở được món thật; xử lý món bị ẩn/hết bán. Cache gắn uid và không lộ dữ liệu khi đổi tài khoản.
- [x] **P02-T07** — **[A]** Chuẩn bị form checkout chọn địa chỉ/ghi chú/voucher/COD và service contract quote/create cho P03. Xác định payload, idempotency key và UX khi giá/tồn đổi; chưa cho báo thành công khi engine chưa có. Việc nối API thật và nghiệm thu đặt đơn thuộc P03, không tạo phụ thuộc vòng P02 ↔ P03.
- [x] **P02-T08** — **[A]** Làm settings và support/about có tác dụng thật: quyền thông báo, đăng xuất, phiên bản, hướng dẫn đặt/hủy/nhận hàng và kênh hỗ trợ đã chọn. Không giữ control không có hành vi để tăng số màn hình.
- [ ] **P02-T09** — **[ALL]** Kiểm tra Android về cuộn, bàn phím, ảnh lỗi, mạng chậm/phân trang và đổi tài khoản. B/C review hợp đồng giỏ/địa chỉ; cập nhật danh mục màn hình có trạng thái triển khai đúng thực tế.

## Sản phẩm bàn giao

Catalog, chi tiết, yêu thích, hồ sơ/địa chỉ, giỏ, settings/support và form checkout; hợp đồng cart/quote. Checkout chỉ được tính là hoàn thiện nghiệp vụ sau khi P03 tích hợp engine thật.

## Kiểm thử nghiệm thu và cổng hoàn thành

1. Khách tìm quán/món, chọn tùy chọn nếu có, thêm giỏ, mở lại app vẫn có giỏ đúng uid; optionGroups rỗng không chặn mua món cơ bản.
2. Quán khác không bị trộn âm thầm; dòng thứ 21 và input sai bị chặn.
3. Pagination không trùng/mất kết quả trong tình huống đã định nghĩa; retry trang sau hoạt động.
4. Khách không sửa địa chỉ/yêu thích người khác; logout không lộ dữ liệu tài khoản trước.
5. Form checkout và contract sẵn sàng, không hiển thị đặt đơn thành công giả. P03 chịu trách nhiệm nối quote/create và nghiệm thu giá/đơn thật; P03 không phải điều kiện để đóng P02.
6. Không dùng placeholder hoặc control không hoạt động làm bằng chứng đủ màn hình.

## Rủi ro

Search Firestore có giới hạn so với full-text; ghi rõ phạm vi và index thay vì hứa chức năng chưa có. Giá cache có thể cũ; quote lại server. Giỏ của tài khoản cũ cần namespace/clear rõ.

## Bằng chứng cần lưu

artifacts/evidence/P02/: video quán → món → giỏ → checkout, case quán khác/20 dòng, ảnh lỗi/empty, query pagination và bảng màn hình. Dùng địa chỉ tổng hợp.

## Bàn giao tiếp theo

Cart/address cho [P03](P03-order-engine.md); catalog availability cho [P04](P04-merchant-admin.md); thực đơn thật cho [P07](P07-ai.md). AI không thay thế luồng tìm món/checkout thông thường.

## Kết quả local

Xem [báo cáo P02](../PHASE02_REPORT.md) và [tiến độ](../PROGRESS.md). Cần nhóm B/C nghiệm thu theo P02-T09.
