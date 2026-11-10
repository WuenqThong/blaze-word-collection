import { useState } from "react";
import { Dropdown } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

const ROLE_LABEL: Record<string, string> = {
  annotator: "Người góp",
  reviewer: "Người kiểm duyệt",
  admin: "Quản trị viên",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

/** Signed-in user menu for the /demo top bar: profile, settings, sign out. */
export function AccountButton() {
  const { user, loading, sessionError, logout } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (loading) return <span className="demo-note" role="status">Đang kiểm tra phiên…</span>;
  if (sessionError || !user) return <Link className="btn btn-primary demo-login-button" to="/login">Đăng nhập</Link>;
  return (
    <div className="demo-account">
      <Dropdown align="end">
        <Dropdown.Toggle variant="" className="demo-account-toggle" id="demo-account-menu" aria-label={`Tài khoản ${user.full_name}`}>
          <span className="demo-avatar" aria-hidden="true">{initials(user.full_name)}</span>
          <span className="demo-account-name">{user.full_name}</span>
        </Dropdown.Toggle>
        <Dropdown.Menu className="demo-account-menu">
          <Dropdown.Header>
            <strong>{user.full_name}</strong>
            <span title={user.email}>{user.email}</span>
            <small>{ROLE_LABEL[user.role] ?? user.role}</small>
          </Dropdown.Header>
          <Dropdown.Divider />
          <Dropdown.Item as={Link} to="/demo/account">
            <i className="bi bi-person" aria-hidden="true" /> Hồ sơ
          </Dropdown.Item>
          <Dropdown.Item as={Link} to="/demo/account#cai-dat">
            <i className="bi bi-gear" aria-hidden="true" /> Cài đặt
          </Dropdown.Item>
          <Dropdown.Divider />
          <Dropdown.Item
            as="button"
            className="text-danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await logout();
                navigate("/demo", { replace: true });
              } catch {
                setError("Chưa đăng xuất được. Vui lòng thử lại.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <i className="bi bi-box-arrow-right" aria-hidden="true" /> {busy ? "Đang đăng xuất…" : "Đăng xuất"}
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
      {error && <span role="alert">{error}</span>}
    </div>
  );
}
