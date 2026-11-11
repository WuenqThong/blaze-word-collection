import { useState, type FormEvent } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { AuthField, AuthPasswordField, AuthShell, AuthSubmit } from "./AuthShell";
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
    <AuthShell title="Tạo tài khoản Blaze" subtitle="Bắt đầu miễn phí chỉ trong vài giây."
      footnote="Bằng việc đăng ký, bạn đồng ý với Điều khoản sử dụng và Chính sách quyền riêng tư của Blaze.">
      {error && <div className="bz-auth-alert" role="alert">{error}</div>}

      <form className="bz-auth-form" onSubmit={handleSubmit} aria-busy={submitting}>
        <AuthField id="register-name" label="Họ và tên" type="text" autoComplete="name" placeholder="Nguyễn Văn A"
          value={fullName} required autoFocus onChange={(e) => setFullName(e.target.value)} />
        <AuthField id="register-email" label="Email" type="email" autoComplete="email" placeholder="ban@congty.com"
          value={email} required onChange={(e) => setEmail(e.target.value)} />
        <AuthPasswordField id="register-password" label="Mật khẩu" autoComplete="new-password" placeholder="Tối thiểu 6 ký tự"
          value={password} required minLength={6} onChange={(e) => setPassword(e.target.value)} />
        <AuthPasswordField id="register-confirmation" label="Xác nhận mật khẩu" autoComplete="new-password" placeholder="Nhập lại mật khẩu"
          value={confirmation} required minLength={6} onChange={(e) => setConfirmation(e.target.value)} />
        <AuthSubmit busy={submitting} busyLabel="Đang tạo tài khoản...">Đăng ký</AuthSubmit>
      </form>

      <p className="bz-auth-switch">
        Đã có tài khoản? <Link to="/login" state={location.state}>Đăng nhập</Link>
      </p>
    </AuthShell>
  );
}
