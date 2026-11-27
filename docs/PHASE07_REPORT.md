# Nghiệm thu P07 · Trợ lý chọn món và phân tích đánh giá

Cập nhật **2026-11-20**. Hoàn tất **8/8 hạng mục P07** trên môi trường local. Hai màn hình dùng React Native, Express, Firebase và Ollama trên loopback. Cách chạy nằm trong [hướng dẫn local](SETUP_LOCAL.md#chạy-hai-tính-năng-ai).

## Hai luồng nghiệp vụ

- Trong trang quán, khách mở Trợ lý chọn món, nhập nhu cầu, số người và ngân sách. Mô hình chọn trong tập món đang bán. Express kiểm món, tùy chọn bắt buộc, số suất còn và tổng tiền nguyên VND. Khách xác nhận trước khi thêm giỏ. Báo giá ở checkout vẫn lấy dữ liệu tại thời điểm đặt.
- Trong Vận hành quán, người quản lý chọn khoảng ngày để phân tích đánh giá đã xác minh. Từng chủ đề có nguồn mở được. Số mẫu, điểm trung bình và trạng thái điểm sao được tính từ dữ liệu nguồn. Dưới ba đánh giá, màn hình hiển thị số mẫu còn thiếu. Dữ liệu seed được gắn nhãn.
- Gateway dùng output JSON Schema và hướng dẫn riêng `FOODORDERNEXT_MENU_V2`, `FOODORDERNEXT_REVIEWS_V2`. Model chọn trong tối đa 10 tổ hợp đủ số suất và đã kiểm giá. Ở luồng đánh giá, model ưu tiên chủ đề và nguồn cần chú ý trong các cặp có căn cứ. Backend đối chiếu ID, giữ các ý kiến trái chiều và dựng thống kê. [Ollama Structured Outputs](https://docs.ollama.com/capabilities/structured-outputs)
- Mỗi tài khoản có tối đa 10 yêu cầu mỗi phút và 12 lượt gọi mô hình mỗi ngày UTC. Cổng dùng chung cho tối đa 80 lượt gọi mỗi ngày. Tối đa hai lần thử với lỗi kết nối phù hợp, 420 token đầu ra mỗi lượt. Cache model có hạn 5 phút cho món và 15 phút cho đánh giá, kiểm lại fingerprint nguồn. Lỗi, quá thời gian và thiếu ngân sách chuyển sang kết quả dự phòng có nhãn.

## Ca đánh giá và tiêu chí

| Ca | Kết quả yêu cầu |
|---|---|
| Hai suất theo mô tả và ngân sách 80.000 VND | Dùng món của đúng quán, đủ hai suất và tổng tiền thực đơn hợp lệ |
| Tùy chọn bắt buộc, hết suất, giá đổi, ngân sách quá thấp | Loại gợi ý sai; đọc giá, tồn mới trước khi dùng cache; bỏ chọn nếu giá thấp hơn mọi món |
| Bốn đánh giá tổng hợp sau chu trình giao và COD | Mỗi chủ đề có nguồn thuộc mẫu; công khai số lượng và điểm sao của mẫu |
| Quán khác, đánh giá chưa xác minh hoặc dưới ngưỡng | Phân quyền đúng; chỉ phân tích tập đã xác minh có từ ba nguồn |
| Lệnh giả trong nhu cầu, nội dung review và ID model bịa | Model không kích hoạt thao tác và hệ thống chỉ trả ID từ dữ liệu đã xác minh |
| Deadline, lỗi dịch vụ, cache, tốc độ và chi phí | Có fallback an toàn, ghi token và thời gian từng lượt thật. Mục tiêu demo là một lượt model trong giới hạn 20 giây khi đã tải |

## Kết quả kiểm thử hồi quy

| Kiểm tra | Kết quả | Bằng chứng |
|---|---|---|
| Unit Express, contracts, seed và migration | 50 ca đạt | [Log](../artifacts/evidence/P07/unit-tests.log) |
| Firebase Emulator | 56 ca đạt | [Log](../artifacts/evidence/P07/emulator-tests.log) |
| Mobile | 42 ca đạt, gồm xác nhận thay giỏ khi đổi quán và hiển thị số mẫu thiếu. Lint phạm vi sửa đạt | [Unit](../artifacts/evidence/P07/mobile-unit-tests.log), [lint](../artifacts/evidence/P07/mobile-lint.log) |
| Kiểm tra bundle Android | Có cả hai màn hình. Cấu hình và prompt Ollama ở Express | [Log](../artifacts/evidence/P07/mobile-bundle-audit.log) |
| Android Emulator | 4 ca đạt. Xem gợi ý, xác nhận giỏ, đọc phân tích và mở đánh giá nguồn | [Smoke](../artifacts/evidence/P07/android-smoke.json) |

## Lượt chạy với mô hình thật

Lượt nghiệm thu dùng Ollama và Qwen2.5 1.5B Q4_K_M trên CPU. Cấu hình 3B thử trước có tải nguội và sinh kết quả chậm trên máy này. Lượt làm nóng 1.5B trả lời câu thử trong 4,8 giây. [Thông tin model](../artifacts/evidence/P07/local-model.json) · [Lượt làm nóng](../artifacts/evidence/P07/model-cpu-warmup.json)

| Luồng | Kết quả đã đối chiếu | Thời gian gọi model | Token vào / ra |
|---|---|---:|---:|
| Trợ lý món | Hai suất cơm gà demo, 60.000 VND trong ngân sách 80.000 VND | 697 ms | 241 / 12 |
| Phân tích đánh giá | Bốn đánh giá từ bốn đơn đã giao và thu COD trong phiên demo. Chủ đề thời gian và đóng gói có điểm sao trái chiều | 2.338 ms | 279 / 14 |

Số đo trên là thời gian gọi Ollama trong một lượt local. Hai luồng đều dùng lại cache khi gọi lại cùng dữ liệu. Ca yêu cầu món ngoài quán không tạo ID giả, ngân sách 1.000 VND trả danh sách rỗng, và tài khoản quán khác nhận 403. Phí API bên ngoài của lượt chạy là 0. Điện năng và triển khai staging chưa được đo. [Kết quả và dữ liệu tổng hợp](../artifacts/evidence/P07/ollama-evaluation.json)

Ảnh Android từ lượt thử đạt. [Trợ lý chọn món](../artifacts/evidence/P07/android-menu-assistant.png), [giỏ sau xác nhận](../artifacts/evidence/P07/android-ai-cart.png), [màn phân tích](../artifacts/evidence/P07/android-review-insights.png), [đánh giá nguồn](../artifacts/evidence/P07/android-insight-source.png).

Hai đoạn ghi hình trên máy ảo demo bắt đầu sau đăng nhập. [Chọn món và xem trước giỏ](../artifacts/evidence/P07/android-menu-flow.mp4) · [Mở đánh giá nguồn](../artifacts/evidence/P07/android-review-flow.mp4)
