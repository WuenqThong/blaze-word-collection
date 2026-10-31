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
    "Nghe đủ audio trước khi gõ. Có thể tua lại nhiều lần.",
    "Nếu có prelabel: chỉ cần đọc kỹ, sửa lại chỗ sai rồi bấm Correct hoặc Done.",
    "Đối với từ mượn / tên riêng: gõ đúng chính tả, không phiên âm.",
    "Dấu chấm câu: chỉ thêm khi audio thực sự có ngắt nghỉ rõ.",
  ],
  audio_verify: [
    "Bấm Play để nghe trước khi quyết định.",
    "Đọc kỹ nhãn gợi ý — so khớp từng chữ với audio.",
    "Sai chính tả nhỏ vẫn coi là sai (chọn Sai).",
    "Audio không nghe rõ → bấm Báo cáo, đừng đoán.",
  ],
  qa: [
    "Đọc câu hỏi kỹ trước khi nghe audio.",
    "Trả lời ngắn gọn, đúng trọng tâm câu hỏi.",
    "Nếu là multiple choice: chọn đáp án sát nhất với nội dung audio.",
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
            <div className="guideline-section-label">Project</div>
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
              <div className="guideline-section-label">Loại task hiện tại</div>
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
          <li><strong>Nghe đủ thời lượng audio</strong> trước khi submit. Submit quá nhanh sẽ bị flag low-engagement.</li>
          <li><strong>Tài khoản bị review</strong> khi tỉ lệ rejection ≥ 30% (sau ≥10 review). Hãy gán cẩn thận.</li>
          <li><strong>Audio lỗi</strong> → bấm <em>Báo cáo</em>, không đoán. Report được duyệt vẫn nhận điểm.</li>
        </ul>
      </Offcanvas.Body>
    </Offcanvas>
  );
}
