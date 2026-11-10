# Rà soát khoảng trống và kế hoạch task theo phase (10/11/2026)

Đối chiếu `docs/CLAUDE_HANDOFF.md`, `UX_UI_AUDIT_2026-11-09.md`, `DEMO_SERVER_SYNC_2026-11-09.md`, `ARCHITECTURE.md`, `concerns.md`, `PLAN.md` với mã nguồn hiện tại trong workspace (gồm file chưa commit).

## 1. Kết quả kiểm tra chạy lại hôm nay

| Kiểm tra | Kết quả |
| --- | --- |
| `npm run build` (frontend) | Đạt |
| `npm test` (frontend) | **66/70 đạt**. 4 lỗi cũ: `demo-flow.test.tsx` (1) và `dataset-game.test.tsx` (3) vẫn tìm heading "Cảm ơn bạn đã góp tiếng quê." |
| `npm run lint` (frontend) | **Trượt: 55 vấn đề (50 lỗi, 5 cảnh báo)**: 24 `set-state-in-effect`, 11 `react-hooks/refs`, 8 `no-explicit-any`, 6 `exhaustive-deps`, 4 `only-export-components`, 3 `purity`. Gần như toàn bộ nằm ở màn legacy (roleplay, annotate, audios, projects, wallet, DashboardPage) và `AuthContext.tsx`, `ConfirmProvider.tsx`. `features/demo` và `features/dialect` sạch. |
| Backend `unittest` (`DATABASE_URL=sqlite://`) | **13/13 đạt** |
| CI | Không có `.github/workflows` |

## 2. Khoảng trống đã xác minh trong mã

### Backend
| # | Vấn đề | Bằng chứng |
| --- | --- | --- |
| B1 | Lỗ hổng ACL legacy còn nguyên: liệt kê task, presigned URL, annotator của task chỉ `assert_member` | `routers/audios.py:63,352,383`; `schemas/audio.py:18,59` trả `is_golden` |
| B2 | Chưa có quên/đặt lại mật khẩu | `routers/auth.py` chỉ có register/login/logout/me/password |
| B3 | Không có rate limit cho login/register/contributions | không có middleware/limiter |
| B4 | Không có migration (Alembic) | `core/database.py:34` dùng `create_all` |
| B5 | Cấu hình mặc định không an toàn cho production: `debug=True`, `jwt_secret="dev-secret-change-me"`, `cookie_secure=False`, MinIO `minioadmin` | `core/config.py`; không có kiểm tra khi khởi động |
| B6 | `GET /dialect/workspace` giới hạn cứng 1.000 mẫu, chưa phân trang | `dialect_workspace.py:36` |
| B7 | Không kiểm chất lượng tối thiểu cho câu trả lời mở của game (nhận "d", "sd") | không có rule độ dài/chất lượng trong `dialect.py` |
| B8 | Không có endpoint thống kê lượt/đóng góp theo tài khoản (UI phải đếm IndexedDB) | — |
| B9 | Media đính kèm demo chỉ ở Blob local, server chỉ nhận ID | `models/dialect.py`, handoff §4 |
| B10 | Game/đề/lượt/chiến dịch/nhiệm vụ không có bảng server → không đồng bộ xuyên thiết bị | handoff §3–4 |
| B11 | Golden legacy chưa chấm `golden_correct`, chưa chèn theo `golden_ratio`; consensus chưa tự duyệt | `allocation_service.py:494` |
| B12 | Không có từ chối hàng loạt cho admin | không có endpoint bulk |
| B13 | Không có logging/audit log có cấu trúc | `main.py` |

### Frontend
| # | Vấn đề (mã audit) | Bằng chứng |
| --- | --- | --- |
| F1 | 4 test lỗi do đổi heading | xem §1 |
| F2 | Lint trượt 50 lỗi | xem §1 |
| F3 | Mobile: lưới Q01–Q10 đẩy câu hỏi và nút xuống dưới màn hình (03) | `GamePages.tsx:210`, chưa có thanh dính |
| F4 | Lưới câu thiếu `aria-current`/`aria-label` (A2 — mới có dấu ✓ nhìn thấy) | `GamePages.tsx:212` |
| F5 | Không có điều hướng câu bằng bàn phím | không có `onKeyDown` |
| F6 | Đổi vai trò/vùng/rủi ro ghi ngay khi đổi select, không xác nhận/hoàn tác (05) | `SettingsDemo.tsx:178` |
| F7 | Bảng xếp hạng đếm lượt từ IndexedDB (06) | `RewardsDemo.tsx:28,164` |
| F8 | Hiện ID `account:N` thay tên người (07) | `RewardsDemo.tsx:209,245` |
| F9 | Lỗi Pydantic tiếng Anh hiện nguyên văn (08) | `api/client.ts:34` |
| F10 | Thuật ngữ trạng thái không thống nhất, chưa có bảng glossary (09) | — |
| F11 | Mã "APPDICHTHUAT" trên trang công khai (10) | `HomeDemo.tsx:9`, `DemoLayout.tsx:53` |
| F12 | Ô đồng ý thiếu giải thích + link `/demo/rights` (12) | `GamePages.tsx:33` |
| F13 | Không hỏi xác nhận trước khi đẩy outbox cũ lên server (04) | `server.ts` |
| F14 | Ghi chú N1–N8: 2 nút chính cùng cấp, ô xác nhận mật khẩu thiếu icon, span "Tiếng Việt" giả select, `theme.css` indigo cũ 5.872 dòng, empty state trống, thiếu meta description/OG | `index.html`, `AuthShell.tsx:6`, `RegisterPage.tsx:78` |
| F15 | Màn chưa được audit: exams/questions/sessions/import/operations/campaigns/ai/community/dictionary/tasks, admin mobile, dark mode, zoom 200%, screen reader | audit §Chưa kiểm tra |

