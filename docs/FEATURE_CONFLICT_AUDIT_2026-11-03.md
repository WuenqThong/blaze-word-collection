# Đối chiếu chức năng, UI/UX và design system — 03/11/2026

Phạm vi: project `E:\blaze-voice-collection`, đối chiếu file đính kèm ngày 03/11/2026. Áp dụng nguyên tắc bám nguồn và kiểm kê của claude-design, claude-design-system. Đây là báo cáo đánh giá, không thay đổi chức năng ứng dụng hoặc tạo lại canvas.

## 1. Kết luận

Hướng sản phẩm trong tài liệu phù hợp với mục tiêu thu thập từ/câu phương ngữ Quảng Nam–Đà Nẵng. Project đã chuyển được một phần đáng kể từ hệ thống audio sang luồng thu thập văn bản, nhưng mới là nền tảng pilot có đăng nhập; **chưa đáp ứng tiêu chí MVP mà tài liệu tự đặt ra**.

Các khoảng cách lớn nhất là: chưa góp ẩn danh; thiếu CURATED; thiếu chính sách reviewer cấu hình theo vùng; consent/nguồn còn đơn giản; thiếu cơ chế quản lý ảnh hưởng release; legacy audio/tài chính vẫn mở; chưa có engine nhiệm vụ và dữ liệu để đo hiệu quả kênh thu.

Không cần làm lại toàn bộ frontend. Giữ shell, typography và luồng góp mẫu; ưu tiên sửa mô hình trạng thái, quyền và dữ liệu trước khi mở thêm nhiệm vụ, thưởng hoặc dịch AI.

File đầu vào bắt đầu ở **H11**, sau đó có H12–H14 và các mục 3–10. Không có H01–H10 hoặc phần đầu catalog trong bản đính kèm này; báo cáo không coi chúng là đã được kiểm tra. Các tài liệu nghiên cứu và dataset được dẫn ở mục 10 cũng không tự động được coi là đã kiểm chứng qua việc đọc trích đoạn.

## 2. Chứng cứ và giới hạn

- Đọc router, model, API dialect, frontend dialect, auth, layout, CSS, canvas, cấu hình và tài liệu bàn giao hiện tại.
- Chạy lại hai integration test hiện có: đều đạt.
- Chạy thêm tình huống đối chiếu bằng TestClient với SQLite **in-memory**, dependency override; không sửa database thật.
- Đã tái hiện: reviewer chưa được phân công đọc chi tiết mẫu khác; phiên bản RAW mới làm release cũ bị chặn; rút phiên bản mới làm release cũ tải được trở lại; HOLD không vào pending và không finalize được.
- Chưa kiểm thử trực quan toàn bộ màn hình/mobile, chưa kiểm thử tải hoặc giao dịch đồng thời. Các nhận xét về giao diện dựa trên mã; các nguy cơ đồng thời là điểm cần kiểm chứng, không phải lỗi đã tái hiện.
- “Chưa có” trong báo cáo nghĩa là chưa thấy trong code/module được kiểm tra; không khẳng định hạ tầng triển khai bên ngoài không có dịch vụ tương ứng.

## 3. Những gì nên giữ

| Thành phần hiện tại | Đánh giá | Việc tiếp theo |
|---|---|---|
| Landing và trang quyền dữ liệu | Đúng hướng, nội dung không hứa dịch tự động hoặc gold chưa có | Làm rõ cần tài khoản trong pilot, hoặc triển khai guest flow |
| Form từ/câu, nội dung gốc, nghĩa, phổ thông, vùng, ngữ cảnh, nguồn | Đủ nền tảng thu văn bản trực tiếp | Bổ sung trường nghiên cứu có cấu trúc, không bắt người góp nhập mã nội bộ |
| Consent tiếp nhận/train/public tách riêng; hai mục sau mặc định tắt | Phù hợp tài liệu | Thêm lịch sử hiệu lực và rút từng mục đích |
| Idempotency key + request hash + unique constraint | Chống retry trùng thật | Giữ, bổ sung thử nghiệm đồng thời và tải lại trang |
| Nháp localStorage theo tài khoản, cảnh báo rời trang | Hữu ích trên điện thoại | Nêu rõ chỉ lưu trên thiết bị; kiểm tra chuyển loại mẫu/phiên bản trong cùng route |
| RAW tạo mới khi bổ sung nội dung | Đúng nguyên tắc giữ bản gốc ở tầng API | Thêm CURATED, lineage và quy tắc thay thế rõ ràng |
| Không tự duyệt; chưa bỏ phiếu thì ẩn nội dung phiếu người khác | Nền tảng duyệt độc lập | Thêm phân công, vùng chuyên môn và policy version |
| Kiểm QA/nguồn/train consent/rút trước khi xuất | Là chốt kiểm soát thật | Tách trạng thái đủ quyền, đủ ngôn ngữ và đủ điều kiện release |
| Release có ID, snapshot records và SHA-256 | Có giá trị cho pilot | Thêm schema/policy version, lineage, trạng thái ảnh hưởng |
| Loading/error/retry, 403/404 và server role checks | Nên giữ | Mở rộng test các nhánh từ chối và truy cập chéo |
| Be Vietnam Pro, accent #2563EB, shell/sidebar hiện tại | Phù hợp DESIGN.md | Chuẩn hóa token/component thay vì đổi phong cách lần nữa |

