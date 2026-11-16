import { displayLabel, systemText } from "../lib/display";

export function DataCardView({ value }: { value: string }) {
  let card: { counts?: { records?: number; groups?: number; splits?: Record<string, number> }; warnings?: string[]; usage?: string; expert_review?: { status: string }; deduplication?: { excluded: unknown[] }; provenance?: { id: number; source_id: number; scopes?: Record<string, boolean> }[] };
  try { card = JSON.parse(value); } catch { return <p>{value ? systemText(value) : "Chưa có thông tin mô tả bộ dữ liệu."}</p>; }
  if (!card || typeof card !== "object") return <p>Chưa có thông tin mô tả bộ dữ liệu.</p>;
  return <div>
    <p>Phạm vi: dữ liệu đã duyệt để chuẩn bị huấn luyện nội bộ. Chưa được coi là bộ dữ liệu đánh giá chuẩn.</p>
    {card.expert_review?.status === "pending" && <p>Tập kiểm tra chưa được chuyên gia xác nhận. Chia nhóm kiểm thử không có nghĩa là đã có đáp án chuẩn.</p>}
    {card.counts && <dl className="demo-definition"><div><dt>Số mẫu</dt><dd>{card.counts.records ?? 0}</dd></div><div><dt>Số nhóm độc lập</dt><dd>{card.counts.groups ?? 0}</dd></div>{Object.entries(card.counts.splits ?? {}).map(([split, count]) => <div key={split}><dt>{displayLabel(split, "Nhóm khác")}</dt><dd>{count}</dd></div>)}</dl>}
    {card.usage && <p>{systemText(card.usage)}</p>}
    {card.warnings?.map(warning => <p key={warning}>{systemText(warning)}</p>)}
    {!!card.provenance?.length && <details><summary>Nguồn và quyền của từng mẫu ({card.provenance.length})</summary><ul>{card.provenance.map(item => <li key={item.id}>Mẫu #{item.id} · Nguồn #{item.source_id} · Huấn luyện: {item.scopes?.train ? "Cho phép" : "Không cho phép"} · Công khai: {item.scopes?.public ? "Cho phép" : "Không cho phép"} · Âm thanh: {item.scopes?.audio ? "Cho phép" : "Không cho phép"}</li>)}</ul></details>}
  </div>;
}
