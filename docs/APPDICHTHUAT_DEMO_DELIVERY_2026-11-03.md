# APPDICHTHUAT — bàn giao frontend P0–P1–P2

Cập nhật 03/11/2026. Đây là bản frontend DEMO theo kế hoạch đính kèm để trình quản lý. P0/P1/P2 đều có màn hình và thao tác; các dịch vụ chưa tích hợp được ghi rõ là mô phỏng. Không xem tài liệu này là xác nhận sẵn sàng thu dữ liệu thật.

## Mở và chạy

- Ứng dụng: http://localhost:7777/demo ; `/` chuyển vào bản demo.
- Game: http://localhost:7777/demo/play . Không cần tài khoản backend.
- Quản trị: chọn **Điều phối viên · admin** ở thanh DEMO rồi mở mục nội bộ.
- Canvas: chạy `node C:/Users/THONG/.codex/skills/claude-design/scripts/artifact.mjs open designs/blaze-collection` tại thư mục repo. Canvas hiện có 8 artboard, gồm game và quản trị game.

```powershell
cd E:\blaze-voice-collection\frontend
npm ci
npm run dev -- --host --port 7777 --strictPort
```

Frontend demo hoạt động độc lập. Backend/MinIO cần cho các route thật: `/login`, `/dashboard`, `/contribute/new`, `/review`, `/projects`, `/legacy`. Trang giới thiệu luồng thật vẫn ở `/collection`. Tài khoản demo không đăng nhập được backend và không liên quan ví/điểm thật.

## Phạm vi đã triển khai

