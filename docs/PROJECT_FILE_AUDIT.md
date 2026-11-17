# Kiểm kê project sau khi gỡ bộ kiểm thử

**Thiết kế riêng:** `designs/` chỉ giữ local, đã bỏ Git theo dõi và bị loại khỏi Docker build context/gói release ZIP. Các mục thiết kế bên dưới chỉ mô tả file local, không thuộc source chia sẻ. Cấu hình bỏ qua không xoá nội dung khỏi các commit hoặc gói ZIP đã tạo trước đây.

Cập nhật ngày 17/11/2026 theo yêu cầu xoá các phần tạo cho testing. Phạm vi là workspace `E:/blaze-voice-collection`. Không xử lý DB, tài khoản, IndexedDB hay dữ liệu ngoài repository.

## Những gì đã gỡ

- **79 file nguồn/cấu hình/tài liệu phục vụ kiểm thử**: toàn bộ frontend/tests, backend/tests, test-fixtures, ml/simulator; Vitest config; script seed/chạy QA, lab, benchmark, nghiệm thu phase và smoke check môi trường ML.
- Component ScoreBurst không còn được ứng dụng import; trước đây chỉ được test dùng.
- Sáu dependency trực tiếp chỉ phục vụ test: @testing-library/jest-dom, @testing-library/react, @testing-library/user-event, fake-indexeddb, jsdom và vitest. npm đã gỡ 72 package khỏi cây dependency cài sẵn.
- Trang /demo/internal và thanh công cụ thử nghiệm, đổi vai trò giả, chèn lỗi offline/spam, reset kho mẫu từ thanh thử nghiệm.
- Script npm test, lệnh test trong CI và chặng smoke test container. CI giữ lint/build, kiểm cú pháp Python và build image.
- Cache Vitest và bytecode của bộ test/script QA đã xoá được đưa vào Recycle Bin để loại khỏi workspace.
- Tài liệu và cấu hình mở app đã được cập nhật để không gọi script test/QA đã xoá.

## Phần giữ lại vì ứng dụng còn cần

- features/demo là ứng dụng chính, không phải bộ test. features/dialect và auth cũng đang dùng.
- testSessions.ts và cờ testOnly là cơ chế loại phiên QA lịch sử khỏi số liệu/duyệt/phân bổ thật. Xoá chúng sẽ có thể đưa dữ liệu thử cũ vào nghiệp vụ thật.
- seed.ts, dataset1Bank.ts, game_catalog.json và hai bản chính sách nội dung là đầu vào runtime/khởi tạo, không phải fixture kiểm thử.
- Các model/schema/route role-play có thuật ngữ test case là cấu hình nội dung nghiệp vụ cũ, không phải unit test. Không xoá theo từ khoá.
- Công cụ xử lý dataset/audio, STT, đánh giá dịch, xác minh dataset, migration/backup và số liệu vận hành còn được giữ. Đó là workflow sản phẩm/dữ liệu; không xoá môi trường ML chỉ vì đã bỏ bộ test web.
- DB local, .env, Git và dữ liệu ngoài repo được giữ nguyên. Phiên QA/tài khoản giả đã tồn tại trong DB hoặc browser profile không bị tự xoá.

## Cách đọc bảng

GIỮ: cần cho chạy/build hoặc bảo vệ dữ liệu. DỮ LIỆU/CẤU HÌNH: DB/config cần bảo toàn. PHÁT TRIỂN/VẬN HÀNH: công cụ/tài liệu bảo trì. LEGACY CÒN NỐI: tính năng cũ tắt route nhưng còn import/model, cần refactor trước khi bỏ. TUỲ CHỌN: bỏ khi ngừng workflow tương ứng. TÁI TẠO: output/log có thể tạo lại.

Danh sách dưới có **364 file hiện có** ngoài cây dependency/build/cache/Git, cấu hình trợ lý/editor riêng được ẩn ở local và chính báo cáo này. File bên thứ ba, bytecode và output build được đánh giá theo cả cây. Báo cáo dùng kiểm kê cũ để giữ mô tả và đã cập nhật các mục thay đổi trong đợt dọn; không đọc giá trị secrets hoặc bản ghi DB.

## Thư mục còn lại

| Thư mục | Vai trò |
| --- | --- |
| `.git/` | Toàn bộ lịch sử commit/branch/index của Git. Giữ; chỉ ~12,5 MiB, không phải cache để dọn. |
| `.github/` | Tự động hoá của GitHub. |
| `.github/workflows/` | CI lint/build, kiểm cú pháp Python và build Docker, không còn chạy bộ test. |
| `backend/` | API, DB thật, migration và công cụ vận hành; đã bỏ backend/tests và CLI seed/benchmark QA. |
| `backend/.venv/` | Dependency Python cài sẵn; tái tạo từ requirements.txt, phải cài lại trước khi chạy API local. |
| `backend/app/` | Mã chạy API; giữ. |
| `backend/app/__pycache__/` | Bytecode Python sinh tự động; có thể xoá sau khi dừng công cụ, Python tạo lại khi import. |
| `backend/app/core/` | Hạ tầng chung: cấu hình, DB, bảo mật, audit, storage. |
| `backend/app/core/__pycache__/` | Bytecode Python sinh tự động; có thể xoá sau khi dừng công cụ, Python tạo lại khi import. |
| `backend/app/data/` | Dữ liệu catalog/chính sách cần khi chạy và bootstrap. |
| `backend/app/models/` | Định nghĩa bảng SQLAlchemy, gồm bảng hiện tại và legacy đăng ký chung. |
| `backend/app/models/__pycache__/` | Bytecode Python sinh tự động; có thể xoá sau khi dừng công cụ, Python tạo lại khi import. |
| `backend/app/routers/` | Các endpoint; có router legacy được import ngay cả khi route không mount. |
| `backend/app/routers/__pycache__/` | Bytecode Python sinh tự động; có thể xoá sau khi dừng công cụ, Python tạo lại khi import. |
| `backend/app/schemas/` | Kiểu request/response Pydantic, phần lớn phục vụ legacy và auth. |
| `backend/app/schemas/__pycache__/` | Bytecode Python sinh tự động; có thể xoá sau khi dừng công cụ, Python tạo lại khi import. |
| `backend/app/services/` | Nghiệp vụ thực tế; phân loại theo từng file bên dưới. |
| `backend/app/services/__pycache__/` | Bytecode Python sinh tự động; có thể xoá sau khi dừng công cụ, Python tạo lại khi import. |
| `backend/migrations/` | Lịch sử schema, cần khi triển khai/nâng cấp và kiểm schema production. |
| `backend/migrations/__pycache__/` | Bytecode Python sinh tự động; có thể xoá sau khi dừng công cụ, Python tạo lại khi import. |
| `backend/migrations/versions/` | Chuỗi migration có quan hệ trước/sau; không bỏ các bản cũ riêng lẻ. |
| `backend/migrations/versions/__pycache__/` | Bytecode Python sinh tự động; có thể xoá sau khi dừng công cụ, Python tạo lại khi import. |
| `backend/scripts/` | CLI tài khoản, DB, kiểm dataset và đánh giá dịch còn sử dụng; đã bỏ seed_qa.py và benchmark_pilot.py. |
| `backend/scripts/__pycache__/` | Bytecode Python sinh tự động; có thể xoá sau khi dừng công cụ, Python tạo lại khi import. |
| `deploy/` | Hướng dẫn triển khai và proxy; giữ nếu còn phát hành server. |
| `designs/` | Thiết kế nguồn độc lập, không chạy trong web; lưu trữ/bỏ nếu không cần chỉnh artboard. |
| `designs/blaze-collection/` | Project thiết kế editable, asset và lịch sử local. |
| `designs/blaze-collection/history/` | Lịch sử phiên bản của công cụ thiết kế, không phải Git; bỏ sẽ mất khả năng quay lại thiết kế cũ. |
| `designs/blaze-collection/history/objects/` | Blob snapshot theo hash phục vụ lịch sử thiết kế; không cần giải thích từng blob như code. |
| `designs/blaze-collection/project/` | Nguồn canvas/artboard và asset; giữ cùng nhau nếu còn dùng thiết kế. |
| `designs/blaze-collection/project/assets/` | Font/hình và index của artboard; bỏ rời dễ làm thiết kế lỗi hiển thị. |
| `docs/` | Tài liệu hiện hành; nhỏ, nên giữ. Không phải dependency runtime. |
| `docs/legacy/` | Tài liệu lịch sử; có thể lưu trữ/bỏ và sửa link tham chiếu nếu không cần tra cứu. |
| `frontend/` | Ứng dụng React, cấu hình build và tài nguyên; đã bỏ frontend/tests, Vitest và dependency kiểm thử. |
| `frontend/dist/` | Output build ứng dụng; bản build mới đã loại chunk cũ chứa công cụ thử nghiệm. |
| `frontend/node_modules/` | Dependency npm cài sẵn; tái tạo bằng npm ci, không xoá package-lock.json. |
| `frontend/public/` | Tài nguyên tĩnh được copy khi build. |
| `frontend/public/brand/` | Logo đang dùng và thông tin giấy phép font. |
| `frontend/scripts/` | Công cụ sinh kho câu hỏi từ dữ liệu XLSX. |
| `frontend/src/` | Toàn bộ mã nguồn frontend; không phải output build. |
| `frontend/src/api/` | Client gọi API, có cả client legacy và client auth dùng chung. |
| `frontend/src/components/` | Thành phần dùng chung; đã bỏ ScoreBurst vì chỉ được test tham chiếu. |
| `frontend/src/features/` | Các nhóm nghiệp vụ; tên folder không quyết định có đang dùng hay không. |
| `frontend/src/features/admin/` | Quản trị hệ thống audio/wallet cũ; có thể gỡ theo gói tính năng. |
| `frontend/src/features/annotate/` | Gán nhãn/thu âm cũ; có thể gỡ theo gói tính năng. |
| `frontend/src/features/audios/` | Quản lý audio cũ; có thể gỡ theo gói tính năng. |
| `frontend/src/features/auth/` | Xác thực và hồ sơ chung, đang dùng. |
| `frontend/src/features/demo/` | Ứng dụng chính đang dùng; đã bỏ công cụ nội bộ/mô phỏng lỗi, giữ nghiệp vụ và bộ lọc phiên QA lịch sử. |
| `frontend/src/features/dialect/` | Public pages, thành phần dialect và đường vào tương thích vẫn được router dùng. |
| `frontend/src/features/projects/` | Dự án và cấu hình thu thập/gán nhãn cũ; có thể gỡ theo gói tính năng. |
| `frontend/src/features/rewards/` | Điểm thưởng annotation cũ; khác RewardsDemo của workspace hiện tại. |
| `frontend/src/features/roleplay/` | Hội thoại agent/audio cũ; có thể gỡ theo gói tính năng. |
| `frontend/src/features/wallet/` | Yêu cầu rút tiền legacy. |
| `frontend/src/lib/` | Kiểu dữ liệu và hàm chung; không xoá nguyên folder vì có cả mã hiện tại lẫn legacy. |
| `frontend/src/pages/` | Một trang lỗi dùng chung và nhiều trang legacy; không xoá cả folder. |
| `frontend/src/styles/` | CSS nhập từ main.tsx, nhiều phần dùng chung; không bỏ file chỉ theo tên. |
| `ml/` | Công cụ dữ liệu/ML/audio còn giữ. Đã bỏ simulator và công cụ smoke check môi trường. |
| `ml/.venv/` | Dependency ML/CUDA lớn nhất; có thể tái tạo từ lockfile nhưng cần tải lại nhiều GB và cấu hình đúng Python/CUDA. |
| `ml/dataset/` | Các pipeline audit Dataset1 và thử nghiệm audio; không chạy trong pilot web. |
| `ml/dataset/__pycache__/` | Bytecode Python sinh tự động; có thể xoá sau khi dừng công cụ, Python tạo lại khi import. |
| `ml/scripts/` | Công cụ STT ElevenLabs độc lập; không còn check_environment.py. |
| `scripts/` | Khởi động local, preview audio và đóng gói release; không còn script QA/lab/simulator/phase gate. |

