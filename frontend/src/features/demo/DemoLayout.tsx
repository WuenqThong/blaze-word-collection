import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, Navigate } from "react-router-dom";
import { Modal } from "react-bootstrap";
import { Brand } from "../../components/Brand";
import { AccountButton } from "../auth/AccountButton";
import { DemoProvider } from "./DemoProvider";
import { useDemo } from "./context";
import { repository } from "./repository";
import { Action, Panel } from "./ui";
import { navigationFor, routeAllowed, adminGroups } from "./navigation";
import { AuthProvider, useAuth } from "../auth/AuthContext";

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
  const internal = actor.role === "admin" || actor.role === "reviewer";
  const tools = pathname === "/demo/internal" && user?.role === "admin";
  const playing = pathname.startsWith("/demo/game/");
  const links = navigationFor(actor.role);
  const group = adminGroups.find((g) => g.links.some(([to]) => pathname === to || pathname.startsWith(to + "/")));
  const allowed = routeAllowed(actor.role, pathname) && (pathname !== "/demo/internal" || user?.role === "admin");
  if (!user && pathname !== "/demo" && pathname !== "/demo/rights") return <Navigate to="/login" replace state={{ from: { pathname, search }, expired }} />;
  return (
    <div className={`demo-app ${internal ? "demo-internal" : "demo-public"} ${playing ? "demo-playing" : ""}`}>
      <a className="skip-navigation" href="#demo-content">
        Bỏ qua điều hướng
      </a>
      {tools && <details className="demo-tools" open>
        <summary><span className="demo-mode-label">Bản trải nghiệm DEMO</span><span>Công cụ thử nghiệm <i className="bi bi-chevron-down" aria-hidden="true" /></span></summary>
      <div className="demo-banner">
        <strong>DEMO · APPDICHTHUAT</strong>
        <span>
          {live
            ? "Mẫu, phiếu, nguồn, người tham gia, hạn mức và phản hồi lưu trên máy chủ. Game và câu hỏi vẫn lưu trên trình duyệt."
            : "Dữ liệu minh họa trên trình duyệt · không cấp credit / gọi AI thật."}
        </span>
        {live ? (
          <span>Vai trò lấy theo tài khoản: {actor.name} · {actor.role}</span>
        ) : (
          <label>
            Vai trò{" "}
            <select
              aria-label="Vai trò DEMO"
              value={state.actor}
              onChange={(e) =>
                void run({ type: "actor", id: e.target.value }).catch(() => {})
              }
            >
              {state.people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.role}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Kịch bản{" "}
          <select
            aria-label="Kịch bản lỗi DEMO"
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
          Menu <i className="bi bi-list" aria-hidden="true" />
        </button>}
        {!playing && <AccountButton />}
      </header>
      <div className="demo-workspace">
        {internal && <aside id="demo-navigation" className={`demo-sidebar ${menu ? "is-open" : ""}`}>
          <nav aria-label="Điều hướng nội bộ">
            {links.map(([to, label]) => actor.role === "reviewer" ? <Link key={to} to={to} className={pathname + search === to ? "active" : undefined} aria-current={pathname + search === to ? "page" : undefined} onClick={() => setMenu(false)}>{label}</Link> : <NavLink key={to} to={to} onClick={() => setMenu(false)}>{label}</NavLink>)}
          </nav>
          <small className="demo-note">{actor.name}<br />{actor.role === "admin" ? "Quản trị" : "Người kiểm duyệt"}</small>
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
          {internal && actor.role === "admin" && group && <nav className="demo-group-tabs" aria-label={group.label}>{group.links.map(([to, label]) => <NavLink key={to} to={to}>{label}</NavLink>)}</nav>}
          <div key={pathname}>
            {allowed ? <Outlet /> : <Panel title="Cần đổi vai trò demo"><p>Trang này không nằm trong phạm vi vai trò hiện tại.</p><Link to={links[0][0]}>Về không gian của tôi</Link></Panel>}
          </div>
        </main>
      </div>
      {!internal && <footer className="demo-public-footer"><span>Blaze</span><Link to="/demo/rights">Hướng dẫn & quyền dữ liệu</Link><small></small></footer>}
      <Modal centered show={reset} onHide={() => setReset(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Khôi phục kho DEMO?</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Lượt chơi, câu hỏi, file và thay đổi trong kho demo trên trình duyệt
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
