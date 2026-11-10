# Tự phân đề và quản lý lượt lặp

Giao diện công khai không còn chọn bộ đề hoặc dùng query `exam` để ép chọn đề. Nút Bắt đầu chơi gọi lệnh `autoStart`; người có phiên dở thấy Tiếp tục chơi và giữ consent của phiên hiện tại.

Phân phối trong transaction IndexedDB: ưu tiên phiên đang chơi của người hiện tại (nếu có link chiến dịch thì cùng chiến dịch), sau đó lấy các đề active hợp lệ trong phạm vi chiến dịch/vùng. Không có chiến dịch thì bỏ đề fixture `exam-demo` khi có đề khác hợp lệ. Chọn trong các đề chưa hoàn thành; cân bằng bằng số lượt chưa rút của mọi người trong kho, hòa thì sắp theo ID. Khi hoàn thành toàn bộ đề có thể phân phối, cho chơi lại và đánh dấu repeat. Lịch sử đã gửi rồi rút vẫn được tính là từng hoàn thành. Lệnh start chọn đề cụ thể cũ giữ cho các công cụ/thử nghiệm nội bộ, giao diện khách chỉ dùng autoStart.

Hai thao tác bắt đầu đồng thời chỉ tạo một phiên nhờ kiểm tra lại phiên dở trong transaction. Phiên đang chơi có snapshot riêng nên tiếp tục được ngay cả khi đề gốc đã đóng. Chiến dịch không tồn tại/đã tắt không tạo phiên mới.

Lượt chơi có cờ repeat; lượt cũ thiếu cờ được suy ra từ lịch sử cùng người và đề. Admin có nhãn và bộ lọc lượt đầu/lặp; dashboard tách số lượt đầu và lượt lặp đã gửi.

Trước khi đưa đóng góp từ game vào hàng chờ, so sánh kind, nội dung, nghĩa, bản phổ thông, ngữ cảnh và vùng sau chuẩn hóa Unicode/chữ thường/khoảng trắng/dấu câu cuối. Giữ nguyên dấu tiếng Việt; khác nghĩa/ngữ cảnh không tự gộp. Mẫu trùng vẫn giữ RAW, quyền dữ liệu và chủ sở hữu riêng, gắn duplicateOf và HOLD. Reviewer không thấy trong hàng chờ mới; engine chặn bỏ phiếu mới trên mẫu trùng. Mẫu trùng không đủ điều kiện xuất/công khai và không tăng các số đếm dữ liệu mới trên dashboard. Admin xem liên kết mẫu trùng trong chi tiết lượt. Gửi lại cùng phiên vẫn idempotent.

Phạm vi kiểm soát là kho demo trên trình duyệt, không phải chống spam xuyên thiết bị hoặc phân quyền backend. Không reset dữ liệu hay sửa Sheet gốc. Không commit/push.
