# Phân luồng frontend theo vai trò

- Khách: header ngang Trang chủ / Chơi game, không sidebar. Quyền dữ liệu ở footer, phục hồi tiến độ ở trang bắt đầu game, xem lại và quản lý quyền sau gửi.
- Contributor: thêm Lượt chơi của tôi; dữ liệu lịch sử giữ bộ lọc chủ sở hữu hiện có.
- Reviewer: Hàng chờ và Đã xử lý, tách theo phiếu của người hiện tại; giữ lọc vùng và không tự duyệt. Không cho mở dashboard toàn hệ thống, lượt chơi, đề, xuất/nhập và cài đặt qua đường dẫn trực tiếp. Phản hồi hiển thị theo các mẫu trong phạm vi.
- Admin: năm nhóm Tổng quan, Quản lý game, Lượt chơi, Dữ liệu & kiểm duyệt, Cài đặt. Các trang con truy cập qua tab nhóm.
- Các route mở rộng vẫn giữ trong code và admin có thể truy cập trực tiếp; không hiển thị trong menu chính. Khách/contributor không mở được AI, cộng đồng, chiến dịch hay form đóng góp riêng.
- Công cụ đổi role/giả lập lỗi/khôi phục mẫu chuyển tới `/demo/internal`, không có liên kết trong giao diện công khai. Trang thử nghiệm này cố ý cho phép đổi role của kho demo, KHÔNG phải hàng rào bảo mật hay đăng nhập. Bản thật cần danh tính và kiểm tra quyền ở API; thay đổi này chỉ phân luồng frontend IndexedDB.
- Không xóa dữ liệu, không commit/push.

Kiểm tra: production build, ESLint các file sửa; suite 28 test gồm game đủ 10 câu đến quản trị và phạm vi route theo vai trò.
