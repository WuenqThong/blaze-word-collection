import { lazy, Suspense, useState } from "react";
import { Dropdown } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { accountInitials } from "./accountIdentity";

const AccountSettingsModal = lazy(async () => ({ default: (await import("../demo/AccountDemo")).AccountSettingsModal }));

/** Signed-in user menu for the /demo top bar: profile, settings, sign out. */
export function AccountButton() {
  const { user, loading, sessionError, logout } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState<string | null>(null);
  if (loading) return <span className="demo-note" role="status">Đang kiểm tra phiên…</span>;
  if (sessionError || !user) return <Link className="btn btn-primary demo-login-button" to="/login">Đăng nhập</Link>;
  return (
    <div className="demo-account">
      <Dropdown align="end">
        <Dropdown.Toggle variant="" className="demo-account-toggle" id="demo-account-menu" aria-label={`Tài khoản ${user.full_name}`}>
          <span className="demo-avatar" aria-hidden="true">{accountInitials(user.full_name)}</span>
        </Dropdown.Toggle>
        <Dropdown.Menu className="demo-account-menu">
          <div className="bz-account-identity">
            <span className="demo-avatar" aria-hidden="true">{accountInitials(user.full_name)}</span>
            <div><strong>{user.full_name}</strong><span title={user.email}>{user.email}</span></div>
          </div>
          <div className="bz-account-language"><span><i className="bi bi-translate" aria-hidden="true" /> Ngôn ngữ</span><span lang="vi">Tiếng Việt</span></div>
          <Dropdown.Divider />
          <Dropdown.Item as="button" onClick={() => setSettings("ho-so")}>
            <i className="bi bi-gear" aria-hidden="true" /> Cài đặt
          </Dropdown.Item>
          <Dropdown.Item as={Link} to="/demo/rights">
            <i className="bi bi-question-circle" aria-hidden="true" /> Hướng dẫn & quyền dữ liệu
          </Dropdown.Item>
          <Dropdown.Item
            as="button"
            className="bz-account-logout"
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
      {settings && <Suspense fallback={<span role="status">Đang tải cài đặt…</span>}><AccountSettingsModal initialSection={settings} onHide={() => setSettings(null)} /></Suspense>}
      {error && <span role="alert">{error}</span>}
    </div>
  );
}
