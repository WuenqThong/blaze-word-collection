from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_ROW_HEIGHT_RULE
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

root=Path(r'E:\blaze-voice-collection\docs\reports')
doc=Document()
s=doc.sections[0]
s.page_width=Inches(8.5);s.page_height=Inches(11)
s.top_margin=s.bottom_margin=Inches(.7)
s.left_margin=s.right_margin=Inches(.8)
for name,size in [('Normal',11),('Title',23),('Heading 1',16),('Heading 2',12)]:
 st=doc.styles[name];st.font.name='Arial';st.font.size=Pt(size);st.font.color.rgb=RGBColor(0,0,0)
 st.paragraph_format.space_after=Pt(7)
 st.paragraph_format.line_spacing=1.12
doc.styles['Normal'].paragraph_format.widow_control=True
h=s.header.paragraphs[0];h.text='APPDICHTHUAT   |   BÁO CÁO CHỨC NĂNG ỨNG DỤNG'
h.runs[0].font.size=Pt(8)
f=s.footer.paragraphs[0];f.alignment=WD_ALIGN_PARAGRAPH.RIGHT
f.add_run('Trang ')
fld=OxmlElement('w:fldSimple');fld.set(qn('w:instr'),'PAGE');f._p.append(fld)

def p(t):doc.add_paragraph(t)
def bullet(t):doc.add_paragraph(t,style='List Bullet')
def heading(t):doc.add_heading(t,1)
def new():doc.add_page_break()
def photo(n,label):
 doc.add_heading('Vị trí chèn ảnh giao diện',2)
 t=doc.add_table(rows=1,cols=1);t.autofit=False;t.columns[0].width=Inches(6.9)
 row=t.rows[0];row.height=Inches(2.65);row.height_rule=WD_ROW_HEIGHT_RULE.AT_LEAST
 cell=row.cells[0];cell.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
 pp=cell.paragraphs[0];pp.alignment=WD_ALIGN_PARAGRAPH.CENTER
 pp.add_run('CHÈN ẢNH '+str(n)+' TẠI ĐÂY\n'+label+'\n\nXóa dòng hướng dẫn rồi chọn Insert → Pictures').font.size=Pt(10)
 pr=t._tbl.tblPr;b=OxmlElement('w:tblBorders')
 for edge in ['top','left','bottom','right']:
  x=OxmlElement('w:'+edge);x.set(qn('w:val'),'dashed');x.set(qn('w:sz'),'6');x.set(qn('w:color'),'B7B7B7');b.append(x)
 pr.append(b)
 cap=doc.add_paragraph('Hình '+str(n)+'. '+label);cap.runs[0].italic=True;cap.runs[0].font.size=Pt(9)
def screen(num,title,intro,items,limit,caption):
 new();heading(str(num+1)+' '+title);p(intro)
 for item in items:bullet(item)
 p('Trạng thái triển khai: '+limit)
 photo(num,caption)

doc.add_paragraph('Báo cáo các chức năng app đã triển khai',style='Title')
p('Dự án APPDICHTHUAT và Blaze Voice Collection')
p('Phạm vi tổng hợp đến ngày 04 tháng 11 năm 2026\nNgày biên soạn 05 tháng 11 năm 2026')
heading('1 Tổng quan kết quả thực hiện')
p('App đã hình thành luồng thu thập dữ liệu phương ngữ từ người đóng góp đến người kiểm duyệt và điều phối viên. Phần giao diện DEMO cho phép chơi game 10 câu, quản lý lượt chơi, tiếp nhận và duyệt mẫu, quản lý bộ đề, theo dõi số liệu và thử quy trình xuất dữ liệu. Một nhánh phương ngữ riêng đã có API backend để tiếp nhận và xử lý mẫu.')
p('Báo cáo này chỉ tổng hợp phần ứng dụng đã triển khai, gồm chức năng, giao diện, hành vi xử lý và giới hạn hiện tại. Các khung ảnh ở từng mục được chừa sẵn để bổ sung ảnh chụp thực tế trước khi nộp quản lý.')
for t in ['Giao diện theo vai trò: khách, người đóng góp, reviewer và điều phối viên.', 'Luồng game hoàn chỉnh từ bắt đầu, trả lời, lưu nháp đến gửi lượt và xem trong quản trị.', 'Các màn hỗ trợ quản lý dữ liệu, quyền sử dụng, kiểm duyệt, chiến dịch, thống kê và dataset.', 'Bản DEMO lưu dữ liệu trong trình duyệt bằng IndexedDB; nhánh có API thật được trình bày riêng ở cuối báo cáo.']:bullet(t)
p('Các tính năng AI, huấn luyện và credit hiện có giao diện hoặc kịch bản mô phỏng. Chưa xem các màn này là dịch vụ AI, hệ thống thưởng hoặc hệ thống thu thập dữ liệu production đã vận hành.')

