import { Link, useNavigate } from "react-router-dom";

export function ErrorPage({ code = 404 }: { code?: 403 | 404 }) {
  const navigate = useNavigate();
  return <section className="collection-empty" aria-labelledby="error-title"><div className="page-eyebrow">{code}</div><h1 id="error-title">{code === 403 ? "Bạn chưa được cấp quyền truy cập" : "Không tìm thấy trang"}</h1><p>{code === 403 ? "Tài khoản của bạn vẫn đang đăng nhập. Hãy liên hệ người quản trị nếu cần quyền cho khu vực này." : "Đường dẫn có thể không còn tồn tại hoặc đã được thay đổi."}</p><div className="d-flex gap-2"><button className="btn btn-outline-secondary" onClick={() => navigate(-1)}>Quay lại</button><Link className="btn btn-primary" to="/">Trang chủ</Link></div></section>;
}