## Chi tiết từng file còn lại

### File tại root

| File | Dung lượng | Mức cần thiết | Công dụng / khuyến nghị |
| --- | ---: | --- | --- |
| `.dockerignore` | 285 B | **GIỮ** | Loại dependency, DB, secrets, test và tài liệu khỏi Docker build context; giảm dung lượng gửi khi build. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `.env.pilot.example` | 314 B | **GIỮ** | Mẫu cấu hình triển khai pilot Docker; không phải secrets thật. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `.gitignore` | 704 B | **GIỮ** | Ngăn Git đưa secrets, DB, dependency và kết quả sinh tự động vào lịch sử. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `Dockerfile` | 1.2 KiB | **GIỮ** | Build React rồi đóng gói cùng FastAPI thành image chạy chung cổng 7777. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `README.md` | 3.9 KiB | **PHÁT TRIỂN/VẬN HÀNH** | Hướng dẫn chạy/build/triển khai; đã bỏ lệnh test, thư mục fixture và cách mở QA đã xoá. |
| `docker-compose.yml` | 944 B | **GIỮ** | Khởi chạy image, truyền cấu hình và gắn volume DB bền vững. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |

### .github/workflows

| File | Dung lượng | Mức cần thiết | Công dụng / khuyến nghị |
| --- | ---: | --- | --- |
| `.github/workflows/ci.yml` | 975 B | **PHÁT TRIỂN/VẬN HÀNH** | CI hiện chỉ lint/build frontend, kiểm cú pháp Python và build image Docker; đã bỏ job/chặng chạy test tự động và smoke test container. |

### backend

| File | Dung lượng | Mức cần thiết | Công dụng / khuyến nghị |
| --- | ---: | --- | --- |
| `backend/.env` | 656 B | **DỮ LIỆU/CẤU HÌNH** | Cấu hình local thực tế, có thể chứa secrets và đường dẫn DB; báo cáo không đọc nội dung file này. **Xử lý:** Giữ hoặc backup/xác nhận khả năng phục hồi trước khi xử lý; không coi là cache. |
| `backend/.env.example` | 1.2 KiB | **GIỮ** | Mẫu biến môi trường backend để tạo lại cấu hình riêng. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/alembic.ini` | 143 B | **GIỮ** | Cấu hình Alembic để tìm migration; production kiểm schema dựa trên hệ thống này. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/annotator.db` | 4648.0 KiB | **DỮ LIỆU/CẤU HÌNH** | Database SQLite local thực tế: tài khoản và dữ liệu nghiệp vụ; không phải cache. **Xử lý:** Giữ hoặc backup/xác nhận khả năng phục hồi trước khi xử lý; không coi là cache. |
| `backend/annotator.db-shm` | 32.0 KiB | **DỮ LIỆU/CẤU HÌNH** | Bộ nhớ chia sẻ hỗ trợ SQLite WAL; không tự xoá khi DB đang được dùng. **Xử lý:** Giữ hoặc backup/xác nhận khả năng phục hồi trước khi xử lý; không coi là cache. |
| `backend/annotator.db-wal` | 0 B | **DỮ LIỆU/CẤU HÌNH** | Nhật ký giao dịch SQLite WAL; khi đang chạy có thể chứa dữ liệu chưa checkpoint vào DB chính. **Xử lý:** Giữ hoặc backup/xác nhận khả năng phục hồi trước khi xử lý; không coi là cache. |
| `backend/requirements.txt` | 301 B | **GIỮ** | Danh sách dependency Python cho API, migration và các công cụ backend. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |

### backend/app

| File | Dung lượng | Mức cần thiết | Công dụng / khuyến nghị |
| --- | ---: | --- | --- |
| `backend/app/__init__.py` | 0 B | **GIỮ** | Đánh dấu package Python. Có thể rỗng nhưng giúp cấu trúc import/công cụ rõ ràng; giữ, tiết kiệm gần như không đáng kể nếu bỏ. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/app/frontend.py` | 1.3 KiB | **GIỮ** | Phục vụ bản React đã build trên cùng origin với API và xử lý SPA fallback. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/app/main.py` | 2.8 KiB | **GIỮ** | Điểm vào FastAPI: middleware, đăng ký API, khởi tạo DB/catalog và health check. Import cả router legacy trước khi xét cờ bật/tắt. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |

### backend/app/core

| File | Dung lượng | Mức cần thiết | Công dụng / khuyến nghị |
| --- | ---: | --- | --- |
| `backend/app/core/__init__.py` | 0 B | **GIỮ** | Đánh dấu package Python. Có thể rỗng nhưng giúp cấu trúc import/công cụ rõ ràng; giữ, tiết kiệm gần như không đáng kể nếu bỏ. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/app/core/audit.py` | 3.5 KiB | **GIỮ** | Ghi audit trong cùng transaction với thay đổi nghiệp vụ; import có side effect đăng ký listener. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/app/core/config.py` | 4.1 KiB | **GIỮ** | Đọc cấu hình và kiểm ràng buộc production: secrets, cookie, CORS, proxy, legacy. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/app/core/database.py` | 2.2 KiB | **GIỮ** | Engine/session SQLAlchemy, SQLite WAL, tạo schema dev và kiểm migration head production. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/app/core/http_security.py` | 6.4 KiB | **GIỮ** | Middleware bảo vệ HTTP, rate limit và log tránh dữ liệu nhạy cảm. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/app/core/roles.py` | 198 B | **GIỮ** | Chuẩn hoá vai trò, tương thích giá trị role cũ. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/app/core/security.py` | 1.3 KiB | **GIỮ** | Hash/kiểm mật khẩu, dấu vân tay thông tin xác thực và JWT. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/app/core/storage.py` | 3.3 KiB | **LEGACY CÒN NỐI** | Kết nối MinIO và nguồn đồng bộ file ngoài cho hệ thống audio legacy. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |

### backend/app/data

| File | Dung lượng | Mức cần thiết | Công dụng / khuyến nghị |
| --- | ---: | --- | --- |
| `backend/app/data/game_catalog.json` | 586.2 KiB | **GIỮ** | Catalog câu hỏi/đề khởi tạo DB mới. DB đã có catalog không khiến file này trở thành thừa: bootstrap vẫn là đường phụ thuộc. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/app/data/player_content_policy.json` | 453 B | **GIỮ** | Chính sách câu hỏi công khai backend. Giữ đồng nhất với bản frontend; bộ test tự động đối chiếu đã được gỡ, cần đối chiếu khi bảo trì. |

### backend/app/models

