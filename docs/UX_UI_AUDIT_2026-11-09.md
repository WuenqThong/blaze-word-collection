# Blaze (APPDICHTHUAT) — UX/UI Audit

**Phạm vi** http://localhost:7777 · **Tài khoản** người góp và admin dùng riêng cho audit, tạo trên **bản sao** `annotator.db` (DB thật không bị sửa) · **Viewport** 390×844 (mobile) và 1280×800 (desktop) · **Ngày** 2026-11-09 · **Trang** `/demo`, `/demo/rights`, `/login`, `/register`, `/demo/play`, `/demo/game/:id`, `/demo/admin/dashboard`, `/demo/admin/review`, `/demo/admin/settings`, `/demo/admin/datasets`, `/demo/rewards`

**Chuẩn đối chiếu:** `DESIGN.md` của dự án là chuẩn ưu tiên (màu, tương phản chữ trên nút vàng, mục tiêu chạm). Các phát hiện về khả năng tiếp cận được đối chiếu với WCAG 2.2. Các phát hiện về khả năng sử dụng dựa trên heuristic Nielsen. Cách xếp mức độ nghiêm trọng là quy ước của skill audit, không phải tiêu chuẩn.

**Phương pháp:** chạy các probe `probe-routes`, `probe-core`, `probe-heuristics`, `probe-perception`, `probe-ltr` và `probe-focus` (sau khi bấm phím Tab thật). Sau đó chụp màn hình, đọc toàn bộ nội dung chữ, rồi đối chiếu với `GET /api/dialect/workspace`, `GET /api/dialect/releases/{id}` và mã nguồn. `probe-rtl` và `probe-parity` không áp dụng vì sản phẩm chỉ có một ngôn ngữ LTR.

> **Cập nhật 2026-11-09 — đã sửa A1, 01, 02.**
> - **A1:** thêm `.btn:focus-visible` trong `collection.css`. Đo lại sau khi bấm Tab thật: `rgb(161,92,0) solid 2px`, `box-shadow: none`, trên nền `rgb(249,248,245)`.
> - **01:** khi có máy chủ, nội dung chữ được viết lại ở trang quyền dữ liệu, dashboard, dataset (scope và data card mặc định), cài đặt, hạn mức, duyệt, màn gửi đóng góp và màn chặn quyền. Nhãn trạng thái/kết luận đổi thành "Xác minh". Chế độ `VITE_DEMO_SERVER=off` giữ nguyên câu chữ demo.
> - **02:** `regions.ts` có 7 đơn vị Đà Nẵng, 18 đơn vị Quảng Nam (theo tên trước 2025) và lựa chọn "Không chắc". Dropdown chia theo tỉnh. Kiểm tra trong `domain.ts` và thông báo lỗi đã được sửa khớp. Gói vùng trong IndexedDB được nâng lên `districts-v2`.
> - Các mục còn lại chưa sửa.

## Tóm tắt

| | Số lượng |
|---|---|
| Nghiêm trọng (Critical) | 2 |
| Lớn (Major) | 10 |
| Khả năng tiếp cận | 2 |
| Ghi chú | 8 |
| Làm tốt | 7 |

Về mặt kỹ thuật, nền tảng giao diện tốt. Không có cặp màu chữ nào trượt tương phản trên mọi trang đã đo. Form có nhãn và `autocomplete` đầy đủ. Không có trang nào tràn ngang ở cả hai kích thước.

Lỗi tập trung ở ba chỗ:
- **Nội dung chữ** không còn khớp với hành vi thật của sản phẩm. Phần lớn lỗi này do đợt nối backend ngày 2026-11-09 gây ra.
- **Danh sách vùng** không khớp với lời hứa "Quảng Nam — Đà Nẵng".
- **Màn câu hỏi trên mobile** đẩy câu hỏi và nút chính xuống dưới mép màn hình.

---

## Phát hiện

### 01 · Nghiêm trọng · `/demo/rights`, `/demo/admin/*`, `/demo/rewards`

**Nội dung chữ vẫn nói dữ liệu "nằm trên trình duyệt" và "mô phỏng", trong khi mẫu, phiếu, quyền, hạn mức và release đã được lưu trên máy chủ, gắn với tài khoản thật.**

