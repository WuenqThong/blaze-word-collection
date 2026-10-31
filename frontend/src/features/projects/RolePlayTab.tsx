import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Form, Spinner } from "react-bootstrap";
import {
  roleplayApi,
  type AgentUseCase,
  type RolePlayScenario,
  type RolePlayTestCase,
  type ScenarioCreatePayload,
  type TestCaseCreatePayload,
} from "../../api/roleplay";
import { extractError } from "../../api/client";
import "../roleplay/roleplay.css";

interface Props {
  projectId: number;
  isAdmin: boolean;
  agentConfigured: boolean;
  /** Notify parent khi điều hướng vào scenario detail / test case (drill-down). */
  onDeepViewChange?: (deep: boolean) => void;
}

export function RolePlayTab({ projectId, isAdmin, agentConfigured, onDeepViewChange }: Props) {
  if (!isAdmin) return <MemberView projectId={projectId} />;

  return (
    <div className="rp-fullbleed">
      <ScenariosAdmin
        projectId={projectId}
        agentConfigured={agentConfigured}
        onDeepViewChange={onDeepViewChange}
      />
    </div>
  );
}

// ============================================================
// Member view — list scenarios với button bắt đầu
// ============================================================
function MemberView({ projectId }: { projectId: number }) {
  const [scenarios, setScenarios] = useState<RolePlayScenario[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    roleplayApi
      .listProjectScenarios(projectId)
      .then(setScenarios)
      .catch((e) => setError(extractError(e, "Không tải được kịch bản")));
  }, [projectId]);

  if (error) return <Alert variant="danger">{error}</Alert>;
  if (!scenarios) return <Spinner animation="border" />;

  if (scenarios.length === 0) {
    return <Card body className="text-muted text-center">Project chưa có kịch bản role-play.</Card>;
  }

  return (
    <div className="d-grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
      {scenarios.map((s) => {
        const reachedLimit = s.max_tasks_per_user > 0 && s.tasks_done >= s.max_tasks_per_user;
        return (
          <Card key={s.id} className={reachedLimit ? "opacity-75" : ""}>
            <Card.Body>
              <div className="d-flex justify-content-between align-items-start mb-2">
                <h5 className="mb-0">{s.name}</h5>
                <Badge bg="secondary" pill>{s.language.toUpperCase()}</Badge>
              </div>
              <code className="small text-muted d-block mb-2">{s.use_case}</code>
              {s.description && <p className="text-muted small mb-2">{s.description}</p>}
              <div className="small text-muted mb-3">
                Đã thực hiện: <strong>{s.tasks_done}</strong>
                {s.max_tasks_per_user > 0 && ` / ${s.max_tasks_per_user}`}
              </div>
              <a
                href={`/roleplay/${s.id}`}
                className={`btn btn-primary w-100 ${reachedLimit ? "disabled" : ""}`}
              >
                <i className="bi bi-mic-fill me-2"></i>
                {reachedLimit ? "Đã đạt giới hạn" : "Bắt đầu"}
              </a>
            </Card.Body>
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// Admin: drill-down 3 levels
// ============================================================
type View =
  | { kind: "list" }
  | { kind: "scenario"; scenarioId: number }
  | { kind: "scenario-edit"; scenarioId: number | null } // null = create
  | { kind: "test-case"; scenarioId: number; testCaseId: number | null }; // null = create

function ScenariosAdmin({
  projectId,
  agentConfigured,
  onDeepViewChange,
}: {
  projectId: number;
  agentConfigured: boolean;
  onDeepViewChange?: (deep: boolean) => void;
}) {
  const [view, setView] = useState<View>({ kind: "list" });

  useEffect(() => {
    onDeepViewChange?.(view.kind !== "list");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.kind]);

  // Reset deep flag khi unmount (user chuyển sang tab khác)
  useEffect(() => {
    return () => onDeepViewChange?.(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (view.kind === "list") {
    return (
      <ScenariosListView
        projectId={projectId}
        agentConfigured={agentConfigured}
        onOpenScenario={(id) => setView({ kind: "scenario", scenarioId: id })}
        onCreateScenario={() => setView({ kind: "scenario-edit", scenarioId: null })}
      />
    );
  }
  if (view.kind === "scenario") {
    return (
      <ScenarioView
        projectId={projectId}
        scenarioId={view.scenarioId}
        onOpenTestCase={(tcId) =>
          setView({ kind: "test-case", scenarioId: view.scenarioId, testCaseId: tcId })
        }
        onCreateTestCase={() =>
          setView({ kind: "test-case", scenarioId: view.scenarioId, testCaseId: null })
        }
      />
    );
  }
  if (view.kind === "scenario-edit") {
    return (
      <ScenarioEditView
        projectId={projectId}
        scenarioId={view.scenarioId}
        onBack={() =>
          view.scenarioId
            ? setView({ kind: "scenario", scenarioId: view.scenarioId })
            : setView({ kind: "list" })
        }
        onSaved={(savedId) => setView({ kind: "scenario", scenarioId: savedId })}
        onDeleted={() => setView({ kind: "list" })}
      />
    );
  }
  // test-case
  return (
    <TestCaseEditView
      projectId={projectId}
      scenarioId={view.scenarioId}
      testCaseId={view.testCaseId}
      onBack={() => setView({ kind: "scenario", scenarioId: view.scenarioId })}
      onSaved={() => setView({ kind: "scenario", scenarioId: view.scenarioId })}
    />
  );
}

// ============================================================
// Level 1: Scenarios list
// ============================================================
function ScenariosListView({
  projectId,
  agentConfigured,
  onOpenScenario,
  onCreateScenario,
}: {
  projectId: number;
  agentConfigured: boolean;
  onOpenScenario: (id: number) => void;
  onCreateScenario: () => void;
}) {
  const [items, setItems] = useState<RolePlayScenario[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  const load = () =>
    roleplayApi
      .listProjectScenarios(projectId)
      .then(setItems)
      .catch((e) => setError(extractError(e, "Không tải được kịch bản")));

  useEffect(() => { void load(); }, [projectId]);

  const importFromAgent = async (overwrite: boolean) => {
    setImporting(true);
    setError(null);
    try {
      const r = await roleplayApi.importScenariosFromAgent(projectId, { overwrite });
      setImportMsg(`Đã import ${r.imported}${r.skipped ? `, bỏ qua ${r.skipped}` : ""}.`);
      setShowImportModal(false);
      void load();
    } catch (e) {
      setError(extractError(e, "Import thất bại"));
    } finally {
      setImporting(false);
    }
  };

  if (!items) return <Spinner animation="border" />;

  return (
    <div>
      {!agentConfigured && (
        <Alert variant="warning" className="mb-3">
          <i className="bi bi-exclamation-triangle me-2"></i>
          Project chưa cấu hình <strong>agent endpoint</strong>. Vào tab <strong>Cấu hình</strong> để thêm URL agent trước.
        </Alert>
      )}
      {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}
      {importMsg && <Alert variant="success" onClose={() => setImportMsg(null)} dismissible>{importMsg}</Alert>}

      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">Kịch bản</h4>
        <div className="d-flex gap-2">
          <Button variant="outline-primary" size="sm" onClick={() => setShowImportModal(true)} disabled={!agentConfigured}>
            <i className="bi bi-cloud-download me-1"></i> Import từ agent
          </Button>
          <Button size="sm" onClick={onCreateScenario} disabled={!agentConfigured}>
            <i className="bi bi-plus-lg me-1"></i> Tạo kịch bản
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <Card body className="text-muted text-center py-5">
          <p className="mb-2">Chưa có kịch bản nào.</p>
          <Button variant="primary" size="sm"
            onClick={() => setShowImportModal(true)}
            disabled={!agentConfigured}>
            <i className="bi bi-cloud-download me-1"></i> Import use_cases từ agent
          </Button>
        </Card>
      ) : (
        <div className="rp-scenario-grid">
          {items.map((s) => (
            <Card
              key={s.id}
              className={`rp-scenario-card ${!s.is_active ? "opacity-75" : ""}`}
              onClick={() => onOpenScenario(s.id)}
            >
              <Card.Body>
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <h5 className="mb-0 flex-grow-1 me-2">{s.name}</h5>
                  <Badge bg={s.is_active ? "success" : "secondary"}>
                    {s.is_active ? "on" : "off"}
                  </Badge>
                </div>
                <code className="small text-muted d-block mb-2">{s.use_case}</code>
                {s.description && (
                  <p className="text-muted small mb-3" style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}>
                    {s.description}
                  </p>
                )}
                <div className="d-flex justify-content-between align-items-center pt-2 border-top">
                  <span className="small text-muted">
                    <i className="bi bi-list-check me-1"></i>
                    {s.test_case_count > 0 ? (
                      <>{s.test_case_count} trường hợp</>
                    ) : (
                      <span className="text-muted">Chưa có trường hợp</span>
                    )}
                  </span>
                  <i className="bi bi-arrow-right text-primary"></i>
                </div>
              </Card.Body>
            </Card>
          ))}
        </div>
      )}

      {showImportModal && (
        <ImportModal
          projectId={projectId}
          onClose={() => setShowImportModal(false)}
          onImport={importFromAgent}
          importing={importing}
        />
      )}
    </div>
  );
}

// ============================================================
// Level 2: Scenario detail (info + test cases list)
// ============================================================
function ScenarioView({
  projectId,
  scenarioId,
  onOpenTestCase,
  onCreateTestCase,
}: {
  projectId: number;
  scenarioId: number;
  onOpenTestCase: (id: number) => void;
  onCreateTestCase: () => void;
}) {
  const [scenario, setScenario] = useState<RolePlayScenario | null>(null);
  const [testCases, setTestCases] = useState<RolePlayTestCase[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    Promise.all([
      roleplayApi.getScenario(scenarioId),
      roleplayApi.listProjectScenarioTestCases(projectId, scenarioId),
    ])
      .then(([s, tcs]) => { setScenario(s); setTestCases(tcs); })
      .catch((e) => setError(extractError(e, "Không tải được scenario")));

  useEffect(() => { void load(); }, [projectId, scenarioId]);

  if (error) return <Alert variant="danger">{error}</Alert>;
  if (!scenario || !testCases) return <Spinner animation="border" />;

  return (
    <div>
      {/* Test cases section */}
      <div className="rp-section">
        <div className="rp-section-header">
          <div>
            <h5 className="mb-1">
              Trường hợp giả định
              <Badge bg="secondary" className="ms-2">{testCases.length}</Badge>
            </h5>
            <p className="text-muted small mb-0">
              Mỗi trường hợp là 1 tình huống cụ thể annotator đóng vai. Annotator chọn 1 case khi bắt đầu.
            </p>
          </div>
          <Button size="sm" onClick={onCreateTestCase} className="flex-shrink-0">
            <i className="bi bi-plus-lg me-1"></i> Thêm trường hợp
          </Button>
        </div>

        {testCases.length === 0 ? (
          <Card body className="text-muted text-center py-4">
            <i className="bi bi-list-check display-5 d-block mb-2 text-muted"></i>
            <p className="mb-2">Chưa có trường hợp nào.</p>
            <Button size="sm" variant="primary" onClick={onCreateTestCase}>
              <i className="bi bi-plus-lg me-1"></i> Tạo trường hợp đầu tiên
            </Button>
          </Card>
        ) : (
          <div className="rp-tc-grid">
            {testCases.map((tc) => (
              <Card
                key={tc.id}
                className={`rp-tc-card ${!tc.is_active ? "opacity-75" : ""}`}
                onClick={() => onOpenTestCase(tc.id)}
              >
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <strong className="flex-grow-1 me-2">{tc.name}</strong>
                    {!tc.is_active && <Badge bg="secondary">off</Badge>}
                  </div>
                  {tc.description && (
                    <p className="text-muted small mb-3 rp-tc-desc">{tc.description}</p>
                  )}
                  <div className="d-flex gap-2 flex-wrap">
                    <span className={`rp-tc-tag ${tc.instructions ? "filled" : ""}`}>
                      <i className={`bi ${tc.instructions ? "bi-check-lg" : "bi-dash"} me-1`}></i>
                      Hướng dẫn
                    </span>
                    <span className={`rp-tc-tag ${tc.expected_outcome ? "filled" : ""}`}>
                      <i className={`bi ${tc.expected_outcome ? "bi-check-lg" : "bi-dash"} me-1`}></i>
                      Kỳ vọng
                    </span>
                  </div>
                </Card.Body>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Level "Edit Scenario" — config form (full page)
// ============================================================
const EMPTY_SCENARIO: ScenarioCreatePayload = {
  use_case: "",
  name: "",
  description: "",
  instructions: "",
  max_tasks_per_user: 0,
  max_duration_sec: 0,
  is_active: true,
};

function ScenarioEditView({
  projectId,
  scenarioId,
  onBack,
  onSaved,
  onDeleted,
}: {
  projectId: number;
  scenarioId: number | null;
  onBack: () => void;
  onSaved: (id: number) => void;
  onDeleted: () => void;
}) {
  const [form, setForm] = useState<ScenarioCreatePayload>(EMPTY_SCENARIO);
  const [loading, setLoading] = useState(scenarioId !== null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scenario, setScenario] = useState<RolePlayScenario | null>(null);

  useEffect(() => {
    if (scenarioId === null) {
      setForm(EMPTY_SCENARIO);
      setLoading(false);
      return;
    }
    setLoading(true);
    roleplayApi
      .getScenario(scenarioId)
      .then((s) => {
        setScenario(s);
        setForm({
          use_case: s.use_case,
          name: s.name,
          description: s.description || "",
          instructions: s.instructions || "",
          max_tasks_per_user: s.max_tasks_per_user,
          max_duration_sec: s.max_duration_sec,
          is_active: s.is_active,
        });
      })
      .catch((e) => setError(extractError(e, "Không tải được scenario")))
      .finally(() => setLoading(false));
  }, [scenarioId]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const saved = scenarioId
        ? await roleplayApi.updateProjectScenario(projectId, scenarioId, form)
        : await roleplayApi.createProjectScenario(projectId, form);
      onSaved(saved.id);
    } catch (e) {
      setError(extractError(e, "Lưu thất bại"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!scenarioId || !scenario) return;
    if (!confirm(`Xoá kịch bản "${scenario.name}"? Tất cả trường hợp + phiên đã thực hiện sẽ bị xoá theo.`)) return;
    try {
      await roleplayApi.deleteProjectScenario(projectId, scenarioId);
      onDeleted();
    } catch (e) {
      setError(extractError(e, "Xoá thất bại"));
    }
  };

  if (loading) return <Spinner animation="border" />;

  return (
    <div style={{ maxWidth: 800 }}>
      <Button variant="link" size="sm" onClick={onBack} className="px-0 mb-2 text-decoration-none">
        <i className="bi bi-arrow-left me-1"></i> {scenarioId ? "Quay lại kịch bản" : "Tất cả kịch bản"}
      </Button>

      <h3 className="mb-3">{scenarioId ? "Cấu hình kịch bản" : "Tạo kịch bản"}</h3>

      {error && <Alert variant="danger">{error}</Alert>}

      <Card body>
        <Form>
          <div className="row g-3">
            <Form.Group className="col-md-7">
              <Form.Label>Tên (hiển thị)</Form.Label>
              <Form.Control value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Form.Group>
            <Form.Group className="col-md-5">
              <Form.Label>use_case (slug)</Form.Label>
              <Form.Control value={form.use_case}
                onChange={(e) => setForm({ ...form, use_case: e.target.value })}
                placeholder="ha_scenario" />
            </Form.Group>
          </div>
          <Form.Group className="mt-3">
            <Form.Label>Mô tả</Form.Label>
            <Form.Control as="textarea" rows={2} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Form.Group>
          <Form.Group className="mt-3">
            <Form.Label>Hướng dẫn mặc định cho annotator</Form.Label>
            <Form.Control as="textarea" rows={5} value={form.instructions}
              onChange={(e) => setForm({ ...form, instructions: e.target.value })}
              placeholder="Hướng dẫn dùng nếu annotator không chọn trường hợp cụ thể." />
          </Form.Group>
          <div className="row g-3 mt-1">
            <Form.Group className="col-md-6">
              <Form.Label>Tối đa lượt/user</Form.Label>
              <Form.Control type="number" min={0} value={form.max_tasks_per_user}
                onChange={(e) => setForm({ ...form, max_tasks_per_user: Number(e.target.value) || 0 })} />
              <Form.Text>0 = không giới hạn</Form.Text>
            </Form.Group>
            <Form.Group className="col-md-6">
              <Form.Label>Tối đa giây/phiên</Form.Label>
              <Form.Control type="number" min={0} value={form.max_duration_sec}
                onChange={(e) => setForm({ ...form, max_duration_sec: Number(e.target.value) || 0 })} />
              <Form.Text>0 = không giới hạn</Form.Text>
            </Form.Group>
          </div>
          <Form.Check className="mt-3" type="switch" label="Active"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
        </Form>
      </Card>

      <div className="d-flex justify-content-between mt-3">
        <div>
          {scenarioId && (
            <Button variant="outline-danger" size="sm" onClick={remove}>
              <i className="bi bi-trash me-1"></i> Xoá kịch bản
            </Button>
          )}
        </div>
        <div className="d-flex gap-2">
          <Button variant="secondary" onClick={onBack}>Huỷ</Button>
          <Button onClick={save} disabled={saving || !form.name || !form.use_case}>
            {saving ? <Spinner animation="border" size="sm" /> : (scenarioId ? "Lưu" : "Tạo")}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Level 3: TestCase config (full page)
// ============================================================
const EMPTY_TEST_CASE: TestCaseCreatePayload = {
  name: "",
  description: "",
  instructions: "",
  expected_outcome: "",
  is_active: true,
};

function TestCaseEditView({
  projectId,
  scenarioId,
  testCaseId,
  onBack,
  onSaved,
}: {
  projectId: number;
  scenarioId: number;
  testCaseId: number | null;
  onBack: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<TestCaseCreatePayload>(EMPTY_TEST_CASE);
  const [loading, setLoading] = useState(testCaseId !== null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testCase, setTestCase] = useState<RolePlayTestCase | null>(null);

  useEffect(() => {
    if (testCaseId === null) {
      setForm(EMPTY_TEST_CASE);
      setLoading(false);
      return;
    }
    setLoading(true);
    roleplayApi
      .listProjectScenarioTestCases(projectId, scenarioId)
      .then((tcs) => {
        const tc = tcs.find((x) => x.id === testCaseId);
        if (tc) {
          setTestCase(tc);
          setForm({
            name: tc.name,
            description: tc.description || "",
            instructions: tc.instructions || "",
            expected_outcome: tc.expected_outcome || "",
            is_active: tc.is_active,
          });
        } else {
          setError("Không tìm thấy trường hợp");
        }
      })
      .catch((e) => setError(extractError(e, "Không tải được trường hợp")))
      .finally(() => setLoading(false));
  }, [projectId, scenarioId, testCaseId]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      if (testCaseId) {
        await roleplayApi.updateTestCase(projectId, scenarioId, testCaseId, form);
      } else {
        await roleplayApi.createTestCase(projectId, scenarioId, form);
      }
      onSaved();
    } catch (e) {
      setError(extractError(e, "Lưu thất bại"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!testCaseId || !testCase) return;
    if (!confirm(`Xoá trường hợp "${testCase.name}"?`)) return;
    try {
      await roleplayApi.deleteTestCase(projectId, scenarioId, testCaseId);
      onSaved();
    } catch (e) {
      setError(extractError(e, "Xoá thất bại"));
    }
  };

  if (loading) return <Spinner animation="border" />;

  return (
    <div style={{ maxWidth: 800 }}>
      <Button variant="link" size="sm" onClick={onBack} className="px-0 mb-2 text-decoration-none">
        <i className="bi bi-arrow-left me-1"></i> Quay lại kịch bản
      </Button>

      <h3 className="mb-3">
        {testCaseId ? "Cấu hình trường hợp" : "Thêm trường hợp"}
      </h3>

      {error && <Alert variant="danger">{error}</Alert>}

      <Card body>
        <Form>
          <Form.Group>
            <Form.Label>Tên trường hợp <span className="text-danger">*</span></Form.Label>
            <Form.Control value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="vd: Khách hài lòng cao (7/7)" />
          </Form.Group>
          <Form.Group className="mt-3">
            <Form.Label>Mô tả ngắn</Form.Label>
            <Form.Control as="textarea" rows={2} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Form.Group>
          <Form.Group className="mt-3">
            <Form.Label>Hướng dẫn cho annotator (override scenario)</Form.Label>
            <Form.Control as="textarea" rows={6} value={form.instructions}
              onChange={(e) => setForm({ ...form, instructions: e.target.value })}
              placeholder="Annotator đóng vai gì? Trả lời ra sao? Để trống → dùng hướng dẫn của kịch bản." />
          </Form.Group>
          <Form.Group className="mt-3">
            <Form.Label>Kết quả kỳ vọng</Form.Label>
            <Form.Control as="textarea" rows={3} value={form.expected_outcome}
              onChange={(e) => setForm({ ...form, expected_outcome: e.target.value })}
              placeholder="Agent nên thu thập được thông tin gì? Annotator dùng để verify." />
          </Form.Group>
          <Form.Check className="mt-3" type="switch" label="Active"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
        </Form>
      </Card>

      <div className="d-flex justify-content-between mt-3">
        <div>
          {testCaseId && (
            <Button variant="outline-danger" size="sm" onClick={remove}>
              <i className="bi bi-trash me-1"></i> Xoá trường hợp
            </Button>
          )}
        </div>
        <div className="d-flex gap-2">
          <Button variant="secondary" onClick={onBack}>Huỷ</Button>
          <Button onClick={save} disabled={saving || !form.name}>
            {saving ? <Spinner animation="border" size="sm" /> : (testCaseId ? "Lưu" : "Tạo")}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Import modal
// ============================================================
function ImportModal({
  projectId,
  onClose,
  onImport,
  importing,
}: {
  projectId: number;
  onClose: () => void;
  onImport: (overwrite: boolean) => void;
  importing: boolean;
}) {
  const [agentUseCases, setAgentUseCases] = useState<AgentUseCase[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    roleplayApi
      .listAgentUseCases(projectId)
      .then(setAgentUseCases)
      .catch((e) => setError(extractError(e, "Không fetch được use_cases từ agent")));
  }, [projectId]);

  return (
    <>
      <div className="rp-import-backdrop" onClick={onClose}></div>
      <div className="rp-import-modal">
        <div className="rp-import-header">
          <h5 className="mb-0">
            <i className="bi bi-cloud-download me-2"></i>Import use_cases từ agent
          </h5>
          <Button variant="link" className="p-0 text-secondary" onClick={onClose}>
            <i className="bi bi-x-lg fs-5"></i>
          </Button>
        </div>
        <div className="rp-import-body">
          {error && <Alert variant="danger">{error}</Alert>}
          <p className="text-muted small mb-3">
            Use cases agent server hỗ trợ. Cái nào đã import vào project hiển thị nền xanh.
          </p>
          {!agentUseCases ? (
            <Spinner animation="border" />
          ) : agentUseCases.length === 0 ? (
            <Alert variant="warning">Agent không expose use_case nào.</Alert>
          ) : (
            <div>
              {agentUseCases.map((uc) => (
                <div key={uc.use_case} className={`rp-uc-card ${uc.imported ? "imported" : ""}`}>
                  <div className="d-flex justify-content-between align-items-start mb-1">
                    <strong>{uc.name}</strong>
                    {uc.imported && (
                      <Badge bg="success">
                        <i className="bi bi-check-lg me-1"></i>Đã import
                      </Badge>
                    )}
                  </div>
                  <code className="small text-muted d-block mb-2">{uc.use_case}</code>
                  {uc.description && <p className="small mb-0">{uc.description}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rp-import-footer">
          <Button variant="secondary" onClick={onClose}>Đóng</Button>
          <Button variant="outline-primary" onClick={() => onImport(true)}
            disabled={importing || !agentUseCases?.length}>
            <i className="bi bi-arrow-repeat me-1"></i> Import + ghi đè
          </Button>
          <Button onClick={() => onImport(false)} disabled={importing || !agentUseCases?.length}>
            {importing ? <Spinner animation="border" size="sm" /> : (
              <><i className="bi bi-cloud-download me-1"></i> Import (skip trùng)</>
            )}
          </Button>
        </div>
      </div>
    </>
  );
}
