# Game từ ngữ địa phương 10 câu — kiểm tra ngày 03/11/2026

> **Cập nhật sau báo cáo này:** đã triển khai game 10 câu và quản trị trong frontend DEMO tại `/demo`. Kết luận “chưa có game trong code” bên dưới mô tả thời điểm kiểm tra trước implementation. Xem [bàn giao hiện tại](APPDICHTHUAT_DEMO_DELIVERY_2026-11-03.md). Thu dữ liệu thật vẫn cần backend và gold/quyền nguồn được duyệt.

## Kết luận

**Đã có tài liệu mô tả game 10 câu. Chưa có chức năng game 10 câu trong code của project này. Ngân hàng câu tìm thấy mới là template, chưa đủ nội dung để mở chơi.**

File audit đính kèm không phải bản đặc tả game đầy đủ: chỉ nhắc mini-game/gold và các quyết định chưa chốt. Khi lần theo tài liệu gốc đã tìm được flow Q01–Q10 và question bank.

## Nguồn đã đọc

1. [Tóm tắt phương án web mini-game, cập nhật 20/10/2026](C:/Users/THONG/Documents/ChatGPT/appdichthuat/reports/phuong_an_thu_thap_data_2026_10_20/00_TOM_TAT_PHUONG_AN.md).
2. [Roadmap và checklist webgame 20/10/2026](C:/Users/THONG/Documents/ChatGPT/appdichthuat/reports/roadmap_webgame_2026_10_20/ROADMAP_CHECKLIST_APPDICHTHUAT_WEBGAME_2026-10-20.md).
3. [Kế hoạch phân công 21/10/2026](C:/Users/THONG/Documents/ChatGPT/appdichthuat/reports/PLAN_PHAN_CONG_APPDICHTHUAT_2026-10-21.md).
4. [Question bank template](C:/Users/THONG/Documents/ChatGPT/appdichthuat/reports/phuong_an_thu_thap_data_2026_10_20/05_question_bank_pilot_TEMPLATE.csv).
5. [Feature audit 02/11/2026](C:/Users/THONG/Documents/ChatGPT/appdichthuat/reports/FEATURE_AUDIT_APP_TU_NGU_DIA_PHUONG_2026-11-02.md).

## Cấu trúc 10 câu đã được mô tả

| Mã | Loại trong question bank | Mục đích |
|---|---|---|
| Q01 | GATE | Câu hiệu chỉnh / gold thứ nhất |
| Q02 | GATE | Câu hiệu chỉnh / gold thứ hai |
| Q03 | GATE | Câu hiệu chỉnh / gold thứ ba |
| Q04 | LEXEME | Giải nghĩa từ/cụm từ theo ngữ cảnh |
| Q05 | LEXEME | Giải nghĩa biến thể vùng |
| Q06 | GOLD_CHECK | Câu gold xen kẽ thứ nhất |
| Q07 | SENTENCE | Diễn đạt câu phương ngữ về tiếng Việt phổ thông |
| Q08 | GOLD_CHECK | Câu gold xen kẽ thứ hai |
| Q09 | OPEN_LEXEME | Góp từ mới và nghĩa |
| Q10 | OPEN_SENTENCE | Góp câu thực dùng và ngữ cảnh |

Phương án còn mô tả mở link/QR → mục đích/consent → câu hỏi → khai vùng hiện sống/nơi lớn lên → hoàn tất. Thưởng/token chỉ sau khi được duyệt. Câu trả lời mới phải đi vào RAW/DRAFT trước khi review.

## Dữ liệu câu hỏi chưa sẵn sàng

CSV có 10 dòng Q01–Q10, version `v0.1`, đều `PENDING_REVIEW`. Các cột `question_text`, `answer_set_approved`, `dialect_area`, `source_ref`, `approver_codes` đang trống. Đây là **khung question bank**, không phải 10 câu thật đã được duyệt. Không tự điền câu phương ngữ hoặc tự gắn VERIFIED để làm demo như sản phẩm thật.

Thông tin “0 VERIFIED” trong phương án là số liệu được ghi tại thời điểm soạn tài liệu; lần kiểm tra này không coi đó là số lượng hiện tại của mọi dataset trên máy. Kết luận chưa sẵn sàng ở đây dựa trực tiếp vào CSV template đã đọc và code hiện tại.

## Các tài liệu đang mâu thuẫn

| Vấn đề | Phương án/roadmap 20/10 | Kế hoạch phân công 21/10 | Xử lý |
|---|---|---|---|
| Q01–Q03 | Đúng 3/3 mới đi tiếp, có thử lại/biến thể | Mọi câu có thể bỏ qua, Q01–Q03 chỉ đo chất lượng, không khóa 3/3 | Chưa có bằng chứng phê duyệt quyết định cuối. Không hard-code cổng loại trong lần sửa giao diện này |
| Số reviewer | Phương án yêu cầu ít nhất 3 người đủ điều kiện vùng | Các tài liệu mới hơn vẫn yêu cầu SOP được chốt | API dialect hiện dùng 2 phiếu đồng thuận; không được lấy đó làm luật game đã duyệt |
| Thưởng | Token AI có hạn mức nếu quản lý duyệt | Thưởng vẫn có điều kiện ngân sách/quy tắc | Không có cam kết thưởng hoặc dùng ví tiền legacy cho game |

Bản 21/10 mới hơn là một hướng đề xuất đáng xem xét, nhưng ngày cập nhật không tự chứng minh đã được phê duyệt.

## Kiểm tra triển khai hiện tại

- Router frontend có góp từ/câu, lịch sử mẫu, review, nguồn và release; chưa có route chơi Q01–Q10.
- Model/API dialect chưa có question bank, phiên bản bộ câu, survey/game session, per-question answer/skip, resume session hoặc chấm đáp án đã duyệt.
- Roleplay/audio legacy có nhiệm vụ riêng, không phải mini-game phương ngữ 10 câu.
- Frontend mới giới thiệu mini-game ở trạng thái **đang chuẩn bị** và dẫn tới phần giải thích; không có nút chơi giả hoặc gửi dữ liệu game vào endpoint góp mẫu đơn lẻ.

## Điều kiện để triển khai tiếp

1. Chốt luật skip/không biết/thử lại và vai trò Q01–Q03; tách đánh giá chất lượng phiên khỏi việc gạt bỏ ý kiến khác đáp án tham chiếu.
2. Điền và duyệt question bank có nguồn, phạm vi vùng, đáp án biến thể, approver và version; ưu tiên 5 câu hiệu chỉnh Q01–Q03/Q06/Q08.
3. Thiết kế API/session lưu consent, prompt version, câu trả lời nguyên bản, skip/unknown và vùng tự khai; có idempotency, khôi phục và rút mẫu.
4. Game UI: mở đầu → consent → 10 câu với tiến trình → metadata vùng → xem lại → hoàn tất có mã; có nhánh lỗi mạng và tiếp tục phiên.
5. Đưa câu trả lời mở vào RAW, review theo SOP đã chốt; score chỉ là tín hiệu chất lượng, không tự chuyển thành VERIFIED.

Việc người dùng yêu cầu ở lượt này là kiểm tra tài liệu game và làm lại frontend theo audit. Ngân hàng câu và backend game chưa được thay thế bằng dữ liệu giả trong lần thực hiện này.
