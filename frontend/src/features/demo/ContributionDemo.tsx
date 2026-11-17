import { systemText } from "../../lib/display";
import { errorMessage } from "../../api/client";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useDemo } from "./context";
import { uid, duplicates, isAnswered } from "./domain";
import { blankRaw, consentDefault, METHODS } from "./seed";
import { Action, Field, Heading, Panel, Status } from "./ui";
import { ConsentFields } from "./GamePages";
import { repository } from "./repository";
import type { Consent, Raw, Session } from "./types";
import { isTestSession } from "./testSessions";
import { MyContributions } from "./MyContributions";
import { SyncItem } from "./SyncStatus";
import { useBlurValidation } from "../auth/useBlurValidation";
import { Modal } from "react-bootstrap";

export function MediaPreview({ id }: { id: string }) {
  const { state } = useDemo();
  const m = state.media.find((m) => m.id === id);
  const [url, setUrl] = useState("");
  useEffect(() => {
    let current = true;
    let objectUrl = "";
    repository()
      .getBlob(id)
      .then((blob) => {
        if (blob && current) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      })
      .catch(() => {
        if (current) setUrl("");
      });
    return () => {
      current = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);
  if (!m || !url) return <p>Media chưa tải được trên thiết bị.</p>;
  return (
    <figure className="demo-media">
      {m.kind === "audio" ? (
        <audio controls src={url} />
      ) : m.kind === "video" ? (
        <video controls src={url} />
      ) : (
        <img src={url} alt={m.transcript || m.name} />
      )}
      <figcaption>
        {m.name} · {m.mime}
      </figcaption>
    </figure>
  );
}
export function MediaAttach({
  ids,
  onChange,
  audioAllowed,
}: {
  ids: string[];
  onChange: (ids: string[]) => void;
  audioAllowed: boolean;
}) {
  const { state, run } = useDemo();
  const [rights, setRights] = useState(false);
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(
    () => () => {
      if (recorder.current?.state === "recording") {
        recorder.current.onstop = null;
        recorder.current.stop();
      }
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  async function attach(blob: Blob, name: string) {
    try {
      if (!rights) throw Error("Xác nhận quyền media trước khi đính kèm.");
      if (blob.size > 25 * 1024 * 1024) throw Error("Tệp minh họa tối đa 25 MB.");
      if (!/^(audio|image|video)\//.test(blob.type))
        throw Error("Chỉ nhận âm thanh, ảnh hoặc đoạn phim.");
      if (blob.type.startsWith("audio") && !audioAllowed)
        throw Error("Chọn phạm vi đồng ý âm thanh trước.");
      const id = uid();
      await repository().putBlob(id, blob);
      await run({
        type: "media",
        media: {
          id,
          name,
          mime: blob.type,
          transcript: "",
          rights: true,
          duration: null,
          kind: blob.type.startsWith("audio")
            ? "audio"
            : blob.type.startsWith("image")
              ? "image"
              : "video",
        },
      });
      onChange([...ids, id]);
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function record() {
    setError("");
    if (!rights || !audioAllowed) {
      setError("Cần đồng ý âm thanh và xác nhận quyền trước khi thu.");
      return;
    }
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw Error("Trình duyệt chưa hỗ trợ thu âm; bạn có thể tải tệp.");
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      chunks.current = [];
      const r = new MediaRecorder(stream.current);
      recorder.current = r;
      r.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data);
      };
      r.onstop = () => {
        stream.current?.getTracks().forEach((t) => t.stop());
        setRecording(false);
        void attach(
          new Blob(chunks.current, { type: r.mimeType || "audio/webm" }),
          "thu-am-demo.webm",
        );
      };
      r.start();
      setRecording(true);
    } catch {
      setError(
        "Không mở được micro hoặc quyền bị từ chối. Dùng nút Tải tệp thay thế.",
      );
      stream.current?.getTracks().forEach((t) => t.stop());
    }
  }
  return (
    <div className="demo-media-box">
      <h3>Âm thanh / ảnh / đoạn phim tùy chọn</h3>
      <label className="demo-checkbox">
        <input
          type="checkbox"
          checked={rights}
          onChange={(e) => setRights(e.target.checked)}
        />
        Tôi có quyền chia sẻ media này cho mục đích đã chọn.
      </label>
      <div className="demo-actions">
        <button
          type="button"
          className="btn btn-outline-primary"
          disabled={!rights || !audioAllowed}
          onClick={() => (recording ? recorder.current?.stop() : void record())}
        >
          {recording ? "Dừng & nghe lại" : "Thu âm"}
        </button>
        <button
          type="button"
          className="btn btn-outline-primary"
          disabled={!rights || recording}
          onClick={() => fileInput.current?.click()}
        >
          Tải tệp
        </button>
        <input
          ref={fileInput}
          hidden
          type="file"
          accept="audio/*,image/*,video/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void attach(f, f.name);
            e.target.value = "";
          }}
        />
      </div>
      {error && (
        <p className="demo-error" role="alert">
          {error}
        </p>
      )}
      {ids.map((id) => (
        <div key={id}>
          <MediaPreview id={id} />
          <Field label="Bản chép lời / mô tả ảnh-đoạn phim">
            <textarea
              value={state.media.find((m) => m.id === id)?.transcript ?? ""}
              onChange={(e) => {
                const m = state.media.find((m) => m.id === id);
                if (m)
                  void run({
                    type: "media",
                    media: { ...m, transcript: e.target.value },
                  }).catch(() => {});
              }}
            />
          </Field>
          <Action onClick={() => onChange(ids.filter((x) => x !== id))}>
            Bỏ tệp / thu lại
          </Action>
        </div>
      ))}
    </div>
  );
}

export function ContributionDemo() {
  const { state } = useDemo();
  const [params] = useSearchParams();
  const kind = params.get("kind") === "sentence" ? "sentence" : "word";
  const parent = params.get("parent");
  const task = state.tasks.find((t) => t.id === params.get("task"));
  return (
    <ContributionForm
      key={`${state.actor}.${kind}.${parent}.${task?.id}`}
      kind={kind}
      parent={parent}
      taskId={task?.id ?? null}
    />
  );
}
function ContributionForm({
  kind,
  parent,
  taskId,
}: {
  kind: Raw["kind"];
  parent: string | null;
  taskId: string | null;
}) {
  const { state, run, live } = useDemo();
  const previous = state.contributions.find((c) => c.id === parent);
  const task = state.tasks.find((t) => t.id === taskId);
  const draftKey = `${state.actor}.${kind}.${parent ?? ""}.${taskId ?? ""}`;
  const draft = state.drafts?.find((d) => d.key === draftKey);
  const [raw, setRaw] = useState<Raw>(
    () =>
      draft?.raw ??
      (previous
        ? { ...previous.raw }
        : { ...blankRaw(), kind, region: task?.region ?? "", method: task?.method ?? "direct" }),
  );
  const [consent, setConsent] = useState<Consent>(
    () => draft?.consent ?? (previous ? previous.consent : consentDefault()),
  );
  const [id, setId] = useState(uid);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(0);
  const [draftError, setDraftError] = useState("");
  const requiredLabels = { text: "cách nói địa phương", meaning: "nghĩa của cách nói", standard: "cách nói phổ thông", context: "một ví dụ sử dụng", evidence: "nguồn hoặc nơi bạn nghe cách nói", region: "vùng bạn nghe cách nói" };
  const validation = useBlurValidation(Object.fromEntries(Object.entries(requiredLabels).map(([key, label]) => [key, () => raw.response !== "answer" || raw[key as keyof typeof requiredLabels].trim() ? "" : `Nhập ${label}.`])));
  function save(r: Raw, c: Consent) {
    setSaving((n) => n + 1);
    void run({ type: "draft", key: draftKey, raw: r, consent: c, parent })
      .then(() => setDraftError(""))
      .catch(() => setDraftError("Chưa lưu được nháp. Giữ trang này và thử lại."))
      .finally(() => setSaving((n) => n - 1));
  }
  function update<K extends keyof Raw>(key: K, value: Raw[K]) {
    const next = { ...raw, [key]: value };
    setRaw(next);
    save(next, consent);
    setId(uid());
  }
  useEffect(() => {
    if (sent) return;
    const f = (e: BeforeUnloadEvent) => {
      if (saving > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [saving, sent]);
  function textField([k, label]: readonly ["text" | "meaning" | "standard" | "context" | "evidence" | "partOfSpeech" | "variants" | "keywords" | "family", string]) {
    const required = ["text", "meaning", "standard", "context", "evidence"].includes(k) && raw.response === "answer";
    return <Field key={k} label={label + (required ? " *" : "")}>
      <textarea name={k} rows={k === "context" ? 3 : 2} required={required} value={raw[k]} maxLength={5000}
        placeholder={k === "evidence" ? "Ví dụ: gia đình ở Hội An, sách hoặc đường dẫn nguồn." : undefined}
        onBlur={() => { if (k in requiredLabels) validation.blur(k); }}
        aria-invalid={!!validation.errors[k]} aria-describedby={validation.errors[k] ? `direct-${k}-error` : undefined}
        onChange={(e) => update(k, e.target.value)} />
      {validation.errors[k] && <span className="bz-field-error" id={`direct-${k}-error`} role="alert">{validation.errors[k]}</span>}
    </Field>;
  }
  const sentItem = state.contributions.find(c => c.id === id || c.clientRef === id);
  const accepted = !live || !!sentItem && (sentItem.id.startsWith("c:") || sentItem.sync?.status === "accepted");
  if (sent)
    return (
      <Panel title={live ? accepted ? "Đã gửi" : "Chưa gửi được" : "Đã lưu minh họa"}>
        <p>{accepted ? "Đóng góp đang chờ duyệt." : "Nội dung vẫn được giữ trên máy."}</p>
        {live && !accepted && sentItem && <SyncItem c={sentItem} />}
        <Link className="btn btn-primary" to="/demo/history">
          Xem đóng góp của tôi
        </Link>
      </Panel>
    );
  return (
    <>
      <Heading
        title={
          task?.title ??
          (parent
            ? "Bổ sung bằng phiên bản mới"
            : kind === "word"
              ? "Góp một từ / cụm từ"
              : "Góp một câu phương ngữ")
        }
      >
        <p>
          {live ? "Góp cách nói bạn biết, kèm nguồn và vùng sử dụng." : "Nháp minh họa được giữ riêng trên trình duyệt."}
        </p>
      </Heading>
      <Panel>
        {draftError && <p role="alert" className="demo-error">{draftError}</p>}
        {task && (
          <>
            <p className="demo-question-text">{task.prompt}</p>
            {task.mediaId && <MediaPreview id={task.mediaId} />}
          </>
        )}
        <form className="direct-contribution-form" noValidate aria-busy={busy}
          onSubmit={async (e) => {
            e.preventDefault();
            if (!validation.validate(e)) return;
            setBusy(true);
            setError("");
            try {
              if (
                raw.mediaIds.some(
                  (mid) =>
                    state.media.find((m) => m.id === mid)?.kind === "audio",
                ) &&
                !consent.audio
              )
                throw Error("Mẫu có âm thanh nhưng chưa đồng ý âm thanh.");
              await run({ type: "contribute", id, raw: live ? { ...raw, mediaIds: [] } : raw, consent: live ? { ...consent, audio: false } : consent, parent });
              await run({ type: "clearDraft", key: draftKey });
              setSent(true);
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy}>
          {task && (
            <Field label="Cách trả lời">
              <select
                value={raw.response}
                onChange={(e) =>
                  update("response", e.target.value as Raw["response"])
                }
              >
                <option value="answer">Có cách nói để chia sẻ</option>
                <option value="unknown">Không biết</option>
                <option value="no_term">Không có từ riêng</option>
                <option value="same_standard">Giống cách nói phổ thông</option>
              </select>
            </Field>
          )}
          <div className="demo-form-grid">
            {([
              ["text", kind === "word" ? "Từ / cụm từ" : "Câu phương ngữ"],
              ["meaning", "Nghĩa"], ["standard", "Cách nói phổ thông"],
              ["context", "Câu ví dụ / ngữ cảnh"], ["evidence", "Nguồn / chứng cứ"],
            ] as const).map(textField)}
            <details className="direct-extra-fields"><summary>Thông tin thêm · tùy chọn</summary>
              {([["partOfSpeech", "Từ loại"], ["variants", "Biến thể"], ["keywords", "Từ khóa"], ["family", "Họ câu / nhóm liên quan"]] as const).map(textField)}
            </details>
            <Field label="Vùng dùng *">
              <select
                name="region" value={raw.region} required
                onBlur={() => validation.blur("region")} aria-invalid={!!validation.errors.region} aria-describedby={validation.errors.region ? "direct-region-error" : undefined}
                onChange={(e) => update("region", e.target.value)}
              >
                <option value="">Chọn vùng</option>
                {raw.region && !state.regions.includes(raw.region) && <option value={raw.region}>{raw.region}</option>}
                {state.regions.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
              {validation.errors.region && <span className="bz-field-error" id="direct-region-error" role="alert">{validation.errors.region}</span>}
            </Field>
            <Field label="Chủ đề">
              <select
                value={raw.topic}
                onChange={(e) => update("topic", e.target.value)}
              >
                {state.topics.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Mức chắc chắn">
              <select
                value={raw.confidence}
                onChange={(e) => update("confidence", e.target.value)}
              >
                <option value="self_report">Tự khai</option>
                <option value="unsure">Chưa chắc</option>
                <option value="heard">Đã nghe thực tế</option>
              </select>
            </Field>
          </div>
          <ConsentFields
            value={consent}
            onChange={(next) => {
              setConsent(next);
              save(raw, next);
              setId(uid());
            }}
          />
          {live ? <p className="demo-note">Pilot hiện chỉ thu văn bản, chưa tiếp nhận bản ghi âm, ảnh hoặc đoạn phim.</p> : <MediaAttach
            ids={raw.mediaIds}
            audioAllowed={consent.audio}
            onChange={(ids) => update("mediaIds", ids)}
          />}
          {!!duplicates(state, raw, parent ?? undefined).length && (
            <p className="demo-note">
              Có mẫu trùng nội dung/nghĩa/vùng. Bạn vẫn gửi Bản gốc; người duyệt sẽ đối
              chiếu, không xóa bản gốc.
            </p>
          )}
          {error && (
            <p role="alert" className="demo-error">
              {error}
            </p>
          )}
          <div className="demo-actions">
            <button className="btn btn-primary" disabled={busy || saving > 0}>
              {busy ? "Đang gửi…" : live ? "Gửi đóng góp" : "Gửi đóng góp Minh họa"}
            </button>
            <Action
              onClick={async () => {
                await run({ type: "clearDraft", key: draftKey });
                setRaw({ ...blankRaw(), kind, region: task?.region ?? "" });
                setConsent(consentDefault());
                setId(uid());
              }}
            >
              Xóa nháp
            </Action>
            <span role="status">
              {saving ? "Đang lưu…" : "Nháp đã lưu hoặc chưa thay đổi."}
            </span>
          </div>
          </fieldset>
        </form>
      </Panel>
    </>
  );
}

const when = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh",
});

/** What a player recognises a round by: when it happened and how far it got. Never the internal id. */
function sessionSummary(s: Session) {
  const at = (iso: string | null | undefined) => {
    const d = iso ? new Date(iso) : null;
    return d && !Number.isNaN(d.getTime()) ? when.format(d) : null;
  };
  const answered = s.answers.filter(isAnswered).length;
  const started = at(s.createdAt);
  const parts = [
    s.state === "submitted" && at(s.submittedAt) ? `Gửi lúc ${at(s.submittedAt)}` : started ? `Bắt đầu lúc ${started}` : null,
    `${answered}/${s.questions.length} câu`,
  ];
  return parts.filter(Boolean).join(" · ");
}

export function HistoryDemo() {
  const { state, run } = useDemo();
  const [withdrawTarget, setWithdrawTarget] = useState<Session | null>(null);
  return (
    <>
      <Heading title="Lịch sử và quyền dữ liệu">
      </Heading>
      <Panel title="Lượt chơi của bạn">
        {state.sessions
          .filter((s) => s.owner === state.actor && !isTestSession(s))
          .map((s) => (
            <div className="demo-list-row" key={s.id}>
              <div>
                <Link to={`/demo/game/${s.id}`}>{s.exam.title.replace(/Dataset1/g, "Bộ dữ liệu số 1")}</Link>
                <small>{sessionSummary(s)}</small>
                {s.receipts && <small>{Object.entries(s.receipts).map(([kind, r]) => `${({ started: "Bắt đầu", submitted: "Gửi bài", withdraw: "Rút lượt", withdrawn: "Rút lượt" } as Record<string, string>)[kind] ?? "Trạng thái lượt"}: ${r.done ? "máy chủ đã xác nhận" : r.reason ? systemText(r.reason) : "chờ máy chủ xác nhận"}`).join(" · ")}</small>}
                {!!s.serverPending?.length && <small>{s.serverPending.length} thao tác chờ đồng bộ. {s.serverConflict ? "Cần mở lượt để xử lý xung đột." : "Nháp vẫn được giữ trên thiết bị."}</small>}
                {!s.serverAllocated && <small>Lượt chơi trên thiết bị này chưa được tính vào thống kê trên máy chủ.</small>}
                <Status value={s.state} />
              </div>
              {s.state !== "withdrawn" && (
                <button type="button" className="btn btn-outline-danger" onClick={() => setWithdrawTarget(s)}>
                  Rút dữ liệu lượt này
                </button>
              )}
            </div>
          ))}
        {!state.sessions.some((s) => s.owner === state.actor && !isTestSession(s)) && (
          <p>Chưa có lượt chơi.</p>
        )}
      </Panel>
      <MyContributions />
      <Modal aria-label="Xác nhận rút lượt" centered show={!!withdrawTarget} onHide={() => setWithdrawTarget(null)}>
        <Modal.Header closeButton closeLabel="Đóng"><Modal.Title>Rút dữ liệu lượt chơi?</Modal.Title></Modal.Header>
        <Modal.Body>Mẫu trong lượt này sẽ bị ngừng sử dụng và không khôi phục lại được. Bản gốc và lịch sử vẫn được giữ.</Modal.Body>
        <Modal.Footer><button type="button" className="btn btn-outline-secondary" onClick={() => setWithdrawTarget(null)}>Giữ dữ liệu</button><Action onClick={async () => { if (!withdrawTarget) return; await run({ type: "withdrawSession", id: withdrawTarget.id }); setWithdrawTarget(null); }}>Xác nhận rút lượt</Action></Modal.Footer>
      </Modal>
    </>
  );
}
export function TasksDemo() {
  const { state } = useDemo();
  return (
    <>
      <Heading title="Khơi thêm cách nói mới">
        <p>
          Chín phương thức dùng chung biểu mẫu có ngữ cảnh, nguồn và phản hồi không
          biết/không có từ riêng.
        </p>
      </Heading>
      <div className="demo-card-grid">
        {state.tasks
          .filter((t) => t.active)
          .map((t) => (
            <Panel key={t.id} title={t.title}>
              <p>{t.prompt}</p>
              <small>
                {t.method} · {t.region} · {t.topic}
              </small>
              <Link
                className="btn btn-primary"
                to={`/demo/contribute?task=${t.id}`}
              >
                Tham gia nhiệm vụ
              </Link>
            </Panel>
          ))}
      </div>
      <p className="demo-note">Các phương thức: {METHODS.join(" · ")}.</p>
    </>
  );
}
