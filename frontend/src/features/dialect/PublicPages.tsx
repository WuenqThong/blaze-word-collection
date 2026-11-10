import { Link, Outlet } from "react-router-dom";
import { Brand } from "../../components/Brand";
import { useAuth } from "../auth/AuthContext";

export function PublicLayout() {
  const {user} = useAuth();
  return <div className="dialect-public">
    <a className="skip-navigation" href="#public-main">Bỏ qua điều hướng</a>
    <header className="dialect-public-header"><Brand/><nav aria-label="Điều hướng công khai"><Link to="/about-data">Cách chúng tôi dùng dữ liệu</Link><Link className="btn btn-outline-primary" to={user ? "/dashboard" : "/login"}>{user ? "Không gian của tôi" : "Đăng nhập"}<i className="bi bi-arrow-up-right" aria-hidden="true"/></Link></nav></header>
    <main id="public-main"><Outlet/></main>
    <footer className="dialect-public-footer"><Brand/><span>Quảng Nam · Đà Nẵng<br/>  </span><Link to="/about-data">Quyền của người đóng góp <i className="bi bi-arrow-right" aria-hidden="true"/></Link></footer>
  </div>;
}

export function LandingPage() {
  return <>
    <section className="dialect-hero">
      <div className="dialect-hero-copy"><div className="dialect-kicker"><span/>TỪ NGỮ QUẢNG NAM — ĐÀ NẴNG</div>
        <h1>Cách nói quê mình,<br/><span>cùng nhau giữ lại.</span></h1>
        <p>Một từ thường nghe. Một câu vẫn nói. Góp cách nói địa phương cùng nghĩa và câu chuyện phía sau, để mỗi đóng góp có thể được hiểu đúng.</p>
        <div className="dialect-hero-actions"><Link className="btn btn-primary" to="/contribute/new?kind=word">Góp một từ / cụm từ <i className="bi bi-arrow-right" aria-hidden="true"/></Link><Link className="btn btn-outline-primary" to="/contribute/new?kind=sentence">Góp một câu</Link></div>
        <p className="dialect-pilot-note"><i className="bi bi-person-check" aria-hidden="true"/> Bản thử nghiệm cần tài khoản để theo dõi và rút mẫu.</p>
      </div>
      <aside className="dialect-language-card" aria-label="Những thông tin đi cùng một đóng góp">
        <div className="dialect-language-card-top"><i className="bi bi-chat-square-quote" aria-hidden="true"/><span>MỖI CÁCH NÓI ĐỀU CÓ NGỮ CẢNH</span></div>
        <div className="dialect-language-form"><span>01 / NGUYÊN BẢN</span><strong>Bạn thường nói thế nào?</strong><p>Giữ cách nói tự nhiên, bằng lời của bạn.</p></div>
        <div className="dialect-language-form"><span>02 / NGHĨA & NGỮ CẢNH</span><strong>Nghe ở đâu, dùng khi nào?</strong><p>Nghĩa, vùng sử dụng và một ví dụ cụ thể.</p></div>
        <div className="dialect-language-card-bottom"><i className="bi bi-shield-check" aria-hidden="true"/> Có nguồn · Có lựa chọn sử dụng · Có đánh giá</div>
      </aside>
    </section>
    <div className="dialect-principles">{[["bi-pencil-square","Giữ nguyên lời bạn","Bản gốc được lưu riêng khi bổ sung."],["bi-toggles","Bạn chọn phạm vi","Huấn luyện và công khai là hai lựa chọn riêng."],["bi-arrow-counterclockwise","Có thể rút mẫu","Theo dõi và quản lý trong tài khoản."]].map(([icon,title,text])=><div key={title}><i className={`bi ${icon}`} aria-hidden="true"/><div><h2>{title}</h2><p>{text}</p></div></div>)}</div>
    <section className="dialect-how"><div><div className="page-eyebrow">TỪ MỘT CÁCH NÓI QUEN THUỘC</div><h2>Góp một chút.<br/>Hiểu thêm tiếng quê.</h2><p>Không cần viết như từ điển. Chỉ cần chia sẻ điều bạn thực sự biết.</p><Link to="/about-data">Xem hướng dẫn đóng góp <i className="bi bi-arrow-right" aria-hidden="true"/></Link></div><ol>{[["01","Ghi lại từ hoặc câu","Thêm nghĩa và cách diễn đạt bằng tiếng Việt phổ thông."],["02","Kể thêm bối cảnh","Nơi bạn nghe, tình huống sử dụng và nguồn thông tin."],["03","Xem lại rồi gửi","Nhận mã mẫu, đọc phản hồi, bổ sung hoặc rút khi cần."]].map(([n,title,text])=><li key={n}><span>{n}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol></section>
    <section className="dialect-game-notice"><div className="dialect-icon-tile"><i className="bi bi-controller" aria-hidden="true"/></div><div><div className="page-eyebrow">MỘT CÁCH THAM GIA KHÁC · ĐANG CHUẨN BỊ</div><h2>Khám phá phương ngữ qua 10 câu hỏi</h2><p>Mini-game đã có trong kế hoạch. Hiện chưa mở chơi; bộ câu hỏi và luật tham gia cần được duyệt trước.</p></div><Link className="btn btn-outline-primary" to="/about-data#mini-game">Tìm hiểu kế hoạch <i className="bi bi-arrow-right" aria-hidden="true"/></Link></section>
  </>;
}

export function AboutDataPage() {
  return <article className="dialect-prose"><Link className="dialect-back-link" to="/"><i className="bi bi-arrow-left" aria-hidden="true"/> Trang chủ</Link><div className="page-eyebrow">HƯỚNG DẪN & QUYỀN DỮ LIỆU</div><h1>Mỗi đóng góp,<br/>một lựa chọn rõ ràng.</h1><p className="dialect-prose-lead">Bạn quyết định nội dung mình chia sẻ được dùng ra sao. Bản thử nghiệm hiện cần đăng nhập để gửi, theo dõi và rút mẫu.</p>
    <h2>Góp điều bạn thực sự biết</h2><p>Giữ cách viết gốc, giải thích bằng lời của bạn, thêm ví dụ và nơi đã nghe. Nếu chưa chắc vùng sử dụng, chọn “Không chắc”. Không đưa thông tin cá nhân của người khác vào ví dụ.</p>
    <h2>Ba phạm vi, chọn riêng từng mục</h2><div className="dialect-policy-list"><div><strong>Tiếp nhận & kiểm duyệt</strong><span>Bắt buộc để lưu và đánh giá mẫu bạn gửi.</span></div><div><strong>Thử nghiệm / huấn luyện</strong><span>Tự nguyện. Không chọn vẫn có thể góp mẫu.</span></div><div><strong>Công khai nội dung</strong><span>Tự nguyện, độc lập với quyền huấn luyện. Chưa có từ điển công khai trong bản này.</span></div></div>
    <h2>Đã gửi chưa đồng nghĩa đã xác minh</h2><p>Mẫu mới được tiếp nhận ở dạng bản gốc. Người đánh giá kiểm tra nghĩa, vùng, ngữ cảnh và bản phổ thông. Bản thử nghiệm hiện dùng hai phiếu đồng thuận; bất đồng chuyển điều phối viên độc lập. Quyền nguồn được rà soát riêng trước khi xuất dữ liệu.</p>
    <h2>Nháp, bổ sung và rút mẫu</h2><p>Nháp chỉ lưu trên trình duyệt theo tài khoản. Hãy xóa nháp khi dùng máy chung. Bổ sung bằng phiên bản mới để giữ nguyên bản gốc; mỗi phiên bản cần được đánh giá lại. Tại “Đóng góp của tôi”, bạn có thể rút từng mẫu. Hiện chưa có thao tác đổi riêng từng phạm vi đồng ý sau gửi.</p><p>Rút mẫu chặn xuất mới và tải các bản xuất còn được hệ thống kiểm soát có chứa mẫu đó. Bản đã tải ra ngoài cần được điều phối xử lý; hệ thống không thể tự xóa mọi bản sao.</p>
    <section id="mini-game" className="dialect-prose-callout"><div className="page-eyebrow">MINI-GAME 10 CÂU · CHƯA MỞ</div><h2>Tài liệu đã có. Chức năng đang chờ triển khai.</h2><p>Kế hoạch chia 10 câu thành câu hiệu chỉnh, giải nghĩa, diễn đạt phổ thông và đóng góp mới. Trước khi mở cần có ngân hàng câu được duyệt, luật bỏ qua/thử lại thống nhất và cơ chế lưu phiên.</p><p>Các bản kế hoạch hiện khác nhau về yêu cầu đúng 3/3 ở ba câu đầu. Vì vậy bản này chưa chấm điểm, cấp thưởng hoặc dùng câu chưa duyệt làm đáp án chuẩn.</p></section>
    <h2>Chưa có dịch tự động hoặc chấm điểm gold</h2><p>Ứng dụng tập trung xây dữ liệu có nguồn và đánh giá rõ ràng. Bản xuất hiện là snapshot ứng viên đã qua kiểm tra, chưa chia train/dev/test và chưa phải benchmark.</p><Link className="btn btn-primary" to="/contribute/new">Góp một cách nói <i className="bi bi-arrow-right" aria-hidden="true"/></Link>
  </article>;
}