### Tài liệu và hạ tầng
| # | Vấn đề |
| --- | --- |
| D1 | `API.md`, `ARCHITECTURE.md`, `DEVELOPMENT.md`, `frontend/README.md` không nhắc API phương ngữ/`VITE_DEMO_SERVER`; `ARCHITECTURE.md §7` vẫn ghi "Test tự động: chưa có" |
| D2 | 74 file thay đổi/chưa theo dõi chưa commit; GitHub HEAD thiếu game, API phương ngữ, test |
| D3 | Không có CI; `docker-compose.yml` dùng `minio:latest` và credentials mặc định |
| D4 | Chưa có quyết định sản phẩm: luật Q01–Q03 (strict/signal), số reviewer (2 vs 3), SOP duyệt, question bank gold được chuyên gia duyệt |

## 3. Kế hoạch theo phase

Ước lượng: S ≈ ≤0,5 ngày, M ≈ 1–2 ngày, L ≈ 3–5 ngày.

### Phase 0 — Ổn định nền (tuần này)
Mục tiêu: repo xanh, có điểm khôi phục.
- [ ] **P0.1** (S) Commit toàn bộ workspace hiện tại thành các commit có nghĩa (backend dialect, frontend demo, docs, tests) trên nhánh riêng → PR. *(D2)*
- [ ] **P0.2** (S) Sửa 4 test theo heading "Cảm ơn bạn đã góp." *(F1)*
- [ ] **P0.3** (M) Sửa 50 lỗi lint, ưu tiên `AuthContext`, `ConfirmProvider`, rồi màn legacy. *(F2)*
- [ ] **P0.4** (S) Thêm GitHub Actions: build + vitest + lint + backend unittest. *(D3)*
- [ ] **P0.5** (S) Cập nhật `API.md`/`ARCHITECTURE.md`/`DEVELOPMENT.md` cho API phương ngữ, biến `VITE_DEMO_SERVER`, trạng thái test. *(D1)*

**Xong khi:** CI xanh trên PR, `npm test` 70/70, lint 0 lỗi.

### Phase 1 — Bảo mật và an toàn dữ liệu (bắt buộc trước khi mở cho người ngoài)
- [ ] **P1.1** (M) Khóa ACL legacy: `GET /projects/{id}/tasks`, `/presigned`, `/annotators` → admin/manager; ẩn `is_golden`/`golden_answer` khỏi schema trả cho annotator; thêm test. *(B1, concerns 1–3)*
- [ ] **P1.2** (S) Kiểm cấu hình khi khởi động ở môi trường production: từ chối `jwt_secret` mặc định, bắt buộc `COOKIE_SECURE`, `debug=False`. *(B5)*
- [ ] **P1.3** (M) Rate limit login/register/password/contributions/feedback. *(B3)*
- [ ] **P1.4** (M) Quên/đặt lại mật khẩu: token một lần có hạn, endpoint backend, màn `/forgot-password` + `/reset-password`; trước mắt ghi cách liên hệ admin ở `/login`. *(B2, audit 11)*
- [ ] **P1.5** (L) Đưa Alembic vào, tạo baseline migration từ schema hiện tại, bỏ phụ thuộc `create_all` cho bảng có sẵn. *(B4)*
- [ ] **P1.6** (S) Logging có cấu trúc + audit log cho thao tác admin (đổi vai, quyền nguồn, release, hạn mức). *(B13)*

**Xong khi:** test ACL âm tính (annotator không lấy được golden/presigned/annotator khác), migration chạy được trên bản sao DB.

### Phase 2 — Chất lượng dữ liệu phương ngữ (pipeline game → server → release)
- [ ] **P2.1** (M) Rule chất lượng câu trả lời mở: độ dài tối thiểu, chặn chuỗi lặp/ký tự rác, ở cả `domain.ts` và `dialect.py`; thông báo tiếng Việt. *(B7, audit 04)*
- [ ] **P2.2** (M) Từ chối/HOLD hàng loạt cho admin (endpoint + UI chọn nhiều ở `/demo/admin/review`). *(B12)*
- [ ] **P2.3** (M) Hỏi xác nhận trước khi gửi outbox cũ lên server; hiển thị số mẫu chờ gửi và cho bỏ. *(F13)*
- [ ] **P2.4** (M) Endpoint thống kê theo tài khoản (số `session_ref` riêng, mẫu đủ điều kiện); dùng cho bảng xếp hạng, thành tích, dashboard thay vì IndexedDB. *(B8, F7)*
- [ ] **P2.5** (M) Phân trang `GET /dialect/workspace` (cursor) và cập nhật `server.ts`. *(B6)*
- [ ] **P2.6** (M) Test E2E chiều dọc: game → outbox → server → 2 phiếu → quyền/consent → release, gồm lỗi mạng, 401/429, đổi tài khoản, rút mẫu, thu hẹp consent. *(handoff §7)*

