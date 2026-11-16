import { useEffect, useRef, useState } from "react";
import { qualityReasonLabels } from "./contributionQuality";
import { BulkReviewControls } from "../dialect/ReviewPage";
import { useSearchParams } from "react-router-dom";
import { useDemo } from "./context";
import { blankRaw, consentDefault } from "./seed";
import { duplicates, exclusionReasons } from "./domain";
import { Action, DemoGuard, Field, Heading, Panel } from "./ui";
import { MediaPreview } from "./ContributionDemo";
import type { Contribution, Raw, Vote } from "./types";
import { isTestContribution } from "./testSessions";
import { useBlurValidation } from "../auth/useBlurValidation";
import { errorMessage } from "../../api/client";

const reviewLabels: Record<string, string> = { RAW: "Chờ duyệt", REVIEW: "Đang duyệt", VERIFIED: "Đạt", HOLD: "Cần bổ sung", REJECT: "Không đạt" };

export function ReviewDemo() {
  return (
    <DemoGuard review>
      <ReviewInner />
    </DemoGuard>
  );
}
function ReviewInner() {
  const { state, live, refresh } = useDemo();
  const reload = useRef(refresh);
  const [reloadError, setReloadError] = useState(false);
  useEffect(() => { reload.current = refresh; }, [refresh]);
  useEffect(() => {
    if (!live) return;
    let running = false;
    const timer = window.setInterval(() => {
      if (document.hidden || running) return;
      running = true;
      void reload.current().then(() => setReloadError(false)).catch(() => setReloadError(true)).finally(() => { running = false; });
    }, 15000);
    return () => window.clearInterval(timer);
  }, [live]);
  const [params, setParams] = useSearchParams();
  const done = params.get("view") === "done";
  const [region, setRegion] = useState("");
  const status = params.get("status") ?? "";
  const setStatus = (value: string) => setParams(previous => { const next = new URLSearchParams(previous); if (value) next.set("status", value); else next.delete("status"); return next; });
  const [selected, setSelected] = useState("");
  const reader = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!selected) return;
    reader.current?.focus({ preventScroll: true });
    if (window.matchMedia?.("(max-width: 900px)").matches) reader.current?.scrollIntoView?.({ block: "start", behavior: "instant" });
  }, [selected]);
  const [notice, setNotice] = useState("");
  const [page, setPage] = useState(1);
  const actor = state.people.find((p) => p.id === state.actor)!;
  const available = state.contributions.filter(
    (c) =>
      !c.withdrawn &&
      !isTestContribution(state, c) &&
      !c.duplicateOf &&
      (state.votes.some((v) => v.contributionId === c.id && v.reviewer === actor.id) === done) &&
      c.owner !== actor.id &&
      (["admin", "reviewer"].includes(actor.role) || c.raw.region === actor.region) &&
      (done || !!status || ["RAW", "REVIEW", "HOLD"].includes(c.status)),
  );
  const items = available.filter(c => (!region || c.raw.region === region) && (!status || c.status === status));
  const pages = Math.max(1, Math.ceil(items.length / 10));
  const currentPage = Math.min(page, pages);
  const visibleItems = items.slice((currentPage - 1) * 10, currentPage * 10);
  const item = items.find((c) => c.id === selected);
  const feedback = state.feedback.filter(f => f.state === "open" && (["admin", "reviewer"].includes(actor.role) || items.some(c => c.id === f.entity)));
  const filtered = !!region || !!status;
  return (
    <div className="review-workspace">
      <Heading title="Duyệt"><p>Mỗi mẫu cần 2 Reviewer độc lập.</p></Heading>
      <div className="demo-actions"><Action current={!done} onClick={() => setParams({})}>Chờ duyệt</Action><Action current={done} onClick={() => setParams({ view: "done" })}>Đã xử lý</Action><Action onClick={refresh}>Tải lại</Action></div>
      {reloadError && <p role="alert">Không tải được dữ liệu. Bấm Tải lại.</p>}
      <div className="demo-filters review-filters">
        {["admin", "reviewer"].includes(actor.role) && <Field label="Vùng sử dụng">
          <select
            value={region}
            onChange={(e) => {
              setRegion(e.target.value);
              setPage(1);
              setSelected("");
            }}
          >
            <option value="">Tất cả vùng</option>
            {[...new Set([...state.regions, ...state.contributions.map(c => c.raw.region)])].filter(Boolean).map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </Field>}
        <Field label="Trạng thái">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
              setSelected("");
            }}
          >
            <option value="">{done || ["admin", "reviewer"].includes(actor.role) ? "Tất cả trạng thái" : "Chờ tôi đánh giá"}</option>
            {["RAW", "REVIEW", "VERIFIED", "HOLD", "REJECT"].map((v) => (
              <option key={v} value={v}>{reviewLabels[v]}</option>
            ))}
          </select>
        </Field>
      </div>
      {notice && <p className="review-success" role="status"><i className="bi bi-check-circle" aria-hidden="true" /> {notice}</p>}
      <div className="demo-review-grid">
        <Panel title={`${items.length} mẫu`}>
          <div className="review-queue-list" role="group" aria-label="Danh sách chờ duyệt">
          {visibleItems.map((c) => (
            <button
              type="button"
              aria-pressed={selected === c.id}
              aria-label={`${c.raw.text || c.raw.response} · ${c.raw.region || "Chưa ghi vùng"} · ${reviewLabels[c.status]}`}
              className="demo-queue-button"
              key={c.id}
              onClick={() => { setSelected(c.id); setNotice(""); }}
            >
              <strong>{c.raw.text || c.raw.response}</strong>
              <span>
                {c.raw.region || "Chưa ghi vùng"}
              </span>
              <span className={`demo-status status-${c.status.toLowerCase()}`}>{reviewLabels[c.status]}</span>
              {c.status === "HOLD" && !!c.qualityReasons?.length && <span>Ghi chú kiểm tra ban đầu: {c.qualityReasons.map(reason => qualityReasonLabels[reason] ?? "Cần kiểm tra chất lượng nội dung.").join(" ")}</span>}
            </button>
          ))}
          </div>
          {pages > 1 && <div className="demo-actions review-pagination"><Action label="Trang trước" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Trước</Action><span aria-live="polite">{currentPage}/{pages}</span><Action label="Trang sau" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Sau</Action></div>}
          {!items.length && (
            <div className="review-empty"><i className="bi bi-inbox" aria-hidden="true" /><h3>{filtered ? "Không có kết quả phù hợp" : done ? "Chưa có đánh giá" : "Chưa có mẫu"}</h3><p>{filtered ? "Thử bỏ bộ lọc để xem các đóng góp khác." : done ? "Các đánh giá bạn gửi sẽ xuất hiện tại đây." : "Mẫu mới sẽ hiện tại đây."}</p>{filtered && <button type="button" className="btn btn-outline-primary" onClick={() => { setRegion(""); setStatus(""); }}>Bỏ bộ lọc</button>}</div>
          )}
        </Panel>
        <div ref={reader} className="review-reader" tabIndex={-1} aria-label="Nội dung mẫu">{item ? (
          <ReviewItem key={`${item.id}.${state.actor}`} item={item} onReviewed={() => { setSelected(""); setNotice("Đã gửi."); }} />
        ) : (
          <Panel title={items.length ? "Chọn mẫu" : "Nội dung"}>
            <div className="review-reader-empty"><i className="bi bi-file-earmark-text" aria-hidden="true" /><p>{items.length ? "Chọn một mẫu để bắt đầu." : "Chưa có mẫu."}</p></div>
          </Panel>
        )}</div>
      </div>
      <details className="review-help"><summary>Hướng dẫn</summary><div>
        <p><strong>Đạt:</strong> bạn xác nhận được cả bốn tiêu chí về nghĩa, vùng sử dụng, ngữ cảnh và cách nói phổ thông.</p>
        <p><strong>Cần bổ sung:</strong> nội dung có thể dùng được nhưng thiếu thông tin để xác nhận. Ghi cụ thể phần cần bổ sung.</p>
        <p><strong>Không đạt:</strong> nội dung sai hoặc không phù hợp. Giải thích lý do để người góp hiểu.</p>
        <p>Mỗi đóng góp cần hai người đánh giá độc lập. Bạn sẽ thấy đánh giá của người khác sau khi gửi đánh giá của mình. Khi hai người không thống nhất, Reviewer khác sẽ quyết định.</p>
        <p>Nội dung gốc luôn được giữ nguyên. Bản chỉnh lý chỉ được lưu sau khi đóng góp đã được duyệt đạt.</p>
      </div></details>
      {live && items.length > 0 && !done && <BulkReviewControls key={`${state.actor}.${region}.${status}.${currentPage}`} items={visibleItems.filter(c=>/^c:\d+$/.test(c.id)).map(c=>({id:Number(c.id.slice(2)),label:c.raw.text||c.raw.response}))} admin={["admin", "reviewer"].includes(actor.role)} reload={refresh}/>}
      {feedback.length > 0 && <Panel title={`Phản hồi cần xử lý (${feedback.length})`}>
        {feedback
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
      </Panel>}
    </div>
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
      <div key={key} className={["context", "evidence", "variants"].includes(key) ? "review-definition-wide" : undefined}><dt>{label}</dt><dd>{raw[key]}</dd></div>
    ))}
  </dl>;
}
function ReviewItem({ item: c, onReviewed }: { item: Contribution; onReviewed: () => void }) {
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
  const [curateBusy, setCurateBusy] = useState(false);
  const [curateSaved, setCurateSaved] = useState(false);
  const [curateError, setCurateError] = useState("");
  const curateLabels = { text: "cách nói địa phương", meaning: "nghĩa", standard: "cách nói phổ thông", context: "ví dụ hoặc ngữ cảnh" };
  const curateValidation = useBlurValidation(Object.fromEntries(Object.entries(curateLabels).map(([key, label]) => [key, () => curated[key as keyof typeof curateLabels].trim() ? "" : `Nhập ${label}.`])));
  const qa = c.qaAudio;
  const [sending, setSending] = useState(false);
  const votes = state.votes.filter((v) => v.contributionId === c.id);
  const voted = votes.some((v) => v.reviewer === actor.id);
  const canSee = voted || (["admin", "reviewer"].includes(actor.role) && votes.length >= 2);
  const canAct = ["RAW", "REVIEW"].includes(c.status) && !voted && votes.length < 2 && c.owner !== actor.id;
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
    <Panel title="Nội dung">
      <span className={`demo-status status-${c.status.toLowerCase()}`}>{reviewLabels[c.status]}</span>
      {c.status === "HOLD" && !!c.qualityReasons?.length && <p>Ghi chú kiểm tra ban đầu: {c.qualityReasons.map(reason => qualityReasonLabels[reason] ?? "Cần kiểm tra chất lượng nội dung.").join(" ")}</p>}
      <h3 className="review-original">{c.raw.text || c.raw.response}</h3>
      <OriginalDetails raw={c.raw} />
      {c.raw.mediaIds.map((id) => (
        <MediaPreview key={id} id={id} />
      ))}
      <p>
        Đã có {votes.length} đánh giá. Cần ít nhất 2 người duyệt độc lập.
      </p>
      {duplicates(state, c.raw, c.id).length > 0 && <p className="demo-note">Có {duplicates(state, c.raw, c.id).length} đóng góp tương tự. Hãy đọc kỹ ngữ cảnh để phân biệt.</p>}
      {c.parent && state.contributions.find((x) => x.id === c.parent) && (
        <details>
          <summary>So sánh với bản trước</summary>
          <h3>{state.contributions.find((x) => x.id === c.parent)!.raw.text}</h3>
          <OriginalDetails raw={state.contributions.find((x) => x.id === c.parent)!.raw} />
        </details>
      )}
      {canSee && (
        <Panel title="Các đánh giá đã gửi">
          {votes.map((v, i) => (
            <p key={v.id}>
              Đánh giá {i + 1}: {reviewLabels[v.verdict]} · {v.note}
            </p>
          ))}
        </Panel>
      )}
      {canAct && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (sending) return;
            setSending(true);
            try {
              await run({ type: "vote", id: c.id, verdict, checks, note });
              await run({ type: "clearDraft", key });
              onReviewed();
            } catch {
              /* Provider displays failures. */
            } finally {
              setSending(false);
            }
          }}
        >
          <fieldset className="review-checklist" disabled={sending}>
            <legend>Kiểm tra trước khi kết luận</legend>
            <p className="review-hint">Tích những mục bạn đã xác nhận. Chỉ chọn “Đạt” khi đủ cả 4 mục.</p>
            {[
              "Nghĩa được giải thích đúng",
              "Có cơ sở xác nhận vùng sử dụng",
              "Ví dụ và ngữ cảnh tự nhiên",
              "Cách nói phổ thông phù hợp",
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
            <Field label="Kết luận của bạn">
              <select
                value={verdict}
                onChange={(e) => {
                  const v = e.target.value as Vote["verdict"];
                  setVerdict(v);
                  saveDraft(note, v, checks);
                }}
              >
                <option value="HOLD">Cần bổ sung thông tin</option>
                <option value="VERIFIED" disabled={!checks.every(Boolean)}>
                  Đạt — đã xác nhận đủ 4 tiêu chí
                </option>
                <option value="REJECT">Không đạt — nội dung sai hoặc không phù hợp</option>
              </select>
            </Field>
            <Field label="Lý do đánh giá (bắt buộc)">
              <textarea
                value={note}
                required
                placeholder="Ví dụ: Chưa có câu ví dụ nên tôi chưa xác nhận được cách dùng. Vui lòng bổ sung một câu nói thực tế."
                onChange={(e) => {
                  setNote(e.target.value);
                  saveDraft(e.target.value, verdict, checks);
                }}
              />
            </Field>
            <p className="review-hint">Đánh giá của người khác được ẩn để bạn có thể quyết định độc lập.</p>
            <button className="btn btn-primary" disabled={sending || !note.trim() || (verdict === "VERIFIED" && !checks.every(Boolean))}>{sending ? "Đang gửi đánh giá…" : "Gửi đánh giá"}</button>
          </fieldset>
        </form>
      )}
      {c.status === "HOLD" && (
        <p className="demo-note">
          Đóng góp đang được giữ để kiểm tra hoặc chờ người góp bổ sung. Bạn chưa thể gửi đánh giá ở trạng thái này. Người kiểm duyệt có thể đưa lại vào hàng chờ sau khi kiểm tra.
        </p>
      )}
      {["admin", "reviewer"].includes(actor.role) &&
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
      {canAct && <details className="review-follow-up"><summary>Gửi yêu cầu riêng cho người góp</summary><p className="review-hint">Dùng lý do đã nhập ở trên để gửi một phản hồi riêng. Thao tác này không thay thế việc gửi đánh giá.</p><div className="demo-actions">
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
      </div></details>}
      {c.status === "VERIFIED" && (
        <div>
          <h3>Chỉnh lý nội dung đã duyệt</h3>
          <p className="review-hint">Lưu một bản đã chỉnh lý để sử dụng trong bộ dữ liệu. Nội dung người góp gửi vẫn được giữ nguyên.</p>
          <form noValidate aria-busy={curateBusy} onSubmit={async e => {
            e.preventDefault();
            if (!curateValidation.validate(e)) return;
            setCurateBusy(true); setCurateSaved(false); setCurateError("");
            try { await run({ type: "curate", id: c.id, raw: curated, senseId: sense || c.id, qaAudio: qa }); setCurateSaved(true); }
            catch (error) { setCurateError(errorMessage(error)); }
            finally { setCurateBusy(false); }
          }}><fieldset disabled={curateBusy}>
          <div className="demo-form-grid">
            {(
              ["text", "meaning", "standard", "context", "variants"] as const
            ).map((k) => (
              <Field key={k} label={({text:"Cách nói *",meaning:"Nghĩa *",standard:"Cách nói phổ thông *",context:"Ví dụ / ngữ cảnh *",variants:"Cách nói tương tự · tùy chọn"})[k]}>
                <textarea
                  name={k}
                  maxLength={5000}
                  required={k !== "variants"}
                  value={curated[k]}
                  onBlur={() => { if (k in curateLabels) curateValidation.blur(k); }}
                  aria-invalid={!!curateValidation.errors[k]} aria-describedby={curateValidation.errors[k] ? `curate-${k}-error` : undefined}
                  onChange={(e) =>
                    { setCurated({ ...curated, [k]: e.target.value }); setCurateSaved(false); }
                  }
                />
                {curateValidation.errors[k] && <span className="bz-field-error" id={`curate-${k}-error`} role="alert">{curateValidation.errors[k]}</span>}
              </Field>
            ))}
            <Field label="Mã nghĩa: dùng chung để gộp biến thể, dùng riêng để tách nghĩa">
              <input value={sense} onChange={(e) => { setSense(e.target.value); setCurateSaved(false); }} />
            </Field>

          </div>
          <button className="btn btn-primary" disabled={curateBusy}>{curateBusy ? "Đang lưu…" : "Lưu"}</button>
          </fieldset></form>
          {curateSaved && <p className="demo-success" role="status">Đã lưu chỉnh lý.</p>}
          {curateError && <p className="demo-error" role="alert">{curateError}</p>}
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