screen(1,'Trang chủ và điều hướng theo vai trò',
'Đã xây dựng trang chủ giới thiệu hoạt động đóng góp phương ngữ, đưa thao tác chơi game thành điểm bắt đầu chính và điều chỉnh menu phù hợp với từng vai trò.',[
'Khách thấy menu ngang Trang chủ và Chơi game; phần quyền dữ liệu đặt tại footer.',
'Người đóng góp có mục Lượt chơi của tôi để xem lại các lượt thuộc mình.',
'Reviewer có Hàng chờ và Đã xử lý, giới hạn theo phạm vi kiểm duyệt.',
'Admin có năm nhóm Tổng quan, Quản lý game, Lượt chơi, Dữ liệu và kiểm duyệt, Cài đặt.',
'Giao diện sử dụng font Inter tự host hỗ trợ tiếng Việt, menu thu gọn trên mobile và bảng dài cuộn trong vùng riêng.'
], 'Đã triển khai phân luồng frontend DEMO. Công cụ đổi vai trò nằm ở /demo/internal; quyền DEMO chưa thay thế xác thực và phân quyền server.', 'Trang chủ và menu điều hướng theo vai trò')

screen(2,'Bắt đầu và khôi phục phiên chơi',
'Đã triển khai luồng bắt đầu chơi, tiếp nhận đồng ý sử dụng dữ liệu và tự động cấp bộ đề phù hợp.',[
'Cho phép tham gia ẩn danh; tách quyền tiếp nhận, huấn luyện, công khai và audio.',
'Nút bắt đầu tự phân đề, ưu tiên đề chưa hoàn thành và cân bằng lượt trong kho DEMO.',
'Nếu có phiên đang làm, hiển thị Tiếp tục chơi và giữ nguyên dữ liệu, consent, snapshot đề.',
'Khi hoàn thành hết đề hợp lệ, cho chơi lại và gắn cờ lượt lặp; hai thao tác bắt đầu đồng thời chỉ tạo một phiên.',
'Có mã phiên và mã khôi phục để nhận lại tiến độ trong kho trình duyệt hiện tại.'
], 'Hoạt động trong IndexedDB trên cùng trình duyệt; chưa đồng bộ tiến độ giữa thiết bị hoặc cấp phiên từ server.', 'Màn bắt đầu chơi và tiếp tục phiên đang làm')

screen(3,'Game 10 câu và các dạng trả lời',
'Đã triển khai luồng làm bài 10 câu, kết hợp câu kiểm tra tín hiệu và câu đóng góp mở để thu thập cách dùng phương ngữ.',[
'Cấu trúc gồm câu cổng GATE, giải thích LEXEME, kiểm tra GOLD, viết câu SENTENCE, góp từ OPEN_WORD và góp câu OPEN_SENTENCE.',
'Có trắc nghiệm, trả lời ngắn, điền từ, giải thích nghĩa, viết lại câu và đóng góp mới.',
'Hỗ trợ câu trước, câu tiếp theo, bỏ qua, thanh tiến trình và tự lưu nháp; tải lại trang giữ nội dung.',
'Lưu lựa chọn trắc nghiệm theo ID; trộn phương án một lần và giữ thứ tự trong snapshot.',
'Giữ lịch sử lần thử, chấp nhận biến thể cấu hình; sửa nháp làm mất hiệu lực điểm cũ đến khi xác nhận lại. Câu mở không chấm tự động.'
], 'Bộ câu và điểm hiện dùng để trình diễn. Câu gọi là GOLD trong cấu trúc DEMO chưa được xem là gold chuyên gia xác minh.', 'Giao diện câu hỏi trong game với tiến trình và nút điều hướng')

