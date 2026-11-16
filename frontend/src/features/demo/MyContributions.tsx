import { ResponsiveTable } from "../../components/ResponsiveTable";
import { displayLabel, systemText } from "../../lib/display";
import { SyncItem } from "./SyncStatus";
import { qualityReasonLabels } from './contributionQuality';
import { Modal } from "react-bootstrap";
import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import { useDemo } from "./context";
import { Action, Field, Panel, Status } from "./ui";
import { ConsentFields } from "./GamePages";
import { isTestContribution } from "./testSessions";
import type { Contribution, Raw } from "./types";

const STATUS_FILTERS: [string, string][] = [
  ["", "Tất cả"],
  ["RAW", "Bản gốc"],
  ["REVIEW", "Đang duyệt"],
  ["VERIFIED", "Đã xác minh"],
  ["HOLD", "Cần bổ sung"],
  ["REJECT", "Chưa chấp nhận"],
  ["withdrawn", "Đã rút"],
];

const RESPONSE_LABEL: Record<Raw["response"], string> = {
  answer: "",
  unknown: "Không biết",
  no_term: "Không có từ riêng",
  same_standard: "Giống cách nói phổ thông",
};

const DETAIL_FIELDS: [keyof Raw, string][] = [
  ["meaning", "Nghĩa"],
  ["standard", "Cách nói phổ thông"],
  ["context", "Ví dụ / ngữ cảnh"],
  ["region", "Vùng sử dụng"],
  ["topic", "Chủ đề"],
  ["variants", "Biến thể"],
  ["evidence", "Nguồn / nơi nghe"],
];

const EVENT_LABEL: Record<string, string> = {
  CONTRIBUTE: "Đã gửi",
  SUBMITTED: "Đã gửi",
  CONSENT: "Đổi phạm vi đồng ý",
  CONSENT_CHANGED: "Đổi phạm vi đồng ý",
  WITHDRAWN: "Đã rút",
  WITHDRAW_SESSION: "Rút cả lượt chơi",
  VOTE: "Có phiếu duyệt",
  DECIDE: "Đã có kết luận",
  FINALIZED: "Đã có kết luận",
  CURATE: "Đã chuẩn hóa",
  CURATED: "Đã chuẩn hóa",
  SYNC_REJECTED: "Máy chủ không nhận",
};

const when = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh",
});
function formatAt(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : when.format(d);
}

function title(c: Contribution) {
  return c.raw.text.trim() || RESPONSE_LABEL[c.raw.response] || "(trống)";
}

function consentSummary(c: Contribution) {
  const scopes = [c.consent.train && "Huấn luyện", c.consent.public && "Công khai", c.consent.audio && "Âm thanh"].filter(Boolean);
  return scopes.length ? scopes.join(" · ") : "Chỉ tiếp nhận";
}

