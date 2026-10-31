import { Card, Form, Row, Col, InputGroup } from "react-bootstrap";
import { KIND_META, TASK_TYPE_LABELS, type ProjectKind, type TaskType, type ProjectVisibility } from "../../lib/projectTypes";

const ALL_TASK_TYPES: TaskType[] = ["audio_label", "audio_verify", "qa"];

export interface ProjectFormState {
  name: string;
  description: string;
  kind: ProjectKind;
  task_types: TaskType[];
  scoring: Record<string, number>;
  redundancy: number;
  golden_ratio: number;
  repeat_ratio: number;
  visibility: ProjectVisibility;
  agent_endpoint: string;
  default_language: string;
}

export const DEFAULT_FORM: ProjectFormState = {
  name: "",
  description: "",
  kind: "annotate",
  task_types: ["audio_label"],
  scoring: { audio_label: 10, audio_verify: 5, qa: 8 },
  redundancy: 3,
  golden_ratio: 0.1,
  repeat_ratio: 0.0,
  visibility: "private",
  agent_endpoint: "",
  default_language: "vi",
};

interface ProjectFormProps {
  state: ProjectFormState;
  onChange: (next: ProjectFormState) => void;
  disabled?: boolean;
  /** Khi true, ẩn input điểm thưởng trong từng task type (dùng khi điểm có tab riêng). */
  hideScoring?: boolean;
  /** Khi true, ẩn section kiểm soát chất lượng (redundancy + golden ratio). */
  hideQuality?: boolean;
  /** Khi true, ẩn picker chọn loại project (dùng ở trang sửa — kind không đổi được). */
  hideKindPicker?: boolean;
}

const redundancyHint = (n: number) =>
  n <= 2 ? "Tiết kiệm – chấp nhận sai số." :
  n <= 4 ? "Cân bằng giữa chi phí và chất lượng." :
          "Đảm bảo consensus mạnh – chi phí cao.";

const goldenHint = (r: number) => {
  const pct = Math.round(r * 100);
  if (pct === 0) return "Không kiểm tra ngẫu nhiên — chỉ phù hợp khi đã tin tưởng annotator.";
  if (pct <= 10) return `${pct}% task là golden — mặc định cho production.`;
  if (pct <= 20) return `${pct}% — chế độ chặt, dành cho user mới hoặc dữ liệu nhạy cảm.`;
  return `${pct}% — quá nghiêm, chỉ dùng khi probation.`;
};

const repeatHint = (r: number) => {
  const pct = Math.round(r * 100);
  if (pct === 0) return "Tắt — không gán lặp lại. Không phát hiện được gán random.";
  if (pct <= 10) return `${pct}% task được gán lại cho cùng annotator để check tính nhất quán.`;
  if (pct <= 20) return `${pct}% — chặt vừa, soi annotator có hay đổi câu trả lời không.`;
  return `${pct}% — chế độ nghiêm, dùng khi đang điều tra một annotator nghi vấn.`;
};

function SectionHeader({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="mb-3">
      <h6 className="mb-1 fw-semibold">{title}</h6>
      {desc && <p className="text-muted small mb-0">{desc}</p>}
    </div>
  );
}

