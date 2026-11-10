# Cập nhật logo và typography — 03/11/2026

- Logo trong Brand, header/sidebar (kể cả nhãn thu gọn), auth/footer và title trang chỉ còn Blaze; bỏ nhãn Collection. Không đổi class, storage key hoặc tên thư mục để tránh ảnh hưởng hành vi.
- Inter 400/500/600/700 tự host thay Be Vietnam Pro. Dùng CSS có unicode-range để Latin và dấu tiếng Việt chọn đúng subset; giữ bản giấy phép trong public/brand.
- Body 16px/1.55, menu/nút/nhãn 14px, caption 13px; tiêu đề trang desktop 28–32px, mobile 24–28px. Hero và tiêu đề nội dung có thang riêng. Khoảng cách chữ tiêu đề không siết quá -0.015em; không dùng scale để thay hình chữ.
- Mở rộng nội dung desktop và wizard tới 1200px, bỏ override 1280px, giảm khoảng cách dọc trong hero/card/list/form. Vùng bấm tối thiểu 44px. Sửa trường hợp khối giới thiệu game có min-width dễ làm tràn màn hình hẹp.
- Sáu artboard hiện có đồng bộ Inter và logo; font canvas cũng nằm cục bộ với unicode-range, không gọi Google Fonts.

## Kết quả kiểm tra

- TypeScript + Vite production build: đạt.
- ESLint các component TSX đã sửa: đạt.
- git diff --check: đạt (có cảnh báo chuẩn hóa xuống dòng từ các thay đổi sẵn có).
- Canvas artifact check: 6 board, 0 lỗi định dạng.
- Chưa xác minh trực quan các trang chủ/login/dashboard/form/review/export trên desktop/mobile và zoom 200%. Trình duyệt nhúng không gắn được tab; khi chuyển sang Chrome, Computer Use dừng vì không xác định được URL Windows đủ chắc chắn để thực thi kiểm tra an toàn. Không coi build hoặc canvas check là bằng chứng đã qua các bước visual QA này.

Lần thay đổi này chỉ sửa giao diện, dependency font và canvas; không sửa API, schema hoặc dữ liệu nghiệp vụ.
