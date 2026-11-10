# Frontend redesign theo DESIGN.md

Áp dụng hệ tham chiếu app.blaze.vn: nền #F9F8F5, panel trắng, đường viền #ECE7DE, vàng thương hiệu #E7A103 và accent chữ #A15C00.

- Giữ Inter tự host 400/500/600/700 theo quyết định typography trước; không kéo giãn font. Logo vẫn Blaze, không có Collection.
- CTA vàng dùng chữ #262626 để cải thiện tương phản so với chữ trắng ở nguồn tham chiếu.
- Đồng bộ palette trong collection.css, dialect.css và demo.css; blaze-workspace.css định nghĩa lớp giao diện cuối cùng cho shell, control và responsive.
- Nội dung demo nằm trong panel trắng bo 16px; container tối đa 1200px. Sidebar desktop 240px, mobile mở qua nút Menu; bảng cuộn ngang trong vùng riêng.
- Công cụ chọn vai trò/kịch bản và khôi phục mẫu giữ nguyên, gom vào details “Công cụ thử nghiệm”, mặc định thu gọn. Các luồng game và dữ liệu không thay đổi.
- Tám artboard hiện có đã đồng bộ palette, giữ nội dung và cấu trúc canvas.

## Kiểm tra

- Production build: đạt.
- ESLint DemoLayout.tsx và main.tsx: đạt.
- Vitest: 24/24 đạt khi chạy riêng. Lần chạy cùng build có một timeout tìm trang chủ ở trạng thái lazy loading; lần chạy lại toàn suite đạt.
- Canvas: 8 artboard, 0 lỗi định dạng. Không render hoặc kiểm tra trực quan artboard theo quy tắc skill. Chưa nghiệm thu trực quan trình duyệt/zoom 200% trong đợt này.
- Không commit, push hoặc tạo PR. Thay đổi chỉ local.