screen(4,'Hoàn tất lượt và lịch sử đóng góp',
'Đã triển khai bước kết thúc bài, bổ sung thông tin vùng và lưu lại toàn bộ diễn biến của lượt chơi.',[
'Người chơi tự khai nơi sống, nơi lớn lên, nơi dùng phương ngữ và có lựa chọn Không chắc.',
'Cho phép xem lại câu trả lời trước khi gửi; nháp chưa xác nhận không bị tính là câu hoàn tất.',
'Gửi lượt theo cơ chế idempotent, tránh tạo nhiều lượt khi thử gửi lại cùng phiên.',
'Mỗi lượt giữ snapshot đề, đáp án hoặc bỏ qua, lần thử, điểm và thời điểm; câu mở tạo ứng viên RAW.',
'Có lịch sử lượt, quản lý quyền và rút lượt hoặc mẫu; điều kiện công khai và xuất dữ liệu được cập nhật theo quyền.'
], 'Dữ liệu được lưu cục bộ trong DEMO. Mã khôi phục không truy cập được kho trên máy khác; file đã tải ra ngoài không thể thu hồi từ xa.', 'Màn xem lại và xác nhận gửi lượt chơi')

screen(5,'Quản trị ngân hàng câu và bộ đề',
'Đã xây dựng công cụ quản lý nội dung game, giúp điều phối viên biên soạn câu, cấu hình đáp án và kiểm tra bộ đề trước khi mở.',[
'Ngân hàng câu có loại câu, dạng trả lời, đáp án, biến thể và thông tin nguồn.',
'Có chỉnh phương án trắc nghiệm, đáp án đúng, mẫu điền từ và xem trước câu hỏi.',
'Kiểm tra đủ 10 vị trí và đúng loại; chặn cấu hình thiếu lựa chọn, trùng phương án hoặc sai chỗ trống.',
'Đề đã phát hành phải clone để sửa; có phiên bản, xem thử, phát hành DEMO và đóng đề. Lượt đang làm giữ snapshot cũ.',
'Bổ sung ba bộ đề 30 câu: Cách nói hằng ngày, Trong bếp ngoài chợ, Hiểu đúng theo ngữ cảnh; cập nhật kho cũ không reset phiên.'
], 'Có màn hình và luật quản lý trong DEMO. Phát hành thu thật bị chặn khi thiếu xác minh câu, gold hoặc quyền nguồn.', 'Màn quản trị ngân hàng câu hỏi và cấu hình bộ đề')

screen(6,'Quản lý lượt chơi và xử lý trùng',
'Đã triển khai màn quản trị để truy vết lượt chơi và hạn chế việc đóng góp lặp làm tăng sai số liệu.',[
'Xem từng lượt với đủ 10 vị trí, câu trả lời, lần thử, thời điểm và snapshot đề.',
'Hiển thị dạng câu, nguồn tham chiếu và ID lựa chọn trong lịch sử thử.',
'Có nhãn và bộ lọc lượt đầu hoặc lượt lặp; dashboard thống kê riêng hai loại lượt.',
'Chuẩn hóa Unicode, chữ thường, khoảng trắng và dấu câu cuối để dò trùng; vẫn phân biệt dấu tiếng Việt và ngữ cảnh.',
'Mẫu trùng giữ RAW và chủ sở hữu riêng, gắn duplicateOf và HOLD; không vào hàng chờ mới, không đủ điều kiện xuất hoặc công khai và không tăng số mẫu mới.'
], 'Quy tắc đang chạy trong kho trình duyệt DEMO; chưa chống spam xuyên thiết bị hoặc kiểm soát trùng trên server.', 'Chi tiết lượt chơi trong quản trị và nhãn mẫu trùng')

screen(7,'Góp dữ liệu và đính kèm media',
'Đã xây dựng form đóng góp từ, cụm từ và câu cùng các nhiệm vụ gợi ngữ cảnh, giúp người dùng mô tả cách dùng thực tế.',[
'Form có nghĩa, bản phổ thông, ngữ cảnh, từ loại, chủ đề, vùng, biến thể, từ khóa, nguồn và độ chắc chắn.',
'Có chín dạng nhiệm vụ: liệt kê nhanh, kể quy trình, sửa câu gượng, ảnh gọi vật, video câm, chuỗi họ từ, nhật ký từ, nhắn tin và từ nghề nghiệp.',
'Có phản hồi không biết hoặc không có từ riêng; ảnh và video do admin cấu hình làm ngữ cảnh.',
'Hỗ trợ thu âm bằng MediaRecorder, nghe lại, bỏ hoặc thu lại; tải audio, ảnh, video và nhập transcript.',
'Media Blob lưu trong IndexedDB; kiểm tra quyền media và audio trước các thao tác liên quan.'
], 'Các màn mở rộng còn giữ trong app và admin truy cập trực tiếp; không hiện trong menu khách. Media DEMO chưa upload server hoặc nhận dạng giọng nói tự động.', 'Form góp từ hoặc câu và khu vực thu âm đính kèm')

