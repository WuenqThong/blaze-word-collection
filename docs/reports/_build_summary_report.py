from __future__ import annotations

from datetime import date
from pathlib import Path

from docx import Document
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


ROOT = Path(r"E:\blaze-voice-collection")
OUT = ROOT / "docs" / "reports" / "BAO_CAO_TONG_HOP_APPDICHTHUAT_13_10_DEN_04_11_2026.docx"
OUT.parent.mkdir(parents=True, exist_ok=True)

NAVY = RGBColor(27, 54, 91)
INK = RGBColor(30, 42, 56)
SLATE = RGBColor(81, 98, 114)
GRAY = "D9D9D9"
PALE = "F2F6FA"

doc = Document()
sec = doc.sections[0]
sec.page_width = Inches(8.5)
sec.page_height = Inches(11)
sec.top_margin = Inches(0.69)
sec.bottom_margin = Inches(0.70)
sec.left_margin = Inches(0.76)
sec.right_margin = Inches(0.76)
sec.header_distance = Inches(0.35)
sec.footer_distance = Inches(0.37)


def style_font(style_name: str, size: float, bold=False, color=INK):
    style = doc.styles[style_name]
    style.font.name = "Arial"
    style.font.size = Pt(size)
    style.font.bold = bold
    style.font.color.rgb = color
    style._element.rPr.rFonts.set(qn("w:eastAsia"), "Arial")
    return style


normal = style_font("Normal", 10.35)
normal.paragraph_format.space_after = Pt(5.0)
normal.paragraph_format.line_spacing = 1.16
normal.paragraph_format.widow_control = True

title = style_font("Title", 22.5, True, RGBColor(0, 0, 0))
title.paragraph_format.space_before = Pt(0)
title.paragraph_format.space_after = Pt(9)
title.paragraph_format.keep_with_next = True

for name, size, space_before, space_after in [
    ("Heading 1", 15.0, 14, 7),
    ("Heading 2", 11.5, 9, 4),
]:
    st = style_font(name, size, True, NAVY)
    st.paragraph_format.space_before = Pt(space_before)
    st.paragraph_format.space_after = Pt(space_after)
    st.paragraph_format.keep_with_next = True
    st.paragraph_format.keep_together = True


def shade(cell, color: str):
    tcpr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), color)
    tcpr.append(shd)


def borders(table):
    tblpr = table._tbl.tblPr
    el = OxmlElement("w:tblBorders")
    for side in ("top", "left", "bottom", "right", "insideH", "insideV"):
        edge = OxmlElement("w:" + side)
        edge.set(qn("w:val"), "single")
        edge.set(qn("w:sz"), "4")
        edge.set(qn("w:color"), GRAY)
        el.append(edge)
    tblpr.append(el)


def margins_cell(cell, top=90, start=105, bottom=85, end=105):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    mar = tcPr.first_child_found_in("w:tcMar")
    if mar is None:
        mar = OxmlElement("w:tcMar")
        tcPr.append(mar)
    for side, v in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        item = mar.find(qn("w:" + side))
        if item is None:
            item = OxmlElement("w:" + side)
            mar.append(item)
        item.set(qn("w:w"), str(v))
        item.set(qn("w:type"), "dxa")


def make_table(headers, rows, widths=None, body_size=9.0):
    table = doc.add_table(rows=1, cols=len(headers))
    table.style = "Table Grid"
    table.autofit = False
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    if widths:
        for i, width in enumerate(widths):
            table.columns[i].width = Inches(width)
    for col, label in enumerate(headers):
        c = table.rows[0].cells[col]
        c.text = label
        c.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        shade(c, "1B365B")
        margins_cell(c, 105, 115, 105, 115)
        for p in c.paragraphs:
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.space_after = Pt(0)
            for r in p.runs:
                r.bold = True
                r.font.size = Pt(9.0)
                r.font.name = "Arial"
                r.font.color.rgb = RGBColor(255, 255, 255)
    hdr = table.rows[0]._tr.get_or_add_trPr()
    rep = OxmlElement("w:tblHeader")
    rep.set(qn("w:val"), "true")
    hdr.append(rep)
    for ridx, values in enumerate(rows):
        cells = table.add_row().cells
        for col, value in enumerate(values):
            c = cells[col]
            c.text = str(value)
            c.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            margins_cell(c)
            if ridx % 2:
                shade(c, PALE)
            for p in c.paragraphs:
                p.paragraph_format.space_after = Pt(0)
                p.paragraph_format.line_spacing = 1.1
                if len(headers) <= 4 and col == 0 and len(str(value)) <= 15:
                    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                for r in p.runs:
                    r.font.size = Pt(body_size)
                    r.font.name = "Arial"
                    r.font.color.rgb = INK
    borders(table)
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(2)
    return table


def para(text: str, boldlead: str | None = None, italic=False):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    if boldlead and text.startswith(boldlead):
        r = p.add_run(boldlead)
        r.bold = True
        t = p.add_run(text[len(boldlead):])
        t.italic = italic
    else:
        r = p.add_run(text)
        r.italic = italic
    return p


def bullet(text: str):
    p = doc.add_paragraph(style="List Bullet")
    p.paragraph_format.left_indent = Inches(0.19)
    p.paragraph_format.first_line_indent = Inches(-0.1)
    p.paragraph_format.space_after = Pt(4)
    p.add_run(text)
    return p


def h1(text):
    return doc.add_paragraph(text, style="Heading 1")


def h2(text):
    return doc.add_paragraph(text, style="Heading 2")


