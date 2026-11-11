import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Link } from "react-router-dom";

/** Centered single-column auth layout modelled on app.blaze.vn/signin and /signup. */
export function AuthShell({ title, subtitle, children, footnote }: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footnote?: ReactNode;
}) {
  return <div className="bz-auth">
    <header className="bz-auth-header">
      <Link to="/" className="bz-auth-brand" aria-label="Blaze — Trang chủ">
        <img src="/brand/blaze-logo.png" width="40" height="40" alt="" />
        <span>Blaze</span>
      </Link>
      <span className="bz-auth-lang"><i className="bi bi-globe2" aria-hidden="true" /> Tiếng Việt</span>
    </header>
    <main className="bz-auth-main">
      <div className="bz-auth-card">
        <h1 className="bz-auth-title">{title}</h1>
        <p className="bz-auth-subtitle">{subtitle}</p>
        {children}
        {footnote && <p className="bz-auth-footnote">{footnote}</p>}
      </div>
    </main>
  </div>;
}

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & { id: string; label: string; aside?: ReactNode };

export function AuthField({ id, label, aside, ...input }: FieldProps) {
  return <div className="bz-auth-field">
    <div className="bz-auth-label-row"><label htmlFor={id}>{label}</label>{aside}</div>
    <input id={id} className="bz-auth-input" {...input} />
  </div>;
}

export function AuthPasswordField({ id, label, aside, ...input }: Omit<FieldProps, "type">) {
  const [visible, setVisible] = useState(false);
  return <div className="bz-auth-field">
    <div className="bz-auth-label-row"><label htmlFor={id}>{label}</label>{aside}</div>
    <div className="bz-auth-input bz-auth-password">
      <input id={id} type={visible ? "text" : "password"} {...input} />
      <button type="button" aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"} aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}>
        <i className={`bi bi-eye${visible ? "" : "-slash"}`} aria-hidden="true" />
      </button>
    </div>
  </div>;
}

export function AuthSubmit({ busy, busyLabel, children }: { busy: boolean; busyLabel: string; children: ReactNode }) {
  return <button type="submit" className="bz-auth-submit" disabled={busy}>
    {busy ? <><span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />{busyLabel}</> : children}
  </button>;
}
