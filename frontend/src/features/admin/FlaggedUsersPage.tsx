import { useEffect, useState } from "react";
import { Card, Table, Button, Badge, Spinner, Alert } from "react-bootstrap";
import { Link } from "react-router-dom";
import { reviewApi } from "../../api/review";
import { extractError } from "../../api/client";
import type { FlaggedUserItem, AccountStatus } from "../../lib/reviewTypes";
import { useConfirm } from "../../components/ConfirmProvider";

export function FlaggedUsersPage() {
  const confirm = useConfirm();
  const [items, setItems] = useState<FlaggedUserItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = () => {
    reviewApi.flaggedUsers().then(setItems).catch((e) => setError(extractError(e)));
  };

  useEffect(load, []);

  const setStatus = async (userId: number, next: AccountStatus) => {
    setBusy(userId);
    try { await reviewApi.setAccountStatus(userId, next); load(); }
    catch (e) { setError(extractError(e)); }
    finally { setBusy(null); }
  };

  return (
    <>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <Link to="/dashboard" className="small text-muted">
            <i className="bi bi-arrow-left me-1"></i>Dashboard
          </Link>
          <h3 className="mt-1 mb-0">Tài khoản bất thường</h3>
          <p className="text-muted mb-0 mt-1">
            User có error rate ≥ 30% (sau ≥ 10 review) sẽ tự động bị flag.
          </p>
        </div>
        <Badge bg="warning" text="dark" className="fs-6">
          {items?.length ?? "—"} tài khoản
        </Badge>
      </div>

      {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}

      {items === null ? (
        <div className="text-center py-5"><Spinner animation="border" /></div>
      ) : items.length === 0 ? (
        <Card>
          <Card.Body className="text-center py-5 text-muted">
            <i className="bi bi-shield-check" style={{ fontSize: "2.4rem", color: "var(--score-color)" }}></i>
            <p className="mt-2 mb-0">Không có tài khoản nào bất thường 🎉</p>
          </Card.Body>
        </Card>
      ) : (
        <Card>
          <div className="table-responsive">
            <Table hover className="align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Trạng thái</th>
                  <th className="text-end">Đã duyệt</th>
                  <th className="text-end">Bị reject</th>
                  <th className="text-end">Tỉ lệ sai</th>
                  <th className="text-end">Điểm chính thức</th>
                  <th style={{ width: 200 }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <tr key={u.user_id}>
                    <td><strong>{u.full_name}</strong></td>
                    <td className="small text-muted">{u.email}</td>
                    <td>
                      <Badge bg={u.account_status === "suspended" ? "danger" : "warning"} text={u.account_status === "suspended" ? "light" : "dark"}>
                        {u.account_status === "suspended" ? "Đã khoá" : "Đang review"}
                      </Badge>
                    </td>
                    <td className="text-end">{u.count_approved}</td>
                    <td className="text-end text-danger">{u.count_rejected}</td>
                    <td className="text-end">
                      <strong>{Math.round(u.error_rate * 100)}%</strong>
                    </td>
                    <td className="text-end score-value fw-bold">{u.score_confirmed}</td>
                    <td className="text-end">
                      <Button size="sm" variant="outline-success" className="me-2"
                        onClick={() => setStatus(u.user_id, "active")} disabled={busy !== null}>
                        {busy === u.user_id ? <Spinner size="sm" animation="border" /> : "Khôi phục"}
                      </Button>
                      <Button size="sm" variant="outline-danger"
                        onClick={async () => {
                          const ok = await confirm({
                            title: "Khoá tài khoản",
                            message: <>Khoá tài khoản <strong>{u.full_name}</strong>? User sẽ không thể đăng nhập cho tới khi được khôi phục.</>,
                            confirmText: "Khoá",
                            variant: "danger",
                            icon: "bi-lock",
                          });
                          if (ok) setStatus(u.user_id, "suspended");
                        }}
                        disabled={busy !== null}>
                        Khoá
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      )}
    </>
  );
}
