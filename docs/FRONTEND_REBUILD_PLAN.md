# Plan rebuild frontend — App từ ngữ địa phương

Ngày lập: 02/11/2026. Trạng thái: đề xuất triển khai, chưa rebuild mã ứng dụng.

## 1. Mục tiêu và căn cứ

Chuyển frontend Blaze Voice Collection thành nền tảng đóng góp và kiểm duyệt từ/câu phương ngữ Quảng Nam–Đà Nẵng. Ưu tiên text, dùng tốt trên điện thoại; audio mở rộng sau.

Căn cứ: mã nguồn frontend hiện tại và tài liệu `C:\Users\THONG\Documents\ChatGPT\appdichthuat\reports\FEATURE_AUDIT_APP_TU_NGU_DIA_PHUONG_2026-11-02.md` đã được đọc trong phiên làm việc. Audit cũ chưa biết source Blaze tồn tại; plan này sử dụng bản source local thực tế.

Đầu ra sản phẩm: người dùng góp từ/câu có nghĩa, vùng, ngữ cảnh và quyền sử dụng; reviewer độc lập xử lý; admin theo dõi và xuất dữ liệu đủ điều kiện. Màn dịch model, ví thưởng, rút tiền và Roleplay không thuộc luồng MVP mới.

Phạm vi công việc được yêu cầu hiện tại là lập plan. Các quyết định dưới đây là mặc định đề xuất để triển khai, chưa phải chính sách đã được người phụ trách sản phẩm phê duyệt.

## 2. Quyết định thiết kế

- Giữ React, TypeScript, Vite, React Router và Axios đang có. Không đổi framework trong lần rebuild này.
- Giữ React Bootstrap làm nền component; tạo design tokens và component dùng chung, thay giao diện và tổ chức màn hình theo nghiệp vụ mới.
- Giao diện tiếng Việt, nền trắng/xám nhạt, accent #2563EB và bộ token trong DESIGN.md; ưu tiên chữ dễ đọc và form rõ ràng. Màu trạng thái phải đi cùng chữ/icon.
- Người đóng góp dùng màn hình đơn giản, một tác vụ chính mỗi màn; reviewer/admin dùng workspace có bộ lọc và danh sách.
- Mặc định MVP dùng tài khoản để quản lý đóng góp và yêu cầu rút mẫu. Đóng góp ẩn danh là hạng mục riêng nếu được chọn: cần session phía server, mã khôi phục, chống spam và khả năng gắn vào tài khoản. Không dùng ID công khai làm bằng chứng sở hữu.
- Đề xuất hai reviewer độc lập; bất đồng chuyển điều phối. Quy tắc này phải được chốt ở giai đoạn 0; frontend chỉ hiển thị kết quả backend quyết định.
- Chưa bật gold/mini-game khi chưa có ngân hàng câu được xác minh.
- Giữ mã các module cũ trong quá trình chuyển đổi; chỉ gỡ sau khi đã kiểm tra phụ thuộc. Release mới bỏ route và navigation không thuộc phạm vi đã chọn.

## 3. Cấu trúc màn hình và route đề xuất

| Khu vực | Route | Nội dung chính | Mốc |
|---|---|---|---|
| Công khai | `/` | Mục đích, cách đóng góp, phạm vi dữ liệu, CTA góp từ/câu | MVP |
| Công khai | `/about-data` | Cách dùng dữ liệu, nguồn, quyền và quy trình rút mẫu | MVP |
| Tài khoản | `/login`, `/register` | Đăng nhập/đăng ký đã Việt hóa theo sản phẩm | MVP |
| Đóng góp | `/contribute` | Chọn góp từ/cụm từ hoặc câu hội thoại | MVP |
| Đóng góp | `/contribute/new` | Consent → vùng → nội dung → xem lại → gửi | MVP |
| Cá nhân | `/my/contributions` | Lịch sử, bộ lọc trạng thái, nháp | MVP |
| Cá nhân | `/my/contributions/:id` | Nội dung, phiên bản, phản hồi, yêu cầu rút mẫu | MVP |
| Cá nhân | `/settings` | Hồ sơ vùng/nơi lớn lên, tài khoản | MVP |
| Reviewer | `/review` | Hàng chờ được phép xem, lọc vùng/chủ đề | MVP |
| Reviewer | `/review/:id` | Đọc nội dung, điền phiếu độc lập, gửi đánh giá | MVP |
| Quản trị | `/admin` | Tổng lượt gửi, mẫu khác nhau, trạng thái QA, đủ quyền xuất | MVP |
| Quản trị | `/admin/contributions` | Tìm và quản lý mẫu, xem lịch sử xử lý | MVP |
| Quản trị | `/admin/disputes` | Xử lý bất đồng, quyết định có lý do | MVP |
| Quản trị | `/admin/sources` | Nguồn, bằng chứng, phạm vi dùng và rà soát quyền | MVP |
| Quản trị | `/admin/participants` | Cấp quyền reviewer, vùng chuyên môn, trạng thái tài khoản | MVP |
| Quản trị | `/admin/datasets` | Xem mẫu đủ điều kiện, yêu cầu export, lịch sử release | MVP |
| Quản trị | `/admin/imports` | Mapping CSV, xem lỗi, xác nhận import vào RAW | P1 |
| Tra cứu | `/dictionary`, `/dictionary/:id` | Từ/nghĩa/vùng/biến thể/ví dụ đã duyệt và được công khai | P1 |

