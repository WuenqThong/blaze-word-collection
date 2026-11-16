import { Offcanvas } from "react-bootstrap";
import { TASK_TYPE_LABELS, type TaskType } from "../../lib/projectTypes";
import type { NextTaskProject } from "../../lib/annotateTypes";

interface GuidelineOffcanvasProps {
  show: boolean;
  onHide: () => void;
  project?: NextTaskProject | null;
  taskType?: TaskType | null;
}

const TASK_TIPS: Record<TaskType, string[]> = {
  audio_label: [
    "Nghe đủ âm thanh trước khi gõ. Có thể tua lại nhiều lần.",
    "Nếu có nhãn gợi ý: chỉ cần đọc kỹ, sửa lại chỗ sai rồi bấm Đúng hoặc Done.",
    "Đối với từ mượn / tên riêng: gõ đúng chính tả, không phiên âm.",
    "Dấu chấm câu: chỉ thêm khi âm thanh thực sự có ngắt nghỉ rõ.",
  ],
  audio_verify: [
    "Bấm Play để nghe trước khi quyết định.",
    "Đọc kỹ nhãn gợi ý — so khớp từng chữ với âm thanh.",
    "Sai chính tả nhỏ vẫn coi là sai (chọn Sai).",
    "Âm thanh không nghe rõ → bấm Báo cáo, đừng đoán.",
  ],
  qa: [
    "Đọc câu hỏi kỹ trước khi nghe âm thanh.",
    "Trả lời ngắn gọn, đúng trọng tâm câu hỏi.",
    "Nếu là multiple choice: chọn đáp án sát nhất với nội dung âm thanh.",
  ],
};

export function GuidelineOffcanvas({ show, onHide, project, taskType }: GuidelineOffcanvasProps) {
  const meta = taskType ? TASK_TYPE_LABELS[taskType] : null;
  const tips = taskType ? TASK_TIPS[taskType] : null;

  return (
    <Offcanvas show={show} onHide={onHide} placement="start" className="guideline-canvas">
      <Offcanvas.Header closeButton>
        <Offcanvas.Title>
          <i className="bi bi-journal-text me-2"></i>Hướng dẫn gán
        </Offcanvas.Title>
      </Offcanvas.Header>
      <Offcanvas.Body>
        {project && (
          <div className="mb-3">
            <div className="guideline-section-label">Dự án</div>
            <div className="fw-semibold">{project.name}</div>
            {project.description?.trim() && (
              <p className="mt-2 mb-0" style={{ whiteSpace: "pre-wrap", fontSize: "0.92rem", lineHeight: 1.55 }}>
                {project.description}
              </p>
            )}
          </div>
        )}

        {meta && (
          <>
            <hr />
            <div className="mb-3">
              <div className="guideline-section-label">Loại nhiệm vụ hiện tại</div>
              <div className="d-flex align-items-center gap-2 mt-1">
                <i className={`bi ${meta.icon}`} style={{ color: "var(--brand-700)" }}></i>
                <strong>{meta.title}</strong>
              </div>
              <div className="small text-muted mt-1">{meta.desc}</div>
            </div>
          </>
        )}

        {tips && tips.length > 0 && (
          <>
            <hr />
            <div className="guideline-section-label mb-2">Mẹo gán đúng</div>
            <ul className="guideline-tips ps-3">
              {tips.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </>
        )}

        <hr />
        <div className="guideline-section-label mb-2">Lưu ý chung</div>
        <ul className="guideline-tips ps-3">
          <li><strong>Nghe đủ thời lượng âm thanh</strong> trước khi gửi. Gửi quá nhanh sẽ bị đánh dấu thấp-mức độ tham gia.</li>
          <li><strong>Tài khoản bị đang đánh giá</strong> khi tỉ lệ từ chối ≥ 30% (sau ≥10 đang đánh giá). Hãy gán cẩn thận.</li>
          <li><strong>Âm thanh lỗi</strong> → bấm <em>Báo cáo</em>, không đoán. Báo cáo được duyệt vẫn nhận điểm.</li>
        </ul>
      </Offcanvas.Body>
    </Offcanvas>
  );
}
