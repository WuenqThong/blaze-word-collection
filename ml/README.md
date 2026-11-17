# Công cụ ML và audio

Môi trường ML ở `ml/.venv`, tách biệt `backend/.venv`. Dữ liệu, model, cache và kết quả xử lý nằm ngoài repository tại `E:/blaze-voice-lab`.

Bộ simulator, công cụ kiểm thử môi trường và các script mở ứng dụng QA đã được gỡ theo yêu cầu. Các công cụ xử lý dữ liệu/audio và chẩn đoán STT được giữ lại để sử dụng độc lập.

## Dùng môi trường ML

```powershell
. ./ml/use-lab.ps1
./ml/.venv/Scripts/python.exe -m pip check
```

Tái tạo môi trường bằng Python 3.11 và lockfile:

```powershell
py -3.11 -m venv ml/.venv
./ml/.venv/Scripts/python.exe -m pip install -r ml/requirements.lock.txt --extra-index-url https://download.pytorch.org/whl/cu126
```

## Xử lý dữ liệu và audio

`dataset/` chứa công cụ audit Dataset1, chuẩn hoá, augmentation, nghe duyệt, đóng gói và chạy ASR. Đây là workflow dữ liệu/ML độc lập, không phải bộ kiểm thử của web. Dữ liệu đầu ra cần được review trước khi dùng huấn luyện.

## Chẩn đoán ElevenLabs STT

`scripts/elevenlabs_realtime_stt.py` xử lý microphone hoặc file audio. Cài dependency tuỳ chọn được liệt kê đầu script vào môi trường ML nếu cần.

```powershell
./ml/.venv/Scripts/python.exe ./ml/scripts/elevenlabs_realtime_stt.py --help
./ml/.venv/Scripts/python.exe ./ml/scripts/elevenlabs_realtime_stt.py --source file --file path/to/audio.wav
```

Công cụ kết nối ElevenLabs bằng `ELEVENLABS_API_KEY` trong môi trường hoặc `.env` ở root; chỉ dùng audio được phép gửi lên dịch vụ. `--help` không gửi yêu cầu API.