| File | Dung lượng | Mức cần thiết | Công dụng / khuyến nghị |
| --- | ---: | --- | --- |
| `backend/app/models/__init__.py` | 794 B | **GIỮ** | Đăng ký/re-export toàn bộ model, cả legacy. database.init_db import gói này để metadata có đủ bảng; không bỏ vì tưởng chỉ là danh sách import. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/app/models/annotation.py` | 3.1 KiB | **LEGACY CÒN NỐI** | Bảng phân công và câu trả lời gán nhãn audio cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `backend/app/models/audio.py` | 1.5 KiB | **LEGACY CÒN NỐI** | Bảng bản ghi audio và metadata cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `backend/app/models/dialect.py` | 8.8 KiB | **GIỮ** | Bảng đóng góp phương ngữ, nguồn, consent, phiếu duyệt, lịch sử, release và nghiệp vụ workspace. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/app/models/game.py` | 1.9 KiB | **GIỮ** | Bảng catalog phiên bản, phiên chơi và lệnh game phía server. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/app/models/project.py` | 2.7 KiB | **LEGACY CÒN NỐI** | Bảng dự án và thành viên của hệ thống gán nhãn/thu thập cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `backend/app/models/report.py` | 1.4 KiB | **LEGACY CÒN NỐI** | Bảng báo cáo vấn đề của hệ thống annotator cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `backend/app/models/roleplay.py` | 4.8 KiB | **LEGACY CÒN NỐI** | Bảng kịch bản, test case và phiên role-play cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `backend/app/models/security.py` | 1.3 KiB | **GIỮ** | Bảng rate limit bền vững, audit và token khôi phục mật khẩu một lần. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/app/models/task.py` | 3.4 KiB | **LEGACY CÒN NỐI** | Bảng task của pipeline gán nhãn/thu thập cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `backend/app/models/user.py` | 764 B | **GIỮ** | Bảng tài khoản chung, pilot đang dùng. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/app/models/wallet.py` | 1.8 KiB | **LEGACY CÒN NỐI** | Bảng hồ sơ ví và yêu cầu rút tiền cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |

### backend/app/routers

| File | Dung lượng | Mức cần thiết | Công dụng / khuyến nghị |
| --- | ---: | --- | --- |
| `backend/app/routers/__init__.py` | 0 B | **GIỮ** | Đánh dấu package Python. Có thể rỗng nhưng giúp cấu trúc import/công cụ rõ ràng; giữ, tiết kiệm gần như không đáng kể nếu bỏ. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/app/routers/annotate.py` | 4.3 KiB | **LEGACY CÒN NỐI** | API lấy task, gửi nhãn/giọng nói, bỏ qua và thống kê annotator cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `backend/app/routers/audios.py` | 15.6 KiB | **LEGACY CÒN NỐI** | API tải lên, đồng bộ, prelabel, template và quản lý audio cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `backend/app/routers/auth.py` | 2.8 KiB | **GIỮ** | API đăng ký, đăng nhập, đăng xuất, tài khoản, đổi/khôi phục mật khẩu. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/app/routers/deps.py` | 3.3 KiB | **GIỮ** | Dependency xác thực cookie, lấy người dùng và kiểm role dùng chung. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/app/routers/dialect.py` | 35.0 KiB | **GIỮ** | API tạo đóng góp RAW, duyệt độc lập, chỉnh lý, quản lý nguồn và release phương ngữ. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/app/routers/dialect_game.py` | 5.7 KiB | **GIỮ** | API catalog, phiên bản, bắt đầu/đọc phiên chơi và xử lý lệnh game. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/app/routers/dialect_review_ops.py` | 4.7 KiB | **GIỮ** | API duyệt hàng loạt, kiểm phạm vi và bảo toàn RAW/phiếu độc lập. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/app/routers/dialect_workspace.py` | 24.0 KiB | **GIỮ** | API snapshot workspace và các thao tác consent, phân bổ game, người tham gia, cấu hình. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/app/routers/pilot_operations.py` | 5.2 KiB | **GIỮ** | API chỉ đọc để tổng hợp bằng chứng vận hành pilot. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/app/routers/projects.py` | 4.0 KiB | **LEGACY CÒN NỐI** | API dự án, thành viên và báo cáo tiến độ cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `backend/app/routers/reports.py` | 2.3 KiB | **LEGACY CÒN NỐI** | API gửi/xử lý báo cáo vấn đề của annotator cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `backend/app/routers/review.py` | 5.8 KiB | **LEGACY CÒN NỐI** | API duyệt annotation, sửa nhãn, tổng điểm và cờ tài khoản của hệ thống cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `backend/app/routers/roleplay.py` | 22.8 KiB | **LEGACY CÒN NỐI** | API kịch bản/test case/phiên hội thoại và WebSocket agent cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `backend/app/routers/users.py` | 1014 B | **LEGACY CÒN NỐI** | API liệt kê người dùng phục vụ phân công dự án cũ; không phải toàn bộ hệ thống auth. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `backend/app/routers/wallet.py` | 4.2 KiB | **LEGACY CÒN NỐI** | API ví, hồ sơ thanh toán và quy trình yêu cầu rút tiền cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |

### backend/app/schemas

| File | Dung lượng | Mức cần thiết | Công dụng / khuyến nghị |
| --- | ---: | --- | --- |
| `backend/app/schemas/__init__.py` | 0 B | **GIỮ** | Đánh dấu package Python. Có thể rỗng nhưng giúp cấu trúc import/công cụ rõ ràng; giữ, tiết kiệm gần như không đáng kể nếu bỏ. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/app/schemas/annotation.py` | 1.8 KiB | **LEGACY CÒN NỐI** | Định dạng task và annotation của hệ thống audio cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `backend/app/schemas/audio.py` | 2.2 KiB | **LEGACY CÒN NỐI** | Định dạng audio, danh sách annotator, sync và prelabel cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `backend/app/schemas/auth.py` | 1.1 KiB | **GIỮ** | Định dạng request/response cho đăng ký, đăng nhập và tài khoản hiện tại. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/app/schemas/project.py` | 4.0 KiB | **LEGACY CÒN NỐI** | Định dạng dự án, thành viên, tiến độ và báo cáo cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `backend/app/schemas/report.py` | 1017 B | **LEGACY CÒN NỐI** | Định dạng yêu cầu/bản ghi báo cáo vấn đề cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `backend/app/schemas/review.py` | 4.0 KiB | **LEGACY CÒN NỐI** | Định dạng hàng đợi duyệt audio, nhãn, điểm và cờ tài khoản cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `backend/app/schemas/roleplay.py` | 4.5 KiB | **LEGACY CÒN NỐI** | Định dạng cấu hình agent, scenario, test case và phiên role-play cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `backend/app/schemas/wallet.py` | 2.1 KiB | **LEGACY CÒN NỐI** | Định dạng hồ sơ ví, số dư, yêu cầu rút và hành động xử lý cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |

### backend/app/services

| File | Dung lượng | Mức cần thiết | Công dụng / khuyến nghị |
| --- | ---: | --- | --- |
| `backend/app/services/__init__.py` | 0 B | **GIỮ** | Đánh dấu package Python. Có thể rỗng nhưng giúp cấu trúc import/công cụ rõ ràng; giữ, tiết kiệm gần như không đáng kể nếu bỏ. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/app/services/account_recovery.py` | 2.8 KiB | **GIỮ** | Phát hành và tiêu thụ link khôi phục tài khoản một lần, có hỗ trợ vận hành. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/app/services/allocation_service.py` | 28.6 KiB | **LEGACY CÒN NỐI** | Phân bổ task annotation, redundancy và kiểm chất lượng của hệ thống cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `backend/app/services/audio_service.py` | 13.1 KiB | **LEGACY CÒN NỐI** | Nghiệp vụ quản lý dữ liệu audio/task cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `backend/app/services/auth_service.py` | 2.7 KiB | **GIỮ** | Nghiệp vụ tài khoản và xác thực. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/app/services/blaze_translation.py` | 4.3 KiB | **GIỮ** | Adapter gọi mô hình dịch Blaze trong thí nghiệm dịch. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/app/services/collection_consent.py` | 2.2 KiB | **GIỮ** | Kiểm consent và khoá contribution dùng chung cho ghi dữ liệu/duyệt; bảo vệ tính nhất quán. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/app/services/contribution_quality.py` | 2.1 KiB | **GIỮ** | Trả mã khuyến nghị giữ lại để kiểm tra chất lượng, không sửa RAW. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/app/services/curation.py` | 1.5 KiB | **GIỮ** | Chuẩn hoá và xác thực lớp dữ liệu chỉnh lý do người duyệt cung cấp. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/app/services/dataset_candidate_import.py` | 5.4 KiB | **GIỮ** | Lập kế hoạch và nhập ứng viên dataset có thông tin nguồn; không tự duyệt ngôn ngữ. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/app/services/dataset_package.py` | 7.0 KiB | **GIỮ** | Đóng gói và kiểm checksum/nhóm chống rò rỉ cho dataset tải xuống. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/app/services/dataset_release.py` | 9.7 KiB | **GIỮ** | Chính sách release phía server: điều kiện duyệt, consent, phân nhóm và kiểm tải lại. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/app/services/game_original.py` | 3.6 KiB | **GIỮ** | Khôi phục nội dung phương ngữ gốc từ snapshot/cấu trúc prompt cũ. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/app/services/game_state.py` | 27.4 KiB | **GIỮ** | Luật game phía server, bootstrap catalog, phiên bản, snapshot và xử lý lệnh. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/app/services/pilot_assessment.py` | 3.7 KiB | **GIỮ** | Tổng hợp quan sát vận hành phục vụ đánh giá pilot. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/app/services/player_content.py` | 1.1 KiB | **GIỮ** | Áp chính sách phân bổ câu hỏi công khai, giữ nguyên dữ liệu nguồn và phiên cũ. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/app/services/prelabel_parser.py` | 6.0 KiB | **LEGACY CÒN NỐI** | Đọc nhãn/câu hỏi CSV, JSONL, XLSX cho pipeline audio cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `backend/app/services/project_service.py` | 10.4 KiB | **LEGACY CÒN NỐI** | Nghiệp vụ dự án, thành viên và thống kê hệ thống cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `backend/app/services/report_service.py` | 5.8 KiB | **LEGACY CÒN NỐI** | Nghiệp vụ báo cáo vấn đề của annotator cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `backend/app/services/review_binding.py` | 3.6 KiB | **GIỮ** | Gắn phiếu duyệt với đúng phiên bản nội dung, lưu lịch sử bất biến và chống duyệt bản cũ. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/app/services/review_service.py` | 22.9 KiB | **LEGACY CÒN NỐI** | Duyệt annotation, tính điểm và tự gắn cờ tài khoản trong hệ thống cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `backend/app/services/roleplay_service.py` | 20.5 KiB | **LEGACY CÒN NỐI** | Nghiệp vụ scenario, task và giao tiếp agent role-play cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `backend/app/services/roleplay_ws_proxy.py` | 9.6 KiB | **LEGACY CÒN NỐI** | Proxy WebSocket audio giữa trình duyệt và agent, ghép WAV phiên hội thoại cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `backend/app/services/runtime_metrics.py` | 1.0 KiB | **GIỮ** | Thống kê HTTP giới hạn trong bộ nhớ tiến trình, tránh lưu định danh/payload. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/app/services/staff_access.py` | 1.7 KiB | **GIỮ** | Tách quyền thao tác vận hành khỏi role Reviewer, bảo vệ người vận hành còn hiệu lực. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/app/services/translation_evaluation.py` | 13.9 KiB | **GIỮ** | Chuẩn bị và chấm thí nghiệm so sánh bản dịch; không train mô hình. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/app/services/translation_permissions.py` | 2.2 KiB | **GIỮ** | Kiểm lại quyền release và dữ liệu gửi trước mỗi lần gọi dịch thật. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/app/services/wallet_service.py` | 8.9 KiB | **LEGACY CÒN NỐI** | Nghiệp vụ hồ sơ ví, số dư và yêu cầu rút tiền legacy. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `backend/app/services/workspace_queries.py` | 5.9 KiB | **GIỮ** | Phân trang/cursor và thống kê phía server để workspace không tải dữ liệu vô hạn. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |

### backend/migrations

| File | Dung lượng | Mức cần thiết | Công dụng / khuyến nghị |
| --- | ---: | --- | --- |
| `backend/migrations/env.py` | 882 B | **GIỮ** | Môi trường chạy migration Alembic, kết nối metadata và database. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/migrations/script.py.mako` | 329 B | **GIỮ** | Template để tạo migration mới; không phải file rác dù không phải Python thông thường. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |

### backend/migrations/versions

| File | Dung lượng | Mức cần thiết | Công dụng / khuyến nghị |
| --- | ---: | --- | --- |
| `backend/migrations/versions/0001_baseline.py` | 16.7 KiB | **GIỮ** | Mốc schema nền; migration sau dựa trên chuỗi lịch sử này. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/migrations/versions/0002_security.py` | 1.5 KiB | **GIỮ** | Bổ sung schema bảo mật. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/migrations/versions/0003_game_receipts.py` | 889 B | **GIỮ** | Bổ sung schema receipt/phân bổ game. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/migrations/versions/0004_server_games.py` | 2.2 KiB | **GIỮ** | Bổ sung tài nguyên, phiên và lệnh game phía server. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `backend/migrations/versions/0005_review_archives.py` | 968 B | **GIỮ** | Bổ sung kho lịch sử các phiên bản duyệt. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |

### backend/scripts

| File | Dung lượng | Mức cần thiết | Công dụng / khuyến nghị |
| --- | ---: | --- | --- |
| `backend/scripts/__init__.py` | 0 B | **PHÁT TRIỂN/VẬN HÀNH** | Đánh dấu package Python. Có thể rỗng nhưng giúp cấu trúc import/công cụ rõ ràng; giữ, tiết kiệm gần như không đáng kể nếu bỏ. **Xử lý:** Nên giữ khi còn phát triển/phát hành; không nhất thiết cần trong runtime. |
| `backend/scripts/account_recovery.py` | 2.0 KiB | **PHÁT TRIỂN/VẬN HÀNH** | CLI cấp link reset sau bước xác minh danh tính bên ngoài. **Xử lý:** Nên giữ khi còn phát triển/phát hành; không nhất thiết cần trong runtime. |
| `backend/scripts/check_deployment.py` | 4.2 KiB | **PHÁT TRIỂN/VẬN HÀNH** | Kiểm cấu hình Compose ở chế độ chỉ đọc, không deploy và không in secrets. **Xử lý:** Nên giữ khi còn phát triển/phát hành; không nhất thiết cần trong runtime. |
| `backend/scripts/create_admin.py` | 1.5 KiB | **PHÁT TRIỂN/VẬN HÀNH** | CLI tạo/chỉ định người vận hành Reviewer; tên file giữ tương thích tên cũ. **Xử lý:** Nên giữ khi còn phát triển/phát hành; không nhất thiết cần trong runtime. |
| `backend/scripts/db_backup.py` | 393 B | **PHÁT TRIỂN/VẬN HÀNH** | CLI tạo snapshot SQLite nhất quán, bao gồm xử lý giao dịch WAL qua API SQLite. **Xử lý:** Nên giữ khi còn phát triển/phát hành; không nhất thiết cần trong runtime. |
| `backend/scripts/db_migrate.py` | 4.2 KiB | **PHÁT TRIỂN/VẬN HÀNH** | CLI init/adopt/upgrade schema rõ ràng; không tự ghi đè DB nguồn. **Xử lý:** Nên giữ khi còn phát triển/phát hành; không nhất thiết cần trong runtime. |
| `backend/scripts/db_restore.py` | 155 B | **PHÁT TRIỂN/VẬN HÀNH** | CLI restore backup vào đường dẫn mới. **Xử lý:** Nên giữ khi còn phát triển/phát hành; không nhất thiết cần trong runtime. |
| `backend/scripts/db_sqlite.py` | 1.6 KiB | **PHÁT TRIỂN/VẬN HÀNH** | Hàm dùng chung cho kiểm DB, snapshot, restore và adopt. **Xử lý:** Nên giữ khi còn phát triển/phát hành; không nhất thiết cần trong runtime. |
| `backend/scripts/evaluate_translation.py` | 3.2 KiB | **PHÁT TRIỂN/VẬN HÀNH** | CLI chuẩn bị/chạy/so sánh thí nghiệm dịch. **Xử lý:** Nên giữ khi còn phát triển/phát hành; không nhất thiết cần trong runtime. |
| `backend/scripts/import_dataset_candidates.py` | 1.8 KiB | **PHÁT TRIỂN/VẬN HÀNH** | CLI xem trước/nhập ứng viên nguồn, có backup DB bắt buộc. **Xử lý:** Nên giữ khi còn phát triển/phát hành; không nhất thiết cần trong runtime. |
| `backend/scripts/merge_reviewer_roles.py` | 1.7 KiB | **PHÁT TRIỂN/VẬN HÀNH** | CLI chuyển đổi role một lần, giữ tài khoản và dữ liệu; chỉ bỏ sau khi mọi DB đích đã được xử lý và không cần tương thích nữa. **Xử lý:** Nên giữ khi còn phát triển/phát hành; không nhất thiết cần trong runtime. |
| `backend/scripts/serve.py` | 1.1 KiB | **PHÁT TRIỂN/VẬN HÀNH** | Điểm khởi động Uvicorn với ranh giới TLS/proxy và log an toàn; Docker và local cần. **Xử lý:** Nên giữ khi còn phát triển/phát hành; không nhất thiết cần trong runtime. |
| `backend/scripts/verify_dataset.py` | 860 B | **PHÁT TRIỂN/VẬN HÀNH** | CLI kiểm dataset đã tải mà không kết nối DB ứng dụng. **Xử lý:** Nên giữ khi còn phát triển/phát hành; không nhất thiết cần trong runtime. |

