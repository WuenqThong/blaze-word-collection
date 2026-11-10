import { Navigate, Outlet } from "react-router-dom";
import { Spinner } from "react-bootstrap";
import { useAuth } from "../features/auth/AuthContext";
import { ErrorPage } from "../pages/ErrorPage";

export function AdminRoute() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="d-flex justify-content-center py-5"><Spinner animation="border" /></div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <ErrorPage code={403} />;
  return <Outlet />;
}