screen(8,'Hàng chờ kiểm duyệt và chuẩn hóa',
'Đã triển khai giao diện và quy tắc kiểm duyệt để giữ dữ liệu gốc, thu phiếu độc lập và xử lý bất đồng trước khi chuẩn hóa.',[
'RAW giữ riêng; có phiên bản bổ sung, nguồn, yêu cầu bổ sung và đối chiếu nội dung giữa các phiên bản.',
'Hàng chờ lọc theo vùng, người góp không tự duyệt; reviewer chưa gửi không nhìn thấy phiếu khác.',
'Phiếu sử dụng bốn tiêu chí đánh giá và kết quả VERIFIED, HOLD hoặc REJECT; bất đồng chuyển điều phối.',
'Có CURATED riêng, chuẩn hóa sense ID để gộp hoặc tách nghĩa mà vẫn giữ bản gốc và lịch sử phiếu.',
'Có thao tác QA audio và kiểm tra quyền trước khi đưa media vào phần công khai hoặc dataset.'
], 'Bản DEMO mô phỏng danh tính reviewer. Nhánh API thật có quy tắc hai phiếu và xử lý bất đồng, trình bày tại mục nền tảng kỹ thuật.', 'Hàng chờ kiểm duyệt và biểu mẫu đánh giá mẫu')

screen(9,'Dashboard chiến dịch và vận hành dữ liệu',
'Đã xây dựng các màn giúp điều phối viên theo dõi hoạt động, tổ chức chiến dịch và quản lý dữ liệu thử nghiệm.',[
'Dashboard hiển thị lượt bắt đầu, hoàn tất, vị trí dừng, số trả lời hoặc bỏ qua, số lần thử và tỷ lệ đúng.',
'Có so sánh hiệu quả đề, phương thức, dữ liệu trùng, VERIFIED và độ phủ vùng hoặc chủ đề.',
'Chiến dịch có vùng, chủ đề, nhiều bộ đề và tạo link hoặc QR; việc tự phân đề tuân theo phạm vi chiến dịch.',
'Import CSV, TSV và JSONL có mapping, preview lỗi hoặc trùng; dòng hợp lệ vào RAW, retry batch không nhân đôi. Giới hạn 5 MB và 1000 dòng.',
'Có audit trước và sau thao tác, lỗi và retry, backup hoặc restore kèm media; kiểm tra file backup trước khi thay thế kho.'
], 'Chỉ số và backup lấy từ kho DEMO. Link localhost chỉ dùng trên máy chạy app; vị trí dừng chưa phải kết luận người dùng bỏ cuộc.', 'Dashboard quản trị với số liệu lượt chơi và chất lượng dữ liệu')

screen(10,'Dataset từ điển và các màn mở rộng',
'Đã triển khai các giao diện thử nghiệm để xem đầu ra dữ liệu và hướng khai thác tiếp theo trong cùng ứng dụng.',[
'Dataset DEMO kiểm tra QA, consent, quyền nguồn và audio; có phiên bản, manifest, checksum SHA 256, data card và chia train/dev/test theo nhóm liên thông.',
'Từ điển lọc mẫu đủ duyệt và quyền; tìm không dấu hoặc gần đúng, lọc vùng, chủ đề, nghe audio đủ điều kiện và báo sai.',
'Game mở rộng có chọn câu theo vùng, độ khó và lịch sử; thành tích có huy hiệu, streak, leaderboard và điểm tham gia.',
'Các màn cộng đồng hỗ trợ so sánh cách gọi, sơ đồ vùng và đề xuất nhiệm vụ theo khoảng trống.',
'AI dịch có bộ quy tắc phiên bản, gợi ý, nhận phản hồi và benchmark minh họa. Có giao diện hỗ trợ transcript, job training/eval, log, retry và so sánh phiên bản.'
], 'Dataset gắn DEMO_ONLY; AI không gọi LLM hoặc ASR, job không train model thật. Credit chỉ mô phỏng hạn mức nội bộ, tắt mặc định và không quy đổi tiền.', 'Màn quản lý dataset hoặc từ điển trong bản DEMO')