## 4. Xung đột và lỗi cần ưu tiên

Ưu tiên dưới đây là đề xuất cho project hiện tại: P0 trước khi mở thu thập rộng; P1 sau khi luồng pilot ổn; P2 chỉ khi đủ dữ liệu và chính sách.

| ID | Mức | Hiện trạng và xung đột | Khuyến nghị / tiêu chí nghiệm thu |
|---|---|---|---|
| C01 | P0 | Tài liệu yêu cầu người ẩn danh góp trên điện thoại; `/contribute/new` nằm trong ProtectedRoute, POST cần user | Chọn rõ pilot có đăng nhập hoặc MVP guest. Nếu guest: session/token bí mật để tra/rút, không dùng ID tuần tự làm bằng chứng sở hữu. Không gọi luồng hiện tại là góp ẩn danh |
| C02 | P0 | Queue không lọc theo vùng/phân công; reviewer bất kỳ đọc được chi tiết mẫu bất kỳ qua ID. Payload có owner_id | Thêm scope reviewer ở backend cho list/detail/vote; bỏ owner_id khỏi payload reviewer nếu không cần. Tái hiện hiện tại: reviewer mới đọc mẫu đã VERIFIED trả 200 và owner_id |
| C03 | P0 | Hai phiếu cùng kết luận tự chốt; quy tắc 2+1/3 phiếu chưa được chủ sản phẩm chốt nhưng code và trang quyền đã mô tả như quy tắc chính thức | Chốt SOP; lưu policy ID/version cho mỗi đợt duyệt. Cấu hình số phiếu, điều kiện chuyên môn và phân xử; test theo policy |
| C04 | P0 | HOLD sau hai phiếu biến thành trạng thái kết thúc ở API: không xuất hiện pending, vote/finalize đều chỉ nhận RAW/REVIEW | Thiết kế đường bổ sung → tái duyệt và liên kết bản mới. Không nhất thiết sửa RAW; phải có hàng chờ HOLD, người phụ trách, lý do và vòng duyệt mới. Đã tái hiện finalize trả 409 |
| C05 | P0 | Bất kỳ child chưa rút, kể cả RAW chưa duyệt, lập tức loại parent VERIFIED khỏi eligibility; rút child làm parent quay lại | Chốt nghĩa “bổ sung” và “thay thế”. Có thể giữ bản cũ đến khi bản mới được phê duyệt, hoặc chủ ý tạm ngừng ngay; phải có trạng thái và thông báo rõ. Không tự phục hồi parent chỉ do rút child nếu chưa có quyết định. Đã tái hiện download 200 → 409 → 200 |
| C06 | P0 | Consent nằm trong raw JSON, không có consent_event theo mục đích; rút toàn mẫu hoặc tạo phiên bản mới là lựa chọn hiện tại | Thêm consent event độc lập, phiên bản điều khoản, hiệu lực và lý do. Rút train phải chặn train/export nhưng không tự đổi consent_public; kiểm tra lịch sử theo thời điểm |
| C07 | P0 | Source registry hiện chỉ evidence text + boolean rights_confirmed + note; mỗi đóng góp tạo một source mới | Thêm loại nguồn, tác giả/URL/vị trí chứng cứ, phạm vi giấy phép, trạng thái pending/approved/restricted/revoked, lịch sử. Một checkbox “đủ quyền” không mô tả được quyền train khác public |
| C08 | P0 | Chưa có tầng CURATED; release xuất thẳng raw của đóng góp VERIFIED | Bổ sung bản chuẩn hóa có version và provenance về RAW; reviewer duyệt nội dung chuẩn hóa. Hiện nên gọi export là “snapshot ứng viên đã qua kiểm tra”, không tuyên bố dataset chuẩn hóa hoàn chỉnh |
| C09 | P0 | Thu hồi quyền/rút mẫu chặn tải release lúc request nhưng không có affected/revoked status, danh sách model/job phụ thuộc hoặc báo cáo ảnh hưởng | Lưu release membership và trạng thái ảnh hưởng, tác nhân/lý do; cho admin xem release nào bị ảnh hưởng trước khi tải. Không hứa xóa được bản đã tải ra ngoài |
| C10 | P0 | Audit chỉ gắn contribution với action/note; response timeline không cho actor, nguồn thay quyền chỉ có ghi chú; cấp/thu reviewer không có audit event riêng | Audit actor/entity/before-after/reason/policy version cho quyền, quyết định, consent, nguồn và release. Timeline người góp vẫn dùng thông tin tối thiểu, không lộ nội bộ |
| C11 | P0 | Dùng chung User.role giữa hệ cũ và mới. Cấp reviewer thay role annotator; một số thống kê/chất lượng legacy chỉ tính role=annotator | Tách capability hoặc membership theo workspace/module. Reviewer phương ngữ không tự mất tư cách contributor/audio; test tác động của đổi quyền ở hai hệ |
| C12 | P0 | Legacy chỉ tách menu, route và API audio/tài chính vẫn được đăng ký; sidebar dẫn mọi user sang `/legacy` | Thêm feature flag + quyền module ở backend, ẩn công cụ chưa mở cho người dùng mới. Tách menu không đồng nghĩa đã tắt tính năng |
| C13 | P0 | Kiểm trùng chỉ NFC/casefold mặt chữ trong mẫu chính người gửi; metrics “Mẫu khác nhau” là tập text/meaning/region, chưa phải mục từ/nghĩa đã hợp nhất | Giữ cảnh báo cá nhân; thêm candidate dedup nội bộ theo nghĩa/vùng/nguồn. Đổi nhãn KPI thành “Tổ hợp nội dung–nghĩa–vùng khác nhau”; không nhận đó là unique lexeme hoặc hiệu suất kênh |
| C14 | P0 | Model/create_all đủ tạo bảng mới nhưng chưa có migration version trong cơ chế hiện tại; chưa thấy workflow backup/restore của module | Có migration và thử restore trước thu dữ liệu thật; không cần chuyển PostgreSQL chỉ để đủ tên stack |
| C15 | P0 | Chưa thấy rate limit riêng cho góp mẫu/login ở module đã đọc; hai test tuần tự chưa bao phủ vote đồng thời, rút lúc release đang tạo hoặc revoke lúc tải | Bổ sung giới hạn và kiểm tra tính nguyên tử; định nghĩa thời điểm snapshot/thu hồi. Đây là khoảng trống kiểm chứng, chưa kết luận race đã xảy ra |

