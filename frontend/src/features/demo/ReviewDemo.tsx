import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useDemo } from "./context";
import { blankRaw, consentDefault } from "./seed";
import { duplicates, exclusionReasons } from "./domain";
import { Action, DemoGuard, Field, Heading, Panel, Status } from "./ui";
import { MediaPreview } from "./ContributionDemo";
import type { Contribution, Raw, Vote } from "./types";
import { isTestContribution } from "./testSessions";

export function ReviewDemo() {
  return (
    <DemoGuard review>
      <ReviewInner />
    </DemoGuard>
  );
}
function ReviewInner() {
  const { state, live } = useDemo();
  const [params] = useSearchParams();
  const done = params.get("view") === "done";
  const [region, setRegion] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState("");
  const actor = state.people.find((p) => p.id === state.actor)!;
  const items = state.contributions.filter(
    (c) =>
      !c.withdrawn &&
      !isTestContribution(state, c) &&
      !c.duplicateOf &&
      (actor.role === "admin" || state.votes.some((v) => v.contributionId === c.id && v.reviewer === actor.id) === done) &&
      c.owner !== actor.id &&
      (actor.role === "admin" || c.raw.region === actor.region) &&
      (!region || c.raw.region === region) &&
      (!status || c.status === status),
  );
  const item = items.find((c) => c.id === selected);
  return (
    <>
      <Heading title={actor.role === "reviewer" ? (done ? "Phiếu tôi đã xử lý" : "Hàng chờ kiểm duyệt") : "Đánh giá độc lập & chuẩn hóa"}>
        <p>
          Phiếu khác được ẩn trước khi gửi. Điều phối bất đồng phải độc lập với
          tác giả và hai người đã bỏ phiếu.
        </p>
      </Heading>
      <div className="demo-filters">
        <Field label="Vùng">
          <select
            value={region}
            onChange={(e) => {
              setRegion(e.target.value);
              setSelected("");
            }}
          >
            <option value="">Trong phạm vi vai trò</option>
            {state.regions.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </Field>
        <Field label="Trạng thái">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setSelected("");
            }}
          >
            <option value="">Tất cả</option>
            {["RAW", "REVIEW", "VERIFIED", "HOLD", "REJECT"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="demo-review-grid">
        <Panel title={`${items.length} mẫu trong phạm vi`}>
          {items.map((c) => (
            <button
              type="button"
              aria-pressed={selected === c.id}
              className="demo-queue-button"
              key={c.id}
              onClick={() => setSelected(c.id)}
            >
              <strong>{c.raw.text || c.raw.response}</strong>
              <span>
                {c.raw.region} · {c.raw.method}
              </span>
              <Status value={c.status} />
            </button>
          ))}
          {!items.length && (
            <p>
              Chưa có mẫu phù hợp. Gửi game/import/góp từ rồi đổi sang Reviewer.
            </p>
          )}
        </Panel>
        {item ? (
          <ReviewItem key={`${item.id}.${state.actor}`} item={item} />
        ) : (
          <Panel title="Chọn mẫu để đọc">
            <p>
              {live
                ? "RAW, phiếu và bản chuẩn hóa lưu trên máy chủ. Phiếu người khác được ẩn cho tới khi bạn gửi phiếu."
                : "RAW và phiếu đều lưu trong kho demo, không cập nhật dữ liệu thật."}
            </p>
          </Panel>
        )}
      </div>
      <Panel title="Yêu cầu / phản hồi đang chờ">
        {state.feedback
          .filter((f) => f.state === "open" && (actor.role === "admin" || items.some((c) => c.id === f.entity)))
          .map((f) => (
            <div className="demo-list-row" key={f.id}>
              <p>
                {f.entity} · {f.text}
              </p>
              <Action onClick={() => setSelected(f.entity)}>
                Xem trong ngữ cảnh phía trên
              </Action>
              <ResolveFeedback id={f.id} />
            </div>
          ))}
      </Panel>
    </>
  );
}
function ResolveFeedback({ id }: { id: string }) {
  const { run } = useDemo();
  return (
    <Action onClick={() => run({ type: "resolve", id })}>
      Đã xử lý phản hồi
    </Action>
  );
}
function OriginalDetails({ raw }: { raw: Raw }) {
  const fields = [
    ["meaning", "Nghĩa"],
    ["standard", "Cách nói phổ thông"],
    ["context", "Ví dụ / ngữ cảnh"],
    ["region", "Vùng sử dụng"],
    ["topic", "Chủ đề"],
    ["variants", "Biến thể"],
    ["evidence", "Chứng cứ / nguồn"],
  ] as const;
  return <dl className="demo-definition">
    {fields.filter(([key]) => raw[key]?.trim() && !(key === "standard" && raw[key].trim() === raw.text.trim())).map(([key, label]) => (
      <div key={key}><dt>{label}</dt><dd>{raw[key]}</dd></div>
    ))}
  </dl>;
}
function ReviewItem({ item: c }: { item: Contribution }) {
  const { state, run } = useDemo();
  const actor = state.people.find((p) => p.id === state.actor)!;
  const key = `review.${actor.id}.${c.id}`;
  const draft = state.drafts?.find((d) => d.key === key);
  const [note, setNote] = useState(draft?.raw.text ?? "");
  const [verdict, setVerdict] = useState<Vote["verdict"]>(() =>
    ["VERIFIED", "HOLD", "REJECT"].includes(draft?.raw.meaning ?? "")
      ? (draft!.raw.meaning as Vote["verdict"])
      : "HOLD",
  );
  const [checks, setChecks] = useState<boolean[]>(() => {
    try {
      const v = JSON.parse(draft?.raw.context ?? "null");
      if (
        Array.isArray(v) &&
        v.length === 4 &&
        v.every((x) => typeof x === "boolean")
      )
        return v;
    } catch {
      /* old draft */
    }
    return [false, false, false, false];
  });
  const [curated, setCurated] = useState<Raw>(() =>
    structuredClone(c.curated ?? c.raw),
  );
  const [sense, setSense] = useState(c.senseId ?? "");
  const [qa, setQA] = useState(c.qaAudio);
  const votes = state.votes.filter((v) => v.contributionId === c.id);
  const voted = votes.some((v) => v.reviewer === actor.id);
  const canSee = voted || (actor.role === "admin" && votes.length >= 2);
  const canAct = ["RAW", "REVIEW"].includes(c.status) && !voted;
  function saveDraft(n: string, v: Vote["verdict"], cs: boolean[]) {
    void run({
      type: "draft",
      key,
      raw: {
        ...blankRaw(),
        text: n,
        meaning: v,
        context: JSON.stringify(cs),
        method: "review-draft",
      },
      consent: consentDefault(),
      parent: null,
    }).catch(() => {});
  }
  return (
    <Panel title="Bản gốc & chứng cứ">
      <Status value={c.status} />
      <h3>{c.raw.text || c.raw.response}</h3>
      <OriginalDetails raw={c.raw} />
      {c.raw.mediaIds.map((id) => (
        <MediaPreview key={id} id={id} />
      ))}
      <p>
        {votes.length} phiếu độc lập · {duplicates(state, c.raw, c.id).length}{" "}
        mẫu trùng để đối chiếu.
      </p>
      {c.parent && state.contributions.find((x) => x.id === c.parent) && (
        <details>
          <summary>So sánh với bản trước</summary>
          <h3>{state.contributions.find((x) => x.id === c.parent)!.raw.text}</h3>
          <OriginalDetails raw={state.contributions.find((x) => x.id === c.parent)!.raw} />
        </details>
      )}
      {canSee && (
        <Panel title="Phiếu đã được phép xem">
          {votes.map((v, i) => (
            <p key={v.id}>
              Phiếu {i + 1}: {v.verdict} · {v.note}
            </p>
          ))}
        </Panel>
      )}
      {canAct && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await run({ type: "vote", id: c.id, verdict, checks, note });
              await run({ type: "clearDraft", key });
            } catch {
              /* Provider displays failures. */
            }
          }}
        >
          <fieldset>
            <legend>Phiếu của bạn</legend>
            {[
              "Nghĩa đúng",
              "Vùng có cơ sở",
              "Ngữ cảnh tự nhiên",
              "Bản phổ thông phù hợp",
            ].map((label, i) => (
              <label className="demo-checkbox" key={label}>
                <input
                  type="checkbox"
                  checked={checks[i]}
                  onChange={(e) => {
                    const cs = checks.map((v, n) =>
                      n === i ? e.target.checked : v,
                    );
                    setChecks(cs);
                    saveDraft(note, verdict, cs);
                  }}
                />
                {label}
              </label>
            ))}
            <Field label="Kết luận">
              <select
                value={verdict}
                onChange={(e) => {
                  const v = e.target.value as Vote["verdict"];
                  setVerdict(v);
                  saveDraft(note, v, checks);
                }}
              >
                <option value="HOLD">Cần bổ sung</option>
                <option value="VERIFIED" disabled={!checks.every(Boolean)}>
                  Xác minh
                </option>
                <option value="REJECT">Chưa chấp nhận</option>
              </select>
            </Field>
            <Field label="Lý do và hướng bổ sung *">
              <textarea
                value={note}
                required
                onChange={(e) => {
                  setNote(e.target.value);
                  saveDraft(e.target.value, verdict, checks);
                }}
              />
            </Field>
            <button className="btn btn-primary">Gửi phiếu độc lập</button>
          </fieldset>
        </form>
      )}
      {c.status === "HOLD" && (
        <p className="demo-note">
          Chờ tác giả tạo bản bổ sung. Bản mới trở lại RAW; bản gốc giữ nguyên.
        </p>
      )}
      {actor.role === "admin" &&
        c.status === "REVIEW" &&
        votes.length >= 2 &&
        new Set(votes.map((v) => v.verdict)).size > 1 && (
          <div>
            <Field label="Quyết định điều phối">
              <select
                value={verdict}
                onChange={(e) => setVerdict(e.target.value as Vote["verdict"])}
              >
                <option value="HOLD">Cần bổ sung</option>
                <option value="VERIFIED">Xác minh</option>
                <option value="REJECT">Chưa chấp nhận</option>
              </select>
            </Field>
            <Field label="Lý do phân xử">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
            <Action
              onClick={() => run({ type: "decide", id: c.id, verdict, note })}
            >
              Lưu phân xử độc lập
            </Action>
          </div>
        )}
      <div className="demo-actions">
        <Action
          disabled={!note.trim()}
          onClick={() =>
            run({
              type: "feedback",
              entity: c.id,
              text: `Yêu cầu bổ sung: ${note}`,
            })
          }
        >
          Gửi yêu cầu bổ sung
        </Action>
      </div>
      {c.status === "VERIFIED" && (
        <div>
          <h3>CURATED · giữ RAW riêng</h3>
          <div className="demo-form-grid">
            {(
              ["text", "meaning", "standard", "context", "variants"] as const
            ).map((k) => (
              <Field key={k} label={`Chuẩn hóa: ${k}`}>
                <textarea
                  value={curated[k]}
                  onChange={(e) =>
                    setCurated({ ...curated, [k]: e.target.value })
                  }
                />
              </Field>
            ))}
            <Field label="ID nghĩa: cùng ID để gộp biến thể; ID riêng để tách nghĩa">
              <input value={sense} onChange={(e) => setSense(e.target.value)} />
            </Field>
            <Field label="QA audio">
              <select value={qa} onChange={(e) => setQA(e.target.value)}>
                <option value="">Chưa kiểm / không có audio</option>
                <option value="pass">Nghe rõ, transcript phù hợp</option>
                <option value="hold">Cần thu lại / bổ sung transcript</option>
              </select>
            </Field>
          </div>
          <Action
            onClick={() =>
              run({
                type: "curate",
                id: c.id,
                raw: curated,
                senseId: sense || c.id,
                qaAudio: qa,
              })
            }
          >
            Lưu bản chuẩn hóa / nghĩa
          </Action>
          <ul>
            {exclusionReasons(state, c).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}
