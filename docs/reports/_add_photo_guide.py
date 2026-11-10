from pathlib import Path
from docx import Document
from docx.shared import Pt
from docx.oxml import OxmlElement
from docx.text.paragraph import Paragraph
root=Path(r'E:\blaze-voice-collection\docs\reports')
doc=Document(root/'BAO_CAO_CHUC_NANG_APP_KEM_CHO_CHEN_ANH.docx')
guides=[
('/demo','Mở trang chủ. Chụp logo, menu và khối giới thiệu có nút Chơi game; không cần chụp toàn trang dài.'),
('/demo/play','Đăng nhập rồi mở trang bắt đầu; chụp tiêu đề, quyền dữ liệu và nút Bắt đầu chơi hoặc Tiếp tục chơi.'),
('/demo/play','Bấm Bắt đầu chơi sau khi xác nhận quyền cần thiết. App tự chuyển /demo/game/<mã phiên>. Chụp một câu có nội dung, vùng trả lời, tiến trình và nút điều hướng.'),
('/demo/game/<mã phiên>','Dùng chính phiên ở ảnh 3, đi qua 10 câu bằng trả lời hoặc Bỏ qua nếu có. Nhập vùng ở cuối, bấm Xem lại 10 câu. Chụp màn Xem lại trước khi gửi cùng nút Gửi kết quả 10 câu; sau đó gửi để có dữ liệu cho ảnh 6.'),
('/demo/admin/questions','Dùng vai trò Điều phối viên. Bấm Xem / sửa một câu để hiện form và phần xem trước; chụp danh sách cùng vùng cấu hình. Nếu muốn minh họa bộ đề, chụp thêm /demo/admin/exams.'),
('/demo/admin/sessions','Dùng vai trò Điều phối viên, chọn lượt vừa gửi ở ảnh 4. Chụp mã lượt, trạng thái, nhãn lượt đầu hoặc lặp và bảng câu trả lời; cuộn xuống nếu bảng ở phía dưới.'),
('/demo/contribute','Dùng vai trò Điều phối viên để mở màn mở rộng. Chụp form từ hoặc câu cùng khu vực media; cuộn đến phần thu âm hoặc đính kèm nếu chưa thấy. Không cần gửi dữ liệu để chụp form.'),
('/demo/admin/review','Dùng Điều phối viên để xem hàng chờ, hoặc chọn Reviewer A ở trang nội bộ để minh họa đúng vai trò reviewer. Chọn mẫu trong hàng chờ và chụp nội dung cùng biểu mẫu đánh giá.'),
('/demo/admin/dashboard','Dùng Điều phối viên; mở sau khi đã gửi lượt ở ảnh 4 để có số liệu. Chụp các chỉ số tổng quan và biểu đồ hoặc bảng chính trong màn hình.'),
('/demo/admin/datasets','Dùng Điều phối viên. Chụp màn Dataset và bản xuất, gồm điều kiện dữ liệu và vùng tạo hoặc xem bản xuất. Có thể dùng /demo/dictionary nếu muốn minh họa từ điển thay cho dataset; đổi chú thích ảnh tương ứng.')
]
for idx,table in enumerate(doc.tables[:10]):
 route,steps=guides[idx]
 prev=table._tbl.getprevious()
 el=OxmlElement('w:p');prev.addprevious(el)
 pp=Paragraph(el,table._parent)
 pp.add_run('Cách chụp ảnh '+str(idx+1)+': ').bold=True
 pp.add_run('http://localhost:7777'+route+' — '+steps)
 for run in pp.runs:run.font.size=Pt(9)
 # Remove inherited decorative title border.
for name in ['Title']:
 pr=doc.styles[name]._element.find('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}pPr')
 if pr is not None:
  for node in list(pr):
   if node.tag.endswith('pBdr'):pr.remove(node)