### Các sai lệch UI/UX cụ thể

| ID | Mức | Điểm cần sửa | Hướng sửa |
|---|---|---|---|
| U01 | P0 | Reviewer dashboard vẫn là lời mời góp mẫu như contributor; nhãn tài khoản reviewer là “Người đóng góp” | Dashboard theo capability: mẫu được phân công, việc cần xử lý, phiếu của tôi; cho người dùng hiểu vai trò hiện tại |
| U02 | P0 | Header `/dashboard` contributor rơi vào “Không gian gán nhãn”, `/legacy` chưa có title riêng; `/settings` nói “Cài đặt tài khoản” nhưng chỉ sửa hồ sơ vùng | Khai báo route metadata thay chuỗi startsWith dài; dùng tên “Hồ sơ vùng sử dụng”, “Tổng quan đóng góp”, “Công cụ cũ” đúng nội dung |
| U03 | P0 | Vùng chỉ có Quảng Nam/Đà Nẵng/cả hai/không chắc; hồ sơ nơi lớn lên không được snapshot vào mẫu | Tách vùng tự khai của người góp và nơi từ được sử dụng; thêm taxonomy có tên lịch sử/alias và mức chắc chắn. Hồ sơ thay đổi không làm mất bối cảnh mẫu cũ |
| U04 | P0 | Bắt buộc mọi mẫu đều có meaning và standard_vi; chưa có “không biết/không có từ riêng/cùng phổ thông” có cấu trúc | Schema theo loại nhiệm vụ; không bắt bịa nghĩa để qua form. Với nhiệm vụ gợi từ, phản hồi không biết phải lưu riêng và không được đếm như từ mới |
| U05 | P0 | Lỗi wizard chỉ là Alert chung; h2 có tabIndex nhưng chưa có logic chuyển focus theo bước/lỗi | Error summary liên kết field, aria-invalid/aria-describedby, focus sau đổi bước; nghiệm thu bàn phím và màn hình nhỏ |
| U06 | P1 | Form review mất note/checks khi chọn mẫu khác hoặc rời trang, không có cảnh báo như contribution wizard | Lưu nháp phiếu theo reviewer+mẫu+vòng duyệt hoặc xác nhận rời; không lưu nhận xét của người khác vào draft |
| U07 | P1 | Queue chỉ pending/mine và phân trang; thiếu lọc vùng/chủ đề, SLA, lý do HOLD và nguồn chưa đủ quyền | Thêm bộ lọc và trạng thái cần xử lý; ưu tiên filter thực sự có dữ liệu backend |
| U08 | P0 | Nút tạo release xuất ngay toàn bộ eligible; không preview tập mẫu hoặc lý do loại; release list không cho biết bị chặn cho tới khi tải | Preview số lượng/mẫu/quy tắc loại; hiển thị policy/schema và eligibility; explicit create sau preview |
| U09 | P1 | Source form và participants dùng danh sách thô, thiếu lọc và quan hệ mẫu–nguồn; cấp quyền một nút, thiếu thông tin năng lực | Source detail có các mẫu liên quan; reviewer profile có vùng, đào tạo, phạm vi và lịch sử cấp quyền |
| U10 | P1 | Admin từ detail quay về danh sách mất filter; reviewer xem detail trực tiếp có đường về `/admin/contributions` dù không có quyền admin | Giữ context điều hướng/URL bộ lọc; dùng breadcrumb phù hợp vai trò, đường về queue cho reviewer |
| U11 | P1 | Wizard state khởi tạo một lần, draftKey đổi theo query parent/kind nhưng chưa reset toàn form; nút “Góp mẫu khác” sau revision giữ URL parent | Chuẩn hóa reset/remount theo form identity, điều hướng lượt mới về URL không có parent. Cần test chuyển query ngay trong cùng component, chưa tái hiện bằng browser |

