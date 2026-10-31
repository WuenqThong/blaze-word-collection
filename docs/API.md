# API Reference

- Base URL: `http://localhost:8765/api`. Swagger UI có tại `http://localhost:8765/docs`, schema request/response chi tiết xem ở đó.
- Xác thực: cookie `access_token` (httpOnly) do `/auth/login` hoặc `/auth/register` set. Frontend gửi kèm bằng `withCredentials: true`.
- Cột **Quyền:**
  - `public`: không cần đăng nhập.
  - `user`: cần đăng nhập.
  - `member`: cần đăng nhập và là member project, *hoặc* project `public`, *hoặc* là admin.
  - `admin`: chỉ admin (`require_role("admin")`).
- Lỗi trả dạng `{"detail": "..."}` (message tiếng Việt), hoặc danh sách lỗi validate của Pydantic (422).

## Meta & Auth — `routers/auth.py`

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/health` | public | Healthcheck |
| POST | `/auth/register` | public | Đăng ký (role luôn là `annotator`) + set cookie |
| POST | `/auth/login` | public | Đăng nhập + set cookie |
| POST | `/auth/logout` | public | Xoá cookie |
| GET | `/auth/me` | user | User hiện tại |
| GET | `/users` | admin | Danh sách user (để thêm member) |

## Project — `routers/projects.py`

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/projects` | user | Admin thấy tất cả. User thấy project public + project mình là member |
| POST | `/projects` | admin | Tạo project |
| GET | `/projects/{id}` | member | Chi tiết |
| PATCH | `/projects/{id}` | admin | Sửa cấu hình (task_types, scoring, redundancy, repeat_ratio, status, visibility, agent…) |
| DELETE | `/projects/{id}` | admin | Xoá |
| GET | `/projects/{id}/members` | member | Danh sách member |
| POST | `/projects/{id}/members` | admin | Thêm member |
| DELETE | `/projects/{id}/members/{user_id}` | admin | Xoá member |
| GET | `/projects/{id}/report` | admin | Báo cáo tiến độ / đồng thuận của project |

## Dữ liệu (task) — `routers/audios.py`, prefix `/projects/{id}/tasks`

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `` | member ⚠️ | Liệt kê task (lọc `task_type`, `status`, phân trang) |
| POST | `/upload` | admin | Upload file audio (multipart), tạo Audio + Task |
| POST | `/prelabel` | admin | Áp prelabel từ CSV / JSONL / XLSX theo `filename` |
| GET | `/prelabel/template` | admin | Tải file template prelabel |
| POST | `/qa-questions` | admin | Tạo task QA từ file câu hỏi |
| POST | `/sync` | admin | Kéo file từ MinIO/S3 bên ngoài |
| GET | `/{task_id}/presigned` | member ⚠️ | Presigned URL của file audio |
| GET | `/{task_id}/annotators` | member ⚠️ | Các câu trả lời trên task (kèm email người làm) |
| PATCH | `/{task_id}` | admin | Sửa payload (sửa nhãn inline) |
| DELETE | `/{task_id}` | admin | Xoá task |

