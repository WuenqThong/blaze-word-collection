import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Spinner } from "react-bootstrap";
import { useAuth } from "../features/auth/AuthContext";
import { Link } from "react-router-dom";

export function ProtectedRoute() {
  const { user, loading, sessionError, refresh } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="d-flex justify-content-center py-5">
        <Spinner animation="border" />
      </div>
    );
  }

  if (!user) {
    if (sessionError) return <div className="collection-empty" role="alert"><h2>Chưa thể xác minh phiên</h2><p>{sessionError}</p><button className="btn btn-primary" onClick={() => void refresh()}>Thử lại</button><Link to="/login" className="mt-3">Đăng nhập bằng tài khoản khác</Link></div>;
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (sessionError) return <div className="collection-empty" role="alert"><h2>Kết nối bị gián đoạn</h2><p>{sessionError}</p><button className="btn btn-primary" onClick={() => void refresh()}>Xác minh lại phiên</button></div>;

  return <Outlet />;
}