| Pha | Nhóm | Màn hình / hành vi hiện có | Giới hạn khi chuyển sang production |
|---|---|---|---|
| P0 | Trang chủ | CTA chính Chơi game 10 câu, Góp từ, Góp câu, hướng dẫn và quyền dữ liệu | Nội dung dự án cần đơn vị chủ trì duyệt |
| P0 | Bắt đầu | Ẩn danh, consent riêng collect/train/public/audio, chọn đề/chiến dịch, mã phiên và mã khôi phục | Mã chỉ truy cập kho của trình duyệt hiện tại |
| P0 | Game 10 câu | Q01–03 GATE; Q04–05 LEXEME; Q06 GOLD; Q07 SENTENCE; Q08 GOLD; Q09 OPEN_WORD; Q10 OPEN_SENTENCE | Câu mẫu được ghi rõ DEMO, không phải gold xác minh |
| P0 | Chơi và lưu | Nhập/sửa, câu trước/tiếp theo, bỏ qua, tiến trình, tự lưu nháp IndexedDB, tải lại giữ dữ liệu | Lưu cục bộ, chưa đồng bộ thiết bị/server |
| P0 | Hiệu chỉnh | Biến thể hợp lệ, cấu hình strict 3/3 hoặc signal, giữ lần thử sai; sửa nháp làm mất hiệu lực điểm cũ cho đến khi xác nhận lại | Điểm là tín hiệu của bộ minh họa |
| P0 | Kết thúc | Nơi sống/lớn lên/dùng phương ngữ, Không chắc, xem lại, gửi idempotent, mã lượt | Chưa xác thực người chơi thật |
| P0 | RAW game | Snapshot đề, từng câu, đáp án/bỏ qua, lần thử, điểm, thời điểm; đáp án mở tạo ứng viên RAW | Không tự VERIFIED hoặc cấp thưởng |
| P0 | Quản trị game | Ngân hàng câu, đáp án/biến thể, duyệt demo, 10 vị trí đúng loại, clone/version, xem thử, phát hành/đóng; chi tiết từng lượt | Quyền là mô phỏng frontend. Phát hành thu thật bị chặn khi còn demo/thiếu gold/quyền nguồn |
| P0 | Góp từ/câu | Từ/cụm từ/câu, nghĩa, phổ thông, ngữ cảnh, từ loại, chủ đề, vùng, biến thể, từ khóa, nguồn, độ chắc chắn | Chưa gửi vào API thật |
| P0 | Quyền và rút mẫu | Consent riêng, lịch sử thay đổi, rút lượt/mẫu; cập nhật điều kiện công khai/export/credit | File đã tải về trước đó không thể thu hồi từ máy khác |
| P0 | Tiếp nhận | RAW giữ riêng, phiên bản bổ sung, nguồn, dò trùng, chống lặp ID thao tác/import | Chống spam/offline là kịch bản UI có nhãn, chưa có rate limit server |
| P0 | Review | Hàng chờ theo vùng; phiếu độc lập, ẩn phiếu khác; không tự duyệt; 4 tiêu chí, VERIFIED/HOLD/REJECT, điều phối bất đồng | Chưa có danh tính/quyền reviewer thực |
| P0 | Quản lý/vận hành | Vai trò, vùng/chủ đề/nguồn, audit; lỗi/retry, backup/restore kèm media, kiểm điều kiện xuất, responsive | Backup là file kho trình duyệt, không phải backup server |
| P1 | Tài khoản tùy chọn | Tạo bí danh demo với 0 credit, lịch sử lượt/mẫu/nháp, nhận lượt guest bằng mã khôi phục | Không có mật khẩu/email verification thật |
| P1 | Media | MediaRecorder, nghe lại, bỏ/thu lại, upload audio/ảnh/video, quyền media/audio, transcript, Blob trong IndexedDB | Cần quyền micro/secure context; chưa chống virus, upload server hoặc ASR |
| P1 | 9 nhiệm vụ | Liệt kê nhanh, kể quy trình, sửa câu gượng, ảnh gọi vật, video câm, chuỗi họ từ, nhật ký từ, nhắn tin, từ nghề nghiệp; có phản hồi không biết/không có từ riêng | Dùng chung form có ngữ cảnh; admin cấu hình ảnh/video làm đề, không tự suy nghĩa từ media |
| P1 | Chiến dịch | Nhiều đề, vùng/chủ đề, link/QR tạo thật, chọn đề chưa chơi ưu tiên, luân chuyển câu hiệu chỉnh, snapshot | Link localhost chỉ dùng trên máy này; chia sẻ cần máy chủ truy cập được |
| P1 | Ngân hàng/QA | Trạng thái duyệt, đáp án biến thể, khóa câu đã phát hành và clone sửa; audit lưu before/after; dashboard xem độ khó/tỷ lệ đạt | Duyệt DEMO không phải xác minh gold chuyên gia |
| P1 | Import | Parse CSV/TSV/JSONL, mapping, preview thiếu trường/trùng, dòng hợp lệ vào RAW, retry cùng batch không nhân đôi | Giới hạn 5 MB/1000 dòng; quyền nguồn cần rà riêng |
| P1 | Reviewer nâng cao | Yêu cầu bổ sung, đối chiếu RAW phiên bản, CURATED riêng, sense ID gộp/tách nghĩa, QA audio | Gộp/tách là chuẩn hóa sense ID, giữ bản gốc và phiếu |
| P1 | Dashboard | Bắt đầu/hoàn tất, vị trí dừng hiện tại, trả lời/bỏ qua theo câu, lần thử/đúng, hiệu quả đề/phương thức, trùng/VERIFIED, phủ vùng/chủ đề | Vị trí dừng không bị gắn nhãn bỏ cuộc chắc chắn; chỉ dùng dữ liệu trong kho demo |
| P1 | Dataset | Kiểm QA/consent/quyền nguồn/audio; CURATED; phiên bản, manifest, checksum SHA-256, data card, train/dev/test theo nhóm liên thông | 80/10/10 là tỷ lệ mục tiêu; nhóm lớn/lô nhỏ có thể có tập rỗng; DEMO_ONLY |
| P1 | Từ điển | Chỉ công khai mẫu đã duyệt/chuẩn hóa/đủ quyền; tìm không dấu/gần đúng, vùng/chủ đề, audio đủ quyền/QA, báo sai | Chưa là từ điển ngôn ngữ phát hành thật |
| P2 | Game nâng cao | Adaptive chọn câu cùng loại theo vùng/độ khó/lịch sử; chiến dịch theo chủ đề, khác vùng, cấu hình khác thế hệ | Khác thế hệ dùng đề/nhiệm vụ do admin soạn; chưa có mô hình ước lượng tuổi/IRT |
| P2 | Thành tích | Điểm tham gia, huy hiệu, streak, leaderboard tính từ lượt đã gửi | Không quy đổi tiền/token; thông số chỉ để duyệt UX |
| P2 | Hạn mức nội bộ | Tắt mặc định; admin bật chính sách, chỉ mẫu VERIFIED/CURATED đủ quyền, không trùng, tài khoản xác nhận không hold; giới hạn/ngày, hết hạn, thu hồi, lịch sử dùng, khiếu nại | Credit mô phỏng, không chuyển nhượng, không API key hoặc giao dịch thật |
| P2 | Chất lượng game | Hiệu quả từng đề/phương thức, nhiều lần thử/quá nhanh là tín hiệu, admin hold/clear, khiếu nại | Không kết luận gian lận tự động |
| P2 | Cộng đồng | So sánh cách gọi, sơ đồ vùng, nói lại câu, phiên chợ nghĩa, khác thế hệ, đề xuất và tạo nhiệm vụ theo khoảng trống | Sơ đồ vùng không phải bản đồ địa giới; các đóng góp vẫn qua RAW/review |
| P2 | AI dịch | Bộ quy tắc có version, gợi ý dịch, gửi lỗi/ứng viên, benchmark 4 tình huống có kết quả tính được, quản lý phiên bản | Không gọi LLM, không khẳng định năng lực dịch của model thật |
| P2 | AI hỗ trợ | Kịch bản sửa transcript từ văn bản nhập, chỉnh tay, dò trùng/gợi ý, gửi reviewer | Không nghe/nhận dạng giọng nói; ASR thật còn cần tích hợp |
| P2 | Khai thác | Sơ đồ biến thể/phát âm từ audio đủ quyền; job training/eval queued/running/completed/failed/cancel/retry và log; so sánh phiên bản rule | Job là trạng thái mô phỏng thủ công, không train model thật |

