# Bàn giao Blaze Voice Collection cho Claude

**Snapshot local: 09/11/2026 · Repo `Actable-AI/blaze-voice-collection` · Nhánh `main`, HEAD `a1b6880`.**

Đây là bản tóm tắt có thể đọc độc lập. Nếu có repo, bắt đầu với `CLAUDE.md` rồi đối chiếu mã nguồn và test của luồng cần sửa. Tài liệu có ngày cũ mô tả trạng thái tại lúc viết. Khi có mâu thuẫn, dùng mã nguồn hiện tại và kết quả chạy lại để xác định hành vi. Có nhiều file đã sửa và chưa được Git theo dõi; clone từ GitHub ở HEAD trên không có đầy đủ game, API phương ngữ, giao diện và test bên dưới. Dùng workspace hiện tại hoặc snapshot source do người quản lý repo cung cấp.

## 1. Sản phẩm và phạm vi

**Blaze Voice Collection** ban đầu là nền tảng gán nhãn audio và thu thập hội thoại với điểm thưởng. **Blaze** là thương hiệu UI; **APPDICHTHUAT** là tên dự án thử nghiệm thu dữ liệu phương ngữ Quảng Nam–Đà Nẵng; backend gốc dùng tên **Audio Annotator**. Hướng sản phẩm phương ngữ hiện tại là thu cách nói thật và ngữ cảnh qua game/góp trực tiếp, giữ bản gốc, kiểm duyệt độc lập, xác minh quyền và chuẩn bị dữ liệu ứng viên huấn luyện. Các màn dịch, ASR và training/eval của APPDICHTHUAT là mô phỏng. Tài liệu tháng 10 về công cụ dịch và tiếp nhận phản ánh là đề xuất; repo không chứng minh đã vận hành các dịch vụ đó.

### Ba luồng cùng tồn tại

| Luồng | Điểm vào | Dữ liệu và quyền |
| --- | --- | --- |
| APPDICHTHUAT, game và quản trị | `/` → `/demo`; `/play` → `/demo/play`. Chơi ở `/demo/game/:id`, lịch sử ở `/demo/history`, kiểm duyệt ở `/demo/admin/review`. | Phiên đăng nhập thật. Game, đề/câu hỏi, lượt chơi, chiến dịch, nhiệm vụ và media ở IndexedDB. Mẫu, phiếu, nguồn của mẫu, người tham gia, release, hạn mức và phản hồi dùng API phương ngữ khi bật đồng bộ. |
| Góp từ/câu trực tiếp | `/collection`, `/about-data` công khai. Sau đăng nhập: `/dashboard`, `/contribute/new`, `/my/contributions`, `/my/contributions/:id`, `/settings`; `/review` cho reviewer/admin. Quản trị tại `/admin/{contributions,disputes,sources,datasets,participants}`. | Form gửi thẳng tới `/api/dialect`; nháp wizard lưu localStorage theo tài khoản. Cùng kho phương ngữ trên server với mẫu đồng bộ từ game. |
| Audio, role-play, ví legacy | `/legacy`, `/legacy/audio`, `/legacy/settings`, `/projects`, `/projects/:id/annotate`, `/roleplay`, `/rewards`, `/history`, `/withdrawals`; kiểm duyệt audio tại `/admin/review`. | FastAPI, SQLite và MinIO. Điểm và rút tiền thuộc ví legacy. Hạn mức AI của `/demo/rewards` là cơ chế riêng, không quy đổi tiền. |

Phân biệt ba màn duyệt `/demo/admin/review`, `/review` và `/admin/review`. Hai màn đầu có thể dùng cùng mẫu phương ngữ trên server nhưng giao diện và endpoint đọc khác nhau. `/demo/history` đọc lượt chơi local và bảng “Đóng góp của tôi” (`features/demo/MyContributions.tsx`, lấy mẫu từ snapshot server khi đồng bộ), `/my/contributions` đọc mẫu phương ngữ trên server, `/history` đọc hoạt động audio legacy.

## 2. Kiến trúc và các điểm vào trong mã

