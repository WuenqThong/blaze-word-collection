import { useEffect, useState } from "react";
import { Card, Spinner, Alert, Button, Form, Modal, Badge } from "react-bootstrap";
import { Link } from "react-router-dom";
import { walletApi } from "../../api/wallet";
import { extractError } from "../../api/client";
import { type Withdrawal, type WithdrawalStatus, WITHDRAWAL_STATUS_LABEL, formatVnd } from "../../lib/walletTypes";

const STATUS_OPTIONS: { key: WithdrawalStatus | ""; label: string }[] = [
  { key: "", label: "Tất cả" },
  { key: "pending", label: "Chờ duyệt" },
  { key: "approved", label: "Đã duyệt — chờ chuyển" },
  { key: "paid", label: "Đã chuyển khoản" },
  { key: "rejected", label: "Bị từ chối" },
];

type ActionKey = "approve" | "reject" | "paid";

export function WithdrawalsAdminPage() {
  const [items, setItems] = useState<Withdrawal[] | null>(null);
  const [filter, setFilter] = useState<WithdrawalStatus | "">("pending");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [actionModal, setActionModal] = useState<{ id: number; action: ActionKey; note: string } | null>(null);

  const load = (status: WithdrawalStatus | "") => {
    walletApi.adminList(status || undefined)
      .then((r) => setItems(r.items))
      .catch((e) => setError(extractError(e)));
  };

  useEffect(() => { load(filter); }, [filter]);

  const handleAction = async () => {
    if (!actionModal) return;
    const { id, action, note } = actionModal;
    setBusy(id);
    try {
      if (action === "approve") await walletApi.adminApprove(id, note || undefined);
      if (action === "reject")  await walletApi.adminReject(id, note || undefined);
      if (action === "paid")    await walletApi.adminMarkPaid(id, note || undefined);
      setActionModal(null);
      load(filter);
    } catch (e) {
      setError(extractError(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <Link to="/dashboard" className="small text-muted">
            <i className="bi bi-arrow-left me-1"></i>Dashboard
          </Link>
          <h3 className="mt-1 mb-1">Yêu cầu rút tiền</h3>
          <p className="text-muted mb-0 mt-1">
            Duyệt → Chuyển khoản → Đánh dấu đã thanh toán. Khi paid, điểm bị trừ khỏi balance khả dụng của user.
          </p>
        </div>
        <Form.Select size="sm" style={{ width: 220 }}
          value={filter}
          onChange={(e) => setFilter(e.target.value as WithdrawalStatus | "")}>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </Form.Select>
      </div>

      {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}

      {items === null ? (
        <div className="text-center py-5"><Spinner animation="border" /></div>
      ) : items.length === 0 ? (
        <Card>
          <Card.Body className="text-center py-5 text-muted">
            <i className="bi bi-cash-stack" style={{ fontSize: "2.4rem" }}></i>
            <p className="mt-2 mb-0">Không có yêu cầu nào ở trạng thái này.</p>
          </Card.Body>
        </Card>
      ) : (
        <div className="ledger-list">
          {items.map((w) => {
            const meta = WITHDRAWAL_STATUS_LABEL[w.status];
            return (
              <div key={w.id} className="ledger-row" style={{ alignItems: "stretch" }}>
                <div className="ledger-icon" style={{ background: "var(--brand-50)", color: "var(--brand-700)" }}>
                  <i className="bi bi-person-circle"></i>
                </div>
                <div className="ledger-body">
                  <div className="ledger-title">
                    {w.user_full_name} <span className="text-muted small">({w.user_email})</span>
                  </div>
                  <div className="ledger-meta">
                    <strong>{w.amount_points} điểm</strong> · {formatVnd(w.amount_vnd)} ·{" "}
                    {new Date(w.requested_at).toLocaleString("vi-VN")}
                  </div>
                  <div className="ledger-meta mt-1">
                    <i className="bi bi-bank2 me-1"></i>{w.bank_name} · {w.bank_account_number} · {w.bank_account_holder}
                  </div>
                  {w.note && <div className="ledger-note">User: {w.note}</div>}
                  {w.admin_note && <div className="ledger-note">Admin: {w.admin_note}</div>}
                </div>
                <div className="d-flex flex-column align-items-end gap-2" style={{ minWidth: 220 }}>
                  <span className={`status-pill ${meta.cls}`}>{meta.text}</span>
                  <div className="d-flex flex-wrap gap-1 justify-content-end">
                    {w.status === "pending" && (
                      <>
                        <Button size="sm" variant="outline-success" disabled={busy !== null}
                          onClick={() => setActionModal({ id: w.id, action: "approve", note: "" })}>
                          <i className="bi bi-check2 me-1"></i>Duyệt
                        </Button>
                        <Button size="sm" variant="outline-danger" disabled={busy !== null}
                          onClick={() => setActionModal({ id: w.id, action: "reject", note: "" })}>
                          <i className="bi bi-x me-1"></i>Từ chối
                        </Button>
                      </>
                    )}
                    {w.status === "approved" && (
                      <Button size="sm" variant="outline-primary" disabled={busy !== null}
                        onClick={() => setActionModal({ id: w.id, action: "paid", note: "" })}>
                        <i className="bi bi-send-check me-1"></i>Đã chuyển khoản
                      </Button>
                    )}
                    {(w.status === "rejected" || w.status === "paid") && (
                      <Badge bg="light" text="dark" className="border">Hoàn tất</Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal show={!!actionModal} onHide={() => setActionModal(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {actionModal?.action === "approve" && "Duyệt yêu cầu"}
            {actionModal?.action === "reject" && "Từ chối yêu cầu"}
            {actionModal?.action === "paid" && "Xác nhận đã chuyển khoản"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Control as="textarea" rows={3}
            placeholder="Ghi chú (tuỳ chọn)..."
            value={actionModal?.note ?? ""}
            onChange={(e) => actionModal && setActionModal({ ...actionModal, note: e.target.value })} />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setActionModal(null)}>Huỷ</Button>
          <Button
            variant={actionModal?.action === "reject" ? "danger" : actionModal?.action === "paid" ? "primary" : "success"}
            onClick={handleAction}
            disabled={busy !== null}>
            {busy !== null ? <Spinner size="sm" animation="border" /> : "Xác nhận"}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
