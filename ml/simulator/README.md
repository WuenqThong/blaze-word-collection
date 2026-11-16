# Simulator Giai đoạn 2

Chạy một lệnh PowerShell, mỗi lượt có database mới và giữ lịch sử. Bộ gốc có 30 mẫu giả, 32 mẫu bổ sung kiểm nhóm độc lập và 6 mẫu kiểm chứng cuối: tổng 68 đầu vào giả (chưa tính các lần gửi lại có chủ đích).

## Chạy

```powershell
Set-Location E:\blaze-voice-collection
.\scripts\run-simulator.ps1
```

Có thể ghi seed rõ: `.\scripts\run-simulator.ps1 -Seed 42`.
Không cần mở app QA, chạy Vite, bật MinIO, cài thêm thư viện hoặc tải model.
Runner dùng Python **backend** vì cần chạy API app thật; không trộn thêm thư viện vào môi trường ML.

Mỗi lượt tạo thư mục mới dưới `E:\blaze-voice-lab\simulator\run-...`:

- `report.md`: bảng kết quả để đọc.
- `report.json`: expected/actual của từng API và assertion, PASS/FAIL, giới hạn.
- `worker.log`: log API và lỗi khởi tạo.
- `simulator.db`: database riêng, được giữ lại.
- `fixtures.json`: bản chụp 30 mẫu, checksum được kiểm trước khi dùng.
- `run.json`: seed, hash mã nguồn/backend và phiên bản thư viện để truy nguyên.
- `accounts.json`: 5 tài khoản gốc với mật khẩu ngẫu nhiên, chỉ ở ngoài Git. Bộ mở rộng đăng ký thêm 20 tài khoản contributor qua API; chúng chỉ dùng trong phiên worker.
- `extended_fixtures.json`, `extended-samples.json`: cấu hình và đầu vào thực tế của 32 mẫu bổ sung.
- `split-audit.json`: số nhóm, số mẫu mỗi split và kết quả kiểm rò rỉ.
- `source-snapshot.zip`: bản chụp mã app/runner và cấu hình được kiểm; không chứa `.env`, tài khoản hay database người dùng. Worker kiểm hash source trước/sau run, thay đổi source giữa lượt khiến nghiệm thu thất bại.
- `mock-jobs/`: trạng thái và lỗi giả lập job.

Lệnh thành công trả exit code 0; có kịch bản sai hoặc worker lỗi trả mã khác 0. Đọc báo cáo và log ở đường dẫn được in ra. Các lượt thất bại được giữ nguyên; chạy lại tạo lượt mới.

## Nội dung được kiểm

30 fixture bao phủ 12 nhóm: hợp lệ, thiếu phiếu, tự duyệt/tự chuẩn hóa, thiếu consent train, thiếu quyền nguồn, bất đồng, retry, rút consent, rút mẫu, thiếu CURATED, nhóm nguồn/biến thể và HOLD chất lượng.

39 kịch bản gọi API thật bằng ASGI TestClient, dùng cookie đăng nhập và database thật. Cùng 2 mock fault, tổng cộng 41 kịch bản. Không override auth/database. Admin ban đầu được bootstrap chỉ trong DB mới, sau đó API admin cấp reviewer và vùng chuyên môn. Không gửi request vào các server QA đang chạy.

Hai mẫu bất đồng kiểm trọn vòng: thiếu quyền phân xử bị chặn, thiếu lý do bị chặn, admin độc lập ra quyết định có lưu lịch sử và giữ hai phiếu. Mẫu được VERIFIED phải đủ quyền nguồn/CURATED rồi mới xuất; mẫu bị REJECT không được chuẩn hóa/xuất. Không được phân xử lại mẫu đã kết thúc.

Kiểm chứng cuối bổ sung admin là tác giả/người bỏ phiếu, quyết định HOLD và chặn tái dùng phiếu; thu hồi quyền nguồn, đổi CURATED và hỏng checksum; gửi lại đồng thời, nội dung cạnh tranh cùng key và hai reviewer bỏ phiếu đồng thời. Thay checksum chỉ được thực hiện có chủ đích trong DB simulator để kiểm phát hiện hỏng dữ liệu.

