# Đánh giá frontend UI/UX — Blaze Collection

Ngày: 03/11/2026. Loại công việc: audit và đề xuất; chưa sửa mã frontend trong lượt đánh giá này.

## 1. Kết luận

Frontend đã có lớp thị giác mới theo DESIGN.md: logo gốc, font Be Vietnam Pro, accent xanh, surface trắng, sidebar và form gọn hơn. Tuy nhiên, lần rebuild vừa qua chủ yếu thay presentation; kiến trúc màn hình và nghiệp vụ vẫn là hệ thống gán nhãn audio có điểm thưởng.

Nếu mục tiêu là nền tảng góp từ/câu phương ngữ Quảng Nam–Đà Nẵng trong plan hiện có, khoảng trống quan trọng nhất là luồng đóng góp, consent, vùng, nguồn, review độc lập và dataset release. Chỉnh thêm màu hoặc logo sẽ không giải quyết những khoảng trống đó.

Đánh giá theo hai lớp: **hệ thống audio hiện đang chạy** và **sản phẩm phương ngữ đang hướng tới**. Các mục ví thưởng/Roleplay vẫn có chức năng trong hệ thống cũ; khuyến nghị ẩn khỏi MVP mới không đồng nghĩa xóa dữ liệu hay bỏ API ngay.

## 2. Phạm vi và độ chắc chắn

- Đã quan sát trực tiếp trang `/login`, đọc DOM/computed dimensions và đi tới `/register` rồi trở lại login. Không gửi form, tạo tài khoản hoặc thay đổi dữ liệu.
- Login desktop đo được viewport CSS 1122×1178, form rộng 440px, input cao 44px, có label gắn input, không tràn ngang trong viewport quan sát.
- Có thử override 390×844 nhưng môi trường trình duyệt trả viewport CSS thực 520×1125; ở kích thước thực này input 16px, nút submit 44px, không tràn ngang. **Không xem đây là xác minh ở 390px**.
- Đã đọc router, Layout, AuthContext, login/register, Playground, ReviewQueue, ProjectDetail, Settings, WalletButton, CSS hiện có, DESIGN.md và FRONTEND_REBUILD_PLAN.md.
- Chưa có phiên đăng nhập để kiểm thử trực tiếp dashboard, dự án, review, ví và bộ dữ liệu thật. Các lỗi ở màn này là phát hiện từ code; chưa mô phỏng lỗi mạng/race bằng runtime.
- Dùng tiêu chí của skill claude-design: bám nguồn, hierarchy, typography, spacing, vùng bấm, semantic controls, accessibility, responsive và nội dung thật. Không tạo thêm canvas vì yêu cầu hiện tại là đánh giá.
- Không chấm điểm số tổng hợp khi chưa có dữ liệu kiểm thử người dùng và runtime đủ các vai trò.

## 3. Phần nên giữ

| Thành phần | Đánh giá | Điều kiện tiếp tục |
|---|---|---|
| Be Vietnam Pro và accent #2563EB | Phù hợp sản phẩm tiếng Việt; font được đóng gói cùng app | Giữ token làm nguồn chung |
| Logo gốc Blaze | Đúng yêu cầu người dùng; không giả lập bằng chữ thường nữa | Giữ ảnh theo tỷ lệ, không recolor |
| Form login 440px | Gọn, có khoảng trắng và CTA rõ | Bổ sung thông tin mục đích ở landing thay vì nhồi vào form |
| Label email/mật khẩu và nút hiện/ẩn | Có tên truy cập, input cao 44px | Mở rộng pattern tới form cũ |
| Sidebar desktop 240/64px | Phù hợp workspace quản trị | Người đóng góp cần navigation đơn giản hơn |
| Menu mobile Offcanvas | Dùng component sẵn có thay vì drawer tự chế | Kiểm thử focus, Escape, zoom và bàn phím mềm thực tế |
| Project search/filter | Lọc trên API response thật, có loading/error/retry/empty | Giữ; xem lại phân trang khi số dự án tăng |
| Tách màu trạng thái và label chữ | Tốt hơn chỉ dùng màu | Không gọi approved là VERIFIED nếu chưa đủ QA/quyền |
| Reduced-motion rule | Đã có cơ chế giảm animation | Kiểm thử với mọi module, tránh flash/nhảy bố cục |