new();heading('12 Nền tảng kỹ thuật đã triển khai')
doc.add_heading('Nhánh phương ngữ có API backend',2)
p('Đã xây dựng API /api/dialect và các bảng riêng tiền tố dialect_. Luồng có landing, hướng dẫn quyền, wizard bốn bước góp từ hoặc câu, nháp theo tài khoản, lịch sử và chi tiết mẫu, phiên bản bổ sung, hồ sơ vùng, rút mẫu và quản lý reviewer.')
p('Backend giữ RAW riêng; cập nhật nội dung tạo bản ghi mới. Hai phiếu độc lập cùng kết quả tạo quyết định; bất đồng cần điều phối viên không phải người góp hoặc người đã bỏ phiếu. Release chỉ lấy mẫu VERIFIED đủ phiếu, được xác nhận nguồn, đồng ý huấn luyện và chưa rút hoặc bị thay phiên bản. Tải release kiểm tra lại điều kiện và có manifest, checksum.')
p('Nhánh này chưa có chia train/dev/test trong release; chưa là gold hoặc benchmark. Các khả năng dataset và từ điển của DEMO không đồng nghĩa đã tích hợp vào API này.')
doc.add_heading('Kiến trúc giao diện DEMO',2)
p('Các module nằm tại frontend/src/features/demo. Luật nghiệp vụ tách khỏi giao diện; repository dùng transaction IndexedDB và lưu media Blob. Màn hình được tải riêng theo tuyến, có loading, lỗi, retry, điều hướng và chuyển focus. /demo chạy độc lập với xác thực backend; các route thật sử dụng nhánh xác thực riêng.')
doc.add_heading('Nền tảng audio và các module có sẵn',2)
p('Repository còn giữ nền tảng thu âm, phiên, dự án và các chức năng legacy. Đường dẫn /legacy cho phép truy cập phần cũ; các route dự án, roleplay, thưởng và rút tiền vẫn được giữ. Báo cáo không coi toàn bộ chức năng cũ là tính năng mới phát triển trong đợt phương ngữ.')

new();heading('13 Kết quả kiểm tra và mức độ hoàn thiện')
p('Theo lần kiểm chứng tổng hợp ngày 04/11/2026: frontend production build thành công với 535 module; backend đạt 6/6 kiểm thử. Bộ kiểm thử frontend đạt 45/47, còn hai ca lỗi khi giao diện đang ở bước mở DEMO, chưa tìm thấy thành phần cần thao tác. Vì vậy chưa ghi nhận toàn bộ kiểm thử frontend là đạt.')
p('Tài liệu bàn giao đã ghi nhận thử luồng game đủ 10 câu đến quản trị, phục hồi nháp, quyền và rút mẫu, import, backup, cấu hình đề và snapshot. Kiểm tra trình duyệt có desktop, mobile 390 × 844 và ảnh giao diện quản trị. Các kết quả này phản ánh phạm vi đã kiểm tra tại thời điểm bàn giao, chưa thay thế nghiệm thu mọi thiết bị.')
doc.add_heading('Những phần cần hoàn thiện để vận hành thật',2)
for t in ['Sửa hai kiểm thử frontend còn lỗi, xử lý lint còn tồn đọng và nghiệm thu thêm thiết bị, micro, accessibility.', 'Kết nối game, lượt chơi, chiến dịch, media, audit và dashboard với API, database và object storage.', 'Bổ sung danh tính, phân quyền server, rate limit, chống spam nhiều thiết bị và backup vận hành.', 'Duyệt bộ câu, đáp án, nguồn và consent với người có chuyên môn trước khi mở thu thập thật.', 'Tích hợp và đánh giá ASR, AI dịch, training hoặc hệ thống hạn mức thật nếu được đưa vào phạm vi tiếp theo.']:bullet(t)
doc.add_heading('Tài liệu đối chiếu trong dự án',2)
for t in ['docs/APPDICHTHUAT_DEMO_DELIVERY_2026-11-03.md', 'docs/ROLE_NAVIGATION_2026-11-03.md', 'docs/AUTO_GAME_ALLOCATION_2026-11-04.md', 'docs/DATASET_GAME_VARIETY_2026-11-04.md', 'docs/DIALECT_IMPLEMENTATION.md']:p(t)
out=root/'BAO_CAO_CHUC_NANG_APP_KEM_CHO_CHEN_ANH.docx'
doc.save(out)
print(out)
