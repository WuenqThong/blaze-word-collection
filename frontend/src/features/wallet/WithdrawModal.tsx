import { useEffect, useState } from "react";
import { Modal, Button, Form, Alert, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";
import { walletApi } from "../../api/wallet";
import { extractError } from "../../api/client";
import { type WalletSummary, type UserProfile, formatVnd } from "../../lib/walletTypes";

interface WithdrawModalProps {
  show: boolean;
  onHide: () => void;
  onSuccess: () => void;
}

export function WithdrawModal({ show, onHide, onSuccess }: WithdrawModalProps) {
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!show) return;
    setError(null);
    Promise.all([walletApi.getWallet(), walletApi.getProfile()])
      .then(([w, p]) => {
        setWallet(w);
        setProfile(p);
        setAmount(Math.min(w.available_points, Math.max(w.min_withdrawal_points, w.available_points)));
      })
      .catch((e) => setError(extractError(e)));
  }, [show]);

  const bankReady = !!(profile?.bank_name && profile?.bank_account_number && profile?.bank_account_holder);
  const belowMin = wallet ? wallet.available_points < wallet.min_withdrawal_points : false;

  const handleSubmit = async () => {
    if (!wallet) return;
    setSubmitting(true);
    setError(null);
    try {
      await walletApi.request(amount, note || undefined);
      onSuccess();
      onHide();
    } catch (e) {
      setError(extractError(e, "Yêu cầu rút thất bại"));
    } finally {
      setSubmitting(false);
    }
  };

  if (!wallet || !profile) {
    return (
      <Modal show={show} onHide={onHide} centered>
        <Modal.Body className="text-center py-4">
          {error ? <Alert variant="danger" className="py-2">{error}</Alert> : <Spinner animation="border" size="sm" />}
        </Modal.Body>
      </Modal>
    );
  }

  const vnd = amount * wallet.point_to_vnd;
  const canSubmit = bankReady
    && amount >= wallet.min_withdrawal_points
    && amount <= wallet.available_points;

  return (
    <Modal show={show} onHide={onHide} centered backdrop={submitting ? "static" : true}>
      <Modal.Header closeButton>
        <Modal.Title><i className="bi bi-cash-coin me-2"></i>Yêu cầu rút tiền</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {!bankReady && (
          <Alert variant="warning" className="d-flex align-items-start gap-2 py-2">
            <i className="bi bi-exclamation-triangle mt-1"></i>
            <div>
              <strong>Chưa có tài khoản ngân hàng.</strong>
              <div className="small">Bạn cần cập nhật thông tin ngân hàng trước khi rút tiền.</div>
              <Link to="/settings" className="small">Cập nhật ngay →</Link>
            </div>
          </Alert>
        )}

        {belowMin && (
          <Alert variant="info" className="d-flex align-items-start gap-2 py-2">
            <i className="bi bi-info-circle mt-1"></i>
            <div>
              <strong>Chưa đủ ngưỡng rút.</strong>
              <div className="small">
                Cần tối thiểu <strong>{wallet.min_withdrawal_points}</strong> điểm khả dụng để tạo yêu cầu rút.
                Bạn đang có <strong>{wallet.available_points}</strong> điểm — hãy gán thêm và đợi admin duyệt nhé.
              </div>
            </div>
          </Alert>
        )}

        <div className="withdraw-summary">
          <div>
            <div className="withdraw-summary-label">Khả dụng</div>
            <div className="withdraw-summary-value score-value">{wallet.available_points} điểm</div>
            <div className="withdraw-summary-vnd">≈ {formatVnd(wallet.available_points * wallet.point_to_vnd)}</div>
          </div>
          <div>
            <div className="withdraw-summary-label">Tỷ giá</div>
            <div className="withdraw-summary-value">{wallet.point_to_vnd.toLocaleString("vi-VN")} ₫/điểm</div>
            <div className="withdraw-summary-vnd small">Tối thiểu: {wallet.min_withdrawal_points} điểm</div>
          </div>
        </div>

        <Form className="mt-4">
          <Form.Group className="mb-3">
            <Form.Label>Số điểm muốn rút</Form.Label>
            <Form.Control
              type="number"
              min={wallet.min_withdrawal_points}
              max={wallet.available_points}
              value={amount}
              onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
              disabled={!bankReady}
            />
            <Form.Text className="text-muted">
              ≈ <strong className="score-value">{formatVnd(vnd)}</strong> sẽ được chuyển vào tài khoản
            </Form.Text>
          </Form.Group>

          {bankReady && (
            <div className="bank-preview mb-3">
              <i className="bi bi-bank2"></i>
              <div>
                <div className="bank-name">{profile.bank_name}</div>
                <div className="bank-meta">
                  {profile.bank_account_number} · {profile.bank_account_holder}
                </div>
              </div>
            </div>
          )}

          <Form.Group>
            <Form.Label className="small">Ghi chú (tuỳ chọn)</Form.Label>
            <Form.Control as="textarea" rows={2} value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Rút lương tháng..." />
          </Form.Group>
        </Form>

        {error && <Alert variant="danger" className="py-2 mt-3 mb-0">{error}</Alert>}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide} disabled={submitting}>Huỷ</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={!canSubmit || submitting}>
          {submitting ? <Spinner size="sm" animation="border" /> : (
            <><i className="bi bi-send-check me-2"></i>Gửi yêu cầu</>
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
