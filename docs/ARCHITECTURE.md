# Kiến trúc pilot văn bản

React/TypeScript giao tiếp với FastAPI qua `/api`. `scripts/start-local.ps1` và image Docker gốc phục vụ bản build frontend/API chung cổng 7777. Vite riêng proxy tới API mặc định 8765.

## Tổ chức source

| Thư mục | Trách nhiệm |
| --- | --- |
| `frontend/src/features/demo/` | Chơi, đóng góp, reviewer, đồng bộ và bộ nhớ trình duyệt |
| `frontend/src/features/dialect/` | Thành phần phương ngữ và điểm vào tương thích |
| `frontend/src/api/`, `components/`, `lib/`, `styles/` | API client, thành phần chung, kiểu dữ liệu và giao diện |
| `backend/app/routers/` | Endpoint, xác thực và phân quyền |
| `backend/app/services/` | Luật nghiệp vụ, game, consent, duyệt và dataset |
| `backend/app/models/`, `schemas/`, `core/` | SQLAlchemy, dữ liệu vào/ra, cấu hình và bảo mật |
| `backend/app/data/` | Catalog khởi tạo và chính sách nội dung |
| `backend/migrations/` | Phiên bản schema Alembic |
| `backend/scripts/` | Tài khoản, migration, backup, restore và kiểm dataset |
| `scripts/` | Điều phối local, preview audio và đóng gói trên Windows |
| `deploy/` | Cấu hình reverse proxy mẫu |
| `designs/` | Artboard và tài nguyên thiết kế nguồn |
| `ml/` | Công cụ xử lý ML/audio độc lập |

Mã audio, wallet và role-play được giữ cho tương thích; route legacy tắt mặc định. Không xóa chỉ vì không xuất hiện trong menu pilot.

## Database và đồng bộ

Database là SQLite qua SQLAlchemy, bật WAL và thời gian chờ khóa. `DATABASE_URL` xác định file; mặc định `sqlite:///./annotator.db` tính từ thư mục chạy backend. Compose lưu `/data/annotator.db` trong volume `backend_data`. DB không nằm trong Git hay image ứng dụng.

Server lưu người dùng, đóng góp, consent, nguồn, phiếu duyệt, chỉnh lý, release, kho game có phiên bản và snapshot lượt chơi. Lệnh game có khóa chống lặp và kiểm phiên bản khi retry. Catalog khởi tạo ở `backend/app/data/game_catalog.json`; khởi động lại không ghi đè catalog đã có.

IndexedDB lưu cache, outbox và dữ liệu local. `server.ts` đồng bộ nghiệp vụ; `gameServer.ts` đồng bộ game; `DemoProvider.tsx` điều phối theo tài khoản. Chỉ dữ liệu API đã xác nhận mới có thể lấy lại từ server trên thiết bị khác. `VITE_DEMO_SERVER=off` và phiên local cũ có thể chỉ tồn tại trong trình duyệt.

Đưa source lên server mới không tự chuyển DB hoặc IndexedDB hiện tại. Cần backup DB, kiểm schema rồi chuyển bản sao vào volume server; có thể khởi tạo DB rỗng nếu không cần dữ liệu cũ. Dùng công cụ backup SQLite hỗ trợ WAL thay vì copy riêng file DB đang ghi.

## Quy tắc nghiệp vụ và vận hành

- Giữ RAW; bản chỉnh lý và lịch sử duyệt được lưu riêng.
- Hai người duyệt độc lập, không tự duyệt; bất đồng cần người phân xử độc lập.
- Kiểm quyền nguồn và consent hiện hành khi xuất dữ liệu; reviewer không tự mở rộng quyền thay người góp.
- Snapshot game giữ ngữ cảnh lượt chơi. Chính sách nội dung lọc khi tạo lượt mới; không sửa ngầm lịch sử. Xem [chính sách câu hỏi](PLAYER_CONTENT_POLICY.md).
- Xác thực JWT trong cookie HttpOnly; middleware kiểm origin cho thao tác thay đổi dữ liệu, rate limit và HTTP security. Phân quyền thực hiện trên backend.
- Production yêu cầu secrets riêng, cookie Secure, origin HTTPS rõ ràng, legacy tắt và schema đúng migration head. Uvicorn chỉ tin proxy được khai báo; proxy ghi đè forwarded headers và hạn chế ingress backend.
- Development/test có thể tạo bảng bằng `create_all`; production dùng migration rõ ràng.

Xem [hướng dẫn phát triển](DEVELOPMENT.md), [API](API.md) và [README triển khai](../README.md).
