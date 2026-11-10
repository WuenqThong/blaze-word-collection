# Ba bộ đề thử nghiệm từ Dataset1

Nguồn tham chiếu: https://docs.google.com/spreadsheets/d/1s9ydC5lWltZ-lZYigUHbceVj7SgyZamlDw6seZbAaWk/edit

## Nội dung

Thêm 30 câu thuộc ba bộ: Cách nói hằng ngày, Trong bếp ngoài chợ, Hiểu đúng theo ngữ cảnh. Mỗi bộ có 8 câu dựa trên các dòng đã đọc từ ba tab Dataset tổng hợp, Từ sinh hoạt thường ngày và Câu nói kiểm thử ĐN-QN; hai câu cuối là yêu cầu đóng góp mới được biên soạn theo chủ đề. Không sửa Sheet gốc.

Cấu trúc: Q01 trắc nghiệm, Q02 trả lời ngắn, Q03 điền từ, Q04–Q05 giải thích, Q06 trắc nghiệm, Q07 viết lại, Q08 điền từ, Q09 góp từ, Q10 góp câu. Không lặp mục từ/nghĩa giữa các câu đóng trong cùng đề. Đề cũ vẫn được giữ.

Tất cả câu mới là nội dung biên soạn thử nghiệm, chưa duyệt bản địa, không phải gold thu thật. Hai vị trí kiểm tra Q06/Q08 chỉ ghi tín hiệu; đề ở chế độ signal. Mục cần xác minh, dữ liệu ngữ âm và bản dịch Anh không được dùng để lập đáp án đóng.

## Kỹ thuật

- `Question.format` độc lập với `kind`, có options/ID đáp án, blankTemplate và provenance theo dòng nguồn. Thiếu format vẫn dùng UI văn bản cũ.
- `Answer.selectedOptionId` và lịch sử lần thử lưu lựa chọn ổn định. Nội dung lựa chọn được xác định lại từ snapshot lúc chấm. Câu ngắn/điền từ dùng NFC, chữ thường, khoảng trắng và dấu câu cuối; vẫn phân biệt dấu tiếng Việt. Câu mở không chấm tự động.
- Thứ tự lựa chọn trộn một lần khi tạo phiên và lưu trong snapshot. Các đề mới không hoán đổi ba dạng Q01–Q03 theo cơ chế xoay câu cũ.
- Kho mới nhận đề qua seed; kho cũ được cập nhật bổ sung trong transaction load với marker `dataset1-three-exams-v1`. Không ghi đè phiên hoặc câu đã có, không reset kho.
- Quản trị có lựa chọn dạng, chỉnh phương án/đáp án, mẫu điền từ và xem trước. Các câu đã phát hành tiếp tục phải nhân bản để sửa. Bảng lượt chơi hiển thị dạng câu, nguồn và ID lựa chọn trong lần thử.
- Kiểm tra cấu hình khi lưu câu và mở/phát hành đề: lựa chọn thiếu/trùng, ID đúng không hợp lệ, biến thể trùng phương án nhiễu, số chỗ trống sai, dạng không phù hợp vai trò câu. Câu chưa xác minh vẫn bị chặn khi phát hành thu thật.

## Xác minh

Production build và ESLint phần sửa đạt. Suite 39 test đạt, bao gồm ba luồng UI hoàn thành 10 câu và xem quản trị, chấm theo ID, biến thể có dấu/không dấu, câu mở/bỏ qua, cấu hình sai, cập nhật kho cũ, snapshot và lựa chọn khi mở lại kho. Test cũ tiếp tục đạt.

Kiểm tra trình duyệt thực: bộ Trong bếp ngoài chợ đã mở trắc nghiệm Q01, lưu lựa chọn, chuyển Q02 trả lời ngắn và Q03 điền từ; đã xem UI lựa chọn ở viewport mobile và khôi phục viewport sau kiểm tra. Không tạo dữ liệu trả lời thay người dùng trong phiên đang chơi trước đó; việc thử được thực hiện ở tab riêng với một phiên thử mới.

Không commit/push. Dữ liệu game vẫn ở IndexedDB demo như kiến trúc hiện có.
