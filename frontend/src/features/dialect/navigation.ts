const routes: [string, string][] = [
  ["/admin/contributions", "Quản lý đóng góp"], ["/admin/disputes", "Xử lý bất đồng"],
  ["/admin/sources", "Nguồn & quyền sử dụng"], ["/admin/datasets", "Bản xuất dữ liệu"],
  ["/admin/participants", "Người tham gia"], ["/contribute", "Góp từ / câu"],
  ["/my/contributions", "Đóng góp của tôi"], ["/review", "Đánh giá độc lập"],
  ["/settings", "Hồ sơ vùng sử dụng"], ["/legacy/settings", "Hồ sơ thanh toán cũ"],
  ["/legacy/audio", "Gán nhãn âm thanh cũ"], ["/legacy", "Công cụ cũ"],
  ["/admin/review", "Duyệt âm thanh cũ"], ["/admin/withdrawals", "Quản lý rút tiền cũ"],
  ["/admin/flagged", "Chất lượng tài khoản audio"], ["/admin/reports", "Báo cáo audio"],
  ["/projects/new", "Tạo dự án audio"], ["/projects", "Dự án audio"],
  ["/roleplay", "Thu thập hội thoại cũ"], ["/rewards", "Điểm thưởng cũ"],
  ["/history", "Lịch sử audio"], ["/withdrawals", "Rút tiền cũ"],
];
export function pageTitle(path: string) {
  return routes.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))?.[1] ?? "Tổng quan đóng góp";
}
export function roleLabel(role?: string) {
  return role === "admin" ? "Điều phối viên" : role === "reviewer" ? "Người đánh giá" : "Người đóng góp";
}
