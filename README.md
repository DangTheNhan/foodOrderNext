# FoodOrderNext

Ứng dụng đặt và giao đồ ăn trong khuôn viên trường, xây dựng bằng React Native, Express và Firebase.

**Cập nhật 2026-11-25.** Bản local có đặt đơn COD, quản lý quán, chat, hộp thư và GPS foreground. Khách có trợ lý chọn món, quán có phân tích đánh giá theo ngày. Hai tính năng dùng Ollama hoặc kết quả dự phòng có nhãn theo cấu hình Express.

Thư mục triển khai đang dùng là `C:\Users\dangt\Documents\Codex\FoodOrderNext`; bản kế hoạch cũ trong `Documents\ChatGPT\Project mobile` là bản trước khi triển khai.

Để chạy ứng dụng, đọc **[SETUP_LOCAL](docs/SETUP_LOCAL.md)**. Xem [tiến độ](docs/PROGRESS.md), [báo cáo kiểm thử local](docs/PHASE08_REPORT.md) và [hồ sơ bàn giao](docs/PHASE09_REPORT.md).

## Bắt đầu từ đây

1. Đọc [kế hoạch chính](docs/MASTER_PLAN.md).
2. Xem [tiến độ và bước tiếp theo](docs/PROGRESS.md).
3. Đối chiếu [P01: Auth và dữ liệu](docs/phases/P01-auth-data.md) cùng các spike P00 còn lại trước khi chốt nghiệm thu.
4. Theo dõi từng đầu việc trong [backlog](docs/BACKLOG.csv).

Kế hoạch chính là nguồn thống nhất về phạm vi và thứ tự triển khai. Thay đổi phạm vi phải cập nhật kế hoạch và nhật ký quyết định trước khi kéo theo thay đổi các phase.

## Tài liệu triển khai

| Tài liệu | Mục đích |
|---|---|
| [MASTER_PLAN](docs/MASTER_PLAN.md) | Mục tiêu, phạm vi, lộ trình, mốc nghiệm thu |
| [REQUIREMENTS](docs/REQUIREMENTS.md) | Đối chiếu PDF, yêu cầu người dùng và bằng chứng cần có |
| [ARCHITECTURE](docs/ARCHITECTURE.md) | Kiến trúc, trách nhiệm client/server/Firebase |
| [DATA_MODEL](docs/DATA_MODEL.md) | Collection, trường dữ liệu, truy vấn và index |
| [API_CONTRACT](docs/API_CONTRACT.md) | Hợp đồng API, lỗi, phân quyền và idempotency |
| [SCREEN_MAP](docs/SCREEN_MAP.md) | Danh sách màn hình và kế hoạch tái sử dụng UI |
| [MIGRATION](docs/MIGRATION.md) | Chuyển từ dự án SQL Server cũ sang Firebase |
| [TEST_PLAN](docs/TEST_PLAN.md) | Kiểm thử chức năng, quyền, realtime, AI, hiệu năng |
| [TEAM_AND_DELIVERY](docs/TEAM_AND_DELIVERY.md) | Phân công ba người, lịch tham khảo, Git và demo |
| [RISKS](docs/RISKS.md) | Rủi ro và phương án giảm phạm vi |
| [DECISIONS](docs/DECISIONS.md) | Quyết định đã thống nhất và điểm chưa xác định |
| [PROGRESS](docs/PROGRESS.md) | Trạng thái hiện tại và hướng dẫn tiếp tục |
| [SOURCES](docs/SOURCES.md) | Tài liệu gốc, snapshot mã cũ và tài liệu kỹ thuật |

## Cấu trúc dành cho mã nguồn

```text
apps/mobile/            React Native Android trước; iOS sau nếu có điều kiện
services/api/           Express API và worker thông báo trong cùng package
packages/contracts/    Kiểu dữ liệu và validation dùng chung
firebase/              Firestore/Storage Rules và indexes đã có ở P01
scripts/seed/          Seed dữ liệu giả lập tái tạo được
scripts/migration/     Công cụ chuyển dữ liệu sau khi đã kiểm tra schema
tests/                 Rules, integration, E2E, performance
data/fixtures/         Dữ liệu tổng hợp, không chứa thông tin người thật
artifacts/evidence/    Bằng chứng kiểm thử và số đo theo phase
artifacts/releases/    Bản build, slide, video khi đến P09
docs/phases/           Checklist và cổng nghiệm thu cho 10 phase
```

Root workspace gồm API/contracts; mobile có node_modules và lockfile riêng. Dùng `npm ci` tại root và `npm --prefix apps/mobile ci --workspaces=false`. Cấu hình debug mặc định chỉ dành cho Firebase Emulator local.

## Nguồn dự án cũ

- Repository: <https://github.com/DangTheNhan/foodOrder_Mobile>
- Snapshot đã đọc: `1bc4eabed01d1b975a60cf8e66396888a4538b07`.
- Baseline cũ: React Native + Express + **Microsoft SQL Server**.
- Đã nhập 142 tracked mobile files có lọc; runtime mới dùng Firebase. Dự án cũ được giữ nguyên để đối chiếu.