### deploy

| File | Dung lượng | Mức cần thiết | Công dụng / khuyến nghị |
| --- | ---: | --- | --- |
| `deploy/README.md` | 6.3 KiB | **PHÁT TRIỂN/VẬN HÀNH** | Hướng dẫn triển khai, HTTPS, chuyển DB, backup và nghiệm thu thủ công; CI hiện build image, không chạy smoke test container. |
| `deploy/blaze.nginx.conf` | 745 B | **PHÁT TRIỂN/VẬN HÀNH** | Mẫu reverse proxy Nginx phía trước API/frontend chung cổng. **Xử lý:** Nên giữ khi còn phát triển/phát hành; không nhất thiết cần trong runtime. |

### designs/blaze-collection

| File | Dung lượng | Mức cần thiết | Công dụng / khuyến nghị |
| --- | ---: | --- | --- |
| `designs/blaze-collection/.artifact-server.json` | 240 B | **TÁI TẠO** | Trạng thái chạy server preview thiết kế local; có thể tái tạo khi mở lại editor. **Xử lý:** Có thể dọn khi công cụ đang dùng đã dừng; lần mở sau sẽ tái tạo. |
| `designs/blaze-collection/.artifact-server.log` | 2.4 KiB | **TÁI TẠO** | Log của preview/editor thiết kế local; có thể tạo lại, dừng editor trước khi dọn. **Xử lý:** Có thể dọn khi công cụ đang dùng đã dừng; lần mở sau sẽ tái tạo. |
| `designs/blaze-collection/.gitignore` | 198 B | **TUỲ CHỌN** | Bỏ qua trạng thái server/lịch sử local của công cụ thiết kế. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |

### designs/blaze-collection/history

| File | Dung lượng | Mức cần thiết | Công dụng / khuyến nghị |
| --- | ---: | --- | --- |
| `designs/blaze-collection/history/index.json` | 4.0 KiB | **TUỲ CHỌN** | Snapshot/index lịch sử thiết kế local. Không thuộc web runtime; bỏ sẽ mất lịch sử/khả năng phục hồi trong editor. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |

### designs/blaze-collection/history/objects

| File | Dung lượng | Mức cần thiết | Công dụng / khuyến nghị |
| --- | ---: | --- | --- |
| `designs/blaze-collection/history/objects/018a08b7c7b59c18124a1b431228461cb970e4300968965391a33a996768a6c7` | 2.9 KiB | **TUỲ CHỌN** | Snapshot/index lịch sử thiết kế local. Không thuộc web runtime; bỏ sẽ mất lịch sử/khả năng phục hồi trong editor. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/history/objects/0f3193c4ca53e0c1d3b083295acf6a2c6749834639e248232b61519592d38625` | 5.2 KiB | **TUỲ CHỌN** | Snapshot/index lịch sử thiết kế local. Không thuộc web runtime; bỏ sẽ mất lịch sử/khả năng phục hồi trong editor. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/history/objects/1de1a63ae8b4a6a7006ee40c5d6d4d82d442092ccac54d1d053f6a9c045afb09` | 6.3 KiB | **TUỲ CHỌN** | Snapshot/index lịch sử thiết kế local. Không thuộc web runtime; bỏ sẽ mất lịch sử/khả năng phục hồi trong editor. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/history/objects/1ea5f52a08cca22b29b208f2854ae853befc8fa91c9cf29dc95033ba98e9affe` | 10.2 KiB | **TUỲ CHỌN** | Snapshot/index lịch sử thiết kế local. Không thuộc web runtime; bỏ sẽ mất lịch sử/khả năng phục hồi trong editor. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/history/objects/220f12055d598b8001bde31e7895a11bd33332cdd477d772c4fdc3e7f2ab7703` | 10.4 KiB | **TUỲ CHỌN** | Snapshot/index lịch sử thiết kế local. Không thuộc web runtime; bỏ sẽ mất lịch sử/khả năng phục hồi trong editor. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/history/objects/272aac781bb37fead9f8a0744afe17bc0fd37833ef5506ebf5d499120bef8f88` | 1.7 KiB | **TUỲ CHỌN** | Snapshot/index lịch sử thiết kế local. Không thuộc web runtime; bỏ sẽ mất lịch sử/khả năng phục hồi trong editor. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/history/objects/2c4ae2e0aaea0d83ce99f8197570223fd5d79b29fe14065b66daa28d2a29a20e` | 496 B | **TUỲ CHỌN** | Snapshot/index lịch sử thiết kế local. Không thuộc web runtime; bỏ sẽ mất lịch sử/khả năng phục hồi trong editor. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/history/objects/2d48fce7b5518d7ce09b17ac732741b304321af425d7643ac95b266b48bb702c` | 8.1 KiB | **TUỲ CHỌN** | Snapshot/index lịch sử thiết kế local. Không thuộc web runtime; bỏ sẽ mất lịch sử/khả năng phục hồi trong editor. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/history/objects/37ea83112da0d577e6f8faf8d6897ecf931fc4b80dbe9cb1023dabcc9ad4346d` | 379 B | **TUỲ CHỌN** | Snapshot/index lịch sử thiết kế local. Không thuộc web runtime; bỏ sẽ mất lịch sử/khả năng phục hồi trong editor. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/history/objects/3ba4c593a932333013fe36ef281f7c463fa7ec19f96b6c420aad7a417dea37d6` | 5.1 KiB | **TUỲ CHỌN** | Snapshot/index lịch sử thiết kế local. Không thuộc web runtime; bỏ sẽ mất lịch sử/khả năng phục hồi trong editor. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/history/objects/3e836452b98d6f3f017048d8476b6e38d7f447117e028b18316ea0f26aedcd4f` | 9.2 KiB | **TUỲ CHỌN** | Snapshot/index lịch sử thiết kế local. Không thuộc web runtime; bỏ sẽ mất lịch sử/khả năng phục hồi trong editor. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/history/objects/44563750a0ed2fdf6d5ca1b5ae72b27292e4ba7a287f79f45cfb5575380035ef` | 10.2 KiB | **TUỲ CHỌN** | Snapshot/index lịch sử thiết kế local. Không thuộc web runtime; bỏ sẽ mất lịch sử/khả năng phục hồi trong editor. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/history/objects/4a5233882ae1a25440c97ba3e5fe0625672bb128bef9114d62e0420eb69b5df0` | 1.5 KiB | **TUỲ CHỌN** | Snapshot/index lịch sử thiết kế local. Không thuộc web runtime; bỏ sẽ mất lịch sử/khả năng phục hồi trong editor. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/history/objects/54497ed3856cc97dbf5a88d37c196fc66a7bcd365d48f14d8db47e46d91f59f2` | 2.8 KiB | **TUỲ CHỌN** | Snapshot/index lịch sử thiết kế local. Không thuộc web runtime; bỏ sẽ mất lịch sử/khả năng phục hồi trong editor. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/history/objects/68d91551852af978375efa7d3708554136fcf6df1afcd0a007302e36b77835da` | 5.3 KiB | **TUỲ CHỌN** | Snapshot/index lịch sử thiết kế local. Không thuộc web runtime; bỏ sẽ mất lịch sử/khả năng phục hồi trong editor. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/history/objects/7dcf689746d2e33591d35d963254b29e0d51921e3fda4b4a74f9115c7839a42a` | 6.8 KiB | **TUỲ CHỌN** | Snapshot/index lịch sử thiết kế local. Không thuộc web runtime; bỏ sẽ mất lịch sử/khả năng phục hồi trong editor. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/history/objects/7f5e02f19935673f4f523ab60f195b3769d88e04c59061aab7d91c226c835a16` | 6.8 KiB | **TUỲ CHỌN** | Snapshot/index lịch sử thiết kế local. Không thuộc web runtime; bỏ sẽ mất lịch sử/khả năng phục hồi trong editor. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/history/objects/8c067916dca432a7d3414727b73db6e9061e528841892e9e0e39d07710fb2ae7` | 9.0 KiB | **TUỲ CHỌN** | Snapshot/index lịch sử thiết kế local. Không thuộc web runtime; bỏ sẽ mất lịch sử/khả năng phục hồi trong editor. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/history/objects/942d5647f062cba7f02ebdddd7ec0188486cad29c8067ef6f5fff3a3f232652c` | 8.1 KiB | **TUỲ CHỌN** | Snapshot/index lịch sử thiết kế local. Không thuộc web runtime; bỏ sẽ mất lịch sử/khả năng phục hồi trong editor. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/history/objects/96bff5fc87cf15c7c73ebdc176183d9bb98600e6f78976a73eaa49d586476000` | 9.1 KiB | **TUỲ CHỌN** | Snapshot/index lịch sử thiết kế local. Không thuộc web runtime; bỏ sẽ mất lịch sử/khả năng phục hồi trong editor. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/history/objects/9ae83e65ff8a12f0a4564bcd3c2f89c988211d002f59ee00852af192d487d55f` | 4.1 KiB | **TUỲ CHỌN** | Snapshot/index lịch sử thiết kế local. Không thuộc web runtime; bỏ sẽ mất lịch sử/khả năng phục hồi trong editor. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/history/objects/cdff72ef03f6f44b99b579dcca2119a8961ad8504c132c9b2277644149193a99` | 10.4 KiB | **TUỲ CHỌN** | Snapshot/index lịch sử thiết kế local. Không thuộc web runtime; bỏ sẽ mất lịch sử/khả năng phục hồi trong editor. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/history/objects/d10a009083319b01d9377488eab5479b724d55190c47c4696afb145559857a68` | 9.0 KiB | **TUỲ CHỌN** | Snapshot/index lịch sử thiết kế local. Không thuộc web runtime; bỏ sẽ mất lịch sử/khả năng phục hồi trong editor. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/history/objects/d734eace64dc91cbd4babf9c8ac3051bc3d339cea49a14b7f4b38fa6acb0a747` | 10.4 KiB | **TUỲ CHỌN** | Snapshot/index lịch sử thiết kế local. Không thuộc web runtime; bỏ sẽ mất lịch sử/khả năng phục hồi trong editor. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/history/objects/dcc0b6b16c73695c4361d55dfb410cbc678909a1f23195e5b61ff97ffe4edb2a` | 9.1 KiB | **TUỲ CHỌN** | Snapshot/index lịch sử thiết kế local. Không thuộc web runtime; bỏ sẽ mất lịch sử/khả năng phục hồi trong editor. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/history/objects/df81003bfc03c9f5b55e1b50878a8c042efaa76a7512184f3e85e7caf259752b` | 9.2 KiB | **TUỲ CHỌN** | Snapshot/index lịch sử thiết kế local. Không thuộc web runtime; bỏ sẽ mất lịch sử/khả năng phục hồi trong editor. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/history/objects/e6db4f2cbf7fc7c414f148fbea43aeb585aaaa5c9f88e8d735614fcf349eda72` | 10.4 KiB | **TUỲ CHỌN** | Snapshot/index lịch sử thiết kế local. Không thuộc web runtime; bỏ sẽ mất lịch sử/khả năng phục hồi trong editor. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/history/objects/ec330fcc099f848f71046e1dd3b3351bb6d267b556efc950791f9558e4b78550` | 5.2 KiB | **TUỲ CHỌN** | Snapshot/index lịch sử thiết kế local. Không thuộc web runtime; bỏ sẽ mất lịch sử/khả năng phục hồi trong editor. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/history/objects/f78c4fa85eed17c34b02c8594fda3863c2a0d34bcac68e224fd75334d0079245` | 9.2 KiB | **TUỲ CHỌN** | Snapshot/index lịch sử thiết kế local. Không thuộc web runtime; bỏ sẽ mất lịch sử/khả năng phục hồi trong editor. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/history/objects/f99a3b63c9a5c391bd7ece9ec94f53858dcb05ae26397e5327417fed047c1b1b` | 5.0 KiB | **TUỲ CHỌN** | Snapshot/index lịch sử thiết kế local. Không thuộc web runtime; bỏ sẽ mất lịch sử/khả năng phục hồi trong editor. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/history/objects/fed60ecad6df14f2edc4d6f12e897860d7371719c06a44653cb681b25364a38e` | 1.1 KiB | **TUỲ CHỌN** | Snapshot/index lịch sử thiết kế local. Không thuộc web runtime; bỏ sẽ mất lịch sử/khả năng phục hồi trong editor. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |

### designs/blaze-collection/project

| File | Dung lượng | Mức cần thiết | Công dụng / khuyến nghị |
| --- | ---: | --- | --- |
| `designs/blaze-collection/project/Contribution.dc.html` | 9.0 KiB | **TUỲ CHỌN** | Artboard thiết kế màn góp dữ liệu; là bản thiết kế tham chiếu, không phải component React đang chạy. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/project/Game.dc.html` | 10.3 KiB | **TUỲ CHỌN** | Artboard thiết kế màn chơi game; là bản thiết kế tham chiếu, không phải component React đang chạy. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/project/GameAdmin.dc.html` | 10.4 KiB | **TUỲ CHỌN** | Artboard thiết kế màn quản lý game; là bản thiết kế tham chiếu, không phải component React đang chạy. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/project/Landing.dc.html` | 9.2 KiB | **TUỲ CHỌN** | Artboard thiết kế màn landing; là bản thiết kế tham chiếu, không phải component React đang chạy. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/project/Login.dc.html` | 6.7 KiB | **TUỲ CHỌN** | Artboard thiết kế màn đăng nhập; là bản thiết kế tham chiếu, không phải component React đang chạy. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/project/Main.dc.html` | 9.1 KiB | **TUỲ CHỌN** | Artboard thiết kế màn bố cục chính; là bản thiết kế tham chiếu, không phải component React đang chạy. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/project/Release.dc.html` | 8.1 KiB | **TUỲ CHỌN** | Artboard thiết kế màn xuất dataset; là bản thiết kế tham chiếu, không phải component React đang chạy. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/project/Review.dc.html` | 10.2 KiB | **TUỲ CHỌN** | Artboard thiết kế màn duyệt dữ liệu; là bản thiết kế tham chiếu, không phải component React đang chạy. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/project/canvas.json` | 1.7 KiB | **TUỲ CHỌN** | Manifest bố cục canvas và danh sách artboard editable; cần nếu muốn mở/sửa project thiết kế. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |

### designs/blaze-collection/project/assets

| File | Dung lượng | Mức cần thiết | Công dụng / khuyến nghị |
| --- | ---: | --- | --- |
| `designs/blaze-collection/project/assets/143f9504f1377012aa3e39c90c4354ef.woff2` | 35.4 KiB | **TUỲ CHỌN** | File font nhị phân phục vụ artboard thiết kế; tên hash không có nghĩa là file rác. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/project/assets/1aeb94ae9db052a4a2fe6f3046f928cf.woff2` | 5.0 KiB | **TUỲ CHỌN** | File font nhị phân phục vụ artboard thiết kế; tên hash không có nghĩa là file rác. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/project/assets/2c6fbc42d315528beb06c1096df45487.woff2` | 35.2 KiB | **TUỲ CHỌN** | File font nhị phân phục vụ artboard thiết kế; tên hash không có nghĩa là file rác. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/project/assets/44e36aa5a8f12130029a29bb0e6695d0.woff2` | 5.0 KiB | **TUỲ CHỌN** | File font nhị phân phục vụ artboard thiết kế; tên hash không có nghĩa là file rác. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/project/assets/547ad9fdaeb0ae43487f4b8a02e47c36.woff2` | 4.9 KiB | **TUỲ CHỌN** | File font nhị phân phục vụ artboard thiết kế; tên hash không có nghĩa là file rác. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/project/assets/5fafa3829a16d9ea5ac3a67c51e54186.woff2` | 5.0 KiB | **TUỲ CHỌN** | File font nhị phân phục vụ artboard thiết kế; tên hash không có nghĩa là file rác. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/project/assets/6744a7f509ebc6ab220a6cd4ea77e898.woff2` | 34.2 KiB | **TUỲ CHỌN** | File font nhị phân phục vụ artboard thiết kế; tên hash không có nghĩa là file rác. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/project/assets/6f56409fd3d64bb85f7d070bce20749d.woff2` | 23.8 KiB | **TUỲ CHỌN** | File font nhị phân phục vụ artboard thiết kế; tên hash không có nghĩa là file rác. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/project/assets/8909904ab6c872eb994093482a88a28e.woff2` | 23.1 KiB | **TUỲ CHỌN** | File font nhị phân phục vụ artboard thiết kế; tên hash không có nghĩa là file rác. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/project/assets/a221a07fe1d9f65f4615737441fded38.png` | 3.5 KiB | **TUỲ CHỌN** | Hình nhị phân phục vụ artboard thiết kế; không phải logo runtime frontend/public. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/project/assets/e4bdf67b0cd15ca9e184509275be95db.woff2` | 35.4 KiB | **TUỲ CHỌN** | File font nhị phân phục vụ artboard thiết kế; tên hash không có nghĩa là file rác. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/project/assets/f3779f1efccc4bdcdf9c0a02ab95bf6b.woff2` | 23.7 KiB | **TUỲ CHỌN** | File font nhị phân phục vụ artboard thiết kế; tên hash không có nghĩa là file rác. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/project/assets/f9a06e79cd3a2a20951c0f0e28f66dd0.woff2` | 23.9 KiB | **TUỲ CHỌN** | File font nhị phân phục vụ artboard thiết kế; tên hash không có nghĩa là file rác. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `designs/blaze-collection/project/assets/index.json` | 678 B | **TUỲ CHỌN** | Index tài nguyên dùng bởi canvas/artboard, giữ cùng assets nếu còn chỉnh thiết kế. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |

### docs

| File | Dung lượng | Mức cần thiết | Công dụng / khuyến nghị |
| --- | ---: | --- | --- |
| `docs/API.md` | 2.4 KiB | **PHÁT TRIỂN/VẬN HÀNH** | Bản đồ endpoint hiện tại. **Xử lý:** Nên giữ khi còn phát triển/phát hành; không nhất thiết cần trong runtime. |
| `docs/ARCHITECTURE.md` | 4.0 KiB | **PHÁT TRIỂN/VẬN HÀNH** | Kiến trúc hiện tại; đã cập nhật cấu trúc sau khi bỏ tests/fixtures/simulator. |
| `docs/DESIGN.md` | 41.4 KiB | **PHÁT TRIỂN/VẬN HÀNH** | Tài liệu thiết kế tham chiếu; đối chiếu UI/CSS hiện tại khi phát triển. **Xử lý:** Nên giữ khi còn phát triển/phát hành; không nhất thiết cần trong runtime. |
| `docs/DEVELOPMENT.md` | 2.8 KiB | **PHÁT TRIỂN/VẬN HÀNH** | Chạy local, lint/build, migration và backup; đã bỏ các lệnh test và script QA không còn tồn tại. |
| `docs/PLAYER_CONTENT_POLICY.md` | 3.1 KiB | **PHÁT TRIỂN/VẬN HÀNH** | Chính sách nội dung và cách bảo trì hai JSON; đã đổi ghi chú kiểm thử tự động sang đối chiếu thủ công. |
| `docs/README.md` | 888 B | **PHÁT TRIỂN/VẬN HÀNH** | Mục lục tài liệu hiện hành và phân biệt tài liệu lịch sử. **Xử lý:** Nên giữ khi còn phát triển/phát hành; không nhất thiết cần trong runtime. |

### docs/legacy

| File | Dung lượng | Mức cần thiết | Công dụng / khuyến nghị |
| --- | ---: | --- | --- |
| `docs/legacy/API.md` | 7.7 KiB | **TUỲ CHỌN** | Tài liệu API của hệ thống cũ. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `docs/legacy/ARCHITECTURE.md` | 17.4 KiB | **TUỲ CHỌN** | Kiến trúc hệ thống cũ để tra cứu. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `docs/legacy/DEVELOPMENT.md` | 7.1 KiB | **TUỲ CHỌN** | Hướng dẫn phát triển cũ, chỉ có giá trị lịch sử. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `docs/legacy/DIALECT_IMPLEMENTATION.md` | 3.2 KiB | **TUỲ CHỌN** | Ghi chép triển khai phương ngữ của giai đoạn trước. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `docs/legacy/README.md` | 630 B | **TUỲ CHỌN** | Giải thích phạm vi tài liệu lịch sử; không dùng lệnh cũ làm hướng dẫn vận hành hiện tại. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `docs/legacy/concerns.md` | 779 B | **TUỲ CHỌN** | Ghi chép vấn đề và rủi ro của giai đoạn trước. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |

### frontend

| File | Dung lượng | Mức cần thiết | Công dụng / khuyến nghị |
| --- | ---: | --- | --- |
| `frontend/.env` | 24 B | **DỮ LIỆU/CẤU HÌNH** | Cấu hình local của Vite; xoá có thể đổi API/đồng bộ/cờ tính năng. Không đọc giá trị trong lần kiểm kê này. **Xử lý:** Giữ hoặc backup/xác nhận khả năng phục hồi trước khi xử lý; không coi là cache. |
| `frontend/.env.example` | 230 B | **GIỮ** | Mẫu cấu hình API và cờ tính năng frontend. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/.gitignore` | 277 B | **GIỮ** | Quy tắc bỏ qua file local riêng của frontend; phối hợp với .gitignore gốc. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/README.md` | 932 B | **PHÁT TRIỂN/VẬN HÀNH** | Hướng dẫn frontend hiện tại: npm ci/dev/lint/build; không còn lệnh npm test. |
| `frontend/eslint.config.js` | 613 B | **PHÁT TRIỂN/VẬN HÀNH** | Quy tắc kiểm tra chất lượng TypeScript/React khi lint và CI. **Xử lý:** Nên giữ khi còn phát triển/phát hành; không nhất thiết cần trong runtime. |
| `frontend/index.html` | 536 B | **GIỮ** | Trang HTML gốc chứa điểm gắn React. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/package-lock.json` | 140.0 KiB | **GIỮ** | Lockfile npm đã đồng bộ sau khi bỏ dependency kiểm thử; giữ để npm ci và Docker build tái lập dependency. |
| `frontend/package.json` | 1.1 KiB | **GIỮ** | Dependency ứng dụng và lệnh dev/build/lint/preview. Đã bỏ script test và sáu dependency trực tiếp chỉ dành cho kiểm thử. |
| `frontend/tsconfig.app.json` | 642 B | **GIỮ** | Cấu hình biên dịch/typecheck mã src, được npm run build sử dụng. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/tsconfig.json` | 126 B | **GIỮ** | Cấu hình TypeScript gốc liên kết các project con. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/tsconfig.node.json` | 615 B | **GIỮ** | Cấu hình TypeScript cho công cụ Vite và môi trường Node. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/vite.config.ts` | 840 B | **GIỮ** | Cấu hình Vite, proxy, cache và build. emptyOutDir:false chủ ý giữ chunk cũ cho tab đang mở. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |

### frontend/public/brand

