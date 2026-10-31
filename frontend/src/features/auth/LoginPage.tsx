import { useState, type FormEvent } from "react";
import { Form, Button, Alert, InputGroup } from "react-bootstrap";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { AuthShell } from "./AuthShell";
import { extractError } from "../../api/client";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? "/dashboard";

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
      await login({ email, password });
      navigate(from, { replace: true });
    } catch (err) {
      setError(extractError(err, "Đăng nhập thất bại"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <h2 className="auth-title">Chào mừng quay lại 👋</h2>
      <p className="auth-subtitle">Đăng nhập để tiếp tục với các project gán nhãn của bạn.</p>

      {error && <Alert variant="danger" className="py-2">{error}</Alert>}

      <Form onSubmit={handleSubmit} noValidate>
        <Form.Group className="mb-3">
          <Form.Label>Email</Form.Label>
          <InputGroup>
            <InputGroup.Text className="bg-body"><i className="bi bi-envelope text-muted"></i></InputGroup.Text>
            <Form.Control type="email" placeholder="ban@example.com" value={email} required autoFocus
              onChange={(e) => setEmail(e.target.value)} />
          </InputGroup>
        </Form.Group>

        <Form.Group className="mb-3">
          <div className="d-flex justify-content-between">
            <Form.Label>Mật khẩu</Form.Label>
            <a href="#forgot" className="small text-muted">Quên mật khẩu?</a>
          </div>
          <InputGroup>
            <InputGroup.Text className="bg-body"><i className="bi bi-lock text-muted"></i></InputGroup.Text>
            <Form.Control type={showPwd ? "text" : "password"} placeholder="••••••••" value={password} required
              onChange={(e) => setPassword(e.target.value)} />
            <Button variant="outline-secondary" type="button" tabIndex={-1}
              onClick={() => setShowPwd((v) => !v)}>
              <i className={`bi bi-eye${showPwd ? "-slash" : ""}`}></i>
            </Button>
          </InputGroup>
        </Form.Group>

        <Button type="submit" variant="primary" className="w-100 mt-2" disabled={submitting}>
          {submitting ? <><span className="spinner-border spinner-border-sm me-2"></span>Đang đăng nhập...</> : "Đăng nhập"}
        </Button>
      </Form>

      <div className="divider-text">hoặc</div>
      <p className="text-center text-muted small mb-0">
        Chưa có tài khoản? <Link to="/register">Đăng ký miễn phí</Link>
      </p>
    </AuthShell>
  );
}
