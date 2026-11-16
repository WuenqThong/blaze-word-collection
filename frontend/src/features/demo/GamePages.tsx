import { ResponsiveTable } from "../../components/ResponsiveTable";
import { useEffect, useRef, useState } from "react";
import { GameSyncStatus } from "./GameSyncStatus";
import {
  Link,
  Navigate,
  useBlocker,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { Modal } from "react-bootstrap";
import { systemText } from "../../lib/display";
import { errorMessage } from "../../api/client";
import { useDemo } from "./context";
import { blankAnswer, canAdvance, isAnswered, isGateProposal, wrongAttempts, uid, gameAllocation } from "./domain";
import { consentDefault, gateCount } from "./seed";
import { Action, Field, Heading, Panel, Status } from "./ui";
import type { Answer, Consent, Session } from "./types";
import { answerOriginal, isOpenQuestion } from "./dialectOriginal";
import { playerPrompt } from "./playerPrompt";
import { formatLabels } from "./questionFormats";
import { verificationLabel } from "./datasetBank";
import { REGION_CHOICES } from "./regions";
import { localQualityReasons, qualityReasonLabels } from "./contributionQuality";
import { RegionOptions } from "./RegionOptions";
import { useBlurValidation } from "../auth/useBlurValidation";

export function ConsentFields({
  value,
  onChange,
  required = true,
}: {
  value: Consent;
  onChange: (value: Consent) => void;
  required?: boolean;
}) {
  return (
    <fieldset className="demo-consents">
      <legend>Phạm vi bạn đồng ý</legend>
      {(
        [
          ["collect", `Tiếp nhận & kiểm duyệt${required ? " (bắt buộc)" : ""}`],
          ["train", `Cho phép sử dụng dữ liệu để huấn luyện${required ? " (bắt buộc)" : ""}`],
          ["public", "Cho phép công khai dữ liệu"],
        ] as const
      ).map(([k, label]) => (
        <label key={k}>
          <input
            type="checkbox"
            checked={value[k]}
            aria-required={required && k !== "public" ? true : undefined}
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
              if (!consent.train) {
                setError("Hãy tích chọn cho phép sử dụng dữ liệu để huấn luyện để bắt đầu chơi.");
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
                Chưa có đề đang mở. Người kiểm duyệt có thể tạo và phát hành đề
                minh họa.
              </p>
            )}
            {!pending && <ConsentFields value={consent} onChange={setConsent} />}
            {!pending && (!consent.collect || !consent.train) && !!selected && (
              <p className="demo-note" id="demo-consent-hint">
                Để bắt đầu, hãy tích hai ô bắt buộc: tiếp nhận & kiểm duyệt và cho phép huấn luyện. Công khai dữ liệu là tùy chọn.
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
              aria-describedby={!pending && (!consent.collect || !consent.train) && selected ? "demo-consent-hint" : undefined}
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
  if (!session || (session.owner !== actor.id && !["admin", "reviewer"].includes(actor.role)))
    return (
      <Panel title="Không tìm thấy lượt thuộc vai trò này">
        <Link to="/demo/play">Về chọn đề</Link>
      </Panel>
    );
  if (session.owner !== actor.id) return <Navigate to={`/demo/reviewer/sessions/${session.id}`} replace />;
  return <GameSession key={session.id} session={session} />;
}
function GameSession({ session }: { session: Session }) {
  const { state, run } = useDemo();
  const actor = state.people.find((p) => p.id === state.actor)!;
  const [notice, setNotice] = useState("");
  const blocker = useBlocker(session.state === "playing");
  const step = useRef<HTMLDivElement>(null);
  useEffect(() => {
    step.current?.focus({ preventScroll: true });
    if (window.innerWidth < 600) step.current?.scrollIntoView?.({ block: "nearest" });
  }, [session.cursor, session.serverViewKey]);
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
          <GameSyncStatus session={session} />
          <div className="demo-actions">
            <Link className="btn btn-primary" to="/demo/history">
              Xem lịch sử và quản lý quyền
            </Link>
            {["admin", "reviewer"].includes(actor.role) && <Link
              className="btn btn-outline-primary"
              to={`/demo/reviewer/sessions/${session.id}`}
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
      <GameSyncStatus session={session} />
      <progress
        aria-label="Tiến trình 10 câu"
        max={10}
        value={session.answers.filter(isAnswered).length}
      />
      <nav className="demo-question-nav" aria-label="Chọn câu">
        {session.questions.map((q, i) => (
          <Action
            key={q.id}
            disabled={!canAdvance(session, i) || !!session.serverConflict}
            current={session.cursor === i}
            label={`Câu ${i + 1}, ${session.answers[i].skipped ? "đã bỏ qua" : isAnswered(session.answers[i]) ? "đã trả lời" : "chưa trả lời"}${session.cursor === i ? ", đang mở" : ""}`}
            onClick={() =>
              run({ type: "moveSession", id: session.id, cursor: i })
            }
          >
            Câu {i + 1}
            {session.answers[i].skipped
              ? " · bỏ qua"
              : isAnswered(session.answers[i])
                ? " ✓"
                : ""}
          </Action>
        ))}
      </nav>
      {session.answers.some((a, i) => session.questions[i].kind === "GATE" && (isGateProposal(a) || a.attempts.some(t => t.proposal))) && <p className="demo-note" role="status">Đề xuất đáp án mới đã được lưu cùng lượt chơi. Khi bạn gửi bài, đề xuất sẽ được chuyển sang mục cần kiểm tra; chưa được tính là đáp án đúng.</p>}
      {notice && (
        <p className="demo-error" role="alert">
          {notice}
        </p>
      )}
      <div ref={step} tabIndex={-1} inert={!!session.serverConflict} className="game-active-step" aria-label={session.cursor < 10 ? `Nội dung câu ${session.cursor + 1}` : "Xem lại và gửi bài"}>
      {session.cursor < 10 ? (
        <QuestionForm
          key={`${session.cursor}.${session.serverViewKey ?? ""}`}
          session={session}
          notify={setNotice}
        />
      ) : session.cursor === 10 ? (
        <MetadataForm session={session} />
      ) : (
        <Panel title="Xem lại trước khi gửi">
          <p>
            Hiện sống: {session.region} · Lớn lên: {session.upbringing}
          </p>
          <AnswerTable session={session} />
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
      </div>
      <Modal aria-label="Rời lượt chơi"
        show={blocker.state === "blocked"}
        centered
        onHide={() => blocker.state === "blocked" && blocker.reset()}
      >
        <Modal.Header closeLabel="Đóng" closeButton>
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
export function QuestionForm({
  session,
  notify,
}: {
  session: Session;
  notify: (s: string) => void;
}) {
  const { run } = useDemo();
  const index = session.cursor;
  const q = session.questions[index];
  const openQuestion = isOpenQuestion(q);
  const standardAnswer = q.format !== "choice";
  const [answer, setAnswer] = useState<Answer>(() =>
    structuredClone(session.answers[index] ?? blankAnswer()),
  );
  const draftSave = useRef<Promise<unknown>>(Promise.resolve());
  const [busy, setBusy] = useState(false);
  const validation = useBlurValidation({
    originalText: () => !openQuestion || answer.originalText?.trim() ? "" : "Nhập cách nói địa phương hoặc chọn Bỏ qua câu này.",
    standard: () => !standardAnswer || (answer.standard || answer.text).trim() ? "" : "Nhập cách nói phổ thông hoặc chọn Bỏ qua câu này.",
    explanation: () => !openQuestion || (answer.meaning + answer.context).trim() ? "" : "Giải thích nghĩa hoặc nêu một ví dụ cách dùng.",
  });
  async function update(
    key: "explanation" | keyof Pick<
      Answer,
      "originalText" | "text" | "meaning" | "standard" | "context" | "suggestion"
    >,
    value: string,
  ) {
    const next = { ...answer, ...(key === "explanation" ? { meaning: value, context: "" } : { [key]: value }), ...(standardAnswer && key === "standard" ? { text: value } : {}), skipped: false };
    setAnswer(next);
    try {
      const saved = run({ type: "draftAnswer", id: session.id, index, answer: next });
      draftSave.current = saved;
      await saved;
    } catch {
      /* visible global error */
    }
  }
  async function choose(id: string) {
    const option = q.options?.find((o) => o.id === id);
    if (!option) return;
    const next = { ...answer, selectedOptionId: id, text: option.text, skipped: false };
    setAnswer(next);
    try {
      const saved = run({ type: "draftAnswer", id: session.id, index, answer: next });
      draftSave.current = saved;
      await saved;
    }
    catch { /* Global save error remains visible. */ }
  }
  async function next(skip = false) {
    notify("");
    if (!skip && !answer.text.trim()) {
      notify("Nhập đáp án hoặc chọn Bỏ qua.");
      return;
    }
    if (
      !skip &&
      openQuestion &&
      !(answer.originalText?.trim() && answer.standard.trim() && (answer.meaning.trim() || answer.context.trim()))
    ) {
      notify("Nhập cách nói địa phương, cách nói phổ thông và phần giải thích cho câu đóng góp mới.");
      return;
    }
    setBusy(true);
    try {
      await draftSave.current;
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
          `Chưa hoàn tất ${gateCount(session.exam)} câu đầu. Câu này đã sai ${wrongAttempts(x.answers[index])} lần; từ lần sai thứ 4, hệ thống lưu thành đề xuất đáp án mới và cho làm tiếp.`,
        );
      else notify("");
    } catch (e) {
      notify(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel title={`Câu ${index + 1} / 10`}>
      <p className="demo-question-text">{playerPrompt(q)}</p>
      {q.format && <p className="demo-note">{formatLabels[q.format]}</p>}
      {q.format === "fill" && <p className="demo-blank-template">{q.blankTemplate}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!validation.validate(e)) return;
          void next();
        }}
      >
        <fieldset disabled={busy}>
          {openQuestion && <Field label="Cách nói địa phương *">
            <textarea name="originalText" rows={3} value={answer.originalText ?? ""} maxLength={5000} onChange={e => void update("originalText", e.target.value)} onBlur={() => validation.blur("originalText")} aria-invalid={!!validation.errors.originalText} aria-describedby={validation.errors.originalText ? "game-original-error" : undefined} />
          </Field>}
          {validation.errors.originalText && <p className="bz-field-error" id="game-original-error" role="alert">{validation.errors.originalText}</p>}
          {q.format === "choice" ? <fieldset className="demo-choice-list">
            <legend>Chọn một đáp án</legend>
            {q.options?.map((o) => <label key={o.id} className={`demo-choice ${answer.selectedOptionId === o.id ? "is-selected" : ""}`}>
              <input type="radio" name={`choice-${q.id}`} value={o.id} checked={answer.selectedOptionId === o.id} onChange={() => void choose(o.id)} />
              <span>{o.text}</span>
            </label>)}
          </fieldset> : <Field label="Cách nói phổ thông *">
            {q.format === "short" || q.format === "fill" ? <input name="standard" type="text" value={answer.standard || answer.text} maxLength={5000} onChange={(e) => void update("standard", e.target.value)} onBlur={() => validation.blur("standard")} aria-invalid={!!validation.errors.standard} aria-describedby={validation.errors.standard ? "game-standard-error" : undefined} /> :
            <textarea
              rows={3}
              name="standard"
              value={answer.standard || answer.text}
              onChange={(e) => void update("standard", e.target.value)}
              maxLength={5000}
              onBlur={() => validation.blur("standard")} aria-invalid={!!validation.errors.standard} aria-describedby={validation.errors.standard ? "game-standard-error" : undefined}
            />}
          </Field>}
          {validation.errors.standard && <p className="bz-field-error" id="game-standard-error" role="alert">{validation.errors.standard}</p>}
          {(
            <>
              {<Field label={openQuestion ? "Giải thích *" : "Giải thích · tùy chọn"}>
                <textarea
                  rows={3}
                  name="explanation"
                  value={[answer.meaning, answer.context].filter(Boolean).join("\n\n")}
                  onChange={(e) => void update("explanation", e.target.value)}
                  placeholder="Giải thích nghĩa hoặc nêu ví dụ cách dùng."
                  maxLength={5000}
                  onBlur={() => validation.blur("explanation")} aria-invalid={!!validation.errors.explanation} aria-describedby={validation.errors.explanation ? "game-explanation-error" : undefined}
                />
              </Field>}
            </>
          )}
          {validation.errors.explanation && <p className="bz-field-error" id="game-explanation-error" role="alert">{validation.errors.explanation}</p>}
          <div className="demo-actions">
            <Action
              disabled={index === 0}
              onClick={async () => {
                setBusy(true);
                try {
                  await draftSave.current;
                  await run({ type: "moveSession", id: session.id, cursor: index - 1 });
                } catch (e) { notify(errorMessage(e)); }
                finally { setBusy(false); }
              }}
            >
              Câu trước
            </Action>
            <Action onClick={() => next(true)}>
              Bỏ qua câu này
            </Action>
            <button className="btn btn-primary" disabled={busy}>
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
  const choices = session.allowedRegions ?? REGION_CHOICES;
  const [meta, setMeta] = useState({
    region: choices.includes(session.region) ? session.region : "",
    upbringing: choices.includes(session.upbringing) ? session.upbringing : "",
    usage: choices.includes(session.usage) ? session.usage : "",
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
    <ResponsiveTable>
      <table>
        <caption>{showQuality ? `Đáp án của bộ đề tại thời điểm bắt đầu, phiên bản ${session.exam.version}` : "Câu trả lời của bạn"}</caption>
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
              <td>Câu {i + 1}</td>
              <td>
                <strong>{q.prompt}</strong>
                {showQuality && q.format && <small>Dạng câu: {formatLabels[q.format]}</small>}
                {showQuality && q.provenance && <small>Nguồn: {q.provenance.sheet ? systemText(q.provenance.sheet) : "Đóng góp mới"} · {q.provenance.rowId} · {q.provenance.sense} · {verificationLabel[q.provenance.verification]} · Câu biên soạn. <a href={q.provenance.url} target="_blank" rel="noreferrer">Bộ dữ liệu</a></small>}
                <p>Cách nói địa phương: {answerOriginal(q, session.answers[i]) || "Chưa có bản gốc"}</p>
                <p>Cách nói phổ thông: {session.answers[i].standard || session.answers[i].text || "Chưa trả lời"}</p>
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
                {!session.answers[i].skipped && !["GATE", "GOLD"].includes(q.kind) && localQualityReasons({
                  ...session.answers[i], text: answerOriginal(q, session.answers[i]), kind: "word", region: "", topic: "", partOfSpeech: "", variants: "", keywords: "", evidence: "", method: "game", family: "", confidence: "", response: "answer", mediaIds: [],
                }, q).map(reason => <p className="demo-note" key={reason}>Cần kiểm tra chất lượng: {qualityReasonLabels[reason]} Bản gốc được giữ nguyên.</p>)}
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
                      {a.proposal && <span> · Đề xuất mới: {a.proposal} (chưa xác nhận)</span>}
                    </p>
                  ))}
                </details>
              </td>}
              {showQuality && <td>
                {q.kind === "GATE" && isGateProposal(session.answers[i])
                  ? "Đề xuất mới · chờ kiểm tra"
                  : session.answers[i].attempts.at(-1)?.correct === true
                  ? "Đạt"
                  : session.answers[i].attempts.at(-1)?.correct === false
                    ? "Khác tham chiếu"
                    : "Không chấm"}
              </td>}
            </tr>
          ))}
        </tbody>
      </table>
    </ResponsiveTable>
  );
}
