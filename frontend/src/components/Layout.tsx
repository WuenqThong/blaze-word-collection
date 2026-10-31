import { useEffect, useState } from "react";
import { Outlet, Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { Navbar, Container, Button, Dropdown, Nav, Offcanvas } from "react-bootstrap";
import { useAuth } from "../features/auth/AuthContext";
import { WalletButton } from "./WalletButton";
import { ANNOTATE_MODES } from "../features/annotate/modes";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "U";
}

export function Layout() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname, location.search]);

  const onDashboard = location.pathname === "/dashboard";
  const currentMode = new URLSearchParams(location.search).get("mode") ?? "";

  const handleLogout = async () => {
    setNavOpen(false);
    await logout();
    navigate("/login", { replace: true });
  };

  const fullBleed = location.pathname.startsWith("/admin/review");

  return (
    <div className="min-vh-100 d-flex flex-column">
      <Navbar expand="md" expanded={navOpen} onToggle={setNavOpen} className="app-navbar sticky-top">
        <Container fluid>
          <Navbar.Brand as={Link} to="/">
            <span className="brand-mark"><i className="bi bi-soundwave"></i></span>
            <span className="brand-text">Audio Annotator</span>
          </Navbar.Brand>

          <div className="ms-auto d-flex align-items-center gap-2 order-md-last">
            {loading ? (
              <div className="user-menu-skeleton" aria-hidden="true">
                <span className="skeleton-avatar" />
                <span className="skeleton-line d-none d-sm-inline" />
              </div>
            ) : user ? (
              <>
              {user.role !== "admin" && <WalletButton />}
              <Dropdown align="end" className="d-none d-md-block">
                <Dropdown.Toggle id="user-menu" className="user-menu-toggle" variant="">
                  <span className="user-avatar">{initials(user.full_name)}</span>
                  <span className="d-none d-sm-inline user-name">{user.full_name}</span>
                  <span className="role-chip d-none d-sm-inline">{user.role}</span>
                </Dropdown.Toggle>
                <Dropdown.Menu className="user-menu">
                  <Dropdown.Header>
                    <div className="small text-muted">Đã đăng nhập với</div>
                    <div className="text-truncate fw-semibold" style={{ maxWidth: 220 }}>{user.email}</div>
                  </Dropdown.Header>
                  <Dropdown.Divider />
                  {user.role !== "admin" && (
                    <>
                      <Dropdown.Item as={Link} to="/rewards"><i className="bi bi-coin"></i>Điểm thưởng</Dropdown.Item>
                      <Dropdown.Item as={Link} to="/history"><i className="bi bi-clock-history"></i>Lịch sử</Dropdown.Item>
                      <Dropdown.Divider />
                    </>
                  )}
                  <Dropdown.Item as={Link} to="/settings"><i className="bi bi-gear"></i>Cài đặt</Dropdown.Item>
                  <Dropdown.Divider />
                  <Dropdown.Item onClick={handleLogout} className="text-danger">
                    <i className="bi bi-box-arrow-right"></i>Đăng xuất
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-sm btn-outline-primary">Đăng nhập</Link>
                <Link to="/register"><Button size="sm" variant="primary">Đăng ký</Button></Link>
              </>
            )}
          </div>

          {user && <Navbar.Toggle aria-controls="main-nav" />}

          {user && (
            <Navbar.Offcanvas
              id="main-nav"
              aria-labelledby="main-nav-label"
              placement="bottom"
              className="app-navbar-offcanvas"
            >
              <Offcanvas.Header closeButton className="d-md-none">
                <Offcanvas.Title id="main-nav-label" className="d-flex align-items-center gap-2">
                  <span className="user-avatar">{initials(user.full_name)}</span>
                  <div className="min-w-0">
                    <div className="fw-semibold text-truncate">{user.full_name}</div>
                    <div className="small text-muted text-truncate">{user.email}</div>
                  </div>
                </Offcanvas.Title>
              </Offcanvas.Header>
              <Offcanvas.Body>
                <Nav className="app-nav me-auto">
                  {user.role === "admin" ? (
                    <>
                      <NavLink to="/dashboard" className="nav-link" end>
                        <i className="bi bi-grid-1x2"></i>
                        <span>Tổng quan</span>
                      </NavLink>
                      <NavLink to="/projects" className="nav-link">
                        <i className="bi bi-folder2"></i>
                        <span>Project</span>
                      </NavLink>
                      <span className="nav-divider" aria-hidden="true" />
                      <NavLink to="/admin/review" className="nav-link nav-link-admin">
                        <i className="bi bi-clipboard-check"></i>
                        <span>Review</span>
                      </NavLink>
                      <NavLink to="/admin/flagged" className="nav-link nav-link-admin">
                        <i className="bi bi-shield-exclamation"></i>
                        <span>Tài khoản bất thường</span>
                      </NavLink>
                      <NavLink to="/admin/withdrawals" className="nav-link nav-link-admin">
                        <i className="bi bi-cash-coin"></i>
                        <span>Rút tiền</span>
                      </NavLink>
                      <NavLink to="/admin/reports" className="nav-link nav-link-admin">
                        <i className="bi bi-flag"></i>
                        <span>Báo cáo</span>
                      </NavLink>
                    </>
                  ) : (
                    <>
                      <Dropdown as="div" className="annotate-mode-dropdown">
                        <Dropdown.Toggle
                          as="button"
                          type="button"
                          className={`nav-link annotate-mode-toggle ${onDashboard ? "active" : ""}`}
                          id="annotate-mode-toggle"
                        >
                          <i className="bi bi-tag"></i>
                          <span>Gắn nhãn</span>
                          <i className="bi bi-caret-down-fill annotate-mode-caret"></i>
                        </Dropdown.Toggle>
                        <Dropdown.Menu className="annotate-mode-menu">
                          {ANNOTATE_MODES.map((m) => (
                            <Dropdown.Item
                              key={m.key || "random"}
                              as={Link}
                              to={`/dashboard${m.key ? `?mode=${m.key}` : ""}`}
                              active={onDashboard && currentMode === m.key}
                            >
                              <i className={`bi ${m.icon}`}></i>
                              <span>{m.label}</span>
                            </Dropdown.Item>
                          ))}
                          <Dropdown.Divider />
                          <Dropdown.Item as={Link} to="/roleplay" active={location.pathname.startsWith("/roleplay")}>
                            <i className="bi bi-mic-fill"></i>
                            <span>Role play</span>
                          </Dropdown.Item>
                        </Dropdown.Menu>
                      </Dropdown>
                      <NavLink to="/projects" className="nav-link">
                        <i className="bi bi-folder2"></i>
                        <span>Dự án</span>
                      </NavLink>
                    </>
                  )}
                </Nav>

                <div className="mobile-user-section d-md-none">
                  <Nav className="flex-column app-nav">
                    {user.role !== "admin" && (
                      <>
                        <NavLink to="/rewards" className="nav-link">
                          <i className="bi bi-coin"></i>
                          <span>Điểm thưởng</span>
                        </NavLink>
                        <NavLink to="/history" className="nav-link">
                          <i className="bi bi-clock-history"></i>
                          <span>Lịch sử</span>
                        </NavLink>
                      </>
                    )}
                    <NavLink to="/settings" className="nav-link">
                      <i className="bi bi-gear"></i>
                      <span>Cài đặt</span>
                    </NavLink>
                    <button type="button" onClick={handleLogout} className="nav-link nav-link-danger text-start">
                      <i className="bi bi-box-arrow-right"></i>
                      <span>Đăng xuất</span>
                    </button>
                  </Nav>
                </div>
              </Offcanvas.Body>
            </Navbar.Offcanvas>
          )}
        </Container>
      </Navbar>

      <main className="flex-grow-1">
        {fullBleed ? (
          <Outlet />
        ) : (
          <Container className="py-4 py-md-5">
            <Outlet />
          </Container>
        )}
      </main>
    </div>
  );
}
