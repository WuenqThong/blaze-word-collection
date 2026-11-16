import { systemText } from "../../lib/display";
import { useState } from "react";
import { useDemo } from "./context";
import { Action } from "./ui";
import type { Contribution } from "./types";

export function SyncItem({ c }: { c: Contribution }) {
  const { syncAction } = useDemo();
  const [confirm, setConfirm] = useState(false);
  if (c.id.startsWith("c:")) return null;
  const label = c.withdrawn ? "Đã bỏ gửi · giữ bản gốc trên máy" : c.sync?.status === "rejected" ? "Máy chủ từ chối" : c.sync?.status === "accepted" ? "Máy chủ đã nhận · chờ tải lại" : !c.sync?.approved ? "Chờ bạn xác nhận gửi" : c.sync.status === "retry" ? "Chưa gửi được · có thể thử lại" : "Chờ gửi";
  return <div className="demo-sync-item"><p role="status">{label}{c.sync?.attempts ? ` · ${c.sync.attempts} lần thử` : ""}</p>{c.sync?.reason && <p>{systemText(c.sync.reason)}</p>}{!c.withdrawn && c.sync?.status !== "accepted" && <div className="demo-actions"><Action onClick={() => syncAction(c.id, "retry")}>{c.sync?.approved ? "Thử gửi lại nguyên bản" : "Xác nhận gửi nguyên bản"}</Action><button className="btn btn-outline-danger" onClick={() => setConfirm(true)}>Bỏ gửi</button></div>}{confirm && <div role="alertdialog" aria-label="Xác nhận bỏ gửi"><p>Ngừng gửi mẫu này? Bản gốc và lịch sử vẫn được giữ trên máy. Nếu yêu cầu trước đã tới máy chủ, cần tải lại và rút bản trên máy chủ riêng.</p><button className="btn btn-outline-secondary" onClick={() => setConfirm(false)}>Giữ lại</button><Action onClick={async () => { await syncAction(c.id, "discard"); setConfirm(false); }}>Xác nhận bỏ gửi</Action></div>}</div>;
}
