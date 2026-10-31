import { useEffect, useState, type FormEvent } from "react";
import { Card, Form, Button, Alert, Tab, Tabs, Spinner, Row, Col } from "react-bootstrap";
import { walletApi } from "../api/wallet";
import { extractError } from "../api/client";
import type { UserProfile, ProfileUpdatePayload } from "../lib/walletTypes";

export function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // form state
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [dob, setDob] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankNumber, setBankNumber] = useState("");
  const [bankHolder, setBankHolder] = useState("");

  useEffect(() => {
    walletApi.getProfile()
      .then((p) => {
        setProfile(p);
        setPhone(p.phone ?? ""); setAddress(p.address ?? ""); setDob(p.date_of_birth ?? "");
        setBankName(p.bank_name ?? ""); setBankNumber(p.bank_account_number ?? ""); setBankHolder(p.bank_account_holder ?? "");
      })
      .catch((e) => setError(extractError(e)));
  }, []);

  const save = async (payload: ProfileUpdatePayload) => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const p = await walletApi.updateProfile(payload);
      setProfile(p);
      setSuccess("Đã lưu thay đổi");
      setTimeout(() => setSuccess(null), 2500);
    } catch (e) {
      setError(extractError(e, "Lưu thất bại"));
    } finally {
      setSaving(false);
    }
  };

  const onSubmitProfile = (e: FormEvent) => {
    e.preventDefault();
    void save({ phone, address, date_of_birth: dob || undefined });
  };

  const onSubmitBank = (e: FormEvent) => {
    e.preventDefault();
    void save({ bank_name: bankName, bank_account_number: bankNumber, bank_account_holder: bankHolder });
  };

  if (!profile) {
    return <div className="text-center py-5"><Spinner animation="border" size="sm" /></div>;
  }

  return (
    <>
      <h3 className="mb-1">Cài đặt</h3>
      <p className="text-muted mb-4">Cập nhật thông tin cá nhân và tài khoản ngân hàng để nhận thanh toán.</p>

      {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}
      {success && <Alert variant="success" className="py-2"><i className="bi bi-check-circle me-2"></i>{success}</Alert>}

      <Tabs defaultActiveKey="profile" className="mb-3">
        <Tab eventKey="profile" title={<><i className="bi bi-person me-1"></i>Hồ sơ</>}>
          <Card>
            <Card.Body className="p-4">
              <Form onSubmit={onSubmitProfile}>
                <Row className="g-3">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Họ tên</Form.Label>
                      <Form.Control value={profile.full_name} disabled />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Email</Form.Label>
                      <Form.Control value={profile.email} disabled />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Số điện thoại</Form.Label>
                      <Form.Control value={phone} placeholder="0901234567"
                        onChange={(e) => setPhone(e.target.value)} />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Ngày sinh</Form.Label>
                      <Form.Control type="date" value={dob}
                        onChange={(e) => setDob(e.target.value)} />
                    </Form.Group>
                  </Col>
                  <Col md={12}>
                    <Form.Group>
                      <Form.Label>Địa chỉ</Form.Label>
                      <Form.Control value={address} placeholder="Địa chỉ liên hệ"
                        onChange={(e) => setAddress(e.target.value)} />
                    </Form.Group>
                  </Col>
                </Row>
                <div className="d-flex justify-content-end mt-4">
                  <Button type="submit" variant="primary" disabled={saving}>
                    {saving ? <Spinner size="sm" animation="border" /> : <><i className="bi bi-check2 me-2"></i>Lưu thay đổi</>}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Tab>

        <Tab eventKey="bank" title={<><i className="bi bi-bank me-1"></i>Tài khoản ngân hàng</>}>
          <Card>
            <Card.Body className="p-4">
              <Alert variant="info" className="py-2 small">
                <i className="bi bi-info-circle me-2"></i>
                Hệ thống sẽ chuyển khoản về tài khoản này khi bạn yêu cầu rút điểm.
                Vui lòng đảm bảo thông tin chính xác — chủ tài khoản phải trùng họ tên đăng ký.
              </Alert>

              <Form onSubmit={onSubmitBank}>
                <Row className="g-3">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Ngân hàng</Form.Label>
                      <Form.Control value={bankName} placeholder="VD: Vietcombank, Techcombank, MB Bank..."
                        onChange={(e) => setBankName(e.target.value)} />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Số tài khoản</Form.Label>
                      <Form.Control value={bankNumber} placeholder="123456789"
                        onChange={(e) => setBankNumber(e.target.value)} />
                    </Form.Group>
                  </Col>
                  <Col md={12}>
                    <Form.Group>
                      <Form.Label>Tên chủ tài khoản</Form.Label>
                      <Form.Control value={bankHolder} placeholder="NGUYEN VAN A"
                        onChange={(e) => setBankHolder(e.target.value.toUpperCase())} />
                      <Form.Text>Viết HOA không dấu, đúng như trên thẻ ngân hàng.</Form.Text>
                    </Form.Group>
                  </Col>
                </Row>
                <div className="d-flex justify-content-end mt-4">
                  <Button type="submit" variant="primary" disabled={saving}>
                    {saving ? <Spinner size="sm" animation="border" /> : <><i className="bi bi-check2 me-2"></i>Lưu tài khoản</>}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Tab>
      </Tabs>
    </>
  );
}
