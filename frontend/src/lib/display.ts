/** Labels for system metadata only. Never translate user-authored content. */
const LABELS: Record<string, string> = {
  ANSWER_PROPOSAL: "Ghi nhận đề xuất đáp án mới",
  GATE: "Kiểm tra đầu vào", LEXEME: "Giải nghĩa từ", GOLD: "Kiểm tra đối chiếu", SENTENCE: "Giải nghĩa câu", OPEN_WORD: "Góp từ mới", OPEN_SENTENCE: "Góp câu mới",
  DRAFT: "Chờ duyệt", DEMO_APPROVED: "Đã duyệt dùng thử", VERIFIED: "Đã duyệt đạt", RAW: "Bản gốc", REVIEW: "Đang đánh giá", HOLD: "Cần kiểm tra hoặc bổ sung", REJECT: "Không đạt",
  admin: "Reviewer", reviewer: "Reviewer", annotator: "Người gán nhãn", contributor: "Người góp", guest: "Khách", manager: "Người quản lý", member: "Thành viên",
  email: "Email", password: "Mật khẩu", new_password: "Mật khẩu mới", full_name: "Tên hiển thị", consent_train: "Đồng ý huấn luyện", consent_collect: "Đồng ý tiếp nhận", note: "Ghi chú", reason: "Lý do",
  train: "Huấn luyện", training: "Huấn luyện", dev: "Đối chiếu", test: "Kiểm thử", evaluation: "Đánh giá", eval: "Đánh giá", import: "Nhập dữ liệu", export: "Xuất dữ liệu",
  queued: "Đang chờ", pending: "Đang chờ", running: "Đang chạy", completed: "Đã hoàn tất", done: "Đã hoàn tất", failed: "Thất bại", cancelled: "Đã hủy", open: "Chưa xử lý", resolved: "Đã xử lý", closed: "Đã đóng", active: "Đang hoạt động", suspended: "Tạm dừng", under_review: "Đang rà soát",
  word: "Từ / cụm từ", sentence: "Câu", direct: "Góp trực tiếp", game: "Từ lượt chơi", "model-feedback": "Phản hồi mô hình", self_report: "Người góp tự khai", answer: "Đã trả lời", unknown: "Không biết", no_term: "Không có từ riêng", same_standard: "Giống cách nói phổ thông",
  text: "Cách nói", original_text: "Nội dung gốc", meaning: "Nghĩa", standard: "Cách nói phổ thông", standard_vi: "Cách nói phổ thông", context: "Ví dụ / ngữ cảnh", evidence: "Nguồn", source_evidence: "Nguồn", region: "Vùng sử dụng", topic: "Chủ đề", variants: "Biến thể", confidence: "Mức độ chắc chắn", method: "Cách đóng góp", kind: "Loại nội dung", keywords: "Từ khóa", partOfSpeech: "Từ loại", family: "Nhóm từ", response: "Cách trả lời",
  SUBMITTED: "Đã gửi", CONTRIBUTE: "Đã góp dữ liệu", CONSENT: "Đổi phạm vi đồng ý", CONSENT_CHANGED: "Đổi phạm vi đồng ý", WITHDRAWN: "Đã rút", WITHDRAW_SESSION: "Rút lượt chơi", VOTE: "Đã gửi đánh giá", DECIDE: "Đã phân xử", CURATED: "Đã chỉnh lý", QUALITY_HOLD: "Tạm giữ để kiểm tra chất lượng", REQUEUE: "Đưa lại hàng chờ", SOURCE: "Đổi quyền nguồn", RELEASE: "Tạo bản xuất", PERSON: "Đổi thông tin người dùng", BACKUP: "Tạo sao lưu", RESTORE: "Khôi phục", START: "Bắt đầu lượt chơi", SUBMIT: "Gửi lượt chơi", LOGIN: "Đăng nhập", ROLE: "Đổi vai trò", FEEDBACK: "Gửi phản hồi", RESOLVE: "Xử lý phản hồi", EXAM: "Cập nhật bộ đề", QUESTION: "Cập nhật câu hỏi", PUBLISH: "Phát hành bộ đề", CLOSE_EXAM: "Đóng bộ đề", JOB: "Cập nhật tác vụ", MODEL: "Cập nhật mô hình", TAXONOMY: "Đổi vùng và chủ đề", TASK: "Cập nhật nhiệm vụ", CREDIT: "Cấp hạn mức", RIGHTS_CHANGED: "Đổi quyền sử dụng nguồn", BULK_HOLD: "Tạm giữ nhiều đóng góp", BULK_REQUEUE: "Đưa nhiều đóng góp lại hàng chờ", BULK_REJECT: "Từ chối nhiều đóng góp",
};

export function displayLabel(value: string | null | undefined, fallback = "Chưa xác định") {
  if (!value) return fallback;
  return LABELS[value] ?? (/[\u00c0-\u1ef9]/.test(value) ? value : fallback);
}

const TERMS: Record<string, string> = { ...LABELS, consent: "phạm vi đồng ý", public: "công khai", audio: "âm thanh", scopes: "phạm vi sử dụng", benchmark: "đánh giá đối chiếu", gold: "dữ liệu kiểm tra chuẩn", snapshot: "bản lưu", Dataset1: "Bộ dữ liệu số 1", DEMO: "minh họa", demo: "minh họa", QA: "kiểm tra chất lượng", reviewer: "người duyệt", admin: "quản trị viên", frontend: "giao diện", backend: "máy chủ", client: "ứng dụng", server: "máy chủ", idempotency_key: "mã chống gửi trùng", client_ref: "mã tham chiếu", session_ref: "mã lượt chơi", CURATE: "Chỉnh lý", ALLOCATED: "Đã phân bổ", "X-Account-ID": "tài khoản gửi yêu cầu" };
const termPattern = new RegExp(`\\b(${Object.keys(TERMS).join("|")})\\b`, "g");

export function systemText(value: string, fallback = "Không thể hoàn tất yêu cầu. Vui lòng thử lại hoặc liên hệ quản trị viên.") {
  const translated = value.replace(/\bEmail\b/g, "Email").replace(/\bDataset\b/g, "Bộ dữ liệu").replace(termPattern, term => TERMS[term]);
  return /[\u00c0-\u1ef9]/.test(translated) ? translated : fallback;
}
