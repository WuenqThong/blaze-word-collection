import { useState, type FormEvent } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { AuthField, AuthPasswordField, AuthShell, AuthSubmit } from "./AuthShell";
import { extractError, SESSION_EXPIRED_MESSAGE } from "../../api/client";
import { returnPath } from "./returnPath";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = returnPath(location.state);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const expired = (location.state as { expired?: boolean } | null)?.expired;

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
    <AuthShell title="Đăng nhập vào Blaze" subtitle="Chào mừng trở lại! Đăng nhập để tiếp tục với Blaze."
      footnote="Bằng việc tiếp tục, bạn đồng ý với Điều khoản sử dụng và Chính sách quyền riêng tư của Blaze.">
      {!error && expired && <div className="bz-auth-alert is-warning" role="status">{SESSION_EXPIRED_MESSAGE}</div>}
      {error && <div className="bz-auth-alert" role="alert">{error}</div>}

      <form className="bz-auth-form" onSubmit={handleSubmit} aria-busy={submitting}>
        <AuthField id="login-email" label="Email" type="email" autoComplete="email" placeholder="E-mail"
          value={email} required autoFocus onChange={(e) => setEmail(e.target.value)} />
        <AuthPasswordField id="login-password" label="Mật khẩu" autoComplete="current-password" placeholder="Mật khẩu"
          value={password} required onChange={(e) => setPassword(e.target.value)} />
        <AuthSubmit busy={submitting} busyLabel="Đang đăng nhập...">Đăng nhập</AuthSubmit>
      </form>

      <p className="bz-auth-switch">
        Chưa có tài khoản? <Link to="/register" state={location.state}>Đăng ký</Link>
      </p>
    </AuthShell>
  );
}