| File | Dung lượng | Mức cần thiết | Công dụng / khuyến nghị |
| --- | ---: | --- | --- |
| `frontend/public/brand/INTER_LICENSE.txt` | 4.4 KiB | **GIỮ** | Giấy phép font Inter; giữ để bảo toàn thông tin giấy phép tài nguyên được phân phối. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/public/brand/blaze-logo.png` | 3.5 KiB | **GIỮ** | Logo đang được Brand, AuthShell và Layout dùng bằng đường dẫn /brand/blaze-logo.png. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |

### frontend/scripts

| File | Dung lượng | Mức cần thiết | Công dụng / khuyến nghị |
| --- | ---: | --- | --- |
| `frontend/scripts/build-dataset1-bank.py` | 7.5 KiB | **PHÁT TRIỂN/VẬN HÀNH** | Sinh dataset1Bank.ts từ XLSX Dataset1. Cần bản XLSX nguồn để tái tạo đúng dữ liệu, không được coi output là cache tuỳ ý. **Xử lý:** Nên giữ khi còn phát triển/phát hành; không nhất thiết cần trong runtime. |

### frontend/src

| File | Dung lượng | Mức cần thiết | Công dụng / khuyến nghị |
| --- | ---: | --- | --- |
| `frontend/src/main.tsx` | 1.1 KiB | **GIỮ** | Khởi động React, nạp font/CSS, router và hộp xác nhận chung. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/router.tsx` | 5.4 KiB | **GIỮ** | Bản đồ URL chính; kết nối auth, dialect, demo và import động legacy. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |

### frontend/src/api

| File | Dung lượng | Mức cần thiết | Công dụng / khuyến nghị |
| --- | ---: | --- | --- |
| `frontend/src/api/annotate.ts` | 2.0 KiB | **LEGACY CÒN NỐI** | Client lấy/gửi task gán nhãn cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/api/audios.ts` | 4.6 KiB | **LEGACY CÒN NỐI** | Client upload/sync/quản lý audio và prelabel cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/api/auth.ts` | 1.3 KiB | **GIỮ** | Gọi API xác thực và cập nhật tài khoản hiện tại. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/api/client.ts` | 2.3 KiB | **GIỮ** | Axios client dùng chung, cấu hình /api, cookie, thông báo lỗi và hết phiên. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/api/projects.ts` | 2.3 KiB | **LEGACY CÒN NỐI** | Client dự án, thành viên và báo cáo cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/api/reports.ts` | 1.0 KiB | **LEGACY CÒN NỐI** | Client báo vấn đề và xử lý report cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/api/review.ts` | 2.7 KiB | **LEGACY CÒN NỐI** | Client duyệt annotation, thống kê điểm và cờ tài khoản cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/api/roleplay.ts` | 7.3 KiB | **LEGACY CÒN NỐI** | Client scenario/test case/phiên role-play cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/api/users.ts` | 287 B | **LEGACY CÒN NỐI** | Client lấy danh sách người dùng cho phân công dự án cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/api/wallet.ts` | 1.9 KiB | **LEGACY CÒN NỐI** | Client ví, hồ sơ và yêu cầu rút tiền cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |

### frontend/src/components

| File | Dung lượng | Mức cần thiết | Công dụng / khuyến nghị |
| --- | ---: | --- | --- |
| `frontend/src/components/AdminRoute.tsx` | 582 B | **GIỮ** | Chặn route yêu cầu quyền vận hành; không thay thế phân quyền backend. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/components/ApplicationError.tsx` | 1.1 KiB | **GIỮ** | Màn hình lỗi ứng dụng chung cho lỗi route/render. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/components/Brand.tsx` | 329 B | **GIỮ** | Logo và tên thương hiệu dùng chung. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/components/ConfirmProvider.tsx` | 2.6 KiB | **GIỮ** | Quản lý hộp xác nhận bất đồng bộ dùng chung. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/components/DataCardView.tsx` | 1.9 KiB | **GIỮ** | Hiển thị data card/phạm vi sử dụng dataset trên màn preview/release hiện tại. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/components/Layout.tsx` | 5.8 KiB | **GIỮ** | Khung điều hướng cho các trang dialect và tương thích cũ ngoài /demo. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/components/ProtectedRoute.tsx` | 1.2 KiB | **GIỮ** | Yêu cầu đăng nhập và giữ URL quay lại. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/components/ResponsiveTable.tsx` | 1.6 KiB | **GIỮ** | Bảng thích ứng kích thước màn hình dùng chung. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/components/ReviewerRoute.tsx` | 331 B | **GIỮ** | Chặn route theo vai trò Reviewer/admin. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/components/useConfirm.ts` | 635 B | **GIỮ** | Context, kiểu dữ liệu và hook gọi hộp xác nhận. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |

### frontend/src/features/admin

| File | Dung lượng | Mức cần thiết | Công dụng / khuyến nghị |
| --- | ---: | --- | --- |
| `frontend/src/features/admin/FlaggedUsersPage.tsx` | 5.2 KiB | **LEGACY CÒN NỐI** | Quản lý tài khoản bị gắn cờ trong hệ thống annotator cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/features/admin/ReportsAdminPage.tsx` | 7.1 KiB | **LEGACY CÒN NỐI** | Xử lý báo cáo vấn đề của hệ thống cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/features/admin/ReviewQueuePage.tsx` | 19.8 KiB | **LEGACY CÒN NỐI** | Hàng chờ duyệt annotation/audio cũ; khác ReviewDemo/ReviewPage hiện tại. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/features/admin/WithdrawalsAdminPage.tsx` | 7.5 KiB | **LEGACY CÒN NỐI** | Duyệt/từ chối/đánh dấu thanh toán yêu cầu rút tiền cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |

### frontend/src/features/annotate

| File | Dung lượng | Mức cần thiết | Công dụng / khuyến nghị |
| --- | ---: | --- | --- |
| `frontend/src/features/annotate/AnnotatePage.tsx` | 563 B | **LEGACY CÒN NỐI** | Trang thao tác gán nhãn audio cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/features/annotate/AudioPlayer.tsx` | 3.0 KiB | **LEGACY CÒN NỐI** | Player audio dạng waveform với điều khiển tốc độ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/features/annotate/GuidelineOffcanvas.tsx` | 3.8 KiB | **LEGACY CÒN NỐI** | Panel hướng dẫn các kiểu task gán nhãn. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/features/annotate/Playground.tsx` | 21.3 KiB | **LEGACY CÒN NỐI** | Giao diện xử lý từng task annotation/verification cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/features/annotate/ReportModal.tsx` | 4.0 KiB | **LEGACY CÒN NỐI** | Modal báo vấn đề của task/audio. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/features/annotate/VoiceRecordCard.tsx` | 8.7 KiB | **LEGACY CÒN NỐI** | Thu âm giọng nói và trạng thái ghi âm cho task cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/features/annotate/modes.ts` | 503 B | **LEGACY CÒN NỐI** | Danh sách chế độ task annotation cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |

### frontend/src/features/audios

| File | Dung lượng | Mức cần thiết | Công dụng / khuyến nghị |
| --- | ---: | --- | --- |
| `frontend/src/features/audios/AnnotatorsPanel.tsx` | 6.9 KiB | **LEGACY CÒN NỐI** | Panel xem người gán nhãn, câu trả lời và trạng thái duyệt audio. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/features/audios/AudiosTab.tsx` | 14.6 KiB | **LEGACY CÒN NỐI** | Tab danh sách/quản lý dữ liệu audio theo dự án. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/features/audios/UploadModal.tsx` | 22.6 KiB | **LEGACY CÒN NỐI** | Modal upload dữ liệu audio/câu hỏi và metadata. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |

### frontend/src/features/auth

| File | Dung lượng | Mức cần thiết | Công dụng / khuyến nghị |
| --- | ---: | --- | --- |
| `frontend/src/features/auth/AccountButton.tsx` | 3.1 KiB | **GIỮ** | Nút tài khoản và mở modal cài đặt tài khoản. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/auth/AuthContext.tsx` | 954 B | **GIỮ** | Context và hook đọc tài khoản/xác thực. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/auth/AuthProvider.tsx` | 3.4 KiB | **GIỮ** | Tải phiên đăng nhập, cache user và điều phối login/logout/hết phiên. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/auth/AuthShell.tsx` | 2.8 KiB | **GIỮ** | Bố cục và trường nhập chung cho các trang xác thực. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/auth/LoginPage.tsx` | 3.4 KiB | **GIỮ** | Màn hình đăng nhập. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/auth/RegisterPage.tsx` | 4.0 KiB | **GIỮ** | Màn hình đăng ký. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/auth/ResetPasswordPage.tsx` | 3.2 KiB | **GIỮ** | Màn hình đặt lại mật khẩu bằng token. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/auth/accountIdentity.ts` | 202 B | **GIỮ** | Lấy chữ cái viết tắt tên tài khoản để hiển thị avatar. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/auth/returnPath.ts` | 991 B | **GIỮ** | Chuẩn hoá URL quay về sau đăng nhập. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/auth/useBlurValidation.ts` | 788 B | **GIỮ** | Hook xác thực trường nhập sau khi rời ô. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |

### frontend/src/features/demo

