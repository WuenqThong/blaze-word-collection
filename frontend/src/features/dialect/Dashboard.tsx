import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useResource } from "./useResource";
import { ContributionBadge, PageHeading, ResourceState } from "./shared";
import { dateLabel, type Contribution, type Page } from "./types";

export function DialectDashboard() {
  const {user} = useAuth();
  if (user?.role === "admin") return <AdminDashboard/>;
  if (user?.role === "reviewer") return <ReviewerDashboard/>;
  return <ContributorDashboard/>;
}

function ContributorDashboard() {
  const r = useResource<Page<Contribution>>("/dialect/contributions?limit=5");
  return <>
    <PageHeading eyebrow="KHÔNG GIAN ĐÓNG GÓP" title="Mỗi cách nói đều đáng được hiểu." description="Ghi lại từ ngữ quê mình, thêm một chút bối cảnh. Phần còn lại, chúng ta cùng kiểm chứng."/>
    <div className="dialect-contribution-options">{[["word","bi-journal-text","Một từ, nhiều câu chuyện","Góp từ / cụm từ","Một cách gọi, một lối xưng hô, một từ vẫn nghe trong nhà."],["sentence","bi-chat-square-text","Giữ cả tình huống sử dụng","Góp câu hội thoại","Một câu thường nói, cùng nghĩa và cách diễn đạt phổ thông."]].map(([kind,icon,eyebrow,title,description])=><Link key={kind} className="dialect-option-card" to={`/contribute/new?kind=${kind}`}><div className="dialect-icon-tile"><i className={`bi ${icon}`} aria-hidden="true"/></div><small>{eyebrow}</small><h2>{title}</h2><p>{description}</p><span>Bắt đầu đóng góp <i className="bi bi-arrow-right" aria-hidden="true"/></span></Link>)}</div>
    <section className="dialect-surface"><div className="dialect-section-heading"><div><h2>Đóng góp gần đây</h2><p>Theo dõi phản hồi và bước tiếp theo của từng mẫu.</p></div><Link to="/my/contributions">Xem tất cả <i className="bi bi-arrow-right" aria-hidden="true"/></Link></div>{!r.data?<ResourceState error={r.error} retry={r.reload}/>:!r.data.items.length?<div className="dialect-inline-empty"><i className="bi bi-journal-plus" aria-hidden="true"/><h3>Chưa có đóng góp nào</h3><p>Bắt đầu bằng một cách nói bạn thực sự biết.</p></div>:<div className="dialect-compact-list">{r.data.items.map(item=><Link key={item.id} to={`/my/contributions/${item.id}`}><div><strong>{item.raw.original_text}</strong><small>#{item.id} · {item.raw.region} · {dateLabel(item.created_at)}</small></div><ContributionBadge item={item}/></Link>)}</div>}</section>
    <div className="dialect-bottom-note"><i className="bi bi-shield-check" aria-hidden="true"/><p>Bạn chọn riêng quyền huấn luyện và công khai. Có thể xem lại nội dung hoặc rút từng mẫu trong tài khoản.</p><Link to="/about-data">Quyền dữ liệu</Link></div>
  </>;
}

function ReviewerDashboard() {
  const pending = useResource<Page<Contribution>>("/dialect/reviews?view=pending");
  const mine = useResource<Page<Contribution>>("/dialect/reviews?view=mine");
  const hold = useResource<Page<Contribution>>("/dialect/reviews?view=hold");
  return <><PageHeading eyebrow="KHÔNG GIAN ĐÁNH GIÁ" title="Đọc kỹ ngữ cảnh. Giữ phiếu độc lập." description="Kiểm tra nghĩa, vùng sử dụng và cách diễn đạt phổ thông. Chỉ xác minh nội dung có đủ cơ sở." action={<Link className="btn btn-primary" to="/review">Vào hàng chờ <i className="bi bi-arrow-right" aria-hidden="true"/></Link>}/>
    <div className="dialect-metrics">{[{label:"Chờ đánh giá",resource:pending,to:"/review"},{label:"Phiếu của tôi",resource:mine,to:"/review?view=mine"},{label:"Cần bổ sung",resource:hold,to:"/review?view=hold"}].map(({label,resource,to}) => {
      return <div className="dialect-surface" key={label}><span>{label}</span>{!resource.data?<ResourceState error={resource.error} retry={resource.reload}/>:<><strong>{resource.data.total}</strong><Link to={to}>Mở danh sách <i className="bi bi-arrow-up-right" aria-hidden="true"/></Link></>}</div>;
    })}</div>
    <section className="dialect-surface mt-4"><div className="dialect-section-heading"><h2>Trước khi gửi phiếu</h2><span className="dialect-tag">Hướng dẫn đánh giá</span></div><ol className="dialect-review-guide"><li><strong>Đọc bản gốc và nguồn</strong><p>Giữ cách nói của người góp; không tự xem câu gợi ý là bằng chứng.</p></li><li><strong>Chấm từng tiêu chí</strong><p>Không chắc nghĩa hoặc vùng? Chọn cần bổ sung và chỉ rõ thông tin còn thiếu.</p></li><li><strong>Ghi lý do có thể hành động</strong><p>Giúp người góp biết phải bổ sung điều gì. Phiếu khác được ẩn trước khi bạn gửi.</p></li></ol><p className="dialect-fine-print">Hàng chờ hiện chưa phân công theo chuyên môn vùng. Chỉ đánh giá mẫu thuộc năng lực của bạn.</p></section></>;
}

function AdminDashboard() {
  const r = useResource<{submissions:number;distinct:number;verified:number;eligible:number}>("/dialect/metrics");
  return <><PageHeading eyebrow="KHÔNG GIAN ĐIỀU PHỐI" title="Chất lượng đi cùng quyền sử dụng." description="Theo dõi mẫu chưa rút, kiểm tra nguồn và xem điều kiện trước mỗi lần xuất." action={<Link className="btn btn-primary" to="/admin/datasets">Xem trước bản xuất <i className="bi bi-arrow-right" aria-hidden="true"/></Link>}/>
    {!r.data?<ResourceState error={r.error} retry={r.reload}/>:<div className="dialect-metrics">{[["Lượt gửi chưa rút",r.data.submissions],["Tổ hợp nội dung khác nhau",r.data.distinct],["Đã xác minh nội dung",r.data.verified],["Đủ điều kiện xuất hiện tại",r.data.eligible]].map(([label,value])=><div className="dialect-surface" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>}
    <p className="dialect-fine-print mt-3">“Tổ hợp nội dung khác nhau” tính theo cách viết, nghĩa và vùng; chưa phải số mục từ đã chuẩn hóa.</p>
    <div className="dialect-admin-actions">{[["/review","bi-clipboard-check","Đánh giá nội dung","Đọc bản gốc, gửi phiếu và xem các mẫu cần bổ sung."],["/admin/sources","bi-link-45deg","Rà soát quyền nguồn","Xem chứng cứ và các đóng góp liên quan trước khi xác nhận."],["/admin/disputes","bi-intersect","Giải quyết bất đồng","Điều phối độc lập và lưu lý do cho mỗi quyết định."],["/admin/participants","bi-people","Quản lý người đánh giá","Cấp quyền sau khi xác nhận năng lực và vùng sử dụng."]].map(([to,icon,title,text])=><Link to={to} key={to} className="dialect-surface"><i className={`bi ${icon}`} aria-hidden="true"/><h2>{title}</h2><p>{text}</p><span>Mở công cụ <i className="bi bi-arrow-right" aria-hidden="true"/></span></Link>)}</div>
  </>;
}
