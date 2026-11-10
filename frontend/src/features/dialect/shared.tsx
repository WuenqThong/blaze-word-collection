import { Link } from "react-router-dom";
import { Alert, Badge, Spinner } from "react-bootstrap";
import { STATUS, type Contribution } from "./types";

export function ResourceState({error, retry}: {error: string | null; retry: () => void}) {
  return error ? <Alert variant="danger" role="alert"><p>{error}</p><button type="button" className="btn btn-outline-danger" onClick={retry}>Thử lại</button></Alert>
    : <div className="collection-empty" role="status"><Spinner size="sm" animation="border" /><p className="mt-3">Đang tải dữ liệu…</p></div>;
}
export function PageHeading({eyebrow, title, description, action}: {eyebrow?: string; title: string; description: string; action?: React.ReactNode}) {
  return <div className="dialect-heading"><div><div className="page-eyebrow">{eyebrow ?? "BLAZE / PHƯƠNG NGỮ"}</div><h1>{title}</h1><p>{description}</p></div>{action && <div className="dialect-heading-action">{action}</div>}</div>;
}
export function ContributionBadge({item}: {item: Contribution}) {
  return <Badge bg={item.withdrawn_at ? "secondary" : STATUS[item.status].tone}>{item.withdrawn_at ? "Đã rút mẫu" : STATUS[item.status].label}</Badge>;
}
export function ContributionContent({item}: {item: Contribution}) {
  return <div className="dialect-content"><div className="d-flex align-items-center justify-content-between gap-3"><span className="page-eyebrow">{item.raw.kind === "word" ? "TỪ / CỤM TỪ" : "CÂU HỘI THOẠI"} · #{item.id}</span><ContributionBadge item={item} /></div><h2>{item.raw.original_text}</h2><dl className="dialect-definition">{[["Người góp giải thích",item.raw.meaning],["Cách nói phổ thông",item.raw.standard_vi],["Vùng sử dụng",item.raw.region],["Ví dụ / ngữ cảnh",item.raw.context],["Nguồn / bối cảnh đã nghe",item.raw.source_evidence]].map(([label,text]) => <div key={label}><dt>{label}</dt><dd>{text}</dd></div>)}</dl></div>;
}
export function Pagination({page, total, onChange}: {page: number; total: number; onChange: (n: number) => void}) {
  return <div className="dialect-pagination"><span>{total} mẫu · Trang {page + 1}/{Math.max(1,Math.ceil(total / 25))}</span><div className="d-flex gap-2"><button className="btn btn-outline-secondary" disabled={page === 0} onClick={() => onChange(page - 1)}>Trước</button><button className="btn btn-outline-secondary" disabled={(page + 1) * 25 >= total} onClick={() => onChange(page + 1)}>Sau</button></div></div>;
}
export function EmptyContributions() { return <div className="collection-empty"><i className="bi bi-journal-text" aria-hidden="true" /><h2>Bắt đầu từ một cách nói quen thuộc</h2><p>Góp một từ, cụm từ hoặc câu hội thoại bạn đã nghe trong đời sống.</p><Link className="btn btn-primary" to="/contribute/new">Góp mẫu đầu tiên</Link></div>; }

export function UsageStatus({item}: {item: Contribution}) {
  return <div className="dialect-usage-status" aria-label="Kiểm tra sử dụng dữ liệu">
    <div><span>Đánh giá nội dung</span><ContributionBadge item={item}/></div>
    <div><span>Quyền nguồn</span><strong>{item.rights_confirmed ? "Đã rà soát" : "Chờ rà soát"}</strong></div>
    <div><span>Đồng ý huấn luyện</span><strong>{item.raw.consent_train ? "Cho phép" : "Không cho phép"}</strong></div>
    <div><span>Đồng ý công khai</span><strong>{item.raw.consent_public ? "Cho phép" : "Không cho phép"}</strong></div>
    <div><span>Trạng thái rút</span><strong>{item.withdrawn_at ? "Đã rút mẫu" : "Chưa rút mẫu"}</strong></div>
  </div>;
}
