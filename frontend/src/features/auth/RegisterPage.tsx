import { useState, type FormEvent } from "react";
import { Form, Button, Alert, InputGroup } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { AuthShell } from "./AuthShell";
import { extractError } from "../../api/client";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
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
      await register({ email, full_name: fullName, password });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(extractError(err, "Đăng ký thất bại"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <h2 className="auth-title">Tạo tài khoản</h2>
      <p className="auth-subtitle">Bắt đầu nhận task gán nhãn ngay hôm nay.</p>

      {error && <Alert variant="danger" className="py-2">{error}</Alert>}

      <Form onSubmit={handleSubmit} noValidate>
        <Form.Group className="mb-3">
          <Form.Label>Họ và tên</Form.Label>
          <InputGroup>
            <InputGroup.Text className="bg-body"><i className="bi bi-person text-muted"></i></InputGroup.Text>
            <Form.Control type="text" placeholder="Nguyễn Văn A" value={fullName} required
              onChange={(e) => setFullName(e.target.value)} autoFocus />
          </InputGroup>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Email</Form.Label>
          <InputGroup>
            <InputGroup.Text className="bg-body"><i className="bi bi-envelope text-muted"></i></InputGroup.Text>
            <Form.Control type="email" placeholder="ban@example.com" value={email} required
              onChange={(e) => setEmail(e.target.value)} />
          </InputGroup>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Mật khẩu</Form.Label>
          <InputGroup>
            <InputGroup.Text className="bg-body"><i className="bi bi-lock text-muted"></i></InputGroup.Text>
            <Form.Control type={showPwd ? "text" : "password"} placeholder="Tối thiểu 6 ký tự"
              value={password} required minLength={6}
              onChange={(e) => setPassword(e.target.value)} />
            <Button variant="outline-secondary" type="button" tabIndex={-1}
              onClick={() => setShowPwd((v) => !v)}>
              <i className={`bi bi-eye${showPwd ? "-slash" : ""}`}></i>
            </Button>
          </InputGroup>
        </Form.Group>

        <Button type="submit" variant="primary" className="w-100 mt-2" disabled={submitting}>
          {submitting ? <><span className="spinner-border spinner-border-sm me-2"></span>Đang tạo tài khoản...</> : "Tạo tài khoản"}
        </Button>
      </Form>

      <p className="text-center text-muted small mt-4 mb-0">
        Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
      </p>
    </AuthShell>
  );
}