def small_note(text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(1)
    p.paragraph_format.space_after = Pt(7)
    r = p.add_run(text)
    r.italic = True
    r.font.size = Pt(9.0)
    r.font.color.rgb = SLATE


# Header & footer
header = sec.header.paragraphs[0]
header.text = "APPDICHTHUAT  |  BÁO CÁO TỔNG HỢP CÔNG VIỆC"
header.alignment = WD_ALIGN_PARAGRAPH.RIGHT
for run in header.runs:
    run.font.name = "Arial"
    run.font.size = Pt(7.6)
    run.font.color.rgb = SLATE

footer = sec.footer.paragraphs[0]
footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
fr = footer.add_run("Bản tổng hợp ngày 04/11/2026  •  Trang ")
fr.font.size = Pt(8)
fr.font.color.rgb = SLATE
fld = OxmlElement("w:fldSimple")
fld.set(qn("w:instr"), "PAGE")
footer._p.append(fld)


# Cover
doc.add_paragraph("BÁO CÁO TỔNG HỢP CÔNG VIỆC", style="Title")
p = doc.add_paragraph("Dự án APPDICHTHUAT và Blaze Voice Collection")
p.paragraph_format.space_after = Pt(10)
for r in p.runs:
    r.font.size = Pt(15)
    r.font.color.rgb = NAVY
    r.bold = True
doc.add_paragraph("Giai đoạn từ ngày 13 tháng 10 đến ngày 04 tháng 11 năm 2026")
doc.add_paragraph("Tài liệu báo cáo tiến độ, sản phẩm bàn giao, kết quả kiểm tra và các nội dung cần quản lý phê duyệt")
doc.add_paragraph("")
make_table(
    ["Thông tin", "Nội dung"],
    [
        ("Kính gửi", "Anh quản lý dự án"),
        ("Phạm vi tổng hợp", "Các hồ sơ kế hoạch APPDICHTHUAT, tài liệu dữ liệu và mã nguồn hiện có trong workspace E:\\blaze-voice-collection"),
        ("Thời điểm chốt số liệu", "Ngày 04/11/2026, trên tài liệu và mã nguồn được đối chiếu tại máy làm việc"),
        ("Mục đích", "Báo cáo những nội dung đã chuẩn bị và triển khai; phân định việc hoàn thành, bản thử nghiệm và việc còn phụ thuộc phê duyệt"),
    ],
    widths=[1.35, 5.45], body_size=9.5,
)
para("Báo cáo này tổng hợp bằng chứng từ tài liệu, hồ sơ nghiên cứu và repository. Khi chưa có biên bản giao việc hoặc lịch sử cá nhân tương ứng, báo cáo ghi theo kết quả của dự án, không tự gán toàn bộ đóng góp kỹ thuật hay nghiên cứu cho một cá nhân.")
small_note("Các mốc ghi là kế hoạch, chỉ tiêu hoặc trạng thái kiểm thử được phân biệt rõ; những số liệu ứng viên chưa được xem là dữ liệu huấn luyện đã xác minh.")
doc.add_page_break()


h1("1  Tóm tắt điều hành")
para("Trong khoảng 13/10–04/11/2026, công việc chuyển qua ba lớp: nghiên cứu dữ liệu phương ngữ Quảng Nam–Đà Nẵng và định hướng ứng dụng dịch; thiết kế phương án thu thập dữ liệu có kiểm duyệt qua trò chơi web; xây dựng các luồng phần mềm và bản DEMO để trình diễn cách thu mẫu, quản trị, đánh giá và thử nghiệm sản phẩm. Bản demo hiện là đầu ra dễ kiểm tra nhất của giai đoạn này.")
bullet("Đã lập các báo cáo khảo sát địa bàn, nguồn dữ liệu và nhiều phương án sản phẩm; hình thành quy trình RAW → REVIEW/HOLD/REJECT/VERIFIED, kiểm quyền nguồn và quyền của người góp.")
bullet("Đã xây dựng roadmap 6 tuần, checklist giao việc theo nhóm 4 người, ngân hàng câu mẫu, biểu mẫu dữ liệu và kế hoạch mở rộng phương thức thu từ/câu.")
bullet("Đã có nhánh API/backend dành cho đóng góp phương ngữ và một frontend DEMO hoạt động cục bộ, gồm game 10 câu, quản trị đề, phiên chơi, review, dashboard, import, media và các màn nâng cao được gắn nhãn mô phỏng.")
bullet("Ngày 04/11 bổ sung cơ chế phân đề tự động, tiếp tục phiên, đánh dấu lượt lặp, xử lý mẫu trùng, cùng ba bộ đề thử nghiệm có 30 câu theo nhiều định dạng.")
bullet("Chưa có đủ bằng chứng xác nhận bộ gold được chuyên gia duyệt, dataset VERIFIED/CURATED đạt điều kiện phát hành, dịch thuật/ASR thực, huấn luyện mô hình, triển khai production hoặc khảo sát cộng đồng thật.")
para("Kết quả kiểm tra thực hiện khi lập báo cáo: frontend production build thành công, backend 6/6 kiểm thử đạt; frontend có 45/47 ca đạt và 2 ca không đạt trong lần chạy, cần kiểm tra lại trước nghiệm thu. Những con số test tốt hơn ghi trong tài liệu bàn giao cũ được nêu như kết quả tại thời điểm ghi chép, không thay thế kết quả chạy mới.")

h1("2  Diễn biến định hướng và phạm vi")
h2("2.1  Từ dữ liệu phương ngữ đến công cụ hỗ trợ dịch")
para("Báo cáo ngày 13/10 đã phân nhóm địa bàn Đà Nẵng và Quảng Nam cũ, đồng thời đề xuất hình thức website điền từ 10 câu, kiểm tra chất lượng bằng câu hiệu chỉnh, thu thông tin khu vực và phân phối qua cộng đồng. Ngày 16/10 có hai hướng kế hoạch: (i) công cụ gợi ý chuyển lời trình bày địa phương sang tiếng Việt phổ thông để người dân tự kiểm tra; (ii) mô hình tiếp nhận phản ánh với hai tuyến ngôn ngữ và dashboard cho đơn vị tiếp nhận. Đây là tài liệu định hướng/đề xuất, chưa có chứng cứ đã triển khai dịch vụ gửi phản ánh đến công an hay hệ thống dịch thực tế.")
h2("2.2  Chuyển trọng tâm sang thu thập và kiểm duyệt dữ liệu")
para("Ngày 20–21/10, trọng tâm kế hoạch được cụ thể hóa thành web mini-game cộng đồng: mở link/QR, đọc mục đích và đồng ý cung cấp, chơi 10 câu có kiểm tra, đóng góp từ/câu mới, khai vùng sử dụng và đưa mẫu vào quy trình duyệt. Kế hoạch phỏng vấn trực tiếp 10–15 phút được thay bằng kênh cộng đồng tự nguyện qua web. Chức năng dịch AI được đưa về giai đoạn sau để tránh phụ thuộc vào dữ liệu chưa đủ chất lượng.")
h2("2.3  Phạm vi đang hiện diện trong mã nguồn")
para("Repository Blaze Voice Collection có nền tảng gốc cho công việc âm thanh, gán nhãn và phần thưởng. Các module phương ngữ và bản demo game là lớp mở rộng/điều chỉnh sau đó. Cần hiểu riêng ba mức trạng thái: mã backend phương ngữ có API thật; bản DEMO đầy đủ luồng nhưng dùng IndexedDB trong trình duyệt; còn dịch AI, ASR, tập huấn luyện và việc tiếp nhận phản ánh chính thức vẫn là đề xuất hoặc giao diện mô phỏng.")

h1("3  Dòng thời gian công việc từ đầu đến cuối")
make_table(
    ["Mốc", "Nội dung chính", "Minh chứng và trạng thái"],
    [
        ("13/10", "Phân vùng khảo sát Quảng Nam–Đà Nẵng; tìm nguồn GitHub, Hugging Face, YouTube; đề xuất website 10 câu và kiểm duyệt.", "Báo cáo công việc ngày 13/10; nghiên cứu/đề xuất."),
        ("16/10", "Soạn hai phương án MVP hỗ trợ chuyển lời trình bày và tiếp nhận phản ánh; xác lập nguyên tắc giữ nguyên thông tin trọng yếu.", "Hai tài liệu kế hoạch ngày 16/10; chưa phải sản phẩm triển khai."),
        ("19–20/10", "Kiểm kê số liệu dataset ứng viên; tài liệu phương án thu thập qua webgame, mẫu CSV, roadmap 6 tuần, checklist MVP.", "Bộ kế hoạch/biểu mẫu ngày 20/10."),
        ("21/10", "Thiết kế phân công bốn vai trò và 74 đầu việc; bảng hỏi quản lý; quyết định còn chờ về skip/gold/reviewer/consent/thưởng.", "Plan N1–N4, CSV giao việc; trạng thái kế hoạch."),
        ("23–29/10", "Đề xuất tổ chức họp, làm rõ task; mở rộng nghiên cứu nguồn và 10+24 cơ chế khơi từ; dựng roadmap dữ liệu theo phụ thuộc.", "Tài liệu nghiên cứu, đề xuất ngày 29/10."),
        ("31/10", "Repository ghi nhận commit nền tảng audio và commit tài liệu developer.", "Git log 096e7b7 và a1b6880; không đồng nghĩa đã giao nộp phần thay đổi tiếp theo."),
        ("02/11", "Rà soát tính năng app phương ngữ, các điểm thiếu và xung đột quy tắc/quyền/consent.", "Feature audit; đánh giá hiện trạng."),
        ("03/11", "Triển khai luồng góp từ/câu và API dialect; dựng frontend DEMO P0–P2, game 10 câu, quản trị, QA, canvas, tài liệu bàn giao.", "Mã nguồn và hồ sơ bàn giao ngày 03/11."),
        ("04/11", "Bổ sung tự phân đề, lượt lặp, xử lý trùng; 3 đề/30 câu nhiều kiểu; kiểm tra lại build/test và trạng thái Git.", "Hai tài liệu cập nhật 04/11 và kết quả lệnh kiểm thử thời điểm báo cáo."),
    ], widths=[0.77, 3.64, 2.39], body_size=8.8,
)
small_note("Thời điểm xuất hiện tài liệu/commit cho biết đã có bản ghi tương ứng; không tự coi là mốc phê duyệt, vận hành với người dùng thật hoặc thời gian đóng góp riêng của từng người.")

h1("4  Khảo sát dữ liệu và thiết kế quy trình thu thập")
h2("4.1  Phân vùng địa bàn và khảo sát nguồn ban đầu")
para("Tài liệu 13/10 chia địa bàn tham khảo thành sáu nhóm: đô thị trung tâm (Hải Châu, Thanh Khê, Sơn Trà), ven đô (Hòa Vang, Liên Chiểu), bắc Quảng Nam cũ (Điện Bàn, Hội An, Đại Lộc), trung Quảng Nam cũ (Duy Xuyên, Quế Sơn, Thăng Bình), nam Quảng Nam cũ (Tam Kỳ, Núi Thành) và miền núi phía Tây (Đông Giang, Tây Giang, Nam Trà My). Phương án chủ trương thu riêng nơi cư trú, nơi lớn lên và nơi dùng phương ngữ để hạn chế gán sai vùng.")
para("Đã khảo sát ý tưởng khai thác nguồn mở/tư liệu như GitHub, Hugging Face, YouTube, dữ liệu học thuật và nội dung cộng đồng; sang 29/10 mở rộng thành registry nguồn, cơ chế đánh giá giấy phép và phương pháp khơi từ theo ngữ cảnh. Đây là việc rà soát nguồn và đề xuất thu thập, chưa đủ bằng chứng cho việc nhập toàn bộ các nguồn vào kho dữ liệu hợp lệ.")
h2("4.2  Baseline và chất lượng dữ liệu đã ghi nhận")
make_table(
    ["Tập hoặc lô", "Số liệu ghi trong hồ sơ", "Cách sử dụng trong báo cáo"],
    [
        ("Bảng tham chiếu", "122 dòng", "Dữ liệu nền/đối chiếu; cần xác định nguồn, trùng và quyền."),
        ("Danh sách ứng viên", "722 đầu mục; 81 mục ưu tiên", "Nguồn ứng viên cần rà nghĩa, vùng và chứng cứ."),
        ("Lô trích xuất", "764 mục; tài liệu 16/10 còn ghi 757 ứng viên mở rộng chưa xác minh", "Trích xuất tham khảo, không tự gắn gold."),
        ("Lô câu 500", "428 REJECT, 72 HOLD, 0 VERIFIED", "Kết quả QA tại thời điểm tài liệu; chưa có câu đủ điều kiện từ lô này."),
        ("Câu mô phỏng", "420 câu ở 14 địa bàn lịch sử theo tài liệu 16/10", "Mẫu thử tổng hợp, không chứng minh lời nói bản địa thu thực."),
    ], widths=[1.23, 1.76, 3.81], body_size=8.9,
)
para("Các tập có thể chồng lấn nên không cộng lại thành tổng số mẫu riêng biệt. Kết quả 0 VERIFIED gắn với lô 500 câu tại thời điểm kiểm kê, không phải khẳng định vĩnh viễn rằng toàn bộ dự án không có mẫu nào được duyệt. Bộ 81 mục ưu tiên và các con số mục tiêu Gold là công việc cần xác minh, chưa tự được tính là đầu ra huấn luyện.")
h2("4.3  Mẫu dữ liệu và chu trình đánh giá")
para("Bộ hồ sơ 20/10 chuẩn bị source registry, bảng RAW contributions, review log, final decisions, question bank 10 vị trí, reward ledger và survey sessions. Các bảng TEMPLATE là khung cấu trúc để lưu dữ liệu và kiểm tra tiến độ; không phải danh sách người tham gia hoặc kết quả khảo sát đã hoàn tất. Chu trình dự kiến là tiếp nhận RAW, lưu nguồn và phiên bản, kiểm trùng/chuẩn hóa, reviewer độc lập, xử lý HOLD/bất đồng, rồi chỉ xét VERIFIED/CURATED và export khi đủ điều kiện.")
para("Question bank có 10 dòng Q01–Q10 phiên bản v0.1 ở trạng thái chờ duyệt; những trường nội dung câu, đáp án được phê duyệt, vùng/nguồn và người duyệt còn trống theo kiểm tra ghi trong hồ sơ ngày 03/11. Bộ đề được dựng sau đó là fixture/demo, không thay thế việc duyệt chính thức.")
h2("4.4  Phương thức thu thập được nghiên cứu ngày 29/10")
para("Đã viết tài liệu mở rộng nguồn, ý tưởng nguồn mới, phương pháp khơi từ và 24 cơ chế thu thập mới. Một số cách ưu tiên thí điểm gồm liệt kê nhanh từ theo chủ đề, kể lại quy trình, sửa câu nghe gượng, gọi tên vật qua ảnh, diễn tả video không lời, thu chuỗi họ từ, nhật ký từ địa phương, tin nhắn ngữ cảnh và thuật ngữ nghề nghiệp. Các phương thức đều cần cách lưu “không biết/không có từ riêng”, prompt trung tính, giấy phép media và phiếu kiểm duyệt.")
para("Hướng đi dữ liệu gồm tập trung chất lượng; đa nguồn có kiểm quyền; đo lỗ hổng theo vùng/chủ đề; mở từ sang câu có ngữ cảnh; nhận phản hồi tự nguyện từ sản phẩm; và chỉ thử nghiệm mô hình khi có tập đánh giá độc lập. Roadmap phụ thuộc A–H được soạn dưới dạng kế hoạch để quản lý gán người và lịch, chưa tự xác nhận đã thu dữ liệu thực tế theo từng cơ chế.")

h1("5  Công việc quản lý sản phẩm và kế hoạch triển khai")
para("Ngày 20/10 đã có phương án webgame 6 tuần với mục tiêu từ chuẩn bị ngân hàng câu, UI/API/DB, thí điểm nội bộ, phát QR có kiểm soát, xử lý HOLD đến tổng kết ngày 27/11. Sang 21/10, kế hoạch được cụ thể hóa cho nhóm cố định 4 người với 74 việc, bao gồm 38 việc web và 36 việc dataset; bảng giao việc ban đầu còn TODO, chưa có tên nhân sự được điền.")
make_table(
    ["Vai trò kế hoạch", "Trách nhiệm", "Đầu việc"],
    [
        ("N1 – Điều phối/PO", "Phạm vi, quyết định, consent, làm việc với quản lý, phát kênh, nghiệm thu", "15"),
        ("N2 – Full-stack", "Frontend, API, cơ sở dữ liệu, bảo mật, staging, xuất dữ liệu", "20"),
        ("N3 – Ngôn ngữ/Data", "Nguồn, nghĩa và vùng, câu hiệu chỉnh, điều phối người duyệt", "24"),
        ("N4 – UX/QA", "Giao diện, kiểm thử, pilot, đo lường và dashboard", "15"),
    ], widths=[1.55, 4.70, 0.55], body_size=9.0,
)
para("Đã chuẩn bị phiếu câu hỏi lấy yêu cầu quản lý và cách báo cáo tiến độ theo TODO/DOING/BLOCKED/DONE. Các mâu thuẫn cần cấp quản lý chọn được ghi lại thay vì tự chốt: Q01–Q03 buộc đúng 3/3 hay chỉ đo tín hiệu chất lượng và cho bỏ qua; ngưỡng 2 phiếu đồng thuận cộng phân xử hay 3 người độc lập; thẩm quyền duyệt gold/biến thể; tiêu chuẩn quyền nguồn và rút dữ liệu; chính sách token nếu có.")
para("Mốc 27/11 là kế hoạch demo/đánh giá nội bộ được đề xuất trong tài liệu tháng 10. Báo cáo hiện tại không coi toàn bộ 74 task là đã hoàn thành chỉ vì bản demo đã có nhiều màn hình.")

h1("6  Rà soát kiến trúc và phát triển kỹ thuật")
h2("6.1  Nền tảng repository khi tiếp nhận")
para("Hai commit có trong nhánh main ngày 31/10/2026 là 096e7b7 – Initial commit: Blaze Voice Collection (audio annotator with rewards), và a1b6880 – tái cấu trúc README/tài liệu developer. Nền tảng gốc sử dụng backend Python/FastAPI, SQLAlchemy, SQLite và MinIO, frontend React/TypeScript/Vite. Hệ thống audio có các luồng audio_label, audio_verify, QA, roleplay và cấu phần ví/điểm; các phần này là bối cảnh có sẵn của repository, không quy toàn bộ thành đầu việc mới của dự án từ/câu phương ngữ.")
para("Việc rà soát phát hiện điểm cần giữ ranh giới rõ giữa audio/roleplay/rewards cũ và luồng phương ngữ mới để tránh lẫn quyền truy cập, quy tắc thưởng hay trạng thái dữ liệu. Các route cũ được giữ khả năng truy cập qua vùng legacy theo tài liệu bàn giao mới.")
h2("6.2  Backend và giao diện phương ngữ có API thật")
para("Mã mới có app/models/dialect.py và app/routers/dialect.py, tích hợp nhóm API /api/dialect và các bảng riêng tiền tố dialect_. Các luồng được ghi nhận gồm: góp từ/câu, bản gốc và bản bổ sung, idempotency khi gửi lại, consent theo nhóm mục đích cơ bản, hồ sơ vùng tự khai, lịch sử/rút mẫu, danh sách reviewer, bỏ phiếu độc lập, xử lý bất đồng, kiểm tra nguồn và tạo release có manifest/checksum SHA-256.")
para("Frontend phần phương ngữ có landing và hướng dẫn quyền, wizard 4 bước, nháp theo tài khoản, lịch sử, reviewer và trang nguồn/release. Các sửa đổi điều hướng, responsive, lỗi/khôi phục, quyền role, label, layout và logo/typography được ghi trong bộ tài liệu 03/11.")
para("Kiểm toán chức năng 02–03/11 đã chỉ ra khoảng cách đáng chú ý: pilot API cần đăng nhập, chưa phải góp ẩn danh; reviewer scope và phân công vùng chưa được khóa chặt ở tất cả đường truy cập; đường HOLD và xử lý phiên bản thay thế còn bất cập; consent event và quyền nguồn còn đơn giản; chưa có CURATED tách RAW đầy đủ hoặc hệ thống truy ảnh hưởng release đã phát; thiếu nhiều lớp kiểm thử tải, đồng thời, quyền và vòng đời rút mẫu. Một số hiện tượng có ca tái hiện trong hồ sơ audit và cần coi là backlog P0.")
h2("6.3  Tách ranh giới API thật và bản DEMO")
para("Bản DEMO trình quản lý tại /demo và /demo/play hoạt động bằng IndexedDB trong cùng trình duyệt, không cần backend auth. Mã game chính nằm ở frontend/src/features/demo/; domain, repository và React provider tách riêng để giữ snapshot đề và xử lý lưu/khôi phục. Toàn bộ người dùng, quyền, điểm, import, review và job trình diễn ở nhánh này chỉ tác động kho demo; không được tự xem là quyền server hoặc dữ liệu production. Backend phương ngữ và UI pilot ở /collection là luồng kỹ thuật khác cần tích hợp nếu muốn thu thật.")

h1("7  Nội dung bản DEMO đã bàn giao ngày 03/11")
h2("7.1  Game 10 câu và nguyên tắc dữ liệu")
make_table(
    ["Vị trí", "Loại câu", "Mục đích"],
    [
        ("Q01–Q03", "GATE", "Câu hiệu chỉnh/chất lượng. Bản demo hỗ trợ chế độ strict hoặc signal; quy tắc thu thật chưa chốt."),
        ("Q04–Q05", "LEXEME", "Giải nghĩa từ, cụm từ và biến thể theo ngữ cảnh."),
        ("Q06", "GOLD_CHECK", "Câu kiểm tra xen kẽ thứ nhất."),
        ("Q07", "SENTENCE", "Diễn đạt câu phương ngữ thành tiếng Việt phổ thông."),
        ("Q08", "GOLD_CHECK", "Câu kiểm tra xen kẽ thứ hai."),
        ("Q09", "OPEN_LEXEME", "Đề xuất từ mới, nghĩa và ngữ cảnh."),
        ("Q10", "OPEN_SENTENCE", "Góp câu tự nhiên theo ngữ cảnh."),
    ], widths=[0.9, 1.33, 4.57], body_size=8.9,
)
para("Luồng gồm vào từ trang chủ, consent riêng collect/train/public/audio, tự lưu nháp và tiếp tục, xem lại/lưu lịch sử, ghi câu bỏ qua/lần thử, khai vùng tự khai, xác nhận gửi và nhận mã lượt. Quản trị xem toàn bộ 10 vị trí cùng snapshot đề, trạng thái câu trả lời và lịch sử thử; câu mở đi vào RAW ứng viên, không tự chuyển sang VERIFIED. Bản demo không xác nhận nguồn hay tính đúng ngôn ngữ của câu fixture.")
h2("7.2  Các màn P0, P1, P2")
make_table(
    ["Pha", "Hạng mục đã có ở bản DEMO", "Giới hạn hiện tại"],
    [
        ("P0", "Home; guest/consent; 10 câu; nháp, skip, retry, vùng; quản trị câu/đề/version; RAW; góp từ/câu; review; role/audit; rút mẫu", "Dữ liệu và quyền nội bộ trong trình duyệt, không kết nối server để thu thật."),
        ("P1", "Bí danh demo; media ghi âm/ảnh/video; 9 nhiệm vụ khơi từ; chiến dịch/QR; import CSV/TSV/JSONL; dashboard; CURATED demo, data card, split", "Không có ASR/upload/backend campaign thật; export chỉ DEMO_ONLY; kích thước import giới hạn."),
        ("P2", "Game thích ứng theo rule; thành tích/leaderboard; credit mô phỏng; cộng đồng; gợi ý dịch theo rule; UI job training/eval và phản hồi AI", "Không thanh toán hay chuyển token; không gọi mô hình dịch/ASR thật hoặc chạy training."),
    ], widths=[0.54, 3.55, 2.71], body_size=8.55,
)
para("Đã ghi nhận trình duyệt thực thử một lượt game và xem chi tiết Q01–Q10 trong admin. Các trang có hỗ trợ trạng thái trống, thông báo lỗi, khôi phục nháp và điều hướng; viewport 390×844 đã được rà trong tài liệu bàn giao. Canvas thiết kế được báo kiểm cấu trúc 8 artboard, đây là bằng chứng định dạng thiết kế chứ chưa thay thế kiểm thử toàn bộ giao diện thật.")
h2("7.3  Quy tắc kiểm duyệt và chống lỗi giao diện")
para("Các tình huống demo bao gồm reviewer bỏ phiếu riêng, không tự duyệt, chuyển điều phối khi bất đồng, xét nguồn/consent trước xuất hoặc hiển thị từ điển, import idempotent, backup/restore và lịch sử tác động. Tài liệu còn liệt kê nhiều lỗi UX/runtime đã sửa như trạng thái cũ sau HMR, cuộn trang, hiển thị lỗi media, restore thiếu kiểm tra và điểm gate cũ còn hiệu lực sau khi sửa nháp. Việc này có giá trị minh họa logic sản phẩm nhưng chưa đủ kiểm soát an ninh/đồng thời trên máy chủ.")

h1("8  Những cập nhật thực hiện ngày 04/11")
h2("8.1  Tự động phân đề và tránh lặp không cần thiết")
para("Luồng khách công khai chuyển sang nút Bắt đầu chơi tự chọn đề. Hệ thống ưu tiên tiếp tục phiên đang làm, sau đó chọn đề active chưa hoàn thành trong chiến dịch/vùng, cân bằng theo số lượt chưa rút. Khi đã chơi hết các đề đủ điều kiện, người tham gia mới được lặp; các lượt lặp có cờ riêng để quản trị lọc và dashboard tách thống kê. Dữ liệu thử nghiệm trong phiên đã bắt đầu giữ snapshot độc lập để tiếp tục ngay cả khi đề nguồn đóng.")
para("Luồng tạo đóng góp từ game bổ sung phát hiện trùng theo loại, nội dung, nghĩa, bản phổ thông, ngữ cảnh và vùng sau chuẩn hóa chữ/khoảng trắng/dấu câu. Mẫu bị trùng vẫn lưu RAW cùng nguồn và quyền của chủ mẫu, gắn liên kết duplicateOf/HOLD nhưng không tự vào hàng chờ reviewer mới, không tính như dữ liệu mới và không đủ điều kiện export. Phạm vi đối chiếu là kho demo của trình duyệt, chưa có chống trùng xuyên thiết bị.")
h2("8.2  Ba bộ đề 30 câu nhiều định dạng")
para("Ba bộ mới là “Cách nói hằng ngày”, “Trong bếp ngoài chợ”, “Hiểu đúng theo ngữ cảnh”, mỗi bộ 10 câu. Tài liệu ghi 8 câu/bộ tham chiếu từ các tab Dataset tổng hợp, Từ sinh hoạt thường ngày và Câu nói kiểm thử ĐN-QN trong Sheet Dataset1; hai câu cuối là yêu cầu góp từ/câu theo chủ đề. Không ghi sửa Sheet gốc.")
para("Các dạng được bổ sung: trắc nghiệm với ID phương án, trả lời ngắn, điền từ, giải nghĩa, viết lại và câu mở. Hệ thống lưu thứ tự lựa chọn của từng phiên, hỗ trợ chấm qua ID, giữ dấu tiếng Việt, lưu provenance theo dòng nguồn và validate cấu hình trước khi phát hành. Tất cả 30 câu là nội dung thử nghiệm, chưa duyệt bản địa và không phải câu gold để triển khai thật; Q06/Q08 trong các đề này dùng chế độ signal.")

h1("9  Kết quả kiểm chứng và trạng thái mã nguồn")
make_table(
    ["Thời điểm", "Hạng mục", "Kết quả và lưu ý"],
    [
        ("03/11 – tài liệu", "Frontend test, build, lint phạm vi demo", "Báo cáo bàn giao ghi 24 test/4 file đạt; build và scoped ESLint đạt."),
        ("03/11 – tài liệu", "Backend và canvas", "Báo cáo bàn giao ghi 5 test SQLite in-memory đạt; canvas 8 artboard đạt kiểm định định dạng."),
        ("04/11 – tài liệu", "Tính năng ba đề mới", "Tài liệu cập nhật ghi 39 test đạt; build và ESLint phần sửa đạt."),
        ("04/11 – kiểm tra lại", "Frontend production build", "Đạt; Vite xử lý 535 modules, hoàn thành build thành công."),
        ("04/11 – kiểm tra lại", "Backend unittest", "6/6 đạt; còn cảnh báo deprecation Starlette/httpx."),
        ("04/11 – kiểm tra lại", "Frontend Vitest toàn bộ", "45/47 ca đạt; 2 ca lỗi tại kiểm thử UI import và consent/start game vì màn hình còn “Đang mở giao diện DEMO…”. Cần tái hiện và xử lý ổn định."),
        ("03/11 – tài liệu", "ESLint toàn repository", "Theo báo cáo cũ còn 50 lỗi + 5 cảnh báo tại các module legacy; không ghi nhận lint toàn repo là sạch."),
    ], widths=[1.13, 1.75, 3.92], body_size=8.65,
)
para("Lần chạy frontend test mới được thực hiện cùng thời điểm kiểm tra build, vì vậy cần chạy lại có kiểm soát để xác định lỗi thời gian tải/chưa sẵn sàng hay lỗi logic. Không suy kết luận nguyên nhân chỉ từ dấu hiệu UI loading. Build thành công không đồng nghĩa mọi hành vi ứng dụng đã đạt tiêu chí QA.")
para("Tình trạng Git tại thời điểm báo cáo: nhánh main có hai commit ngày 31/10 nêu trên; nhiều file source/demo/tài liệu thuộc giai đoạn 02–04/11 đang modified hoặc untracked. Chưa thấy commit/push cho phần lớn cập nhật này trong lần kiểm tra. Báo cáo không tự nhận đã triển khai lên máy chủ hay đã tạo bản release chính thức.")

h1("10  Hiện trạng bàn giao và những việc chưa hoàn tất")
make_table(
    ["Hạng mục", "Trạng thái thực tế", "Điều còn thiếu trước khi coi là hoàn thành"],
    [
        ("Phương án/roadmap", "Đã lập tài liệu", "Quản lý duyệt phạm vi, trách nhiệm và lịch thực tế."),
        ("Nguồn và ứng viên dữ liệu", "Đã kiểm kê/đề xuất", "Rà từng nguồn, quyền, vùng, nghĩa và trùng, chuyên gia duyệt."),
        ("Pilot API phương ngữ", "Có mã backend/frontend", "Khắc phục P0 trong audit, xác thực reviewer scope, HOLD, consent, CURATED."),
        ("Web game P0–P2", "Đã có DEMO local", "Backend game thật, quyền server, đồng bộ, media, rate limit, vận hành."),
        ("30 câu nhiều định dạng", "Đã có đề DEMO", "Gold và đáp án biến thể được duyệt; thử với người dùng thật."),
        ("Dataset train/dev/test", "Có logic trình diễn", "CURATED và review đã được duyệt, phân nhóm tránh rò rỉ, data card và quyền xuất."),
        ("Dịch AI/ASR/training", "Mô phỏng/quy tắc", "Tập đánh giá chuẩn, kết nối model, chạy job và đo lường thực tế."),
        ("Release/triển khai", "Chưa có bằng chứng nghiệm thu production", "Fix regression, audit quyền, chạy thử đa thiết bị, commit/push, staging và phê duyệt."),
    ], widths=[1.35, 1.43, 4.02], body_size=8.55,
)
para("Rủi ro chất lượng lớn nhất là sử dụng từ/câu chưa xác minh để huấn luyện hoặc công bố; rủi ro vận hành là đánh đồng quyền demo với quyền server; rủi ro dữ liệu là chưa có vòng đời rút theo mục đích, phân xử HOLD, bản chuẩn hóa và ảnh hưởng release rõ ràng. Những hạng mục này phải được xử lý theo bằng chứng trước khi mở thu dữ liệu cộng đồng.")

h1("11  Kiến nghị triển khai và nội dung cần quản lý quyết định")
h2("11.1  Việc nên thực hiện theo thứ tự ưu tiên")
bullet("Ưu tiên 1: Chốt phạm vi pilot là thu từ/câu, phương án Q01–Q03, skip/không biết, chính sách review 2+1 hoặc 3 phiếu; cử đầu mối duyệt 5 câu hiệu chỉnh và tiêu chí quyền nguồn.")
bullet("Ưu tiên 2: Ổn định test frontend (hai ca đang lỗi), rà luồng thật của backend, sửa reviewer scope, HOLD, phiên bản, consent event, source registry và theo dõi release bị ảnh hưởng.")
bullet("Ưu tiên 3: Thiết lập CURATED, lineage RAW, review policy version, audit và export preview; hoàn thiện API game/phiên chơi, vai trò server, đồng bộ và backup thực tế.")
bullet("Ưu tiên 4: Tổ chức pilot tình nguyện có đồng ý với đề/gold được duyệt; đo tỷ lệ bắt đầu–hoàn tất, skip, từ mới không trùng, tỷ lệ VERIFIED, chất lượng theo vùng và chi phí/đóng góp hợp lệ.")
bullet("Ưu tiên 5: Chỉ khi đủ dữ liệu được phép dùng mới tách train/dev/test theo người/nguồn/họ câu và bắt đầu benchmark mô hình dịch. Xem thưởng, gamification quy đổi và tích hợp hệ thống bên ngoài là nhánh có điều kiện.")
h2("11.2  Quyết định đề nghị anh quản lý phản hồi")
make_table(
    ["Mã", "Nội dung cần chốt", "Ảnh hưởng nếu chưa chốt"],
    [
        ("D01", "Luật Q01–Q03, quyền bỏ qua và cách tính chất lượng", "Không thể đóng UX và rule thu thật."),
        ("D02", "Số người duyệt độc lập, quyền vùng và phân xử bất đồng", "Không thể khẳng định nhãn VERIFIED hợp lệ."),
        ("D03", "Nguồn/gold/đáp án và người ký duyệt", "Chỉ cho phép chạy đề DEMO."),
        ("D04", "Consent, giấy phép nguồn, lưu/xóa/rút mẫu và export", "Chưa mở thu thật hoặc release."),
        ("D05", "Phạm vi pilot, đối tượng người dùng và kênh QR/link", "Không công bố hoặc thu cộng đồng rộng."),
        ("D06", "Có triển khai token AI hay không, ngân sách và chống gian lận", "Điểm/credit chỉ là mô phỏng UX."),
    ], widths=[0.58, 3.14, 3.08], body_size=8.7,
)
para("Sau khi nhận phản hồi, cần lập một bảng tiến độ có người chịu trách nhiệm, deadline, liên kết đến minh chứng và trạng thái DONE/DOING/BLOCKED. Báo cáo tiếp theo nên gắn số liệu có mẫu số, lỗi còn mở, kết quả pilot và quyết định cần quản lý hỗ trợ; không chỉ liệt kê số lượng tính năng giao diện.")

h1("12  Danh mục tài liệu và minh chứng đối chiếu")
small_note("Những đường dẫn dưới đây là vị trí hồ sơ trên máy làm việc. Khi gửi quản lý qua môi trường khác, cần đính kèm hoặc chia sẻ bản lưu tương ứng vì đường dẫn nội bộ có thể không mở được từ thiết bị ngoài.")
h2("12.1  Hồ sơ nghiên cứu, kế hoạch và dataset")
for item in [
    "Bao_cao_cong_viec_2026-10-13.docx — phân vùng và đề xuất web 10 câu.",
    "Ke_hoach_cong_viec_du_an_dich_thuat_trinh_bao_2026-10-16.docx — hướng MVP gợi ý chuyển lời trình bày.",
    "Ke_hoach_MVP_tiep_nhan_phan_anh_va_dich_sang_tieng_Viet_2026-10-16.docx — phương án tiếp nhận phản ánh đa ngôn ngữ.",
    "phuong_an_thu_thap_data_2026_10_20/00_TOM_TAT_PHUONG_AN.md và các CSV 01–07 — phương án webgame và template dữ liệu.",
    "roadmap_webgame_2026_10_20/ROADMAP_CHECKLIST_APPDICHTHUAT_WEBGAME_2026-10-20.md — roadmap checklist.",
    "PLAN_PHAN_CONG_APPDICHTHUAT_NHOM_4_NGUOI_2026-10-21.md và BANG_GIAO_VIEC_APPDICHTHUAT_NHOM_4_NGUOI_2026-10-21.csv — 74 task dự kiến.",
    "PHIEU_CAU_HOI_LAY_YEU_CAU_QUAN_LY_APPDICHTHUAT_2026-10-21.md — quyết định nghiệp vụ cần hỏi.",
    "KE_HOACH_HUONG_DI_DATASET_KHONG_THOI_GIAN_2026-10-29.md — roadmap phụ thuộc A–H.",
    "NGUON_DU_LIEU_MO_RONG_2026-10-29.md, Y_TUONG_NGUON_MOI_2026-10-29.md, PHUONG_THUC_KHOI_TU_MOI_2026-10-29.md, 24_CO_CHE_THU_THAP_TU_NGU_MOI_2026-10-29.md — nghiên cứu kênh thu.",
]:
    bullet(item)
para("Nhóm tài liệu lịch sử đặt tại: C:\\Users\\THONG\\Documents\\ChatGPT\\appdichthuat\\reports\\.")
h2("12.2  Mã nguồn, audit và hồ sơ bàn giao kỹ thuật")
for item in [
    "docs/DIALECT_IMPLEMENTATION.md — backend/frontend đóng góp phương ngữ và giới hạn.",
    "docs/FEATURE_CONFLICT_AUDIT_2026-11-03.md — audit tính năng, xung đột P0 và phương án khắc phục.",
    "docs/GAME_10_QUESTIONS_STATUS_2026-11-03.md — đối chiếu kế hoạch game và trạng thái trước khi hoàn thiện DEMO.",
    "docs/APPDICHTHUAT_DEMO_DELIVERY_2026-11-03.md — các màn P0–P2, cách trình diễn và kết quả kiểm tra thời điểm 03/11.",
    "docs/FRONTEND_REDESIGN_DELIVERY_2026-11-03.md, docs/ROLE_NAVIGATION_2026-11-03.md, docs/TYPOGRAPHY_UPDATE_2026-11-03.md — điều chỉnh trải nghiệm và điều hướng.",
    "docs/AUTO_GAME_ALLOCATION_2026-11-04.md — phân đề/lượt lặp/chống trùng DEMO.",
    "docs/DATASET_GAME_VARIETY_2026-11-04.md — ba bộ đề, 30 câu và test.",
    "backend/app/models/dialect.py, backend/app/routers/dialect.py, frontend/src/features/dialect/ và frontend/src/features/demo/ — mã triển khai tương ứng.",
    "docs/screenshots/appdichthuat-desktop.png và docs/screenshots/appdichthuat-admin-session.png — ảnh minh họa nghiệm thu được liệt kê trong tài liệu bàn giao.",
]:
    bullet(item)
para("Nhóm hồ sơ kỹ thuật và mã nguồn đặt dưới: E:\\blaze-voice-collection\\. Giao diện DEMO khi chạy cục bộ: http://localhost:7777/demo và http://localhost:7777/demo/play. Địa chỉ localhost chỉ dùng trên máy chạy dịch vụ.")

doc.add_page_break()
h1("Phụ lục  Lời gửi anh quản lý")
para("Dạ anh ơi, trước hết em thật lòng xin lỗi anh vì đã không phản hồi tin nhắn công việc của anh trong suốt hai ngày vừa qua ạ.")
para("Mấy hôm nay em có lịch khám sức khỏe nghĩa vụ quân sự đợt 2, đồng thời đang làm thủ tục đăng ký tham gia nghĩa vụ Công an nên có khá nhiều giấy tờ và vấn đề phát sinh cần giải quyết. Tuy nhiên, em hiểu rằng dù bận đến đâu thì em vẫn cần chủ động báo lại với anh, thay vì để anh phải chờ phản hồi từ em như vậy ạ.")
para("Em cũng rất áy náy vì trước đây, sau khi chăm sóc ông nội xong, em đã từng hứa với anh rằng mình sẽ tập trung hoàn toàn vào công việc. Lần này em lại để chuyện cá nhân ảnh hưởng đến việc trao đổi và làm anh thất vọng. Em hiểu rằng lời xin lỗi và lời hứa sẽ không đủ để anh yên tâm nếu em không thể hiện bằng hành động cụ thể.")
para("Em sẽ nghiêm túc nhìn nhận lại cách làm việc của mình, chủ động cập nhật tiến độ, thông báo sớm khi có việc phát sinh và không để tình trạng mất liên lạc như vừa rồi lặp lại nữa ạ. Em gửi anh bản tổng hợp này để anh tiện theo dõi những nội dung đã được chuẩn bị, triển khai, kiểm tra và các công việc còn cần hoàn thiện.")
para("Em thật lòng mong anh thông cảm và cho em thêm cơ hội để chứng minh sự nghiêm túc trong công việc bằng kết quả thực tế. Em xin lỗi anh nhiều và cảm ơn anh vì đã luôn tạo điều kiện cho em trong thời gian vừa qua ạ.")

doc.core_properties.title = "Báo cáo tổng hợp công việc APPDICHTHUAT từ 13/10 đến 04/11/2026"
doc.core_properties.subject = "Tổng hợp tiến độ và kết quả đối chiếu với mã nguồn"
doc.core_properties.keywords = "APPDICHTHUAT, dataset, phương ngữ, Blaze Voice Collection"
doc.core_properties.author = ""
doc.save(OUT)
print(str(OUT))
print("paragraphs", len(doc.paragraphs), "tables", len(doc.tables))