- **Frontend:** React 19, TypeScript, Vite 8, React Router 7, Bootstrap/react-bootstrap, Axios, wavesurfer.js, `idb`. `frontend/src/main.tsx` nạp CSS và router. `frontend/src/router.tsx` đăng ký các nhóm route, `features/demo/routes.tsx` đăng ký các màn APPDICHTHUAT. Từ đây, các đường dẫn bắt đầu bằng `features/`, `api/` hoặc `styles/` nằm dưới `frontend/src/`.
- **Backend:** FastAPI, SQLAlchemy 2, Pydantic 2, SQLite, MinIO/S3. `backend/app/main.py` gắn các router dưới `/api`. `core/config.py`, `core/database.py`, `core/security.py`, `core/storage.py` quản lý cấu hình, DB, auth và object storage. Chưa có Alembic; `Base.metadata.create_all` tạo bảng thiếu, không sửa schema bảng đã tồn tại.
- **Auth dùng chung:** `/api/auth/{register,login,logout,me}`, cộng `PATCH /api/auth/me` (đổi tên hiển thị) và `POST /api/auth/password` (đổi mật khẩu; sai mật khẩu hiện tại trả 400, không phải 401). Trang `/demo/account` (`features/demo/AccountDemo.tsx`) cho mọi vai trò đã đăng nhập: tên, vùng (`/api/dialect/profile`), mật khẩu, đăng xuất. JWT trong cookie HttpOnly, phiên mặc định 60 phút và được gia hạn khi request có xác thực qua nửa thời hạn. `api/client.ts` bật `withCredentials`, mặc định base `/api`; 401 xử lý hết phiên. `AuthContext.tsx` kiểm tra `/auth/me`; `auth.user` trong localStorage chỉ là cache. Guard UI không thay quyền trên server. Login/register giữ đích nội bộ, mặc định `/demo/play`.
- **Vai trò:** đăng ký tạo `annotator`, ánh xạ thành `contributor` trong demo. `reviewer` và `admin` giữ nguyên. `/demo` và `/demo/rights` công khai; các màn demo khác cần đăng nhập. Contributor chơi và xem lượt của mình; reviewer tập trung hàng chờ và tab đã xử lý; admin quản lý đề/câu, chiến dịch, lượt, dữ liệu và cài đặt. `features/demo/navigation.ts` là bảng quyền truy cập UI. `/demo/internal` chỉ cho admin thật; đổi vai trò mô phỏng chỉ có khi `VITE_DEMO_SERVER=off`. Quyền admin cấp ở server, không cấp qua màn đổi vai người tham gia.
- **UI:** Tiếng Việt, logo và wordmark Blaze ở `frontend/src/components/Brand.tsx` và `frontend/public/brand/`. Inter tự host 400/500/600/700 gồm subset Việt. Thứ tự CSS của app là `theme.css` → `collection.css` → `dialect.css` → `demo.css` → `blaze-workspace.css`. Màu workspace hiện hành có vàng `#E7A103`, nâu `#A15C00`, nền ấm `#F9F8F5`. Dùng `DESIGN.md` để hiểu quy ước và CSS thực tế để xác nhận; giữ khả năng dùng bàn phím, focus, các trạng thái tải/lỗi/trống và bố cục mobile.

## 3. Game 10 câu và đồng bộ dữ liệu

**Luật game:** `features/demo/GamePages.tsx` dựng UI, `domain.ts` xử lý lệnh, `types.ts` định nghĩa state/command, `repository.ts` đọc–sửa–ghi trong transaction IndexedDB. DB `appdichthuat-review-demo-v1` có store `state` và `blobs`. Dữ liệu chia sẻ trong cùng origin và browser profile. Các lệnh ghi ràng buộc với actor `account:<user.id>`; bắt đầu và gửi bài xác minh lại phiên. Lượt guest cũ không tự chuyển sang tài khoản mới.