## 4. Lỗi UX cụ thể cần sửa

P0: chặn điều kiện sử dụng pilot của app phương ngữ. P1: sửa sớm vì sai phản hồi, mất công việc, khó phục hồi hoặc có nguy cơ thao tác nhầm. P2: cải thiện sự nhất quán và khả năng khám phá.

| ID | Mức | Phát hiện từ code / quan sát | Tác động | Cách sửa và nghiệm thu |
|---|---|---|---|---|
| UX-01 | P1 | `Playground.tsx:134` và `:223`: triggerScoreBurst gọi trước await submit/submitVoice | API lỗi nhưng vẫn có hiệu ứng/âm thanh nhận điểm | Chỉ báo gửi thành công sau response; phân biệt “đã gửi, chờ duyệt” và “đã được cộng điểm”; thử lỗi 500/mất mạng không được hiện thưởng |
| UX-02 | P1 | `SettingsPage.tsx:57`: return spinner khi profile null, trong khi error chỉ render ở dưới | Lỗi tải profile khiến người dùng không thấy lỗi hay nút thử lại | Tách loading/error/empty/success; failure có message/retry; spinner phải kết thúc |
| UX-03 | P1 | `WalletButton.tsx:18–19`: lỗi bị catch rỗng; null vẫn render spinner | Loading vô hạn và không biết số dư chưa tải được | Có error state, retry; không hiển thị 0 như số dư thật; nếu ẩn ví khỏi MVP vẫn sửa trước khi tái bật |
| UX-04 | P1 | `Playground.tsx:34`: câu trả lời nằm trong state; phạm vi component chưa có nháp/route blocker | Rời trang/reload có thể mất nội dung đang nhập | Giữ nháp theo user + task + version, báo chưa gửi; không phục hồi nhầm assignment đã hết hạn; có discard/restore rõ ràng |
| UX-05 | P1 | `AuthContext.tsx:48`: mọi lỗi `/me` đều xóa user | Lỗi mạng/5xx bị diễn giải thành hết đăng nhập | Phân biệt 401 với network/5xx; trạng thái xác minh phiên + retry; không dùng role trong cache làm nguồn quyền |
| UX-06 | P1 | `ReviewQueuePage.tsx:318`: response detail được set trực tiếp, chưa có cancellation/identity check trong effect | Khi đổi mẫu nhanh, response chậm có thể ghi đè detail của mẫu mới | Abort hoặc ignore response cũ; identity hiển thị và payload thao tác phải cùng mẫu; test A→B với response A về sau |
| UX-07 | P2 | `router.tsx:60`: mọi URL sai chuyển về `/` | Người dùng không biết link sai, khó phục hồi | Trang 404 có quay lại/dự án; 403 có giải thích; không giả đăng xuất khi thiếu quyền |
| UX-08 | P2 | `LoginPage.tsx:12`: chỉ giữ pathname từ route ban đầu | Mất query mode/filter sau đăng nhập | Khôi phục pathname+search+hash trong cùng origin; không nhận redirect ngoài site |
| UX-09 | P2 | `LoginPage.tsx:69`: divider “hoặc” đứng trước đăng ký, không có phương thức đăng nhập thay thế | Nội dung tạo kỳ vọng sai về lựa chọn đăng nhập | Bỏ divider; giữ câu “Chưa có tài khoản?” và link đăng ký |
| UX-10 | P2 | `ReviewQueuePage.tsx`: trộn Approve/Reject/Pending/Data/Q&A với tiếng Việt | Người dùng cộng đồng khó hiểu và thiếu nhất quán | Dùng Duyệt/Từ chối/Chờ duyệt/Dữ liệu; giải thích thuật ngữ nội bộ trong admin |
| UX-11 | P2 | `collection.css:112,140`: caption/role 10px; có metadata 11px | Khó đọc, nhất là người lớn tuổi; chưa có bằng chứng vi phạm contrast | Caption quan trọng 12–13px; body nhập/đọc dài 16px; kiểm thử zoom thay vì chỉ tăng size toàn app |
| UX-12 | P2 | `ProjectDetailPage.tsx`: các tab quản trị được mở qua menu bánh răng | Các việc thường xuyên như dữ liệu/thành viên/báo cáo khó khám phá | Tab hoặc section nav nhìn thấy; gear chỉ cho cấu hình ít dùng; đánh giá sau khi có phiên thật |
| UX-13 | P2 | `DataRow` dùng div role=button + tabIndex + Enter/Space | Đã có hỗ trợ bàn phím nhưng phải duy trì bằng tay | Dùng native button/link phù hợp cấu trúc; không gọi đây là control hoàn toàn không dùng keyboard được |

