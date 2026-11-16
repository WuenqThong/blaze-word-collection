import type { Role } from "./types";

interface AdminGroup { label: string; links: [string, string][]; more: [string, string][] }
export const adminGroups: AdminGroup[] = [
  { label: "Duyệt", links: [["/demo/reviewer/review", "Duyệt"]], more: [] },
  { label: "Dữ liệu", links: [["/demo/reviewer/datasets", "Xuất"], ["/demo/reviewer/import", "Nhập"], ["/demo/reviewer/settings?section=sources", "Nguồn"]], more: [] },
  { label: "Cài đặt", links: [["/demo/reviewer/settings", "Người dùng"], ["/demo/reviewer/exams", "Bộ đề"]], more: [["/demo/reviewer/questions", "Câu hỏi"], ["/demo/reviewer/sessions", "Lượt chơi"], ["/demo/campaigns", "Chiến dịch"], ["/demo/reviewer/operations", "Số liệu"]] },
];

export function adminGroupFor(path: string, search = "") {
  return adminGroups.find(g => [...g.links, ...g.more].some(([to]) => to.includes("?") && path + search === to)) ?? adminGroups.find(g => [...g.links, ...g.more].some(([to]) => path === to || path.startsWith(to + "/")));
}

export function workspacePath(path: string) {
  return path.replace(/^\/demo\/admin\//, "/demo/reviewer/").replace(/^\/demo\/reviewer\/dashboard$/, "/demo/reviewer/review");
}

export function navigationFor(role: Role): string[][] {
  if (["admin", "reviewer"].includes(role)) return adminGroups.map((g) => [g.links[0][0], g.label]);
  return [["/demo", "Trang chủ"], ["/demo/play", "Chơi trò chơi"], ...(role === "contributor" ? [["/demo/contribute", "Góp trực tiếp"], ["/demo/history", "Lượt chơi của tôi"]] : [])];
}

// Frontend demo scope only. Real identity and data authorization belong on the API.
export function routeAllowed(role: Role, path: string): boolean {
  if (path === "/demo/internal" || path === "/demo/account") return true;
  if (["admin", "reviewer"].includes(role)) return true;
  if (role === "contributor" && path === "/demo/contribute") return true;
  return ["/demo", "/demo/play", "/demo/rights", "/demo/history"].includes(path) || /^\/demo\/game\/[^/]+$/.test(path);
}
