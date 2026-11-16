import { Link } from "react-router-dom";
import { useDemo } from "./context";
import { Action } from "./ui";
import type { Session } from "./types";

export function GameSyncStatus({ session }: { session: Session }) {
  const { live, refresh, run } = useDemo();
  if (!live) return null;
  if (!session.serverRevision) return <p className="demo-note">Lượt cũ này chỉ có bản đầy đủ trên thiết bị hiện tại. <Link to="/demo/play">Mở lượt mới</Link> để lưu và tiếp tục trên thiết bị khác.</p>;
  const pending = session.serverPending?.length ?? 0;
  if (!session.serverSyncError && !session.serverConflict && !session.localBackups?.length) return null;
  return <section className="game-sync-status" aria-label="Trạng thái lưu lượt chơi">
    {session.serverSyncError && <p role="alert">{session.serverSyncError}</p>}
    {!session.serverConflict && <Action onClick={refresh}>{pending > 0 ? "Thử đồng bộ lại" : "Tải lại"}</Action>}
    {session.serverConflict && <div role="alertdialog" aria-label="Lượt chơi thay đổi trên thiết bị khác">
      <h2>{session.serverValidationError ? "Có nội dung cần chỉnh lại trước khi gửi" : "Lượt chơi đã thay đổi trên thiết bị khác"}</h2>
      <p>Bản máy chủ đang ở bước {session.serverConflict.cursor + 1}; thiết bị này có {pending} thao tác chưa được xác nhận. Hãy chọn bản muốn tiếp tục. Nháp cũ sẽ được giữ trong lịch sử trên thiết bị này.</p>
      {session.serverValidationError && <p>Máy chủ chưa nhận nội dung chưa hợp lệ. Dùng bản đã lưu để tiếp tục sửa; nháp chưa nhận vẫn được giữ trong lịch sử.</p>}
      <div className="demo-actions"><Action onClick={() => run({ type: "resolveGameConflict", id: session.id, choice: "server" })}>Dùng bản trên máy chủ</Action><Action disabled={session.serverConflict.state !== "playing" || session.serverValidationError} onClick={() => run({ type: "resolveGameConflict", id: session.id, choice: "local" })}>Gửi lại các thay đổi trên thiết bị này</Action></div>
    </div>}
    {!!session.localBackups?.length && <details><summary>Nháp được giữ sau khi xử lý xung đột ({session.localBackups.length})</summary>{session.localBackups.map((backup, i) => <div key={i}><p>{new Date(backup.at).toLocaleString("vi-VN")}</p>{backup.commands.map(entry => <p key={entry.key}>{entry.command.type === "answer" || entry.command.type === "draftAnswer" ? `Câu ${entry.command.index + 1}: ${entry.command.answer.text || entry.command.answer.standard || "Chưa nhập nội dung"}` : "Đã lưu một thao tác điều hướng hoặc gửi bài."}</p>)}</div>)}</details>}
  </section>;
}
