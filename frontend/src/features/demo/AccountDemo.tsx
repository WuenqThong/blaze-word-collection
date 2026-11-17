import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Modal } from "react-bootstrap";
import { apiClient, errorMessage } from "../../api/client";
import { authApi } from "../../api/auth";
import { useAuth } from "../auth/AuthContext";
import { Field } from "./ui";
import { RegionOptions } from "./RegionOptions";
import { REGION_CHOICES } from "./regions";
import { accountInitials } from "../auth/accountIdentity";
import { useBlurValidation } from "../auth/useBlurValidation";

/** One form's outcome: a success line or an error, never both. */
function Result({ ok, error }: { ok: string; error: string }) {
  if (error) return <p className="demo-error" role="alert">{error}</p>;
  if (ok) return <p className="demo-success" role="status">{ok}</p>;
  return null;
}

function useForm() {
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState("");
  const [error, setError] = useState("");
  async function submit(e: FormEvent, action: () => Promise<string>) {
    e.preventDefault();
    setBusy(true);
    setOk("");
    setError("");
    try {
      setOk(await action());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  const touch = () => { setOk(""); setError(""); };
  return { busy, ok, error, submit, touch };
}

/** A settings block: title and short explanation above its form, separated by a rule, no card. */
function Section({ id, title, description, children }: { id: string; title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="demo-settings-section" id={id} aria-labelledby={`${id}-title`}>
      <header>
        <div><h2 id={`${id}-title`}>{title}</h2>
        {description && <p>{description}</p>}</div>
      </header>
      {children}
    </section>
  );
}

export function AccountDemo() {
  const { hash, pathname } = useLocation();
  const navigate = useNavigate();
  return <AccountSettingsModal initialSection={hash.slice(1) || "ho-so"} onHide={() => navigate(pathname.startsWith("/demo") ? "/demo" : "/dashboard", { replace: true })} />;
}

export function AccountSettingsModal({ onHide, initialSection = "ho-so" }: { onHide: () => void; initialSection?: string }) {
  const { user } = useAuth();
  const [entered, setEntered] = useState(false);
  const [activeSection, setActiveSection] = useState(initialSection);
  const sections = [
    { id: "ho-so", label: "Cá nhân", icon: "person" },
    { id: "cai-dat", label: "Phương ngữ", icon: "geo-alt" },
    { id: "mat-khau", label: "Bảo mật", icon: "shield-lock" },
  ];
  function goToSection(id: string) {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  }
  useEffect(() => {
    if (!entered || initialSection === "ho-so") return;
    const target = document.getElementById(initialSection);
    target?.scrollIntoView({ block: "start" });
    target?.querySelector<HTMLElement>("input, select, button")?.focus({ preventScroll: true });
  }, [entered, initialSection]);
  if (!user) return null;
  return (
    <Modal show onHide={onHide} onEntered={() => setEntered(true)} centered className="bz-settings-overlay" dialogClassName="bz-settings-dialog" contentClassName="bz-settings-modal" aria-labelledby="account-settings-title">
      <aside className="bz-settings-sidebar">
        <h2>Cài đặt</h2>
        <p className="bz-settings-nav-caption">Tài khoản của bạn</p>
        <nav aria-label="Cài đặt tài khoản">{sections.map(section => <button key={section.id} type="button" aria-current={activeSection === section.id ? "location" : undefined} onClick={() => goToSection(section.id)}><i className={`bi bi-${section.icon}`} aria-hidden="true" />{section.label}</button>)}</nav>
      </aside>
      <div className="bz-settings-pane">
        <header className="bz-settings-title"><h1 id="account-settings-title">Cài đặt tài khoản</h1><button type="button" className="btn-close" aria-label="Đóng cài đặt" onClick={onHide} /></header>
        <div className="bz-settings-scroll">
          <div className="bz-settings-identity"><span className="demo-avatar" aria-hidden="true">{accountInitials(user.full_name)}</span><div><strong>{user.full_name}</strong><span>Quản lý thông tin cá nhân và bảo mật.</span></div></div>
          <div className="bz-profile"><div className="demo-settings">
            <ProfileForm key={`profile.${user.id}`} />
            <RegionForm key={`region.${user.id}`} />
            <PasswordForm key={`password.${user.id}`} initiallyOpen={initialSection === "mat-khau"} />
          </div></div>
        </div>
      </div>
    </Modal>
  );
}

function ProfileForm() {
  const { user, updateUser } = useAuth();
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [name, setName] = useState(user!.full_name);
  const form = useForm();
  const validation = useBlurValidation({ name: () => name.trim() ? "" : "Nhập tên bạn muốn hiển thị." });
  const unchanged = name.trim().replace(/\s+/g, " ") === user!.full_name;
  return (
    <Section id="ho-so" title="Thông tin cá nhân">
      <form noValidate aria-busy={form.busy} onSubmit={(e) => { e.preventDefault(); if (!validation.validate(e)) return; void form.submit(e, async () => {
        const updated = await authApi.updateMe({ full_name: name }, user!.id);
        if (mounted.current) updateUser(updated);
        return "Đã lưu tên hiển thị.";
      }); }}>
        <Field label="Tên hiển thị">
          <input name="name" value={name} required maxLength={255} autoComplete="name" disabled={form.busy}
            onBlur={() => validation.blur("name")} aria-invalid={!!validation.errors.name} aria-describedby={validation.errors.name ? "profile-name-error" : undefined}
            onChange={(e) => { setName(e.target.value); form.touch(); }} />
        </Field>
        {validation.errors.name && <p className="bz-field-error" id="profile-name-error" role="alert">{validation.errors.name}</p>}
        <Field label="Email đăng nhập"><input type="email" aria-label="Email đăng nhập" value={user!.email} readOnly aria-describedby="profile-email-note" /><span className="bz-field-note" id="profile-email-note"><i className="bi bi-lock" aria-hidden="true" /> Liên hệ quản trị viên nếu cần đổi email.</span></Field>
        <Result ok={form.ok} error={form.error} />
        <button className="btn btn-primary" disabled={form.busy || unchanged || !name.trim()}>
          {form.busy ? "Đang lưu…" : "Lưu thay đổi"}
        </button>
      </form>
    </Section>
  );
}

type Regions = { upbringing_area: string; usage_area: string };

function RegionForm() {
  const { user } = useAuth();
  const accountId = user!.id;
  const [regions, setRegions] = useState<Regions | null>(null);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const form = useForm();
  useEffect(() => {
    let current = true;
    apiClient.get<Regions>("/dialect/profile", { headers: { "X-Account-ID": String(accountId) } })
      .then(({ data }) => { if (current) { setRegions(data); setLoadError(""); } })
      .catch((err) => { if (current) setLoadError(errorMessage(err)); });
    return () => { current = false; };
  }, [attempt, accountId]);
  const fields: [keyof Regions, string][] = [
    ["upbringing_area", "Nơi bạn lớn lên"],
    ["usage_area", "Nơi thường nghe hoặc dùng phương ngữ"],
  ];
  return (
    <Section id="cai-dat" title="Vùng phương ngữ" description="Thông tin tự nguyện, chỉ cần quận/huyện.">
      {loadError ? (
        <>
          <p className="demo-error" role="alert">{loadError}</p>
          <button type="button" className="btn btn-outline-primary" onClick={() => setAttempt((n) => n + 1)}>Thử lại</button>
        </>
      ) : !regions ? (
        <p role="status">Đang tải…</p>
      ) : (
        <form aria-busy={form.busy} onSubmit={(e) => form.submit(e, async () => {
          await apiClient.put("/dialect/profile", regions, { headers: { "X-Account-ID": String(user!.id) } });
          return "Đã lưu vùng của bạn.";
        })}>
          {fields.map(([key, label]) => (
            <Field key={key} label={label}>
              <select value={regions[key]} disabled={form.busy} onChange={(e) => { setRegions({ ...regions, [key]: e.target.value }); form.touch(); }}>
                <option value="">Chưa chọn</option>
                {/* Values saved as free text from the older /settings form stay selectable. */}
                {regions[key] && !REGION_CHOICES.includes(regions[key]) && <option value={regions[key]}>{regions[key]} (đã lưu)</option>}
                <RegionOptions unsure />
              </select>
            </Field>
          ))}
          <Result ok={form.ok} error={form.error} />
          <button className="btn btn-primary" disabled={form.busy}>{form.busy ? "Đang lưu…" : "Lưu vùng"}</button>
        </form>
      )}
    </Section>
  );
}

function PasswordForm({ initiallyOpen = false }: { initiallyOpen?: boolean }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(initiallyOpen);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const form = useForm();
  const validation = useBlurValidation({
    current: () => current ? "" : "Nhập mật khẩu hiện tại.",
    next: () => next.length >= 6 ? "" : "Nhập mật khẩu mới có ít nhất 6 ký tự.",
    confirm: () => !confirm ? "Nhập lại mật khẩu mới." : next === confirm ? "" : "Hai mật khẩu mới chưa khớp. Nhập giống ô Mật khẩu mới.",
  });
  return (
    <Section id="mat-khau" title="Bảo mật">
      <div className="bz-password-row"><div><strong>Mật khẩu</strong><p>Đổi mật khẩu bạn dùng để đăng nhập.</p></div><button type="button" className="btn btn-outline-secondary" aria-expanded={open} aria-controls="account-password-form" onClick={() => setOpen(!open)}>{open ? "Thu gọn" : "Đổi mật khẩu"}</button></div>
      {open && <form id="account-password-form" noValidate aria-busy={form.busy} onSubmit={(e) => { e.preventDefault(); if (!validation.validate(e)) return; void form.submit(e, async () => {
        await authApi.changePassword({ current_password: current, new_password: next }, user!.id);
        setCurrent(""); setNext(""); setConfirm("");
        return "Đã đổi mật khẩu.";
      }); }}>
        <Field label="Mật khẩu hiện tại">
          <input name="current" type="password" autoComplete="current-password" required value={current} disabled={form.busy}
            onBlur={() => validation.blur("current")} aria-invalid={!!validation.errors.current} aria-describedby={validation.errors.current ? "password-current-error" : undefined}
            onChange={(e) => { setCurrent(e.target.value); form.touch(); }} />
        </Field>
        {validation.errors.current && <p className="bz-field-error" id="password-current-error" role="alert">{validation.errors.current}</p>}
        <Field label="Mật khẩu mới (ít nhất 6 ký tự)">
          <input name="next" type="password" autoComplete="new-password" required minLength={6} maxLength={128} value={next} disabled={form.busy}
            onBlur={() => validation.blur("next")} aria-invalid={!!validation.errors.next} aria-describedby={validation.errors.next ? "password-next-error" : undefined} onChange={(e) => { setNext(e.target.value); form.touch(); }} />
        </Field>
        {validation.errors.next && <p className="bz-field-error" id="password-next-error" role="alert">{validation.errors.next}</p>}
        <Field label="Nhập lại mật khẩu mới">
          <input name="confirm" type="password" autoComplete="new-password" required value={confirm} disabled={form.busy}
            onBlur={() => validation.blur("confirm")} aria-invalid={!!validation.errors.confirm} aria-describedby={validation.errors.confirm ? "password-mismatch" : undefined}
            onChange={(e) => { setConfirm(e.target.value); form.touch(); }} />
        </Field>
        {validation.errors.confirm && <p className="bz-field-error" id="password-mismatch" role="alert">{validation.errors.confirm}</p>}
        <Result ok={form.ok} error={form.error} />
        <button className="btn btn-primary" disabled={form.busy}>
          {form.busy ? "Đang đổi…" : "Đổi mật khẩu"}
        </button>
      </form>}
    </Section>
  );
}
