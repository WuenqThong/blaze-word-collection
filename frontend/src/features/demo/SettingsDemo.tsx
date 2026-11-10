import { useState } from "react";
import { useDemo } from "./context";
import { uid } from "./domain";
import { METHODS } from "./seed";
import { Action, DemoGuard, Field, Heading, Panel } from "./ui";
import type { Source, Task } from "./types";
import { MediaAttach } from "./ContributionDemo";

const RIGHT_LABEL = { train: "dùng để huấn luyện", public: "công khai", audio: "dùng âm thanh" } as const;

export function SettingsDemo() {
  return (
    <DemoGuard>
      <SettingsInner />
    </DemoGuard>
  );
}
function SettingsInner() {
  const { state, run, live } = useDemo();
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
  return (
    <>
      <Heading title="Vùng, chủ đề, nguồn và người tham gia" />
      <div className="demo-two-col">
        <Panel title="Taxonomy tự khai">
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
            onClick={() =>
              run({
                type: "taxonomy",
                regions: regions.split("\n").map((v) => v.trim()),
                topics: topics.split("\n").map((v) => v.trim()),
              })
            }
          >
            Lưu vùng và chủ đề
          </Action>
        </Panel>
        <Panel title="Nguồn & quyền theo mục đích">
          <Field label="Chọn nguồn để sửa">
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
              value={source.evidence}
              onChange={(e) =>
                setSource({ ...source, evidence: e.target.value })
              }
            />
          </Field>
          {(["train", "public", "audio"] as const).map((k) => (
            <label className="demo-checkbox" key={k}>
              <input
                type="checkbox"
                checked={source[k]}
                onChange={(e) =>
                  setSource({ ...source, [k]: e.target.checked })
                }
              />
              {live ? `Có quyền ${RIGHT_LABEL[k]}` : `Đủ quyền ${k} trong DEMO`}
            </label>
          ))}
          <Action
            disabled={!source.title.trim() || !source.evidence.trim()}
            onClick={() => run({ type: "source", source })}
          >
            Lưu quyền nguồn
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
        </Panel>
      </div>
      <Panel title="Vai trò / vùng reviewer / xác nhận tài khoản">
        <Field label="Tìm người">
          <input value={query} onChange={(e) => setQuery(e.target.value)} />
        </Field>
        <div className="demo-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Người</th>
                <th>Vai trò</th>
                <th>Vùng chuyên môn</th>
                <th>Xác nhận / rủi ro</th>
              </tr>
            </thead>
            <tbody>
              {state.people
                .filter((p) =>
                  p.name.toLowerCase().includes(query.toLowerCase()),
                )
                .map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.name}
                      <small>{p.id}</small>
                    </td>
                    <td>
                      <select
                        aria-label={`Vai trò ${p.name}`}
                        value={p.role}
                        disabled={p.id === "admin" || p.id === "guest" || (live && p.role === "admin")}
                        onChange={(e) =>
                          void run({
                            type: "person",
                            person: {
                              ...p,
                              role: e.target.value as typeof p.role,
                            },
                          }).catch(() => {})
                        }
                      >
                        <option value="guest" disabled={live}>Ẩn danh</option>
                        <option value="contributor">Người góp</option>
                        <option value="reviewer">Reviewer</option>
                        <option value="admin" disabled={live && p.role !== "admin"}>Admin</option>
                      </select>
                    </td>
                    <td>
                      <select
                        aria-label={`Vùng ${p.name}`}
                        value={p.region}
                        onChange={(e) =>
                          void run({
                            type: "person",
                            person: { ...p, region: e.target.value },
                          }).catch(() => {})
                        }
                      >
                        {state.regions.map((v) => (
                          <option key={v}>{v}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <label className="demo-checkbox">
                        <input
                          type="checkbox"
                          checked={p.verified}
                          onChange={(e) =>
                            void run({
                              type: "person",
                              person: { ...p, verified: e.target.checked },
                            }).catch(() => {})
                          }
                        />
                        {live ? "Đã xác nhận tài khoản" : "Đã xác nhận demo"}
                      </label>
                      <select
                        aria-label={`Rủi ro ${p.name}`}
                        value={p.risk}
                        onChange={(e) =>
                          void run({
                            type: "person",
                            person: {
                              ...p,
                              risk: e.target.value as typeof p.risk,
                            },
                          }).catch(() => {})
                        }
                      >
                        <option value="clear">Đã rà soát / bình thường</option>
                        <option value="hold">Tạm giữ kiểm tra</option>
                      </select>
                      {p.appeal && <p>Khiếu nại: {p.appeal}</p>}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <p className="demo-note">
          {live
            ? "Lưu trên máy chủ: vai trò Người góp/Reviewer, vùng chuyên môn (reviewer chỉ duyệt mẫu trong vùng này), xác nhận và rủi ro. Quyền admin chỉ cấp ở máy chủ."
            : "Mô phỏng frontend. Không thay quyền hoặc xác minh tài khoản thật."}
        </p>
      </Panel>
      <Panel title="Tạo / cấu hình nhiệm vụ khơi từ">
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
        <Field label="Prompt nhiệm vụ">
          <textarea
            value={task.prompt}
            onChange={(e) => setTask({ ...task, prompt: e.target.value })}
          />
        </Field>
        <MediaAttach
          ids={task.mediaId ? [task.mediaId] : []}
          audioAllowed={true}
          onChange={(ids) => setTask({ ...task, mediaId: ids.at(-1) ?? null })}
        />
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
            onClick={() => run({ type: "task", task })}
          >
            Lưu nhiệm vụ
          </Action>
          <Action onClick={() => setTask({ ...task, id: uid(), title: "" })}>
            Nhiệm vụ mới
          </Action>
        </div>
      </Panel>
    </>
  );
}
