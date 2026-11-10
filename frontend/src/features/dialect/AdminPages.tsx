import { Link } from "react-router-dom";
import { Alert } from "react-bootstrap";
import { PageHeading } from "./shared";
export { DialectDashboard } from "./Dashboard";
export { DialectReviewPage } from "./ReviewPage";
export { SourcesPage, DatasetsPage, ParticipantsPage } from "./DataAdminPages";

export function LegacyPage() {
  return <><PageHeading eyebrow="HỆ THỐNG TRƯỚC KHI CHUYỂN ĐỔI" title="Công cụ cũ" description="Dùng cho dữ liệu audio và giao dịch trước đây. Các công cụ này không phải luồng góp từ ngữ phương ngữ."/>
    <Alert variant="light">Chương trình phương ngữ hiện chưa có điểm thưởng hoặc thanh toán. Các đường dẫn cũ được giữ để tra cứu và đối soát; quyền API cũ chưa được tách thành capability riêng.</Alert>
    <div className="dialect-admin-actions">{[["/legacy/audio","Gán nhãn âm thanh"],["/projects","Dự án audio"],["/roleplay","Thu thập hội thoại"],["/history","Lịch sử audio"],["/rewards","Điểm thưởng cũ"],["/withdrawals","Rút tiền cũ"],["/legacy/settings","Hồ sơ thanh toán"]].map(([to,title])=><Link key={to} className="dialect-surface" to={to}><h2>{title}</h2><span>Mở công cụ <i className="bi bi-arrow-up-right" aria-hidden="true"/></span></Link>)}</div>
  </>;
}
