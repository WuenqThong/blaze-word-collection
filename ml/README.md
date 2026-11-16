# Phòng thử nghiệm ML — Giai đoạn 1

Giai đoạn 2 đã có runner: [hướng dẫn simulator](simulator/README.md). Chạy `.\scripts\run-simulator.ps1` từ root project để tạo lượt kiểm thử độc lập.

Môi trường ML: `E:\blaze-voice-collection\ml\.venv`, tách biệt `backend\.venv`.
Dữ liệu, model, cache, log, DB QA và browser profile: `E:\blaze-voice-lab`, ngoài repository.

Python hiện dùng 3.11.9 có sẵn. Cài Python 3.12 tự động bị bộ kiểm duyệt chặn; không đổi Python backend. Khả năng dùng ML được xác nhận bằng smoke check thay vì giả định phiên bản.

## Mở ứng dụng

Trong PowerShell:

```powershell
Set-Location E:\blaze-voice-collection
.\scripts\start-ml-lab.ps1 -OpenBrowser
```

Nếu cổng 7780/8768 đang chạy, script sẽ từ chối khởi động thêm. Để chỉ mở cửa sổ trình duyệt riêng:

```powershell
.\scripts\open-ml-lab.ps1
```

- App: http://127.0.0.1:7780/demo
- Swagger: http://127.0.0.1:8768/docs
- Tài khoản QA: `E:\blaze-voice-lab\qa\accounts.json` (5 tài khoản giả, mở file local để xem mật khẩu).
- DB: `E:\blaze-voice-lab\qa\qa.db`; không dùng fixture QA làm dữ liệu train thật.
- Profile Edge: `E:\blaze-voice-lab\browser-profile`.

## Dùng Python ML

Không cần activate, luôn gọi đúng interpreter:

```powershell
. .\ml\use-lab.ps1
.\ml\.venv\Scripts\python.exe .\ml\scripts\check_environment.py --require-cuda
.\ml\.venv\Scripts\python.exe -m pip check
```

Smoke check import thư viện, kiểm môi trường độc lập và thực hiện một cập nhật trọng số rất nhỏ trên CPU/GPU. Không tải model ngôn ngữ, không chứng minh chất lượng dịch. Kết quả ở `E:\blaze-voice-lab\runs\environment-check.json`.

## Tái lập dependencies

Tạo venv Python 3.11 riêng rồi cài từ lockfile sau khi có bản nghiệm thu:

```powershell
py -3.11 -m venv ml\.venv
.\ml\.venv\Scripts\python.exe -m pip install -r ml\requirements.lock.txt --extra-index-url https://download.pytorch.org/whl/cu126
```

Nguồn CUDA wheel: [PyTorch chính thức](https://pytorch.org/get-started/previous-versions/).
RTX 3050 Laptop có 4 GB VRAM; chọn model sau phép thử bộ nhớ ở giai đoạn sau. Chưa tải model hoặc khởi chạy training thực tế.
