import { displayLabel } from "../../lib/display";
import { errorMessage } from "../../api/client";
import type { ReactNode } from "react";
import { Children, cloneElement, isValidElement, useId, useState } from "react";
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
export function ListPagination({ page, pages, onChange, label }: { page: number; pages: number; onChange: (page: number) => void; label: string }) {
  if (pages < 2) return null;
  return <nav className="list-pagination" aria-label={`Phân trang ${label}`}>
    <button type="button" className="btn btn-outline-primary" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label={`Trang ${label} trước`}>Trước</button>
    <span aria-live="polite">{page}/{pages}</span>
    <button type="button" className="btn btn-outline-primary" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label={`Trang ${label} sau`}>Sau</button>
  </nav>;
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const labelId = useId();
  return (
    <label className="demo-field">
      <span id={labelId}>{label}</span>
      {Children.map(children, child => isValidElement<{ "aria-labelledby"?: string }>(child) && typeof child.type === "string" && ["input", "select", "textarea"].includes(child.type) ? cloneElement(child, { "aria-labelledby": child.props["aria-labelledby"] ?? labelId }) : child)}
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
      {labels[value] ?? displayLabel(value)}
    </span>
  );
}
export function Action({
  children,
  onClick,
  disabled = false,
  current,
  label,
}: {
  children: ReactNode;
  onClick: () => unknown | Promise<unknown>;
  disabled?: boolean;
  current?: boolean;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <button
        type="button"
        aria-current={current ? "step" : undefined}
        aria-label={label}
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
  if (["admin", "reviewer"].includes(actor.role) || (review && actor.role === "reviewer")) return <>{children}</>;
  if (live)
    return (
      <Panel title="Tài khoản chưa có quyền này">
        <p>
          Trang này dành cho {review ? "người duyệt hoặc người kiểm duyệt" : "người kiểm duyệt"}.
          Nhờ người kiểm duyệt cấp vai trò cho tài khoản của bạn.
        </p>
      </Panel>
    );
  return (
    <Panel title="Cần đổi vai trò minh họa">
      <p>
        Chọn {review ? "Reviewer" : "Người kiểm duyệt"} trong
        thanh Minh họa để xem chức năng này. Đây chỉ là mô phỏng quyền trên
        giao diện.
      </p>
    </Panel>
  );
}