- **Đề:** `datasetQuestions.ts` có ba bộ từ Dataset1, mỗi bộ 10 câu: **Cách nói hằng ngày**, **Trong bếp, ngoài chợ**, **Hiểu đúng theo ngữ cảnh**. Q01/Q06 trắc nghiệm, Q02 trả lời ngắn, Q03/Q08 điền từ, Q04/Q05 giải thích, Q07 viết lại, Q09 góp từ, Q10 góp câu. Q06/Q08 là tín hiệu chất lượng trong bộ đề `signal`; ở chế độ `strict`, phải đúng cả ba câu đầu trước khi đi tiếp. Có provenance theo dòng nguồn; chưa coi là gold đã được chuyên gia duyệt.
- **Kho Dataset1 (gói `dataset1-bank-v1`, 10/11/2026):** `datasetBank.ts` nạp `dataset1Bank.ts` (sinh bằng `frontend/scripts/build-dataset1-bank.py` từ file .xlsx của Dataset1) thành 47 đề `dataset1-bank-NN` với `layout: "sourced2"`. Q1 (trắc nghiệm) và Q2 (điền từ) là GATE lấy từ 338 mục **đã đối chiếu nguồn** (luận án, bài nghiên cứu, tư liệu văn hóa, báo; không trùng, không có ghi chú chất lượng), mỗi lượt rút câu người chơi chưa gặp. Q3–Q10 là câu mở lấy từ 333 mục **chưa kiểm chứng** (kho trực tuyến, câu theo khuôn, tab 05) và tạo mẫu RAW có mã dòng nguồn trong `evidence`. Gói này đóng ba đề Dataset1 cũ (nếu còn v1 và đang mở); lượt cũ giữ snapshot. Tab 06 ngữ âm chưa đưa vào vì cần audio.
- **Phân đề:** `autoStart` tiếp tục lượt dở phù hợp bằng snapshot ngay cả khi đề gốc đã đóng. Lượt mới lọc đề active hợp lệ và đúng chiến dịch; chiến dịch không tồn tại/đã tắt bị chặn. Ưu tiên đề chưa hoàn tất, cân bằng theo lượt chưa rút trong kho, hòa thì sắp theo ID; có `repeat` khi chơi lại. Lượt gửi rồi rút vẫn tính là đã hoàn thành đề; fixture `exam-demo` được bỏ qua trong pool thường khi có đề hợp lệ khác. Các lượt QA đã đánh dấu không tính vào phân đề hoặc thống kê lượt tham gia.
- **Phân đề trên server (10/11/2026):** khi đồng bộ bật và đã đăng nhập, `DemoProvider.run` gửi `POST /api/dialect/allocation` với các đề trình duyệt chạy được (`exam_ids`) và đề đã làm trên máy (`played`). Server ghi bảng `dialect_game_allocations` (mỗi `session_ref` một dòng), chọn đề có ít lượt nhất trên mọi tài khoản, bỏ đề tài khoản đã gửi ở bất kỳ thiết bị nào, hòa thì chọn ngẫu nhiên; rút lượt sẽ trả chỗ. Lệnh `autoStart` nhận `examId` đó nếu đề còn trong pool local; lỗi mạng, chế độ offline hoặc `VITE_DEMO_SERVER=off` dùng cách cân bằng local như trước.
- **Trả lời và gửi:** snapshot chứa phiên bản câu/đề và thứ tự phương án đã trộn. Trắc nghiệm lưu `selectedOptionId`; đáp án ngắn/điền từ chuẩn hóa NFC, chữ thường, khoảng trắng và dấu câu cuối, vẫn phân biệt dấu tiếng Việt. Câu mở cần review. Có nháp, bỏ qua, xem lại, mã lượt và gửi idempotent. Với bộ Dataset1, câu mở Q04, Q05, Q07, Q09, Q10 không bỏ qua tạo mẫu; không gửi cả 10 câu hay toàn bộ lượt lên server.
- **Vùng:** `regions.ts` có 7 đơn vị Đà Nẵng, 18 đơn vị Quảng Nam theo tên trước 2025, và lựa chọn **Không chắc**. Màn gửi hiện yêu cầu **nơi đang sống** và **nơi lớn lên**. `usage` còn trong mô hình lượt nhưng không phải trường bắt buộc ở màn hiện tại. Gói `districts-v2` cập nhật danh mục mà giữ metadata/snapshot lịch sử; gói `dataset1-three-exams-v1` thêm đề vào kho sẵn có.
- **Quản lý game:** `GameAdmin.tsx` quản lý câu hỏi, bản đề, preview, chi tiết lượt/lần thử. Đề phát hành giữ phiên bản; sửa tạo bản mới. Có kiểm tra cấu hình trước khi mở đề và chặn dùng fixture/câu chưa xác minh ở chế độ thu thật. Chiến dịch/QR, từ điển, nhiệm vụ, media, backup và AI job vẫn dựa vào kho local; vài màn có route nhưng contributor không được vào.