Đây là trang quyền dữ liệu, tức là tài liệu người dùng đọc trước khi đồng ý. Nội dung hiện tại mô tả sai nơi lưu và mục đích sử dụng dữ liệu. Admin cũng bị đánh lừa: các nút ghi "mô phỏng" thực chất thay đổi dữ liệu thật. Lỗi này phát sinh khi nối `/demo` vào backend mà chưa cập nhật nội dung chữ.

```
/demo/rights      "Kho này nằm trên trình duyệt, không có bảo mật nhận dạng người thật."
/demo/rights      "Hạn mức AI nội bộ chỉ mô phỏng khi tài khoản được xác nhận…"
dashboard         "Số liệu từ kho demo trên trình duyệt này; …"   (số liệu thực tế lấy từ /api/dialect/workspace)
datasets          "Phạm vi xuất: DEMO_ONLY."  ·  nút "Tạo bản xuất DEMO có manifest"
GET /api/dialect/releases/1 → manifest.scope = "verified-training-candidates"
                               manifest.data_card = "… Không dùng huấn luyện, benchmark hoặc công khai như dữ liệu thật."
settings          "Đủ quyền train trong DEMO" · "Đã xác nhận demo"   (ghi vào dialect_source_rights / dialect_participants)
rewards           "Mô phỏng quản lý đã duyệt cơ chế hạn mức (mặc định tắt)"   (PUT /dialect/rewards/policy)
review            option "Xác minh demo" · badge "Đã xác minh demo"
```

Ngay trong một bản release đã có hai câu tự mâu thuẫn: data card ghi "Không dùng huấn luyện", còn scope lại là "verified-training-candidates".

**SỬA:**
- Khi `live` là true, viết lại các câu trên theo hành vi thật. Ví dụ, trang quyền dữ liệu nên nói rõ dữ liệu lưu trên máy chủ, ai đọc được, và cách rút mẫu.
- Bỏ chữ "demo/mô phỏng" trên các thao tác có ghi xuống server.
- Đổi data card mặc định cho khớp với scope.

### 02 · Nghiêm trọng · Game (bước vùng), `/demo/admin/review`

**Sản phẩm giới thiệu là "Quảng Nam — Đà Nẵng", nhưng người chơi chỉ chọn được 7 quận/huyện của Đà Nẵng. Thông báo lỗi lại hướng dẫn một lựa chọn không tồn tại.**

Người nói tiếng Quảng Nam buộc phải chọn bừa một quận của Đà Nẵng. Nhãn vùng sai sẽ đi thẳng vào dữ liệu huấn luyện, và lỗi này không thể phát hiện về sau.

```
/demo (eyebrow)        "QUẢNG NAM — ĐÀ NẴNG / APPDICHTHUAT"
regions.ts             DISTRICTS = ["Quận Cẩm Lệ","Quận Hải Châu","Quận Liên Chiểu","Quận Ngũ Hành Sơn",
                                    "Quận Sơn Trà","Quận Thanh Khê","Huyện Hòa Vang"]
domain.ts:465          tài khoản đăng nhập: region/upbringing phải ∈ DISTRICTS
domain.ts:479          "Điền vùng hoặc ghi Không chắc."   — "Không chắc" không có trong DISTRICTS
```

**SỬA:** bổ sung các đơn vị của Quảng Nam (hoặc cấp tỉnh "Quảng Nam – chưa rõ huyện"), thêm lựa chọn "Không chắc", rồi sửa thông báo lỗi cho khớp.

### 03 · Lớn · `/demo/game/:id` (390×844)

**Trên điện thoại, câu hỏi bắt đầu ở 417px và nút "Lưu & tiếp tục" nằm ở 1134px, thấp hơn mép màn hình 290px. Cả 10 câu đều như vậy.**

Mỗi câu hỏi đều bắt người chơi cuộn xuống mới thấy câu và nút. Đây là luồng chính của người góp.

```
viewport 844px
progress            144–154px
lưới Q01…Q10        174–374px   (10 nút, 4 hàng × 44px)
heading "Q01 / 10"  417px
đáp án đầu tiên     660px
"Lưu & tiếp tục"    1134–1178px
```

**SỬA:**
- Trên mobile, thu lưới câu thành "Câu 5/10" cùng một ngăn kéo để nhảy câu.
- Đặt "Câu trước / Lưu & tiếp tục" vào thanh dính ở đáy màn hình, trong vùng ngón cái với tới.

### 04 · Lớn · Dữ liệu duyệt (`/demo/admin/review`)

