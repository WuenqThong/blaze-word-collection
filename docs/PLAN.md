> **Lưu ý:** Đây là bản thiết kế ban đầu (roadmap, ý tưởng anti-cheat/payout). Nhiều phần **chưa được hiện thực** hoặc đã làm khác đi (ví dụ dùng SQLite thay MongoDB, presigned URL thay audio proxy). Trạng thái thực tế của code: xem [ARCHITECTURE.md](ARCHITECTURE.md#7-chưa-làm--khác-với-planmd).

# Audio Annotation Platform — Plan

## 1. Tổng quan

Một nền tảng web cho phép **admin** tạo project gán nhãn dữ liệu audio và **annotator** tham gia gán nhãn. Hệ thống được thiết kế mở rộng được cho nhiều loại task khác nhau, ban đầu tập trung vào audio.

### Mục tiêu giai đoạn 1 (khung)
- Authentication & Authorization (RBAC).
- Admin tạo / cấu hình project, định nghĩa loại task, điểm số.
- Annotator tham gia project, nhận task, gán nhãn.
- Lưu trữ audio trên **MinIO**, metadata trên **MongoDB**.
- Phân bổ task đều giữa các annotator (mỗi audio có thể được nhiều người gán).
- Quality control bằng **golden dataset** chèn ngẫu nhiên.
- **Bảo vệ dataset**: chống tải hàng loạt, chống leak, watermark + audit.
- **Chống gán linh tinh**: golden + behavior signals + honeypot + rate limit.

### Loại task (extensible)
1. **Audio → Text Label**: nghe audio, gõ transcript / chọn label.
2. **Audio Verification (true/false)**: nghe audio + label gợi ý → xác nhận đúng/sai.
3. **Q&A**: từ một câu hỏi → annotator trả lời (text / chọn đáp án).
4. *(Sau này)* các loại khác: speaker diarization, segment labeling, emotion, …

---

## 2. Kiến trúc tổng thể

```
┌────────────┐      ┌──────────────────┐      ┌─────────────┐
│  Frontend  │◄────►│   Backend API    │◄────►│   MongoDB   │
│ (Next.js)  │      │  (FastAPI/Node)  │      │ (metadata)  │
└────────────┘      └────────┬─────────┘      └─────────────┘
                             │
                             ▼
                      ┌─────────────┐
                      │    MinIO    │
                      │ (audio blob)│
                      └─────────────┘
```

### Stack đề xuất
| Layer | Công nghệ | Lý do |
|---|---|---|
| Frontend | Next.js + React + TailwindCSS + WaveSurfer.js | SSR, audio waveform tốt |
| Backend | FastAPI (Python) **hoặc** NestJS (Node) | Async, dễ tích hợp ML sau này → ưu tiên FastAPI |
| Auth | JWT (access + refresh) + bcrypt | Standard, stateless |
| Database | MongoDB (Mongoose/Motor) | Schema linh hoạt cho nhiều loại task |
| Object storage | MinIO (S3-compatible) | Self-hosted, presigned URL |
| Queue (optional) | Redis + Celery/BullMQ | Phân bổ task, golden injection |
| Deploy | Docker Compose → K8s | Dev đơn giản, prod scale được |

---

## 3. Domain model (MongoDB)

### `users`
```js
{
  _id, email, passwordHash, fullName,
  role: "admin" | "annotator" | "reviewer",
  createdAt, lastLoginAt,
  stats: { totalAnnotated, totalScore, accuracyOnGolden }
}
```

### `projects`
```js
{
  _id, name, description, ownerId (admin),
  taskTypes: ["audio_label", "audio_verify", "qa"], // các loại được bật
  scoring: {
    audio_label: 10,
    audio_verify: 5,
    qa: 8
  },
  goldenRatio: 0.1,            // 10% task chèn golden
  redundancy: 3,               // mỗi audio cần N annotator gán
  status: "draft" | "active" | "closed",
  members: [{ userId, joinedAt, role }],
  createdAt
}
```

### `audios`
```js
{
  _id, projectId,
  minioKey, durationSec, sampleRate, mime,
  uploadedBy, uploadedAt,
  isGolden: false,
  goldenAnswer: null  // nếu isGolden=true → ground truth
}
```

### `tasks` (đơn vị công việc)
```js
{
  _id, projectId, audioId,
  type: "audio_label" | "audio_verify" | "qa",
  payload: { question?, suggestedLabel?, options? },
  assignedTo: [userId],         // ai đang được phân
  completedBy: [{ userId, annotationId, completedAt }],
  redundancyTarget: 3,
  status: "open" | "in_progress" | "done",
  isGolden: false
}
```

### `annotations`
```js
{
  _id, taskId, userId, projectId,
  type, answer,                 // text | bool | option
  timeSpentMs,
  isGoldenCheck: false,
  goldenCorrect: null,          // true/false nếu là golden
  scoreAwarded: 0,
  createdAt
}
```

### `assignments` (audit phân bổ)
```js
{ _id, taskId, userId, assignedAt, expiresAt, status }
```

---

## 4. Authentication & Authorization

- **Auth**: email + password → JWT (access 15m, refresh 7d). Refresh token rotate, lưu hash trong DB.
- **Roles**:
  - `admin`: tạo/sửa project, upload audio, set scoring, xem report, quản lý user.
  - `annotator`: join project (qua invite code hoặc admin add), nhận task, submit annotation.
  - `reviewer` *(tùy chọn giai đoạn sau)*: review annotation, resolve conflict.
- **Project-level permission**: kiểm tra `project.members` trước mọi action liên quan project.
- Middleware: `requireAuth`, `requireRole(role)`, `requireProjectMember(projectId)`.

---

## 5. Thuật toán phân bổ task (đều + công bằng)

**Yêu cầu**: mỗi audio cần `redundancy = N` lần gán, không cùng 1 annotator gán 1 audio 2 lần, tải đều giữa annotator.

### Chiến lược: Weighted Least-Loaded với khóa
1. Khi annotator request task mới (`GET /projects/:id/next-task`):
2. Lọc task `open` hoặc `in_progress` thuộc project, **chưa được user này gán**, còn slot (`completedBy.length + assignedTo.length < redundancy`).
3. Sort theo:
   - Ưu tiên task đã có người gán dở (gần đủ redundancy) → tăng throughput.
   - Sau đó task có ít assignment hơn.
4. **Lock** task cho user trong X phút (TTL trên `assignments`) → tránh race.
5. Trả về task. Nếu user bỏ qua → expire lock, task quay về pool.

### Cân bằng giữa annotator
- Theo dõi `userStats.activeAssignments`. Khi 2 task ngang nhau, ưu tiên user có ít assignment đang giữ.
- Cron job dọn assignment hết hạn mỗi phút.

### Chèn Golden
- Với xác suất `project.goldenRatio` (vd 10%), trả về một golden task thay vì task thường (chỉ user chưa gán golden đó gần đây).
- Golden task được đánh dấu `isGolden=true` ở phía DB nhưng **ẩn với annotator**.

---

## 6. Quality Control bằng Golden Dataset

### Quy trình
1. Admin chuẩn bị bộ **golden audios** kèm `goldenAnswer` (đã verify).
2. Khi serve task, hệ thống random chèn golden theo `goldenRatio`.
3. Annotator submit → so sánh với `goldenAnswer`:
   - **Audio label (text)**: so sánh fuzzy (Levenshtein / WER < threshold).
   - **Audio verify (bool)**: so sánh trực tiếp.
   - **Q&A**: tùy schema (exact, contains, hoặc multiple choice).
4. Cập nhật `userStats.accuracyOnGolden` (rolling window 50 golden gần nhất).

### Hành động theo accuracy
| Accuracy | Action |
|---|---|
| ≥ 90% | Bình thường, đủ điểm |
| 70–90% | Cảnh báo, tăng tỉ lệ golden injection cho user này |
| < 70% | Tạm khóa khỏi project, gửi notice cho admin review |

### Scoring
- Mỗi annotation đúng → `+ project.scoring[type]`.
- Annotation trên golden sai → `0` điểm + ghi nhận lỗi.
- Báo cáo điểm theo project / global / tháng.

---

## 7. API endpoints (sketch)

### Auth
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`

### Admin – Project
- `POST /projects` — tạo project
- `PATCH /projects/:id` — sửa scoring, redundancy, goldenRatio
- `POST /projects/:id/members` — add annotator
- `POST /projects/:id/audios` — upload audio (multipart → MinIO)
- `POST /projects/:id/audios/:audioId/golden` — đánh dấu golden + answer
- `GET /projects/:id/report` — thống kê tiến độ, accuracy, leaderboard

### Annotator – Workflow
- `GET /projects` — list project tôi tham gia
- `GET /projects/:id/next-task` — lấy task tiếp (kèm presigned audio URL)
- `POST /tasks/:id/annotate` — submit annotation
- `POST /tasks/:id/skip` — bỏ qua, release lock
- `GET /me/stats` — điểm, accuracy

---

## 8. Lưu trữ MinIO

- 1 bucket / project: `project-{projectId}`.
- Key: `audios/{audioId}.{ext}`.
- Upload: backend nhận multipart → stream lên MinIO → ghi metadata Mongo.
- Download cho annotator: **presigned GET URL** (TTL 10 phút), không expose credential.
- Versioning bật để bảo vệ khỏi xóa nhầm.

---

## 9. Frontend – Màn hình chính

| Trang | Vai trò | Mô tả |
|---|---|---|
| Login / Register | all | |
| Admin dashboard | admin | List project, tạo mới, KPI |
| Project detail (admin) | admin | Upload audio, set scoring/goldenRatio, member, report |
| Annotator home | annotator | Project tôi tham gia, điểm, accuracy |
| Annotation workspace | annotator | Player + form theo task type, hotkey, submit/skip |
| Leaderboard | all | Theo project hoặc global |

Annotation workspace cần component theo từng `task.type`:
- `AudioLabelView` (waveform + textarea / dropdown).
- `AudioVerifyView` (audio + suggested label + true/false buttons).
- `QAView` (question + audio optional + answer input/options).

---

## 10. Roadmap

### Sprint 1 — Foundation (1 tuần)
- Repo skeleton (frontend + backend + docker-compose: MongoDB, MinIO).
- Auth (register/login/refresh, JWT, RBAC middleware).
- User CRUD cơ bản.

### Sprint 2 — Project & Storage (1 tuần)
- Project CRUD, member management.
- Upload audio → MinIO, presigned URL.
- Schema audios/tasks.

### Sprint 3 — Annotation core (1.5 tuần)
- Task allocation algorithm + lock TTL.
- Annotation submit cho 3 loại task.
- Frontend workspace 3 view.

### Sprint 4 — Quality & Scoring (1 tuần)

- Golden dataset injection (adaptive ratio).
- Accuracy tracking, scoring engine + tier multiplier.
- Admin report + leaderboard.

### Sprint 5 — Anti-leak & Anti-cheat (1 tuần)

- Audio proxy stream + signed token + watermark.
- Rate limit, session limit, audit log truy cập audio.
- Honeypot tasks, behavior signals, consensus agreement.
- Probation/trial mode cho user mới.

### Sprint 6 — Anti-crawl & Anti-bot (0.5 tuần)

- Browser fingerprint + headless detection.
- CAPTCHA on signup + periodic.
- Encrypted audio chunk + WebAudio decrypt.
- ASN/VPN/Tor blocklist + velocity rules.

### Sprint 7 — Payout & Anti-fraud (1 tuần)

- Wallet + balance + hold period.
- KYC tích hợp (CCCD + selfie + phone OTP).
- Sybil prevention: phone/bank/device dedup.
- Earning cap, payout threshold, dispute ticket.

### Sprint 8 — Polish (0.5 tuần)

- Cron expire assignments + clawback điểm.
- Logging, audit, monitoring (Prometheus/Grafana).
- E2E test golden path + anti-cheat + anti-fraud scenarios.

---

## 11. Bảo vệ dataset – Anti-leak & Anti-bulk-download

Mục tiêu: annotator chỉ thấy đúng mẫu cần gán tại thời điểm đó, không thể tải hàng loạt, mỗi lượt truy cập đều truy vết được.

### 11.1 Tầng truy cập audio

- **Không bao giờ trả raw URL MinIO** ra frontend. Bucket private 100%, không public read.
- Mọi audio đi qua endpoint proxy `GET /audio/stream/:taskId` của backend:
  - Verify JWT + project membership + task **đang được assign cho user này** (lock còn hạn).
  - Trả response **`Content-Disposition: inline`** + `Cache-Control: no-store`.
  - Header `Accept-Ranges: bytes` để hỗ trợ seek waveform, nhưng **giới hạn max range size** (vd ≤ 2MB/chunk).
- **Short-lived signed token per task**: mỗi lần serve task tạo `audioToken` (HMAC, TTL = thời gian lock, gắn `userId + taskId + IP fingerprint`). URL stream chứa token này; hết hạn task → token chết.
- **Không trả `audioId`/`minioKey`** cho client. Frontend chỉ biết `taskId` + opaque `audioToken`.

### 11.2 Chống tải hàng loạt (bulk download)

- **Rate limit** ở 3 mức:
  - Per user: ≤ X task/giờ, ≤ Y stream request/phút (Redis token bucket).
  - Per IP: phát hiện nhiều account cùng IP cày song song → flag.
  - Per project: trần task/ngày/user theo cấu hình admin.
- **Sequential serving**: chỉ trả task tiếp theo khi task hiện tại đã submit hoặc skip → không thể "list" nhiều task cùng lúc.
- **No list endpoint cho audio**: annotator **không** có endpoint kiểu `GET /audios?projectId=…`. Chỉ có `GET /next-task`.
- **Concurrent session limit**: 1 user = tối đa 1 active session/device (track refresh token + device fingerprint). Login mới → kick session cũ.
- **Anomaly detection**:
  - Stream request không kèm submit annotation (tỉ lệ stream/submit cao bất thường) → cảnh báo.
  - Tốc độ chuyển task quá nhanh (< minTimeOnTask) → khóa.

### 11.3 Watermark & Audit

- **Audio watermark mềm**: chèn tone tần số cao (≥ 18kHz, ngoài ngưỡng nghe thường) mã hóa `userId + timestamp` vào mỗi lần stream → nếu file rò ra ngoài có thể truy ngược.
  - Inject realtime trên backend trước khi stream (FFmpeg filter, cache ngắn).
- **Visual watermark trên UI**: overlay mờ `userId + email + timestamp` lên player, ảnh chụp màn hình vẫn truy được người làm rò.
- **Audit log mọi truy cập audio**: `{userId, taskId, audioId, ip, ua, ts, bytesServed}` → collection `audio_access_logs`, retention ≥ 90 ngày.
- **Disable download trên UI**: HTML5 player `controlsList="nodownload"`, chặn right-click, chặn `MediaRecorder` API ở mức best-effort (không tuyệt đối nhưng tăng ma sát).

### 11.4 Chống tái phân phối metadata

- **Không trả `goldenAnswer`, `suggestedLabel ground truth`** ra frontend kể cả admin (admin có endpoint riêng).
- Pagination + cursor cho mọi list: không cho `limit` lớn vô hạn.
- Export dataset chỉ `admin` qua endpoint riêng có 2FA + audit log + chỉ chạy trong giờ hành chính.

### 11.5 Hợp đồng & răn đe

- NDA bắt buộc khi onboarding annotator (lưu trạng thái ký trong `users`).
- Banner "Đây là dữ liệu bí mật, mọi truy cập đều được ghi nhận" trên workspace.

---

## 12. Chống gán linh tinh (Annotator Quality Enforcement)

Kết hợp **nhiều tín hiệu** thay vì chỉ dựa vào golden, vì golden chiếm tỉ lệ nhỏ và có thể bị học thuộc.

### 12.1 Golden injection nâng cấp

- **Adaptive ratio**: user mới → 30% golden trong 50 task đầu (probation), giảm dần về 10% nếu accuracy ≥ 90%.
- **Golden xoay vòng**: pool golden lớn, không lặp lại trong N ngày cho cùng 1 user → tránh học vẹt.
- **Failure cascade**:
  - Sai 3 golden liên tiếp → khóa project tạm thời, gửi cảnh báo.
  - Accuracy < 70% trên rolling 50 → revoke + clear annotation gần nhất chờ review.

### 12.2 Behavior signals

Lưu trong mỗi `annotation`:

- `timeSpentMs`: thời gian từ load task đến submit.
- `audioPlayCount`, `audioListenedSec`: track qua sự kiện player.
- `keystrokeCount`, `mouseMoveCount` *(tùy chọn, opt-in)*.
- `focusLostCount`: số lần tab mất focus.

**Quy tắc reject hard**:

- `timeSpentMs < audioDurationSec * 0.5 * 1000` → annotator chưa nghe đủ → block submit.
- `audioListenedSec < 50%` audio length → cảnh báo, vẫn cho submit nhưng đánh dấu `lowEngagement=true` để review.
- Submit < 2 giây sau khi load → reject.

**Quy tắc soft (tăng trọng số golden)**:

- Cùng 1 đáp án copy-paste cho > 5 task liên tiếp ở task-type text.
- Click verify true/false xen kẽ đều đặn (pattern bot).

### 12.3 Honeypot tasks (bẫy)

Khác golden ở chỗ **không có ground truth tuyệt đối** mà là task được thiết kế để **bắt hành vi cụ thể**:

- **Audio im lặng/nhiễu trắng** với câu hỏi "có giọng nói không?" → đáp án rõ ràng là không. Annotator bấm "có" = bị bắt.
- **Audio rất rõ với câu verify sai hiển nhiên** → ai chọn "đúng" = không nghe.
- Honeypot đan xen ngẫu nhiên ~3–5%, ẩn danh hoàn toàn.

### 12.4 Inter-annotator agreement (consensus)

Vì mỗi audio gán bởi `redundancy = N` annotator:

- Sau khi đủ N annotation, tính **agreement score**:
  - Audio verify (bool): majority vote, đo độ lệch của user với majority.
  - Audio label (text): WER với median answer / fuzzy cluster.
  - Q&A: tương tự.
- User lệch khỏi consensus quá thường xuyên (> 30%) → flag review thủ công.
- Cohen/Fleiss kappa per user theo project → đưa vào dashboard admin.

### 12.5 Probation & onboarding

- **Trial mode** cho user mới: 20 task đầu là golden + honeypot 100%, không tính điểm thật, chỉ để qualify.
- Đạt accuracy ≥ 85% mới được "promote" làm task thật.
- Có **bài training** ngắn (5 task mẫu có giải thích) trước khi vào project.

### 12.6 UI/UX chống gán ẩu

- Disable nút Submit cho đến khi: audio đã play đủ ngưỡng AND `timeSpentMs ≥ minTime`.
- Bắt buộc confirm dialog với task-type verify khi user chọn ngược majority hint (nếu có).
- Không cho submit task tiếp khi task hiện tại bị flag chờ review.

### 12.7 Chế tài

- 3 lần warning → tạm khóa 7 ngày, annotation bị reset về pool.
- Nếu phát hiện gian lận có chủ đích (qua honeypot + consensus) → revoke vĩnh viễn, không tính điểm + audit lưu hồ sơ.
- Điểm thưởng có **delay 7 ngày** trước khi cộng vào balance: đủ thời gian phát hiện sai và clawback.

---

## 13. Phân bổ task nâng cao (mở rộng §5 cho nền tảng có payout)

Khi điểm = tiền, annotator sẽ tìm cách **cherry-pick task dễ** hoặc **cày task có lương cao**. Phân bổ phải chống được điều đó.

### 13.1 Phân tầng độ khó audio

- Mỗi audio được scoring `difficulty ∈ [1..5]` lúc ingest:
  - `durationSec`, `SNR` (signal-to-noise), `model_confidence` của ASR baseline.
  - Audio quá dễ (SNR cao, ngắn) = 1; audio nhiễu, dài, đa giọng = 5.
- Annotator chia tier theo accuracy + tenure: `bronze → silver → gold → platinum`.
- **Routing**: bronze chỉ nhận difficulty 1–2; silver 1–3; gold 1–4; platinum tất cả. Nâng tier qua đủ điều kiện tự động.

### 13.2 Anti-cherry-pick

- **Không cho preview**: response `next-task` chỉ trả opaque `taskId` + `audioToken`. Annotator **không biết loại task / độ dài / khó dễ** trước khi accept.
- **Skip có chi phí**:
  - Skip > 3 lần liên tiếp → cooldown 5 phút.
  - Skip > 20%/ngày → giảm tier 1 bậc tạm thời.
  - Skip task khó nhiều bất thường → flag.
- **Server chọn task, không client**: client không gửi filter; chỉ `POST /next-task` rỗng.

### 13.3 Anti-collusion (chống thông đồng)

- 2 user cùng cluster (IP /24, device fingerprint gần, đăng nhập cùng wifi) **không** được nhận cùng audio để gán → tránh thông đồng đáp án.
- Trộn task pool ngẫu nhiên (epsilon-greedy) sau khi sort least-loaded → không đoán được thứ tự.

### 13.4 Mystery shopper

- Định kỳ chọn ngẫu nhiên annotation đã hoàn tất → giao lại cho 1 platinum user (ẩn danh, không biết là review) đánh giá.
- User platinum nhận điểm review, kết quả dùng để hiệu chỉnh score user gốc.

### 13.5 Backpressure

- Khi project sắp hết task: tăng redundancy còn thiếu lên trước, không trả task `done`.
- Khi user mới vào project có nhiều veteran: ưu tiên route các task dễ chưa ai chạm để onboarding mượt.

---

## 14. Scoring nâng cao (mở rộng §6 cho payout)

### 14.1 Công thức điểm

```text
finalScore = base[type]
           × tierMultiplier        // bronze 0.8 / silver 1.0 / gold 1.2 / platinum 1.4
           × accuracyMultiplier    // theo bảng dưới
           × difficultyMultiplier  // 1.0 → 2.0 theo difficulty 1→5
           × qualityFactor         // 0..1, giảm nếu lowEngagement / behavior xấu
```

### 14.2 Accuracy multiplier (rolling 50 golden)

| Accuracy | Multiplier |
| --- | --- |
| ≥ 95% | 1.2x |
| 85–95% | 1.0x |
| 70–85% | 0.7x |
| < 70% | 0 (tạm khóa) |

### 14.3 Clawback & phạt

- Annotation lệch consensus sau khi đủ redundancy → thu hồi điểm đã cấp.
- Phát hiện gian lận trên golden/honeypot → trừ **1.5×** điểm gian lận để răn đe.
- Điểm âm vượt ngưỡng → khóa account + escalate ops.

### 14.4 Hold period

- Điểm vào `pending` → sau **7 ngày** mới chuyển `confirmed` và đếm vào balance rút tiền.
- Trong 7 ngày đó, golden/consensus có thể clawback mà không ảnh hưởng tiền đã rút.

### 14.5 Bonus

- Streak liên tục N ngày: bonus 5–10%.
- Top 10% accuracy tuần → bonus pool.
- Quality bonus cuối tháng: top platinum theo kappa.

---

## 15. Anti-crawl & Anti-bot (chống đội dev khác cào dữ liệu)

Đây là tầng phòng thủ giả định **đối thủ là developer chuyên nghiệp** đăng ký account thật để cào dữ liệu, không phải user vô tình.

### 15.1 Đăng ký & xác thực mạnh

- **Phone OTP + email OTP** bắt buộc khi signup.
- **CAPTCHA** trên signup + login (hCaptcha/Cloudflare Turnstile, không reCAPTCHA v2 vì dễ qua bằng dịch vụ giải).
- **Velocity rule**: cùng /24 subnet > 5 signup/giờ → CAPTCHA hard + manual review.
- **Email blocklist**: chặn disposable email (mailinator, tempmail, …).
- **ASN blocklist**: signup từ IP datacenter (AWS, GCP, Azure, OVH, Hetzner, Linode) → reject hoặc captcha hard.
- **Tor + known VPN exit**: block bằng IP intel feed (IPQS, MaxMind).

### 15.2 Browser & device fingerprint

- Tích hợp **FingerprintJS Pro** hoặc tự xây từ canvas + WebGL + audioContext + font + timezone + WebRTC.
- Lưu `deviceId` cho mỗi session, gắn với user; conflict (1 user nhiều device lạ trong 1 ngày, hoặc 1 device dùng nhiều user) → flag.
- **Headless detection**: kiểm `navigator.webdriver`, phantom plugin list, missing media devices, `Notification.permission` bất thường, runtime check Puppeteer/Playwright.
- **Behavior biometric**: cadence gõ phím, đường di chuyển chuột, độ jitter — bot thường quá đều.

### 15.3 Audio anti-scraping

- **Encrypted chunk delivery**: backend chia audio thành chunks AES-CTR, key dẫn xuất từ `audioToken + sessionKey`. Frontend decrypt bằng WebCrypto + WebAudio (`AudioBufferSourceNode`), **không bao giờ ghép thành blob URL**. Crawler đơn giản dùng `requests`/`curl` không decrypt được.
- **Range chunk hóa**: file gốc không serve nguyên; mỗi `Range request` chỉ trả 1 chunk hợp lệ trong sequence; nhảy chunk ngẫu nhiên → bị block.
- **Mỗi audio token chỉ stream được tổng cộng 1.2× duration**: ngăn re-download nhiều lần.

### 15.4 Honeytoken & honeypot account

- Tạo các **task bẫy nội bộ** với audio đặc biệt mà không annotator thật nào nhận được. Nếu xuất hiện trên dataset cào ngoài → biết bị leak từ user nào (qua watermark).
- **Account bẫy**: ops tạo account giả, không dùng. Nếu account đó có hoạt động → có người đang scrape qua brute force credential.

### 15.5 Server-side intelligence

- **Behavior fingerprint per session**: tỉ lệ stream/submit, tốc độ submit, accuracy → vector đặc trưng. Cluster outlier → review.
- **Replay detection**: nếu thấy cùng `audioToken` được request từ 2 IP khác nhau → revoke ngay lập tức (token bind IP).
- **Web Application Firewall** (Cloudflare/Anubis): chặn pattern crawler, rate limit lớp ngoài.

### 15.6 Đánh đổi UX

- Mỗi tầng phòng thủ thêm ma sát cho user thật. Đề xuất: **bật theo điều kiện**:
  - Default: phone OTP + fingerprint + rate limit.
  - Bật encrypted chunk + headless detection chỉ cho **project nhạy cảm** hoặc khi phát hiện attack.

---

## 16. Quy đổi điểm → tiền & Anti-fraud payout

### 16.1 Wallet model

- Mỗi user có 3 trạng thái balance:
  - `pending` — vừa được cộng, đang trong hold period 7 ngày.
  - `confirmed` — đã qua hold, có thể rút.
  - `paid` — đã được thanh toán.
- 1 điểm = X VNĐ (admin cấu hình theo project hoặc toàn cục).
- Ngưỡng rút tối thiểu (vd 100 000đ) → giảm chi phí giao dịch + filter bot nhỏ.

### 16.2 KYC bắt buộc trước payout đầu

- Upload CCCD (face + back) + selfie liveness check (tích hợp VNPT eKYC / FPT.AI / Trusting Social).
- Số điện thoại đã verify OTP.
- Tài khoản ngân hàng/ví điện tử đứng tên trùng CCCD.
- KYC fail → không rút được, score vẫn cộng nhưng không chuyển sang `confirmed`.

### 16.3 Sybil prevention (1 người 1 account)

- **Unique check** ở 4 chiều khi KYC:
  - CCCD number → unique trong DB.
  - Số điện thoại → unique.
  - Số tài khoản ngân hàng → unique.
  - Device cluster → cảnh báo nếu 1 device từng đăng ký nhiều CCCD.
- Selfie matching cross-check với DB (face embedding) → phát hiện 1 người dùng nhiều CCCD.

### 16.4 Earning cap

- Trần điểm/ngày, /tuần, /tháng theo tier. Bot farm dù có bypass anti-cheat cũng không thể bùng phát.
- Audit nếu user chạm trần ≥ 5 ngày liên tiếp → ops review.

### 16.5 Payout flow

```text
Annotation submit
  → score pending
  → +7 ngày + clawback check + consensus check
  → score confirmed
  → user request withdraw (≥ ngưỡng)
  → ops auto-review (rule engine: KYC ok? earning vs accuracy ratio? device sane?)
  → bank transfer / e-wallet (Vietcombank/Momo/ZaloPay API)
  → trạng thái paid + receipt
```

### 16.6 Dispute & appeal

- Annotator có thể mở **ticket** khiếu nại khi annotation bị reject hoặc clawback.
- SLA xử lý 72h, ops có quyền xem audit log, golden trace, behavior signals.
- Appeal thắng → restore điểm + bonus công khai (xây niềm tin).

### 16.7 Rủi ro tài chính

- **Reserve fund**: giữ % doanh thu để cover clawback chậm.
- **Anti money-laundering**: log mọi giao dịch ≥ ngưỡng (vd 20tr/lần hoặc 50tr/tháng) theo quy định pháp luật VN.
- **Tax**: cuối năm xuất chứng từ chi trả thu nhập cá nhân theo mã số thuế (sau giai đoạn 1).

### 16.8 Báo cáo cho ops

- Dashboard real-time: signup/h, payout/ngày, accuracy trung bình, top earner, anomaly list.
- Alerting (Slack/Telegram): KYC fail nhiều, payout reject, tỉ lệ clawback tăng đột biến, signup velocity cao.

---

## 17. Bài học từ Label Studio & các nền tảng tương tự

Tham khảo Label Studio (HumanSignal), Prodigy, Labelbox, Scale Rapid, SuperAnnotate, SageMaker Ground Truth, Argilla. Các mục dưới đây **không** trùng với phần đã có ở trên — đây là khoảng trống cần lấp.

### 17.1 Audio annotation – tính năng cần có sớm

- **Labeling-config schema (XML/JSON)**: định nghĩa UI task qua config thay vì hardcode React. Admin thêm task type mới (emotion, intent, speaker_id) **không cần redeploy**.
- **Spectrogram view** (mel-band, dB, color scheme) song song waveform — bắt buộc cho task nhiễu/đa giọng.
- **Region-based segment labeling**: drag start/end trên waveform với độ phân giải ms, multi-label/region, cho phép overlap (diarization). Hiện tại task của ta mới whole-clip.
- **Multi-channel rendering** (L/R, mic-array trên track riêng) — call-center stereo = 2 speaker tách kênh.
- **Variable playback speed (0.5x–2x) + A-B loop**: annotator nghe lặp 2 giây khó 10 lần, tốc độ chậm cắt 50% thời gian xử lý clip nhiễu.
- **Zoom waveform 1x–1500x** + scroll-locked seek cho boundary editing chính xác ms.
- **Hotkey toàn cục + hotkey theo region, user-customizable** (rebind trong Account settings) — power annotator gấp 3× throughput.
- **Pre-annotation pipeline**: chạy Silero VAD / WhisperX / pyannote server-side lúc ingest, ship pre-segmented region; annotator chỉ chỉnh boundary → 5–10× nhanh hơn blank canvas. Confidence score của model dùng làm difficulty input cho §13.1.
- **Synced transcript view**: highlight word theo cursor audio (WhisperX word-timestamp) cho task transcript-correction.
- **Force-alignment task type**: cho audio + text, annotator chỉ chỉnh boundary — rẻ hơn full transcription.

### 17.2 Security / access control gaps

- **Workspace tầng trên project**: Org → Workspace → Project, membership ở cấp workspace — onboard customer org có nhiều team nội bộ mà không share toàn bộ project.
- **SSO/SAML + OIDC + LDAP group→role mapping**: enterprise customer sẽ yêu cầu. Ngay từ đầu để seam `auth_provider: "saml" | "oidc" | "local"`, kể cả khi MVP chỉ ship JWT.
- **Audit log riêng (admin actions)**: tách khỏi `audio_access_logs`, ghi: thêm member, đổi scoring, toggle golden, export dataset. Bắt buộc cho SOC2-adjacent customer.
- **Per-project data isolation ở API layer**: middleware row-level scoping → bug không bao giờ vô tình leak cross-project.
- **2FA cho admin + reviewer (TOTP)**: admin có quyền export dataset full (§11.4) — phải MFA, không chỉ KYC annotator.

### 17.3 Crowd-payout learnings

- **Qualification test ngoài project** (Scale/Toloka model): pass test một lần để unlock platform, sạch hơn trộn trial vào project thật.
- **Earnings transparency page cho annotator**: pending vs confirmed vs paid theo từng task + rate — giảm support ticket, xây niềm tin trên platform payout.
- **Referral chỉ tính khi referee đạt N task qua consensus** (không phải chỉ signup) — chống referral-farm sybil ring.

### 17.4 Ưu tiên cập nhật vào MVP

| Hạng mục | Sprint chèn | Lý do |
| --- | --- | --- |
| Labeling-config schema | Sprint 2 | Tránh hardcode 3 view, mở rộng task type không redeploy |
| Region-based + spectrogram + hotkey | Sprint 3 | Quyết định $/giờ annotator → ảnh hưởng unit economics |
| Pre-annotation (VAD/WhisperX) | Sprint 4 | 5–10× throughput + nguồn difficulty score |
| Workspaces + SSO + audit log | Sprint 7 | Bán enterprise sau payout |

> *QC bổ sung (reviewer multi-stage, versioning, comment, calibration) và Operations (batch, export RTTM/ELAN, webhooks, SDK, skill tags, ETA dashboard) tạm hoãn — chưa cần cho MVP, sẽ bổ sung khi cần.*

---

## 18. Rủi ro & lưu ý

- **Race condition phân bổ**: dùng MongoDB `findOneAndUpdate` atomic để claim task, hoặc Redis lock.
- **Audio lớn**: streaming + presigned URL, không proxy qua backend.
- **Golden bị rò**: không bao giờ trả flag `isGolden` về frontend; response giống task thường.
- **Annotator gian lận** (gán nhanh, random): kết hợp golden + thời gian submit tối thiểu + agreement giữa các annotator.
- **Mở rộng task type**: đặt `payload` dạng JSON tự do + validator theo `type` để tránh phải migrate schema.
- **Cân bằng UX vs Security**: encrypted chunk + fingerprint làm chậm load — bật có điều kiện cho project nhạy cảm.
- **Pháp lý payout**: AML, thuế TNCN, hợp đồng cộng tác viên — cần rà soát cùng team pháp chế trước khi launch.
- **Cold start**: chưa có user platinum để mystery-shop → bootstrap bằng nhân sự nội bộ giai đoạn đầu.

---

## 19. Mở rộng tương lai

- Active learning: ưu tiên audio mô hình AI không chắc chắn (đã hoist 1 phần lên §17.1).
- Mobile app cho annotator (giảm phụ thuộc browser fingerprint, tăng kiểm soát).
- Marketplace cho khách self-service tạo project + thanh toán trả trước.
- Multi-modal mở rộng: image, video, text — dùng lại labeling-config schema.
- ML-assisted QA: model dự đoán annotation → so với annotator để chấm điểm runtime.
