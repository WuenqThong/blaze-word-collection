# Bắt buộc đăng nhập và lựa chọn quận/huyện

Trang chủ và quyền dữ liệu tiếp tục công khai. Các trang game, lịch sử và nội bộ bắt buộc có phiên đã xác minh qua `/api/auth/me`; người chưa đăng nhập được chuyển tới `/login` cùng đường dẫn quay lại. Cache localStorage không thay thế kết quả xác minh phiên. Mất kết nối xác minh trên trang được bảo vệ hiển thị lỗi và nút thử lại.

Đăng nhập và đăng ký cùng dùng đích quay lại, mặc định `/demo/play`; liên kết giữa hai form giữ state. Bỏ lời mời chơi ẩn danh khỏi trang chủ, footer auth và quyền dữ liệu; bỏ công cụ nhận lượt ẩn danh trên lịch sử công khai.

DemoRoot dùng một AuthProvider cho toàn bộ shell, tài khoản header và luồng game. Danh tính được gắn vào kho dưới ID `account:<user.id>`, role annotator ánh xạ contributor, reviewer/admin theo API. Đăng nhập không tự xác minh chất lượng dữ liệu hay tặng điểm. Không tự nhận lại các phiên guest cũ. Mỗi thao tác dispatch có tài khoản xác định lại actor trong transaction để tránh tab khác thay đổi chủ phiên. Bắt đầu/gửi game kiểm tra lại phiên qua API. Đổi role demo chỉ dành cho admin đã đăng nhập ở trang nội bộ. Khi đăng xuất hoặc đổi tài khoản, provider đổi scope và lịch sử/phiên dở không dùng chung.

Danh mục mới dùng đúng bảy lựa chọn do người dùng chỉ định: Quận Cẩm Lệ, Quận Hải Châu, Quận Liên Chiểu, Quận Ngũ Hành Sơn, Quận Sơn Trà, Quận Thanh Khê, Huyện Hòa Vang. Cả nơi đang sống, nơi lớn lên và nơi dùng phương ngữ đều là select bắt buộc. Kho cũ được cập nhật danh mục một lần qua marker districts-v1; câu trả lời/snapshot và dữ liệu vùng lịch sử không bị viết lại. Màn chỉnh metadata của lượt cũ yêu cầu chọn lại nếu giá trị không có trong danh mục. Các select vùng trong form góp dữ liệu và hàng chờ legacy cũng dùng danh mục chung. Phạm vi vùng trong câu hỏi/dataset giữ theo nguồn gốc, không giả định dữ liệu cũ thuộc một quận cụ thể.

Kiểm tra: build, lint phần chính; suite 55 test gồm chặn truy cập chưa đăng nhập, cache không hợp lệ, lỗi xác minh, trang chủ công khai, quay lại sau đăng nhập/đăng ký, phân tách tài khoản/tab, bảo toàn dữ liệu cũ và hoàn thành ba bộ đề với địa bàn mới. Kiểm tra browser thực xác nhận `/demo/play` chuyển sang `/login` khi chưa có phiên.

Phạm vi lưu game hiện vẫn là IndexedDB demo; thay đổi này chưa tạo dịch vụ lưu game và phân quyền dữ liệu game trên backend. Các API nghiệp vụ thật hiện có giữ nguyên. Không commit hoặc push.
