import { useState, type FormEvent } from "react";
import { Form, Button, Alert, InputGroup } from "react-bootstrap";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { AuthShell } from "./AuthShell";
import { extractError, SESSION_EXPIRED_MESSAGE } from "../../api/client";
import { returnPath } from "./returnPath";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = returnPath(location.state);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      navigate(from, { replace: true });
    } catch (err) {
      setError(extractError(err, "Đăng nhập thất bại"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <h1 className="auth-title">Chào mừng quay lại</h1>
      {!error && (location.state as { expired?: boolean } | null)?.expired && (
        <Alert variant="warning" className="py-2" role="status">{SESSION_EXPIRED_MESSAGE}</Alert>
      )}
      {error && <Alert variant="danger" className="py-2">{error}</Alert>}

      <Form onSubmit={handleSubmit} aria-busy={submitting}>
        <Form.Group className="mb-3" controlId="login-email">
          <Form.Label>Email</Form.Label>
          <InputGroup>
            <InputGroup.Text className="bg-body"><i className="bi bi-envelope text-muted"></i></InputGroup.Text>
            <Form.Control type="email" autoComplete="email" placeholder="ban@example.com" value={email} required autoFocus
              onChange={(e) => setEmail(e.target.value)} />
          </InputGroup>
        </Form.Group>

        <Form.Group className="mb-3" controlId="login-password">
          <Form.Label>Mật khẩu</Form.Label>
          <InputGroup>
            <InputGroup.Text className="bg-body"><i className="bi bi-lock text-muted"></i></InputGroup.Text>
            <Form.Control type={showPwd ? "text" : "password"} autoComplete="current-password" placeholder="Nhập mật khẩu" value={password} required
              onChange={(e) => setPassword(e.target.value)} />
            <Button variant="outline-secondary" type="button" aria-label={showPwd ? "Ẩn mật khẩu" : "Hiện mật khẩu"} aria-pressed={showPwd}
              onClick={() => setShowPwd((v) => !v)}>
              <i className={`bi bi-eye${showPwd ? "-slash" : ""}`}></i>
            </Button>
          </InputGroup>
        </Form.Group>

        <Button type="submit" variant="primary" className="w-100 mt-2" disabled={submitting}>
          {submitting ? <><span className="spinner-border spinner-border-sm me-2"></span>Đang đăng nhập...</> : "Đăng nhập"}
        </Button>
      </Form>

      <p className="text-center text-muted small mt-4 mb-0">
        Chưa có tài khoản? <Link to="/register" state={location.state}>Đăng ký</Link>
      </p>
    </AuthShell>
  );
}
