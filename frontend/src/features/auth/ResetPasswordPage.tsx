import { useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { apiClient, extractError } from "../../api/client";
import { AuthPasswordField, AuthShell, AuthSubmit } from "./AuthShell";
import { useBlurValidation } from "./useBlurValidation";

export function ResetPasswordPage() {
  const { hash } = useLocation();
  const token = new URLSearchParams(hash.slice(1)).get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const validation = useBlurValidation({
    password: () => password.length >= 6 ? "" : "Nhập mật khẩu mới có ít nhất 6 ký tự.",
    confirmation: () => !confirmation ? "Nhập lại mật khẩu mới." : password === confirmation ? "" : "Hai mật khẩu chưa khớp. Nhập giống ô Mật khẩu mới.",
  });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validation.validate(event)) return;
    setError("");
    if (password !== confirmation) { setError("Hai mật khẩu chưa khớp."); return; }
    setBusy(true);
    try {
      await apiClient.post("/auth/reset-password", { token, new_password: password });
      setPassword(""); setConfirmation(""); setDone(true);
      // The recovery secret is no longer needed; remove it from the current URL.
      window.history.replaceState(window.history.state, "", window.location.pathname);
    } catch (cause) { setError(extractError(cause, "Chưa đặt lại được mật khẩu.")); }
    finally { setBusy(false); }
  }
  return <AuthShell title="Đặt lại mật khẩu" subtitle="Liên kết do quản trị viên cấp, có hiệu lực 30 phút và chỉ dùng một lần.">
    {done ? <div role="status"><p>Đã đặt lại mật khẩu. Các phiên đăng nhập cũ đã hết hiệu lực.</p><Link to="/login">Đăng nhập lại</Link></div>
      : token.length < 32 ? <div role="alert"><p>Liên kết khôi phục không hợp lệ. Hãy liên hệ quản trị viên để nhận liên kết mới.</p><Link to="/login">Về đăng nhập</Link></div>
      : <form className="bz-auth-form" noValidate onSubmit={submit} aria-busy={busy}>
        {error && <p className="bz-auth-alert" role="alert">{error}</p>}
        <AuthPasswordField id="reset-password" name="password" label="Mật khẩu mới" autoComplete="new-password" required minLength={6} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} onBlur={() => validation.blur("password")} error={validation.errors.password} disabled={busy} />
        <AuthPasswordField id="reset-confirmation" name="confirmation" label="Nhập lại mật khẩu mới" autoComplete="new-password" required minLength={6} maxLength={128} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} onBlur={() => validation.blur("confirmation")} error={validation.errors.confirmation} disabled={busy} />
        <AuthSubmit busy={busy} busyLabel="Đang đặt lại…">Đặt lại mật khẩu</AuthSubmit>
      </form>}
  </AuthShell>;
}
