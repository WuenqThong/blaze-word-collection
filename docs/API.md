# Bản đồ API pilot

Base path: `/api`. Schema chi tiết ở `/openapi.json`, giao diện tương tác ở `/docs` của backend đang chạy. Bảng dưới dùng đường dẫn đầy đủ cho endpoint đại diện; xem decorator trong router để biết mọi HTTP method, payload và response.

| Nhóm | Endpoint đại diện | Router trong `backend/app/routers/` |
| --- | --- | --- |
| Health | `GET /api/health` | `backend/app/main.py` |
| Tài khoản | `POST /api/auth/login`, `GET /api/auth/me` | `auth.py` |
| Đóng góp | `POST /api/dialect/contributions`, `GET /api/dialect/contributions/{cid}` | `dialect.py` |
| Consent và rút mẫu | `POST /api/dialect/contributions/{cid}/consent`, `POST /api/dialect/contributions/{cid}/withdraw` | `dialect_workspace.py`, `dialect.py` |
| Duyệt | `POST /api/dialect/reviews/{cid}/votes`, `POST /api/dialect/reviews/{cid}/finalize` | `dialect.py` |
| Chỉnh lý và duyệt nhóm | `POST /api/dialect/reviews/{cid}/curate`, `POST /api/dialect/reviews/bulk` | `dialect_workspace.py`, `dialect_review_ops.py` |
| Kho game | `GET /api/dialect/game/catalog`, `PUT /api/dialect/game/catalog/{kind}/{key}` | `dialect_game.py` |
| Lượt chơi | `POST /api/dialect/game/sessions`, `POST /api/dialect/game/sessions/{ref}/commands` | `dialect_game.py` |
| Workspace | `GET /api/dialect/workspace`, `GET /api/dialect/statistics`, `GET /api/dialect/audit` | `dialect_workspace.py` |
| Nguồn và dataset | `GET /api/dialect/sources`, `POST /api/dialect/sources/{sid}/rights`, `POST /api/dialect/releases` | `dialect.py` |
| Người tham gia | `GET /api/dialect/participants`, `POST /api/dialect/participants/{uid}/role` | `dialect.py` |
| Hạn mức và phản hồi | `POST /api/dialect/credits`, `POST /api/dialect/feedback` | `dialect_workspace.py` |
| Vận hành | `GET /api/dialect/operations/summary` | `pilot_operations.py` |

Client gửi cookie phiên xác thực và origin hợp lệ cho thao tác thay đổi dữ liệu; thao tác gắn tài khoản có kiểm danh tính tài khoản dự kiến. Backend kiểm vai trò, quyền vận hành, chủ sở hữu, tính độc lập khi duyệt và phiên bản dữ liệu. Dữ liệu riêng tư không được cache công khai.

Legacy audio, ví và role-play không được đăng ký khi `ENABLE_LEGACY=false` (mặc định pilot). [API lịch sử](legacy/API.md) không phải danh sách tính năng đang mở.