**Ô trả lời tự do nhận cả câu trả lời một ký tự. Các câu như vậy đã nằm trong hàng chờ duyệt thật.**

Reviewer phải tốn công bỏ phiếu cho rác, và số liệu "mẫu chờ duyệt" bị thổi phồng.

```
GET /api/dialect/workspace (DB thật, owner #1):
#2–#6 original_text: "sd", "đ", "d", "ad", "d"   method=game  status=RAW
idempotency_key "0973aab2-…:q4/q5/q7/q9/q10", created_at 2026-11-09 05:22:35 (5 bản ghi trong 130ms)
```

Các bản ghi này đến từ một lượt game chơi trước đó trong IndexedDB của trình duyệt tài khoản #1. Outbox đã tự gửi lượt này lên ngay lần đăng nhập đầu tiên sau đợt nối backend. Hành vi này đúng thiết kế, nhưng chưa từng được thông báo cho người dùng.

**SỬA:**
- Đặt độ dài tối thiểu và kiểm tra chất lượng cơ bản cho câu trả lời mở.
- Cho admin từ chối hàng loạt.
- Cân nhắc hỏi xác nhận trước khi đẩy dữ liệu cục bộ cũ lên máy chủ.

### 05 · Lớn · `/demo/admin/settings`

**Đổi vai trò, vùng hoặc mức rủi ro của một người sẽ ghi ngay xuống máy chủ khi đổi select, không có bước xác nhận và không có hoàn tác. Dòng "Khách ẩn danh" vẫn hiện với đủ các control.**

