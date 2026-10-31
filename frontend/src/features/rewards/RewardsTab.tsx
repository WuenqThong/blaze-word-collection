import { useEffect, useState } from "react";
import { Spinner, Alert, Button } from "react-bootstrap";
import { reviewApi } from "../../api/review";
import { walletApi } from "../../api/wallet";
import { extractError } from "../../api/client";
import type { AnnotationItem, UserScoreSummary } from "../../lib/reviewTypes";
import { type WalletSummary, formatVnd } from "../../lib/walletTypes";
import { WithdrawModal } from "../wallet/WithdrawModal";

const PER_TYPE_LABEL: Record<string, string> = {
  audio_label: "Gán nhãn",
  audio_verify: "Xác minh",
  qa: "Q&A",
};

type LedgerType = "credit" | "debit" | "pending";

interface LedgerEntry {
  ts: string;
  task_type: string;
  amount: number;
  type: LedgerType;
  title: string;
  note: string;
}

function toLedger(items: AnnotationItem[]): LedgerEntry[] {
  return items.map((it) => {
    if (it.review_status === "approved") {
      return {
        ts: it.reviewed_at ?? it.created_at,
        task_type: it.task_type,
        amount: it.score_awarded,
        type: "credit" as LedgerType,
        title: "Điểm chính thức",
        note: "Annotation đã được duyệt",
      };
    }
    if (it.review_status === "rejected") {
      const base = it.score_awarded || 0;
      return {
        ts: it.reviewed_at ?? it.created_at,
        task_type: it.task_type,
        amount: base,
        type: "debit" as LedgerType,
        title: "Bị từ chối",
        note: it.review_note || "Annotation không được duyệt",
      };
    }
    return {
      ts: it.created_at,
      task_type: it.task_type,
      amount: it.score_awarded,
      type: "pending" as LedgerType,
      title: "Đang chờ duyệt",
      note: "Điểm sẽ chính thức sau khi admin duyệt",
    };
  });
}

const TYPE_META: Record<LedgerType, { icon: string; cls: string; sign: string }> = {
  credit: { icon: "bi-arrow-down-circle-fill", cls: "credit", sign: "+" },
  debit: { icon: "bi-x-circle-fill", cls: "debit", sign: "−" },
  pending: { icon: "bi-hourglass-split", cls: "pending", sign: "+" },
};

function fmtDate(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "short", year: "numeric" })
    + " · " + d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

export function RewardsTab() {
  const [summary, setSummary] = useState<UserScoreSummary | null>(null);
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showWithdraw, setShowWithdraw] = useState(false);

  const loadAll = () => {
    reviewApi.myScoreSummary().then(setSummary).catch((e) => setError(extractError(e)));
    reviewApi.myAnnotations({ limit: 200 })
      .then((r) => setEntries(toLedger(r.items)))
      .catch((e) => setError(extractError(e)));
    walletApi.getWallet().then(setWallet).catch(() => {});
  };

  useEffect(loadAll, []);

  return (
    <>
      {summary?.account_status === "under_review" && (
        <Alert variant="warning" className="d-flex align-items-start gap-2">
          <i className="bi bi-exclamation-triangle mt-1"></i>
          <div>
            <strong>Tài khoản đang bị review.</strong>
            <div className="small">
              Tỉ lệ rejection của bạn đạt {Math.round((summary.error_rate ?? 0) * 100)}%. Bạn tạm thời không thể nhận task mới đến khi admin xem xét.
            </div>
          </div>
        </Alert>
      )}

      <div className="rewards-stats">
        <div>
          <div className="rewards-stat-label">Đã chính thức</div>
          <div className="rewards-stat-value score-value">{summary?.score_confirmed ?? 0}</div>
          <div className="rewards-stat-sub d-flex align-items-center gap-2 flex-wrap">
            {wallet ? (
              <>
                <span>≈ {formatVnd(wallet.available_points * wallet.point_to_vnd)} khả dụng</span>
                <Button
                  size="sm"
                  variant="primary"
                  className="rewards-withdraw-btn"
                  onClick={() => setShowWithdraw(true)}
                  disabled={wallet.available_points <= 0}
                >
                  <i className="bi bi-cash-coin me-1"></i>Rút tiền
                </Button>
                {wallet.pending_withdrawal_points > 0 && (
                  <span className="text-muted" style={{ fontSize: "0.72rem" }}>
                    · {wallet.pending_withdrawal_points} điểm đang chờ
                  </span>
                )}
              </>
            ) : (
              <span>{summary?.count_approved ?? 0} task được duyệt</span>
            )}
          </div>
        </div>
        <div>
          <div className="rewards-stat-label">Đang chờ duyệt</div>
          <div className="rewards-stat-value">{summary?.score_pending ?? 0}</div>
          <div className="rewards-stat-sub">{summary?.count_pending ?? 0} task chờ</div>
        </div>
        <div>
          <div className="rewards-stat-label">Bị clawback</div>
          <div className="rewards-stat-value text-danger">−{summary?.count_rejected ?? 0}</div>
          <div className="rewards-stat-sub">task bị từ chối</div>
        </div>
      </div>

      <div className="d-flex align-items-baseline justify-content-between mt-4 mb-3">
        <h6 className="ledger-section-title">Sổ điểm thưởng</h6>
        <span className="text-muted small">{entries?.length ?? 0} giao dịch</span>
      </div>

      {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}

      {entries === null ? (
        <div className="text-center py-5"><Spinner animation="border" size="sm" /></div>
      ) : entries.length === 0 ? (
        <div className="text-center py-3 text-muted">
          <i className="bi bi-coin" style={{ fontSize: "1.8rem" }}></i>
          <p className="mt-2 mb-0">Chưa có giao dịch điểm nào.</p>
        </div>
      ) : (
        <div className="ledger-list">
          {entries.map((e, i) => {
            const meta = TYPE_META[e.type];
            return (
              <div key={i} className={`ledger-row ledger-${meta.cls}`}>
                <div className="ledger-icon"><i className={`bi ${meta.icon}`}></i></div>
                <div className="ledger-body">
                  <div className="ledger-title">{e.title}</div>
                  <div className="ledger-meta">
                    {PER_TYPE_LABEL[e.task_type] ?? e.task_type} · {fmtDate(e.ts)}
                  </div>
                  {e.note && <div className="ledger-note">{e.note}</div>}
                </div>
                <div className="ledger-amount">
                  <span className="amount-value">{meta.sign}{e.amount}</span>
                  <span className="amount-unit">điểm</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <WithdrawModal
        show={showWithdraw}
        onHide={() => setShowWithdraw(false)}
        onSuccess={loadAll}
      />
    </>
  );
}
