# Blaze Word Collection

Nền tảng thu thập phương ngữ bằng văn bản: trò chơi, góp trực tiếp, hai người duyệt độc lập, chỉnh lý và xuất dữ liệu có phiên bản. Người dùng và Reviewer dùng chung frontend/API trên cổng 7777. Audio, ví và role-play legacy tắt trong pilot web.

## Chạy local trên Windows

Cài Node.js và Python, chuẩn bị dependencies:

```powershell
cd frontend
npm ci
cd ..\backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
cd ..
.\scripts\start-local.ps1
```

Mở `http://localhost:7777/demo`. Script build frontend và chạy API cùng một cổng. Sau khi sửa frontend, chạy lại script. `-SkipBuild` chỉ dùng khi đã có bản build mới.

Cấu hình backend theo `backend/.env.example`; không commit `.env`, DB, audio, tài khoản QA hoặc khóa API. Tạo tài khoản quản lý bằng `backend/scripts/create_admin.py --help`. Log local nằm trong `%TEMP%/blaze-local-dev`.

## Kiểm tra

```powershell
cd frontend
npm run lint -- --max-warnings 0
npm run build
npm test
cd ..\backend
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

CI kiểm tra frontend, backend với DB tạm và container một cổng. QA riêng: `scripts/start-qa.ps1`; dữ liệu và tài khoản kiểm thử ở ngoài repository.

## Triển khai bằng Docker

Sao chép `.env.pilot.example` thành `.env.pilot`, điền secrets riêng, origin HTTPS và IP proxy được tin cậy. Compose chỉ mở cổng trên loopback, cần reverse proxy theo `deploy/blaze.nginx.conf`.

```bash
docker compose --env-file .env.pilot build
docker compose --env-file .env.pilot run --rm app python -m scripts.db_migrate init /data/annotator.db
docker compose --env-file .env.pilot up -d
```

`init` chỉ dành cho DB mới. Với DB hiện có, backup rồi dùng `scripts.db_migrate --help` để adopt/upgrade trên bản sao; không khởi tạo đè DB thật. Công cụ backup/restore nằm trong `backend/scripts`. Health check: `/api/health`. Dùng image phát hành cố định và backup DB tương thích khi rollback.

## Dữ liệu và quyền sử dụng

- Bản gốc phương ngữ và bản phổ thông lưu riêng; câu mở cần nhập nội dung địa phương rõ ràng.
- Mỗi mẫu cần hai người duyệt độc lập; không tự duyệt. Bất đồng cần người phân xử độc lập.
- Người góp quyết định quyền sử dụng. Reviewer được thu hẹp quyền, không được tự mở rộng thay người góp.
- Bản xuất kiểm quyền nguồn, consent, chỉnh lý và chia nhóm trên server. Công cụ `scripts.verify_dataset` kiểm tra tệp đã tải; không thay thế xác minh quyền hiện hành hoặc đánh giá chuyên gia.
- Mẫu minh họa và dữ liệu chưa được bản địa/chuyên gia xác nhận chưa được coi là dữ liệu huấn luyện chính thức.

## Cấu trúc

- `frontend/`: giao diện React và kiểm thử.
- `backend/`: API, dịch vụ nghiệp vụ, migration và công cụ dữ liệu.
- `deploy/`: cấu hình proxy; `.github/workflows/`: CI.
- `ml/`: công cụ thử nghiệm audio/ML độc lập; xem `ml/README.md`. Audio, model và kết quả chạy không nằm trong Git.
- `test-fixtures/`: dữ liệu tổng hợp cho kiểm thử.
- `docs/`: tài liệu kỹ thuật nền; báo cáo tiến độ và tài liệu phát sinh không đưa lên repo.
