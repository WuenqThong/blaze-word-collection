# Phát triển và kiểm tra

Chạy từ root trên PowerShell, trừ khi đã chuyển thư mục. Dùng Node.js 22 và Python; CI/container dùng Python 3.12. Giữ lockfile và cài frontend bằng `npm ci`.

## Khởi động local

```powershell
cd frontend
npm ci
cd ../backend
py -m venv .venv
./.venv/Scripts/python.exe -m pip install -r requirements.txt
cd ..
./scripts/start-local.ps1
```

Mở `http://localhost:7777/demo`. Script build và phục vụ frontend/API chung cổng. Chạy lại sau khi sửa frontend; `-SkipBuild` chỉ dùng khi build đã cập nhật. Cấu hình theo `backend/.env.example` và `frontend/.env.example`.

Nếu cần Vite hot reload, chạy API từ `backend/` bằng `.venv/Scripts/python.exe -m scripts.serve` (8765), và `npm run dev` từ `frontend/` (7777). Giữ `VITE_API_BASE_URL=/api`. Không chạy hai dịch vụ cùng chiếm cổng 7777.

## Kiểm tra

```powershell
cd frontend
npm run lint -- --max-warnings 0
npm run build
cd ..
git diff --check
```

Bộ test tự động, simulator, fixture và script chạy/seed QA đã được gỡ khỏi repository theo yêu cầu. Kiểm tra thủ công bằng DB bản sao và browser profile riêng để không trộn dữ liệu với ứng dụng thường ngày.

## Schema và backup

Migration ở `backend/migrations/`. Chạy công cụ từ `backend/`:

```powershell
./.venv/Scripts/python.exe -m scripts.db_migrate --help
./.venv/Scripts/python.exe -m scripts.db_backup --help
./.venv/Scripts/python.exe -m scripts.db_restore --help
```

- `db_migrate init` chỉ tạo DB mới.
- `adopt` kiểm schema DB chưa có phiên bản trên bản sao đích, không ghi đè nguồn.
- Với DB đã có phiên bản, dùng `upgrade` theo hướng dẫn CLI, giữ backup trước khi nâng cấp.
- `db_backup SOURCE DESTINATION` tạo snapshot SQLite nhất quán; `db_restore` phục hồi vào đường dẫn mới.

Không xóa DB để sửa schema. Kiểm migration và backup trên bản sao trước khi áp dụng cho dữ liệu thật. Production từ chối khởi động khi schema chưa ở migration head.

## Quy ước thư mục

Endpoint đặt trong `backend/app/routers/`, nghiệp vụ trong `services/`, schema trong `migrations/`. Frontend chia theo feature. Trước khi xóa module, kiểm import động, route và build. Không format lại toàn bộ source không liên quan khi workspace có thay đổi.

Tài liệu hiện hành ở `docs/`; tài liệu cũ ở `docs/legacy/`; thiết kế nguồn ở `designs/`; thử nghiệm ML/audio ở `ml/`. Venv, dependency, build, cache, DB và kết quả chạy là dữ liệu local, không đưa vào Git.

Kiểm thử local không thay thế nghiệm thu HTTPS, cookie, proxy, khôi phục backup và tải đồng thời trên server thật.