| File | Dung lượng | Mức cần thiết | Công dụng / khuyến nghị |
| --- | ---: | --- | --- |
| `frontend/src/features/demo/AIDemo.tsx` | 16.7 KiB | **GIỮ** | Giao diện thử nghiệm dịch/AI trong workspace hiện tại; có route /demo/ai. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/demo/AccountDemo.tsx` | 12.7 KiB | **GIỮ** | Trang/modal hồ sơ, vùng phương ngữ và đổi mật khẩu đang dùng. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/demo/CampaignsDemo.tsx` | 7.2 KiB | **GIỮ** | Trang chiến dịch và mã QR trong workspace. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/demo/CommunityDemo.tsx` | 10.2 KiB | **GIỮ** | Trang từ điển và cộng đồng; có route thật trong /demo. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/demo/ContributionDemo.tsx` | 22.5 KiB | **GIỮ** | Form đóng góp, lịch sử và nhiệm vụ; là luồng chính hiện tại. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/demo/DashboardDemo.tsx` | 5.6 KiB | **GIỮ** | Tổng quan và thống kê cho workspace người duyệt. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/demo/DataPipeline.tsx` | 22.8 KiB | **GIỮ** | Giao diện nhập dữ liệu, dataset/release và vận hành; dùng API hiện tại. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/demo/DemoLayout.tsx` | 5.5 KiB | **GIỮ** | Khung chính /demo và điều hướng theo tài khoản. Đã bỏ thanh thử nghiệm, đổi vai trò giả, mô phỏng lỗi và modal reset dữ liệu mẫu. |
| `frontend/src/features/demo/DemoProvider.tsx` | 13.2 KiB | **GIỮ** | Điều phối tài khoản/state/đồng bộ API. Đã bỏ nhánh chặn đồng bộ do mô phỏng mất mạng; lỗi mạng thật và outbox vẫn được xử lý. |
| `frontend/src/features/demo/GameAdmin.tsx` | 27.1 KiB | **GIỮ** | Quản lý ngân hàng câu hỏi, đề và phiên chơi. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/demo/GamePages.tsx` | 28.8 KiB | **GIỮ** | Màn bắt đầu, consent, chơi từng câu và kết quả phiên. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/demo/GameSyncStatus.tsx` | 2.9 KiB | **GIỮ** | Hiển thị trạng thái đồng bộ game. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/demo/HomeDemo.tsx` | 7.8 KiB | **GIỮ** | Trang chủ và giải thích/quản lý quyền sử dụng dữ liệu. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/demo/MyContributions.tsx` | 11.6 KiB | **GIỮ** | Danh sách/chi tiết đóng góp của tôi, lịch sử và sửa consent. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/demo/PilotOperations.tsx` | 8.7 KiB | **GIỮ** | Giao diện bằng chứng vận hành/KPI pilot. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/demo/RegionOptions.tsx` | 543 B | **GIỮ** | Các lựa chọn vùng phương ngữ dùng lại trong form. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/demo/ReviewDemo.tsx` | 25.8 KiB | **GIỮ** | Hàng chờ duyệt, phản hồi, chi tiết nguồn và hành động duyệt hiện tại. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/demo/RewardsDemo.tsx` | 11.8 KiB | **GIỮ** | Giao diện ghi nhận/thành tích của workspace; khác ví VND legacy, vẫn có route /demo/rewards. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/demo/SettingsDemo.tsx` | 14.0 KiB | **GIỮ** | Cài đặt, người tham gia và quyền trong workspace hiện tại. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/demo/SyncStatus.tsx` | 1.7 KiB | **GIỮ** | Hiển thị trạng thái đồng bộ đóng góp/workspace. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/demo/aiScenario.ts` | 484 B | **GIỮ** | Dữ liệu và hàm mô phỏng dịch để minh hoạ; đang nối vào mã UI nên không xoá rời. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/demo/context.ts` | 1.1 KiB | **GIỮ** | Context/hook và kiểu thao tác workspace dùng chung. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/demo/contributionQuality.ts` | 2.9 KiB | **GIỮ** | Luật chất lượng đóng góp phía trình duyệt; cần giữ nhất quán nghiệp vụ với backend. Fixture kiểm thử dùng chung đã được gỡ. |
| `frontend/src/features/demo/dataset1Bank.ts` | 233.0 KiB | **GIỮ** | Kho Dataset1 sinh từ XLSX nhưng đang được import để tạo game. Không xoá chỉ vì có nhãn generated. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/demo/dataset1BankTypes.ts` | 964 B | **GIỮ** | Kiểu dữ liệu kho Dataset1 đã sinh. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/demo/datasetBank.ts` | 8.0 KiB | **GIỮ** | Chuyển Dataset1 thành câu hỏi/đề và gắn provenance, trạng thái xác minh. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/demo/datasetQuestions.ts` | 7.7 KiB | **GIỮ** | Bổ sung nhóm câu hỏi dataset vào kho khởi tạo. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/demo/dialectOriginal.ts` | 3.6 KiB | **GIỮ** | Xác định nội dung gốc phương ngữ trong các dạng câu hỏi/prompt tương thích cũ. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/demo/domain.ts` | 41.2 KiB | **GIỮ** | Luật nghiệp vụ game/đóng góp/duyệt local. Đã bỏ lệnh đổi actor thử nghiệm và chèn lỗi offline/spam giả. |
| `frontend/src/features/demo/files.ts` | 472 B | **GIỮ** | Hàm tải dữ liệu xuất ra thành file trên trình duyệt. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/demo/gameServer.ts` | 11.9 KiB | **GIỮ** | Đồng bộ catalog, phiên chơi, lệnh/outbox game với server. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/demo/navigation.ts` | 2.2 KiB | **GIỮ** | Nhóm menu và kiểm điều hướng workspace theo role/quyền. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/demo/playerContent.ts` | 1012 B | **GIỮ** | Lọc câu hỏi công khai theo chính sách phía frontend. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/demo/playerContentPolicy.json` | 453 B | **GIỮ** | Chính sách câu hỏi công khai frontend, bản đôi có chủ đích để hai gói chạy độc lập; không xoá vì trùng nội dung backend. |
| `frontend/src/features/demo/playerPrompt.ts` | 637 B | **GIỮ** | Tạo nội dung prompt hiển thị cho người chơi. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/demo/questionFormats.ts` | 2.2 KiB | **GIỮ** | Nhãn dạng câu, kiểm câu hỏi và trộn lựa chọn. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/demo/regions.ts` | 1.3 KiB | **GIỮ** | Danh mục vùng/địa danh dùng mô tả phương ngữ. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/demo/repository.ts` | 8.3 KiB | **GIỮ** | IndexedDB, cache, outbox, backup/restore và chuyển tài khoản. Đã bỏ hàm reset chỉ dùng từ thanh thử nghiệm. |
| `frontend/src/features/demo/reviewVersion.ts` | 918 B | **GIỮ** | Digest/khóa phiên bản nội dung để bản nháp hoặc thao tác duyệt cũ không áp lên bản mới. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/demo/routes.tsx` | 4.3 KiB | **GIỮ** | Route ứng dụng chính và reviewer; đã bỏ trang công cụ /demo/internal. |
| `frontend/src/features/demo/seed.ts` | 6.9 KiB | **GIỮ** | Dữ liệu bootstrap runtime và kho câu hỏi local, không phải fixture test. Đã bỏ thuộc tính mô phỏng lỗi. |
| `frontend/src/features/demo/server.ts` | 25.2 KiB | **GIỮ** | Cầu nối workspace trình duyệt với API dialect; đồng bộ thật khi có tài khoản/cờ bật. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/demo/testSessions.ts` | 1.0 KiB | **GIỮ** | Bộ lọc phiên QA cũ đang có dữ liệu trong browser: ngăn chúng đi vào thống kê, phân bổ và hàng chờ duyệt thật. Đây là bảo vệ dữ liệu runtime, không phải bộ test; giữ cùng cờ testOnly và dữ liệu lịch sử. |
| `frontend/src/features/demo/types.ts` | 10.2 KiB | **GIỮ** | Kiểu dữ liệu nghiệp vụ; đã bỏ trạng thái/lệnh mô phỏng lỗi và lệnh đổi vai trò thử nghiệm. |
| `frontend/src/features/demo/ui.tsx` | 4.5 KiB | **GIỮ** | Thành phần Heading/Panel/Field/Status, phân trang và guard dùng chung trong workspace. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |

### frontend/src/features/dialect

| File | Dung lượng | Mức cần thiết | Công dụng / khuyến nghị |
| --- | ---: | --- | --- |
| `frontend/src/features/dialect/AdminPages.tsx` | 1.3 KiB | **GIỮ** | Điểm re-export trang quản trị dialect và trang giới thiệu hệ thống cũ; router đang import. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/dialect/ContributionEntry.tsx` | 458 B | **GIỮ** | Điểm vào tương thích đưa /contribute và /contribute/new sang luồng góp hiện tại. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/dialect/ContributionPages.tsx` | 9.2 KiB | **GIỮ** | Trang đóng góp/chi tiết/hồ sơ tương thích, tái dùng giao diện hiện tại. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/dialect/Dashboard.tsx` | 6.9 KiB | **GIỮ** | Dashboard dialect theo vai trò contributor/reviewer/operator. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/dialect/DataAdminPages.tsx` | 14.7 KiB | **GIỮ** | Quản lý nguồn, dataset và người tham gia ngoài khung /demo. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/dialect/PublicPages.tsx` | 8.2 KiB | **GIỮ** | PublicLayout, landing /collection và trang /about-data; đang có route. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/dialect/ReviewPage.tsx` | 17.7 KiB | **GIỮ** | Giao diện duyệt dialect, chỉnh lý và bulk review ngoài khung /demo. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/dialect/navigation.ts` | 1.3 KiB | **GIỮ** | Tiêu đề trang và nhãn vai trò của giao diện dialect. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/dialect/shared.tsx` | 3.6 KiB | **GIỮ** | Thành phần dùng chung cho trạng thái tải, tiêu đề, đóng góp và phân trang. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/dialect/types.ts` | 2.1 KiB | **GIỮ** | Kiểu dữ liệu phản hồi API dialect và nhãn trạng thái. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/features/dialect/useResource.ts` | 1008 B | **GIỮ** | Hook tải API theo path, chặn response cũ ghi đè màn hình mới. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |

### frontend/src/features/projects

| File | Dung lượng | Mức cần thiết | Công dụng / khuyến nghị |
| --- | ---: | --- | --- |
| `frontend/src/features/projects/EditLabelModal.tsx` | 5.2 KiB | **LEGACY CÒN NỐI** | Modal sửa nhãn dự án audio cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/features/projects/MembersTab.tsx` | 9.7 KiB | **LEGACY CÒN NỐI** | Tab quản lý thành viên dự án cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/features/projects/NewProjectPage.tsx` | 2.8 KiB | **LEGACY CÒN NỐI** | Trang tạo dự án cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/features/projects/ProjectDetailPage.tsx` | 15.4 KiB | **LEGACY CÒN NỐI** | Trang chi tiết dự án cũ, kết nối các tab. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/features/projects/ProjectForm.tsx` | 17.0 KiB | **LEGACY CÒN NỐI** | Form cấu hình dự án gán nhãn/thu thập cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/features/projects/ProjectScoringForm.tsx` | 4.1 KiB | **LEGACY CÒN NỐI** | Form cấu hình chấm điểm task dự án cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/features/projects/ProjectsListPage.tsx` | 6.0 KiB | **LEGACY CÒN NỐI** | Danh sách/lọc dự án audio hoặc collect cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/features/projects/QualityControlTab.tsx` | 13.7 KiB | **LEGACY CÒN NỐI** | Tab cấu hình/kiểm golden data và chất lượng dự án cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/features/projects/ReportTab.tsx` | 10.1 KiB | **LEGACY CÒN NỐI** | Tab báo cáo tiến độ và đồng thuận dự án cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/features/projects/RolePlayTab.tsx` | 29.4 KiB | **LEGACY CÒN NỐI** | Quản lý scenario/test case/member view của role-play trong dự án cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/features/projects/UploadLabelsModal.tsx` | 17.2 KiB | **LEGACY CÒN NỐI** | Import nhãn/câu hỏi và tải template cho dự án cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/features/projects/WorkspaceTab.tsx` | 4.1 KiB | **LEGACY CÒN NỐI** | Tab workspace và tiến độ task trong dự án cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/features/projects/projectFormState.ts` | 754 B | **LEGACY CÒN NỐI** | State mặc định và kiểu form dự án cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |

### frontend/src/features/rewards

| File | Dung lượng | Mức cần thiết | Công dụng / khuyến nghị |
| --- | ---: | --- | --- |
| `frontend/src/features/rewards/HistoryTab.tsx` | 7.8 KiB | **LEGACY CÒN NỐI** | Lịch sử task và câu trả lời audio cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/features/rewards/RelabelModal.tsx` | 6.5 KiB | **LEGACY CÒN NỐI** | Sửa lại nhãn annotation cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/features/rewards/RewardsTab.tsx` | 7.3 KiB | **LEGACY CÒN NỐI** | Sổ điểm/thưởng của pipeline annotation cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |

### frontend/src/features/roleplay

| File | Dung lượng | Mức cần thiết | Công dụng / khuyến nghị |
| --- | ---: | --- | --- |
| `frontend/src/features/roleplay/RolePlayHistoryPage.tsx` | 8.3 KiB | **LEGACY CÒN NỐI** | Lịch sử các phiên hội thoại role-play cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/features/roleplay/RolePlayListPage.tsx` | 5.3 KiB | **LEGACY CÒN NỐI** | Danh sách kịch bản role-play cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/features/roleplay/RolePlaySessionPage.tsx` | 16.7 KiB | **LEGACY CÒN NỐI** | UI chạy phiên hội thoại với agent, ghi âm và đánh giá. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/features/roleplay/roleplay.css` | 12.9 KiB | **LEGACY CÒN NỐI** | Style riêng cho giao diện role-play cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/features/roleplay/useWebSocketAgent.ts` | 14.5 KiB | **LEGACY CÒN NỐI** | Kết nối audio WebSocket, PCM/resample và lifecycle phiên agent. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |

### frontend/src/features/wallet

| File | Dung lượng | Mức cần thiết | Công dụng / khuyến nghị |
| --- | ---: | --- | --- |
| `frontend/src/features/wallet/WithdrawModal.tsx` | 6.5 KiB | **LEGACY CÒN NỐI** | Modal yêu cầu rút tiền từ điểm legacy. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |

### frontend/src/lib

