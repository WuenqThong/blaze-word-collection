# Blaze App — Bộ gen thiết kế UI/UX

**Website khảo sát:** [app.blaze.vn](https://app.blaze.vn/).  
**Ngày khảo sát:** 03/11/2026, Asia/Bangkok.  
**Đầu ra:** một tài liệu tham chiếu thiết kế, tổng hợp từ giao diện thực, computed CSS và tài nguyên frontend công khai bằng quy trình REA. Đây không phải brand guideline chính thức của Blaze.

> Website này dùng nền trắng ấm, vàng hổ phách, chữ Be Vietnam Pro và các panel trắng gọn. Không đồng nhất với bộ xanh dương của `note.blaze.vn` trong bản DESIGN.md trước. Tài liệu này thay thế nguồn tham chiếu cũ bằng đúng `app.blaze.vn`. Việc khảo sát không thay font, màu hoặc chức năng của project hiện tại.

## 1. Phạm vi và độ tin cậy

### 1.1. Quy ước chứng cứ

| Nhãn | Ý nghĩa | Cách sử dụng |
|---|---|---|
| **R** | Quan sát trực tiếp trong trình duyệt: DOM, ảnh, computed style, thao tác | Có thể dùng làm số đo của màn được nêu |
| **S** | Khai báo trong CSS/JavaScript production công khai | Có trong bản build; chưa chứng minh mọi nhánh đang render |
| **I** | Suy luận thiết kế từ các chứng cứ trên | Giải thích quy luật, không phải thông số chính thức |
| **D** | Đề xuất khi áp dụng hoặc cải thiện | Không được ghi thành hành vi đang có của website |
| **U** | Chưa quan sát hoặc chưa xác minh | Cần kiểm chứng bổ sung |

Ưu tiên: computed style của đúng màn/trạng thái → style component đang sử dụng → token theme → CSS thư viện mặc định. Một biến tồn tại ở `:root` không chứng minh component dùng biến đó.

### 1.2. Những gì đã kiểm tra

| Bề mặt / trạng thái | Kết quả | Chứng cứ |
|---|---|---|
| Mở `/` không đăng nhập | Có shell tải ngắn, sau đó chuyển `/signin` | R |
| Đăng nhập, desktop 1280×720 | Logo, ngôn ngữ, SSO, form, link, legal copy; đo kiểu chữ và kích thước | R |
| Đăng ký, desktop và mobile 390×844 | Ba trường, hai checkbox, CTA, link quay lại; form mobile không tràn ngang | R |
| Quên mật khẩu | Form khác hệ auth mới: rộng 300px, heading 28/44, weight 700 | R |
| Submit đăng nhập trống | Lỗi từng trường, viền đỏ và dòng giải thích; không nhập tài khoản | R |
| Dropdown ngôn ngữ | Có English / Tiếng Việt; trạng thái chọn và mở/đóng | R |
| Modal điều khoản | Mở từ đăng ký, width 700px ở desktop, backdrop đen 45%, nút đóng | R |
| Shared app/API shell, sidebar, mobile launcher | Đọc style, cấu trúc, breakpoint và trạng thái từ bundle | S |
| Trang chủ sau đăng nhập | Đọc chunk trang chủ; chưa xem bằng tài khoản thật | S / U runtime |
| Dark theme | Có token và cấu hình; chưa bật/quan sát trên tài khoản | S / U runtime |
| Dashboard nghiệp vụ, billing, audio/model hoạt động | Chưa nghiệm thu runtime | U |

Không đăng nhập Google, không tạo tài khoản, không chấp nhận điều khoản, không gửi yêu cầu đặt lại mật khẩu. Không suy chất lượng chức năng từ việc tìm thấy route trong bundle.

### 1.3. REA được sử dụng như thế nào

Áp dụng nguyên tắc bám nguồn của `claude-design` và workflow [reverse-engineer-anything](https://github.com/morluto/rea/blob/main/.agents/skills/reverse-engineer-anything/SKILL.md). Dùng CLI `rea-agents` báo phiên bản **6.7.0**, phân tích tĩnh các file đã tải từ URL asset thật; quan sát trình duyệt dùng công cụ điều khiển browser của phiên hiện tại.

- Nhóm auth: 4 file, 20.452 byte, parse 4/4, không parse failure, 111 findings. Evidence: `ev_518c5d0ba1e4d7849cbd8ba43e3b51522350886b9d6bff4d8411f0e8eb36bcdb`.
- Trang chủ: 1 file, 6.513 byte, parse 1/1, không parse failure, 26 findings. Evidence: `ev_068ed062d96c22c7ebd68bf6bce24ed21d59c749807e3f474c17e4676c72520e`.
- Lần phân tích bundle gốc ~6,19 MB gặp giới hạn heap của worker. Evidence một phần: `ev_5e1dc59abce72593a54abf617ceb0eb9fa4ec6f87f54b13d5807f627ca290895`. Không coi graph này là đầy đủ. Sau đó thu hẹp sang chunk UI; shared shell/theme được đọc tĩnh có mục tiêu và đối chiếu với DOM.
- Các import ngoài nhóm file chọn vẫn chưa được REA giải quyết toàn bộ. Không chạy mã bundle trong bước phân tích tĩnh. “Parse thành công” không có nghĩa đã chứng minh mọi call-flow hoặc tính năng.

## 2. Bản sắc thị giác

### 2.1. Mô tả ngắn

**I — Tên mô tả:** workspace AI tông ấm, tiết chế, ưu tiên thao tác.

Nền off-white ấm giữ toàn trang nhẹ; vùng làm việc là panel trắng, viền beige mỏng. Vàng hổ phách dành cho thương hiệu, CTA và trạng thái chọn; nâu vàng đậm dành cho link/nhấn chữ. Chữ tối gần đen, chữ phụ xám ấm. Component thấp và gọn, bo góc vừa; shadow chủ yếu dành cho lớp nổi. **R/S**

### 2.2. Các dấu hiệu nhận diện cần giữ

1. Biểu tượng ngọn lửa/orb Blaze gốc, đi cùng chữ Blaze; không thay bằng icon lửa chung.
2. Nền `#F9F8F5`, panel trắng; không ép mọi bề mặt thành trắng tinh.
3. Tách **brand fill** vàng sáng và **accent text** nâu vàng; hai vai trò có màu khác nhau.
4. Be Vietnam Pro cho app/API/auth mới; phần lớn UI 13–16px, weight 400/500/600.
5. Hierarchy bằng nền, khoảng cách và weight; hạn chế các viền và shadow lặp lại.
6. Sidebar gọn, panel chính lớn; mobile có cơ chế điều hướng riêng trong shared shell.
7. Input/nút auth bo 10px; panel shell bo 16px; pill chỉ dùng cho một số điều khiển.

### 2.3. Không phải đặc trưng chung

- Xanh dương không phải màu CTA chính của app này. Màu xanh xuất hiện ở thư viện, link nguồn, tag hoặc trạng thái riêng. **R/S**
- Gradient vàng có khai báo và xuất hiện ở một số component; không phải nền phủ toàn website. **S**
- Font Ballet và Manrope có link trong document nhưng chưa chứng minh đang render các màn đã khảo sát. Không dùng sự có mặt của link để quyết định typography chính. **R/U**
- Shell cũ có nhiều token riêng; không gom tùy tiện mọi `paper`, `pricing`, `api` thành một surface duy nhất. **S**

## 3. Logo, wordmark và icon

### 3.1. Logo thật

Nguồn [icon.png](https://app.blaze.vn/icon.png), ảnh gốc **128×128**. Ở auth: ảnh **40×40px**, chữ Blaze **24px / weight 600**, khoảng cách ảnh–chữ **10px**; link logo về `/`. Tổng lockup đo được khoảng **115,81×40px**. **R/S**

Trong shared sidebar, style dùng icon **28px**, chữ Blaze **19px/28px**, weight 500; suffix nhỏ hơn **16px**, màu muted. Sidebar thu gọn giữ icon. Suffix phụ thuộc app/API mode; không suy ra auth cũng phải có suffix. **S**

**D — Khi tái sử dụng:** giữ tỷ lệ 1:1 của icon, `object-fit:contain`, ảnh và text thành lockup linh hoạt; dành clearspace tối thiểu khoảng 8–12px tùy kích thước. Đây là đề xuất, không phải clearspace guideline được Blaze công bố. Logo của APPDICHTHUAT vẫn chỉ Blaze theo quyết định trước của người dùng.

### 3.2. Ngôn ngữ icon

- Auth dùng icon từ hệ Ant Design và SVG: Google, mắt mật khẩu, globe, chevron, close. **R/S**
- Shared shell có SVG nét, thường **16/20/24px**, stroke khoảng **1,75**; nhiều icon kế thừa `currentColor`. **S**
- Sidebar: icon trước label, khoảng cách 10px. Icon muted ở trạng thái thường, accent khi active. **S**
- Home: nền icon hình vuông bo góc, kích thước 56px desktop / 44px mobile, bên trong icon nhỏ hơn. **S**
- Không dùng emoji để thay bộ icon; không kéo icon thành hình chữ nhật. **D**

## 4. Hệ màu

### 4.1. Màu nền và nội dung chính

Các biến dưới đây có trong computed `:root` ở auth. **R**, xác nhận thêm bằng **S**.

| Vai trò | Token | Light |
|---|---|---|
| Nền app/shell | `--api-shell-bg`, `--app-page-bg` | `#F9F8F5` |
| Panel chính | `--api-panel-bg` | `#FFFFFF` |
| Viền panel | `--api-panel-border` | `#ECE7DE` |
| Card gần trắng | `--api-card-bg` | `#FDFCF9` |
| Field/card nền nhẹ | `--api-field-bg` | `#FBF9F5` |
| Field hover | `--api-field-hover-bg` | `#F6F2EA` |
| Field accent nền | `--api-field-accent-bg` | `#FFF7E3` |
| Hover chung | `--api-hover-bg` | `#F8F5EF` |
| Divider | `--api-divider` | `#F0ECE5` |
| Divider trong field | `--api-field-divider` | `transparent` |
| Chữ chính | `--api-text` | `#262626` |
| Chữ phụ | `--api-text-muted` | `#6B6560` |
| Brand fill | `--api-brand`, `--primary-color` | `#E7A103` |
| Chữ trên brand theo nguồn | `--api-brand-contrast` | `#FFFFFF` |
| Accent text/link | `--api-accent` | `#A15C00` |
| Nền accent nhẹ | `--api-accent-soft` | `#FFF4D6` |
| Chữ trên accent theo nguồn | `--api-accent-contrast` | `#FFFFFF` |
| Card được nhấn | `--api-card-accent-bg` | `#FFFBF0` |
| Viền card nhấn | `--api-card-accent-border` | `#F3DFAB` |

Gradient brand: `linear-gradient(135deg, #F5B941 0%, #E7A103 100%)`. Button đăng nhập thực tế có **solid background `#E7A103`**, không gradient. **R/S**

### 4.2. Token Ant Design có hiệu lực

| Thuộc tính theme | Light | Dark khai báo |
|---|---|---|
| `colorTextBase` | `#111111` | `#FFFFFF` |
| `colorBgBase` | `#FBF5EF` | `#222222` |
| `colorBgContainer` | `#FFFFFF` | `#1B1916` |
| `colorBgElevated` | `#FFFFFF` | `#211E1A` |
| `colorBorder` | `#E2DCD1` | `#3A342B` |
| `colorText` | `#262626` | `#F2EFE9` |
| `colorTextPlaceholder` | `#9A948B` | `#7D776E` |
| `colorLink` | `#A15C00` | `#F5B941` |
| `colorPrimary` | `#E7A103` | `#E7A103` |

**S**, nhiều giá trị light được xác nhận qua component thực **R**. Không nhầm `--input-border-color:#E4E4E7` của tầng cũ với viền auth AntD đang dùng `#E2DCD1`.

### 4.3. Trạng thái và code/API

| Vai trò | Token / giá trị | Phạm vi |
|---|---|---|
| Success đậm | `--api-success:#15803D` | App/API |
| Success nền | `--api-success-soft:#E7F8ED` | App/API |
| Danger đậm | `--api-danger:#B42318` | App/API |
| Warning nền/chữ | `#FFF7ED` / `#8A3B0B` | App/API |
| Success cũ | `--success-color:#52C41A` | Tầng global cũ |
| Warning cũ | `--warning-color:#C48900` | Tầng global cũ |
| Error form auth | `#FF4D4F` | R: lỗi form trống |
| Ink panel | `#2A2015` | S: panel tương phản |
| Code nền / bar / border | `#FAFBFC` / `#F4F5F7` / `#E6E8EC` | S |
| Code text / muted | `#24292F` / `#6B7280` | S |
| Code key / keyword | `#A15C00` / `#C2410C` | S |
| Code string / number | `#0A7A3D` / `#B35900` | S |

Biến tên `--api-violet` thực có giá trị light `#C2410C` — một tông cam đất. Khi áp dụng phải đọc giá trị/vai trò, không tô tím chỉ vì tên biến. **R/S**

### 4.4. Dark theme — chỉ xác minh khai báo

| Token | Dark |
|---|---|
| `--api-shell-bg` | `#141210` |
| `--api-panel-bg` | `#1B1916` |
| `--api-panel-border`, `--api-divider` | `#2E2A24` |
| `--api-card-bg` | `#211E1A` |
| `--api-field-bg` | `#25221D` |
| `--api-field-hover-bg` | `#2D2923` |
| `--api-field-accent-bg` | `#2C2414` |
| `--api-text` | `#F2EFE9` |
| `--api-text-muted` | `#A8A29A` |
| `--api-accent` | `#F5B941` |
| `--api-accent-soft` | `#33270F` |
| `--api-accent-contrast` | `#1A1406` |
| `--api-brand` | `#E7A103` |
| `--api-success` | `#4ADE80` |
| `--api-danger` | `#FF7B72` |

**S/U:** đây là map được phát hành trong bundle, chưa phải ảnh hoặc kết quả kiểm tra dark runtime. Không khẳng định mọi module cũ đã đồng bộ dark.

## 5. Typography

### 5.1. Font family thực tế

App/API/auth mới khai báo và có computed style:

```css
font-family: 'Be Vietnam Pro', Inter, system-ui, -apple-system,
             'Segoe UI', sans-serif;
```

**R/S:** link Google Fonts yêu cầu Be Vietnam Pro 400/500/600/700. Inter là fallback trong chuỗi, không phải primary của nguồn. Document cũng có Manrope 400–700 và Ballet; chưa xác minh glyph của các font này trong màn khảo sát.

**S:** tầng global cũ có chuỗi `Nato Sans` và nhiều fallback khác; route override app/API/auth mới mới là căn cứ đúng. Không lấy khai báo global đầu tiên trong bundle làm kết luận cho toàn ứng dụng. Computed style xác nhận chuỗi font; chưa có phép xác minh font render từng glyph bằng DevTools Fonts.

### 5.2. Thang chữ theo component

| Thành phần | Size / line-height | Weight | Tracking | Chứng cứ |
|---|---|---|---|---|
| Auth heading | 28 / 36px | 600 | `-0.02em` = -0,56px | R/S |
| Auth mô tả | 15 / 22px | 400 | mặc định | S, phù hợp R |
| Auth input | 16 / 24px | 400 | mặc định | R |
| Auth nút chính | 16 / ~25,14px | 500 | mặc định | R |
| Form label/theme | 14 / 22px | 500 label | mặc định | R/S |
| Link quên mật khẩu | 13 / ~20,43px | 500 | mặc định | R |
| Legal footer | 12 / 18px | 400 | mặc định | S |
| Body global tại signin | 16 / 25,6px | 400 | mặc định | R |
| Sidebar navigation | 14 / 20px | thường 400; active 500 | mặc định | S |
| Sidebar nhóm | 12 / 16px | 500 | mặc định | S |
| Shell page title | 14 hoặc 16 / 24px | 600 | mặc định | S |
| Home heading | `clamp(26px,3.4vw,38px)` / 1.2 | 600 | `-0.02em` | S |
| Mobile nav label | 11 / 14px | 500; active 600 | mặc định | S |
| Forgot heading cũ | 28 / 44px | 700 | chưa chuẩn hóa chung | R |

Khác biệt giữa 16px body và 14px UI theme là có thật. Không đặt toàn bộ control về 16px rồi gọi đó là bản sao nguyên trạng nguồn.

### 5.3. Thang token global và scale cục bộ

Với root 16px: **R/S**

| Token | Cỡ chữ | Line-height |
|---|---|---|
| xs | 0.6rem = 9,6px | 1.2rem = 19,2px |
| s | 0.8rem = 12,8px | 1.4rem = 22,4px |
| m | 1rem = 16px | 1.6rem = 25,6px |
| l | 1.2rem = 19,2px | 1.8rem = 28,8px |
| xl | 1.8rem = 28,8px | 2.4rem = 38,4px |
| xxl | 2rem = 32px | 2.6rem = 41,6px |
| xxxl | 3.5rem = 56px | 4.1rem = 65,6px |

Có trang nội bộ override scale thành **12/18, 14/20, 16/24, 20/28px**. Các token global 9,6px hoặc 56px không có nghĩa mọi màn phải dùng chúng. **S**

**D — Quy tắc tái sử dụng:** chữ nội dung không scale X/Y, không `font-stretch` tùy tiện, không tăng tracking đại trà; giữ các dấu tiếng Việt đủ không gian. Không thấy `transform` kéo méo trên heading/control đăng nhập đã đo. Cảm giác hình dáng font nên giải quyết bằng chọn font/weight/line-height, không bóp tỷ lệ chữ.

## 6. Bố cục và mật độ

### 6.1. Auth mới

- Khung full width, `min-height:100dvh`; nền shell ấm. **S/R**
- Desktop padding ngoài **24px 32px**; dưới 600px đổi **16px 20px**. **S**
- Hàng đầu grid **1fr / auto / 1fr**, gap 12px; logo giữa, language ở phía phải. **S/R**
- Vùng form được căn giữa bằng flex; padding dọc vùng giữa **32px**. **S**
- Nội dung form `width:100%; max-width:400px`, stack gap **24px**, form-item cách dưới **18px**. **S/R**
- Desktop 1280px: form x=440, width=400. Mobile 390px: form x=20, width=350. **R**
- Không có card trắng đổ bóng bao toàn form; input và nút tự tạo hình dạng. **R**
- Heading căn trái theo form; logo có trục giữa riêng. Không căn mọi thứ vào giữa chỉ vì form nằm giữa trang. **R/S**

### 6.2. App/API shared workspace

**S — Chưa chụp được workspace sau đăng nhập.**

| Thành phần | Quy tắc khai báo |
|---|---|
| Sidebar mở / thu gọn | 240 / 64px |
| Sidebar nền | `--api-shell-bg`, padding 12px 8px |
| Khung ngoài | `height:100dvh`, flex column, overflow hidden |
| Chừa sidebar | Padding trái theo width sidebar; phải/dưới 8px |
| Panel chính | Trắng, viền 1px, radius 16px, min-width:0, flex:1 |
| Header | Grid `minmax(140px,1fr) minmax(0,420px) minmax(max-content,1fr)` |
| Header spacing | Min-height 56px; padding 8px 8px 8px 16px; gap 16px |
| Vùng nội dung | Cuộn riêng; padding mặc định 0 24px 56px |
| Inner stack tiêu chuẩn | Max-width 985px, margin trên 32px, gap 16px |
| Trang flush | Có nhánh bỏ padding; không gán 985px cho mọi layout |

Trên mobile ≤768px: shell chuyển auto height/min-height viewport, không còn overflow cố định như desktop; panel bỏ radius/viền; body padding thành 0 16px 40px; header đổi hai cột và một số điều khiển được ẩn. Có nhánh sticky header và safe-area dành cho chế độ mobile riêng. **S**

### 6.3. Trang chủ ứng dụng

**S — Từ chunk `index-2b7daf79.js`; không phải ảnh homepage đã đăng nhập.**

- Outer container max-width **1120px**, padding desktop **12dvh 24px 56px**, gap 56px.
- Heading responsive 26–38px, căn giữa; vùng nhập/tìm chính max-width **880px**.
- Nhóm lối tắt desktop flex-wrap; tile rộng 116px, icon nền 56×56 bo 16, label 14px.
- Mobile: khoảng cách 24px, padding 16px 16px 24px; lối tắt grid **5 cột**; icon 44×44 bo 14, chữ ngắn 11,5/15px; mục phụ được đưa sau nút “thêm”.
- Card kêu gọi hành động: desktop grid 1fr/auto, padding 32px 36px, radius 20px; có radial accent rất nhẹ trên nền field.
- Mobile card rút gọn: padding 14px 14px 14px 18px, radius 16px, heading 15/20; mô tả phụ được ẩn.

## 7. Spacing, radius, border và elevation

### 7.1. Spacing tokens

| Token | Giá trị | Quy đổi ở root 16px |
|---|---|---|
| xxs | 0.1rem | 1,6px |
| xs | 0.4rem | 6,4px |
| s | 0.8rem | 12,8px |
| m | 1.2rem | 19,2px |
| l | 1.6rem | 25,6px |
| xl | 2.5rem | 40px |
| xxl | 3.2rem | 51,2px |

**R/S:** các component mới đồng thời dùng số px riêng: 4/6/8/10/12/14/16/18/20/24/28/32. Đây là hệ đang chuyển tiếp, không phải một scale 8px thuần túy. AntD `sizeStep=4` cũng không chứng minh mọi padding là bội số 4.

### 7.2. Radius

Token global: **2 / 4 / 8 / 20 / 40px**. AntD theme radius **8px**; auth input và nút large thực **10px**; workspace panel **16px**; mode menu **12px**; card home **20px**; bottom sheet/launcher **24px**; segmented và language dùng **999px**. **R/S**

### 7.3. Đường viền và bóng

- Surface lớn: viền 1px beige, không shadow rõ. **R/S**
- Form focus: viền brand và ring 2px, màu tính được `rgba(255,225,5,0.1)`. **R**
- Menu mode: `0 12px 32px rgba(16,24,40,0.14), 0 2px 6px rgba(16,24,40,0.06)`. **S**
- Launcher: shadow sâu hơn, ví dụ `0 24px 48px -12px rgba(15,23,42,0.32)`. **S**
- Modal mask đo được `rgba(0,0,0,0.45)`. **R**
- Skeleton global là gradient xám alpha 0,06 → 0,15 → 0,06; không phải gradient thương hiệu. **R/S**

## 8. Component inventory và trạng thái

| Component | Default | Hover / focus / selected | Disabled / error / loading | Chứng cứ |
|---|---|---|---|---|
| Primary auth button | Brand solid, chữ trắng, radius 10, full width, cao ~42,5px | Transition AntD 0,2s; hover chưa đo trực tiếp | Có loading theo mutation trong code; error form quan sát trực tiếp | R/S |
| Google SSO | Trắng, border `#E2DCD1`, chữ/icon tối, radius 10, cùng chiều rộng CTA | Kế thừa AntD | Code có pending và notification lỗi/popup bị chặn; chưa chạy OAuth | R/S/U |
| Text input | Trắng, padding ~8,3px 11px, 16/24, radius 10 | Focus brand + ring; email autofocus khi vào | Validation từng field; error 14/22 màu `#FF4D4F` | R |
| Password | Affix wrapper có viền; input con không có viền/padding | Icon mắt ở phải | Toggle nằm trong hệ AntD; chưa audit keyboard đầy đủ | R/S/U |
| Form label | 14px, weight 500, phía trên field | Link quên mật khẩu nằm cùng hàng label | Required marker được ẩn, không có nghĩa field là optional | R/S |
| Checkbox | Ô nhỏ, nhãn text cạnh bên | Selected chưa thử | Terms và marketing tách riêng | R |
| Language select | Pill trắng, 148px khai báo, cao 36px, chữ 13px/500 | Hover/focus dùng nền field-hover; dropdown có option selected | Không thực hiện đổi ngôn ngữ | R/S |
| Text link | Nâu vàng, weight nhấn | Link quên mật khẩu underline khi hover theo style | Tránh chỉ dựa màu cho link trong đoạn dài | R/S/D |
| Divider auth | Hai đường mảnh, text ở giữa, gap 12px | Không có interaction | Không dùng như card border | R/S |
| Modal | Tiêu đề, nội dung, đóng góc, footer | Mở gắn hash `#termsAndConditions`; đóng bỏ hash | Width desktop đo 700px, y=20; chưa test mọi cách dismiss | R |
| Sidebar row | Min-height 36px, padding 7px 10px, radius 8, font 14/20 | Hover nền nhẹ; active accent/500; focus ring 2px inset | Action nhỏ hiện khi hover/focus-within; touch thì luôn hiện | S |
| Icon-only sidebar action | 24×24, radius 6 | Focus-visible có outline | Không mặc định coi 24px là target mobile tốt | S/D |
| Mode/account dropdown | Panel trắng, border nhẹ, radius 12/14, shadow | Chọn bằng click, tick accent, hover fill | Có variant card/avatar và nhánh compact | S |
| Segmented | Pill 999px, track padding 4px | Thumb trắng, chữ selected tối; light track `#F0E9DC` | Dark track `#29251F` | S |
| Table/descriptions nội bộ | Header nhẹ, chữ 12–13px, cell padding 10px 12/14px | Hover/background theo module/theme | Placeholder/empty text nhỏ; không phải tất cả bảng toàn site | S |
| Empty/loading | Skeleton, placeholder, nội dung mô tả nhỏ | Không giả dữ liệu thật | Module có biến thể empty khác nhau | S |
| Toast/notification | AntD notification | Theo hành động/auth result | Google error/warning khai báo duration 5 giây | S |

**Lưu ý đo input mật khẩu:** chiều cao 24px của input con là phần text; control thực nằm trong wrapper ~42px. Không dùng số của child làm chiều cao vùng bấm cả control.

## 9. Responsive và điều hướng mobile

### 9.1. Breakpoint đã tìm thấy

| Breakpoint | Ý nghĩa quan sát / khai báo |
|---|---|
| 600px | Auth padding, một số layout/style global |
| 768px | Hằng shared mobile breakpoint; shell/sidebar/header/home đổi bố cục |
| 992px | Có hằng breakpoint bổ sung trong bundle; chưa xác định mọi consumer |
| 575px, 400px | Một số component riêng; không coi là breakpoint toàn app |

### 9.2. Shared mobile shell

**S:** có điều hướng dưới với label nhỏ, active màu accent và nền pill; launcher nổi mở lưới tính năng; drawer/bottom sheet cho danh sách hoặc tài khoản. Sheet max-height 88dvh, radius phía trên 24px, cuộn nội dung, dùng safe-area. Launcher đặt cách mép trái/phải 12px, có backdrop và z-index 998/1001; có animation xuất hiện từ dưới.

Nút launcher tròn 56px; icon có nhánh quay 360° khi mở và scale 1,06. `prefers-reduced-motion` được xử lý ở launcher đó. Không vì tìm thấy một nhánh reduced-motion mà khẳng định toàn app đã đáp ứng. **S/U**

### 9.3. Kết quả đo mobile công khai

Viewport CSS **390×844**, document width **390px**; auth form width **350px**, lề **20px**. Heading vẫn **28/36**, không bị thu xuống 20px. CTA rộng hết form. Đăng ký vẫn đi theo một cột; không có sidebar trong auth. **R**

**D:** khi triển khai bảng rộng, cho bảng cuộn trong vùng riêng, không làm toàn trang tràn. Có `min-width:0` trên các nhánh flex/grid; giữ safe-area cho fixed navigation. Không ép desktop shell vào mobile bằng thu nhỏ toàn trang.

## 10. Motion, tương tác và focus

### 10.1. Thang thời gian

Token global: **60 / 100 / 250 / 600 / 1000 / 3000ms**. Component mới thường dùng **120/150/200ms**, launcher **280ms**, một animation icon **600ms**. **R/S**

- Auth button transition đo được **0,2s**, cubic-bezier **(0.645,0.045,0.355,1)**. **R**
- Navigation hover nền **120ms**; icon/field/menu thường 150ms. **S**
- Home feature hover: icon nâng **2px** và đổi nền/màu, 150ms. **S**
- Sidebar collapse thay padding **200ms**. **S**
- Launcher vào bằng translateY/scale/opacity; không phải mọi panel đều animate. **S**

### 10.2. Focus và trạng thái

Email được focus khi vào auth; focus ring vàng mảnh. Label gắn với input trong form mới; error inline tương ứng từng trường. Ngôn ngữ là combobox với list chọn, modal có role dialog và nút Close. Các row/button tự viết trong shared shell có outline 2px ở `:focus-visible`. **R/S**

Có global reset `outline:none` cho control, nên component mới phải tự cung cấp focus. Không áp dụng reset này sang project khác mà thiếu focus replacement. **S/D**

## 11. Luồng UX và cách viết nội dung

### 11.1. Auth

Đăng nhập: nhận diện thương hiệu → tiêu đề/mô tả ngắn → lựa chọn SSO → phân tách → email/password → CTA → chuyển đăng ký → legal copy. **R**

Đăng ký tái dùng shell này, thêm xác nhận mật khẩu và hai consent khác mục đích. Link terms mở modal mà không rời form; không yêu cầu checkbox marketing cùng với terms. **R/S**

Quên mật khẩu điều hướng ra route riêng, hiện vẫn là form cũ. Đây là khác biệt thực của trải nghiệm, không phải mẫu chuẩn cho toàn auth. **R**

### 11.2. Workspace và khám phá tính năng

**S/I:** sidebar giữ nhóm chức năng, tài khoản và mode; header giữ ngữ cảnh trang/tìm kiếm/hành động. Home là nơi vào tính năng bằng các lối tắt icon. Desktop ưu tiên nhãn đủ; mobile có nhãn rút gọn và launcher để tránh dồn sidebar dài lên màn hình nhỏ.

### 11.3. Microcopy

- Tiếng Việt trực tiếp, ngắn, mô tả hành động và trạng thái; heading có tên sản phẩm ở auth. **R**
- Một CTA chính rõ ràng trong mỗi form. Lỗi nói đúng trường cần bổ sung, không chỉ đưa mã lỗi. **R/I**
- Tooltip/hint và label ngắn dùng cho chức năng dày; nội dung dài đặt ở vùng riêng. **S/I**
- Placeholder chỉ hỗ trợ nhập, không thay label; trạng thái không chỉ thể hiện bằng màu. **D**
- Với app thu thập dữ liệu: cần nêu rõ demo/thu thật, quyền dữ liệu và tác động thao tác; đây là bổ sung nghiệp vụ APPDICHTHUAT, không phải tính năng suy ra của Blaze App. **D**

## 12. Khả năng tiếp cận: giữ ưu điểm, sửa hạn chế

### 12.1. Độ tương phản tính từ màu nguồn

Tính theo sRGB relative luminance từ giá trị màu khai báo/đo được, không lấy mẫu màu từ ảnh anti-alias. Chữ thông thường cần ít nhất 4,5:1; chữ lớn có ngưỡng 3:1 theo [WCAG 2.2 SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

| Cặp màu | Tỷ lệ xấp xỉ | Nhận xét |
|---|---|---|
| Trắng trên brand `#E7A103` | **2,21:1** | Nút auth 16px/500 không đạt ngưỡng chữ thông thường |
| Trắng trên đầu gradient `#F5B941` | **1,76:1** | Không phù hợp chữ nhỏ |
| `#262626` trên brand `#E7A103` | **6,84:1** | Phương án chữ tối đạt tương phản tốt hơn |
| Accent `#A15C00` trên shell `#F9F8F5` | **4,89:1** | Đạt 4,5:1 cho chữ thường |
| Muted `#6B6560` trên shell | **5,41:1** | Đạt 4,5:1 |
| Placeholder theme `#9A948B` trên trắng | **3,01:1** | Chưa đạt 4,5:1 nếu dùng cho chữ thông tin |
| Error `#FF4D4F` trên trắng | **3,27:1** | Error auth 14px cần màu đậm hơn khi áp dụng |

Các tỷ lệ trên đánh giá đúng cặp màu, không phải chứng nhận accessibility toàn website. Viền control, icon, hover, dark theme cần kiểm riêng.

### 12.2. Touch target và keyboard

- Button large auth đo khoảng **42,5px** chiều cao, language pill 36px; sidebar row 36px và action 24px trong source. Không ghi thành “mọi vùng bấm ≥44px”. **R/S**
- Đề xuất target chính mobile ≥44×44px; 44px là mục tiêu enhanced AAA có ngoại lệ, không phải tự động kết luận mọi control dưới 44px vi phạm AA. Tham chiếu [SC 2.5.5](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html). **D**
- Checkbox graphic 14px không bằng toàn vùng click của label; phải đo hit area thực trước khi kết luận. **R/D**
- Icon mắt mật khẩu trong accessibility tree xuất hiện như image; chưa xác minh đầy đủ focus/keyboard/accessible name của toàn wrapper. Cần audit riêng, không tự kết luận đạt. **R/U**
- Form quên mật khẩu có input placeholder nhưng không thấy tên truy cập rõ trong AX; nên thêm label nếu áp dụng. **R/D**
- Chưa audit screen reader toàn tuyến, zoom 200%, bàn phím ảo, contrast mọi trạng thái hoặc tất cả breakpoint. **U**

## 13. Công thức triển khai có thể tái dùng

### 13.1. Bộ token lõi của nguồn

Đây là bản rút gọn để tham chiếu, không phải patch đã áp dụng cho project:

```css
:root {
  --font-family-primary: 'Be Vietnam Pro', Inter, system-ui,
                         -apple-system, 'Segoe UI', sans-serif;
  --api-shell-bg: #f9f8f5;
  --api-panel-bg: #ffffff;
  --api-panel-border: #ece7de;
  --api-field-bg: #fbf9f5;
  --api-field-hover-bg: #f6f2ea;
  --api-text: #262626;
  --api-text-muted: #6b6560;
  --api-brand: #e7a103;
  --api-accent: #a15c00;
  --api-accent-soft: #fff4d6;
  --api-divider: #f0ece5;
}
```

### 13.2. Thứ tự dựng giao diện

1. Chốt identity: đúng Blaze App, không trộn token Blaze Note vào.
2. Dựng shell và cơ chế desktop/mobile trước; tách auth khỏi workspace.
3. Chọn đúng typography từng scope, có font tiếng Việt và weight thật; kiểm glyph trên nội dung có dấu.
4. Đặt surface, spacing, radius; sau đó mới dựng form/menu/table/media.
5. Mỗi component có normal/focus/disabled/error/loading/empty tùy ngữ cảnh. Phần nào chưa có backend phải được ghi rõ.
6. Kiểm màu chữ trên vàng trước khi chọn variant CTA. Giữ nhận diện vàng nhưng dùng chữ tối hoặc nền tối hơn khi cần đạt tương phản.
7. Kiểm width 390px, desktop, tab order, focus, error text, zoom; đừng chỉ đối chiếu screenshot mặc định.

### 13.3. Áp dụng vào APPDICHTHUAT

**D:** có thể học panel trắng trên shell nhẹ, sidebar gọn, field fill, shadow tiết chế, nhãn rõ, mobile navigation và cấu trúc error/loading. Các quyết định đã được người dùng chọn cho project — **Inter tự host, Blaze không Collection, màu xanh** — vẫn giữ nguyên cho đến khi có yêu cầu triển khai mới. File này mô tả nguồn, không tự đổi quyết định sản phẩm.

Không sao chép nguyên vấn đề tương phản của nút vàng, input thiếu label hoặc kích thước chữ quá nhỏ. Các phần game 10 câu, consent training/công khai/audio, RAW/review/dataset phải được thiết kế theo nghiệp vụ APPDICHTHUAT; không thể suy ra chỉ từ website Voice AI.

## 14. Checklist và phần chưa biết

| Hạng mục | Trạng thái |
|---|---|
| Nhận diện đúng website, logo thật | Đã xác nhận |
| Token màu light, font, kích thước auth | Đã đo và đối chiếu source |
| Các biến spacing/radius/timing và tầng theme | Đã trích xuất |
| Auth error, dropdown, modal, mobile | Đã quan sát |
| Shared sidebar/header/panel/home | Đã phân tích tĩnh, chưa chứng minh runtime đăng nhập |
| Dark theme | Có source token; chưa kiểm runtime |
| Workspace nghiệp vụ sau đăng nhập | Còn cần phiên truy cập hợp lệ để đối chiếu ảnh và thao tác |
| Toast lỗi mạng/OAuth/server thực | Có nhánh code, chưa kích hoạt kiểm thử |
| Tất cả module billing/admin/audio/chat | Chưa khảo sát toàn bộ; không gọi component catalogue này là chứng minh mọi route |
| Accessibility toàn website | Chưa chứng nhận; đã nêu các vấn đề cụ thể |

“Bộ gen” trong file này là catalogue đầy đủ theo phạm vi chứng cứ đã thu: nguyên tắc, token, layout, component, state, responsive, motion, nội dung và các giới hạn. Màn cần đăng nhập vẫn phải được xác minh trước khi yêu cầu tái tạo chính xác từng pixel.

## 15. Nguồn, build identity và khả năng truy nguyên

### 15.1. URL nguồn chính

- [Website](https://app.blaze.vn/), [đăng nhập](https://app.blaze.vn/signin), [đăng ký](https://app.blaze.vn/signup), [quên mật khẩu](https://app.blaze.vn/forgotPassword).
- [Logo](https://app.blaze.vn/icon.png).
- [CSS entry](https://app.blaze.vn/assets/index-cb4bcbea.css).
- [JavaScript entry](https://app.blaze.vn/assets/index-c9b5d9a7.js).
- [Signin chunk](https://app.blaze.vn/assets/index-1561aa1b.js), [signup chunk](https://app.blaze.vn/assets/index-69b91750.js).
- [Auth styles](https://app.blaze.vn/assets/styles-d9a5c44e.js), [GoogleAuth](https://app.blaze.vn/assets/GoogleAuth-e1d5aa57.js), [home](https://app.blaze.vn/assets/index-2b7daf79.js).
- [REA chính thức](https://github.com/morluto/rea), [workflow REA](https://github.com/morluto/rea/blob/main/.agents/skills/reverse-engineer-anything/SKILL.md).

Tên asset có hash build có thể thay đổi khi website deploy. Kết luận áp dụng cho bản được khảo sát, không tự động cho mọi phiên bản tương lai. Bản đọc prettier chỉ để tìm cấu trúc; checksum dưới đây tính trên byte file tải gốc.

### 15.2. SHA-256 của asset chính

```text
index-c9b5d9a7.js
abb69680a268efc1c8b85ce8bea1e47841a5d376fc8ba5dddec583cb7f821922

index-cb4bcbea.css
cb4bcbeab43fbd09009f3699feb901e1077f65d6f446c1cc7e583935a5d4a19b

index-1561aa1b.js
603c14e9389fbd7eea603271fa4503c762fe8d2c1b1407d5ecaf282f5fc920cc

index-69b91750.js
bba91b127c0966685e8ff30fcdfe0e09c9dec700b7297ce36c693198576b5140

GoogleAuth-e1d5aa57.js
8d7b7fe7723c99d3c3f3fffce4c24f0fd140d19bc25c2818970ece2601a02b74

styles-d9a5c44e.js
e66b48b21d036f3184009d427b8e4e27de8f2721a32efdebe78c6ff8c9aafa80
```

Chỉ bàn giao một file DESIGN.md. Asset công khai, capture số đo và REA Evidence được dùng để khảo sát trong thư mục tạm, không biến thành dependency mới của ứng dụng.

## Phụ lục A — Toàn bộ custom properties đọc được tại signin

Snapshot computed `:root`, light theme, desktop 1280×720. Giữ tên và giá trị gốc để người triển khai tra cứu, kể cả token legacy/pricing chưa được chứng minh có sử dụng trên signin. Danh sách này không bao gồm mọi CSS-in-JS local style, thuộc tính pseudo hoặc mọi biến được khai báo ở các scope chưa mở.

```json
{
  "--api-accent": "#a15c00",
  "--api-accent-contrast": "#ffffff",
  "--api-accent-soft": "#fff4d6",
  "--api-brand": "#e7a103",
  "--api-brand-contrast": "#ffffff",
  "--api-brand-gradient": "linear-gradient(135deg, #f5b941 0%, #e7a103 100%)",
  "--api-card-accent-bg": "#fffbf0",
  "--api-card-accent-border": "#f3dfab",
  "--api-card-bg": "#fdfcf9",
  "--api-code-bar-bg": "#f4f5f7",
  "--api-code-bg": "#fafbfc",
  "--api-code-border": "#e6e8ec",
  "--api-code-hover": "rgba(15, 23, 42, 0.06)",
  "--api-code-key": "#a15c00",
  "--api-code-keyword": "#c2410c",
  "--api-code-muted": "#6b7280",
  "--api-code-number": "#b35900",
  "--api-code-string": "#0a7a3d",
  "--api-code-text": "#24292f",
  "--api-danger": "#b42318",
  "--api-divider": "#f0ece5",
  "--api-field-accent-bg": "#fff7e3",
  "--api-field-bg": "#fbf9f5",
  "--api-field-divider": "transparent",
  "--api-field-hover-bg": "#f6f2ea",
  "--api-font-family": "'Be Vietnam Pro',Inter,system-ui,-apple-system,'Segoe UI',sans-serif",
  "--api-hover-bg": "#f8f5ef",
  "--api-ink-bg": "#2a2015",
  "--api-ink-divider": "rgba(255, 255, 255, 0.14)",
  "--api-ink-muted": "#d1c4ae",
  "--api-ink-success": "#4ade80",
  "--api-ink-text": "#ffffff",
  "--api-panel-bg": "#ffffff",
  "--api-panel-border": "#ece7de",
  "--api-shell-bg": "#f9f8f5",
  "--api-success": "#15803d",
  "--api-success-soft": "#e7f8ed",
  "--api-text": "#262626",
  "--api-text-muted": "#6b6560",
  "--api-violet": "#c2410c",
  "--api-warning-bg": "#fff7ed",
  "--api-warning-text": "#8a3b0b",
  "--app-page-bg": "#f9f8f5",
  "--bg-color": "#fbf5ef",
  "--bg-color-primary": "rgba(199, 140, 6, 0.1)",
  "--bg-color-secondary": "#f5f5f5",
  "--bg-danger-color": "#ff4d5024",
  "--bg-dark-color": "#121212",
  "--bg-dark-secondary-color": "#222222",
  "--bg-ghost-color": "#0000005e",
  "--bg-success-color": "#52c41a24",
  "--bg-warning-color": "#c4890024",
  "--black-color": "#111111",
  "--blur-l": "blur(10px)",
  "--blur-m": "blur(5px)",
  "--blur-s": "blur(3px)",
  "--border-danger-color": "#ff4d4f40",
  "--border-radius-l": "20px",
  "--border-radius-m": "8px",
  "--border-radius-s": "4px",
  "--border-radius-xl": "40px",
  "--border-radius-xs": "2px",
  "--border-success-color": "#52c41a40",
  "--border-warning-color": "#c4890040",
  "--danger-color": "#ff4d4f",
  "--font-family-primary": "'Be Vietnam Pro',Inter,system-ui,-apple-system,'Segoe UI',sans-serif",
  "--font-l": "1.2rem/1.8rem 'Be Vietnam Pro',Inter,system-ui,-apple-system,'Segoe UI',sans-serif",
  "--font-line-height-l": "1.8rem",
  "--font-line-height-m": "1.6rem",
  "--font-line-height-s": "1.4rem",
  "--font-line-height-xl": "2.4rem",
  "--font-line-height-xs": "1.2rem",
  "--font-line-height-xxl": "2.6rem",
  "--font-line-height-xxxl": "4.1rem",
  "--font-m": "1rem/1.6rem 'Be Vietnam Pro',Inter,system-ui,-apple-system,'Segoe UI',sans-serif",
  "--font-s": "0.8rem/1.4rem 'Be Vietnam Pro',Inter,system-ui,-apple-system,'Segoe UI',sans-serif",
  "--font-size-l": "1.2rem",
  "--font-size-m": "1rem",
  "--font-size-s": "0.8rem",
  "--font-size-xl": "1.8rem",
  "--font-size-xs": "0.6rem",
  "--font-size-xxl": "2rem",
  "--font-size-xxxl": "3.5rem",
  "--font-xl": "1.8rem/2.4rem 'Be Vietnam Pro',Inter,system-ui,-apple-system,'Segoe UI',sans-serif",
  "--font-xs": "0.6rem/1.2rem 'Be Vietnam Pro',Inter,system-ui,-apple-system,'Segoe UI',sans-serif",
  "--font-xxl": "2rem/2.6rem 'Be Vietnam Pro',Inter,system-ui,-apple-system,'Segoe UI',sans-serif",
  "--font-xxxl": "3.5rem/4.1rem 'Be Vietnam Pro',Inter,system-ui,-apple-system,'Segoe UI',sans-serif",
  "--ghost-color": "#ffffff54",
  "--ghost-inverted-color": "#ffffff54",
  "--input-bg-active-color": "#cacaca34",
  "--input-bg-color": "transparent",
  "--input-bg-hover-color": "#cacaca18",
  "--input-border-color": "#e4e4e7",
  "--input-border-focus-color": "#d3d3d3",
  "--input-border-hover-color": "#e4e4e7",
  "--input-disabled-color": "#11111140",
  "--input-placeholder-color": "#a7a7a7",
  "--link-color": "#aa4f0c",
  "--link-hover-color": "#d8630f",
  "--link-visited-color": "#ce5f10",
  "--message-bg-first-color": "#5c43205e",
  "--message-bg-second-color": "#1d285a5e",
  "--nav-bar-height": "58px",
  "--nav-bar-z-index": "10",
  "--navbar-bg-transparent-color": "#ffffff",
  "--navbar-color": "rgba(18, 18, 18, 1)",
  "--note-color": "#11111173",
  "--paper-bg-color": "#faf2eb",
  "--paper-bg-light-color": "#fffaf4",
  "--paper-bg-lightest-color": "#ffffff",
  "--paper-bg-transparent-color": "#fbf5ef42",
  "--paper-border-color": "#e9e5de",
  "--pricing-Badge-bg": "rgb(255, 169, 64)",
  "--pricing-Badge-color": "#fff",
  "--pricing-accent-gradient": "#ffa940",
  "--pricing-badge-shadow": "#ffe58f",
  "--pricing-bg-highlight": "#fffbe6",
  "--pricing-bg-highlight-api": "#fffbe6",
  "--pricing-border": "#f0f0f0",
  "--pricing-btn-default-bg-hover": "#ffffff",
  "--pricing-btn-default-border": "#d9d9d9",
  "--pricing-btn-default-border-hover": "#f5bf2a",
  "--pricing-btn-default-color": "rgba(17, 17, 17, 0.88)",
  "--pricing-btn-default-color-hover": "#f5bf2a",
  "--pricing-btn-primary-color": "#ffffff",
  "--pricing-card-bg": "#fff",
  "--pricing-card-bg-alt": "#fffbe6",
  "--pricing-card-border-hover": "#faad14",
  "--pricing-color": "rgba(17, 17, 17, 0.65)",
  "--pricing-default-text": "#222",
  "--pricing-divider": "#d9d9d9",
  "--pricing-enterprise-bg": "#fffbe6",
  "--pricing-estimate-shadow": "rgba(250, 173, 20, 0.06)",
  "--pricing-highlight": "#ffa940",
  "--pricing-highlight-text": "#d48806",
  "--pricing-secondary-text": "#888",
  "--pricing-section-desc": "#555",
  "--pricing-usable-credits-border": "#b1b0b0",
  "--primary-color": "#e7a103",
  "--primary-color-dark": "#da6900",
  "--recording-bg-color": "#fbf5ef",
  "--search-textarea-z-index": "10",
  "--secondary-color": "#111111",
  "--secondary-inverted-color": "#ffffff",
  "--side-bar-bg-color": "rgba(199, 140, 6, 0.1)",
  "--side-bar-color": "#c4c4c4",
  "--sider-z-index": "100",
  "--skeleton-bg": "linear-gradient(\n\t\t\t90deg,\n\t\t\trgba(0, 0, 0, 0.06) 25%,\n\t\t\trgba(0, 0, 0, 0.15) 37%,\n\t\t\trgba(0, 0, 0, 0.06) 63%\n\t\t)",
  "--source-color": "#1a0dab",
  "--source-hover-color": "#681da8",
  "--source-visited-color": "#2112bd",
  "--spacing-l": "1.6rem",
  "--spacing-m": "1.2rem",
  "--spacing-s": "0.8rem",
  "--spacing-xl": "2.5rem",
  "--spacing-xs": "0.4rem",
  "--spacing-xxl": "3.2rem",
  "--spacing-xxs": "0.1rem",
  "--success-color": "#52c41a",
  "--tertiary-color": "#606060",
  "--tertiary-inverted-color": "#9b9b9b",
  "--text-inverted-color": "#ffffffa6",
  "--timing-l": "0.6s",
  "--timing-m": "0.25s",
  "--timing-s": "0.1s",
  "--timing-xl": "1s",
  "--timing-xs": "0.06s",
  "--timing-xxl": "3s",
  "--translate-color": "#7b7b7b",
  "--warning-color": "#c48900"
}
```

