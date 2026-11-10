import { useEffect, useState } from "react";
import {
  Link,
  useBlocker,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { Modal } from "react-bootstrap";
import { errorMessage } from "../../api/client";
import { useDemo } from "./context";
import { blankAnswer, canAdvance, isAnswered, uid, gameAllocation } from "./domain";
import { consentDefault } from "./seed";
import { Action, Field, Heading, Panel, Status } from "./ui";
import type { Answer, Consent, Session } from "./types";
import { formatLabels } from "./questionFormats";
import { verificationLabel } from "./datasetBank";
import { REGION_CHOICES } from "./regions";
import { RegionOptions } from "./RegionOptions";

export function ConsentFields({
  value,
  onChange,
}: {
  value: Consent;
  onChange: (value: Consent) => void;
}) {
  return (
    <fieldset className="demo-consents">
      <legend>Phạm vi bạn đồng ý</legend>
      {(
        [
          ["collect", "Tiếp nhận & kiểm duyệt (bắt buộc)"],
          ["train", "Cho phép sử dụng dữ liệu để huấn luyện "],
          ["public", "Cho phép công khai dữ liệu"],
        ] as const
      ).map(([k, label]) => (
        <label key={k}>
          <input
            type="checkbox"
            checked={value[k]}
            onChange={(e) => onChange({ ...value, [k]: e.target.checked })}
          />
          {label}
        </label>
      ))}
    </fieldset>
  );
}

export function StartGame() {
  const { state, run } = useDemo();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [consent, setConsent] = useState(consentDefault);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const campaign = state.campaigns.find((c) => c.id === params.get("campaign"));
  const allocation = gameAllocationSafe();
  function gameAllocationSafe() {
    try { return gameAllocation(state, state.actor, params.get("campaign") ?? ""); }
    catch { return { pending: undefined, exam: undefined, repeat: false }; }
  }
  const selected = allocation.exam;
  const pending = allocation.pending;
  return (
    <>
      <Heading title="Mười câu hỏi, một chút tiếng quê.">
      </Heading>
      <div className="demo-game-start">
        <Panel title={campaign?.title ?? "Bắt đầu lượt chơi "}>
          {pending && <p className="demo-note">Bạn có một lượt chưa hoàn thành. Bấm tiếp tục để quay lại câu đang làm.</p>}
          <p>
            {selected?.layout === "sourced2"
              ? "Câu 1–2: Làm quen với từ đã có nguồn · Câu 3–8: Xác nhận hoặc sửa từ, câu chưa kiểm chứng · Câu 9–10: Đóng góp từ và câu mới."
              : "Câu 1–3: Làm quen · Câu 4–5: Giải thích ý nghĩa từ ngữ · Câu 6 và 8: Kiểm tra kiến thức · Câu 7: Diễn đạt bằng tiếng phổ thông · Câu 9–10: Đóng góp từ và câu mới."}
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              if (pending) { navigate(`/demo/game/${pending.id}`); return; }
              if (!selected) {
                setError("Chưa có bộ đề đang mở để bắt đầu lượt chơi.");
                return;
              }
              if (!consent.collect) {
                setError("Hãy tích chọn ‘Tiếp nhận & kiểm duyệt (bắt buộc)’ để bắt đầu chơi 10 câu.");
                return;
              }
              if (campaign && !campaign.active) {
                setError("Chiến dịch đã tắt.");
                return;
              }
              const id = uid();
              setStarting(true);
              try {
                const result = await run({
                  type: "autoStart",
                  id,
                  consent,
                  campaignId: campaign?.id ?? "",
                });
                const active = result.sessions.find((x) => x.id === id) ?? result.sessions.find((x) => x.owner === result.actor && x.state === "playing" && (!campaign || x.campaignId === campaign.id));
                if (!active) throw Error("Chưa mở được lượt chơi. Vui lòng thử lại.");
                navigate(`/demo/game/${active.id}`);
              } catch (err) {
                setError(errorMessage(err));
              } finally {
                setStarting(false);
              }
            }}
          >
                        {!selected && !pending && (
              <p role="alert">
                Chưa có đề đang mở. Điều phối viên có thể tạo và phát hành đề
                demo.
              </p>
            )}
            {!pending && <ConsentFields value={consent} onChange={setConsent} />}
            {!pending && !consent.collect && !!selected && (
              <p className="demo-note" id="demo-consent-hint">
                Để bắt đầu, hãy tích ô “Tiếp nhận & kiểm duyệt (bắt buộc)” phía trên.
              </p>
            )}
            {error && (
              <p className="demo-error" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={(!pending && !selected) || starting}
              aria-describedby={!pending && !consent.collect && selected ? "demo-consent-hint" : undefined}
            >
              {starting ? "Đang tạo phiên…" : pending ? "Tiếp tục chơi" : "Bắt đầu chơi"}{" "}
              <i className="bi bi-arrow-right" aria-hidden="true" />
            </button>
          </form>
        </Panel>
      </div>
    </>
  );
}

export function GamePage() {
  const { id } = useParams();
  const { state } = useDemo();
  const session = state.sessions.find((x) => x.id === id);
  const actor = state.people.find((p) => p.id === state.actor)!;
  if (!session || (session.owner !== actor.id && actor.role !== "admin"))
    return (
      <Panel title="Không tìm thấy lượt thuộc vai trò này">
        <Link to="/demo/play">Về chọn đề</Link>
      </Panel>
    );
  return <GameSession key={session.id} session={session} />;
}
function GameSession({ session }: { session: Session }) {
  const { state, run } = useDemo();
  const actor = state.people.find((p) => p.id === state.actor)!;
  const [notice, setNotice] = useState("");
  const blocker = useBlocker(session.state === "playing");
  useEffect(() => {
    if (session.state !== "playing") return;
    const f = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [session.state]);
  if (session.state !== "playing")
    return (
      <>
        <Heading
          title={
            session.state === "withdrawn"
              ? "Lượt chơi đã rút"
              : "Cảm ơn bạn đã góp."
          }
        >
          <p>
            Mã lượt: <strong>{session.id}</strong> ·{" "}
            <Status value={session.state} />
          </p>
        </Heading>
          <AnswerTable session={session} />
          <div className="demo-actions">
            <Link className="btn btn-primary" to="/demo/history">
              Xem lịch sử và quản lý quyền
            </Link>
            {actor.role === "admin" && <Link
              className="btn btn-outline-primary"
              to={`/demo/admin/sessions/${session.id}`}
            >
              Xem trong quản trị
            </Link>}
            <Link className="btn btn-outline-primary" to="/demo/play">
              Chơi lượt khác
            </Link>
          </div>
      </>
    );
  return (
    <>
      <progress
        aria-label="Tiến trình 10 câu"
        max={10}
        value={session.answers.filter(isAnswered).length}
      />
      <nav className="demo-question-nav" aria-label="Chọn câu">
        {session.questions.map((q, i) => (
          <Action
            key={q.id}
            disabled={!canAdvance(session, i)}
            onClick={() =>
              run({ type: "moveSession", id: session.id, cursor: i })
            }
          >
            Q{String(i + 1).padStart(2, "0")}
            {session.answers[i].skipped
              ? " · bỏ qua"
              : isAnswered(session.answers[i])
                ? " ✓"
                : ""}
          </Action>
        ))}
      </nav>
      {notice && (
        <p className="demo-error" role="alert">
          {notice}
        </p>
      )}
      {session.cursor < 10 ? (
        <QuestionForm
          key={session.cursor}
          session={session}
          notify={setNotice}
        />
      ) : session.cursor === 10 ? (
        <MetadataForm session={session} />
      ) : (
        <Panel title="Xem lại trước khi gửi">
          <AnswerTable session={session} />
          <p>
            Hiện sống: {session.region} · Lớn lên: {session.upbringing}
          </p>
          <div className="demo-actions">
            <Action
              onClick={() =>
                run({ type: "moveSession", id: session.id, cursor: 10 })
              }
            >
              Sửa thông tin vùng
            </Action>
            <Action
              onClick={() =>
                run({
                  type: "submit",
                  id: session.id,
                  region: session.region,
                  upbringing: session.upbringing,
                  usage: session.usage,
                })
              }
            >
              Gửi kết quả 10 câu
            </Action>
          </div>
        </Panel>
      )}
      <Modal
        show={blocker.state === "blocked"}
        centered
        onHide={() => blocker.state === "blocked" && blocker.reset()}
      >
        <Modal.Header closeButton>
          <Modal.Title>Rời lượt chơi đang làm?</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Tiến độ đã lưu vẫn được giữ trên thiết bị. Nếu đang báo lỗi lưu, hãy ở
          lại và thử lại trước khi rời.
        </Modal.Body>
        <Modal.Footer>
          <button
            className="btn btn-outline-secondary"
            onClick={() => blocker.state === "blocked" && blocker.reset()}
          >
            Tiếp tục chơi
          </button>
          <button
            className="btn btn-primary"
            onClick={() => blocker.state === "blocked" && blocker.proceed()}
          >
            Rời trang
          </button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
function QuestionForm({
  session,
  notify,
}: {
  session: Session;
  notify: (s: string) => void;
}) {
  const { run } = useDemo();
  const index = session.cursor;
  const q = session.questions[index];
  const standardAnswer = q.format !== "choice";
  const [answer, setAnswer] = useState<Answer>(() =>
    structuredClone(session.answers[index] ?? blankAnswer()),
  );
  const [saving, setSaving] = useState(0);
  const [busy, setBusy] = useState(false);
  async function update(
    key: keyof Pick<
      Answer,
      "text" | "meaning" | "standard" | "context" | "suggestion"
    >,
    value: string,
  ) {
    const next = { ...answer, [key]: value, ...(standardAnswer && key === "standard" ? { text: value } : {}), skipped: false };
    setAnswer(next);
    setSaving((n) => n + 1);
    try {
      await run({ type: "draftAnswer", id: session.id, index, answer: next });
    } catch {
      /* visible global error */
    } finally {
      setSaving((n) => n - 1);
    }
  }
  async function choose(id: string) {
    const option = q.options?.find((o) => o.id === id);
    if (!option) return;
    const next = { ...answer, selectedOptionId: id, text: option.text, skipped: false };
    setAnswer(next); setSaving((n) => n + 1);
    try { await run({ type: "draftAnswer", id: session.id, index, answer: next }); }
    catch { /* Global save error remains visible. */ }
    finally { setSaving((n) => n - 1); }
  }
  async function next(skip = false) {
    notify("");
    if (!skip && !answer.text.trim()) {
      notify("Nhập đáp án hoặc chọn Bỏ qua.");
      return;
    }
    if (
      !skip &&
      index >= 8 &&
      ![answer.meaning, answer.standard, answer.context].every((v) => v.trim())
    ) {
      notify("Câu đóng góp mới cần nghĩa, bản phổ thông và ngữ cảnh.");
      return;
    }
    setBusy(true);
    try {
      const result = await run({
        type: "answer",
        id: session.id,
        index,
        answer: { ...answer, skipped: skip },
        next: index + 1,
      });
      const x = result.sessions.find((x) => x.id === session.id)!;
      if (x.cursor === index)
        notify(
          "Chưa đạt đủ 3/3 để mở Q04. Bạn có thể sửa ba câu đầu hoặc đề xuất biến thể; đáp án và lần thử đã được lưu.",
        );
      else notify("");
    } catch (e) {
      notify(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel title={`Q${String(index + 1).padStart(2, "0")} / 10`}>
      <p className="demo-question-text">{q.prompt}</p>
      {q.format && <p className="demo-note">{formatLabels[q.format]}</p>}
      {q.format === "fill" && <p className="demo-blank-template">{q.blankTemplate}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void next();
        }}
      >
        <fieldset disabled={busy}>
          {q.format === "choice" ? <fieldset className="demo-choice-list">
            <legend>Chọn một đáp án</legend>
            {q.options?.map((o) => <label key={o.id} className={`demo-choice ${answer.selectedOptionId === o.id ? "is-selected" : ""}`}>
              <input type="radio" name={`choice-${q.id}`} value={o.id} checked={answer.selectedOptionId === o.id} onChange={() => void choose(o.id)} />
              <span>{o.text}</span>
            </label>)}
          </fieldset> : <Field label="Cách nói phổ thông *">
            {q.format === "short" || q.format === "fill" ? <input type="text" value={answer.standard || answer.text} maxLength={5000} onChange={(e) => void update("standard", e.target.value)} /> :
            <textarea
              rows={3}
              value={answer.standard || answer.text}
              onChange={(e) => void update("standard", e.target.value)}
              maxLength={5000}
            />}
          </Field>}
          {!["GATE", "GOLD"].includes(q.kind) && (
            <>
              {(["meaning", "standard", "context"] as const).filter((k) => !standardAnswer || k !== "standard").map((k) => (
                <Field
                  key={k}
                  label={
                    [
                      "Nghĩa bạn muốn giải thích",
                      "Cách nói phổ thông",
                      "Ví dụ / ngữ cảnh",
                    ][["meaning", "standard", "context"].indexOf(k)] + (index >= 8 ? " *" : " · tùy chọn")
                  }
                >
                  <textarea
                    rows={2}
                    value={answer[k]}
                    onChange={(e) => void update(k, e.target.value)}
                    maxLength={5000}
                  />
                </Field>
              ))}
            </>
          )}
          {["GATE", "GOLD"].includes(q.kind) && (
            <Field label="Đề xuất đáp án (tùy chọn)">
              <input
                value={answer.suggestion}
                onChange={(e) => void update("suggestion", e.target.value)}
                maxLength={1000}
              />
            </Field>
          )}
          <div className="demo-actions">
            <Action
              disabled={index === 0 || saving > 0}
              onClick={() =>
                run({ type: "moveSession", id: session.id, cursor: index - 1 })
              }
            >
              Câu trước
            </Action>
            <Action disabled={saving > 0} onClick={() => next(true)}>
              Bỏ qua câu này
            </Action>
            <button className="btn btn-primary" disabled={busy || saving > 0}>
              Lưu & tiếp tục
            </button>
          </div>
        </fieldset>
      </form>
    </Panel>
  );
}
function MetadataForm({ session }: { session: Session }) {
  const { run } = useDemo();
  const [meta, setMeta] = useState({
    region: REGION_CHOICES.includes(session.region) ? session.region : "",
    upbringing: REGION_CHOICES.includes(session.upbringing) ? session.upbringing : "",
    usage: REGION_CHOICES.includes(session.usage) ? session.usage : "",
  });
  return (
    <Panel title="Bạn thường nghe cách nói này ở đâu?">
      <p>
        Chọn quận/huyện cho từng thông tin, hoặc “Không chắc / nhiều nơi” nếu
        bạn không rõ. Không cần cung cấp địa chỉ cụ thể.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await run({ type: "sessionMeta", id: session.id, ...meta });
            await run({ type: "moveSession", id: session.id, cursor: 11 });
          } catch {
            /* error surface */
          }
        }}
      >
        {(["region", "upbringing"] as const).map((k, i) => (
          <Field
            key={k}
            label={
              ["Nơi đang sống *", "Nơi lớn lên *"][i]
            }
          >
              <select
                value={meta[k]}
                required
                onChange={(e) => {
                  const next = { ...meta, [k]: e.target.value };
                  setMeta(next);
                  void run({
                    type: "sessionMeta",
                    id: session.id,
                    ...next,
                  }).catch(() => {});
                }}
              >
                <option value="">Chọn vùng</option>
                <RegionOptions unsure />
              </select>
          </Field>
        ))}
        <button className="btn btn-primary">Xem lại 10 câu</button>
      </form>
    </Panel>
  );
}
export function AnswerTable({ session, showQuality = false }: { session: Session; showQuality?: boolean }) {
  return (
    <div className="demo-table-scroll">
      <table>
        <caption>{showQuality ? `Đáp án snapshot đề v${session.exam.version}` : "Câu trả lời của bạn"}</caption>
        <thead>
          <tr>
            <th>Câu</th>
            <th>Nội dung & đáp án</th>
            {showQuality && <th>Lần thử</th>}
            {showQuality && <th>Tín hiệu hiệu chỉnh</th>}
          </tr>
        </thead>
        <tbody>
          {session.questions.map((q, i) => (
            <tr key={q.id}>
              <td>Q{String(i + 1).padStart(2, "0")}</td>
              <td>
                <strong>{q.prompt}</strong>
                {showQuality && q.format && <small>Dạng câu: {formatLabels[q.format]}</small>}
                {showQuality && q.provenance && <small>Nguồn: {q.provenance.sheet || "Đóng góp mới"} · {q.provenance.rowId} · {q.provenance.sense} · {verificationLabel[q.provenance.verification]} · Câu biên soạn. <a href={q.provenance.url} target="_blank" rel="noreferrer">Dataset</a></small>}
                <p>
                  {session.answers[i].skipped
                    ? "Đã bỏ qua"
                    : session.answers[i].text || "Chưa trả lời"}
                </p>
                {session.answers[i].meaning && (
                  <p>Nghĩa: {session.answers[i].meaning}</p>
                )}
                {session.answers[i].standard && (
                  <p>Phổ thông: {session.answers[i].standard}</p>
                )}
                {session.answers[i].context && (
                  <p>Ngữ cảnh: {session.answers[i].context}</p>
                )}
                {session.answers[i].suggestion && (
                  <p>Đề xuất: {session.answers[i].suggestion}</p>
                )}
              </td>
              {showQuality && <td>
                {session.answers[i].attempts.length}
                <details>
                  <summary>Lịch sử</summary>
                  {session.answers[i].attempts.map((a, n) => (
                    <p key={n}>
                      {a.text || "Bỏ qua"}{a.selectedOptionId ? ` (${a.selectedOptionId})` : ""} ·{" "}
                      {a.correct === null
                        ? "Không chấm"
                        : a.correct
                          ? "Đạt"
                          : "Khác tham chiếu"}{" "}
                      · {a.at}
                    </p>
                  ))}
                </details>
              </td>}
              {showQuality && <td>
                {session.answers[i].attempts.at(-1)?.correct === true
                  ? "Đạt"
                  : session.answers[i].attempts.at(-1)?.correct === false
                    ? "Khác tham chiếu"
                    : "Không chấm"}
              </td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