**Xong khi:** không còn mẫu 1–2 ký tự vào hàng chờ, số liệu rewards khớp server, test E2E chạy trong CI.

### Phase 3 — UX/UI theo audit 09/11
- [ ] **P3.1** (M) Màn câu hỏi mobile: thu lưới thành "Câu 5/10" + ngăn kéo; thanh dính "Câu trước / Lưu & tiếp tục". *(F3)*
- [ ] **P3.2** (S) `aria-current="step"`, `aria-label` theo trạng thái cho lưới câu; phím mũi tên/phím tắt điều hướng câu. *(F4, F5)*
- [ ] **P3.3** (M) Settings: chế độ sửa theo dòng có nút Lưu, xác nhận khi đổi vai trò, ẩn dòng guest khi live. *(F6)*
- [ ] **P3.4** (S) Hiện tên người thay `account:N`. *(F8)*
- [ ] **P3.5** (S) Ánh xạ lỗi Pydantic sang tiếng Việt theo trường, `aria-invalid`/`aria-describedby`. *(F9)*
- [ ] **P3.6** (M) Bảng glossary trạng thái dùng chung cho filter/badge; viết lại `/demo/rights` bằng ngôn ngữ người chơi; bỏ "APPDICHTHUAT" ở trang công khai. *(F10, F11)*
- [ ] **P3.7** (S) Helper text cho 3 ô đồng ý + link "Xem chi tiết quyền dữ liệu". *(F12)*
- [ ] **P3.8** (S) Ghi chú N1–N3, N5–N8: hạ nút Đăng nhập thành outline, icon ô xác nhận mật khẩu, bỏ span giả select, empty state có hướng dẫn, meta description/OG. *(F14)*
- [ ] **P3.9** (L) Dọn `theme.css` indigo cũ, gộp các rule `.form-control:focus` trùng. *(N4)*
- [ ] **P3.10** (M) Audit tiếp các màn chưa kiểm + admin mobile + zoom 200% + screen reader. *(F15)*

**Xong khi:** audit chạy lại không còn mục Critical/Major.

### Phase 4 — Mở rộng nghiệp vụ lên server
- [ ] **P4.1** (L) Bảng và API cho đề/câu hỏi/phiên bản đề, lượt chơi (snapshot), chiến dịch/QR → đồng bộ xuyên thiết bị; giữ IndexedDB làm cache/offline. *(B10)*
- [ ] **P4.2** (L) Lưu media đính kèm lên MinIO (bucket riêng cho phương ngữ), consent `audio` tách riêng, xóa khi rút mẫu. *(B9)*
- [ ] **P4.3** (M) Chuyển backup, nhiệm vụ, từ điển sang server hoặc ghi rõ phạm vi local. 
- [ ] **P4.4** (M) Release: server tự chia split (thay vì tin split từ client), data card khớp scope.

### Phase 5 — Legacy audio và chất lượng gán nhãn (song song, theo nhu cầu)
- [ ] **P5.1** (L) Chấm golden (`golden_correct`), chèn golden theo `golden_ratio`, accuracy theo cửa sổ. *(B11)*
- [ ] **P5.2** (M) Consensus tự approve/reject theo đa số.
- [ ] **P5.3** (L) Stream audio qua backend/watermark thay presigned trực tiếp (PLAN §11).
- [ ] **P5.4** (L) Hold period, earning cap, KYC trước rút tiền (PLAN §14–16) — cần quyết định pháp lý.

### Phase 6 — Quyết định sản phẩm và chuẩn bị triển khai
- [ ] **P6.1** Chốt luật Q01–Q03 (strict vs signal), số reviewer (2 hay 3), SOP duyệt. *(D4)*
- [ ] **P6.2** Question bank gold do chuyên gia duyệt (nguồn, vùng, đáp án biến thể, approver, version).
- [ ] **P6.3** Hạ tầng production: Postgres thay SQLite, pin version Docker image, secrets, HTTPS, backup DB.
- [ ] **P6.4** Pipeline dịch/ASR/huấn luyện thật (hiện AIDemo chỉ mô phỏng) — chỉ sau khi có dataset đủ chất lượng.

## 4. Thứ tự khuyến nghị
Phase 0 → Phase 1 (bắt buộc trước khi có người dùng ngoài) → Phase 2 + Phase 3 song song (ít đụng file chung: P2 ở backend/`server.ts`, P3 ở component/CSS) → Phase 6.1 cần chốt trước Phase 4 → Phase 5 khi còn dùng luồng legacy.