doc.add_page_break()
doc.add_heading('Hướng dẫn mở app và chèn ảnh',1)
doc.add_paragraph('Hướng dẫn chụp được đối chiếu với mã nguồn ngày 05/11/2026. Phần nội dung báo cáo vẫn tổng hợp công việc đến 04/11/2026. Bản app hiện tại yêu cầu đăng nhập để chơi và mở các màn nội bộ; không áp dụng hướng dẫn cũ nói rằng toàn bộ DEMO không cần backend.')
doc.add_heading('Bước 1 Mở ứng dụng',2)
doc.add_paragraph('Nếu app đang chạy, mở http://localhost:7777/demo bằng Chrome hoặc Edge. Nếu trình duyệt báo không truy cập được, mở PowerShell và chạy hai dòng dưới đây, với điều kiện môi trường dự án đã được cài đặt:')
doc.add_paragraph('cd E:\\blaze-voice-collection\n.\\scripts\\start-local.ps1')
doc.add_paragraph('Script bật backend cổng 8765 và frontend cổng 7777. Sau khi báo sẵn sàng, mở lại trang. Nếu script báo thiếu dependency hoặc lỗi dịch vụ, cần xử lý lỗi khởi động trước; không chỉ đổi đường dẫn ảnh.')
doc.add_heading('Bước 2 Đăng nhập và chọn vai trò',2)
doc.add_paragraph('Mở http://localhost:7777/login và dùng tài khoản hiện có. Để chụp các màn quản trị, dùng tài khoản backend có quyền admin. Tài khoản đăng ký mới không tự có quyền admin; báo cáo này không cung cấp hoặc giả định mật khẩu đăng nhập.')
doc.add_paragraph('Sau khi đăng nhập admin, mở http://localhost:7777/demo/internal. Ở danh sách Vai trò DEMO, chọn Điều phối viên · admin để chụp ảnh 5 đến 10. Chọn Reviewer A · reviewer khi cần minh họa reviewer. Giữ Kịch bản là Bình thường. Công cụ đổi vai trò chỉ xuất hiện ở trang này khi tài khoản đăng nhập có quyền admin.')
doc.add_paragraph('Nếu thấy Cần đổi vai trò demo, quay lại trang nội bộ và chọn đúng vai trò. Nếu bị đưa về Đăng nhập hoặc báo lỗi phiên, kiểm tra đăng nhập và backend. Không bấm Khôi phục mẫu vì thao tác đó thay dữ liệu DEMO hiện tại.')
doc.add_heading('Bước 3 Chụp theo thứ tự khung ảnh',2)
doc.add_paragraph('Chụp ảnh 1, 2, 3, 4 theo luồng trang chủ → bắt đầu → làm game → xem lại. Sau ảnh 4, gửi lượt để ảnh 6 và 9 có dữ liệu. Dùng cùng trình duyệt và hồ sơ người dùng để giữ IndexedDB. Đổi sang Điều phối viên rồi chụp ảnh 5 đến 10 theo đường dẫn ghi ngay phía trên từng khung.')
doc.add_paragraph('Mã phiên trong /demo/game/<mã phiên> do app sinh ra khi bắt đầu chơi. Không gõ nguyên chuỗi <mã phiên> vào thanh địa chỉ. Mã lượt trong màn quản trị cũng được mở bằng cách chọn một lượt có trong danh sách.')
doc.add_heading('Bước 4 Chèn vào đúng khung trong Word',2)
doc.add_paragraph('Để trình duyệt ở mức thu phóng khoảng 100%. Nhấn Windows + Shift + S, kéo chọn vùng app cần chụp rồi mở Word. Bấm trong khung đúng số, xóa chữ hướng dẫn trong khung và nhấn Ctrl + V. Giữ chú thích Hình bên dưới.')
doc.add_paragraph('Chọn ảnh, đặt Wrap Text là In Line with Text và kéo từ góc để giữ tỷ lệ. Chiều rộng tối đa khoảng 16 đến 17 cm. Nếu ảnh cao làm tràn trang, cắt gọn vùng không cần thiết hoặc thu nhỏ vừa trang; không kéo méo ảnh. Có thể lưu ảnh thành PNG rồi dùng Insert → Pictures thay cho dán trực tiếp.')
doc.add_paragraph('Nếu hàng chờ hoặc dataset chưa có mẫu đủ điều kiện, chụp đúng trạng thái trống hiện có; không ghi trong chú thích rằng dữ liệu đã được duyệt hoặc đã xuất khi chưa thực hiện. Một ảnh minh họa cho mỗi khung là đủ; có thể bổ sung ảnh phụ và đánh số 5a, 5b nếu cần.')
out=root/'BAO_CAO_APP_CO_HUONG_DAN_CHUP_ANH.docx'
doc.save(out)
print(out)
