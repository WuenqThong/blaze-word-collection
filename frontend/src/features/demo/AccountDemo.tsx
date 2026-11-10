import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { apiClient, errorMessage } from "../../api/client";
import { authApi } from "../../api/auth";
import { useAuth } from "../auth/AuthContext";
import { Field, Heading } from "./ui";
import { RegionOptions } from "./RegionOptions";
import { REGION_CHOICES } from "./regions";

const ROLE_LABEL: Record<string, string> = {
  annotator: "Người góp",
  reviewer: "Người kiểm duyệt",
  admin: "Quản trị viên",
};

const joined = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" });

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
        <h2 id={`${id}-title`}>{title}</h2>
        {description && <p>{description}</p>}
      </header>
      {children}
    </section>
  );
}

export function AccountDemo() {
  const { user } = useAuth();
  const { hash } = useLocation();
  // "Cài đặt" in the account menu links to #cai-dat. The layout scrolls to the
  // top on route change after this effect, so wait a frame before jumping.
  useEffect(() => {
    if (!hash) return;
    const id = window.setTimeout(() => {
      const target = document.getElementById(decodeURIComponent(hash.slice(1)));
      target?.scrollIntoView({ block: "start" });
      target?.querySelector<HTMLElement>("select, input")?.focus({ preventScroll: true });
    }, 50);
    return () => window.clearTimeout(id);
  }, [hash]);
  if (!user) return null; // DemoLayout already redirects signed-out visitors.
  return (
    <>
      <Heading title="Hồ sơ & cài đặt">
        <p>Thông tin tài khoản, vùng của bạn và mật khẩu đăng nhập.</p>
      </Heading>
      <div className="demo-settings">
        <ProfileForm />
        <RegionForm />
        <PasswordForm />
      </div>
    </>
  );
}

function ProfileForm() {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user!.full_name);
  const form = useForm();
  const unchanged = name.trim().replace(/\s+/g, " ") === user!.full_name;
  return (
    <Section id="ho-so" title="Thông tin tài khoản" description="Tên hiển thị là tên người khác thấy khi bạn góp và duyệt. Email và vai trò do quản trị viên quản lý.">
      <form onSubmit={(e) => form.submit(e, async () => {
        updateUser(await authApi.updateMe({ full_name: name }));
        return "Đã lưu tên hiển thị.";
      })}>
        <Field label="Tên hiển thị">
          <input value={name} required maxLength={255} autoComplete="name"
            onChange={(e) => { setName(e.target.value); form.touch(); }} />
        </Field>
        <dl className="demo-definition">
          <div><dt>Email đăng nhập</dt><dd>{user!.email}</dd></div>
          <div><dt>Vai trò</dt><dd>{ROLE_LABEL[user!.role] ?? user!.role}</dd></div>
          <div><dt>Tham gia từ</dt><dd>{joined.format(new Date(user!.created_at))}</dd></div>
        </dl>
        <Result ok={form.ok} error={form.error} />
        <button className="btn btn-primary" disabled={form.busy || unchanged || !name.trim()}>
          {form.busy ? "Đang lưu…" : "Lưu tên"}
        </button>
      </form>
    </Section>
  );
}

type Regions = { upbringing_area: string; usage_area: string };

function RegionForm() {
  const [regions, setRegions] = useState<Regions | null>(null);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const form = useForm();
  useEffect(() => {
    let current = true;
    apiClient.get<Regions>("/dialect/profile")
      .then(({ data }) => { if (current) { setRegions(data); setLoadError(""); } })
      .catch((err) => { if (current) setLoadError(errorMessage(err)); });
    return () => { current = false; };
  }, [attempt]);
  const fields: [keyof Regions, string][] = [
    ["upbringing_area", "Nơi bạn lớn lên"],
    ["usage_area", "Nơi bạn thường nghe hoặc dùng phương ngữ"],
  ];
  return (
    <Section id="cai-dat" title="Vùng của bạn" description="Không bắt buộc. Giúp người duyệt hiểu bối cảnh cách nói bạn góp. Chỉ cần quận/huyện, không cần địa chỉ.">
      {loadError ? (
        <>
          <p className="demo-error" role="alert">{loadError}</p>
          <button type="button" className="btn btn-outline-primary" onClick={() => setAttempt((n) => n + 1)}>Thử lại</button>
        </>
      ) : !regions ? (
        <p role="status">Đang tải…</p>
      ) : (
        <form onSubmit={(e) => form.submit(e, async () => {
          await apiClient.put("/dialect/profile", regions);
          return "Đã lưu vùng của bạn.";
        })}>
          {fields.map(([key, label]) => (
            <Field key={key} label={label}>
              <select value={regions[key]} onChange={(e) => { setRegions({ ...regions, [key]: e.target.value }); form.touch(); }}>
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

function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const form = useForm();
  const mismatch = !!confirm && next !== confirm;
  const tooShort = !!next && next.length < 6;
  return (
    <Section id="mat-khau" title="Đổi mật khẩu" description="Sau khi đổi, bạn vẫn đăng nhập trên máy này. Lần đăng nhập sau hãy dùng mật khẩu mới.">
      <form onSubmit={(e) => form.submit(e, async () => {
        await authApi.changePassword({ current_password: current, new_password: next });
        setCurrent(""); setNext(""); setConfirm("");
        return "Đã đổi mật khẩu.";
      })}>
        <Field label="Mật khẩu hiện tại">
          <input type="password" autoComplete="current-password" required value={current}
            onChange={(e) => { setCurrent(e.target.value); form.touch(); }} />
        </Field>
        <Field label="Mật khẩu mới (ít nhất 6 ký tự)">
          <input type="password" autoComplete="new-password" required minLength={6} maxLength={128} value={next}
            aria-invalid={tooShort} onChange={(e) => { setNext(e.target.value); form.touch(); }} />
        </Field>
        <Field label="Nhập lại mật khẩu mới">
          <input type="password" autoComplete="new-password" required value={confirm}
            aria-invalid={mismatch} aria-describedby={mismatch ? "password-mismatch" : undefined}
            onChange={(e) => { setConfirm(e.target.value); form.touch(); }} />
        </Field>
        {mismatch && <p className="demo-error" id="password-mismatch">Hai mật khẩu mới chưa khớp.</p>}
        <Result ok={form.ok} error={form.error} />
        <button className="btn btn-primary" disabled={form.busy || !current || tooShort || !next || mismatch || !confirm}>
          {form.busy ? "Đang đổi…" : "Đổi mật khẩu"}
        </button>
      </form>
    </Section>
  );
}
