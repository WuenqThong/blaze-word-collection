import { Card, Form, InputGroup } from "react-bootstrap";
import { TASK_TYPE_LABELS, type TaskType } from "../../lib/projectTypes";
import type { ProjectFormState } from "./ProjectForm";

const ALL_TASK_TYPES: TaskType[] = ["audio_label", "audio_verify", "qa"];

interface ProjectScoringFormProps {
  state: ProjectFormState;
  onChange: (next: ProjectFormState) => void;
  disabled?: boolean;
}

export function ProjectScoringForm({ state, onChange, disabled }: ProjectScoringFormProps) {
  const setScoring = (tt: TaskType, value: number) => {
    onChange({ ...state, scoring: { ...state.scoring, [tt]: value } });
  };

  const toggleTask = (tt: TaskType) => {
    const has = state.task_types.includes(tt);
    const next = has
      ? state.task_types.filter((x) => x !== tt)
      : [...state.task_types, tt];
    if (next.length === 0) return; // luôn giữ ít nhất 1
    onChange({ ...state, task_types: next });
  };

  return (
    <Card>
      <Card.Body>
        <div className="mb-3">
          <h5 className="mb-1">
            <i className="bi bi-list-check me-2 text-primary"></i>
            Nhiệm vụ
          </h5>
          <p className="text-muted small mb-0">
            Chọn các loại nhiệm vụ project sẽ gán và đặt điểm thưởng cho mỗi loại.
            Phải bật ít nhất 1 nhiệm vụ.
          </p>
        </div>

        <div className="d-grid gap-2">
          {ALL_TASK_TYPES.map((tt) => {
            const meta = TASK_TYPE_LABELS[tt];
            const active = state.task_types.includes(tt);
            return (
              <div
                key={tt}
                className="d-flex align-items-center gap-3 p-3 border rounded-3"
                style={{
                  borderColor: active ? "var(--brand-500)" : "var(--surface-3)",
                  borderWidth: active ? 2 : 1,
                  background: active ? "var(--brand-50)" : "var(--surface-0)",
                  transition: "all 0.15s",
                }}
              >
                <Form.Check
                  type="switch"
                  id={`task-${tt}`}
                  checked={active}
                  disabled={disabled}
                  onChange={() => toggleTask(tt)}
                />

                <div
                  className="d-flex align-items-center justify-content-center"
                  style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: active ? "var(--surface-0)" : "var(--brand-50)",
                    color: active ? "var(--brand-700)" : "var(--text-muted)",
                    fontSize: "1.2rem",
                    flex: "0 0 auto",
                  }}
                >
                  <i className={`bi ${meta.icon}`}></i>
                </div>

                <div className="flex-grow-1 min-w-0">
                  <div style={{ fontWeight: 600 }}>{meta.title}</div>
                  <div className="small text-muted">{meta.desc}</div>
                </div>

                {active && (
                  <div className="scoring-input-wrap">
                    <label htmlFor={`score-${tt}`} className="scoring-input-label">
                      <i className="bi bi-trophy-fill"></i>
                      Điểm thưởng
                    </label>
                    <InputGroup size="sm" className="scoring-input-group">
                      <Form.Control
                        id={`score-${tt}`}
                        type="number"
                        min={0}
                        max={1000}
                        value={state.scoring[tt] ?? 0}
                        disabled={disabled}
                        onChange={(e) => setScoring(tt, Number(e.target.value))}
                      />
                      <InputGroup.Text>điểm / câu</InputGroup.Text>
                    </InputGroup>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card.Body>
    </Card>
  );
}