Hai kịch bản bổ sung là **mock**: lỗi training và CUDA OOM. Chúng chỉ chứng minh harness giả lập giữ trạng thái failed, log lỗi và không tạo model thành công. Chưa kiểm worker training thật hoặc GPU OOM thật.

“Mất mạng” được kiểm bằng trường hợp server đã lưu, client coi như mất phản hồi rồi gửi lại cùng idempotency key. Chưa kiểm mạng thật/browser offline/outbox.

Bộ gốc có 2 người góp chính và dữ liệu liên thông, dùng để kiểm cảnh báo train-only. Bộ mở rộng thêm 12 người góp độc lập, mỗi người hai mẫu; mỗi quan hệ source/variant/family/sense có một cặp riêng với hai người góp mới. Runner kiểm đủ train/dev/test trên toàn bộ eligible dataset, 16 nhóm mở rộng tách nhau và tách khỏi bộ gốc, cùng người góp/nguồn/văn bản không rò sang split khác. Kiểm cả xuất lại với thứ tự ID ngược và xuất subset giữ nguyên split toàn cục. Nguồn “giống nhau” là provenance chung, dù source ID có thể khác nhau. Đây vẫn là dữ liệu giả, không phải benchmark ngôn ngữ.

## Chạy lại, seed và reset

Không có lệnh xóa/reset dữ liệu. **Database mới mỗi lượt** là cách bắt đầu sạch đã được người dùng chọn. Runner từ chối dùng lại DB và không nhận tham số trỏ sang QA/DB khác. Profile trình duyệt và QA hiện có không thuộc runner.

30 mẫu gốc cố định; 32 mẫu mở rộng sinh xác định từ cấu hình có checksum. Seed cố định idempotency key và random của worker; nội dung/thứ tự kịch bản được giữ cố định để tái lập. Tên thư mục, mật khẩu, thời gian và request ID thay đổi mỗi lượt. So sánh checksum fixture và kết quả/assertion, không so sánh byte toàn bộ DB/log.

Mọi mẫu đều nằm trong gói `synthetic=true` với cảnh báo không dùng train. Schema API hiện tại không nhận trường synthetic riêng; runner giữ marker trong manifest/fixture và source evidence. Release trong DB này chỉ là sản phẩm kiểm phần mềm, không đưa sang dataset training thật.

## Kiểm tra bảo vệ và báo lỗi

```powershell
.\backend\.venv\Scripts\python.exe .\ml\simulator\test_isolation.py
```

Kiểm từ chối đường dẫn ngoài root, sai environment/seed, dùng lại DB, sửa fixture và phát hiện assertion sai. Test “intentional_failure” chủ động tạo kết quả FAIL trong thư mục tạm để kiểm báo lỗi; bản thân unittest đó phải đạt.

Kết quả simulator là kiểm phần mềm, không phải chất lượng phương ngữ, dịch hay ASR. Giai đoạn 3 mới xử lý dataset thật có quyền và nhãn đã được duyệt.

## Cổng nghiệm thu trước khi chuyển phase

```powershell
.\scripts\verify-phase2.ps1
```

Lệnh chạy toàn bộ backend unittest bằng DB test, kiểm bảo vệ runner, rồi ba lượt simulator với seed 42/42/7. So sánh expected/actual của hai lượt cùng seed, kiểm không thay đổi source, đối chiếu hash các DB QA/backend có sẵn. Lưu `acceptance.json` cùng log trong `E:\blaze-voice-lab\simulator\phase2-audit-...`; chỉ trả mã 0 khi toàn bộ đạt. Cần chạy riêng, không chạy thêm simulator hoặc sửa source trong lúc nghiệm thu.

Runner ghi JSON bằng thao tác thay thế file; kiểm đủ ID/thứ tự các kịch bản trước khi báo PASS. Worker timeout, thiếu/hỏng báo cáo, thiếu kịch bản hoặc bước lỗi bị gắn PASS đều khiến cổng trả FAILED với báo cáo Markdown đồng nhất. Các kiểm tra worker lỗi ở đây là kiểm logic xử lý lỗi, chưa phải diễn tập mất điện hệ điều hành.

Phạm vi cổng: API và pipeline dữ liệu văn bản của simulator. Browser offline/outbox, tải production, audio và worker training thật có tiêu chí riêng ở giai đoạn tích hợp tương ứng.
