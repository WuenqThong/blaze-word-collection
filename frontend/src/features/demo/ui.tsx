import { errorMessage } from "../../api/client";
import type { ReactNode } from "react";
import { useState } from "react";
import { useDemo } from "./context";
export function Heading({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="demo-heading">
      <h1>{title}</h1>
      {children}
    </header>
  );
}
export function Panel({
  title,
  children,
  id,
}: {
  title?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section className="demo-panel" id={id}>
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="demo-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Status({ value }: { value: string }) {
  const labels: Record<string, string> = {
    RAW: "Bản gốc",
    REVIEW: "Đang duyệt",
    VERIFIED: "Đã xác minh",
    HOLD: "Cần bổ sung",
    REJECT: "Chưa chấp nhận",
    playing: "Đang làm",
    submitted: "Đã gửi",
    withdrawn: "Đã rút",
    active: "Đang mở",
    draft: "Nháp",
    closed: "Đã đóng",
  };
  return (
    <span className={`demo-status status-${value.toLowerCase()}`}>
      {labels[value] ?? value}
    </span>
  );
}
export function Action({
  children,
  onClick,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => unknown | Promise<unknown>;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <button
        type="button"
        className="btn btn-outline-primary"
        disabled={disabled || busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await onClick();
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Đang xử lý…" : children}
      </button>
      {error && (
        <span className="demo-error" role="alert">
          {error}
        </span>
      )}
    </>
  );
}
export function DemoGuard({
  children,
  review = false,
}: {
  children: ReactNode;
  review?: boolean;
}) {
  const { state, live } = useDemo();
  const actor = state.people.find((p) => p.id === state.actor)!;
  if (actor.role === "admin" || (review && actor.role === "reviewer")) return <>{children}</>;
  if (live)
    return (
      <Panel title="Tài khoản chưa có quyền này">
        <p>
          Trang này dành cho {review ? "reviewer hoặc quản trị viên" : "quản trị viên"}.
          Nhờ quản trị viên cấp vai trò cho tài khoản của bạn.
        </p>
      </Panel>
    );
  return (
    <Panel title="Cần đổi vai trò demo">
      <p>
        Chọn {review ? "Reviewer hoặc Điều phối viên" : "Điều phối viên"} trong
        thanh DEMO để xem chức năng này. Đây chỉ là mô phỏng quyền trên
        frontend.
      </p>
    </Panel>
  );
}
