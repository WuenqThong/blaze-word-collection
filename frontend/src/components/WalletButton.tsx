import { useEffect, useState } from "react";
import { Dropdown, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";
import { walletApi } from "../api/wallet";
import {
  type WalletSummary,
  type Withdrawal,
  WITHDRAWAL_STATUS_LABEL,
  formatVnd,
} from "../lib/walletTypes";

export function WalletButton() {
  const [open, setOpen] = useState(false);
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [items, setItems] = useState<Withdrawal[] | null>(null);
  const [error, setError] = useState(false);

  const load = () => {
    setError(false);
    Promise.all([walletApi.getWallet(), walletApi.listMine()]).then(([summary, history]) => {
      setWallet(summary); setItems(history.items);
    }).catch(() => setError(true));
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (open) load(); }, [open]);

  return (
    <Dropdown align="end" show={open} onToggle={(v) => setOpen(v)}>
      <Dropdown.Toggle as="button" className="wallet-toggle" id="wallet-menu">
        <span className="wallet-seg wallet-seg-confirmed" title="Điểm đã chính thức">
          <span className="wallet-seg-label">Điểm:</span>
          <strong>{wallet?.score_confirmed ?? "—"}</strong>
        </span>
        <span className="wallet-sep">·</span>
        <span className="wallet-seg wallet-seg-pending" title="Điểm đang chờ duyệt">
          <span className="wallet-seg-label">Điểm chờ:</span>
          <strong>{wallet?.score_pending ?? "—"}</strong>
        </span>
      </Dropdown.Toggle>

      <Dropdown.Menu className="wallet-menu">
        {error ? <div className="p-3" role="alert"><p>Không tải được dữ liệu ví. Số dư chưa được cập nhật.</p><button className="btn btn-outline-primary" onClick={load}>Thử lại</button></div> : <>
        <div className="wallet-menu-head">
          <div className="wallet-menu-label">Số dư khả dụng</div>
          {wallet ? (
            <>
              <div className="wallet-menu-amount">
                <strong>{wallet.available_points}</strong> điểm
              </div>
              <div className="wallet-menu-vnd">
                ≈ {formatVnd(wallet.available_points * wallet.point_to_vnd)}
              </div>
              {wallet.pending_withdrawal_points > 0 && (
                <div className="wallet-menu-hint">
                  <i className="bi bi-hourglass-split me-1"></i>
                  {wallet.pending_withdrawal_points} điểm đang chờ duyệt
                </div>
              )}
            </>
          ) : (
            <Spinner animation="border" size="sm" />
          )}
        </div>

        <div className="wallet-menu-section">
          <div className="wallet-menu-section-title">Yêu cầu rút gần đây</div>
          {items === null ? (
            <div className="wallet-menu-empty"><Spinner size="sm" animation="border" /></div>
          ) : items.length === 0 ? (
            <div className="wallet-menu-empty">Chưa có yêu cầu nào</div>
          ) : (
            <div className="wallet-menu-list">
              {items.slice(0, 5).map((w) => {
                const meta = WITHDRAWAL_STATUS_LABEL[w.status];
                return (
                  <div key={w.id} className="wallet-menu-item">
                    <div className="wallet-menu-item-left">
                      <div className="wallet-menu-item-amount">{formatVnd(w.amount_vnd)}</div>
                      <div className="wallet-menu-item-meta">
                        {new Date(w.requested_at).toLocaleDateString("vi-VN")}
                      </div>
                    </div>
                    <span className={`status-pill ${meta.cls}`}>{meta.text}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="wallet-menu-foot">
          <Link to="/withdrawals" className="btn btn-sm btn-outline-primary w-100" onClick={() => setOpen(false)}>
            Xem chi tiết & rút tiền
          </Link>
        </div>
        </>}
      </Dropdown.Menu>
    </Dropdown>
  );
}