UX-04 và UX-06 là nguy cơ xác định từ cấu trúc code, cần tái hiện có kiểm soát trước khi coi là lỗi runtime đã được chứng minh. Các số dòng là snapshot hiện tại, có thể thay đổi sau sửa.

## 5. Phần phải thay đổi để đúng sản phẩm phương ngữ

### 5.1. Màn bắt đầu và thông điệp

Hiện `/` chuyển tới dashboard rồi yêu cầu tài khoản. Người mới chưa thấy dự án thu thập gì, góp một mẫu mất những bước nào, dữ liệu được dùng ra sao.

**Thêm P0:** landing công khai ngắn: mục đích thu thập từ/câu Quảng Nam–Đà Nẵng, ví dụ được gắn nhãn là minh họa, CTA “Góp từ/cụm từ”, “Góp câu hội thoại”, đường dẫn giải thích dữ liệu/quyền. Có thể dùng tài khoản ở bước gửi theo quyết định MVP hiện tại; không cần buộc đọc một form dài trước khi hiểu mục đích.

Tên “Blaze Collection” giữ được làm thương hiệu nền; bổ sung mô tả “Góp từ ngữ địa phương” trong heading/landing để người dân hiểu sản phẩm. Không cần đổi logo tiếp.

### 5.2. Navigation theo vai trò

| Vai trò | Navigation nên có | Mục giảm ưu tiên/ẩn khỏi MVP |
|---|---|---|
| Người đóng góp | Góp từ/câu; Đóng góp của tôi; Hướng dẫn; Hồ sơ vùng | Ba mode audio, ví, rút tiền, Roleplay, thông số golden/redundancy |
| Reviewer | Hàng chờ; Đã đánh giá; Cần bổ sung; Hướng dẫn duyệt | Quản lý tài chính hoặc toàn bộ cấu hình dự án |
| Admin/điều phối | Tổng quan; Mẫu đóng góp; Bất đồng; Nguồn; Reviewer; Dataset release | Mini-game, leaderboard, model dịch và cấu hình voice bot khi chưa dùng |

Đây là đề xuất chuyển đổi; router hiện chưa có khu reviewer độc lập, review hiện nằm dưới AdminRoute. Backend phải hỗ trợ quyền/assignment mới, không chỉ đổi nhãn menu.

### 5.3. Form đóng góp là trung tâm P0

Luồng đề xuất: chọn từ/cụm từ hoặc câu → phạm vi sử dụng dữ liệu → vùng/nơi nghe → nội dung và nghĩa → xem lại → gửi → mã đóng góp và trạng thái chờ duyệt.

Trường tối thiểu: nội dung gốc; nghĩa người góp giải thích; cách nói phổ thông; vùng sử dụng; ví dụ/ngữ cảnh; nguồn hoặc bối cảnh đã nghe. Có lựa chọn “không chắc” để không buộc đoán. Chủ đề, loại từ và biến thể là phần mở rộng, tránh yêu cầu quá nhiều ngay lần đầu.

Cần lưu nháp, retry không tạo mẫu kép, gợi ý trùng có xét nghĩa/vùng, phản hồi lỗi theo trường và quyền yêu cầu rút mẫu. Audio tùy chọn ở giai đoạn sau, không bắt buộc cho một mục từ text.

**Phụ thuộc backend:** contribution/revision, region, consent version, source registry, idempotency và ownership. Không nhét các trường này vào annotation JSON rồi coi là domain hoàn chỉnh.

### 5.4. Review và giải thích trạng thái P0

Hiện UI review tổ chức theo audio, task, đáp án và nút duyệt/từ chối. Với phương ngữ, cần hiển thị nguyên bản + nghĩa + bản phổ thông + vùng + ví dụ + bằng chứng, sau đó phiếu đánh giá từng tiêu chí.

