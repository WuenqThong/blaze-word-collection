# Blaze Voice Collection

Đọc [bản bàn giao tổng hợp](docs/CLAUDE_HANDOFF.md) trước khi làm việc. Tài liệu có bản đồ route, API, quy tắc dữ liệu, cách chạy, kết quả kiểm tra và mục lục tài liệu lịch sử.

- Đây là workspace có thay đổi chưa commit, gồm cả file chưa được Git theo dõi. Chạy `git status --short` và giữ các thay đổi đang có. Snapshot từ GitHub có thể thiếu tính năng local.
- Xác định đúng luồng trước khi sửa: `/demo` là game và quản trị APPDICHTHUAT; `/collection`, `/contribute/new`, `/review` là luồng phương ngữ trực tiếp; `/legacy`, `/projects`, `/roleplay`, `/rewards` là audio và ví legacy.
- Game, lượt, đề và media nằm ở IndexedDB. Khi có phiên xác thực và đồng bộ được bật, mẫu và nghiệp vụ duyệt/quyền/release/hạn mức nằm trên `/api/dialect`. Xem `frontend/src/features/demo/{DemoProvider.tsx,server.ts,domain.ts,repository.ts}` và `backend/app/routers/{dialect.py,dialect_workspace.py}`. `VITE_DEMO_SERVER=off` chỉ tắt đồng bộ nghiệp vụ demo.
- Giữ RAW và lịch sử, kiểm quyền trên server và tôn trọng consent hiệu lực khi xuất dữ liệu. Hạn mức AI phương ngữ khác ví VND legacy. Dùng DB tạm/browser profile riêng khi kiểm thử dữ liệu.
- Ưu tiên mã nguồn và kết quả kiểm tra hiện tại khi tài liệu cũ mâu thuẫn. Xem [DESIGN.md](DESIGN.md) và CSS đang chạy khi sửa UI.

**Windows:** chạy `.\scripts\start-local.ps1` từ root sau khi cài dependencies; frontend ở `http://localhost:7777/demo`, backend ở `127.0.0.1:8765`. Trong `frontend`, chạy `npm run build` và `npm test` khi phù hợp; trong `backend`, chạy `./.venv/Scripts/python.exe -m unittest discover -s tests -v`. Xem kết quả gốc và lỗi test đã biết trong [bản bàn giao](docs/CLAUDE_HANDOFF.md#6-chạy-local-và-kiểm-tra).