## Kịch bản trình quản lý

1. Vào `/demo`, chọn Khách ẩn danh, kịch bản Bình thường. Không cần đăng nhập.
2. Bấm **Chơi game 10 câu**, đọc mục đích, bật tiếp nhận. Các quyền training/công khai/audio là tùy chọn.
3. Q01–03 của lần đầu chấp nhận “cái gì”, “sao”, “đâu”. Q06/Q08 chấp nhận “bây giờ”/“kia”. Sau các lượt, vị trí GATE/GOLD có thể luân chuyển: đọc nội dung câu thay vì dùng máy móc đáp án theo vị trí.
4. Đi hết 10 câu. Q09/Q10 cần nghĩa, phổ thông, ngữ cảnh hoặc chọn bỏ qua. Chỉ nháp đã gõ chưa được tính là câu đã xác nhận.
5. Nhập vùng tự khai, xem lại, gửi. Nhận mã lượt và thấy bảng đủ 10 vị trí.
6. Chuyển Điều phối viên, bấm **Xem trong quản trị**. Đối chiếu từng đáp án, câu bỏ qua, lần thử, thời điểm và snapshot đề.
7. Xem ngân hàng câu/đề: clone trước khi sửa đề phát hành; thử strict 3/3, phát hành DEMO, đóng đề. Phiên đang làm giữ snapshot.
8. Với review: một persona góp; Reviewer A và B cùng vùng gửi phiếu độc lập; khi hai phiếu VERIFIED thì chuẩn hóa. Nếu bất đồng, Điều phối viên độc lập quyết định. Không tự duyệt.
9. Cấp quyền nguồn riêng, mở quyền training/công khai ở chủ mẫu khi được phép, xem điều kiện dataset/từ điển. Tạo bản xuất demo, sau đó rút mẫu để thấy bản xuất bị chặn.
10. Thử import, 9 nhiệm vụ, media, chiến dịch QR, dashboard, cộng đồng, thành tích, AI có nhãn mô phỏng. Chỉ bật chính sách hạn mức nếu muốn duyệt cơ chế đó.
11. Vận hành → tải backup để giữ buổi trình diễn. Restore thay thế kho DEMO. Nút Khôi phục mẫu xóa thay đổi trong kho này nên cần backup trước.

## Kiến trúc và ranh giới

- Module: `frontend/src/features/demo/`; giao diện riêng ở `frontend/src/styles/demo.css`.
- `types.ts` mô tả state/commands; `domain.ts` thực thi luật độc lập giao diện; `repository.ts` serialize read–modify–write bằng IndexedDB transaction; `DemoProvider.tsx` cung cấp state/error/retry.
- Kho: `appdichthuat-review-demo-v1`, store `state` và `blobs`. Không gọi API thật, không dùng cookie auth thật hoặc ví backend. Trang thật vẫn dùng AuthProvider trong nhánh route của chính nó.
- `routes.tsx` tách tải từng màn; root `/demo` tải riêng. Inter tự host 400/500/600/700 có tiếng Việt; Blaze bỏ Collection theo yêu cầu mới hơn.
- Backup JSON mang magic/version; kiểm tra cấu trúc, decode media trước khi mở transaction thay thế. Có migration cho hai collection được thêm vào schema v1 trong đợt phát triển.
- HMR giữ repository singleton; command trả về state được cập nhật trực tiếp để tránh màn hình cũ sau lưu. Đổi tuyến cuộn về đầu và chuyển focus vào nội dung.
- Dữ liệu cục bộ có thể bị người dùng sửa qua công cụ trình duyệt. Mô phỏng vai trò/điểm/QA không thay thế kiểm soát phía server. Không dùng dữ liệu thật trong bản trình diễn.