**Đồng bộ:** mặc định bật, chỉ chạy khi có tài khoản; `VITE_DEMO_SERVER=off` tắt đồng bộ nghiệp vụ, vẫn dùng auth thật ở các màn bảo vệ. `DemoProvider.tsx` nối auth, reducer và API; `server.ts` chuyển đổi kiểu dữ liệu, điều phối lệnh server và hàng đợi gửi (outbox). Khi mở trang, sau thao tác server hoặc lệnh local liên quan, provider lấy snapshot `GET /api/dialect/workspace`. Góp mẫu/gửi game lưu local trước, gửi mỗi mẫu với idempotency key từ ID local và gắn `session_ref` nếu có. Dữ liệu pending chỉ bị gỡ khỏi outbox khi snapshot xác nhận bằng `client_ref` hoặc khi có lỗi 4xx cố định; trường hợp sau ghi sự kiện `SYNC_REJECTED`. Lỗi mạng, 401, 429 giữ mẫu để thử lại khi đồng bộ. Mẫu cũ còn pending của tài khoản có thể được gửi ngay khi mở trang ở chế độ đồng bộ. Rút lượt cập nhật local và gọi API rút theo `session_ref` cho các mẫu đã lên server.

## 4. API và vòng đời mẫu phương ngữ

Mã ở `backend/app/routers/dialect.py`, `dialect_workspace.py`, `backend/app/models/dialect.py` và `frontend/src/features/dialect/`. Router đầu giữ hồ sơ, đóng góp, duyệt, nguồn, metrics và release; router workspace thêm snapshot, sửa consent, rút theo lượt, chuẩn hóa, người tham gia, hạn mức và phản hồi. Bảng `dialect_*` tách khỏi audio/finance, liên kết tài khoản `users`. Dùng Swagger tại backend `/docs` hoặc `/openapi.json` để lấy schema hiện tại.

| Nghiệp vụ | Endpoint chính (thêm tiền tố `/api/dialect`) |
| --- | --- |
| Đọc workspace và hồ sơ | `GET /workspace`, `GET/PUT /profile` |
| Tạo, tìm, xem mẫu | `GET/POST /contributions`, `GET /contributions/{id}`, `GET /duplicates`, `GET /admin/contributions` |
| Đồng ý sử dụng và rút mẫu | `POST /contributions/{id}/consent`, `POST /contributions/{id}/withdraw`, `POST /sessions/{ref}/withdraw` |
| Kiểm duyệt | `GET /reviews`, `POST /reviews/{id}/votes`, `POST /reviews/{id}/finalize`, `POST /reviews/{id}/curate` |
| Quản trị nguồn, tài khoản | `GET /sources`, `POST /sources/{id}/rights`, `GET /participants`, `POST /participants/{id}/role`, `PUT /participants/{id}`, `POST /me/appeal` |
| Dataset | `GET /metrics`, `GET /releases/preview`, `GET/POST /releases`, `GET /releases/{id}` |
| Hạn mức và phản hồi | `PUT /rewards/policy`, `POST /credits`, `POST /credits/{id}/revoke`, `POST /credits/spend`, `POST /feedback`, `POST /feedback/{id}/resolve` |