## 5. Module nào chưa nên có trong trải nghiệm chính

| Module/cơ chế | Quyết định đề xuất | Lý do |
|---|---|---|
| Điểm thưởng, leaderboard, quy đổi VND, rút tiền, hồ sơ ngân hàng | Tắt cho chương trình phương ngữ P0; giữ dữ liệu/giao dịch legacy để đối soát | H12 là P2 và cần ngân sách/chống gian lận/tiêu chí chất lượng. Chưa có liên kết thưởng phương ngữ là lựa chọn đúng |
| Audio assignment, admin review audio, lịch sử audio và Roleplay cũ | Chỉ mở cho nhóm legacy có quyền; không dùng làm review phương ngữ | Khác schema, consent, đơn vị dữ liệu và policy |
| Mini-game gold, bài loại 3/3 | Chưa triển khai hoặc giới thiệu như kiểm định đáng tin | Q01–Q03 chưa chốt và chưa có gold bank |
| Dịch AI, ASR tự xác minh, câu AI tự gắn VERIFIED | Để P2, chỉ tạo candidate RAW khi được mở | Chưa có dataset/benchmark và không phải bằng chứng sử dụng tự nhiên |
| 34 màn hình hoặc 34 ứng dụng riêng cho 34 cách thu | Không nên xây | Tài liệu yêu cầu engine chung, cấu hình prompt/schema/asset/consent |
| Thu nhóm tuổi, địa chỉ cụ thể, ngân hàng trong form phương ngữ | Không thêm mặc định | Không cần cho luồng lõi đang nêu; audio/nhóm tuổi cần mục đích và policy riêng |
| Công khai toàn bộ RAW/tra mã đoán được, export cho mọi reviewer | Không mở | Phạm vi xem nội bộ và consent công khai khác nhau |

