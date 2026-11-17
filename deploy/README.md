# Bàn giao triển khai cho anh Mạnh

Bộ source có `Dockerfile` multi-stage và `docker-compose.yml`: build React rồi đưa giao diện và FastAPI vào một image, phục vụ cổng 7777. Server cần Docker Engine + Compose v2, Internet để tải image/dependency, tên miền và reverse proxy Nginx có chứng chỉ HTTPS. Các lệnh dưới đây chạy trên Linux từ thư mục giải nén `blaze-word-collection/`.

Gói ZIP là source hiện tại, gồm cả thay đổi chưa commit. Database, secrets, tài khoản QA, môi trường ảo và node_modules không được đóng gói. Máy chuẩn bị gói chưa có Docker; build và nghiệm thu container phải thực hiện trên máy có Docker trước khi mở cho người dùng.

## 1. Cấu hình

```bash
cp .env.pilot.example .env.pilot
chmod 600 .env.pilot
```

Điền `.env.pilot`:

- `BLAZE_RELEASE`: tên phiên bản cố định, ví dụ `pilot-20261117`.
- `BLAZE_JWT_SECRET`: tạo riêng bằng `openssl rand -hex 32`.
- `BLAZE_CORS_ORIGINS`: mảng JSON chứa origin thật, ví dụ `["https://tiengque.example.vn"]`.
- `BLAZE_TRUSTED_PROXY_IPS`: mảng JSON chứa đúng IP proxy mà container nhìn thấy. Nginx trên host đi qua Docker bridge có thể hiện bằng gateway bridge, không phải `127.0.0.1`. Kiểm mạng bằng `docker network inspect blaze-word-collection_default` sau khi tạo container; xác nhận theo cấu hình mạng thực tế. Không dùng `*` hay `0.0.0.0/0`.

Tạo hàm tiện dụng cho phiên shell hiện tại:

```bash
dc() { docker compose --env-file .env.pilot "$@"; }
dc config --quiet
dc build --pull
```

## 2. Database mới và tài khoản quản lý

Chỉ chạy `init` cho lần đầu với volume rỗng:

```bash
dc run --rm app python -m scripts.db_migrate init /data/annotator.db
dc run --rm app python -c 'from getpass import getpass; from scripts.create_admin import main; main(input("Email: "), getpass("Password: "), input("Full name: "))'
dc up -d
dc ps
curl --fail http://127.0.0.1:7777/api/health
```

Tài khoản được tạo là Reviewer có quyền vận hành. Không đặt mật khẩu trực tiếp vào shell history. Catalog game được nạp khi API khởi động. `init` từ chối ghi đè DB đã có.

## 3. HTTPS

Dùng `deploy/blaze.nginx.conf` làm mẫu cho Nginx trên cùng host. Thay domain, đường dẫn chứng chỉ và port nếu đã đổi `BLAZE_PORT`. Chạy `sudo nginx -t` trước khi reload. Compose chỉ mở ứng dụng trên `127.0.0.1`; người dùng truy cập domain HTTPS qua Nginx. Cookie Secure cần HTTPS để đăng nhập hoạt động đúng.

Nếu proxy ở máy/container khác, cần sửa mạng và ingress cho phù hợp; mẫu loopback hiện tại dành cho Nginx trên host. Không mở trực tiếp cổng ứng dụng ra Internet chỉ để thử đăng nhập.

## 4. Backup và mang dữ liệu hiện có lên server

Tạo backup nhất quán, có cả các transaction đã commit trong WAL:

```bash
mkdir -p backups
chmod 700 backups
dc run --rm -v "$PWD/backups:/backups" app python -m scripts.db_backup /data/annotator.db "/backups/annotator-$(date -u +%Y%m%dT%H%M%SZ).db"
```

Lưu thêm bản backup ngoài server theo lịch vận hành. Backup chứa dữ liệu người dùng, cần giới hạn người truy cập.

Nếu cần mang DB từ máy phát triển: tạo snapshot bằng `backend/scripts/db_backup.py` từ môi trường backend, chuyển snapshot qua kênh riêng vào `backups/import.db` trên server. Với DB chưa có Alembic, thực hiện trên volume mới, trước bước `init`:

```bash
dc run --rm -v "$PWD/backups:/backups:ro" app python -m scripts.db_migrate adopt /backups/import.db /data/annotator.db
dc run --rm app python -m scripts.db_migrate upgrade /data/annotator.db
```

`adopt` kiểm schema và chỉ tạo bản sao đích mới. Nếu snapshot đã có Alembic, dùng `scripts.db_restore /backups/import.db /data/annotator.db` thay cho `adopt`, sau đó `upgrade`. Không chạy `init` khi dùng DB nhập. IndexedDB trong trình duyệt không tự chuyển lên server; chỉ dữ liệu đã đồng bộ vào DB mới đi theo snapshot.

Khôi phục backup vào file mới, kiểm tra trước khi thay DB đang phục vụ:

```bash
dc run --rm -v "$PWD/backups:/backups:ro" app python -m scripts.db_restore /backups/import.db /data/restored.db
```

Việc chuyển ứng dụng sang DB đã phục hồi cần cửa sổ bảo trì, dừng ghi và đổi `DATABASE_URL` sang file đã kiểm tra. Không ghi đè file DB đang chạy.

## 5. Cập nhật phiên bản

Giữ tên Compose project `blaze-word-collection` để dùng cùng volume qua các lần giải nén. Backup trước, đổi release tag và build source mới; dừng ghi khi nâng schema:

```bash
dc build --pull
dc stop app
dc run --rm app python -m scripts.db_migrate upgrade /data/annotator.db
dc up -d
dc logs --tail=100 app
```

DB nằm trong named volume, không mất khi rebuild/recreate container. Không dùng `docker compose down -v` hoặc xóa volume chứa dữ liệu thật. Rollback cần image cũ và backup schema tương thích; không giả định image cũ đọc được schema mới.

## 6. Nghiệm thu trước khi public

- `dc ps` báo healthy; `/api/health`, `/demo`, `/login` và route reviewer trả đúng nội dung qua HTTPS.
- Đăng nhập/đăng xuất được; cookie có Secure/HttpOnly; người thường không vào được API quản lý.
- Chơi, gửi đóng góp, reload và đăng nhập thiết bị khác lấy được dữ liệu đã đồng bộ.
- Recreate container vẫn còn dữ liệu. Tạo backup và thử restore vào DB riêng thành công.
- Chạy tải đồng thời trên staging với dữ liệu giả; kiểm lỗi HTTP, độ trễ và khóa SQLite theo lượng người dự kiến.

CI hiện có job build image Docker trong `.github/workflows/ci.yml`. Chưa có kết quả chạy Docker/HTTPS thật được xác minh trong phiên bàn giao này.

Tài liệu nền: [Docker Compose env-file](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/), [Docker volumes](https://docs.docker.com/engine/storage/volumes/).