- **Nhận và giữ gốc:** Góp trực tiếp cần vùng, nội dung, nghĩa, bản phổ thông, ngữ cảnh và bằng chứng nguồn; câu game chỉ cần vùng và nội dung đối với phản hồi dạng câu trả lời. `unknown`, `no_term`, `same_standard` không cần chữ nhưng không đủ điều kiện xuất như mục từ. Mẫu mới giữ RAW, ghi consent theo phiên bản; bổ sung tạo bản mới qua `parent_id`. Cùng tài khoản, cùng idempotency key và payload trả mẫu cũ; đổi payload với cùng key trả 409. Mẫu game trùng gắn `duplicate_of` và `HOLD`, giữ chủ sở hữu và consent riêng; không đưa vào duyệt mới hoặc xuất.
- **Duyệt và chuẩn hóa:** RAW → REVIEW → VERIFIED/HOLD/REJECT. Hai reviewer độc lập đồng verdict thì có quyết định; admin phân xử bất đồng nếu không phải người góp hoặc người đã bỏ phiếu. Reviewer có vùng chuyên môn chỉ được bỏ phiếu trong vùng đó, không tự duyệt hoặc chuẩn hóa mẫu của mình. Phiếu khác được che trước khi người duyệt bỏ phiếu, trừ quyền điều phối của admin; client có placeholder `sealed` để đếm. CURATED là dữ liệu chuẩn hóa riêng, không ghi đè RAW. Snapshot workspace có giới hạn 1.000 mẫu gần nhất, chưa phân trang; contributor chỉ đọc mẫu của mình, reviewer/admin là staff. Quyền bỏ phiếu theo vùng khác với phạm vi đọc snapshot.
- **Quyền và release:** xuất cần VERIFIED, ít nhất hai phiếu, quyền huấn luyện từ nguồn, consent tiếp nhận và huấn luyện hiệu lực, mẫu chưa rút, không trùng, không có phiên bản bổ sung chưa rút. Consent tiếp nhận, huấn luyện, công khai và audio là các phạm vi riêng. Luồng góp trực tiếp có preview + digest để phát hiện danh sách đổi; release dạng này chưa chia tập. Luồng dataset demo gửi `ids`, split train/dev/test và data card; server kiểm lại eligibility và CURATED đủ `text/meaning/standard/context`. Chia nhóm được tính ở client; server lưu split nhận được. Manifest có phiên bản và SHA-256; tải lại kiểm eligibility và trả 409 nếu có mẫu mất điều kiện. Phạm vi là ứng viên huấn luyện, chưa phải gold/benchmark. File đã tải ra ngoài không thể thu hồi từ ứng dụng.
- **Hạn mức:** ở server, chính sách mặc định tắt; cấp khi tài khoản đã xác nhận, không bị tạm giữ, có mẫu đủ điều kiện và đã chuẩn hóa. Hiện là 5 lượt/mẫu, tối đa 4 lần cấp/ngày, hết hạn 30 ngày. Hạn mức không biến tác vụ AI mô phỏng thành dịch vụ dịch/ASR/huấn luyện thật.
- **Giới hạn:** media đính kèm demo chỉ có Blob local; server nhận ID, không lưu file media. Lượt game, ngân hàng câu, điểm/snapshot/lịch sử lượt và backup trình duyệt không đồng bộ xuyên thiết bị. Một số số liệu quản trị trộn mẫu server với lượt local; cần nêu nguồn khi diễn giải.

## 5. Audio, role-play và ví legacy

- **Dự án và gán nhãn:** `projects`, `audios`, `annotate` là các router và feature tương ứng. Task `audio_label` chép audio, `audio_verify` xác nhận nhãn, `qa` trả lời chữ/lựa chọn/ghi âm. `allocation_service.py` dùng lock TTL 10 phút, redundancy và repeat check. Review dùng tín hiệu hành vi và duyệt bởi admin; báo audio hỏng được duyệt có thể nhận điểm. Golden và tự duyệt theo consensus chưa hoàn chỉnh.
- **Role-play:** project `collect` kết nối voice agent qua WebSocket proxy (`roleplay_ws_proxy.py`), lưu WAV stereo vào bucket `audios` của MinIO. Không cộng điểm ví cho phiên role-play. `test_elevenlabs_realtime_stt.py` là script thử riêng, không nằm trong luồng app hoặc suite backend.
- **Ví:** backend tính điểm chờ duyệt/đã xác nhận và số dư khả dụng từ annotation, report, withdrawal. Mặc định 50 VND/điểm, tối thiểu 100 điểm để rút; admin duyệt rồi đánh dấu đã trả. Đây là quy trình nội bộ, không có tích hợp ngân hàng tự chuyển tiền trong luồng mô tả.
- **Ranh giới truy cập:** audit legacy lưu ý các endpoint liệt kê task, URL presigned và annotator của task khi membership ở project public rộng. Kiểm tra `backend/app/routers/audios.py` trước khi sửa ACL; tránh đưa cờ golden, nội dung và câu trả lời người khác ra client. Xem `docs/concerns.md` và `docs/ARCHITECTURE.md`.

## 6. Chạy local và kiểm tra

Dùng Node 20.19+ hoặc 22.12+ cho Vite và Python 3.12 theo môi trường dự án. Venv của snapshot này chạy được bằng Python 3.11.9. Từ root trên Windows, nếu mới thiết lập:

```powershell
Push-Location backend
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
Pop-Location
Push-Location frontend
npm ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
Pop-Location
.\scripts\start-local.ps1
```

