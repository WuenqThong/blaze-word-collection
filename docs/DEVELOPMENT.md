# Hướng dẫn phát triển

## Yêu cầu

| Công cụ | Phiên bản | Ghi chú |
|---|---|---|
| Python | 3.12 | Python 3.14 chưa được kiểm tra với `passlib` / `bcrypt==4.0.1` |
| Node.js | 20.19+ | Vite 8 cần từ bản này trở lên |
| MinIO | bản bất kỳ | `brew install minio/stable/minio` (kèm `mc`) |
| libmagic | — | Cho `python-magic`: `brew install libmagic` |

## Cổng & dịch vụ

| Dịch vụ | Local | Docker compose |
|---|---|---|
| Frontend (Vite dev) | `:7777` (`strictPort`) | `:7777` |
| Backend (uvicorn) | `:8765` | `:8765` → container `:8000` |
| MinIO S3 API | `:9100` | `:9100` → `:9000` |
| MinIO console | `:9101` (`minioadmin` / `minioadmin`) | `:9101` |

## Chạy local

Xem các bước trong [README](../README.md#chạy-nhanh-local-không-docker). Ba process chạy song song:

```bash
# Terminal 1 — từ thư mục gốc repo
MINIO_ROOT_USER=minioadmin MINIO_ROOT_PASSWORD=minioadmin \
  minio server .minio_data --address :9100 --console-address :9101

# Terminal 2
cd backend && .venv/bin/uvicorn app.main:app --reload --port 8765

# Terminal 3
cd frontend && npm run dev
```

Bucket `audios` được backend tự tạo khi khởi động (`StorageService._ensure_bucket`).

## Docker compose

```bash
docker compose up -d --build
```

- Backend dùng SQLite tại volume `backend_data:/data`, frontend chạy Vite dev server với code được mount.
- **Sự cố đã biết:** `minio/minio:latest` và `minio/mc:latest` có thể bị Docker Hub từ chối pull ("pull access denied"). Cách xử lý:
  - chạy MinIO local như trên và chỉ dựng backend + frontend bằng Docker, hoặc
  - đổi image sang một registry/tag mà máy pull được.

## Biến môi trường

### Backend (`backend/.env`, đọc bởi `app/core/config.py`)

| Biến | Mặc định | Mô tả |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./annotator.db` | Local nên dùng `sqlite:////Users/<you>/.annotator/annotator.db` để DB nằm ngoài repo |
| `JWT_SECRET` | `dev-secret-change-me` | **Bắt buộc đổi** khi deploy |
| `JWT_ALG` / `ACCESS_TOKEN_TTL_MIN` | `HS256` / `60` | |
| `COOKIE_SECURE` / `COOKIE_SAMESITE` | `false` / `lax` | Bật `COOKIE_SECURE=true` khi chạy HTTPS |
| `CORS_ORIGINS` | localhost:5173, :7777 | Dạng JSON list |
| `MINIO_ENDPOINT` | `127.0.0.1:9000` | Local dùng `127.0.0.1:9100` |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | `minioadmin` | |
| `MINIO_SECURE` / `MINIO_BUCKET` / `MINIO_PRESIGN_TTL_SEC` | `false` / `audios` / `600` | |
| `MAX_AUDIO_SIZE_MB` / `MAX_FILES_PER_UPLOAD` / `MAX_FILES_PER_SYNC` | `50` / `200` / `500` | |
| `POINT_TO_VND` / `MIN_WITHDRAWAL_POINTS` | `50` / `100` | Quy đổi điểm và ngưỡng rút |

### Frontend (`frontend/.env`)

| Biến | Mặc định |
|---|---|
| `VITE_API_BASE_URL` | `http://127.0.0.1:8765/api` |

> Cookie chỉ được gửi khi frontend và backend cùng *site*. Dùng `localhost` cho cả hai, hoặc `127.0.0.1` cho cả hai. Đừng trộn, nếu không sẽ bị 401.

## Quy ước code

**Backend**
- Router chỉ nhận request, kiểm tra quyền và gọi service. Logic nghiệp vụ đặt trong `services/`.
- Lỗi nghiệp vụ: `raise HTTPException(status.HTTP_xxx, detail="<message tiếng Việt>")`. Frontend hiển thị nguyên `detail`.
- Enum lưu dạng `String`, giá trị hợp lệ ghi trong comment cạnh cột.
- Thời gian: dùng `app.core.database.utcnow()` (UTC, naive), không dùng `datetime.utcnow()`.
- Quyền admin: `Depends(require_role("admin"))`. Quyền theo project: `ProjectService.assert_member`.

**Frontend**
- Code mới đặt trong `src/features/<domain>/`. API nằm ở `src/api/<domain>.ts` và dùng chung `apiClient`. Type nằm ở `src/lib/<domain>Types.ts`.
- UI dùng react-bootstrap + bootstrap-icons (`bi-*`). Style chung ở `src/styles/theme.css`.
- Báo lỗi bằng `extractError(err)`. Hộp xác nhận dùng `ConfirmProvider`.

## Công việc thường gặp

### Thêm một loại task mới
1. **Backend:**
   - Khai báo trường payload bắt buộc trong `REQUIRED_BY_TASK_TYPE`. Dict này bị **khai báo trùng** ở `services/audio_service.py` (dùng khi upload và phân bổ) và `services/prelabel_parser.py` (dùng khi parse file), nên phải sửa cả hai.
   - Khai báo validator cho answer trong `REQUIRED_ANSWER_BY_TYPE` (`services/allocation_service.py`).
   - Thêm type vào danh sách được phép ở `routers/annotate.py` (`my_next_task`).
   - Nếu type cần spawn task con hoặc chấm điểm riêng, sửa `AllocationService.submit`.
2. **Frontend:**
   - Thêm mode vào `features/annotate/modes.ts`.
   - Thêm UI trả lời trong `AnnotatePage.tsx` / `Playground.tsx`.
   - Thêm lựa chọn khi tạo project (`ProjectForm.tsx`) và ô nhập điểm (`ProjectScoringForm.tsx`).
3. Cập nhật bảng "Loại task" trong [ARCHITECTURE.md](ARCHITECTURE.md#loại-task).

### Thêm endpoint
1. Tạo schema trong `schemas/`.
2. Viết logic trong service tương ứng.
3. Thêm route vào router. Nếu là router mới, đăng ký trong `app/main.py` với `prefix="/api"`.
4. Thêm hàm gọi trong `frontend/src/api/`.
5. Cập nhật [API.md](API.md).

### Thay đổi schema DB
Project **chưa có migration**. `create_all` chỉ tạo bảng còn thiếu, **không** thêm cột vào bảng đã có. Khi thêm hoặc sửa cột:
- Dev: xoá file DB (mất dữ liệu), hoặc tự chạy `ALTER TABLE ... ADD COLUMN ...` bằng `sqlite3`.
- Trước khi có dữ liệu thật, nên thêm Alembic.

### Tạo / nâng quyền admin
```bash
cd backend && .venv/bin/python -m scripts.create_admin <email> <password> "<Họ tên>"
```
Nếu email đã tồn tại, script nâng user đó lên admin và giữ nguyên mật khẩu. Lưu ý: email có đuôi dành riêng như `.local` hoặc `.test` sẽ bị validator của form đăng nhập (`EmailStr`) từ chối.

## Kiểm tra trước khi commit

```bash
cd frontend && npm run lint && npm run build   # build có chạy tsc type-check
```
Backend chưa có test hay linter. Hãy kiểm tra thủ công qua Swagger (`/docs`).

## Xử lý sự cố

| Triệu chứng | Nguyên nhân / cách xử lý |
|---|---|
| `nohup: .venv/bin/uvicorn: No such file` | venv bị hỏng hoặc được tạo ở đường dẫn khác. Xoá `backend/.venv` rồi tạo lại |
| 401 dù đã đăng nhập | Frontend và backend khác host (`localhost` vs `127.0.0.1`), hoặc thiếu origin trong `CORS_ORIGINS` |
| Upload / phát audio lỗi | MinIO chưa chạy, hoặc `MINIO_ENDPOINT` sai cổng |
| Annotator không nhận được task | Project chưa `active`, user không phải member của project private, task đã đủ `redundancy`, hoặc tài khoản đang `under_review` |
| Frontend báo cổng 7777 bận | `strictPort: true`: tắt process đang chiếm cổng đó |
