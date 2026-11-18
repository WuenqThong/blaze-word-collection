import { useEffect, useRef, useState } from "react";
import { qualityReasonLabels } from "./contributionQuality";
import { useSearchParams } from "react-router-dom";
import { useDemo } from "./context";
import { blankRaw, consentDefault } from "./seed";
import { reviewDigest, reviewDraftKey } from "./reviewVersion";
import { duplicates, exclusionReasons } from "./domain";
import { Action, DemoGuard, Field, Heading, Panel } from "./ui";
import { MediaPreview } from "./ContributionDemo";
import type { Contribution, Raw, Vote } from "./types";
import { isTestContribution } from "./testSessions";
import { useBlurValidation } from "../auth/useBlurValidation";
import { errorMessage } from "../../api/client";
import { displayLabel } from "../../lib/display";

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
      (status === "VERIFIED" || state.votes.some((v) => v.contributionId === c.id && v.reviewer === actor.id) === done) &&
      c.owner !== actor.id &&
      (["admin", "reviewer"].includes(actor.role) || (c.curated ?? c.raw).region === actor.region) &&
      (done || !!status || ["RAW", "REVIEW", "HOLD"].includes(c.status)),
  );
  const items = available.filter(c => (!region || (c.curated ?? c.raw).region === region) && (!status || c.status === status));
  const pages = Math.max(1, Math.ceil(items.length / 5));
  const currentPage = Math.min(page, pages);
  const visibleItems = items.slice((currentPage - 1) * 5, currentPage * 5);
  const item = state.contributions.find((c) => c.id === selected);
  const filtered = !!region || !!status;
  return (
    <div className="review-workspace">
      <Heading title="Duyệt"><p>Mỗi mẫu cần 1 Reviewer độc lập.</p></Heading>
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
            {[...new Set([...state.regions, ...state.contributions.map(c => (c.curated ?? c.raw).region)])].filter(Boolean).map((v) => (
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
            <option value="">{done ? "Tất cả trạng thái" : "Chờ tôi đánh giá"}</option>
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
              aria-label={`${(c.curated ?? c.raw).text || c.raw.response} · ${(c.curated ?? c.raw).region || "Chưa ghi vùng"} · ${reviewLabels[c.status]} · Phiên bản ${c.reviewRevision ?? 1}`}
              className="demo-queue-button"
              key={c.id}
              onClick={() => { setSelected(c.id); setNotice(""); }}
            >
              <strong>{(c.curated ?? c.raw).text || c.raw.response}</strong>
              <small>Phiên bản {c.reviewRevision ?? 1}</small>
              <span className="review-queue-region">
                {(c.curated ?? c.raw).region || "Chưa ghi vùng"}
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
          <ReviewSnapshot key={`${item.id}.${state.actor}`} item={item} onCurated={(pending) => { setNotice(pending ? "Đã lưu bản mới. Cần một người duyệt lại." : "Đã lưu chỉnh lý."); if (pending) setParams({}); }} onReviewed={() => { setSelected(""); setNotice("Đã gửi."); }} />
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
        <p>Mỗi mẫu chỉ cần một Reviewer kết luận. Không tự duyệt mẫu của mình. Nếu sửa nội dung, mẫu cần được duyệt lại.</p>
        <p>Nội dung gốc luôn được giữ nguyên. Bản chỉnh lý chỉ được lưu sau khi đóng góp đã được duyệt đạt.</p>
      </div></details>
    </div>
  );
}
function OriginalDetails({ raw }: { raw: Raw }) {
  const fields = [
    ["kind", "Loại nội dung"],
    ["meaning", "Nghĩa"],
    ["standard", "Cách nói phổ thông"],
    ["context", "Ví dụ / ngữ cảnh"],
    ["region", "Vùng sử dụng"],
    ["topic", "Chủ đề"],
    ["partOfSpeech", "Từ loại"],
    ["keywords", "Từ khóa"],
    ["variants", "Biến thể"],
    ["evidence", "Chứng cứ / nguồn"],
  ] as const;
  return <dl className="demo-definition">
    {fields.filter(([key]) => raw[key]?.trim() && !(key === "standard" && raw[key].trim() === raw.text.trim())).map(([key, label]) => (
      <div key={key} className={["context", "evidence", "variants"].includes(key) ? "review-definition-wide" : undefined}><dt>{label}</dt><dd>{key === "kind" ? displayLabel(raw[key]) : raw[key]}</dd></div>
    ))}
  </dl>;
}
// Keep inputs and their version together until the reviewer explicitly reloads.
function ReviewSnapshot({ item, onReviewed, onCurated }: { item: Contribution; onReviewed: () => void; onCurated: (pending: boolean) => void }) {
  const [snapshot, setSnapshot] = useState(() => structuredClone(item));
  const stale = reviewDigest(snapshot) !== reviewDigest(item);
  return <>
    {stale && <div role="status" className="demo-note"><p>Mẫu đã được sửa. Nội dung bạn đang nhập vẫn được giữ.</p><button type="button" className="btn btn-outline-primary" onClick={() => {
      if (window.confirm("Tải bản mới và bỏ phần đang nhập?")) setSnapshot(structuredClone(item));
    }}>Xem bản mới</button></div>}
    <ReviewItem key={reviewDigest(snapshot)} item={snapshot} stale={stale} canProcessLatest={item.consent.collect === true && !item.withdrawn} onReviewed={onReviewed} onCurated={next => {
      setSnapshot(structuredClone(next));
      onCurated(next.status === "RAW");
    }} />
  </>;
}
function ReviewItem({ item: c, stale, canProcessLatest, onReviewed, onCurated }: { item: Contribution; stale: boolean; canProcessLatest: boolean; onReviewed: () => void; onCurated: (next: Contribution) => void }) {
  const { state, run } = useDemo();
  const actor = state.people.find((p) => p.id === state.actor)!;
  const key = reviewDraftKey(actor.id, c);
  const current = c.curated ?? c.raw;
  const expectedDigest = c.reviewDigest ?? reviewDigest(c);
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
  const [curateError, setCurateError] = useState("");
  const [draftError, setDraftError] = useState("");
  const curateLabels = { text: "cách nói địa phương", meaning: "nghĩa", standard: "cách nói phổ thông", context: "ví dụ hoặc ngữ cảnh" };
  const curateValidation = useBlurValidation(Object.fromEntries(Object.entries(curateLabels).map(([key, label]) => [key, () => curated[key as keyof typeof curateLabels].trim() ? "" : `Nhập ${label}.`])));
  const qa = c.qaAudio;
  const [sending, setSending] = useState(false);
  const [openedVotes] = useState(() => state.votes.filter(v => v.contributionId === c.id));
  const votes = stale ? openedVotes : state.votes.filter((v) => v.contributionId === c.id);
  const voted = votes.some((v) => v.reviewer === actor.id);
  const canSee = voted || (["admin", "reviewer"].includes(actor.role) && votes.length >= 1);
  const canProcess = canProcessLatest && c.consent.collect === true && !c.withdrawn;
  const canAct = canProcess && ["RAW", "REVIEW"].includes(c.status) && !voted && votes.length < 1 && c.owner !== actor.id;
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
    }).then(() => setDraftError("")).catch(() => setDraftError("Chưa lưu được nháp đánh giá. Giữ trang này và thử lại."));
  }
  return (
    <Panel title="Nội dung">
      {draftError && <p role="alert" className="demo-error">{draftError}</p>}
      <span className={`demo-status status-${c.status.toLowerCase()}`}>{reviewLabels[c.status]}</span>
      {c.status === "HOLD" && !!c.qualityReasons?.length && <p>Ghi chú kiểm tra ban đầu: {c.qualityReasons.map(reason => qualityReasonLabels[reason] ?? "Cần kiểm tra chất lượng nội dung.").join(" ")}</p>}
      <p><strong>Phiên bản {c.reviewRevision ?? 1} · Nội dung đang được đánh giá</strong></p>
      <h3 className="review-original">{current.text || current.response}</h3>
      <OriginalDetails raw={current} />
      {c.senseId && <p>Mã nghĩa: {c.senseId}</p>}
      <details><summary>Bản gốc người góp gửi</summary><h3>{c.raw.text || c.raw.response}</h3><OriginalDetails raw={c.raw} /></details>
      <details><summary>Lịch sử phiên bản ({c.reviewHistory?.length ?? 0})</summary>
        {(c.reviewHistory ?? []).map(h => <section key={h.revision} aria-label={`Phiên bản lưu trữ ${h.revision}`}>
          <h3>Phiên bản {h.revision} · {reviewLabels[h.status]} · {h.votes.length} đánh giá đã lưu trữ</h3>
          <h4>{h.content.text}</h4><OriginalDetails raw={h.content} />
          {h.senseId && <p>Mã nghĩa: {h.senseId}</p>}
          <p>Lưu trữ: {new Date(h.archivedAt).toLocaleString("vi-VN")}</p>
          {h.votes.map((v, i) => <p key={v.id}>Đánh giá lưu trữ {i + 1}: {reviewLabels[v.verdict]} · {v.note}</p>)}
        </section>)}
        {!c.reviewHistory?.length && <p>Chưa có phiên bản lưu trữ.</p>}
      </details>
      {!canProcess && <p role="status">Mẫu đã dừng tiếp nhận. Chỉ xem lịch sử, không thể duyệt hoặc chỉnh lý.</p>}
      {c.raw.mediaIds.map((id) => (
        <MediaPreview key={id} id={id} />
      ))}
      <p>
        {votes.length ? "Đã có kết quả duyệt." : "Chưa được duyệt."}
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
          {votes.map((v) => (
            <p key={v.id}>
              Kết quả: {reviewLabels[v.verdict]} · {v.note}
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
              await run({ type: "vote", id: c.id, expectedDigest, verdict, checks, note });
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
      {canProcess && ["admin", "reviewer"].includes(actor.role) &&
        c.status === "REVIEW" &&
        votes.length >= 1 &&
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
              onClick={() => run({ type: "decide", id: c.id, expectedDigest, verdict, note })}
            >
              Lưu phân xử độc lập
            </Action>
          </div>
        )}
      {canProcess && c.status === "VERIFIED" && (
        <div>
          <h3>Chỉnh lý nội dung đã duyệt</h3>
          <p className="review-hint">Thay đổi nội dung sẽ mở phiên bản mới và cần một người duyệt lại. Nội dung người góp gửi luôn được giữ nguyên.</p>
          <form noValidate aria-busy={curateBusy} onSubmit={async e => {
            e.preventDefault();
            if (!curateValidation.validate(e)) return;
            setCurateBusy(true); setCurateError("");
            try { const next = await run({ type: "curate", id: c.id, expectedDigest, raw: curated, senseId: sense, qaAudio: qa }); const saved = next.contributions.find(item => item.id === c.id); if (saved) onCurated(saved); }
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
                    { setCurated({ ...curated, [k]: e.target.value }); }
                  }
                />
                {curateValidation.errors[k] && <span className="bz-field-error" id={`curate-${k}-error`} role="alert">{curateValidation.errors[k]}</span>}
              </Field>
            ))}
            <Field label="Mã nghĩa: dùng chung để gộp biến thể, dùng riêng để tách nghĩa">
              <input value={sense} onChange={(e) => { setSense(e.target.value); }} />
            </Field>

          </div>
          <button className="btn btn-primary" disabled={curateBusy}>{curateBusy ? "Đang lưu…" : "Lưu"}</button>
          </fieldset></form>
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