- Frontend: `http://localhost:7777/demo`. Backend: `http://127.0.0.1:8765`; health `/api/health`. Vite proxy `/api` tới backend để dùng cookie cùng host; dùng một hostname xuyên suốt. Script chỉ bật frontend/backend, có log ở `%TEMP%/blaze-local-dev`; chạy từng tiến trình thủ công khi cần reload. Tạo admin dev từ `backend`: `./.venv/Scripts/python.exe -m scripts.create_admin <email> <password> "<Họ tên>"` với dữ liệu thử nghiệm.
- MinIO cần cho upload/audio/role-play, không cần để chơi game chữ và gọi API phương ngữ. Setup local theo `backend/.env.example`: S3 API `:9100`, console `:9101`, bucket `audios`. `docker compose up -d --build` là lựa chọn cho cả stack. Xem `docs/DEVELOPMENT.md` và file cấu hình để xử lý host, cookie, CORS hoặc URL presigned.
- Khi QA, dùng SQLite tạm và browser profile riêng để không đẩy outbox cũ hay sửa mẫu của người dùng. Chỉ chuyển source/docs cần thiết cho Claude; loại `.env`, DB, bản ghi âm, IndexedDB/backup người dùng và credentials.

| Kiểm tra lại ngày 09/11/2026 | Kết quả thực tế |
| --- | --- |
| `npm run build` trong `frontend` | Đạt TypeScript và Vite production build. |
| `npm test` trong `frontend` | **65/69 đạt**. 4 lỗi có sẵn: 1 ca `demo-flow.test.tsx` và 3 ca `dataset-game.test.tsx` tìm heading “Cảm ơn bạn đã góp tiếng quê.”, UI hiện “Cảm ơn bạn đã góp.”. Các test luồng demo chủ yếu đặt `VITE_DEMO_SERVER=off`; xem `demo-server.test.ts` cho cầu nối API. |
| `./.venv/Scripts/python.exe -m unittest discover -s tests -v` trong `backend` | **13/13 đạt** với `DATABASE_URL=sqlite://` và DB tạm của test auth. Có test vòng đời, quyền, consent, trùng, release và hạn mức. |
| Lint, trình duyệt, MinIO và voice agent | Không chạy lại trong đợt tổng hợp tài liệu. Báo cáo audit và sync có bằng chứng QA ở thời điểm lập; không suy ra đã kiểm hết mọi vai trò và cấu hình. |

## 7. Điểm cần kiểm khi làm tiếp

- Ưu tiên kiểm tra chiều dọc **game → outbox → server → hai phiếu → quyền/consent → release** khi đổi pipeline. Test cả lỗi tạm thời, retry, đổi tài khoản, rút mẫu, consent bị thu hẹp và release đã tạo. Khi đụng local reducer và server, xác định phần nào cần đồng nhất và phần nào khác nhau có chủ ý.
- Audit ngày 09/11 đã ghi nhận sửa nội dung quyền theo chế độ đồng bộ, danh sách Quảng Nam và focus nút. Các việc còn ghi nhận gồm thao tác game trên mobile, điều hướng câu qua bàn phím, kiểm chất lượng câu mở quá ngắn, cài đặt vai trò ghi ngay, số liệu lượt chỉ đọc local và khôi phục mật khẩu. Đọc audit và kiểm lại code trước khi coi từng mục là backlog hiện hành.
- Chưa có bằng chứng dataset đủ chất lượng để huấn luyện thật, bộ gold do chuyên gia duyệt, pipeline ASR/dịch/huấn luyện production hoặc ứng dụng đã triển khai cho cộng đồng. Không dùng báo cáo tiến độ để suy ra những mốc đó đã hoàn thành.

## 8. Mục lục tài liệu và cách đọc