export function ProjectForm({ state, onChange, disabled, hideScoring = false, hideQuality = false, hideKindPicker = false }: ProjectFormProps) {
  const setScoring = (tt: string, value: number) => {
    onChange({ ...state, scoring: { ...state.scoring, [tt]: value } });
  };
  const isCollect = state.kind === "collect";

  return (
    <>
      {/* === Section 0: Loại project === */}
      {!hideKindPicker && (
        <Card className="mb-3">
          <Card.Body>
            <SectionHeader
              title="Loại project"
              desc="Chọn theo mục tiêu — không đổi được sau khi tạo."
            />
            <div className="row g-3">
              {(Object.keys(KIND_META) as ProjectKind[]).map((k) => {
                const meta = KIND_META[k];
                const active = state.kind === k;
                return (
                  <div key={k} className="col-md-6">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        // collect-kind clear task_types về rỗng (project chỉ chứa role-play)
                        // và default visibility=public vì mục đích thu thập từ nhiều annotator.
                        onChange({
                          ...state,
                          kind: k,
                          task_types: k === "collect" ? [] : (state.task_types.length ? state.task_types : ["audio_label"]),
                          visibility:
                            k === "collect" && state.visibility === "private"
                              ? "public"
                              : state.visibility,
                        });
                      }}
                      className={`w-100 text-start border rounded-3 p-3 ${active ? "border-primary border-2" : ""}`}
                      style={{ background: active ? "var(--brand-50)" : "var(--surface-0)" }}
                    >
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <i className={`bi ${meta.icon} fs-5`} style={{ color: active ? "var(--brand-700)" : "var(--text-muted)" }}></i>
                        <strong>{meta.label}</strong>
                      </div>
                      <div className="small text-muted">{meta.desc}</div>
                    </button>
                  </div>
                );
              })}
            </div>
          </Card.Body>
        </Card>
      )}

      {/* === Section 1: Basic info === */}
      <Card className="mb-3">
        <Card.Body>
          <SectionHeader
            title="Thông tin project"
            desc="Đặt tên dễ nhận diện và mô tả ngắn để annotator hiểu mục tiêu."
          />

          <Row className="g-3">
            <Col md={6}>
              <Form.Group>
                <Form.Label>Tên project <span className="text-danger">*</span></Form.Label>
                <Form.Control
                  type="text"
                  value={state.name}
                  required
                  disabled={disabled}
                  placeholder="VD: VN ASR pilot batch 1"
                  onChange={(e) => onChange({ ...state, name: e.target.value })}
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>Mô tả ngắn</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={1}
                  value={state.description}
                  disabled={disabled}
                  placeholder="Ngôn ngữ, domain, hướng dẫn ngắn..."
                  onChange={(e) => onChange({ ...state, description: e.target.value })}
                />
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* === Section 2: Visibility (compact) === */}
      <Card className="mb-3">
        <Card.Body>
          <div className="d-flex flex-wrap align-items-center gap-3">
            <div className="flex-grow-1 min-w-0">
              <h6 className="mb-1 fw-semibold">Quyền truy cập</h6>
              <div className="text-muted small">
                {state.visibility === "public"
                  ? "Mọi user đăng nhập đều có thể vào project và nhận task."
                  : "Chỉ admin và member được thêm thủ công mới truy cập được."}
              </div>
            </div>
            <div className="visibility-segmented" role="group" aria-label="Quyền truy cập">
              {(["private", "public"] as const).map((v) => {
                const active = state.visibility === v;
                return (
                  <button
                    key={v}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange({ ...state, visibility: v })}
                    className={`vs-pill ${active ? "active" : ""}`}
                  >
                    <i className={`bi ${v === "public" ? "bi-globe" : "bi-lock"}`}></i>
                    <span>{v === "public" ? "Public" : "Private"}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* === Section 3: Task — bật loại + cấu hình điểm === */}
      {!hideScoring && !isCollect && (
        <Card className="mb-3">
          <Card.Body>
            <SectionHeader
              title="Nhiệm vụ"
              desc="Bật các loại nhiệm vụ project hỗ trợ và đặt điểm thưởng cho từng loại."
            />

            <div className="d-grid gap-2">
              {ALL_TASK_TYPES.map((tt) => {
                const meta = TASK_TYPE_LABELS[tt];
                const active = state.task_types.includes(tt);
                return (
                  <div
                    key={tt}
                    className="border rounded-3 p-3"
                    style={{
                      borderColor: active ? "var(--brand-500)" : "var(--surface-3)",
                      borderWidth: active ? 2 : 1,
                      background: active ? "var(--brand-50)" : "var(--surface-0)",
                      transition: "all 0.15s",
                    }}
                  >
                    <div className="d-flex align-items-center gap-3 flex-wrap">
                      <Form.Check
                        type="switch"
                        id={`tt-${tt}`}
                        checked={active}
                        disabled={disabled}
                        onChange={() => {
                          const next = active
                            ? state.task_types.filter((x) => x !== tt)
                            : [...state.task_types, tt];
                          if (next.length === 0) return;
                          onChange({ ...state, task_types: next });
                        }}
                      />
                      <div className="flex-grow-1 min-w-0">
                        <div className="d-flex align-items-center gap-2">
                          <i className={`bi ${meta.icon}`} style={{ color: active ? "var(--brand-700)" : "var(--text-muted)" }}></i>
                          <strong>{meta.title}</strong>
                        </div>
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
                  </div>
                );
              })}
            </div>
          </Card.Body>
        </Card>
      )}

      {/* === Section 3b: Agent config (chỉ collect-kind) === */}
      {isCollect && (
        <Card className="mb-3">
          <Card.Body>
            <SectionHeader
              title="Cấu hình agent"
              desc="Tất cả scenarios trong project share cùng agent + ngôn ngữ này."
            />
            <Row className="g-3">
              <Col md={8}>
                <Form.Group>
                  <Form.Label>Agent endpoint URL <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    type="url"
                    value={state.agent_endpoint}
                    placeholder="https://callbot-api.blaze.vn"
                    disabled={disabled}
                    onChange={(e) => onChange({ ...state, agent_endpoint: e.target.value })}
                  />
                  <Form.Text className="text-muted">
                    Annotator backend proxy WS tới <code>{state.agent_endpoint || "{endpoint}"}/v1/voice-bot/ws</code>.
                  </Form.Text>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Ngôn ngữ mặc định</Form.Label>
                  <Form.Select
                    value={state.default_language}
                    disabled={disabled}
                    onChange={(e) => onChange({ ...state, default_language: e.target.value })}
                  >
                    <option value="vi">Tiếng Việt</option>
                    <option value="en">English</option>
                    <option value="km">Khmer</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      )}

      {/* === Section 4: Kiểm soát chất lượng === */}
      {!hideQuality && !isCollect && (
        <Card className="mb-3">
          <Card.Body>
            <SectionHeader
              title="Kiểm soát chất lượng"
              desc="Mức độ chéo, tỉ lệ task golden, và tỉ lệ gán lặp lại để bắt annotator gán random."
            />

            <Row className="g-4">
              <Col md={4}>
                <Form.Label className="d-flex justify-content-between mb-2">
                  <span>Redundancy <span className="text-muted">(số người gán mỗi audio)</span></span>
                  <strong className="text-primary">×{state.redundancy}</strong>
                </Form.Label>
                <Form.Range
                  min={1}
                  max={7}
                  value={state.redundancy}
                  disabled={disabled}
                  onChange={(e) => onChange({ ...state, redundancy: Number(e.target.value) })}
                />
                <div className="d-flex justify-content-between small text-muted">
                  <span>1</span><span>3 (gợi ý)</span><span>7</span>
                </div>
                <div className="small text-body-secondary mt-2">
                  <i className="bi bi-lightbulb me-1"></i>{redundancyHint(state.redundancy)}
                </div>
              </Col>

              <Col md={4}>
                <Form.Label className="d-flex justify-content-between mb-2">
                  <span>Golden ratio <span className="text-muted">(tỉ lệ task kiểm tra)</span></span>
                  <strong className="text-primary">{Math.round(state.golden_ratio * 100)}%</strong>
                </Form.Label>
                <Form.Range
                  min={0}
                  max={50}
                  step={5}
                  value={Math.round(state.golden_ratio * 100)}
                  disabled={disabled}
                  onChange={(e) => onChange({ ...state, golden_ratio: Number(e.target.value) / 100 })}
                />
                <div className="d-flex justify-content-between small text-muted">
                  <span>0%</span><span>10% (gợi ý)</span><span>50%</span>
                </div>
                <div className="small text-body-secondary mt-2">
                  <i className="bi bi-lightbulb me-1"></i>{goldenHint(state.golden_ratio)}
                </div>
              </Col>

              <Col md={4}>
                <Form.Label className="d-flex justify-content-between mb-2">
                  <span>Tỉ lệ gán lặp lại <span className="text-muted">(check tính nhất quán)</span></span>
                  <strong className="text-primary">{Math.round(state.repeat_ratio * 100)}%</strong>
                </Form.Label>
                <Form.Range
                  min={0}
                  max={50}
                  step={5}
                  value={Math.round(state.repeat_ratio * 100)}
                  disabled={disabled}
                  onChange={(e) => onChange({ ...state, repeat_ratio: Number(e.target.value) / 100 })}
                />
                <div className="d-flex justify-content-between small text-muted">
                  <span>0%</span><span>10%</span><span>50%</span>
                </div>
                <div className="small text-body-secondary mt-2">
                  <i className="bi bi-lightbulb me-1"></i>{repeatHint(state.repeat_ratio)}
                </div>
              </Col>
            </Row>
            <div className="small text-muted mt-3">
              <i className="bi bi-info-circle me-1"></i>
              Câu lặp lại vẫn được tính điểm cho annotator. Hệ thống dùng câu trả lời lặp để phát hiện gán random hoặc gán sai.
            </div>
          </Card.Body>
        </Card>
      )}
    </>
  );
}
