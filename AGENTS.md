# Hướng dẫn tiếp tục FoodOrderNext

P01–P07 có bản local. Đọc PROGRESS và báo cáo phase trước khi tiếp tục. PROGRESS ghi các phần cần nghiệm thu ở máy khác và trên Firebase thật.

## Trước một phiên triển khai

1. Đọc `docs/MASTER_PLAN.md`, `docs/PROGRESS.md`, `docs/DECISIONS.md`.
2. Xem `docs/BACKLOG.csv` và file phase liên quan trong `docs/phases/`.
3. Đọc hợp đồng dữ liệu/API và kiểm tra thay đổi sẵn có trước khi sửa code.
4. Tiếp tục các task chưa xong của phase được yêu cầu; không tự đánh dấu phase hoàn tất theo số file đã tạo.

## Các quyết định cần giữ nhất quán

- Firebase là database chính; Firestore cho nghiệp vụ, Firebase Auth cho danh tính.
- Client Firestore v1 chỉ đọc/listen; mọi ghi Firestore qua Express theo API_CONTRACT. Auth/Storage native SDK có đường riêng được mô tả trong kiến trúc.
- Một app React Native phân quyền; Android là nền tảng nghiệm thu trước.
- Giữ Express cho nghiệp vụ có đặc quyền và lời gọi AI; không duy trì SQL Server/MySQL song song trong phạm vi lõi.
- Khách, quán, shipper và admin tối thiểu. Shipper chỉ xử lý chuyến đã được phân công.
- Một quán mỗi giỏ; tối đa 20 dòng món; VND số nguyên; COD trong phạm vi lõi.
- Hai AI bắt buộc: trợ lý chọn món theo thực đơn thật và phân tích đánh giá cho quán.
- GPS foreground; không hứa theo dõi nền hoặc ETA tuyến đường chính xác.
- Không đưa secret, service-account key, token hoặc dữ liệu cá nhân thật vào source, fixture và báo cáo.
- Các chỉ số trong kế hoạch là mục tiêu kiểm chứng, không phải kết quả đã đạt.

## Khi kết thúc một lát cắt công việc

- Chạy kiểm tra có ý nghĩa với thay đổi; ghi kết quả thật và giới hạn môi trường.
- Cập nhật task trong `docs/BACKLOG.csv`, checklist phase và `docs/PROGRESS.md` cùng một lần.
- Ghi đường dẫn bằng chứng, rủi ro còn lại và task tiếp theo; không đánh dấu DONE nếu còn cổng nghiệm thu chưa qua.
- Nếu thay phạm vi/hợp đồng, cập nhật kế hoạch và `docs/DECISIONS.md`, không âm thầm đổi kiến trúc.
- Không tự triển khai tính năng ngoài phạm vi chỉ để tăng số màn hình.