Đăng nhập xong quay lại trang người dùng định mở. Route không tồn tại có trang 404; thiếu quyền có trang 403. URL cũ cần bảng redirect cụ thể; không tự chuyển ID annotation thành ID contribution.

## 4. Luồng và nội dung form

Luồng chính: giới thiệu → đăng nhập → chọn loại đóng góp → consent → vùng/ngữ cảnh → nhập nội dung → xem lại → gửi → nhận ID và trạng thái RAW → theo dõi kết quả.

Form từ/cụm từ: cách viết gốc, nghĩa người góp giải thích, cách nói phổ thông, vùng sử dụng, câu ví dụ, ngữ cảnh/nguồn nghe. Chủ đề, loại từ và biến thể có thể bổ sung; tránh biến form thành bảng dữ liệu quá dài.

Form câu: câu nguyên bản, bản phổ thông, tình huống giao tiếp, vùng sử dụng, từ phương ngữ nổi bật và nguồn/bối cảnh. Cho phép ghi rõ không chắc và đưa vào hàng chờ phù hợp; không suy ra VERIFIED từ việc điền đủ trường.

Consent tách phạm vi đóng góp, huấn luyện và công khai; nếu mở audio cần consent ghi âm riêng. Hiển thị phiên bản nội dung và cho người dùng xem lại lựa chọn. Backend kiểm tra consent hợp lệ trước khi chấp nhận mẫu.

Nháp: lưu cục bộ có schema version, nút xóa và thông báo khi đang dùng thiết bị chung. Không lưu token/mã khôi phục nhạy cảm trong dữ liệu nháp. Khi đổi tài khoản không hiển thị nháp của người trước. Không hứa lưu file audio nháp nếu chưa có cơ chế lưu hỗ trợ.

Gửi: một idempotency key ổn định cho một lần gửi, giữ key khi retry; đổi key khi bắt đầu đóng góp mới. Chỉ hiển thị thành công sau xác nhận server; lỗi mạng không được làm mất nội dung.

Trùng: hiển thị gợi ý theo từ/nghĩa/vùng, cho góp nghĩa hoặc biến thể khác kèm lý do. Không tự xóa mẫu hoặc gộp bằng chứng nguồn.

Reviewer: không tự duyệt; không thấy phiếu của người khác trước khi gửi phiếu độc lập; đánh giá nghĩa, vùng, tự nhiên, bản phổ thông và lý do. Che định danh người góp theo quyền.

## 5. Bảng chuyển đổi mã hiện có

Các đường dẫn dưới đây tính từ gốc repo; đã xác minh sự tồn tại khi lập plan. Tái sử dụng cần kiểm thử, không đồng nghĩa thành phần đã đạt yêu cầu mới.

