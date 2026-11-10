import { useState, type FormEvent } from "react";
import { Form, Button, Alert, InputGroup } from "react-bootstrap";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { AuthShell } from "./AuthShell";
import { extractError } from "../../api/client";
import { returnPath } from "./returnPath";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!fullName.trim()) { setError("Vui lòng nhập họ và tên."); return; }
    if (password !== confirmation) { setError("Mật khẩu xác nhận chưa khớp."); return; }
    setSubmitting(true);
    try {
      await register({ email: email.trim(), full_name: fullName.trim(), password });
      navigate(returnPath(location.state), { replace: true });
    } catch (err) {
      setError(extractError(err, "Đăng ký thất bại"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <h1 className="auth-title">Tạo tài khoản</h1>

      {error && <Alert variant="danger" className="py-2">{error}</Alert>}

      <Form onSubmit={handleSubmit} aria-busy={submitting}>
        <Form.Group className="mb-3" controlId="register-name">
          <Form.Label>Họ và tên</Form.Label>
          <InputGroup>
            <InputGroup.Text className="bg-body"><i className="bi bi-person text-muted"></i></InputGroup.Text>
            <Form.Control type="text" autoComplete="name" placeholder="Nguyễn Văn A" value={fullName} required
              onChange={(e) => setFullName(e.target.value)} autoFocus />
          </InputGroup>
        </Form.Group>

        <Form.Group className="mb-3" controlId="register-email">
          <Form.Label>Email</Form.Label>
          <InputGroup>
            <InputGroup.Text className="bg-body"><i className="bi bi-envelope text-muted"></i></InputGroup.Text>
            <Form.Control type="email" autoComplete="email" placeholder="ban@example.com" value={email} required
              onChange={(e) => setEmail(e.target.value)} />
          </InputGroup>
        </Form.Group>

        <Form.Group className="mb-3" controlId="register-password">
          <Form.Label>Mật khẩu</Form.Label>
          <InputGroup>
            <InputGroup.Text className="bg-body"><i className="bi bi-lock text-muted"></i></InputGroup.Text>
            <Form.Control type={showPwd ? "text" : "password"} autoComplete="new-password" placeholder="Tối thiểu 6 ký tự"
              value={password} required minLength={6}
              onChange={(e) => setPassword(e.target.value)} />
            <Button variant="outline-secondary" type="button" aria-label={showPwd ? "Ẩn mật khẩu" : "Hiện mật khẩu"} aria-pressed={showPwd}
              onClick={() => setShowPwd((v) => !v)}>
              <i className={`bi bi-eye${showPwd ? "-slash" : ""}`}></i>
            </Button>
          </InputGroup>
        </Form.Group>

        <Form.Group className="mb-3" controlId="register-confirmation">
          <Form.Label>Xác nhận mật khẩu</Form.Label>
          <Form.Control type={showPwd ? "text" : "password"} autoComplete="new-password" value={confirmation} required minLength={6} placeholder="Nhập lại mật khẩu" onChange={(e) => setConfirmation(e.target.value)} />
        </Form.Group>
        <Button type="submit" variant="primary" className="w-100 mt-2" disabled={submitting}>
          {submitting ? <><span className="spinner-border spinner-border-sm me-2"></span>Đang tạo tài khoản...</> : "Tạo tài khoản"}
        </Button>
      </Form>

      <p className="text-center text-muted small mt-4 mb-0">
        Đã có tài khoản? <Link to="/login" state={location.state}>Đăng nhập</Link>
      </p>
    </AuthShell>
  );
}
