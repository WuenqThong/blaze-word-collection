# Bàn giao frontend theo audit — 03/11/2026

## Phạm vi và định hướng

Đọc file audit đính kèm và đối chiếu project hiện tại. Giữ Be Vietnam Pro, logo gốc, accent #2563EB, shell #F4F5F7, panel trắng, radius 8/16px theo DESIGN.md. Làm lại cấu trúc nội dung và các luồng thao tác thay vì đổi thương hiệu.

Frontend thực tế chạy ở [localhost:7777](http://localhost:7777). API ở [localhost:8765/docs](http://localhost:8765/docs). Canvas nằm tại `E:\blaze-voice-collection\designs\blaze-collection`, gồm 6 board: tổng quan, login cũ, landing, contribution mobile, review và release. Login giữ nguyên bản thiết kế trước; các board mới là bản tham khảo trạng thái, không thay thế kiểm thử ứng dụng.

## Những gì đã thay đổi

| Khu vực | Giao diện và hành vi mới |
|---|---|
| Trang chủ | Hero hai cột, thẻ giải thích thông tin đóng góp, ba nguyên tắc quyền, hướng dẫn và tình trạng mini-game. Nêu rõ pilot cần tài khoản |
| Quyền dữ liệu | Ba phạm vi tách riêng, giới hạn đổi consent/rút, policy hai phiếu của pilot, game chưa mở; không hứa guest hoặc dịch AI đã có |
| Shell | Tên màn hình theo metadata, nhãn vai trò reviewer đúng; hồ sơ vùng đúng nội dung; công cụ cũ chỉ hiện trong sidebar admin |
| Dashboard contributor | Góp từ/câu, mẫu gần đây lấy từ API, trạng thái và link theo dõi |
| Dashboard reviewer | Pending/phiếu của tôi/HOLD lấy từ API và checklist đánh giá; ghi rõ chưa có phân công chuyên môn vùng |
| Dashboard admin | Số liệu thật và lối vào review/nguồn/bất đồng/quyền/xuất. Nhãn distinct không còn được trình bày như unique lexeme |
| Wizard | Bốn bước; nháp tách theo tài khoản và form identity; reset khi đổi query; lỗi từng trường, error summary liên kết và focus; chặn rời trang; success sau response; lượt mới bỏ parent |
| Danh sách đóng góp | Search/status/page nằm trong URL; giữ bộ lọc khi về từ chi tiết; nội dung và quyền nguồn hiển thị riêng |
| Chi tiết | Tách bản gốc, timeline, phiên bản và bảng QA/quyền nguồn/train/public/withdrawal; đường về theo role/context; HOLD hướng người góp bổ sung |
| Review | Split queue/reader, filter vùng/quyền nguồn, tab HOLD chỉ đọc; nháp phiếu theo tài khoản+mẫu+vote/decision; cảnh báo nếu storage lỗi; chỉ chọn VERIFIED khi đủ rubric |
| Nguồn | Search/filter server, mẫu liên quan, layout chứng cứ và căn cứ quyền; trạng thái lưu/error rõ ràng |
| Người tham gia | Search/role server, bảng có tên vai trò tiếng Việt, xác nhận trước đổi quyền và giải thích tác động tới hệ cũ |
| Bản xuất | Preview từ server, số đủ/chưa đủ điều kiện, lý do loại từng mẫu, xác nhận tạo theo digest, danh sách bản mất điều kiện bị chặn tải |
| Hồ sơ | Tách nơi lớn lên và vùng thường sử dụng; trường tự nguyện, không yêu cầu ngân hàng; giải thích vùng mẫu chọn riêng |
| Legacy | Giữ dữ liệu/route cũ, bỏ khỏi menu contributor/reviewer; route code được tải khi truy cập để giảm JavaScript ban đầu |
| CSS | Token semantic dialect, component styles có phạm vi, control border rõ, caption tối thiểu 12px trong CSS dialect, bố cục mobile và reduced motion |

## API hỗ trợ UI được thêm

Không thay schema bảng hiện tại; không sửa RAW để tạo cảm giác CURATED đã có.

- `GET /api/dialect/reviews`: thêm `region`, `source_rights`, `view=hold`.
- `GET /api/dialect/sources`: thêm tìm chứng cứ/lọc quyền và link contribution liên quan.
- `GET /api/dialect/participants`: thêm tìm tên/lọc role.
- `GET /api/dialect/releases/preview`: admin-only, phân trang danh sách và lý do loại, tổng eligible/excluded, digest tập đủ điều kiện.
- `POST /api/dialect/releases`: nhận preview_digest tùy chọn; UI gửi digest để từ chối khi tập đủ điều kiện thay đổi trước khi tạo. Đây chưa phải cơ chế khóa giao dịch chống mọi race đồng thời.
- `GET /api/dialect/releases`: thêm affected_count tính lại theo eligibility hiện tại; UI chặn tải các bản đang mất điều kiện. Đây không phải registry thu hồi release/model đầy đủ.

## Đối chiếu U01–U11

| Audit | Kết quả |
|---|---|
| U01/U02 | Đã sửa dashboard, role label, title và tên hồ sơ |
| U03 | Đã giải thích vùng mẫu khác vùng người góp; taxonomy lịch sử/confidence/snapshot hồ sơ còn là công việc dữ liệu/backend |
| U04 | Giữ form từ/câu thật đang có; chưa thêm unknown/no-term giả vì chưa có task engine/schema hỗ trợ |
| U05 | Đã thêm field errors, summary/focus và invalid state; chưa chứng nhận accessibility bằng kiểm thử trình duyệt |
| U06 | Đã lưu nháp phiếu và bảo vệ khi storage lỗi |
| U07 | Có filter vùng/quyền nguồn, HOLD và URL; chưa có chủ đề/SLA/phân công vì backend chưa có dữ liệu này |
| U08 | Có preview, lý do loại, xác nhận digest và tình trạng tải |
| U09 | Có filter nguồn/người, quan hệ nguồn–mẫu và xác nhận quyền; chưa có reviewer qualification registry |
| U10 | Danh sách giữ filter qua URL/back context; reviewer không bị dẫn về admin list |
| U11 | Wizard remount theo tài khoản/parent/kind; lượt mới reset parent/URL, giữ draft đúng phạm vi |

## Chức năng chưa được triển khai trong phạm vi sửa frontend

Guest submission, consent event/rút riêng mục đích, CURATED, quyền reviewer theo vùng/assignment, reviewer policy cấu hình, source license theo mục đích, migration/backup workflow, ảnh hưởng release/model có lịch sử và engine game chưa được hoàn thiện bởi lần sửa UI này. Đặc biệt:

- HOLD đã có danh sách để theo dõi và hướng bổ sung; chưa có reopen/vòng duyệt mới trên cùng RAW.
- Quy tắc child RAW loại parent và việc parent được tính lại khi child rút vẫn là policy hiện hành; preview giải thích trạng thái này, không sửa âm thầm policy.
- Ẩn menu legacy không chặn direct URL/API cũ; cần capability/feature flag backend ở bước tiếp theo.
- Chưa mở dictionary, thưởng, dịch AI hoặc dùng câu chưa duyệt làm gold.

## Kiểm tra

- `npm run build`: đạt TypeScript và Vite production build. Sau khi tách route legacy, JS entry khoảng 432 kB thay vì khoảng 772 kB của bản sửa trước khi tách; đây là kích thước build, không phải số đo tốc độ mạng hoặc thời gian render.
- ESLint cho toàn bộ `src/features/dialect`, `src/components/Layout.tsx` và `src/router.tsx`: đạt.
- Backend unittest: 5 test đạt, dùng SQLite in-memory; bao gồm quyền/idempotency/vòng đời/opt-out, preview cũ bị từ chối, affected release, filter và HOLD list.
- Canvas `artifact.mjs check`: 6 board, 0 problems. Không xác nhận layout hoặc script runtime bằng phép kiểm tra này.
- Chưa kiểm thử trực quan đầy đủ tất cả vai trò/viewport hoặc flow bằng trình duyệt. Không coi build/lint là chứng nhận không có lỗi UX.

Chi tiết kết quả tìm game ở [GAME_10_QUESTIONS_STATUS_2026-11-03.md](E:/blaze-voice-collection/docs/GAME_10_QUESTIONS_STATUS_2026-11-03.md).
