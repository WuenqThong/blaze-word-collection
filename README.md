# Audio Annotator

Sprint 1: Authentication (client–server, layered architecture).

## Cấu trúc

```
backend/   FastAPI JSON API
  app/
    core/      config, database, security
    models/    SQLAlchemy ORM
    schemas/   Pydantic DTO
    services/  business logic
    routers/   HTTP endpoints + deps
    main.py
frontend/  Vite + React + TS + react-bootstrap
  src/
    api/        axios client + endpoints
    components/ Layout, ProtectedRoute
    features/   auth/ (LoginPage, RegisterPage, AuthContext)
    pages/      DashboardPage
    lib/        types
    router.tsx
    main.tsx
```

## Chạy local

### Backend

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env   # chỉnh JWT_SECRET trong production
.venv/bin/uvicorn app.main:app --reload --port 8765
```

API: http://127.0.0.1:8765/api · Docs: http://127.0.0.1:8765/docs

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Web: http://127.0.0.1:5173

## API hiện có

| Method | Path | Mô tả |
| --- | --- | --- |
| POST | `/api/auth/register` | Đăng ký + set cookie |
| POST | `/api/auth/login` | Đăng nhập + set cookie |
| POST | `/api/auth/logout` | Xoá cookie |
| GET  | `/api/auth/me` | User hiện tại |
| GET  | `/api/health` | Healthcheck |

JWT lưu trong **httpOnly cookie**, CORS bật `allow_credentials=true`.

## Kế hoạch tiếp theo

Xem [PLAN.md](PLAN.md) — các sprint kế tiếp: Project & Storage (MinIO/MongoDB), Annotation core, Quality, Anti-leak, Anti-bot, Payout.
