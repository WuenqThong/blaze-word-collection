import { ResponsiveTable } from "../../components/ResponsiveTable";
import { useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useDemo } from "./context";
import { uid } from "./domain";
import { METHODS } from "./seed";
import { Action, DemoGuard, Field, Heading, Panel } from "./ui";
import { Modal } from "react-bootstrap";
import { displayLabel } from "../../lib/display";
import type { Person, Source, Task } from "./types";
import { MediaAttach } from "./ContributionDemo";

const RIGHT_LABEL = { train: "dùng để huấn luyện", public: "công khai", audio: "dùng âm thanh" } as const;

export function SettingsDemo() {
  const [params] = useSearchParams();
  if (params.get("section") !== "sources") return <Navigate to="/demo/reviewer/review" replace />;
  return (
    <DemoGuard>
      <SettingsInner />
    </DemoGuard>
  );
}
function ParticipantRow({ person }: { person: Person }) {
  const { run, live } = useDemo();
  const [draft, setDraft] = useState(person);
  const [baseline, setBaseline] = useState(person);
  const [confirm, setConfirm] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = ["role", "region", "verified", "risk", "operations"].some(key => draft[key as keyof Person] !== person[key as keyof Person]);
  function change(value: Partial<Person>) { setDraft({ ...draft, ...value }); setSaved(false); }
  return <><tr><td>{person.name}<small>{live ? `Mã người dùng #${person.id.slice(8)}` : person.id}</small></td>
    <td><select aria-label={`Vai trò ${person.name}`} value={draft.role === "admin" ? "reviewer" : draft.role} disabled={person.id === "guest"} onChange={e => change({ role: e.target.value as Person["role"], operations: e.target.value === "contributor" ? false : draft.operations })}>{!live && <option value="guest">Khách</option>}<option value="contributor">Người góp</option><option value="reviewer">Reviewer</option></select>{live && ["reviewer", "admin"].includes(draft.role) && <label className="demo-checkbox"><input type="checkbox" checked={!!draft.operations} onChange={e=>change({operations:e.target.checked})}/>Quyền vận hành</label>}</td>
    <td><label className="demo-checkbox"><input type="checkbox" checked={draft.verified} onChange={e => change({ verified: e.target.checked })}/>Đã xác nhận tài khoản</label><select aria-label={`Rủi ro ${person.name}`} value={draft.risk} onChange={e => change({ risk: e.target.value as Person["risk"] })}><option value="clear">Bình thường</option><option value="hold">Tạm giữ kiểm tra</option></select>
      <div className="demo-actions"><Action disabled={!dirty} onClick={() => setConfirm(true)}>Lưu thay đổi</Action>{dirty && <button type="button" className="btn btn-link" onClick={() => { setDraft(person); setBaseline(person); }}>Hủy sửa</button>}</div>{saved && <p role="status">Đã lưu thay đổi.</p>}
    </td></tr>
    <Modal aria-label="Lưu thay đổi tài khoản" centered show={confirm} onHide={() => setConfirm(false)}><Modal.Header closeLabel="Đóng" closeButton><Modal.Title>Lưu thay đổi?</Modal.Title></Modal.Header><Modal.Body><p>Tài khoản: {person.name}</p><p>Vai trò: {displayLabel(draft.role)}</p><p>Chỉ lưu sau khi bạn xác nhận. Thay đổi được ghi vào lịch sử hệ thống.</p></Modal.Body><Modal.Footer><button type="button" className="btn btn-outline-secondary" onClick={() => setConfirm(false)}>Quay lại sửa</button><Action onClick={async () => { await run({ type: "person", person: draft, expected: baseline }); setBaseline(draft); setConfirm(false); setSaved(true); }}>Xác nhận</Action></Modal.Footer></Modal>
  </>;
}
function SettingsInner() {
  const { state, run, live } = useDemo();
  const [params, setParams] = useSearchParams();
  const [taxonomyRevision, setTaxonomyRevision] = useState(state.catalogRevisions?.["taxonomy:default"]);
  const sections = [["people", "Người dùng"], ["sources", "Quyền nguồn"], ["catalog", "Vùng & chủ đề"], ["tasks", "Nhiệm vụ góp từ"]];
  const section = sections.some(([key]) => key === params.get("section")) ? params.get("section")! : "people";
  const [regions, setRegions] = useState(state.regions.join("\n"));
  const [topics, setTopics] = useState(state.topics.join("\n"));
  const [source, setSource] = useState<Source>({
    id: uid(),
    title: "",
    evidence: "",
    train: false,
    public: false,
    audio: false,
    demo: true,
  });
  const [task, setTask] = useState<Task>({
    id: uid(),
    title: "",
    method: METHODS[0],
    prompt: "",
    region: state.regions[0],
    topic: state.topics[0],
    mediaId: null,
    active: true,
  });
  const [query, setQuery] = useState("");
  const [sourceConfirm, setSourceConfirm] = useState(false);
  return (
    <>
      <Heading title={section === "sources" ? "Nguồn" : "Cài đặt"} />
      {section !== "sources" && <nav className="admin-settings-tabs" aria-label="Mục quản lý">{sections.filter(([key]) => key !== "sources" && key !== "tasks").map(([key, label]) => <button type="button" key={key} aria-pressed={section === key} onClick={() => setParams(previous => { const next = new URLSearchParams(previous); next.set("section", key); return next; })}>{label}</button>)}</nav>}
      <div className="admin-settings-content">
        {section === "catalog" && <Panel title="Vùng sử dụng & chủ đề">
          <Field label="Vùng / tên lịch sử (mỗi dòng một vùng)">
            <textarea
              value={regions}
              rows={5}
              onChange={(e) => setRegions(e.target.value)}
            />
          </Field>
          <Field label="Chủ đề">
            <textarea
              value={topics}
              rows={5}
              onChange={(e) => setTopics(e.target.value)}
            />
          </Field>
          <Action
            onClick={async () => {
              const next = await run({
                type: "taxonomy",
                expectedRevision: taxonomyRevision,
                regions: regions.split("\n").map((v) => v.trim()),
                topics: topics.split("\n").map((v) => v.trim()),
              });
              setTaxonomyRevision(next.catalogRevisions?.["taxonomy:default"]);
            }}
          >
            Lưu vùng và chủ đề
          </Action>
        </Panel>}
        {section === "sources" && <Panel title="Nguồn">
          <Field label="Chọn nguồn">
            <select
              value={source.id}
              onChange={(e) => {
                const s = state.sources.find((s) => s.id === e.target.value);
                if (s) setSource(s);
              }}
            >
              <option value={source.id}>Nguồn đang sửa / mới</option>
              {state.sources.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tên nguồn">
            <input
              value={source.title}
              onChange={(e) => setSource({ ...source, title: e.target.value })}
            />
          </Field>
          <Field label="Chứng cứ / tác giả / URL / vị trí trích">
            <textarea
              readOnly={live && source.id.startsWith("s:")}
              value={source.evidence}
              onChange={(e) =>
                setSource({ ...source, evidence: e.target.value })
              }
            />
          </Field>
          {(["train", "public"] as const).map((k) => (
            <label className="demo-checkbox" key={k}>
              <input
                type="checkbox"
                checked={source[k]}
                onChange={(e) =>
                  setSource({ ...source, [k]: e.target.checked })
                }
              />
              {live ? `Có quyền ${RIGHT_LABEL[k]}` : `Đủ quyền ${RIGHT_LABEL[k]} trong bản minh họa`}
            </label>
          ))}
          <Action
            disabled={!source.title.trim() || !source.evidence.trim()}
            onClick={() => setSourceConfirm(true)}
          >
            Lưu
          </Action>
          <Action
            onClick={() =>
              setSource({
                id: uid(),
                title: "",
                evidence: "",
                train: false,
                public: false,
                audio: false,
                demo: true,
              })
            }
          >
            Nguồn mới
          </Action>
          <details>
            <summary>Mẫu liên quan</summary>
            {state.contributions
              .filter((c) => c.sourceId === source.id)
              .map((c) => (
                <p key={c.id}>
                  {c.id} · {c.raw.text}
                </p>
              ))}
          </details>
        </Panel>}
      </div>
      {section === "people" && <Panel title="Người dùng">
        <p className="demo-note">Đổi vai trò, bấm Lưu rồi xác nhận.</p>
        <Field label="Tìm người">
          <input value={query} onChange={(e) => setQuery(e.target.value)} />
        </Field>
        <ResponsiveTable>
          <table>
            <thead>
              <tr>
                <th>Người</th>
                <th>Vai trò</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {state.people
                .filter((p) =>
                  (!live || /^account:\d+$/.test(p.id)) && p.name.toLowerCase().includes(query.toLowerCase()),
                )
                .map((p) => <ParticipantRow key={p.id} person={p} />)}
            </tbody>
          </table>
        </ResponsiveTable>
        <p className="demo-note">
          {live
            ? "Reviewer có quyền duyệt và quản lý."
            : "Mô phỏng giao diện. Không thay quyền hoặc xác minh tài khoản thật."}
        </p>
      </Panel>}
      {section === "tasks" && <Panel title="Nhiệm vụ góp từ">
        <Field label="Nhiệm vụ đang sửa">
          <select
            value={task.id}
            onChange={(e) => {
              const t = state.tasks.find((t) => t.id === e.target.value);
              if (t) setTask(t);
            }}
          >
            <option value={task.id}>Mới / đang sửa</option>
            {state.tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </Field>
        <div className="demo-form-grid">
          <Field label="Tên nhiệm vụ">
            <input
              value={task.title}
              onChange={(e) => setTask({ ...task, title: e.target.value })}
            />
          </Field>
          <Field label="Phương thức">
            <select
              value={task.method}
              onChange={(e) => setTask({ ...task, method: e.target.value })}
            >
              {METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
          <Field label="Vùng">
            <select
              value={task.region}
              onChange={(e) => setTask({ ...task, region: e.target.value })}
            >
              {task.region && !state.regions.includes(task.region) && <option value={task.region}>{task.region}</option>}
                {state.regions.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="Chủ đề">
            <select
              value={task.topic}
              onChange={(e) => setTask({ ...task, topic: e.target.value })}
            >
              {state.topics.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Nội dung hướng dẫn người góp">
          <textarea
            value={task.prompt}
            onChange={(e) => setTask({ ...task, prompt: e.target.value })}
          />
        </Field>
        {!live && <MediaAttach
          ids={task.mediaId ? [task.mediaId] : []}
          audioAllowed={true}
          onChange={(ids) => setTask({ ...task, mediaId: ids.at(-1) ?? null })}
        />}
        <label className="demo-checkbox">
          <input
            type="checkbox"
            checked={task.active}
            onChange={(e) => setTask({ ...task, active: e.target.checked })}
          />
          Đang mở
        </label>
        <div className="demo-actions">
          <Action
            disabled={!task.title.trim() || !task.prompt.trim()}
            onClick={async () => { const next = await run({ type: "task", task }); const saved = next.tasks.find(item => item.id === task.id); if (saved) setTask(saved); }}
          >
            Lưu nhiệm vụ
          </Action>
          <Action onClick={() => setTask({ ...task, id: uid(), serverRevision: undefined, title: "" })}>
            Nhiệm vụ mới
          </Action>
        </div>
      </Panel>}
      <Modal aria-label="Xác nhận quyền sử dụng nguồn" centered show={sourceConfirm} onHide={() => setSourceConfirm(false)}><Modal.Header closeLabel="Đóng" closeButton><Modal.Title>Xác nhận quyền sử dụng nguồn</Modal.Title></Modal.Header><Modal.Body><p>Nguồn: {source.title}</p><p>Huấn luyện: {source.train ? "Có quyền" : "Chưa xác nhận"} · Công khai: {source.public ? "Có quyền" : "Chưa xác nhận"}</p><p>Việc thu hẹp quyền sẽ ảnh hưởng đến các mẫu và bản xuất liên quan.</p></Modal.Body><Modal.Footer><button type="button" className="btn btn-outline-secondary" onClick={() => setSourceConfirm(false)}>Quay lại kiểm tra</button><Action onClick={async () => { const next = await run({ type: "source", source }); const saved = next.sources.find(item => item.id === source.id); if (saved) setSource(saved); setSourceConfirm(false); }}>Xác nhận lưu quyền nguồn</Action></Modal.Footer></Modal>
    </>
  );
}
