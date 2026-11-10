import { errorMessage } from "../../api/client";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useDemo } from "./context";
import { examErrors, uid, isRepeatSession } from "./domain";
import { verificationLabel } from "./datasetBank";
import { examKinds, QUESTION_KINDS, SOURCED_KINDS } from "./seed";
import { Action, DemoGuard, Field, Heading, Panel, Status } from "./ui";
import { AnswerTable } from "./GamePages";
import type { Exam, Question } from "./types";
import { formatLabels } from "./questionFormats";
import { isTestSession } from "./testSessions";

export function QuestionBank() {
  return (
    <DemoGuard>
      <QuestionBankInner />
    </DemoGuard>
  );
}
function QuestionBankInner() {
  const { state } = useDemo();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Question | null>(null);
  const fresh = (): Question => ({
    id: uid(),
    version: 1,
    kind: "GATE",
    prompt: "",
    accepted: [],
    region: state.regions[0],
    topic: state.topics[0],
    sourceId: state.sources[0]?.id ?? "",
    approval: "DRAFT",
    demo: true,
    difficulty: 1,
  });
  return (
    <>
      <Heading title="Ngân hàng câu hỏi & hiệu chỉnh">
        <p>
          Câu demo không trở thành gold thu thật chỉ vì được duyệt trong bản xem
          trước.
        </p>
      </Heading>
      <div className="demo-actions">
        <Action onClick={() => setEditing(fresh())}>Tạo câu hỏi</Action>
        <Field label="Tìm câu hỏi">
          <input value={query} onChange={(e) => setQuery(e.target.value)} />
        </Field>
      </div>
      <div className="demo-two-col">
        <Panel title="Các phiên bản câu hỏi">
          {state.questions
            .filter((q) => q.prompt.toLowerCase().includes(query.toLowerCase()))
            .map((q) => (
              <div key={q.id} className="demo-list-row">
                <div>
                  <strong>
                    {q.kind} · v{q.version}
                  </strong>
                  <p>{q.prompt}</p>
                  <small>
                    {q.approval} · {q.demo ? "DEMO" : "Thu thật"} · {q.region}
                  </small>
                </div>
                <Action onClick={() => setEditing(q)}>Xem / sửa</Action>
                <Action
                  onClick={() =>
                    setEditing({
                      ...q,
                      id: uid(),
                      version: q.version + 1,
                      approval: "DRAFT",
                    })
                  }
                >
                  Nhân bản
                </Action>
              </div>
            ))}
        </Panel>
        {editing ? (
          <QuestionEditor
            key={editing.id}
            question={editing}
            done={() => setEditing(null)}
          />
        ) : (
          <Panel title="Chọn câu để xem hoặc tạo mới">
            <p>
              Câu đã nằm trong đề phát hành chỉ được nhân bản, không ghi đè.
            </p>
          </Panel>
        )}
      </div>
    </>
  );
}
function QuestionEditor({
  question,
  done,
}: {
  question: Question;
  done: () => void;
}) {
  const { state, run } = useDemo();
  const [q, setQ] = useState(question);
  const [accepted, setAccepted] = useState(q.accepted.join("\n"));
  const [error, setError] = useState("");
  const locked = state.exams.some(
    (e) => e.status !== "draft" && e.questionIds.includes(q.id),
  );
  return (
    <Panel title={`Câu ${q.id.slice(0, 12)} · v${q.version}`}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await run({
              type: "question",
              question: {
                ...q,
                accepted: accepted
                  .split("\n")
                  .map((x) => x.trim())
                  .filter(Boolean),
                demo: true,
              },
            });
            done();
          } catch (err) {
            setError(errorMessage(err));
          }
        }}
      >
        <fieldset disabled={locked}>
          <Field label="Dạng trả lời">
            <select value={q.format ?? "legacy"} onChange={(e) => setQ({ ...q, format: e.target.value === "legacy" ? undefined : e.target.value as Question["format"] })}>
              <option value="legacy">Văn bản (câu cũ)</option>
              {Object.entries(formatLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          {q.format === "choice" && <fieldset>
            <legend>Bốn phương án · chọn một đáp án đúng</legend>
            {Array.from({ length: 4 }, (_, i) => {
              const option = q.options?.[i] ?? { id: `${q.id}-o${i + 1}`, text: "" };
              return <div key={i} className="demo-form-grid">
                <Field label={`Phương án ${i + 1}`}><input value={option.text} onChange={(e) => {
                  const options = Array.from({ length: 4 }, (_, n) => q.options?.[n] ?? { id: `${q.id}-o${n + 1}`, text: "" });
                  options[i] = { ...option, text: e.target.value }; setQ({ ...q, options });
                }} /></Field>
                <label className="demo-checkbox"><input type="radio" name="correct-option" checked={q.correctOptionId === option.id} onChange={() => setQ({ ...q, correctOptionId: option.id })} />Đáp án đúng: phương án {i + 1}</label>
              </div>;
            })}
          </fieldset>}
          {q.format === "fill" && <Field label="Câu có một chỗ trống (___)"><textarea value={q.blankTemplate ?? ""} onChange={(e) => setQ({ ...q, blankTemplate: e.target.value })} /></Field>}
          <Field label="Loại câu">
            <select
              value={q.kind}
              onChange={(e) =>
                setQ({ ...q, kind: e.target.value as Question["kind"] })
              }
            >
              {[...new Set([...QUESTION_KINDS, ...SOURCED_KINDS])].map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </Field>
          <Field label="Nội dung câu hỏi">
            <textarea
              rows={4}
              value={q.prompt}
              required
              maxLength={5000}
              onChange={(e) => setQ({ ...q, prompt: e.target.value })}
            />
          </Field>
          <Field label="Đáp án / biến thể (mỗi dòng một đáp án)">
            <textarea
              rows={4}
              value={accepted}
              onChange={(e) => setAccepted(e.target.value)}
            />
          </Field>
          <div className="demo-form-grid">
            <Field label="Vùng">
              <select
                value={q.region}
                onChange={(e) => setQ({ ...q, region: e.target.value })}
              >
                {state.regions.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Chủ đề">
              <select
                value={q.topic}
                onChange={(e) => setQ({ ...q, topic: e.target.value })}
              >
                {state.topics.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Nguồn">
              <select
                value={q.sourceId}
                onChange={(e) => setQ({ ...q, sourceId: e.target.value })}
              >
                {state.sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Duyệt trong demo">
              <select
                value={q.approval}
                onChange={(e) =>
                  setQ({
                    ...q,
                    approval: e.target.value as Question["approval"],
                  })
                }
              >
                <option value="DRAFT">Chờ duyệt</option>
                <option value="DEMO_APPROVED">Được dùng trong demo</option>
              </select>
            </Field>
            <Field label="Độ khó đề xuất">
              <select
                value={q.difficulty}
                onChange={(e) =>
                  setQ({ ...q, difficulty: Number(e.target.value) })
                }
              >
                <option value={1}>Cơ bản</option>
                <option value={2}>Nâng cao</option>
                <option value={3}>Chuyên sâu</option>
              </select>
            </Field>
          </div>
          {error && (
            <p role="alert" className="demo-error">
              {error}
            </p>
          )}
          <button className="btn btn-primary">Lưu câu hỏi</button>
        </fieldset>
        {locked && (
          <p className="demo-note">
            Đã phát hành. Dùng nút Nhân bản trong danh sách để sửa thành phiên
            bản mới.
          </p>
        )}
      </form>
      <section className="demo-panel" aria-label="Xem trước câu hỏi">
        <h3>Xem trước · {q.format ? formatLabels[q.format] : "Văn bản"}</h3>
        <p>{q.prompt}</p>
        {q.blankTemplate && q.format === "fill" && <p className="demo-blank-template">{q.blankTemplate}</p>}
        {q.format === "choice" ? <fieldset className="demo-choice-list"><legend>Chọn một đáp án</legend>{q.options?.map((o) => <label key={o.id} className="demo-choice"><input type="radio" name="preview-choice" /><span>{o.text}</span></label>)}</fieldset> : <Field label="Đáp án xem trước">{q.format === "short" || q.format === "fill" ? <input /> : <textarea />}</Field>}
        {q.provenance && <p className="demo-note">{q.provenance.sheet} · {q.provenance.rowId} · {q.provenance.sense} · {verificationLabel[q.provenance.verification]} · Câu biên soạn. <a href={q.provenance.url} target="_blank" rel="noreferrer">Xem nguồn dataset</a></p>}
      </section>
      <details>
        <summary>Lịch sử câu này</summary>
        {state.events
          .filter((e) => e.entity === q.id)
          .map((e) => (
            <p key={e.id}>
              {e.at} · {e.actor} · {e.note}
            </p>
          ))}
      </details>
    </Panel>
  );
}

export function ExamAdmin() {
  return (
    <DemoGuard>
      <ExamAdminInner />
    </DemoGuard>
  );
}
function ExamAdminInner() {
  const { state, run } = useDemo();
  const [editing, setEditing] = useState<Exam | null>(null);
  const fresh = (): Exam => ({
    id: uid(),
    title: "Bộ đề mới",
    version: 1,
    questionIds: Array(10).fill(""),
    mode: "signal",
    status: "draft",
    demo: true,
    adaptive: false,
    region: state.regions[0],
    topic: state.topics[0],
  });
  return (
    <>
      <Heading title="Đề 10 câu & điều kiện phát hành">
        <p>
          Mỗi vị trí đúng loại. Phiên đang chơi luôn dùng snapshot của đề lúc
          bắt đầu.
        </p>
      </Heading>
      <Action onClick={() => setEditing(fresh())}>Tạo bộ đề 10 câu</Action>
      <div className="demo-two-col">
        <Panel title="Bộ đề">
          {state.exams.map((e) => (
            <div className="demo-contribution" key={e.id}>
              <h3>
                {e.title} · v{e.version}
              </h3>
              <Status value={e.status} />
              <p>
                {e.mode === "strict" ? "Khóa 3/3" : "Tín hiệu chất lượng"} ·{" "}
                {e.demo ? "DEMO" : "Thu thật"}
              </p>
              <div className="demo-actions">
                <Action onClick={() => setEditing(e)}>Xem / cấu hình</Action>
                <Action
                  onClick={() =>
                    setEditing({
                      ...e,
                      id: uid(),
                      version: e.version + 1,
                      title: `${e.title} · bản mới`,
                      status: "draft",
                    })
                  }
                >
                  Tạo phiên bản mới
                </Action>
                {e.status === "active" && (
                  <>
                    <Link
                      className="btn btn-outline-primary"
                      to={`/demo/play?exam=${e.id}`}
                    >
                      Chơi / xem trước
                    </Link>
                    <Action
                      onClick={() => run({ type: "closeExam", id: e.id })}
                    >
                      Tắt đề
                    </Action>
                  </>
                )}
                {e.status === "draft" && (
                  <>
                    <Action
                      onClick={() =>
                        run({ type: "publish", id: e.id, real: false })
                      }
                    >
                      Phát hành DEMO
                    </Action>
                    <Action
                      onClick={() =>
                        run({ type: "publish", id: e.id, real: true })
                      }
                    >
                      Kiểm tra & mở thu thật
                    </Action>
                    <Action
                      onClick={async () => {
                        const copy = {
                          ...e,
                          id: uid(),
                          title: `Xem trước · ${e.title}`,
                          status: "draft" as const,
                        };
                        await run({ type: "exam", exam: copy });
                        await run({
                          type: "publish",
                          id: copy.id,
                          real: false,
                        });
                        setEditing(copy);
                      }}
                    >
                      Tạo đề xem trước
                    </Action>
                  </>
                )}
              </div>
              <details>
                <summary>Điều kiện còn thiếu cho thu thật</summary>
                <ul>
                  {examErrors(state, e, true).map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </details>
            </div>
          ))}
        </Panel>
        {editing ? (
          <ExamEditor
            key={editing.id}
            exam={editing}
            done={() => setEditing(null)}
          />
        ) : (
          <Panel title="Cấu trúc đề">
            <p>
              Đề thường: Q01–03 GATE; Q04–05 LEXEME; Q06 GOLD; Q07 SENTENCE; Q08 GOLD; Q09
              OPEN_WORD; Q10 OPEN_SENTENCE.
            </p>
            <p>
              Kho Dataset1: Q01–02 GATE lấy từ mục đã đối chiếu nguồn (chấm điểm, mỗi lượt rút câu khác);
              Q03–05 và Q08 LEXEME, Q06–07 SENTENCE, Q09 OPEN_WORD, Q10 OPEN_SENTENCE lấy từ mục chưa kiểm
              chứng để người chơi xác nhận hoặc sửa.
            </p>
          </Panel>
        )}
      </div>
    </>
  );
}
function ExamEditor({ exam, done }: { exam: Exam; done: () => void }) {
  const { state, run } = useDemo();
  const [e, setE] = useState(exam);
  const [error, setError] = useState("");
  const locked = state.exams.some((x) => x.id === e.id && x.status !== "draft");
  return (
    <Panel title={`Cấu hình v${e.version}`}>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            await run({ type: "exam", exam: e });
            done();
          } catch (err) {
            setError(errorMessage(err));
          }
        }}
      >
        <fieldset disabled={locked}>
          <Field label="Tên bộ đề">
            <input
              value={e.title}
              required
              onChange={(event) => setE({ ...e, title: event.target.value })}
            />
          </Field>
          <Field label="Q01–Q03">
            <select
              value={e.mode}
              onChange={(event) =>
                setE({ ...e, mode: event.target.value as Exam["mode"] })
              }
            >
              <option value="signal">Chỉ tín hiệu chất lượng</option>
              <option value="strict">Đạt 3/3 để đi tiếp</option>
            </select>
          </Field>
          <label className="demo-checkbox">
            <input
              type="checkbox"
              checked={e.adaptive}
              onChange={(event) =>
                setE({ ...e, adaptive: event.target.checked })
              }
            />
            Cho phép chọn câu thích ứng theo lịch sử demo
          </label>
          <div className="demo-form-grid">
            <Field label="Vùng mục tiêu">
              <select
                value={e.region}
                onChange={(event) => setE({ ...e, region: event.target.value })}
              >
                {state.regions.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Chủ đề">
              <select
                value={e.topic}
                onChange={(event) => setE({ ...e, topic: event.target.value })}
              >
                {state.topics.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
          </div>
          {examKinds(e).map((kind, i) => (
            <Field
              key={i}
              label={`Q${String(i + 1).padStart(2, "0")} · ${kind}`}
            >
              <select
                value={e.questionIds[i] ?? ""}
                onChange={(event) =>
                  setE({
                    ...e,
                    questionIds: e.questionIds.map((id, n) =>
                      n === i ? event.target.value : id,
                    ),
                  })
                }
              >
                <option value="">Chọn câu hỏi</option>
                {state.questions
                  .filter((q) => q.kind === kind)
                  .map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.prompt} · v{q.version}
                    </option>
                  ))}
              </select>
            </Field>
          ))}
          {error && (
            <p role="alert" className="demo-error">
              {error}
            </p>
          )}
          <button className="btn btn-primary">Lưu đề nháp</button>
        </fieldset>
      </form>
      <ul>
        {examErrors(state, e).map((message, i) => (
          <li key={i}>{message}</li>
        ))}
      </ul>
      {locked && <p>Đề đã phát hành. Tạo phiên bản mới để thay đổi.</p>}
    </Panel>
  );
}

export function SessionAdmin() {
  return (
    <DemoGuard>
      <SessionAdminInner />
    </DemoGuard>
  );
}
function SessionAdminInner() {
  const { state } = useDemo();
  const { id } = useParams();
  const [filter, setFilter] = useState("");
  const [repeatFilter, setRepeatFilter] = useState("");
  const [query, setQuery] = useState("");
  const selected = state.sessions.find((s) => s.id === id);
  return (
    <>
      <Heading title="Lượt chơi & từng câu trả lời">
        <p>Đối chiếu mã lượt, version đề, lần thử và nội dung RAW.</p>
      </Heading>
      {selected ? (
        <Panel title={`${selected.exam.title} · ${selected.id}`}>
          <Status value={selected.state} />
          {isTestSession(selected) && <p>Phiên kiểm tra giao diện · không tính là lượt người tham gia</p>}
          <p>{isRepeatSession(state, selected) ? "Lượt lặp" : "Lượt đầu"}</p>
          {state.contributions.filter((c) => c.sessionId === selected.id && c.duplicateOf).map((c) => <p key={c.id}>Mẫu {c.id} trùng {c.duplicateOf} · giữ RAW riêng, không vào hàng chờ mới.</p>)}
          <p>
            Người tham gia: {selected.owner} · Bắt đầu: {selected.createdAt} ·
            Gửi: {selected.submittedAt ?? "Chưa gửi"}
          </p>
          <p>
            Hiện sống: {selected.region} · Lớn lên: {selected.upbringing} · Dùng
            phương ngữ: {selected.usage}
          </p>
          <AnswerTable session={selected} showQuality />
          <Link to="/demo/admin/sessions">Về danh sách lượt</Link>
        </Panel>
      ) : (
        <Panel>
          <div className="demo-filters">
            <Field label="Trạng thái">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="">Tất cả</option>
                <option value="playing">Đang làm</option>
                <option value="submitted">Đã gửi</option>
                <option value="withdrawn">Đã rút</option>
              </select>
            </Field>
            <Field label="Tìm mã/vùng/bộ đề">
              <input value={query} onChange={(e) => setQuery(e.target.value)} />
            </Field>
            <Field label="Loại lượt">
              <select value={repeatFilter} onChange={(e) => setRepeatFilter(e.target.value)}><option value="">Tất cả lượt</option><option value="first">Lượt đầu</option><option value="repeat">Lượt lặp</option></select>
            </Field>
          </div>
          {state.sessions
            .filter(
              (s) =>
                (!filter || s.state === filter) &&
                (!repeatFilter || isRepeatSession(state, s) === (repeatFilter === "repeat")) &&
                `${s.id} ${s.region} ${s.exam.title}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
            )
            .map((s) => (
              <Link
                className="demo-row-link"
                key={s.id}
                to={`/demo/admin/sessions/${s.id}`}
              >
                <div>
                  <strong>{s.exam.title}</strong>
                  {isTestSession(s) && <small>Phiên kiểm tra giao diện</small>}
                  <small>{isRepeatSession(state, s) ? "Lượt lặp" : "Lượt đầu"}</small>
                  <small>
                    {s.id} · {s.owner} · {s.region || "Chưa khai vùng"}
                  </small>
                </div>
                <Status value={s.state} />
              </Link>
            ))}
          {!state.sessions.length && (
            <p>Chưa có lượt. Mở Chơi game 10 câu để tạo một phiên ẩn danh.</p>
          )}
        </Panel>
      )}
    </>
  );
}