| File | Dung lượng | Mức cần thiết | Công dụng / khuyến nghị |
| --- | ---: | --- | --- |
| `frontend/src/lib/annotateTypes.ts` | 1.1 KiB | **LEGACY CÒN NỐI** | Kiểu dữ liệu task annotation cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/lib/audioTypes.ts` | 2.0 KiB | **LEGACY CÒN NỐI** | Kiểu dữ liệu audio/prelabel và định dạng dung lượng cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/lib/display.ts` | 5.0 KiB | **GIỮ** | Chuẩn hoá nhãn/thuật ngữ hiển thị tiếng Việt. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/lib/pilotRoutes.ts` | 741 B | **GIỮ** | Lọc route legacy theo VITE_ENABLE_LEGACY; quyết định bề mặt pilot. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/lib/projectTypes.ts` | 2.8 KiB | **LEGACY CÒN NỐI** | Kiểu dự án/task/member/báo cáo cũ; có thể được nơi khác dùng kiểu nên cần kiểm import trước khi bỏ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/lib/reportTypes.ts` | 1.4 KiB | **LEGACY CÒN NỐI** | Kiểu và nhãn report cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/lib/reviewTypes.ts` | 3.8 KiB | **LEGACY CÒN NỐI** | Kiểu annotation, trạng thái duyệt, điểm và cờ tài khoản cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/lib/slug.ts` | 1.2 KiB | **LEGACY CÒN NỐI** | Chuẩn hoá tên dự án thành URL và lấy ID, phục vụ các trang project cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/lib/types.ts` | 290 B | **GIỮ** | Kiểu user, role và lỗi API dùng chung. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/lib/walletTypes.ts` | 1.7 KiB | **LEGACY CÒN NỐI** | Kiểu hồ sơ ví/rút tiền và định dạng VND legacy. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |

### frontend/src/pages

| File | Dung lượng | Mức cần thiết | Công dụng / khuyến nghị |
| --- | ---: | --- | --- |
| `frontend/src/pages/DashboardPage.tsx` | 17.6 KiB | **LEGACY CÒN NỐI** | Dashboard hệ thống audio/annotator cũ tại /legacy/audio. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/pages/ErrorPage.tsx` | 839 B | **GIỮ** | Trang thông báo 403/404 dùng chung hiện tại và legacy. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/pages/HistoryPage.tsx` | 369 B | **LEGACY CÒN NỐI** | Trang bọc lịch sử annotation cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/pages/RewardsPage.tsx` | 317 B | **LEGACY CÒN NỐI** | Trang bọc điểm thưởng annotation cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/pages/SettingsPage.tsx` | 7.3 KiB | **LEGACY CÒN NỐI** | Trang hồ sơ/thanh toán của hệ thống cũ tại /legacy/settings. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |
| `frontend/src/pages/WithdrawalsPage.tsx` | 5.4 KiB | **LEGACY CÒN NỐI** | Danh sách yêu cầu rút tiền cũ. **Xử lý:** Chỉ bỏ khi bỏ tính năng cũ, gỡ import/route/model liên quan và kiểm build/test/migration. |

### frontend/src/styles

| File | Dung lượng | Mức cần thiết | Công dụng / khuyến nghị |
| --- | ---: | --- | --- |
| `frontend/src/styles/account.css` | 9.8 KiB | **GIỮ** | Style hồ sơ/modal cài đặt tài khoản. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/styles/auth.css` | 5.6 KiB | **GIỮ** | Style đăng nhập, đăng ký, khôi phục mật khẩu. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/styles/blaze-workspace.css` | 30.2 KiB | **GIỮ** | Style bố cục workspace/sidebar/table và giao diện quản lý. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/styles/collection.css` | 20.1 KiB | **GIỮ** | Style khung collection/public và thành phần dùng chung. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/styles/community.css` | 7.0 KiB | **GIỮ** | Style từ điển/cộng đồng trong /demo. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/styles/demo.css` | 18.7 KiB | **GIỮ** | Style ứng dụng chính /demo, gồm game/đóng góp/reviewer. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/styles/dialect.css` | 32.3 KiB | **GIỮ** | Style trang phương ngữ và thành phần dialect dùng lại. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |
| `frontend/src/styles/theme.css` | 149.3 KiB | **GIỮ** | Token/chủ đề và nền tảng style dùng chung. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |

### ml

| File | Dung lượng | Mức cần thiết | Công dụng / khuyến nghị |
| --- | ---: | --- | --- |
| `ml/README.md` | 1.7 KiB | **PHÁT TRIỂN/VẬN HÀNH** | Hướng dẫn môi trường ML/audio và STT còn giữ; đã bỏ hướng dẫn simulator/ứng dụng QA và smoke check đã xoá. |
| `ml/requirements.in` | 204 B | **TUỲ CHỌN** | Danh sách dependency ML đầu vào ở mức thư viện. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `ml/requirements.lock.txt` | 897 B | **TUỲ CHỌN** | Phiên bản dependency ML đã đóng băng để tái tạo môi trường; giữ ngay cả khi xoá ml/.venv. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `ml/use-lab.ps1` | 440 B | **TUỲ CHỌN** | Nạp các biến môi trường cho workspace ML độc lập. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |

### ml/dataset

| File | Dung lượng | Mức cần thiết | Công dụng / khuyến nghị |
| --- | ---: | --- | --- |
| `ml/dataset/audio_quality_review.html` | 8.1 KiB | **TUỲ CHỌN** | Trang HTML nghe và đánh dấu quyết định chất lượng audio. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `ml/dataset/audit_dataset1.py` | 11.0 KiB | **TUỲ CHỌN** | Audit snapshot Dataset1, tạo ứng viên cần kiểm tra; không tự chứng nhận dữ liệu train. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `ml/dataset/augment_audio_pilot.py` | 15.4 KiB | **TUỲ CHỌN** | Sinh các biến thể audio có seed để nghe kiểm tra. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `ml/dataset/import_audio_review.py` | 10.2 KiB | **TUỲ CHỌN** | Nhập quyết định nghe duyệt vào gói pilot mới. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `ml/dataset/normalize_audio_pilot.py` | 9.4 KiB | **TUỲ CHỌN** | Chuẩn hoá text/audio đã cho phép trước thử nghiệm augmentation. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `ml/dataset/package_audio_pilot.py` | 11.4 KiB | **TUỲ CHỌN** | Kiểm chất lượng batch audio và đóng gói pilot dành cho review. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `ml/dataset/prepare_fpt_audio_pilot.py` | 10.6 KiB | **TUỲ CHỌN** | Tải gói audio mẫu để review. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `ml/dataset/run_asr_pilot.py` | 9.5 KiB | **TUỲ CHỌN** | Chạy inference ASR mô hình cố định trên pilot đã review. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |

### ml/scripts

| File | Dung lượng | Mức cần thiết | Công dụng / khuyến nghị |
| --- | ---: | --- | --- |
| `ml/scripts/elevenlabs_realtime_stt.py` | 7.7 KiB | **TUỲ CHỌN** | Công cụ STT realtime ElevenLabs độc lập cho microphone/file; không thuộc pilot chữ. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |

### scripts

| File | Dung lượng | Mức cần thiết | Công dụng / khuyến nghị |
| --- | ---: | --- | --- |
| `scripts/package_release.py` | 2.7 KiB | **PHÁT TRIỂN/VẬN HÀNH** | Đóng gói source đang thấy trong Git, kể cả thay đổi chưa commit, bỏ secrets/DB/dependency; xuất ZIP và checksum ngoài repo. **Xử lý:** Nên giữ khi còn phát triển/phát hành; không nhất thiết cần trong runtime. |
| `scripts/run-audio-preview.ps1` | 807 B | **TUỲ CHỌN** | Gọi công cụ sinh preview audio của ml/dataset. **Xử lý:** Lưu trữ/bỏ nếu ngừng dùng workflow này; sửa script/link tham chiếu liên quan. |
| `scripts/start-local.ps1` | 3.2 KiB | **GIỮ** | Build frontend và khởi chạy API/frontend chung cổng 7777 trên Windows. **Xử lý:** Không xoá rời; đang cần cho chạy/build hoặc là cấu hình/tài nguyên nền tảng. |

## Danh sách file nguồn đã xoá

Đường dẫn dưới đây là lịch sử thao tác, không còn tồn tại trong workspace.

- `backend/scripts/benchmark_pilot.py`
- `backend/scripts/seed_qa.py`
- `backend/tests/test_account_recovery.py`
- `backend/tests/test_auth_flow.py`
- `backend/tests/test_collection_consent.py`
- `backend/tests/test_contribution_quality.py`
- `backend/tests/test_dataset_candidate_import.py`
- `backend/tests/test_dataset_release.py`
- `backend/tests/test_deployment_preflight.py`
- `backend/tests/test_dialect.py`
- `backend/tests/test_dialect_workspace.py`
- `backend/tests/test_duplicate_batch.py`
- `backend/tests/test_frontend_hosting.py`
- `backend/tests/test_game_original.py`
- `backend/tests/test_http_security.py`
- `backend/tests/test_jwt_compatibility.py`
- `backend/tests/test_migrations.py`
- `backend/tests/test_pilot_operations.py`
- `backend/tests/test_pilot_scope.py`
- `backend/tests/test_pipeline_e2e.py`
- `backend/tests/test_player_content.py`
- `backend/tests/test_review_binding.py`
- `backend/tests/test_review_ops.py`
- `backend/tests/test_server_games.py`
- `backend/tests/test_translation_evaluation.py`
- `backend/tests/test_unified_reviewer.py`
- `backend/tests/test_workspace_pages.py`
- `frontend/src/components/ScoreBurst.tsx`
- `frontend/tests/account-settings.test.tsx`
- `frontend/tests/admin-workspace.test.tsx`
- `frontend/tests/application-error.test.tsx`
- `frontend/tests/auth-pages.test.tsx`
- `frontend/tests/contribution-quality.test.ts`
- `frontend/tests/dataset-bank.test.ts`
- `frontend/tests/dataset-game.test.tsx`
- `frontend/tests/dataset-release-page.test.tsx`
- `frontend/tests/demo-domain.test.ts`
- `frontend/tests/demo-extensions.test.tsx`
- `frontend/tests/demo-flow.test.tsx`
- `frontend/tests/demo-navigation.test.ts`
- `frontend/tests/demo-provider.test.tsx`
- `frontend/tests/demo-repository.test.ts`
- `frontend/tests/demo-server.test.ts`
- `frontend/tests/dialect-original.test.tsx`
- `frontend/tests/direct-submit-status.test.tsx`
- `frontend/tests/game-allocation.test.ts`
- `frontend/tests/game-sync.test.ts`
- `frontend/tests/my-contributions.test.tsx`
- `frontend/tests/pilot-operations.test.tsx`
- `frontend/tests/pilot-routes.test.ts`
- `frontend/tests/player-content.test.ts`
- `frontend/tests/player-prompt.test.ts`
- `frontend/tests/required-auth.test.tsx`
- `frontend/tests/reset-password.test.tsx`
- `frontend/tests/responsive-table.test.tsx`
- `frontend/tests/review-bulk.test.tsx`
- `frontend/tests/review-version-ui.test.tsx`
- `frontend/tests/review-version.test.ts`
- `frontend/tests/session-expiry.test.tsx`
- `frontend/tests/setup.ts`
- `frontend/tests/state-lifecycle.test.tsx`
- `frontend/tests/test-sessions.test.ts`
- `frontend/tests/vietnamese-ui.test.tsx`
- `frontend/vitest.config.ts`
- `ml/scripts/check_environment.py`
- `ml/simulator/README.md`
- `ml/simulator/extended_fixtures.json`
- `ml/simulator/extended_scenarios.py`
- `ml/simulator/final_scenarios.py`
- `ml/simulator/fixtures.json`
- `ml/simulator/run.py`
- `ml/simulator/test_isolation.py`
- `ml/simulator/verify_phase.py`
- `scripts/open-ml-lab.ps1`
- `scripts/run-simulator.ps1`
- `scripts/start-ml-lab.ps1`
- `scripts/start-qa.ps1`
- `scripts/verify-phase2.ps1`
- `test-fixtures/contribution-quality-v1.json`

## Xác minh sau khi xoá

- Frontend lint với `--max-warnings 0`: đạt.
- Frontend TypeScript và Vite build sạch: đạt; output hiện khoảng 2,97 MiB, đã bỏ các chunk cũ.
- Kiểm cú pháp 96 file Python backend: đạt.
- Import FastAPI bằng cấu hình SQLite in-memory, không mở DB thật: đạt.
- Package và lockfile khớp sau khi gỡ dependency kiểm thử; npm không báo dependency lỗi.
- Đã xác nhận các đường dẫn test/QA bị xoá không còn tồn tại; 364 file còn lại được liệt kê đúng một lần.
- `git diff --check`: đạt. Chưa chạy Docker/HTTPS trên server thật.

Sau khi gỡ bộ test, việc kiểm tra hiện tại dựa trên lint/build, kiểm cú pháp/import và nghiệm thu thủ công. Không còn bộ kiểm thử tự động để phát hiện hồi quy nghiệp vụ.