| File/thư mục hiện có | Hướng xử lý |
|---|---|
| `frontend/src/router.tsx` | Rebuild route theo ba nhóm public/contributor/reviewer-admin; bỏ redirect mặc định về dashboard audio |
| `frontend/src/components/Layout.tsx` | Tách PublicLayout, ContributorLayout, WorkspaceLayout; thay thương hiệu Audio Annotator và navigation ví điểm |
| `frontend/src/features/auth/AuthContext.tsx` | Giữ cơ chế cookie; xử lý phiên hết hạn, kiểm tra `/me` trước khi xác nhận quyền; cache role không phải nguồn quyền |
| `frontend/src/components/ProtectedRoute.tsx`, `AdminRoute.tsx` | Mở rộng guard reviewer; guard chỉ phục vụ UX, backend vẫn kiểm quyền từng request |
| `frontend/src/api/client.ts`, `auth.ts` | Tận dụng HTTP client và auth; chuẩn hóa lỗi/network/401/403 |
| `frontend/src/features/projects/` | Tận dụng mẫu bảng/filter/member; chỉ giữ khái niệm chiến dịch khi cần, không ép từ/câu thành audio project |
| `frontend/src/features/annotate/AnnotatePage.tsx` | Thay luồng Playground bằng ContributionWizard và form từ/câu |
| `frontend/src/features/admin/ReviewQueuePage.tsx` | Tận dụng tương tác danh sách; thay contract thành phiếu reviewer độc lập và xử lý bất đồng |
| `frontend/src/pages/HistoryPage.tsx` | Thay bằng lịch sử đóng góp/phiên bản/trạng thái nghiệp vụ mới |
| `frontend/src/styles/theme.css` | Rà soát và chuyển dần sang tokens/component styles; tránh CSS cũ tác động workspace mới |
| `frontend/src/features/audios/` | Tái sử dụng ở P1 sau khi có liên kết contribution, transcript và quyền audio |
| `frontend/src/features/roleplay/`, `features/wallet/`, `features/rewards/` | Không đưa vào navigation MVP; giữ source cho tới khi kiểm tra phụ thuộc xong |

## 6. Tổ chức frontend đích

```text
src/
  app/                  # router, providers, cấu hình chế độ chạy
  layouts/              # public, contributor, workspace
  components/ui/        # field, button, status, dialog, empty/error state
  features/
    auth/
    contributions/      # wizard, nháp, lịch sử, chi tiết
    consent/
    regions/
    reviews/            # queue, phiếu, bất đồng
    sources/
    datasets/
    participants/
    dictionary/         # P1
  api/                  # client và adapters theo nghiệp vụ
  lib/                  # domain types, validation, formatters
  styles/               # tokens và global styles tối thiểu
  mocks/                # dữ liệu giả và adapter chỉ dành cho demo/dev
```

Component dùng chung: RegionPicker có “không chắc”, ConsentPanel, ContributionTypePicker, WordForm, SentenceForm, DraftIndicator, DuplicateSuggestions, StatusBadge, SourceEvidence, ReviewRubric, DecisionTimeline, FilterBar, PaginatedTable và ConfirmDialog.

Trạng thái cần thống nhất: loading/empty/error/forbidden; RAW/REVIEW/VERIFIED/HOLD/REJECT; trạng thái rút mẫu tách riêng; VERIFIED cũng chưa đồng nghĩa được công khai hay được xuất train.

## 7. Ranh giới API và phụ thuộc backend

Auth và một phần quản trị đã có. Không dùng annotation hiện tại làm nơi lưu giả dữ liệu từ/câu. Cần API/domain mới cho các nhóm sau:

| Contract cần có | Frontend phụ thuộc | Điều kiện server |
|---|---|---|
| Consent và danh mục vùng | Wizard | Lưu version, phạm vi, gắn người góp |
| Tạo/xem contribution và revision | Gửi, lịch sử, chi tiết | Ownership, RAW bất biến, idempotency, phân trang |
| Gợi ý trùng | Form | Chuẩn hóa nhưng giữ nguyên bản, xét nghĩa/vùng |
| Queue/vote/finalize | Reviewer/admin | Role reviewer mới, cấm tự duyệt, phiếu độc lập, kiểm soát concurrent review |
| Sources và rights | Form/admin | Bằng chứng, trạng thái rà soát và phạm vi dùng |
| Rút mẫu | Chi tiết cá nhân | Kiểm tra chủ sở hữu, lịch sử xử lý và loại khỏi export theo chính sách |
| Metrics/export/release | Dashboard/dataset | QA + quyền + trạng thái rút; manifest/checksum và phân quyền tải |

Contract phải chốt field, nullable, status enum, mã lỗi, pagination, conflict/version và response mẫu trước khi tích hợp. Xử lý 401/403/409/422/429 và mất kết nối. Backend chặn lộ toàn bộ task/nhãn vàng/annotator qua các endpoint cũ trước khi mở pilot.

Có thể dựng toàn bộ UX bằng mock adapter trước; màn demo phải ghi rõ dữ liệu mô phỏng, dùng định danh giả và tách khỏi production. Không mô phỏng thành công khi API thật lỗi. Tắt mock là điều kiện nghiệm thu pilot.

## 8. Kế hoạch theo giai đoạn

Ước lượng sơ bộ theo ngày công frontend, một developer tập trung; cần hiệu chỉnh sau giai đoạn 0. Chưa gồm thời gian phát triển backend và chờ quyết định sản phẩm.

