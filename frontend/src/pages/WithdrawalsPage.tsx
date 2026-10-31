import { useEffect, useState } from "react";
import { Spinner, Alert, Button } from "react-bootstrap";
import { walletApi } from "../api/wallet";
import { extractError } from "../api/client";
import {
  type WalletSummary,
  type Withdrawal,
  WITHDRAWAL_STATUS_LABEL,
  formatVnd,
} from "../lib/walletTypes";
import { WithdrawModal } from "../features/wallet/WithdrawModal";

function fmtDateTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
    + " · " + d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

export function WithdrawalsPage() {
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [items, setItems] = useState<Withdrawal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showWithdraw, setShowWithdraw] = useState(false);

  const load = () => {
    walletApi.getWallet().then(setWallet).catch((e) => setError(extractError(e)));
    walletApi.listMine().then((r) => setItems(r.items)).catch((e) => setError(extractError(e)));
  };

  useEffect(load, []);

  return (
    <>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <h3 className="mb-1">Lịch sử rút tiền</h3>
          <p className="text-muted mb-0">Theo dõi mọi yêu cầu rút và trạng thái xử lý.</p>
        </div>
        {wallet && (
          <Button
            variant="primary"
            onClick={() => setShowWithdraw(true)}
            disabled={wallet.available_points <= 0}
          >
            <i className="bi bi-cash-coin me-2"></i>Yêu cầu rút mới
          </Button>
        )}
      </div>

      {/* Wallet summary */}
      {wallet && (
        <div className="rewards-stats mb-4">
          <div>
            <div className="rewards-stat-label">Khả dụng</div>
            <div className="rewards-stat-value score-value">{wallet.available_points}</div>
            <div className="rewards-stat-sub">≈ {formatVnd(wallet.available_points * wallet.point_to_vnd)}</div>
          </div>
          <div>
            <div className="rewards-stat-label">Đang chờ duyệt</div>
            <div className="rewards-stat-value">{wallet.pending_withdrawal_points}</div>
            <div className="rewards-stat-sub">điểm đã yêu cầu rút</div>
          </div>
          <div>
            <div className="rewards-stat-label">Tỷ giá</div>
            <div className="rewards-stat-value">{wallet.point_to_vnd.toLocaleString("vi-VN")} ₫</div>
            <div className="rewards-stat-sub">/ điểm · tối thiểu {wallet.min_withdrawal_points}đ</div>
          </div>
        </div>
      )}

      {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}

      {items === null ? (
        <div className="text-center py-5"><Spinner animation="border" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-5 text-muted">
          <i className="bi bi-receipt" style={{ fontSize: "2.4rem" }}></i>
          <p className="mt-2 mb-0">Chưa có yêu cầu rút nào.</p>
        </div>
      ) : (
        <div className="ledger-list">
          {items.map((w) => {
            const status = WITHDRAWAL_STATUS_LABEL[w.status];
            const iconBg = w.status === "paid" ? "var(--score-bg)"
              : w.status === "rejected" ? "#fef2f2" : "#fffbeb";
            const iconColor = w.status === "paid" ? "var(--score-color)"
              : w.status === "rejected" ? "#b91c1c" : "#92400e";
            const iconCls = w.status === "paid" ? "bi-check2-circle"
              : w.status === "rejected" ? "bi-x-circle"
              : w.status === "approved" ? "bi-send-check"
              : "bi-hourglass-split";
            return (
              <div key={w.id} className="ledger-row">
                <div className="ledger-icon" style={{ background: iconBg, color: iconColor }}>
                  <i className={`bi ${iconCls}`}></i>
                </div>
                <div className="ledger-body">
                  <div className="ledger-title">
                    Rút {w.amount_points} điểm — {formatVnd(w.amount_vnd)}
                  </div>
                  <div className="ledger-meta">
                    <i className="bi bi-bank2 me-1"></i>
                    {w.bank_name} · {w.bank_account_number} · {w.bank_account_holder}
                  </div>
                  <div className="ledger-meta">
                    <i className="bi bi-clock me-1"></i>{fmtDateTime(w.requested_at)}
                    {w.processed_at && ` · xử lý ${fmtDateTime(w.processed_at)}`}
                    {w.paid_at && ` · chuyển ${fmtDateTime(w.paid_at)}`}
                  </div>
                  {w.note && <div className="ledger-note">Bạn ghi: {w.note}</div>}
                  {w.admin_note && <div className="ledger-note">Admin: {w.admin_note}</div>}
                </div>
                <div>
                  <span className={`status-pill ${status.cls}`}>{status.text}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <WithdrawModal
        show={showWithdraw}
        onHide={() => setShowWithdraw(false)}
        onSuccess={load}
      />
    </>
  );
}
