# Blaze Voice Collection

> **Bản hiện tại (09/11/2026):** `/` chuyển vào [APPDICHTHUAT](http://localhost:7777/demo). Game 10 câu cần đăng nhập qua backend. Đề, lượt chơi và media vẫn ở IndexedDB; mẫu đóng góp, kiểm duyệt và release đồng bộ qua `/api/dialect` theo mặc định. Game chữ không cần MinIO. Đọc [bản bàn giao tổng hợp](docs/CLAUDE_HANDOFF.md) để phân biệt game, luồng phương ngữ qua API và nền tảng audio bên dưới. Claude Code bắt đầu từ [CLAUDE.md](CLAUDE.md).

Nền tảng **thu thập & gán nhãn dữ liệu giọng nói** có **tích điểm thưởng quy đổi ra tiền**.

- **Admin** tạo project, upload audio / câu hỏi, cấu hình điểm cho từng loại task, duyệt kết quả và duyệt yêu cầu rút tiền.
- **Annotator** nhận task (nghe → viết, xác nhận nhãn, hỏi đáp bằng giọng nói, role-play với voice bot), tích điểm, rút tiền về tài khoản ngân hàng.

> Backend gốc dùng tên kỹ thuật **Audio Annotator** (`app_name`); giao diện dùng thương hiệu **Blaze**. Repo: `Actable-AI/blaze-voice-collection`.

## Chạy local trên Windows

Sau khi đã cài dependencies, chạy `./scripts/start-local.ps1` từ thư mục project để bật cả backend (8765) và frontend (7777). Script kiểm tra API qua frontend trước khi báo sẵn sàng; log nằm trong `%TEMP%/blaze-local-dev`. Trang chủ: http://localhost:7777/demo. API frontend dùng `/api` qua Vite proxy để giữ cookie cùng host.

## Tính năng audio và ví legacy

| Nhóm | Mô tả |
|---|---|
| Gán nhãn audio | 3 loại task: `audio_label` (nghe → viết transcript), `audio_verify` (xác nhận nhãn đúng/sai), `qa` (trả lời câu hỏi bằng text / lựa chọn / ghi âm). |
| Thu thập role-play | Project loại `collect`: annotator nói chuyện realtime với voice-bot agent qua WebSocket, backend ghi âm stereo và lưu vào MinIO. |
| Phân bổ task | Khoá task theo TTL 10 phút, đảm bảo redundancy, ưu tiên task chưa ai làm / đang bất đồng, tái-gán ngẫu nhiên để kiểm tra độ nhất quán. |
| Kiểm soát chất lượng | Behavior signals (thời gian, % audio đã nghe), admin duyệt từng annotation, tự động khoá user có tỉ lệ bị reject ≥ 30%. |
| Điểm & ví | Điểm chờ duyệt / đã xác nhận, quy đổi `1 điểm = 50 VND`, rút tối thiểu 100 điểm, admin duyệt → đánh dấu đã trả. |
| Báo lỗi dữ liệu | Annotator report audio hỏng; admin approve thì annotator vẫn được điểm. |

## Tech stack

- **Backend:** Python 3.12 · FastAPI · SQLAlchemy 2 · SQLite · MinIO (S3) · JWT trong httpOnly cookie
- **Frontend:** React 19 · TypeScript · Vite · React Router 7 · react-bootstrap · wavesurfer.js
- **Storage:** MinIO bucket `audios` (file audio, bản ghi âm câu trả lời, bản ghi role-play)

## Chạy nhanh (local, không Docker)

Yêu cầu: Python 3.12, Node 20+, MinIO (`brew install minio/stable/minio`).

```bash
# 1. MinIO — S3 API :9100, console :9101
MINIO_ROOT_USER=minioadmin MINIO_ROOT_PASSWORD=minioadmin \
  minio server .minio_data --address :9100 --console-address :9101

# 2. Backend — http://localhost:8765/api  (Swagger: /docs)
cd backend
python3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env
.venv/bin/uvicorn app.main:app --reload --port 8765

# 3. Frontend — http://localhost:7777
cd frontend
npm install
cp .env.example .env
npm run dev
```

Bảng DB được tạo tự động khi backend khởi động (`Base.metadata.create_all`). Tạo tài khoản admin đầu tiên:

```bash
cd backend
.venv/bin/python -m scripts.create_admin admin@example.com 'MatKhau@123' "Admin"
```

Tài khoản đăng ký qua trang `/register` luôn có role `annotator`.

> **Docker:** `docker compose up -d --build` cũng chạy được toàn bộ stack (frontend :7777, backend :8765, MinIO :9100/:9101), nhưng image `minio/minio` và `minio/mc` có thể không pull được từ Docker Hub — khi đó dùng cách chạy local ở trên. Chi tiết: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Cấu trúc thư mục

```
.
├── backend/                 FastAPI JSON API
│   ├── app/
│   │   ├── main.py          Khởi tạo app, CORS, đăng ký router
│   │   ├── core/            config, database, security (JWT/bcrypt), storage (MinIO)
│   │   ├── models/          SQLAlchemy ORM — audio, phương ngữ, tài khoản và ví
│   │   ├── schemas/         Pydantic DTO request/response
│   │   ├── routers/         HTTP + WebSocket endpoints (mỏng, chỉ gọi service)
│   │   └── services/        Business logic (phân bổ, chấm điểm, ví, role-play…)
│   └── scripts/create_admin.py
├── frontend/                Vite + React + TS
│   └── src/
│       ├── api/             Hàm gọi API (axios, withCredentials)
│       ├── features/        Game demo, phương ngữ, auth và các module audio/ví legacy
│       ├── pages/           Trang cấp cao (Dashboard, Rewards, History, Settings, Withdrawals)
│       ├── components/      Layout, route guard, provider dùng chung
│       └── lib/             Type definitions + tiện ích
├── docs/                    Tài liệu cho developer
├── docker-compose.yml
└── test_elevenlabs_realtime_stt.py   Script thử nghiệm STT, không thuộc app
```

## Tài liệu

| File | Nội dung |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Kiến trúc, domain model, các luồng nghiệp vụ chính (phân bổ, chấm điểm, review, ví, role-play), bảo mật, những gì chưa làm |
| [docs/CLAUDE_HANDOFF.md](docs/CLAUDE_HANDOFF.md) | Bản đồ dự án hiện tại, API phương ngữ, cách chạy, kết quả kiểm tra và mục lục tài liệu |
| [docs/API.md](docs/API.md) | Tham chiếu các endpoint nền tảng audio legacy; API hiện tại có ở Swagger backend `/docs` |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Setup, biến môi trường, quy ước code, cách thêm task type / endpoint, xử lý sự cố |
| [docs/PLAN.md](docs/PLAN.md) | Bản thiết kế ban đầu (roadmap, anti-cheat, payout). **Không phản ánh đúng code hiện tại** — xem ARCHITECTURE trước |
| [docs/concerns.md](docs/concerns.md) | Các mối lo về bảo mật dữ liệu cần xử lý |