“Xóa” ở đây ưu tiên bỏ khỏi navigation, cấu hình và dependency bundle không còn dùng. Không xóa bảng, giao dịch hoặc RAW đã thu chỉ vì đổi hướng sản phẩm. Xóa mã legacy sau khi kiểm kê người dùng, dữ liệu và luồng phụ thuộc; cần kế hoạch riêng.

## 6. Đối chiếu H11–H14

| Mục trong file | Hiện trạng | Cần bổ sung | Ưu tiên |
|---|---|---|---|
| H11 Hiệu suất kênh thu | Có 4 số tổng, chưa có kênh/campaign/session/chi phí hoặc độ phủ chủ đề | Ghi campaign_id, method, prompt_version, lượt bắt đầu/gửi/không biết, review outcome, khoảng thời gian và chi phí có nguồn. Tính nonduplicate/100 lượt và tỷ lệ VERIFIED trên cohort có thời gian duyệt | P1 |
| H12 Thưởng/leaderboard | Legacy có điểm và thanh toán; dialect chưa thưởng | Đóng mặc định; nếu mở phải thưởng theo mẫu đủ chất lượng và có xử lý rút/revoke/gian lận, ngân sách và khiếu nại | P2 |
| H13 Cohort/UX | Chưa thấy instrumentation funnel riêng cho wizard | Sự kiện ẩn danh theo bước/version; không log raw text/PII vào analytics. Đo bỏ form, chọn không biết, phản hồi lỗi, độ dài câu | P2; chỉ thu bộ sự kiện tối thiểu cần cho pilot trước |
| H14 Import/export jobs | Có export đồng bộ, không có import mapping/QA/jobs/retry | Job queue, trạng thái tiến độ, lỗi theo dòng, dry run, mapping version, idempotency, retry có quyền; kiểm lại policy tại thực thi/tải | P1; giữ export đồng bộ khi pilot nhỏ |

## 7. Kho 34 cách thu: phần nào triển khai trước

Hiện tại chỉ có góp từ/câu trực tiếp. Các module project/audio và Roleplay cũ không chứng minh 34 cơ chế đã có engine dùng chung.

| Nhóm/cơ chế trong file | Đề xuất | Những gì engine cần |
|---|---|---|
| Góp trực tiếp; liệt kê nhanh (mở rộng 1); kể quy trình (2); sửa câu gượng (trực quan 4) | Pilot đầu tiên, triển khai lần lượt và so hiệu quả | Prompt version, chủ đề, response schema, context, phương thức thu, nhãn câu gợi ý AI nếu có |
| Ảnh căn nhà (trực quan 1), video câm (2), cảnh thiếu lời (mở rộng 3), theo nghề (trực quan 9/mở rộng 11), món ăn/công đoạn (19) | P1 sau text pilot | Asset quyền rõ ràng, alt/description, tải nhẹ, phiên bản và provenance |
| Cây từ dây chuyền (trực quan 3), từ bị bỏ sót (mở rộng 16), reviewer mở nhiệm vụ (24) | P1 sau lexeme/sense và taxonomy | Concept/related item IDs, chống lặp gợi ý, điều phối khoảng trống |
| Hai thế hệ (trực quan 5), bản đồ địa bàn (6), đổi đối tượng (mở rộng 12), địa danh dân gian (18) | P1 thử nghiệm có giới hạn | Taxonomy vùng/thời gian/ngữ cảnh; tuổi tự nguyện nếu thực sự cần, không suy vùng từ IP |
| Nhật ký từ lạ (trực quan 7), khác phổ thông (mở rộng 4), tin nhắn thực dụng (5), hiểu nhầm khác vùng (6), từ phải giải thích khi đi xa (9), một ngày làm nghề (11), lời dặn người lớn (20) | Schema cấu hình trên cùng engine | Loại context, câu phổ thông, nguồn và tránh thông tin người khác |
| Không có từ riêng (trực quan 8), tìm từ không thuộc nhóm (mở rộng 7), app không tìm thấy (15) | P1 có nhánh phản hồi riêng | is_same_as_standard/no_term/unknown; không ép tạo dữ liệu khẳng định |
| Nghĩa sang câu chuyện (mở rộng 8), câu đùa/nghĩa (10), sự kiện theo mùa (17) | P1 thí điểm theo chủ đề | Sense/context, nghĩa bóng/sắc thái và mốc thời gian; review riêng nội dung nhạy cảm khi cần |
| Người khác nói lại (trực quan 10), bàn phím sửa sai (mở rộng 13), ASR nhận sai (14) | P1 có điều kiện, ASR nâng cao sau | Chỉ lấy dữ liệu người dùng chủ động chọn; giữ input/output phân biệt; không tự chứng nhận tính tự nhiên |
| Thẻ điểm sinh hoạt (mở rộng 21), trường học (22), phiên chợ đổi nghĩa (23) | P1 sau consent/campaign vận hành ổn | QR/link chiến dịch, quyền người tham gia/đại diện phù hợp đối tượng, provenance theo sự kiện |

