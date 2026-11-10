# Nối /demo vào backend phương ngữ (2026-11-09)

Khi đã đăng nhập, `/demo` lấy và ghi dữ liệu thật qua `/api/dialect`. Game, câu hỏi/đề, chiến dịch, nhiệm vụ, media và AI job vẫn ở IndexedDB.

| Dữ liệu demo | Nơi lưu | API |
|---|---|---|
| Mẫu đóng góp (game, góp từ, import, sửa dịch) | `dialect_contributions` + `dialect_contribution_meta` | `POST /dialect/contributions`, `POST /contributions/{id}/consent`, `POST /sessions/{ref}/withdraw` |
| Phiếu, phân xử, chuẩn hóa | `dialect_votes`, meta.curated | `POST /reviews/{id}/votes`, `/finalize`, `/curate` |
| Nguồn (train/public/audio) | `dialect_sources` + `dialect_source_rights` | `POST /sources/{id}/rights` |
| Release CURATED có split, data card | `dialect_releases` + `dialect_release_cards` | `POST /releases` với `ids`, `GET /releases/{id}` |
| Người tham gia: vai trò, vùng chuyên môn, xác nhận, rủi ro, khiếu nại | `users.role` + `dialect_participants` | `PUT /participants/{id}`, `POST /me/appeal` |
| Hạn mức AI nội bộ | `dialect_credits`, `dialect_settings` | `PUT /rewards/policy`, `POST /credits`, `/credits/{id}/revoke`, `/credits/spend` |
| Phản hồi | `dialect_feedback` | `POST /feedback`, `/feedback/{id}/resolve` |
| Toàn bộ dữ liệu được phép xem | — | `GET /dialect/workspace` |

## Cách đồng bộ

- `features/demo/server.ts`: ánh xạ server ↔ kiểu demo, chạy lệnh trên server, outbox.
- `DemoProvider` đồng bộ khi mở trang và sau mỗi lệnh server, lệnh `contribute`/`submit`/`withdrawSession`.
- Mẫu được ghi cục bộ trước rồi gửi với id cục bộ làm idempotency key. Bản cục bộ chỉ bị bỏ khi server trả mẫu có `client_ref` trùng, nên mất mạng không làm mất bài; server từ chối hẳn (4xx) thì mẫu bị bỏ khỏi outbox và ghi event `SYNC_REJECTED` kèm nội dung.
- Phiếu của người khác được ẩn: client nhận phiếu giả `sealed` chỉ để đếm.
- `VITE_DEMO_SERVER=off` giữ demo hoàn toàn trên trình duyệt (test vitest dùng chế độ này).

## Quy tắc server mới

- Câu trả lời game (`method=game`) chỉ cần nội dung chữ; góp trực tiếp vẫn cần đủ nghĩa, bản phổ thông, ngữ cảnh, nguồn. Phản hồi `unknown/no_term/same_standard` không cần nội dung.
- Câu game trùng hoàn toàn với mẫu khác bị HOLD và không vào hàng chờ duyệt.
- Không tự chuẩn hóa mẫu của mình; reviewer có vùng chuyên môn chỉ bỏ phiếu trong vùng đó.
- Điều kiện xuất dùng consent hiệu lực (sau khi đổi), loại mẫu trùng và phản hồi không phải mục từ. Release theo `ids` còn bắt buộc có bản CURATED đủ 4 trường.
- Cấp hạn mức: chính sách bật, tài khoản xác nhận và không bị tạm giữ, mẫu đủ điều kiện + đã chuẩn hóa + không trùng, 5 lượt/mẫu, tối đa 4 lần/ngày, hết hạn 30 ngày. Không liên quan ví VND.
- Phiên bản consent chấp nhận: `dialect-2026-11-v1`, `demo-consent-v1`, `demo-import-v1`, `demo-ai-feedback-v1`.

## Giới hạn còn lại

- Chưa có Alembic: chỉ thêm bảng mới, không sửa bảng cũ. Đổi cột sau này cần migration.
- Màn quản trị không cấp quyền admin; vai trò chỉ chuyển giữa Người góp và Reviewer.
- Media/audio đính kèm vẫn chỉ ở trình duyệt; server chỉ lưu id media.
- Mẫu có bản bổ sung chưa rút bị loại khỏi xuất ở server (demo cục bộ chỉ loại khi bản bổ sung đã VERIFIED).
- `GET /dialect/workspace` trả tối đa 1000 mẫu gần nhất, chưa phân trang.

## Kiểm tra

- Backend: `tests/test_dialect_workspace.py` (7 test) cùng test dialect/auth cũ: 14/14 qua.
- Frontend: `tests/demo-server.test.ts` (8 test). Bộ vitest 59/63 qua; 4 test lỗi sẵn trước thay đổi này do tiêu đề màn cảm ơn đã đổi thành "Cảm ơn bạn đã góp." mà test vẫn tìm "Cảm ơn bạn đã góp tiếng quê.".
- Trình duyệt trên bản sao DB: đăng ký → chơi game 10 câu → 5 mẫu lên server; đổi consent, rút mẫu; 2 reviewer bỏ phiếu; admin chuẩn hóa, xác nhận quyền nguồn, xác nhận tài khoản, tạo release, tải manifest, bật chính sách và cấp hạn mức, gửi và xử lý phản hồi.
