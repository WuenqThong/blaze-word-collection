import type { Role } from "./types";

export const adminGroups = [
  { label: "Tổng quan", links: [["/demo/admin/dashboard", "Tổng quan"]] },
  { label: "Quản lý game", links: [["/demo/admin/exams", "Đề 10 câu"], ["/demo/admin/questions", "Ngân hàng câu hỏi"], ["/demo/campaigns", "Chiến dịch"]] },
  { label: "Lượt chơi", links: [["/demo/admin/sessions", "Lượt chơi"]] },
  { label: "Dữ liệu & kiểm duyệt", links: [["/demo/admin/review", "Kiểm duyệt"], ["/demo/admin/import", "Nhập dữ liệu"], ["/demo/admin/datasets", "Dataset & bản xuất"]] },
  { label: "Cài đặt", links: [["/demo/admin/settings", "Người dùng & danh mục"], ["/demo/admin/operations", "Vận hành & backup"]] },
];

export function navigationFor(role: Role): string[][] {
  if (role === "admin") return adminGroups.map((g) => [g.links[0][0], g.label]);
  if (role === "reviewer") return [["/demo/admin/review", "Hàng chờ"], ["/demo/admin/review?view=done", "Đã xử lý"]];
  return [["/demo", "Trang chủ"], ["/demo/play", "Chơi game"], ...(role === "contributor" ? [["/demo/history", "Lượt chơi của tôi"]] : [])];
}

// Frontend demo scope only. Real identity and data authorization belong on the API.
export function routeAllowed(role: Role, path: string): boolean {
  if (path === "/demo/internal" || path === "/demo/account") return true;
  if (role === "admin") return true;
  if (role === "reviewer") return path === "/demo/admin/review" || path === "/demo/rights";
  return ["/demo", "/demo/play", "/demo/rights", "/demo/history"].includes(path) || /^\/demo\/game\/[^/]+$/.test(path);
}
