# Frontend — Blaze Word Collection

React 19, TypeScript và Vite. Chạy toàn ứng dụng theo [README gốc](../README.md); Vite riêng dùng cổng 7777 và proxy `/api` tới backend 8765.

```bash
npm ci
npm run dev
npm run lint -- --max-warnings 0
npm run build
```

Cấu hình theo `.env.example`, giữ `VITE_API_BASE_URL=/api`. `VITE_DEMO_SERVER=off` là chế độ trình duyệt độc lập, không dùng để xác nhận dữ liệu đã lưu lên server.

`src/features/demo/` chứa pilot; `src/features/dialect/` chứa thành phần phương ngữ; `src/api/`, `components/`, `lib/`, `styles/` dùng chung. Tài nguyên tĩnh ở `public/`. Bộ test và dependency kiểm thử đã được gỡ theo yêu cầu. Source legacy còn giữ cho tương thích; route tắt mặc định.

Xem [kiến trúc](../docs/ARCHITECTURE.md) và [hướng dẫn phát triển](../docs/DEVELOPMENT.md).