| Tài liệu | Dùng khi cần | Trạng thái |
| --- | --- | --- |
| [CLAUDE.md](../CLAUDE.md) · [README](../README.md) | Điểm vào repo và hướng dẫn chạy | Bắt đầu ở đây |
| [DEMO_SERVER_SYNC](DEMO_SERVER_SYNC_2026-11-09.md) | Phân định API/IndexedDB, sync, schema và test của đợt nối server | Thiết kế hiện hành; số liệu test là lịch sử |
| [UX_UI_AUDIT](UX_UI_AUDIT_2026-11-09.md) | Bằng chứng UI mobile/desktop, vấn đề còn lại và phần đã sửa | Đọc ghi chú cập nhật ở đầu |
| [DIALECT_IMPLEMENTATION](DIALECT_IMPLEMENTATION.md) | Bàn giao wizard, review và release phương ngữ ban đầu | Đọc cùng sync; consent/release đã mở rộng |
| [AUTO_GAME_ALLOCATION](AUTO_GAME_ALLOCATION_2026-11-04.md) · [DATASET_GAME_VARIETY](DATASET_GAME_VARIETY_2026-11-04.md) | Phân đề, lượt lặp, 30 câu, định dạng và provenance | Hữu ích cho luật và seed; đối chiếu code |
| [REQUIRED_LOGIN_DISTRICTS](REQUIRED_LOGIN_DISTRICTS_2026-11-05.md) · [ROLE_NAVIGATION](ROLE_NAVIGATION_2026-11-03.md) | Lịch sử bắt buộc auth, danh mục vùng và phân vai | Danh mục và trường bắt buộc đã đổi; xem mục 3 |
| [APPDICHTHUAT_DEMO_DELIVERY](APPDICHTHUAT_DEMO_DELIVERY_2026-11-03.md) | Màn P0–P2, kịch bản demo, cách tiếp cận lúc bàn giao | Lịch sử; mô tả frontend-only/guest đã cũ |
| [GAME_10_QUESTIONS_STATUS](GAME_10_QUESTIONS_STATUS_2026-11-03.md) · [FEATURE_CONFLICT_AUDIT](FEATURE_CONFLICT_AUDIT_2026-11-03.md) | Yêu cầu game và xung đột trước đợt triển khai | Bối cảnh lịch sử, không dùng làm mô tả hiện trạng |
| [DESIGN](../DESIGN.md) · [Canvas](../designs/blaze-collection/project/canvas.json) · [Ảnh bàn giao](screenshots/) | Thiết kế tham chiếu, các artboard và ảnh minh họa | Đối chiếu CSS và hành vi thực tế |
| [FRONTEND_UI_UX_AUDIT](FRONTEND_UI_UX_AUDIT.md) · [FRONTEND_REBUILD_PLAN](FRONTEND_REBUILD_PLAN.md) | Các vấn đề và phương án rebuild ban đầu | Audit/kế hoạch lịch sử |
| [FRONTEND_REDESIGN_DELIVERY](FRONTEND_REDESIGN_DELIVERY_2026-11-03.md) · [FRONTEND_WARM_REDESIGN](FRONTEND_WARM_REDESIGN_2026-11-03.md) · [TYPOGRAPHY_UPDATE](TYPOGRAPHY_UPDATE_2026-11-03.md) | Quyết định redesign, palette ấm, logo và font | Lịch sử triển khai UI |
| [ARCHITECTURE](ARCHITECTURE.md) · [API](API.md) · [DEVELOPMENT](DEVELOPMENT.md) · [Frontend README](../frontend/README.md) | Backend/audio legacy, API và quy ước dev | Một số route, biến cấu hình, test đã đổi; đối chiếu source |
| [PLAN](PLAN.md) · [concerns](concerns.md) | Roadmap gốc, anti-leak, anti-cheat và payout | PLAN là đề xuất, kể cả MongoDB/KYC; concerns là các vấn đề cần kiểm |
| [Báo cáo tổng hợp 13/10–04/11](reports/BAO_CAO_TONG_HOP_APPDICHTHUAT_13_10_DEN_04_11_2026.docx) | Bối cảnh khảo sát, kế hoạch, tiến độ và phần chờ quyết định | Báo cáo quản lý theo kỳ |
| [Báo cáo chức năng](reports/BAO_CAO_CHUC_NANG_APP_KEM_CHO_CHEN_ANH.docx) · [Bản kèm hướng dẫn chụp](reports/BAO_CAO_APP_CO_HUONG_DAN_CHUP_ANH.docx) | Mô tả các màn và cách minh họa khi trình bày | Dùng cho báo cáo; hướng dẫn chọn vai và trạng thái lưu đã thay đổi |

Các PDF/PNG preview và script tạo Word trong `docs/reports/` phục vụ xuất báo cáo. Chúng không phải đầu vào runtime. Bản tóm tắt này đã gộp các thông tin chính trong repo, không giả định đã có các hồ sơ nghiên cứu hoặc dataset bên ngoài chỉ được nhắc tên trong báo cáo.

> Lời nhắn khi gửi file cho Claude: “Đây là tài liệu bàn giao Blaze Voice Collection ngày 09/11/2026. Hãy xác định phần việc thuộc game, API phương ngữ hay audio legacy. Nếu có repo, đọc `CLAUDE.md`, xem `git status --short` và đối chiếu source/test trước khi sửa. Việc cần làm tiếp là: …”