Không tự duyệt mẫu mình góp. Đề xuất hai reviewer độc lập, bất đồng chuyển điều phối; rule cần được chốt và thực thi ở backend. Không lộ phiếu reviewer khác trước khi gửi phiếu độc lập.

Người đóng góp cần đọc được “Đang chờ đánh giá”, “Cần thêm ngữ cảnh”, “Đã xác minh”, “Chưa được chấp nhận” cùng lý do/hướng xử lý. VERIFIED không tự động đồng nghĩa được công khai hoặc xuất train: QA, quyền sử dụng và tình trạng rút mẫu là các chiều riêng.

### 5.5. Hồ sơ, dashboard và dataset

- **Sửa P0:** hồ sơ tập trung vùng lớn lên, vùng thường sử dụng và tùy chọn không chắc; tách khỏi tài khoản ngân hàng. Settings hiện tập trung phone/address/dob/bank, chưa phục vụ năng lực vùng của người góp/reviewer.
- **Thêm P0:** trạng thái consent, nguồn, yêu cầu rút và lịch sử phiên bản. Quyết định không được chỉ nằm trong toast rồi biến mất.
- **Sửa P1:** dashboard phân biệt lượt gửi, mẫu khác nhau, mẫu đã xác minh và mẫu đủ điều kiện xuất; không lấy điểm thưởng làm chỉ số chất lượng dataset.
- **Thêm P0 cho pilot có xuất dữ liệu:** màn dataset release xem trước điều kiện/loại trừ, version, số lượng và tải manifest; backend tính điều kiện đủ, frontend không tự lọc để thay quyền.
- **Hoãn P1/P2:** từ điển công khai, thu âm mở rộng, mini-game và model dịch. Chỉ công khai mẫu đủ điều kiện.

## 6. Bảng GIỮ / SỬA / ẨN / XÓA / THÊM

| Hành động | Phần áp dụng | Lý do |
|---|---|---|
| GIỮ | Logo; Be Vietnam Pro; accent; radius/card; nền workspace; components Bootstrap hữu ích | Nền thị giác hiện đã phù hợp |
| GIỮ | Search/filter/error-retry của ProjectsListPage | Pattern có thể dùng cho danh sách mẫu |
| SỬA | Sidebar, dashboard, lịch sử, hồ sơ, review và từ ngữ giao diện | Chuyển từ audio-task sang contribution-text |
| SỬA | Loading/error/session/retry/draft/success feedback | Tránh mất nội dung và phản hồi sai |
| ẨN/HOÃN | Ví/rút tiền/ngân hàng, leaderboard, Roleplay, gold chưa được kiểm chứng | Không thuộc MVP phương ngữ theo plan; không xóa dữ liệu tài chính |
| XÓA | Divider “hoặc” gây hiểu nhầm; sau đó CSS/component chết đã kiểm kê | Giảm nhiễu; chỉ xóa mã sau khi tìm đủ phụ thuộc |
| THÊM | Landing, form từ/câu, consent, vùng, provenance, review độc lập, rút mẫu, release | Những capability bắt buộc cho dataset theo mục tiêu |
| HOÃN | AI dịch, ASR coi như nhãn chuẩn, gamification | Phụ thuộc chất lượng dữ liệu và nghiệp vụ chưa chốt |

Nếu tiếp tục giữ sản phẩm gán nhãn audio song song, các module audio/tài chính cần khu vực riêng hoặc feature flag theo project. Không gỡ khả năng đang được dùng chỉ vì đổi UI.

## 7. Nợ thiết kế/kỹ thuật ảnh hưởng UX

