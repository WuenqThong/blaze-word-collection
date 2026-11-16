import { displayLabel } from "../../lib/display";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, Navigate } from "react-router-dom";
import { Modal } from "react-bootstrap";
import { Brand } from "../../components/Brand";
import { AccountButton } from "../auth/AccountButton";
import { DemoProvider } from "./DemoProvider";
import { useDemo } from "./context";
import { repository } from "./repository";
import { Action, Panel } from "./ui";
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
  const { state, run, error, clearError, live } = useDemo();
  const [reset, setReset] = useState(false);
  const [menu, setMenu] = useState(false);
  const { pathname, search } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    document.getElementById("demo-content")?.focus({ preventScroll: true });
  }, [pathname]);
  const actor = state.people.find((p) => p.id === state.actor)!;
  const internal = ["admin", "reviewer"].includes(actor.role) || actor.role === "reviewer";
  const tools = pathname === "/demo/internal" && ["admin", "reviewer"].includes(user?.role ?? "");
  const playing = pathname.startsWith("/demo/game/");
  const links = navigationFor(actor.role);
  const group = adminGroupFor(pathname, search);
  const allowed = routeAllowed(actor.role, pathname) && (pathname !== "/demo/internal" || ["admin", "reviewer"].includes(user?.role ?? ""));
  if (!user && pathname !== "/demo" && pathname !== "/demo/rights") return <Navigate to="/login" replace state={{ from: { pathname, search }, expired }} />;
  if (internal && workspacePath(pathname) !== pathname) return <Navigate to={workspacePath(pathname) + search} replace />;
  return (
    <div className={`demo-app ${internal ? "demo-internal" : "demo-public"} ${playing ? "demo-playing" : ""}`}>
      <a className="skip-navigation" href="#demo-content">
        Bỏ qua điều hướng
      </a>
      {tools && <details className="demo-tools" open>
        <summary><span className="demo-mode-label">Bản trải nghiệm Minh họa</span><span>Công cụ thử nghiệm <i className="bi bi-chevron-down" aria-hidden="true" /></span></summary>
      <div className="demo-banner">
        <strong>Minh họa · APPDICHTHUAT</strong>
        <span>
          {live
            ? "Mẫu, phiếu, nguồn, người tham gia, hạn mức và phản hồi lưu trên máy chủ. Trò chơi và câu hỏi vẫn lưu trên trình duyệt."
            : "Dữ liệu minh họa trên trình duyệt · không cấp lượt sử dụng / gọi AI thật."}
        </span>
        {live ? (
          <span>Vai trò lấy theo tài khoản: {actor.name} · {displayLabel(actor.role)}</span>
        ) : (
          <label>
            Vai trò{" "}
            <select
              aria-label="Vai trò Minh họa"
              value={state.actor}
              onChange={(e) =>
                void run({ type: "actor", id: e.target.value }).catch(() => {})
              }
            >
              {state.people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {displayLabel(p.role)}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Kịch bản{" "}
          <select
            aria-label="Kịch bản lỗi Minh họa"
            value={state.simulate}
            onChange={(e) =>
              void run({
                type: "simulate",
                value: e.target.value as typeof state.simulate,
              }).catch(() => {})
            }
          >
            <option value="none">Bình thường</option>
            <option value="offline">Mất mạng mô phỏng</option>
            <option value="spam">Chặn spam mô phỏng</option>
          </select>
        </label>
        <button type="button" onClick={() => setReset(true)}>
          Khôi phục mẫu
        </button>
      </div>
      </details>}
      <header className="demo-topbar">
        <Brand />
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
            {["admin", "reviewer"].includes(actor.role) ? adminGroups.map(g => <Link key={g.label} to={g.links[0][0]} className={group === g ? "active" : undefined} aria-current={group === g ? "page" : undefined} onClick={() => setMenu(false)}>{g.label}</Link>) : links.map(([to, label]) => <Link key={to} to={to} className={pathname + search === to ? "active" : undefined} aria-current={pathname + search === to ? "page" : undefined} onClick={() => setMenu(false)}>{label}</Link>)}
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
          {internal && ["admin", "reviewer"].includes(actor.role) && group && (group.links.length > 1 || group.more.length > 0) && <nav className="demo-group-tabs admin-section-nav" aria-label={group.label}>{group.links.map(([to, label]) => <NavLink key={to} to={to}>{label}</NavLink>)}{group.more.length > 0 && <details className="admin-more" key={pathname}><summary>Công cụ khác{group.more.some(([to]) => pathname === to) ? " · đang mở" : ""}</summary><div>{group.more.map(([to, label]) => <NavLink key={to} to={to}>{label}</NavLink>)}</div></details>}</nav>}
          <div key={pathname}>
            {allowed ? <Outlet /> : <Panel title={live ? "Bạn chưa có quyền truy cập" : "Cần đổi vai trò minh họa"}><p>Trang này dành cho Reviewer.</p><Link to={links[0][0]}>Về không gian của tôi</Link></Panel>}
          </div>
        </main>
      </div>
      <Modal aria-label="Khôi phục dữ liệu minh họa" centered show={reset} onHide={() => setReset(false)}>
        <Modal.Header closeLabel="Đóng" closeButton>
          <Modal.Title>Khôi phục kho Minh họa?</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Lượt chơi, câu hỏi, tệp và thay đổi trong kho minh họa trên trình duyệt
          này sẽ được thay bằng dữ liệu mẫu ban đầu. Có thể xuất bản lưu ở Vận
          hành trước.{" "}
          {live
            ? "Mẫu đóng góp, phiếu và các dữ liệu đã lên máy chủ không bị xóa; mẫu chưa gửi được sẽ mất."
            : "Database và ví thật không bị tác động."}
        </Modal.Body>
        <Modal.Footer>
          <button
            className="btn btn-outline-secondary"
            onClick={() => setReset(false)}
          >
            Giữ dữ liệu
          </button>
          <Action
            onClick={async () => {
              await repository().reset();
              setReset(false);
              // Rebinds the account and pulls server data again.
              if (live) window.location.reload();
            }}
          >
            Khôi phục mẫu
          </Action>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
