import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Modal, Button } from "react-bootstrap";

type Variant = "danger" | "warning" | "primary";

interface ConfirmOptions {
  title?: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: Variant;
  icon?: string;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | undefined>(undefined);

interface DialogState extends ConfirmOptions {
  show: boolean;
}

const DEFAULT_STATE: DialogState = {
  show: false,
  message: "",
};

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState>(DEFAULT_STATE);
  const resolverRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setState({ show: true, ...opts });
    });
  }, []);

  const close = (result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setState((s) => ({ ...s, show: false }));
  };

  const variant: Variant = state.variant ?? "danger";
  const defaultIcon = variant === "danger"
    ? "bi-exclamation-triangle-fill"
    : variant === "warning"
      ? "bi-exclamation-circle-fill"
      : "bi-question-circle-fill";
  const icon = state.icon ?? defaultIcon;
  const confirmText = state.confirmText ?? "Đồng ý";
  const cancelText = state.cancelText ?? "Huỷ";
  const title = state.title ?? "Xác nhận";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        show={state.show}
        onHide={() => close(false)}
        centered
        dialogClassName={`confirm-dialog confirm-${variant}`}
        contentClassName="confirm-content"
        backdropClassName="confirm-backdrop"
      >
        <Modal.Body className="text-center px-4 pt-4 pb-2">
          <div className={`confirm-icon confirm-icon-${variant}`}>
            <i className={`bi ${icon}`}></i>
          </div>
          <h5 className="confirm-title mb-2">{title}</h5>
          <div className="confirm-message">{state.message}</div>
        </Modal.Body>
        <Modal.Footer className="confirm-footer">
          <Button
            variant="light"
            className="confirm-btn confirm-btn-cancel"
            onClick={() => close(false)}
          >
            {cancelText}
          </Button>
          <Button
            variant={variant}
            className="confirm-btn confirm-btn-confirm"
            onClick={() => close(true)}
          >
            {confirmText}
          </Button>
        </Modal.Footer>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside ConfirmProvider");
  return ctx;
}
