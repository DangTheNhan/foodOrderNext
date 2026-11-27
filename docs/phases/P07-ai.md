# P07 — Hai AI bắt buộc: chọn món và phân tích phản hồi

**Trạng thái:** DONE  
**Chủ trì:** A cho menu assistant; B cho review insights; C review API/bảo mật  
**Phụ thuộc:** catalog [P02](P02-customer.md), schema/quyền [P01](P01-auth-data.md), review/fixture COMPLETED [P03](P03-order-engine.md), merchant scope [P04](P04-merchant-admin.md). Có thể làm song song [P06](P06-driver-tracking.md).  
**Nguồn thống nhất:** [MASTER_PLAN](../MASTER_PLAN.md).

## Mục tiêu

Tích hợp đúng hai tính năng AI có ích và độc lập: trợ lý chọn món cho khách và phân tích phản hồi cho quán. Đây là tiêu chí bắt buộc, không phải việc chỉ làm khi còn thời gian. Chatbot và gợi ý món trong cùng trợ lý không được đếm thành hai AI.

## Công việc

- [x] **P07-T01** — **[ALL]** Chốt tiêu chí thành công và tập đánh giá tổng hợp: nhu cầu/ngân sách/số người/khẩu vị, món hết bán, review ít/mâu thuẫn và input phá cấu trúc. Xác định kết quả mong đợi, lỗi có thể chấp nhận, ngân sách request và thời gian chờ; không ghi metric chưa đo.
- [x] **P07-T02** — **[C]** Làm AI gateway trong Express với key chỉ backend, timeout, giới hạn input/output, rate limit theo uid, retry hữu hạn và log không có secret/PII. Prompt/model/schema quản lý phiên bản; text món/review/user là dữ liệu không đáng tin, không thành lệnh hoặc câu query tùy ý.
- [x] **P07-T03** — **[A]** Backend lấy món còn bán theo quán, giới hạn suất và ngân sách. Model chọn mã tổ hợp và mã lý do. Express kiểm lại tổ hợp hiện thời, trả foodId, optionIds, số suất và tổng tiền nguyên VND.
- [x] **P07-T04** — **[A]** Làm UI trợ lý chọn món: nhập nhu cầu, xem món/lý do/tổng đã kiểm tra, mở chi tiết và xác nhận thêm giỏ. Tôn trọng một quán/tối đa 20 dòng; AI không tự checkout, không hủy đơn và không bảo đảm thông tin thành phần chưa được quán cung cấp.
- [x] **P07-T05** — **[B]** Làm backend merchant review insights đọc review thuộc quán, khoảng thời gian và mẫu dữ liệu rõ. Trả nhóm chủ đề/khen/chê/tóm tắt/gợi ý cùng reviewId nguồn có thật; validate nguồn và không suy diễn số liệu ngoài tập review đã lấy.
- [x] **P07-T06** — **[B]** Làm UI insights có phạm vi ngày, số review dùng, thời điểm tạo, chủ đề và liên kết mở review nguồn. Trạng thái thiếu dữ liệu phải nói rõ; fixture COMPLETED/review được gắn nhãn khi dùng cho phát triển/demo, không coi là đánh giá khách thật.
- [x] **P07-T07** — **[C]** Làm cache theo phiên bản catalog hoặc cửa sổ review, hạn mức và fallback khi provider lỗi/quá thời gian/hết ngân sách. App vẫn tìm món/đọc review bình thường; không dùng lời đáp viết sẵn rồi gắn nhãn là kết quả AI vừa chạy.
- [x] **P07-T08** — **[ALL]** Chạy bộ case đã chốt cho cả hai AI và review chéo đầu ra: món tồn tại/tổng đúng, budget, nguồn review, cross-restaurant access, prompt injection và key không xuất hiện trong bundle/log. Lưu raw output đã loại dữ liệu nhạy cảm, kết quả validation, độ trễ và chi phí thực.

## Sản phẩm bàn giao

Hai luồng AI có UI/API, prompt/schema phiên bản, validation và fallback; tập đánh giá và báo cáo kết quả; hướng dẫn cấu hình key server và ngân sách. Không huấn luyện mô hình riêng hoặc thêm AI thứ ba trong phạm vi bắt buộc.

## Kiểm thử nghiệm thu và cổng hoàn thành

1. Khách nhập nhu cầu mới, nhận gợi ý từ món thật; foodId/optionIds/qty/tổng được server kiểm tra; menu không có options vẫn dùng được.
2. Kết quả sai/không đủ budget không bị thêm giỏ âm thầm; AI không thực thi mua hàng thay khách.
3. Quán xem chủ đề từ review thật/fixture có nhãn và mở được nguồn; endpoint phân tích không xử lý quán ngoài quyền, dù review công khai có thể được xem qua catalog.
4. Hai tính năng có mục đích và đầu ra riêng, đều gọi model thật trong bản nghiệm thu.
5. Provider lỗi vẫn dùng luồng chính; cache có dấu thời gian; key chỉ backend.
6. Có báo cáo case và kết quả thật, không gắn hai ví dụ đẹp thành bằng chứng toàn hệ thống chính xác.

## Rủi ro

Model có thể bịa món, giá hoặc nguồn: bắt buộc kiểm tra có cấu trúc và grounding. Review ít dễ suy diễn: hiện số mẫu và giới hạn. Chi phí/provider không ổn định: hạn mức, cache, fallback và video dự phòng, nhưng không bỏ hai AI khỏi nghiệm thu.

## Bằng chứng cần lưu

artifacts/evidence/P07/: dataset tổng hợp, prompt/schema/model version, input/output đã che dữ liệu, bảng pass/fail, latency/cost và video hai luồng. Không commit key, chat cá nhân hoặc thông tin người đánh giá.

## Bàn giao tiếp theo

Cấu hình giới hạn, kết quả đánh giá và điểm lỗi cho [P08](P08-hardening-performance.md); kịch bản hai AI và điều kiện demo cho [P09](P09-release-demo.md).

## Kết quả local

Hoàn tất 8/8 hạng mục. Xem [báo cáo P07](../PHASE07_REPORT.md).