Danh sách trên bao phủ 10+24 cơ chế trong trích đoạn; một cơ chế có thể dùng nhiều nhóm dữ liệu. Không cần bật đồng thời. Mỗi nhiệm vụ phải đo lượt bắt đầu, lượt hoàn thành, unknown/no-term, trùng và kết quả duyệt; không lấy lượt gửi thô làm thành công.

## 8. Mô hình dữ liệu cần thêm/sửa

| Entity tài liệu | Hiện tại | Khoảng cách cần xử lý |
|---|---|---|
| participant | User + DialectProfile | Chưa có participant pseudonym riêng, confidence và snapshot vùng theo mẫu |
| consent_event | Booleans/version trong raw | Thêm sự kiện theo mục đích và hiệu lực/rút |
| source_registry | DialectSource | Từ text/boolean sang nguồn có cấu trúc, reuse và rights theo mục đích |
| campaign/prompt/prompt_asset | Chưa có trong dialect | Không dùng nguyên Project audio; bổ sung engine versioned |
| contribution_raw | DialectContribution | Giữ append-only ở API; thêm method/concept/prompt/consent references và lineage rõ ràng |
| audio_asset | Audio legacy riêng | Chưa có audio_asset gắn contribution+consent; P1 mới nối |
| lexeme/sense/variant | Chưa có | Tạo CURATED, tách đồng hình nhiều nghĩa, vùng/biến thể và liên kết nguồn |
| utterance/translation | raw.kind và raw.standard_vi | Chưa có thực thể chuẩn hóa/version/sense liên kết |
| review_vote | DialectVote | Thêm vòng duyệt/policy/assignment/vùng năng lực snapshot |
| review_decision | status trên C + event | Thêm quyết định riêng, policy, người quyết, lý do và export_allowed theo phạm vi |
| export_release | DialectRelease records JSON/checksum | Thêm policy/schema version, membership, revoked/affected và split manifest khi sẵn sàng |
| audit_event | DialectEvent | Mở rộng audit cho role, source, consent, release, import; actor/before-after có quyền xem |

Không biến toàn bộ trường thành bắt buộc ở frontend. Mã nội bộ như elicitation_method, prompt_version, source_id phải do hệ thống gắn; confidence/unknown phải có lựa chọn rõ ràng.

## 9. Design system và canvas

### Inventory quan sát được

- Nguồn hướng dẫn: DESIGN.md; màu và token runtime khai báo trong collection.css.
- Kiểu chữ: Be Vietnam Pro 400/500/600/700, Latin và Vietnamese tự host từ package.
- Nền: #F4F5F7 shell, #FFFFFF panel, #F8FAFC page, #F9FAFB tile. Accent #2563EB, hover #1D4ED8, ink #0F172A, muted #6B7280.
- Border #E2E8F0; input/button radius 8px, panel/card 16px, một số khối 24px; input/button chuẩn min-height 44px; sidebar 240/64px.
- Thành phần: Brand, shell/sidebar/offcanvas, heading, button/input/select/textarea, consent, wizard stepper, badge, list/detail, review rubric, timeline, alert/retry/empty, pagination, modal, metric tile, source form và release card.
- Asset logo được lưu thật ở frontend/public/brand/blaze-logo.png; không cần vẽ lại.
- Có canvas hai board Main/Login. **Không thấy artifact design-system.json/tokens.json trong inventory designs hiện tại**; canvas designSystems rỗng. CSS variables và DESIGN.md chưa phải thư viện Design System artifact có component contract.

