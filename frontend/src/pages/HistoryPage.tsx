import { HistoryTab } from "../features/rewards/HistoryTab";

export function HistoryPage() {
  return (
    <>
      <h3 className="mb-1">Lịch sử</h3>
      <p className="text-muted mb-4">Annotation đã gửi. Bài chờ duyệt có thể sửa lại; bài đã duyệt hoặc bị từ chối thì không.</p>
      <HistoryTab />
    </>
  );
}
