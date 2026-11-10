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
      if (blob.size > 25 * 1024 * 1024) throw Error("File demo tối đa 25 MB.");
      if (!/^(audio|image|video)\//.test(blob.type))
        throw Error("Chỉ nhận audio, ảnh hoặc video.");
      if (blob.type.startsWith("audio") && !audioAllowed)
        throw Error("Chọn phạm vi đồng ý audio trước.");
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
      setError("Cần đồng ý audio và xác nhận quyền trước khi thu.");
      return;
    }
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw Error("Trình duyệt chưa hỗ trợ thu âm; bạn có thể tải file.");
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
        "Không mở được micro hoặc quyền bị từ chối. Dùng nút Tải file thay thế.",
      );
      stream.current?.getTracks().forEach((t) => t.stop());
    }
  }
  return (
    <div className="demo-media-box">
      <h3>Audio / ảnh / video tùy chọn</h3>
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
          Tải file
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
          <Field label="Transcript / mô tả ảnh-video">
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
        : { ...blankRaw(), kind, method: task?.method ?? "direct" }),
  );
  const [consent, setConsent] = useState<Consent>(
    () => draft?.consent ?? (previous ? previous.consent : consentDefault()),
  );
  const [id, setId] = useState(uid);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(0);
  function save(r: Raw, c: Consent) {
    setSaving((n) => n + 1);
    void run({ type: "draft", key: draftKey, raw: r, consent: c, parent })
      .catch(() => {})
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
  if (sent)
    return (
      <Panel title={live ? "Đã tiếp nhận bản gốc" : "Đã tiếp nhận bản gốc DEMO"}>
        <p>Mã: {id}. Chưa tự xác minh hoặc cấp credit.</p>
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
          Giữ RAW, khai nguồn và chọn quyền sử dụng. Nháp giữ trong kho demo
          riêng.
        </p>
      </Heading>
      <Panel>
        {task && (
          <>
            <p className="demo-question-text">{task.prompt}</p>
            {task.mediaId && <MediaPreview id={task.mediaId} />}
          </>
        )}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
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
                throw Error("Mẫu có audio nhưng chưa đồng ý audio.");
              await run({ type: "contribute", id, raw, consent, parent });
              await run({ type: "clearDraft", key: draftKey });
              setSent(true);
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
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
            {(
              [
                ["text", kind === "word" ? "Từ / cụm từ" : "Câu phương ngữ"],
                ["meaning", "Nghĩa"],
                ["standard", "Cách nói phổ thông"],
                ["context", "Câu ví dụ / ngữ cảnh"],
                ["evidence", "Nguồn / chứng cứ"],
                ["partOfSpeech", "Từ loại"],
                ["variants", "Biến thể"],
                ["keywords", "Từ khóa"],
                ["family", "Họ câu / nhóm liên quan"],
              ] as const
            ).map(([k, label]) => (
              <Field
                key={k}
                label={
                  label +
                  ([
                    "text",
                    "meaning",
                    "standard",
                    "context",
                    "evidence",
                  ].includes(k) && raw.response === "answer"
                    ? " *"
                    : "")
                }
              >
                <textarea
                  rows={k === "context" ? 3 : 2}
                  required={
                    [
                      "text",
                      "meaning",
                      "standard",
                      "context",
                      "evidence",
                    ].includes(k) && raw.response === "answer"
                  }
                  value={raw[k]}
                  maxLength={5000}
                  onChange={(e) => update(k, e.target.value)}
                />
              </Field>
            ))}
            <Field label="Vùng dùng">
              <select
                value={raw.region}
                onChange={(e) => update("region", e.target.value)}
              >
                {state.regions.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
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
          <MediaAttach
            ids={raw.mediaIds}
            audioAllowed={consent.audio}
            onChange={(ids) => update("mediaIds", ids)}
          />
          {!!duplicates(state, raw, parent ?? undefined).length && (
            <p className="demo-note">
              Có mẫu trùng nội dung/nghĩa/vùng. Bạn vẫn gửi RAW; reviewer sẽ đối
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
              {busy ? "Đang gửi…" : live ? "Gửi đóng góp" : "Gửi đóng góp DEMO"}
            </button>
            <Action
              onClick={async () => {
                await run({ type: "clearDraft", key: draftKey });
                setRaw({ ...blankRaw(), kind });
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
                <Link to={`/demo/game/${s.id}`}>{s.exam.title}</Link>
                <small>{sessionSummary(s)}</small>
                <Status value={s.state} />
              </div>
              {s.state !== "withdrawn" && (
                <Action
                  onClick={() => run({ type: "withdrawSession", id: s.id })}
                >
                  Rút dữ liệu lượt này
                </Action>
              )}
            </div>
          ))}
        {!state.sessions.some((s) => s.owner === state.actor && !isTestSession(s)) && (
          <p>Chưa có lượt chơi.</p>
        )}
      </Panel>
      <MyContributions />
    </>
  );
}
export function TasksDemo() {
  const { state } = useDemo();
  return (
    <>
      <Heading title="Khơi thêm cách nói mới">
        <p>
          Chín phương thức dùng chung form có ngữ cảnh, nguồn và phản hồi không
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
