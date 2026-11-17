# Nội dung câu hỏi trong lượt chơi phổ thông

Chính sách `public-game-content-v1` áp dụng khi tạo lượt mới, ở cả backend và bộ chạy local. Mục tiêu là tránh phát ngẫu nhiên từ thô, nội dung tình dục rõ ràng và mô tả đe dọa/hành hung trong câu hỏi phổ thông.

## Cách xử lý

- Các dòng QND-156, QND-R50-071, QND-226, QND-298, QND-321, QND-322, QND-372, QND-426 và QND-453 được tách khỏi lượt mới sau rà soát từ thô và tên bộ phận cơ thể nhạy cảm. Dùng ID để không loại nhầm những từ bình thường như “vú sữa”. Việc loại khỏi game không có nghĩa kết luận từ địa phương là sai hoặc bản gốc phải bị xóa.
- Kiểm tra cả prompt, bản gốc, mẫu điền từ, đáp án, lựa chọn trắc nghiệm và mô tả nghĩa của nguồn. Chữ hoa/thường, Unicode tổ hợp và dấu câu được chuẩn hóa khi đối chiếu. Không dùng so khớp chuỗi con: “đỉa”, “đánh cá”, “tát nước” không bị chặn chỉ vì chứa ký tự tương tự từ hạn chế.
- Câu bị chặn được thay bằng câu hợp lệ cùng loại, dạng trả lời, vùng, nguồn và chế độ minh họa/thật. Không lặp ID trong cùng lượt, không thay đổi số lượng 10 câu, không tự đổi câu hỏi thành câu đã xác minh.
- Bộ chọn câu ngẫu nhiên và thích ứng cũng loại các câu bị chặn. Nếu không đủ câu thay thế hợp lệ, từ chối tạo lượt, không ghi một lượt hay phân bổ dở dang.
- Giữ nguyên kho nguồn, lịch sử và snapshot của lượt đã tạo. Lượt cũ tiếp tục theo snapshot cũ, vì vậy lịch sử và lượt dở dang trước khi cập nhật vẫn có thể chứa nội dung đã bị loại khỏi lượt mới. Không lọc hoặc sửa câu trả lời do người góp nhập.

## Bảo trì

Backend dùng `backend/app/data/player_content_policy.json`; frontend dùng bản giống hệt tại `frontend/src/features/demo/playerContentPolicy.json` để cả hai gói triển khai chạy độc lập. Khi thay đổi, cập nhật hai bản và tăng version. Cần đối chiếu hai bản JSON khi bảo trì; bộ kiểm thử tự động trước đây đã được gỡ.

Đây là danh sách biên tập có quy tắc đối chiếu, không phải hệ thống hiểu mọi ngữ cảnh hoặc phát hiện mọi cách viết né tránh. Khi thêm dữ liệu hoặc nhận phản ánh, người duyệt cần rà lại nội dung đầy đủ, gồm các phương án nhiễu; bổ sung ID/nhóm từ phù hợp trước khi phát đề. Không mở rộng từ khóa chung như “đánh”, “tát”, “cu” vì dễ loại nhầm nghĩa thông thường.

Khi kiểm tra thủ công, cần rà: cấp toàn bộ 47 bộ đề từ kho hiện tại, số câu và ID không trùng, khớp loại câu, thay câu cố định bị chặn, không sửa kho nguồn/snapshot cũ, kiểm tra lựa chọn trắc nghiệm, Unicode và từ chối tạo lượt khi hết câu phù hợp.