⚠️ Các endpoint này nên chỉ dành cho admin. Xem [ARCHITECTURE.md §6](ARCHITECTURE.md#6-bảo-mật).

## Gán nhãn — `routers/annotate.py`

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/me/next-task?task_type=` | user | Lấy hoặc tiếp tục task từ mọi project được phép. `task_type` ∈ `audio_label`, `audio_verify`, `qa`, bỏ trống = ngẫu nhiên |
| GET | `/projects/{id}/next-task` | member | Lấy task trong một project |
| POST | `/assignments/{id}/submit` | user (chủ assignment) | Nộp `{answer, time_spent_ms, audio_listened_sec, audio_play_count}` |
| POST | `/assignments/{id}/submit-voice` | user | Nộp câu trả lời QA bằng file ghi âm (multipart, ≤ 10MB) |
| POST | `/assignments/{id}/skip` | user | Bỏ qua, nhả lock |
| POST | `/assignments/{id}/report` | user | Báo audio lỗi (`routers/reports.py`) |
| GET | `/me/projects/{id}/stats` | user | Tiến độ của mình trong project |

Mã lỗi đáng chú ý: **403** khi tài khoản `under_review`/`suspended` hoặc không thuộc project · **409** khi assignment không còn `active` hoặc project chưa active · **410** khi lock hết hạn.

## Điểm, lịch sử, review — `routers/review.py`, `routers/reports.py`

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/me/annotations` | user | Lịch sử annotation của mình |
| GET | `/me/annotations/{id}/relabel-context` | user | Dữ liệu để sửa annotation đang pending |
| PATCH | `/me/annotations/{id}` | user | Sửa câu trả lời khi còn `pending` (không tính lại điểm) |
| GET | `/me/score-summary` | user | Điểm pending / confirmed / rejected, error rate |
| GET | `/me/reports` | user | Report của mình |
| GET | `/admin/overview` | admin | Số liệu tổng quan |
| GET | `/admin/annotations/pending` | admin | Hàng chờ duyệt theo annotation |
| POST | `/admin/annotations/{id}/review` | admin | `{approve, note}` |
| GET | `/admin/review/by-data` | admin | Hàng chờ duyệt gom theo file audio |
| GET | `/admin/review/by-data/{audio_id}` | admin | Chi tiết các câu trả lời trên một file |
| GET | `/admin/users/flagged` | admin | User bị flag / có tỉ lệ lỗi cao |
| POST | `/admin/users/{id}/account-status` | admin | Đặt `active` / `under_review` / `suspended` |
| GET | `/admin/reports` | admin | Danh sách report |
| POST | `/admin/reports/{id}/review` | admin | Duyệt report |

## Ví & rút tiền — `routers/wallet.py`

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET / PATCH | `/me/profile` | user | Hồ sơ + thông tin ngân hàng |
| GET | `/me/wallet` | user | Số dư (xem công thức ở [ARCHITECTURE.md §4.6](ARCHITECTURE.md#46-ví--rút-tiền--walletservice)) |
| POST | `/me/withdrawals` | user | Tạo yêu cầu rút `{amount_points, note}` |
| GET | `/me/withdrawals` | user | Lịch sử rút |
| GET | `/admin/withdrawals` | admin | Danh sách yêu cầu (lọc `status`) |
| POST | `/admin/withdrawals/{id}/approve` · `/reject` · `/mark-paid` | admin | Chuyển trạng thái |

## Role-play — `routers/roleplay.py`

Quản trị theo project, prefix `/projects/{id}/roleplay`:

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/scenarios` | member | Danh sách scenario |
| POST | `/scenarios` | admin | Tạo scenario |
| PATCH / DELETE | `/scenarios/{sid}` | admin | Sửa / xoá |
| GET | `/agent-use-cases` | admin | Đọc danh sách use case từ `agent_endpoint` |
| POST | `/scenarios/import-from-agent` | admin | Import scenario từ agent |
| GET | `/scenarios/{sid}/test-cases` | member | Danh sách test case |
| POST | `/scenarios/{sid}/test-cases` | admin | Tạo test case |
| PATCH / DELETE | `/scenarios/{sid}/test-cases/{tcid}` | admin | Sửa / xoá |
| GET | `/tasks` | admin | Tất cả phiên của project |

Phía annotator, prefix `/roleplay`:

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/scenarios` | user | Scenario user được làm |
| GET | `/scenarios/{sid}` | user | Chi tiết |
| GET | `/scenarios/{sid}/test-cases` | user | Test case đang bật |
| POST | `/tasks` | user | Bắt đầu phiên |
| WS | `/tasks/{id}/ws?client_id=&language=vi&mode=ai` | chủ phiên / admin (cookie) | Proxy tới agent. Đóng với mã 4401 / 4403 / 4404 khi lỗi |
| POST | `/tasks/{id}/end` | user | Kết thúc phiên |
| POST | `/tasks/{id}/recording` | user | Upload bản ghi từ client (≤ 200MB) |
| GET | `/tasks/me` | user | Lịch sử phiên |
| GET | `/tasks/{id}/recording-url` | user | Presigned URL bản ghi |
| POST | `/tasks/{id}/report` | user | Chấm phiên `{rating, note}` |