### Những gì cần sửa

1. Giữ diện mạo hiện tại; gom token thành một nguồn. theme.css cũ → collection.css → dialect.css cùng tác động toàn app; các selector toàn cục `.card`, `.btn`, `.badge`, heading có nguy cơ thay giao diện legacy. Scope legacy hoặc dùng lớp theme riêng trước khi bỏ CSS cũ.
2. Giảm hard-code trùng màu/radius trong dialect.css; tách thành các component có state/props thống nhất. Tên `projects-heading`, `projects-toolbar` đang dùng cho dialect nên đổi dần sang tên dùng chung, không cần viết lại chỉ để đổi tên.
3. Bổ sung trạng thái nghiệp vụ riêng: **QA**, **quyền nguồn**, **consent**, **withdrawal**, **release eligibility**. Một badge VERIFIED không thể thay cả năm. Không dùng màu xanh accent làm bằng chứng đã xác minh.
4. Chuẩn hoá tiếng Việt: RAW → “Bản gốc”, REVIEW → “Đang duyệt”, HOLD → “Cần bổ sung”; có thể giữ mã kỹ thuật ở phần chi tiết nội bộ. Đồng nhất “rút mẫu” và “rút quyền theo mục đích”.
5. Tăng khả năng nhận biết ranh giới input khi chỉ có border nhạt #E2E8F0 trên trắng. Cần đo tương phản phần ranh giới thiết yếu, icon và focus trên nền thực; không tự kết luận đạt accessibility chỉ vì đã có focus CSS. Border trang trí có thể vẫn nhẹ.
6. Nút `.btn-sm` desktop có min-height 36px và dropdown 40px; mobile media query đã nâng lên 44px. Nếu áp chuẩn 44px của skill cho mọi màn hình thì chuẩn hóa cả desktop, ưu tiên thao tác review/consent. Không kết luận mobile đang thiếu rule 44px.
7. Canvas Main vẫn có “Dự án của bạn”, “Tạo dự án”, tab gán nhãn/thu thập và thiếu board wizard/reviewer/source/release; không còn đại diện sản phẩm lõi hiện tại. Cần cập nhật trước khi dùng canvas để giao việc frontend.
8. Canvas có một số CTA/tab là span; khi cập nhật phải dùng button/link thật. Không lấy canvas hiện tại làm bằng chứng chức năng runtime hoặc accessibility đã đạt.
9. Nếu tạo design system ở vòng triển khai: README brand book, tokens có usage, component guidelines/states, logo/font thật, semantic states ở trên; cài vào canvas để tránh hai bộ token trôi nhau. Không cần tạo artifact mới chỉ để hoàn thành báo cáo này.

## 10. Thứ tự làm đề xuất và nghiệm thu

### Đợt 1 — Chốt sản phẩm và đóng xung đột P0

- Chốt guest hay account pilot, địa bàn/taxonomy, SOP reviewer, phạm vi consent và quy tắc thay phiên bản.
- Sửa scope reviewer; tách module legacy và capability; bổ sung vòng HOLD/tái duyệt.
- Chốt parent/child eligibility, audit và affected release; làm rõ nhãn UI theo vai trò.
- Nghiệm thu: không đọc/vote ngoài phạm vi; tự duyệt bị chặn; HOLD có đường xử lý; rút consent không làm bản cũ tự bật lại ngoài policy; legacy không mở cho người không có quyền.

### Đợt 2 — Hoàn thiện pipeline P0

- Consent event, source rights có cấu trúc, CURATED tối thiểu và quyết định có policy version.
- Preview export, lý do loại, lịch sử ảnh hưởng; migration/backup/restore; giới hạn request.
- Bổ sung test permission matrix, idempotency, dòng phiên bản, mất quyền nguồn và thao tác đồng thời; thử flow điện thoại/bàn phím/role bằng dữ liệu giả.
- Nếu công bố MVP theo đúng file: bổ sung guest submission và secure recovery trước nghiệm thu. Nếu chưa làm thì gọi rõ “pilot có tài khoản”.

### Đợt 3 — P1 nhiệm vụ và vận hành

