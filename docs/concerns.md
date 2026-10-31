# Các mối lo về bảo mật dữ liệu

Ghi chú gốc của team, cần xử lý trước khi mở nền tảng cho annotator bên ngoài. Hiện trạng từng mục xem [ARCHITECTURE.md §6–7](ARCHITECTURE.md#6-bảo-mật).

1. không nên để frontend biết được đâu là golden dataset
2. đảm bảo rằng hacker hoặc người vọc không biết được đang có những project nào.
3. một người vào xem được ng khác label
4. tránh get được all data thông qua skips hoặc gán bừa hoặc dựa trên đúng sai api
