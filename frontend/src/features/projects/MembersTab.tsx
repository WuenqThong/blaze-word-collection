import { useCallback, useEffect, useState } from "react";
import { Card, Table, Button, Modal, Form, Spinner, Alert, Badge, InputGroup } from "react-bootstrap";
import { projectsApi } from "../../api/projects";
import { usersApi } from "../../api/users";
import { extractError } from "../../api/client";
import type { ProjectMember } from "../../lib/projectTypes";
import type { User } from "../../lib/types";
import { useConfirm } from "../../components/ConfirmProvider";

interface MembersTabProps {
  projectId: number;
  isPublic: boolean;
  isAdmin: boolean;
}

export function MembersTab({ projectId, isPublic, isAdmin }: MembersTabProps) {
  const confirm = useConfirm();
  const [members, setMembers] = useState<ProjectMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const reload = useCallback(() => {
    projectsApi.listMembers(projectId)
      .then(setMembers)
      .catch((e) => setError(extractError(e, "Không tải được member")));
  }, [projectId]);

  useEffect(() => { reload(); }, [reload]);

  const handleRemove = async (userId: number, name: string) => {
    const ok = await confirm({
      title: "Xoá thành viên",
      message: <>Xoá <strong>{name}</strong> khỏi project?</>,
      confirmText: "Xoá",
      variant: "danger",
      icon: "bi-person-x",
    });
    if (!ok) return;
    try {
      await projectsApi.removeMember(projectId, userId);
      reload();
    } catch (e) {
      setError(extractError(e, "Xoá thất bại"));
    }
  };

  return (
    <>
      {isPublic && (
        <Alert variant="info" className="d-flex align-items-start gap-2 py-2">
          <i className="bi bi-globe mt-1"></i>
          <div className="flex-grow-1">
            <strong>Project public</strong> — mọi user đăng nhập đều có thể vào và nhận task.
            <div className="small text-muted">Danh sách dưới chỉ là role <em>manager</em> để đặc quyền (review, quản lý) — không bắt buộc.</div>
          </div>
        </Alert>
      )}

      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div className="text-muted small">
          {members?.length ?? "—"} {isPublic ? "manager / contributor được gắn role riêng" : "member"}
        </div>
        {isAdmin && (
          <Button size="sm" variant="primary" onClick={() => setShowAdd(true)}>
            <i className="bi bi-person-plus me-2"></i>Thêm thành viên
          </Button>
        )}
      </div>

      {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}

      {members === null ? (
        <div className="text-center py-5"><Spinner animation="border" /></div>
      ) : members.length === 0 ? (
        <Card>
          <Card.Body className="text-center py-5 text-muted">
            <i className="bi bi-people" style={{ fontSize: "2rem" }}></i>
            <p className="mt-2 mb-0">
              {isPublic ? "Chưa gắn role đặc biệt cho user nào." : "Chưa có member nào."}
            </p>
          </Card.Body>
        </Card>
      ) : (
        <Card>
          <div className="table-responsive">
            <Table hover className="align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Họ tên</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Tham gia</th>
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.user_id}>
                    <td>{m.full_name}</td>
                    <td className="text-muted small">{m.email}</td>
                    <td>
                      <Badge bg={m.role === "manager" ? "primary" : "secondary"} className="text-uppercase">
                        {m.role}
                      </Badge>
                    </td>
                    <td className="small text-muted">
                      {new Date(m.joined_at).toLocaleDateString("vi-VN")}
                    </td>
                    <td className="text-end">
                      {isAdmin && (
                        <Button variant="link" size="sm" className="p-1 text-danger"
                          onClick={() => handleRemove(m.user_id, m.full_name)} title="Gỡ khỏi project">
                          <i className="bi bi-x-circle"></i>
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      )}

      <AddMemberModal
        show={showAdd}
        onHide={() => setShowAdd(false)}
        projectId={projectId}
        existingUserIds={new Set(members?.map((m) => m.user_id) ?? [])}
        onAdded={reload}
      />
    </>
  );
}

function AddMemberModal({
  show, onHide, projectId, existingUserIds, onAdded,
}: {
  show: boolean;
  onHide: () => void;
  projectId: number;
  existingUserIds: Set<number>;
  onAdded: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedRole, setSelectedRole] = useState<"member" | "manager">("member");
  const [adding, setAdding] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!show) return;
    const handle = setTimeout(() => {
      setSearching(true);
      usersApi.search(q || undefined)
        .then(setResults)
        .catch((e) => setError(extractError(e, "Không tìm được user")))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [q, show]);

  const handleAdd = async (user: User) => {
    setAdding(user.id);
    setError(null);
    try {
      await projectsApi.addMember(projectId, user.id, selectedRole);
      onAdded();
      onHide();
    } catch (e) {
      setError(extractError(e, "Thêm thất bại"));
    } finally {
      setAdding(null);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title><i className="bi bi-person-plus me-2"></i>Thêm thành viên</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form.Group className="mb-3">
          <Form.Label className="small text-muted">Role gán</Form.Label>
          <Form.Select size="sm" value={selectedRole} onChange={(e) => setSelectedRole(e.target.value as "member" | "manager")}>
            <option value="member">Member — gán thông thường</option>
            <option value="manager">Manager — quản lý project</option>
          </Form.Select>
        </Form.Group>

        <InputGroup className="mb-3">
          <InputGroup.Text><i className="bi bi-search"></i></InputGroup.Text>
          <Form.Control
            placeholder="Tìm theo email hoặc họ tên..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
        </InputGroup>

        {error && <Alert variant="danger" className="py-2">{error}</Alert>}

        {searching ? (
          <div className="text-center py-3"><Spinner size="sm" animation="border" /></div>
        ) : results.length === 0 ? (
          <div className="text-center py-3 text-muted small">Không tìm thấy user nào.</div>
        ) : (
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {results.map((u) => {
              const isMember = existingUserIds.has(u.id);
              return (
                <div key={u.id}
                  className="d-flex align-items-center justify-content-between p-2 rounded-2 mb-1"
                  style={{ background: "var(--surface-1)" }}>
                  <div className="d-flex align-items-center gap-2 flex-grow-1">
                    <div
                      style={{
                        width: 32, height: 32, borderRadius: "50%",
                        background: "linear-gradient(135deg, var(--brand-600), var(--accent-500))",
                        color: "#fff", fontWeight: 700, fontSize: "0.78rem",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      {u.full_name.split(" ").pop()?.[0]?.toUpperCase() ?? "U"}
                    </div>
                    <div className="flex-grow-1 text-truncate">
                      <div style={{ fontWeight: 600 }} className="text-truncate">{u.full_name}</div>
                      <div className="small text-muted text-truncate">{u.email} · {u.role}</div>
                    </div>
                  </div>
                  {isMember ? (
                    <Badge bg="success">Đã trong project</Badge>
                  ) : (
                    <Button size="sm" variant="outline-primary"
                      onClick={() => handleAdd(u)}
                      disabled={adding !== null}>
                      {adding === u.id ? <Spinner size="sm" animation="border" /> : <><i className="bi bi-plus-lg me-1"></i>Thêm</>}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
}
