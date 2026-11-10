import { useState } from "react";
import { Outlet, Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Alert, Dropdown, Offcanvas } from "react-bootstrap";
import { useAuth } from "../features/auth/AuthContext";


import { Brand } from "./Brand";
import { pageTitle, roleLabel } from "../features/dialect/navigation";

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join("");
}

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("collection.sidebar.collapsed") === "true"; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const isAdmin = user?.role === "admin";

  const title = pageTitle(pathname);

  function toggleSidebar() {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem("collection.sidebar.collapsed", String(next)); } catch { /* optional preference */ }
  }

  async function handleLogout() {
    setLoggingOut(true);
    setLogoutError(null);
    try {
      await logout();
      setMobileOpen(false);
      navigate("/login", { replace: true });
    } catch { setLogoutError("Không thể đăng xuất. Vui lòng thử lại."); }
    finally { setLoggingOut(false); }
  }

  const navigation = (compact: boolean) => {
    const item = (to: string, icon: string, label: string, active?: boolean) => (
      <NavLink key={to} to={to} end={to === "/dashboard" || to === "/roleplay"}
        onClick={() => setMobileOpen(false)} title={compact ? label : undefined}
        aria-current={active === false ? "false" : undefined}
        aria-label={compact ? label : undefined}
        className={({ isActive }) => `workspace-nav-link ${(active ?? isActive) ? "is-active" : ""}`}>
        <i className={`bi ${icon}`} aria-hidden="true" /><span>{label}</span>
      </NavLink>
    );
    return <>
      <div className="workspace-nav-caption">Không gian dữ liệu</div>
      {item("/dashboard", "bi-grid", "Tổng quan")}
      {item("/contribute/new", "bi-plus-square", "Góp từ / câu")}
      {item("/my/contributions", "bi-journal-text", "Đóng góp của tôi")}
      {(isAdmin || user?.role === "reviewer") && item("/review", "bi-clipboard-check", "Đánh giá độc lập")}
      {isAdmin && <><div className="workspace-nav-caption">Điều phối</div>
        {item("/admin/contributions", "bi-collection", "Mẫu đóng góp")}
        {item("/admin/disputes", "bi-intersect", "Xử lý bất đồng")}
        {item("/admin/sources", "bi-link-45deg", "Nguồn & quyền sử dụng")}
        {item("/admin/participants", "bi-people", "Người tham gia")}
        {item("/admin/datasets", "bi-database", "Bản xuất dữ liệu")}
      </>}
      <div className="workspace-nav-caption">Tham khảo</div>
      {item("/about-data", "bi-info-circle", "Hướng dẫn đóng góp")}
      {isAdmin && item("/legacy", "bi-archive", "Công cụ cũ")}
    </>;
  };

  return <div className={`collection-workspace ${collapsed ? "sidebar-collapsed" : ""}`}>
    <a href="#workspace-main" className="skip-navigation">Bỏ qua điều hướng</a>
    <aside className="workspace-sidebar" aria-label="Thanh bên">
      <div className="workspace-brand-row">{collapsed ? <Link className="compact-brand" to="/dashboard" aria-label="Blaze — Tổng quan"><img className="collection-logo" src="/brand/blaze-logo.png" width="36" height="36" alt="" /></Link> : <Brand />}</div>
      <nav className="workspace-navigation" aria-label="Điều hướng chính">{navigation(collapsed)}</nav>
      <div className="workspace-sidebar-footer">
        <NavLink to="/settings" className={({ isActive }) => `workspace-nav-link ${isActive ? "is-active" : ""}`} title={collapsed ? "Cài đặt" : undefined} aria-label={collapsed ? "Cài đặt" : undefined}>
          <i className="bi bi-geo-alt" aria-hidden="true" /><span>Hồ sơ vùng sử dụng</span>
        </NavLink>
        <button type="button" onClick={toggleSidebar} className="workspace-nav-link sidebar-toggle" aria-expanded={!collapsed} aria-label={collapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}>
          <i className={`bi bi-layout-sidebar${collapsed ? "-inset" : ""}`} aria-hidden="true" /><span>Thu gọn thanh bên</span>
        </button>
        {!collapsed && <div className="workspace-sidebar-note">Blaze <span>Không gian dữ liệu</span></div>}
      </div>
    </aside>
    <div className="workspace-panel">
      <header className="workspace-header">
        <div className="workspace-header-heading">
          <button className="workspace-icon-button mobile-menu-toggle" type="button" aria-label="Mở menu điều hướng" onClick={() => setMobileOpen(true)}><i className="bi bi-list" aria-hidden="true" /></button>
          <span className="workspace-breadcrumb">Không gian làm việc <i className="bi bi-chevron-right" aria-hidden="true" /></span>
          <span className="workspace-page-title">{title}</span>
        </div>
        <div className="workspace-header-actions">

          {user ? <Dropdown align="end">
            <Dropdown.Toggle variant="" className="workspace-account" id="workspace-account">
              <span className="workspace-avatar">{initials(user.full_name)}</span>
              <span className="workspace-account-copy"><strong>{user.full_name}</strong><small>{roleLabel(user.role)}</small></span>
            </Dropdown.Toggle>
            <Dropdown.Menu>
              <Dropdown.Header className="workspace-email">{user.email}</Dropdown.Header>
              <Dropdown.Item as={Link} to="/settings">Hồ sơ vùng sử dụng</Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item as="button" onClick={handleLogout} disabled={loggingOut} className="text-danger">{loggingOut ? "Đang đăng xuất…" : "Đăng xuất"}</Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown> : <Link to="/login" className="btn btn-primary">Đăng nhập</Link>}
        </div>
      </header>
      <main id="workspace-main" tabIndex={-1} className={`workspace-main ${pathname.startsWith("/admin/review") ? "workspace-main-review" : ""}`}>
        {logoutError && <Alert variant="danger" dismissible onClose={() => setLogoutError(null)}>{logoutError}</Alert>}
        <div className="workspace-page" key={pathname}><Outlet /></div>
      </main>
    </div>
    <Offcanvas show={mobileOpen} onHide={() => setMobileOpen(false)} placement="start" className="workspace-mobile-drawer">
      <Offcanvas.Header closeButton><Offcanvas.Title><Brand /></Offcanvas.Title></Offcanvas.Header>
      <Offcanvas.Body><nav aria-label="Điều hướng di động">{navigation(false)}
        <NavLink to="/settings" onClick={() => setMobileOpen(false)} className="workspace-nav-link"><i className="bi bi-geo-alt" aria-hidden="true" /><span>Hồ sơ vùng sử dụng</span></NavLink>
      </nav></Offcanvas.Body>
    </Offcanvas>
  </div>;
}
