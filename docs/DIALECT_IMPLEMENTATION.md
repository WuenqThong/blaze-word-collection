# Bàn giao cập nhật UI/UX phương ngữ

Đã triển khai theo file góp ý: landing công khai, hướng dẫn quyền, wizard bốn bước góp từ/câu, nháp theo tài khoản, lịch sử/chi tiết, phiên bản bổ sung, rút mẫu, hồ sơ vùng, reviewer độc lập, xử lý bất đồng, rà soát nguồn, cấp quyền reviewer và dataset release có checksum/manifest. Màu/font/logo tiếp tục dùng DESIGN.md.

Navigation chính tập trung dữ liệu phương ngữ. Audio/tài chính cũ vẫn truy cập qua `/legacy`; không xóa dữ liệu cũ. Các route `/projects`, `/roleplay`, `/rewards`, `/withdrawals` vẫn hoạt động. Trang 404/403, login giữ query/hash, loading/error/retry, submit không thưởng trước response, chi tiết review không nhận response cũ, caption dễ đọc hơn, tab dự án hiển thị trực tiếp đã được sửa.

API thật ở `/api/dialect`, bảng mới riêng có tiền tố `dialect_`, được tạo qua cơ chế create_all hiện có khi backend khởi động. Raw được lưu riêng; cập nhật nội dung bằng bản ghi mới. Rà soát quyền, quyết định, rút mẫu có sự kiện lịch sử. Không thay schema bảng audio/tài chính hiện có.

Hai phiếu độc lập cùng verdict tạo quyết định; bất đồng cần điều phối viên không phải người góp hoặc người đã bỏ phiếu. Reviewer chưa gửi không đọc phiếu khác. Admin có thể đọc phiếu trong hàng chờ bất đồng để điều phối. VERIFIED chỉ đủ xuất khi có ít nhất hai phiếu, nguồn được xác nhận, đồng ý huấn luyện và chưa rút/chưa bị thay phiên bản. Lượt gửi có idempotency key chống retry trùng; thay nội dung tạo key khác. Tải release kiểm tra lại eligibility và chặn release có mẫu mất điều kiện.

Kiểm thử: `cd backend; .\.venv\Scripts\python.exe -m unittest discover -s tests -v`. Test dùng SQLite in-memory và dependency override, không chạm database thật. Có test vòng đời/quyền/idempotency/QA/quyền nguồn/rút mẫu và opt-out huấn luyện. Frontend: `npm run build` và ESLint cho features/dialect cùng các component mới.

Giới hạn còn lại: bản release chưa chia train/dev/test, chưa là gold/benchmark; kiểm tra trùng hiện theo cách viết NFC trong mẫu của chính người góp để không lộ RAW người khác; không có semantic search. Nháp audio không được khôi phục khi rời trang. Lưu nháp cần localStorage khả dụng. Consent chưa có giao diện thay đổi riêng từng phạm vi sau gửi: dùng rút mẫu hoặc bản mới. Hồ sơ vùng là tự khai, quản trị phải xác nhận reviewer ngoài hệ thống trước khi cấp quyền. Không tự xóa bản dataset đã tải ra ngoài. CSV import, từ điển công khai, audio mở rộng/model dịch vẫn ở giai đoạn sau.

Chưa thực hiện kiểm thử trực quan đầy đủ mọi viewport và mọi vai trò bằng trình duyệt. Canvas chỉ là bản tham khảo, không chứng minh chức năng runtime. CSS cũ còn tồn tại cho các module legacy; chưa xóa hàng loạt.