- `theme.css` hiện chứa hơn 5.500 dòng không rỗng theo Measure-Object, rồi `collection.css` ghi đè phía sau. Đây là chuyển tiếp, chưa phải UI system đã được làm sạch. Một thay đổi specificity có thể làm style cũ xuất hiện lại.
- Selector `.project-description` trong collection.css ảnh hưởng cả card và chi tiết dự án; nên tách scope để không vô tình áp min-height/margin của card vào trang khác.
- Màu, radius và kích thước nên gom theo semantic token; hạn chế rải mã hex mới trên từng feature. Không xóa toàn bộ CSS cũ khi chưa kiểm kê module sử dụng.
- `FRONTEND_REBUILD_PLAN.md` vẫn có đề xuất nền ngà/màu đất từ trước; DESIGN.md và UI hiện đã theo Blaze. Cần cập nhật plan cho nhất quán và ghi trạng thái phần nào đã làm/phần nào mới dự kiến.
- Canvas hiện có desktop empty-state và mobile login; chưa mô tả toàn luồng từ/câu/reviewer/admin. Không dùng 0 lỗi schema canvas để suy ra UX đã hoàn thiện.
- Cần phân trang/filter phía API khi dữ liệu tăng. Hiện search danh sách dự án chỉ lọc tập API đã trả; không gọi đó là lỗi mất kết quả nếu API vẫn trả toàn bộ.

## 8. Backlog triển khai theo thứ tự

| Đợt | Công việc | Định nghĩa hoàn tất |
|---|---|---|
| A — sửa độ tin cậy | UX-01..06; 404; giữ query khi login; Việt hóa; bỏ divider | Lỗi mạng có message/retry; không thưởng trước response; giữ nháp đúng mẫu; review không bị response cũ ghi đè |
| B — đúng luồng sản phẩm | Landing + navigation theo vai trò + wizard góp từ/câu + lịch sử | Người mới hiểu mục đích; tạo mẫu RAW có vùng/nghĩa/context/consent/source và theo dõi được |
| C — dữ liệu đủ dùng | Reviewer độc lập + bất đồng + nguồn/quyền/rút mẫu + export release | Chưa đủ QA/quyền không xuất; mọi quyết định có lịch sử; mẫu rút bị loại theo chính sách |
| D — hoàn thiện hệ thống UI | Tokens/components, bỏ CSS chết, accessibility/mobile, từ điển P1 | Kiểm tra bằng dữ liệu thật, keyboard, zoom, viewport thực 360/390/768/desktop và reduced motion |

Đợt B/C cần backend contract, schema/migration và phân quyền tương ứng. Không nghiệm thu demo mock thành một pilot dữ liệu thật. Nếu chưa làm API, màn demo phải ghi rõ mô phỏng và không báo đã lưu thật.

## 9. Nghiệm thu nên yêu cầu

1. Login/register có label, focus, validation và lỗi server; deep link khôi phục đủ route/query.
2. Người góp tạo từ/câu, lưu nháp, retry không trùng, xem được status/lý do, yêu cầu rút mẫu.
3. Reviewer không tự duyệt, không thấy phiếu độc lập trước lúc được phép; đổi mẫu nhanh không nhầm dữ liệu.
4. Lỗi tải không tạo spinner vô hạn; API submit lỗi không có thành công/điểm thưởng giả.
5. RAW/HOLD/REJECT/thiếu quyền/đã rút không đi vào export; backend quyết định eligibility.
6. Màn mobile thật không tràn, logo không bị cắt, keyboard không che CTA; target tối thiểu 44px cho các thao tác chính.
7. Build/lint trong phạm vi sửa đạt; test hành vi quan trọng và kết quả kiểm tra trực quan được ghi lại. Không dùng build pass thay cho test UX.

## 10. Các file làm căn cứ

`DESIGN.md`; `docs/FRONTEND_REBUILD_PLAN.md`; `frontend/src/router.tsx`; `frontend/src/components/Layout.tsx`; `frontend/src/components/Brand.tsx`; `frontend/src/components/WalletButton.tsx`; `frontend/src/components/AdminRoute.tsx`; `frontend/src/features/auth/{AuthContext,AuthShell,LoginPage,RegisterPage}.tsx`; `frontend/src/features/annotate/Playground.tsx`; `frontend/src/features/admin/ReviewQueuePage.tsx`; `frontend/src/features/projects/{ProjectsListPage,ProjectDetailPage}.tsx`; `frontend/src/pages/SettingsPage.tsx`; `frontend/src/styles/{theme,collection}.css`.

Hướng tiếp theo: giữ nền thị giác hiện có, sửa phản hồi/lưu nháp/lỗi tải trước, sau đó chuyển navigation và domain màn hình sang đóng góp từ/câu. Đánh giá này không xác nhận mọi màn sau đăng nhập đã vận hành đúng và không tự thực hiện các thay đổi được đề xuất.