## Kiểm chứng và lỗi đã xử lý

- `npm test`: **24 kiểm thử đạt, 4 file**. Có luồng React+Router+IndexedDB từ trang chủ qua đủ 10 câu đến quản trị, phục hồi nháp, không gọi fetch; mở mọi màn chính; guard vai trò; strict/biến thể/lần thử/snapshot; phiếu độc lập/quyền/rút mẫu; credit; split nhóm; concurrent saves; migration; backup lỗi không làm mất kho; import 3 định dạng/retry; micro từ chối.
- `npx eslint src/features/demo tests vitest.config.ts`: **đạt, 0 lỗi/cảnh báo**.
- `npm run build`: đạt. Entry JS khoảng 437 kB, dưới ngưỡng cảnh báo 500 kB; các màn demo tải riêng.
- Backend hiện có: `.venv/Scripts/python.exe -m unittest discover -s tests -v` đạt **5/5** với SQLite trong bộ nhớ. Có cảnh báo deprecation của Starlette/httpx; chưa thay thư viện test backend trong đợt frontend này.
- `artifact.mjs check designs/blaze-collection`: **8 artboard, 0 lỗi định dạng**. Kiểm tra này không khẳng định tất cả tương tác artboard chạy như ứng dụng.
- Trình duyệt thực: hoàn tất lượt `0a22fa66-504e-4c1a-909f-4591754748f2`, gửi và thấy Q01–Q10 trong quản trị; có câu bỏ qua và lịch sử thử. Đây là dữ liệu kiểm thử tự soạn.
- Mobile CSS viewport 390×844: Inter đúng, không tràn ngang trang, menu thu gọn và CTA chính có vùng bấm rõ. Bảng dài cuộn trong vùng riêng.
- Ảnh nghiệm thu: `docs/screenshots/appdichthuat-desktop.png` và `docs/screenshots/appdichthuat-admin-session.png`; console trình duyệt kiểm tra cuối không ghi nhận warning/error.
- Lỗi đã sửa: server frontend chưa chạy; demo trước đây phụ thuộc bootstrap auth backend; stale UI sau HMR; thiếu hydrate fallback; giữ vị trí cuộn cũ khi đổi màn; draft nhiệm vụ tiếp tục sai ngữ cảnh; lỗi micro/đọc Blob/reset không hiển thị; restore chưa kiểm đủ bảng/media; draft bị tính là câu hoàn tất; điểm cổng cũ sau sửa nháp; cộng đồng chưa kiểm quyền collect; phát âm chưa kiểm QA.
- Đã cập nhật các dependency tương thích qua `npm audit fix` (không force). `npm audit --omit=dev` trả về **0 lỗ hổng**. Audit toàn bộ còn 12 mức moderate trong chuỗi công cụ ESLint/minimatch; chưa ép downgrade/breaking change.

## Các việc còn lại ngoài phạm vi demo

1. Toàn project `npm run lint` còn **50 lỗi + 5 cảnh báo có sẵn** ở module audio/roleplay/projects/rewards/auth/dashboard cũ (set-state-in-effect, render đọc ref, any, hook deps và export hỗn hợp). Build vẫn đạt; không ghi nhận lint toàn repo là sạch. Cần một đợt refactor và kiểm thử luồng API/thu âm/roleplay riêng để sửa an toàn.
2. Bản này chưa nghiệm thu đầy đủ zoom trình duyệt 200%, screen reader hoặc toàn bộ thiết bị/micro thật. Cần kiểm thêm trước phát hành.
3. Kết nối API/DB thật cho game, danh tính/SSO, quyền server, chiến dịch, audit, media/object storage, queue jobs, backup vận hành, rate limit và lịch rút dữ liệu.
4. Chuyên gia duyệt bộ đề/gold/biến thể, quyền nguồn, consent và chính sách thưởng. Chưa được mở thu thật chỉ vì frontend có thể chơi hết 10 câu.
5. Triển khai ASR/AI/training/benchmark và bản đồ địa lý thật, đánh giá model trên dữ liệu tách nhóm và được phép sử dụng. Các UI tương ứng đã có điểm tích hợp và nhãn trạng thái.

Tài liệu kiểm tra game được viết trước khi có implementation là ảnh chụp hiện trạng cũ; trạng thái mới lấy theo tài liệu bàn giao này.