export function MyContributions() {
  const { state } = useDemo();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const mine = state.contributions.filter((c) => c.owner === state.actor && !isTestContribution(state, c));
  const q = query.trim().toLocaleLowerCase("vi");
  const rows = mine
    .filter((c) => !q || [c.raw.text, c.raw.meaning, c.raw.standard, c.raw.region].some((v) => v.toLocaleLowerCase("vi").includes(q)))
    .filter((c) => !status || (status === "withdrawn" ? c.withdrawn : !c.withdrawn && c.status === status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <Panel title="Đóng góp của tôi">
      <div className="demo-filters">
        <Field label="Tìm cách nói, nghĩa hoặc vùng">
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
        </Field>
        <Field label="Trạng thái">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_FILTERS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </Field>
      </div>
      {!mine.length ? (
        <div className="demo-empty-inline">
          <p>Bạn chưa có đóng góp nào.</p>
          <Link className="btn btn-primary" to="/demo/play">Chơi trò chơi 10 câu</Link>
        </div>
      ) : (
        <>
          <p className="demo-note" aria-live="polite">
            {rows.length === mine.length ? `${mine.length} đóng góp` : `${rows.length} / ${mine.length} đóng góp khớp bộ lọc`}
          </p>
          <ResponsiveTable>
            <table className="demo-my-contributions">
              <thead>
                <tr>
                  <th scope="col">Cách nói</th>
                  <th scope="col">Nghĩa</th>
                  <th scope="col">Vùng</th>
                  <th scope="col">Gửi lúc</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col">Phạm vi đồng ý</th>
                  <th scope="col"><span className="visually-hidden">Thao tác</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const expanded = open === c.id;
                  const detailId = `contribution-detail-${c.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
                  return (
                    <Fragment key={c.id}>
                      <tr className={expanded ? "is-open" : undefined}>
                        <th scope="row">{title(c)}</th>
                        <td>{c.raw.meaning || "—"}</td>
                        <td>{c.raw.region || "—"}</td>
                        <td className="demo-nowrap">{formatAt(c.createdAt)}</td>
                        <td><Status value={c.withdrawn ? "withdrawn" : c.status} />{c.status === 'HOLD' && c.qualityReasons?.map((reason) => <p className="demo-note" key={reason}>{qualityReasonLabels[reason] ?? "Cần kiểm tra chất lượng"}</p>)}<SyncItem c={c} /></td>
                        <td>{consentSummary(c)}</td>
                        <td className="demo-nowrap">
                          <button
                            type="button"
                            className="btn btn-outline-primary btn-sm"
                            aria-expanded={expanded}
                            aria-controls={detailId}
                            onClick={() => setOpen(expanded ? null : c.id)}
                          >
                            {expanded ? "Đóng" : "Chi tiết"}
                          </button>
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="demo-detail-row" id={detailId}>
                          <td colSpan={7}>
                            <ContributionDetail c={c} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {!rows.length && (
                  <tr>
                    <td colSpan={7}>Không có đóng góp nào khớp bộ lọc.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </ResponsiveTable>
        </>
      )}
    </Panel>
  );
}

function ConsentEditor({ c }: { c: Contribution }) {
  const { run } = useDemo();
  const [draft, setDraft] = useState(c.consent);
  const [confirm, setConfirm] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(c.consent);
  return <><ConsentFields value={draft} required={false} onChange={next => { setDraft(next); setSaved(false); }} /><p className="demo-note">Thay đổi chỉ có hiệu lực sau khi lưu và xác nhận. Thu hẹp quyền huấn luyện hoặc rút mẫu sẽ chặn các bản xuất liên quan; không tự xóa những bản đã tải về trước đó.</p><Action disabled={!dirty} onClick={() => setConfirm(true)}>Lưu phạm vi sử dụng</Action>{saved && <p role="status">Đã lưu phạm vi sử dụng.</p>}
    <Modal aria-label="Xác nhận phạm vi sử dụng" centered show={confirm} onHide={() => setConfirm(false)}><Modal.Header closeLabel="Đóng" closeButton><Modal.Title>Xác nhận phạm vi sử dụng</Modal.Title></Modal.Header><Modal.Body><p>Tiếp nhận & kiểm duyệt: {draft.collect ? "Cho phép" : "Không cho phép"}</p><p>Huấn luyện: {draft.train ? "Cho phép" : "Không cho phép"}</p><p>Công khai: {draft.public ? "Cho phép" : "Không cho phép"}</p><p>Quyền mới sẽ được kiểm tra khi tạo hoặc tải bản xuất.</p></Modal.Body><Modal.Footer><button type="button" className="btn btn-outline-secondary" onClick={() => setConfirm(false)}>Quay lại sửa</button><Action onClick={async () => { await run({ type: "consent", id: c.id, consent: draft, withdraw: c.withdrawn }); setConfirm(false); setSaved(true); }}>Xác nhận lưu phạm vi</Action></Modal.Footer></Modal>
  </>;
}

function ContributionDetail({ c }: { c: Contribution }) {
  const { state, run } = useDemo();
  const [confirm, setConfirm] = useState(false);
  const fields = DETAIL_FIELDS.filter(([k]) => String(c.raw[k] ?? "").trim());
  const events = state.events.filter((e) => e.entity === c.id).sort((a, b) => a.at.localeCompare(b.at));
  const parent = c.parent && state.contributions.find((x) => x.id === c.parent);
  return (
    <div className="demo-detail-grid">
      <section>
        <h3>Nội dung đã gửi</h3>
        {fields.length ? (
          <dl className="demo-definition">
            {fields.map(([k, label]) => (
              <div key={k}><dt>{label}</dt><dd>{String(c.raw[k])}</dd></div>
            ))}
          </dl>
        ) : (
          <p>{RESPONSE_LABEL[c.raw.response] || "Không có thêm thông tin."}</p>
        )}
        {parent && <p className="demo-note">Bổ sung cho “{title(parent)}”.</p>}
        {!!events.length && (
          <>
            <h3>Lịch sử</h3>
            <ol className="demo-timeline">
              {events.map((e) => (
                <li key={e.id}>
                  <span className="demo-nowrap">{formatAt(e.at)}</span> · {EVENT_LABEL[e.action] ?? displayLabel(e.action, "Cập nhật dữ liệu")}
                  {e.note ? ` — ${systemText(e.note)}` : ""}
                </li>
              ))}
            </ol>
          </>
        )}
      </section>
      <section>
        {!!c.qualityReasons?.length && <p>{c.qualityReasons.map(reason => qualityReasonLabels[reason] ?? "Cần kiểm tra chất lượng").join(" · ")}</p>}
        {c.id.startsWith("c:") && <ConsentEditor c={c} />}
        <div className="demo-actions">
          <Link className="btn btn-outline-primary" to={`/demo/contribute?kind=${c.raw.kind}${c.id.startsWith("c:") ? `&parent=${c.id}` : ""}`}>
            Bổ sung phiên bản
          </Link>
          {c.id.startsWith("c:") && !c.withdrawn && !confirm && (
            <button type="button" className="btn btn-outline-danger" onClick={() => setConfirm(true)}>
              Rút mẫu này
            </button>
          )}
        </div>
        {c.id.startsWith("c:") && !c.withdrawn && confirm && (
          <div className="demo-confirm" role="alertdialog" aria-label="Xác nhận rút mẫu">
            <p>
              Mẫu sẽ bị loại khỏi các lần xuất dữ liệu sau và không khôi phục lại được. Bản gốc và
              lịch sử vẫn được giữ.
            </p>
            <div className="demo-actions">
              <button type="button" className="btn btn-outline-secondary" onClick={() => setConfirm(false)}>Giữ mẫu</button>
              <Action onClick={() => run({ type: "consent", id: c.id, consent: c.consent, withdraw: true })}>
                Xác nhận rút mẫu
              </Action>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
