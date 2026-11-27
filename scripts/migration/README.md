# Migration — chỉ khảo sát, không import

Theo MIGRATION.md, P01 mặc định seed tài khoản demo/VND mới. Chưa có importer SQL/legacy user; không tự chuyển mật khẩu, OTP, USD sang VND hoặc ongoing sang PENDING.

Chạy không tham số:

    node scripts/migration/dry-run.mjs

Lệnh chỉ validate kế hoạch seed tổng hợp, in counts và writes=0; không khởi tạo Firebase Admin. Nếu cần khảo sát mapping đã làm sạch:

    node scripts/migration/dry-run.mjs --input=PATH_TO_SANITIZED_MAPPING.json

Input giới hạn 1 MiB, chỉ chấp nhận:
- users: legacyId, targetUid (mapping explicit, không tự tạo Auth user).
- menuItems: legacyId, shopId, priceVnd, currency.
- orders: legacyId, customerLegacyId, shopId, status, grandTotalVnd.

Không đưa email/phone/address/password/hash/token hoặc raw SQL export vào input. Báo cáo duplicate/missing IDs, giá/total không nguyên VND, status chưa ánh xạ và customer orphan. Mã thoát 2 khi có issue, 1 khi input không hợp lệ. UID mapping có thể là dữ liệu nội bộ: lưu báo cáo riêng, không đăng công khai nếu là dữ liệu thật.

readyForImport luôn false: báo cáo không chứng minh đã migration và không đủ kiểm chứng snapshot lịch sử/stock/COD/quyền sở hữu. Import thật cần yêu cầu riêng, nguồn có quyền sử dụng, ánh xạ được review và test invariants; không được thêm dual-write hoặc writes cloud vào script này.
