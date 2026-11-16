import { useState, type FormEvent } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { AuthField, AuthPasswordField, AuthShell, AuthSubmit } from "./AuthShell";
import { extractError } from "../../api/client";
import { returnPath } from "./returnPath";
import { useBlurValidation } from "./useBlurValidation";

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
  const validation = useBlurValidation({
    fullName: () => fullName.trim() ? "" : "Nhập họ và tên của bạn.",
    email: () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? "" : "Email chưa hợp lệ.",
    password: () => password.length >= 6 ? "" : "Nhập mật khẩu có ít nhất 6 ký tự.",
    confirmation: () => !confirmation ? "Nhập lại mật khẩu mới." : password === confirmation ? "" : "Mật khẩu xác nhận chưa khớp. Nhập giống ô Mật khẩu.",
  });

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validation.validate(e)) return;
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

      <form className="bz-auth-form" noValidate onSubmit={handleSubmit} aria-busy={submitting}>
        <AuthField id="register-name" label="Họ và tên" type="text" autoComplete="name" placeholder="Nguyễn Văn A"
          name="fullName" error={validation.errors.fullName} onBlur={() => validation.blur("fullName")} disabled={submitting}
          value={fullName} required autoFocus onChange={(e) => setFullName(e.target.value)} />
        <AuthField id="register-email" label="Email" type="email" autoComplete="email" placeholder="ban@congty.com"
          name="email" error={validation.errors.email} onBlur={() => validation.blur("email")} disabled={submitting}
          value={email} required onChange={(e) => setEmail(e.target.value)} />
        <AuthPasswordField id="register-password" label="Mật khẩu" autoComplete="new-password" placeholder="Tối thiểu 6 ký tự"
          name="password" error={validation.errors.password} onBlur={() => validation.blur("password")} disabled={submitting}
          value={password} required minLength={6} onChange={(e) => setPassword(e.target.value)} />
        <AuthPasswordField id="register-confirmation" label="Xác nhận mật khẩu" autoComplete="new-password" placeholder="Nhập lại mật khẩu"
          name="confirmation" error={validation.errors.confirmation} onBlur={() => validation.blur("confirmation")} disabled={submitting}
          value={confirmation} required minLength={6} onChange={(e) => setConfirmation(e.target.value)} />
        <AuthSubmit busy={submitting} busyLabel="Đang tạo tài khoản...">Đăng ký</AuthSubmit>
      </form>

      <p className="bz-auth-switch">
        Đã có tài khoản? <Link to="/login" state={location.state}>Đăng nhập</Link>
      </p>
    </AuthShell>
  );
}
