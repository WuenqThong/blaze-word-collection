import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, Navigate } from "react-router-dom";
import { Brand } from "../../components/Brand";
import { AccountButton } from "../auth/AccountButton";
import { DemoProvider } from "./DemoProvider";
import { useDemo } from "./context";
import { Panel } from "./ui";
import { navigationFor, routeAllowed, adminGroups, adminGroupFor, workspacePath } from "./navigation";
import { AuthProvider } from "../auth/AuthProvider";
import { useAuth } from "../auth/AuthContext";

export function DemoRoot() {
  return <AuthProvider><AccountDemo /></AuthProvider>;
}
function AccountDemo() {
  const { user, loading, sessionError, refresh } = useAuth();
  const { pathname } = useLocation();
  if (loading) return <p role="status">Đang kiểm tra phiên đăng nhập…</p>;
  if (sessionError && !["/demo", "/demo/rights"].includes(pathname)) return <div className="collection-empty"><p role="alert">{sessionError}</p><button className="btn btn-primary" onClick={() => void refresh()}>Thử lại</button></div>;
  return (
    <DemoProvider key={sessionError ? "signed-out" : user?.id ?? "signed-out"} account={sessionError ? null : user}>
      <DemoLayout />
    </DemoProvider>
  );
}
function DemoLayout() {
  const { user, expired } = useAuth();
  const { state, error, clearError, live } = useDemo();
  const [menu, setMenu] = useState(false);
  const { pathname, search } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    document.getElementById("demo-content")?.focus({ preventScroll: true });
  }, [pathname]);
  const actor = state.people.find((p) => p.id === state.actor)!;
  const internal = ["admin", "reviewer"].includes(actor.role);
  const playing = pathname.startsWith("/demo/game/");
  const operations = !live || actor.operations === true || actor.role === "admin";
  const links = navigationFor(actor.role, operations);
  const group = adminGroupFor(pathname, search);
  const allowed = routeAllowed(actor.role, pathname, operations);
  if (!user && pathname !== "/demo" && pathname !== "/demo/rights") return <Navigate to="/login" replace state={{ from: { pathname, search }, expired }} />;
  if (internal && workspacePath(pathname) !== pathname) return <Navigate to={workspacePath(pathname) + search} replace />;
  return (
    <div className={`demo-app ${internal ? "demo-internal" : "demo-public"} ${playing ? "demo-playing" : ""}`}>
      <a className="skip-navigation" href="#demo-content">
        Bỏ qua điều hướng
      </a>
      <header className="demo-topbar">
        <Brand />
        {internal && !playing && <span className="workspace-label">Không gian quản lý</span>}
        {!internal && <nav className="demo-public-nav" aria-label="Điều hướng chính">{links.map(([to, label]) => <NavLink key={to} to={to} end={to === "/demo"}>{label}</NavLink>)}</nav>}
        {internal && <button
          className="btn btn-outline-primary demo-mobile-menu"
          aria-expanded={menu}
          aria-controls="demo-navigation"
          onClick={() => setMenu(!menu)}
        >
          Danh mục <i className="bi bi-list" aria-hidden="true" />
        </button>}
        {!playing && <AccountButton />}
      </header>
      <div className="demo-workspace">
        {internal && <aside id="demo-navigation" className={`demo-sidebar ${menu ? "is-open" : ""}`}>
          <nav aria-label="Điều hướng nội bộ">
            {["admin", "reviewer"].includes(actor.role) ? adminGroups.filter((_,i)=>operations || i===0).map(g => <Link key={g.label} to={g.links[0][0]} className={group === g ? "active" : undefined} aria-current={group === g ? "page" : undefined} onClick={() => setMenu(false)}>{g.label}</Link>) : links.map(([to, label]) => <Link key={to} to={to} className={pathname + search === to ? "active" : undefined} aria-current={pathname + search === to ? "page" : undefined} onClick={() => setMenu(false)}>{label}</Link>)}
          </nav>
          <small className="demo-note">{actor.name}<br />Reviewer</small>
        </aside>}
        <main id="demo-content" tabIndex={-1} className="demo-main">
          {error && (
            <div className="demo-global-error" role="alert">
              <span>{error}</span>
              <button aria-label="Đóng lỗi" onClick={clearError}>
                Đóng
              </button>
            </div>
          )}
          {operations && internal && ["admin", "reviewer"].includes(actor.role) && group && (group.links.length > 1 || group.more.length > 0) && <nav className="demo-group-tabs admin-section-nav" aria-label={group.label}>{group.links.map(([to, label]) => <NavLink key={to} to={to}>{label}</NavLink>)}{group.more.length > 0 && <details className="admin-more" key={pathname}><summary>Công cụ khác{group.more.some(([to]) => pathname === to) ? " · đang mở" : ""}</summary><div>{group.more.map(([to, label]) => <NavLink key={to} to={to}>{label}</NavLink>)}</div></details>}</nav>}
          <div key={pathname}>
            {allowed ? <Outlet /> : <Panel title="Bạn chưa có quyền truy cập"><p>Trang này dành cho Reviewer.</p><Link to={links[0][0]}>Về không gian của tôi</Link></Panel>}
          </div>
        </main>
      </div>
      {!internal && !playing && <footer className="demo-public-footer"><span>Cùng gìn giữ sự phong phú của tiếng Việt.</span><Link to="/demo/rights">Quyền sử dụng dữ liệu</Link><small>Blaze · Dữ liệu dịch phương ngữ</small></footer>}
    </div>
  );
}