- Engine chung; thử liệt kê nhanh/kể quy trình/sửa câu gượng, sau đó ảnh/video có quyền.
- CSV/JSONL import dry-run, mapping/QA, job status/log/retry; dữ liệu nhập luôn là candidate.
- KPI kênh thu có denominator/cohort, taxonomy độ phủ; QR/campaign và phản hồi lỗi từ điển.
- Từ điển chỉ đọc CURATED đủ quyền công khai; không suy từ consent_train sang consent_public.

### Đợt 4 — P2 có điều kiện

- Chia bộ theo người/nguồn/họ câu, gold bank, benchmark độc lập rồi mới dịch AI/ASR hỗ trợ.
- Chính sách thưởng và ngân sách có kiểm soát trước khi mở leaderboard/thanh toán cho dialect.
- Cohort analytics ẩn danh; phản hồi model luôn vào RAW, không tự VERIFIED.

## 11. Sửa chính tài liệu đầu vào trước khi giao dev

- Cung cấp lại phần đầu nếu muốn nghiệm thu cả H01–H14; bản hiện tại chỉ có H11–H14.
- Tách “đã quyết định”, “đề xuất”, “chưa chốt” thành ba nhãn; không biến mục 8 thành mặc định code.
- Làm rõ “ẩn danh” là guest không tài khoản hay tài khoản có định danh nghiên cứu giả danh.
- Thống nhất thời điểm release xuất hiện ở P0/P1: đề xuất P0 có snapshot kiểm soát tối thiểu, P1 có jobs/quản lý phiên bản nâng cao. Không vừa yêu cầu chặn export P0 vừa để mọi kiểm soát release tới P1.
- Bổ sung state machine: RAW → REVIEW → VERIFIED/HOLD/REJECT, tái duyệt, revision, withdrawn, source revoked, affected release; phân biệt trạng thái nội dung và quyền dùng.
- Bổ sung retention và quy trình ảnh hưởng sau rút; diễn đạt thành quyết định sản phẩm/vận hành, không giả thành khả năng kỹ thuật đã có.
- Viết acceptance criteria riêng cho từng role và nhánh từ chối, thay vì chỉ checklist có màn hình.
- Đánh dấu PostgreSQL/queue là lựa chọn triển khai theo nhu cầu. SQLite hiện tại phù hợp kiểm thử/pilot nhỏ khi có backup và giới hạn rõ; đổi database không tự giải quyết policy hoặc quyền.

## 12. Vị trí chứng cứ chính

- [API và policy dialect](E:/blaze-voice-collection/backend/app/routers/dialect.py): pack 60; create 111; detail 157; queue 185; vote 210; finalize 241; rights 266; eligible 277; metrics 284; role 312; releases 324–340.
- [Mô hình dialect](E:/blaze-voice-collection/backend/app/models/dialect.py).
- [Route frontend](E:/blaze-voice-collection/frontend/src/router.tsx).
- [Wizard](E:/blaze-voice-collection/frontend/src/features/dialect/ContributionWizard.tsx).
- [Review, nguồn, release, quyền và legacy UI](E:/blaze-voice-collection/frontend/src/features/dialect/AdminPages.tsx).
- [Chi tiết, rút mẫu, hồ sơ](E:/blaze-voice-collection/frontend/src/features/dialect/ContributionPages.tsx).
- [Public flow và nội dung policy](E:/blaze-voice-collection/frontend/src/features/dialect/PublicPages.tsx).
- [Shell và navigation](E:/blaze-voice-collection/frontend/src/components/Layout.tsx).
- [Token/CSS](E:/blaze-voice-collection/frontend/src/styles/collection.css), [CSS dialect](E:/blaze-voice-collection/frontend/src/styles/dialect.css), [design reference](E:/blaze-voice-collection/DESIGN.md).
- [Canvas hiện tại](E:/blaze-voice-collection/designs/blaze-collection/project/canvas.json).
- [Khởi tạo database](E:/blaze-voice-collection/backend/app/core/database.py), [cấu hình mặc định](E:/blaze-voice-collection/backend/app/core/config.py), [test hiện có](E:/blaze-voice-collection/backend/tests/test_dialect.py).

Các kết quả tái hiện bổ sung ở mục 2 được chạy tạm trong tiến trình kiểm tra, không được thêm thành production code hoặc sửa test hiện có trong lần audit này.
