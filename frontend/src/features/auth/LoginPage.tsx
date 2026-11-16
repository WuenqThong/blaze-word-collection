import { useState, type FormEvent } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { AuthField, AuthPasswordField, AuthShell, AuthSubmit } from "./AuthShell";
import { extractError, SESSION_EXPIRED_MESSAGE } from "../../api/client";
import { loginReturnPath } from "./returnPath";
import { useBlurValidation } from "./useBlurValidation";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const validation = useBlurValidation({
    email: () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? "" : "Email chưa hợp lệ.",
    password: () => password ? "" : "Nhập mật khẩu để đăng nhập.",
  });
  const expired = (location.state as { expired?: boolean } | null)?.expired;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validation.validate(e)) return;
    setError(null);
    setSubmitting(true);
    try {
      const user = await login({ email: email.trim(), password });
      navigate(loginReturnPath(location.state, user.role), { replace: true });
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

      <form className="bz-auth-form" noValidate onSubmit={handleSubmit} aria-busy={submitting}>
        <AuthField id="login-email" label="Email" type="email" autoComplete="email" placeholder="Email"
          name="email" error={validation.errors.email} onBlur={() => validation.blur("email")} disabled={submitting}
          value={email} required autoFocus onChange={(e) => setEmail(e.target.value)} />
        <AuthPasswordField id="login-password" label="Mật khẩu" autoComplete="current-password" placeholder="Mật khẩu"
          name="password" error={validation.errors.password} onBlur={() => validation.blur("password")} disabled={submitting}
          value={password} required onChange={(e) => setPassword(e.target.value)} />
        <AuthSubmit busy={submitting} busyLabel="Đang đăng nhập...">Đăng nhập</AuthSubmit>
      </form>

      <details className="bz-auth-recovery">
        <summary>Quên mật khẩu?</summary>
        <p>Liên hệ quản trị viên đã cấp hoặc mời bạn vào dự án qua kênh công ty đang sử dụng. Sau khi xác minh danh tính qua kênh đã có, quản trị viên sẽ gửi riêng liên kết đặt lại mật khẩu có hạn 30 phút. Không gửi mật khẩu hiện tại hoặc mã OTP cho người hỗ trợ.</p>
      </details>

      <p className="bz-auth-switch">
        Chưa có tài khoản? <Link to="/register" state={location.state}>Đăng ký</Link>
      </p>
    </AuthShell>
  );
}