Chỉ một cú bấm nhầm trên trang có 54 control và dài 3,5 màn hình cũng đủ đổi quyền của một tài khoản thật (Nielsen #5, phòng tránh lỗi). Với dòng khách, chỉnh sửa sẽ báo lỗi "chưa được đồng bộ".

```
SettingsDemo.tsx   <select onChange={… run({ type: "person", … }) }>   (vai trò, vùng, rủi ro, xác nhận)
probe: interactiveTotal 54 · pageHeight 2775px (3.5 màn hình)
select "Vai trò Khách ẩn danh" · "Vùng Khách ẩn danh" · "Rủi ro Khách ẩn danh"
```

**SỬA:** chuyển sang chế độ sửa theo dòng, có nút "Lưu"; hỏi xác nhận khi đổi vai trò; ẩn dòng `guest` khi `live`.

### 06 · Lớn · `/demo/rewards`

**Bảng xếp hạng và thành tích đếm từ lượt chơi lưu trong trình duyệt, nên báo 0 cho người đã có đóng góp trên máy chủ.**

Người góp chơi trên một thiết bị khác, hoặc sau khi xóa dữ liệu trình duyệt, sẽ thấy mình "0 lượt". Admin cũng đọc thấy số sai.

```
server: account #1 có 5 mẫu method=game (session_ref 0973aab2-…)
UI:     "wuenq theng   0   0   0"   (Lượt hoàn tất / Mẫu đủ chất lượng / Điểm)
RewardsDemo.tsx: completed = state.sessions.filter(owner === actor && state === "submitted")
```

**SỬA:** tính lượt hoàn tất từ `session_ref` riêng biệt của các mẫu trên server, hoặc thêm một endpoint thống kê.

### 07 · Lớn · `/demo/rewards`, `/demo/admin/review`

**Màn hình hiện ID nội bộ thay cho tên người.**

```
"sd · account:1 · Chưa đủ QA"
bảng hạn mức, cột "Tài khoản": "account:4"
```

**SỬA:** tra `state.people` để hiện `name`.

### 08 · Lớn · `/register`, `/login`

**Lỗi kiểm tra từ backend hiện nguyên văn tiếng Anh.**

```
"value is not a valid email address: The part after the @-sign is a special-use or reserved name that cannot be used with email."
```

Nguồn là `extractError` trả `detail[0].msg` của Pydantic.

**SỬA:** ánh xạ các loại lỗi `value_error` / `string_too_short` sang câu tiếng Việt theo từng trường, và hiện lỗi ngay dưới trường (`aria-invalid`, `aria-describedby`).

### 09 · Lớn · Toàn sản phẩm

**Cùng một trạng thái được gọi bằng các từ khác nhau. Trang công khai dùng thuật ngữ nội bộ.**

```
review filter      "RAW · REVIEW · VERIFIED · HOLD · REJECT"
review badge       "Bản gốc" · "Đã xác minh demo"
/demo/rights       "RAW giữ nguyên…" · "training/công khai/audio" · "thay riêng phạm vi consent" · "đủ QA/quyền"
/demo/rights       "Có thể xuất/nhập backup tại Vận hành."   — "Vận hành" là màn chỉ admin vào được
/demo/play         "Câu 1–3: Làm quen"   vs   /demo "01—03 Hiểu cách nói quen thuộc"
sidebar            "Quản lý game"   vs   nút "Quản lý bộ đề" (cùng /demo/admin/exams)
```

**SỬA:** lập một bảng thuật ngữ (mã trạng thái → nhãn tiếng Việt) dùng chung cho filter và badge; viết lại trang quyền bằng ngôn ngữ người chơi hiểu.

### 10 · Lớn · `/demo`

**Mã dự án nội bộ hiện trên trang chủ công khai, cạnh thương hiệu Blaze.**

```
"QUẢNG NAM — ĐÀ NẴNG / APPDICHTHUAT"
```

**SỬA:** bỏ "APPDICHTHUAT" hoặc thay bằng tên sản phẩm công khai.

### 11 · Lớn · `/login`

**Không có đường khôi phục mật khẩu.**

Người quên mật khẩu không có cách nào tự lấy lại, và backend cũng chưa có endpoint cho việc này. Chính chủ dự án cũng đã gặp chuyện này khi không nhớ mật khẩu admin.

```
/login text: "Chào mừng quay lại · Email · Mật khẩu · Đăng nhập · Chưa có tài khoản? Đăng ký"
backend /api/auth: register, login, logout, me
```

**SỬA:** thêm luồng quên/đặt lại mật khẩu. Trước mắt, ít nhất ghi rõ cách liên hệ admin.

### 12 · Lớn · Game (bước đồng ý)

**Ba ô đồng ý không giải thích "huấn luyện" hay "công khai" nghĩa là gì ngay tại chỗ, cũng không có liên kết đến trang quyền.**

```
"Tiếp nhận & kiểm duyệt (bắt buộc)" · "Cho phép sử dụng dữ liệu để huấn luyện" · "Cho phép công khai dữ liệu"
không có helper text, không có link tới /demo/rights trong fieldset
```

**SỬA:** thêm một dòng mô tả dưới mỗi ô và liên kết "Xem chi tiết quyền dữ liệu".

---

### A1 · Khả năng tiếp cận · Toàn sản phẩm · SC 1.4.11 (Non-text Contrast)

**Vòng focus của mọi `.btn` là bóng xanh mặc định của Bootstrap, có tương phản khoảng 2,0:1 với nền. Viền nâu của hệ thống thiết kế không bao giờ hiện ra.**

```
focused: button "Q05" (sau Tab thật, :focus-visible = true)
outline-style: none · outline-color: rgb(128,73,0) (khai báo nhưng bị tắt)
box-shadow: rgba(13,110,253,0.5) 0 0 0 4px trên nền rgb(249,248,245)
màu thực ≈ rgb(131,179,249) → 2.02:1  (yêu cầu ≥ 3:1)

nguyên nhân: collection.css:59  :where(a, button, …):focus-visible { outline: 2px solid var(--accent) }
             :where() có specificity 0 → thua bootstrap .btn:focus-visible { outline: 0 }
```

**SỬA:** thêm `.btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; box-shadow: none; }`.

### A2 · Khả năng tiếp cận · `/demo/game/:id` · SC 1.3.1, 4.1.2

**Lưới Q01–Q10 không cho biết câu nào đang mở hay câu nào đã trả lời, cả bằng mắt lẫn qua trình đọc màn hình.**

```
đang ở Q05: cả 10 nút class "btn btn-outline-primary", aria-current=null, aria-label=null, aria-pressed=null
```

**SỬA:** dùng `aria-current="step"` cho câu đang mở và đổi kiểu hiển thị của nó; thêm `aria-label="Câu 3, đã trả lời"` và dấu hiệu nhìn thấy được cho câu đã trả lời.

---

### Ghi chú

- **N1** · `/demo` có hai nút tô vàng cùng cấp ("Đăng nhập" ở đầu trang và "Chơi game 10 câu"), nên không nút nào thật sự là nút chính. Nên hạ "Đăng nhập" xuống kiểu outline.
- **N2** · `/register`: chữ trong ô "Xác nhận mật khẩu" bắt đầu ở x=20, rộng 350px; ba ô phía trên bắt đầu ở x=60 vì có icon. Ô này thiếu icon và nút hiện mật khẩu riêng.
- **N3** · Ở trang auth, "🌐 Tiếng Việt" là một `<span>` không bấm được nhưng trông như bộ chọn ngôn ngữ.
- **N4** · CSS chồng lớp: `theme.css` (5.872 dòng, khoảng 78% CSS) vẫn là theme indigo cũ (`--brand-500:#6366f1`) và được nạp toàn cục. Có 4 quy tắc `.form-control:focus` nối tiếp nhau; quy tắc cuối dùng `#A15C00` thắng, nên ô nhập vẫn đạt. Nên dọn trước khi theme cũ lộ ra ở màn mới.
- **N5** · Trạng thái rỗng không có hướng dẫn: "Các phiên bản đã tạo" và "Yêu cầu / phản hồi đang chờ" chỉ có tiêu đề, không có nội dung.
- **N6** · Trang chủ công khai thiếu `<meta name="description">` và Open Graph.
- **N7** · Dấu chấm cuối câu ở helper text không thống nhất: 4/5 câu có dấu chấm.
- **N8** · Link chân trang "Hướng dẫn & quyền dữ liệu" cao 167×20px. Link này đứng riêng nên nhiều khả năng vẫn đạt SC 2.5.8 nhờ ngoại lệ khoảng cách, nhưng còn dưới mục tiêu 44px của DESIGN.md §12.2.

## Làm tốt

- **Tương phản:** 0 cặp màu chữ trượt trên mọi trang đã đo (20/20 ở `/demo`, 8/8 ở `/login`, 27/27 ở dashboard). Nút vàng dùng chữ `#262626` trên `#E7A103` (6,84:1), đúng khuyến nghị của DESIGN.md §12.1 thay vì chép chữ trắng 2,21:1 từ nguồn.
- **Form:** mọi trường có tên truy cập từ `label[for]` hoặc label bọc ngoài; `autocomplete` đúng (`email`, `current-password`, `new-password`, `name`).
- **Bố cục:** không có trang nào tràn ngang ở 390 hay 1280px.
- **Cấu trúc:** có skip link, đúng 1 thẻ H1 mỗi trang, không nhảy cấp heading, `lang="vi"`.
- **Vùng chạm:** nút chính cao 44px; label của checkbox đồng ý có vùng bấm 320×46px dù ô vuông chỉ 18px.
- **Hệ thiết kế ở trang công khai gọn:** 1 họ font (Inter, theo quyết định ở DESIGN.md §13.3), 4 màu chữ, 3 bán kính bo góc.
- **Viền ô nhập khi focus** dùng `#A15C00`; khả năng tương phản của chữ được giữ ở mọi trạng thái đã đo.

## Bắt đầu từ đâu

Xếp theo tác động chia cho công sức:

1. **A1:** thêm một quy tắc CSS là sửa được focus cho mọi nút.
2. **01:** sửa nội dung chữ ở các trang và nhãn đã liệt kê. Nghiêm trọng nhưng chỉ cần sửa chữ.
3. **02:** sửa danh sách vùng và thông báo lỗi.
4. **08 và 07:** ánh xạ lỗi tiếng Việt và hiện tên người thay cho ID.
5. **10, 09:** bỏ mã nội bộ và lập bảng thuật ngữ.
6. **03 và A2:** bố cục câu hỏi trên mobile và trạng thái của lưới câu.
7. **05, 12:** xác nhận khi đổi quyền và giải thích phạm vi đồng ý.
8. **04, 06:** kiểm tra chất lượng câu trả lời và thống kê lấy từ server.
9. **11:** thêm luồng quên mật khẩu (cần cả backend).

## Chưa kiểm tra

- Dark mode, zoom 200%, trình đọc màn hình thật, bàn phím ảo.
- Các màn quản trị ở khổ mobile.
- Các trang `/demo/admin/exams`, `/questions`, `/sessions`, `/import`, `/operations`, `/demo/campaigns`, `/ai`, `/community`, `/dictionary`, `/tasks`.
- Toàn bộ 10 bước game, ngoài Q01 và Q05.
- Các trang legacy ngoài `/demo`.