| Giai đoạn | Công việc | Đầu ra và điều kiện hoàn tất | Ước lượng |
|---|---|---|---|
| 0. Chốt phạm vi | Xác nhận đăng nhập/ẩn danh, vùng, rule review, consent, tên sản phẩm; kiểm kê màn và contract | Decision log, route map, component map, API gap list | 1–2 ngày |
| 1. UX/UI | Wireframe mobile và desktop cho wizard, lịch sử, review, admin; tokens và component states | Luồng có đủ lỗi/empty/loading; xem được từ đầu tới cuối | 2–3 ngày |
| 2. Nền frontend | Layout, router, auth guards, UI kit, adapters, mock mode | Mỗi vai trò đi được đúng khu vực; shell responsive | 2–3 ngày |
| 3. Đóng góp | Hai form, consent, vùng, nháp, preview, retry, lịch sử và rút mẫu | Demo góp từ/câu hoàn chỉnh; tích hợp thật khi API nhóm này sẵn sàng | 3–5 ngày |
| 4. Reviewer/admin | Queue, rubric, bất đồng, nguồn, users/roles, metrics và export | Demo hai reviewer + điều phối; tích hợp thật khi có server invariants | 4–6 ngày |
| 5. Tích hợp và QA | Bỏ mock, kiểm tra quyền, trạng thái, mobile, lỗi mạng, regression; xử lý route cũ | Pilot từ đóng góp đến release chạy bằng dữ liệu thật | 3–5 ngày |
| 6. P1 | Import CSV, audio, từ điển và báo lỗi | Release tiếp theo, ước lượng riêng theo phạm vi chốt | Chưa tính |

Tổng MVP frontend dự kiến 15–24 ngày công. Không xem đây là cam kết ngày ra mắt; API thiếu hoặc thay rule nghiệp vụ có thể ảnh hưởng đường găng.

Thứ tự phụ thuộc: chốt domain/contract → UI foundation → contribution → review → export → QA thật. Backend nhóm contribution có thể làm song song sau giai đoạn 0; review/export cần hoàn tất trước giai đoạn 5.

## 9. Kiểm thử và nghiệm thu

- Build TypeScript/Vite và lint đạt; ghi baseline trước khi sửa, tách lỗi có sẵn khỏi regression.
- Test hành vi quan trọng: mất mạng khi gửi/retry không trùng; reload còn nháp; đổi tài khoản không lộ nháp; hết phiên đăng nhập giữ được nội dung đang nhập.
- E2E bằng dữ liệu thử: góp từ và góp câu → hai reviewer độc lập → bất đồng và điều phối nếu cần → VERIFIED → chỉ xuất khi đủ quyền.
- Kiểm thử quyền tại API: người góp không đọc mẫu riêng của người khác; không tự duyệt; contributor không gọi export/admin; reviewer không đọc phiếu của người khác trước lúc được phép.
- Mẫu HOLD/REJECT/chưa đủ phiếu/thiếu quyền/đã rút bị loại khỏi export; UI không giả định VERIFIED tự đủ điều kiện.
- Điều hướng bàn phím, label và thông báo lỗi cho form, focus khi đổi bước/dialog, trạng thái không chỉ phân biệt bằng màu.
- Kiểm tra viewport 360px, 768px và desktop; form không tràn ngang; bảng quản trị có cơ chế cuộn hợp lý.
- Không có số liệu mẫu hiển thị như dữ liệu thật, không có nút nghiệp vụ báo thành công khi chưa lưu server.
- Chạy dev cổng 7777 hoặc cổng trống khác ngoài 3000; giữ cấu hình API bằng biến môi trường.

## 10. Chuyển đổi và bàn giao

Triển khai trên nhánh `codex/frontend-dialect-rebuild`, commit theo giai đoạn. Giữ contract API cũ trong lúc phát triển các module mới; không đổi nghĩa dữ liệu annotation cũ. Chạy pilot trước khi chuyển navigation mặc định; chỉ gỡ module cũ khi đã xác nhận không còn phụ thuộc.

Bàn giao: frontend mới, design tokens, route/role matrix, API contract và gap list đã cập nhật, hướng dẫn chạy demo/thật, tài khoản test theo vai trò, kết quả QA và các hạn chế còn lại. Rollback dùng bản phát hành trước; thay đổi database đi qua migration có kế hoạch riêng.

Bước thực thi đầu tiên: chốt các quyết định ở giai đoạn 0 và dựng wireframe cho ba luồng: góp từ/câu, reviewer và quản trị dataset. Chưa cần bắt đầu bằng đổi thư viện UI hoặc xây màn dịch AI.
