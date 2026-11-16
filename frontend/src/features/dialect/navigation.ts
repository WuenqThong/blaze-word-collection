const routes: [string, string][] = [
  ["/admin/contributions", "Quản lý đóng góp"], ["/admin/disputes", "Xử lý bất đồng"],
  ["/admin/sources", "Nguồn & quyền sử dụng"], ["/admin/datasets", "Bản xuất dữ liệu"],
  ["/admin/participants", "Người tham gia"], ["/contribute", "Góp từ / câu"],
  ["/my/contributions", "Đóng góp của tôi"], ["/review", "Đánh giá độc lập"],
  ["/settings", "Hồ sơ & cài đặt"], ["/legacy/settings", "Hồ sơ thanh toán cũ"],
  ["/legacy/audio", "Gán nhãn âm thanh cũ"], ["/legacy", "Công cụ cũ"],
  ["/admin/review", "Duyệt âm thanh cũ"], ["/admin/withdrawals", "Quản lý rút tiền cũ"],
  ["/admin/flagged", "Chất lượng tài khoản âm thanh"], ["/admin/reports", "Báo cáo âm thanh"],
  ["/projects/new", "Tạo dự án âm thanh"], ["/projects", "Dự án âm thanh"],
  ["/roleplay", "Thu thập hội thoại cũ"], ["/rewards", "Điểm thưởng cũ"],
  ["/history", "Lịch sử âm thanh"], ["/withdrawals", "Rút tiền cũ"],
];
export function pageTitle(path: string) {
  return routes.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))?.[1] ?? "Tổng quan đóng góp";
}
export function roleLabel(role?: string) {
  return ["admin", "reviewer"].includes(role ?? "") ? "Reviewer" : "Người góp";
}
