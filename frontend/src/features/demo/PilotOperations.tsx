import { ResponsiveTable } from "../../components/ResponsiveTable";
import { useEffect, useState } from "react";
import { apiClient, errorMessage } from "../../api/client";
import { Action, Heading, Panel } from "./ui";
import { download } from "./files";

interface Operations {
  generated_at: string; database_engine: string; pilot_people: number;
  started: number; submitted: number; samples: number; pending_review: number;
  held: number; rejected: number; duplicates: number; disagreements: number;
  unresolved_disagreements: number; oldest_pending_hours: number; eligible_release: number;
  by_region: Record<string, number>; reference_questions: number; verified_reference_questions: number;
  pilot_evaluation: { reason: string };
  targets: { samples: number; review_hours: number; noise_rate: number; duplicate_rate: number; disagreement_rate: number };
  active_reviewers: number;
  http: { requests: number; server_errors: number; unauthorized: number; rate_limited: number; p95_ms: number | null; capped: boolean };
  definitions: Record<string, string>;
  assessment: {
    scope: string;
    kpis: { key: string; status: string; reason: string }[];
    reviewer_gaps: { region: string; reviewers: number }[];
    review_timing: { completed: number; measured: number; missing_history: number; completed_late: number; pending_late: number; oldest_waiting_hours: number; max_completed_hours: number | null };
    next_release: { status: string; reason: string };
  };
}

const kpiLabels: Record<string, string> = {
  people: "Nhóm 20 người", samples: "1.000 mẫu chưa rút", review_hours: "Duyệt trong 48 giờ",
  noise_rate: "Rác không quá 10%", duplicate_rate: "Trùng không quá 10%", disagreement_rate: "Bất đồng không quá 20%",
};

export function PilotOperations() {
  const [data, setData] = useState<Operations>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(undefined); setError("");
    void apiClient.get<Operations>("/dialect/operations/summary", { signal: controller.signal }).then(r => { if (!controller.signal.aborted) setData(r.data); }).catch(e => { if (!controller.signal.aborted) setError(errorMessage(e)); });
    return () => controller.abort();
  }, [attempt]);
  const table = (rows: [string, number | string][]) => <ResponsiveTable><table><thead><tr><th>Chỉ tiêu</th><th>Giá trị</th></tr></thead><tbody>{rows.map(([label,value]) => <tr key={label}><th scope="row">{label}</th><td>{value}</td></tr>)}</tbody></table></ResponsiveTable>;
  return <>
    <Heading title="Vận hành pilot"><p>Theo dõi số liệu máy chủ và các điều kiện còn cần nghiệm thu.</p></Heading>
    <Action onClick={() => setAttempt(n => n + 1)}>Tải số liệu mới</Action>
    {data && <Action onClick={() => download("pilot-status.json", data)}>Xuất báo cáo hiện trạng</Action>}
    {error && <p role="alert" className="demo-error">{error} Bấm Tải số liệu mới để thử lại.</p>}
    {!data && !error && <p role="status">Đang tải số liệu vận hành…</p>}
    {data && <>
      <p className="demo-note">Cập nhật: {new Date(data.generated_at + (data.generated_at.endsWith("Z") ? "" : "Z")).toLocaleString("vi-VN")} · Cơ sở dữ liệu: {data.database_engine === "sqlite" ? "SQLite" : data.database_engine}</p>
      <Panel title="Phạm vi và nghiệm thu"><p>Nhóm pilot: <strong>{data.pilot_people} người</strong>. Mục tiêu: {data.targets.samples.toLocaleString("vi-VN")} mẫu; duyệt trong {data.targets.review_hours} giờ; rác không quá {data.targets.noise_rate*100}%, trùng không quá {data.targets.duplicate_rate*100}%, bất đồng không quá {data.targets.disagreement_rate*100}%.</p><p>Hiện có {data.active_reviewers} tài khoản người duyệt đang hoạt động. Mỗi mẫu cần một người duyệt độc lập, được phân công đúng vùng.</p><p>{data.pilot_evaluation.reason}</p><p>Chưa có kết quả đánh giá chất lượng độc lập của chuyên gia/người bản địa. Chưa thể kết luận pilot đạt hoặc quyết định mở rộng.</p></Panel>
      <Panel title="Đối chiếu chỉ tiêu chạy thử">
        <p>Số liệu dưới đây thuộc toàn kho hiện tại. Chưa dùng để nghiệm thu nhóm 20 người.</p>
        <ResponsiveTable><table><thead><tr><th>Chỉ tiêu</th><th>Kết luận</th><th>Còn thiếu</th></tr></thead><tbody>{data.assessment.kpis.map(kpi => <tr key={kpi.key}><th scope="row">{kpiLabels[kpi.key] ?? "Chỉ tiêu cần đánh giá"}</th><td>Chưa đủ dữ liệu</td><td>{kpi.reason}</td></tr>)}</tbody></table></ResponsiveTable>
        <details><summary>Việc cần làm trước khi nghiệm thu</summary>
          {data.assessment.reviewer_gaps.length > 0 && <><p>Các vùng dưới đây chưa đủ một người duyệt đang hoạt động được phân công. Quản trị viên chỉ được tham gia khi đáp ứng điều kiện độc lập của từng mẫu.</p><ul>{data.assessment.reviewer_gaps.map(gap => <li key={gap.region}>{gap.region}: {gap.reviewers}/1 người duyệt được phân công.</li>)}</ul></>}
          <ol><li>Xác định nhóm tham gia và thời gian bắt đầu, kết thúc chạy thử.</li><li>Nhờ người bản địa đánh giá độc lập mẫu sau chỉnh lý, ghi mẫu đã xem, kết luận và lý do; không tự lấy mẫu bị từ chối làm tỷ lệ rác.</li><li>Đối chiếu từng chỉ tiêu và xử lý lỗi chặn chơi, gửi bài hoặc duyệt trước khi chốt bản tiếp theo.</li></ol>
          <p>{data.assessment.next_release.reason}</p>
        </details>
      </Panel>
      <Panel title="Thu thập và kiểm duyệt">{table([
        ["Lượt bắt đầu (gồm lịch sử đã rút)",data.started], ["Lượt gửi bài (gồm lịch sử đã rút)",data.submitted],
        ["Mẫu chưa rút",data.samples], ["Chờ đánh giá, không tính mẫu trùng",data.pending_review],
        ["Cần kiểm tra hoặc bổ sung",data.held], ["Không đạt",data.rejected], ["Đánh dấu trùng",data.duplicates],
        ["Có bất đồng giữa người duyệt",data.disagreements], ["Bất đồng chưa phân xử",data.unresolved_disagreements],
        ["Mẫu chờ lâu nhất (giờ)",data.oldest_pending_hours], ["Đủ điều kiện xuất",data.eligible_release],
        ["Nháp chưa đồng bộ trên thiết bị khác","Chưa thể đo từ máy chủ"],
      ])}<details><summary>Cách tính và giới hạn</summary>{Object.values(data.definitions).map(note => <p key={note}>{note}</p>)}</details></Panel>
      <details className="admin-disclosure"><summary>Thời gian duyệt và tồn quá hạn</summary>{table([
        ["Mẫu đã có kết luận", data.assessment.review_timing.completed],
        ["Đo được thời gian từ lịch sử", data.assessment.review_timing.measured],
        ["Thiếu lịch sử để đo", data.assessment.review_timing.missing_history],
        ["Đã kết luận sau hơn 48 giờ", data.assessment.review_timing.completed_late],
        ["Đang chờ quá 48 giờ, gồm tạm giữ", data.assessment.review_timing.pending_late],
        ["Thời gian chờ lâu nhất, gồm tạm giữ (giờ)", data.assessment.review_timing.oldest_waiting_hours],
        ["Thời gian duyệt lâu nhất (giờ)", data.assessment.review_timing.max_completed_hours ?? "Chưa có số liệu"],
      ])}<p>{data.definitions.review_timing}</p></details>
      <details className="admin-disclosure"><summary>Phân bố mẫu theo vùng</summary>{Object.keys(data.by_region).length ? table(Object.entries(data.by_region)) : <p>Chưa có mẫu để thống kê vùng.</p>}</details>
      <details className="admin-disclosure"><summary>Lỗi và tốc độ phản hồi gần đây</summary>{table([
        ["Yêu cầu được ghi nhận",data.http.requests], ["Lỗi máy chủ",data.http.server_errors],
        ["Phiên thiếu hoặc hết hạn",data.http.unauthorized], ["Yêu cầu bị giới hạn tần suất",data.http.rate_limited],
        ["95% phản hồi trong (ms)",data.http.p95_ms ?? "Chưa có số liệu"],
      ])}<p>{data.definitions.http} {data.http.capped ? "Đã chạm giới hạn lưu, số đếm không đầy đủ." : ""}</p></details>
      <details className="admin-disclosure"><summary>Ngân hàng câu kiểm tra và chất lượng độc lập</summary><p>{data.verified_reference_questions}/{data.reference_questions} câu có trạng thái đã xác minh trong hệ thống.</p><p>{data.definitions.expert}</p></details>
    </>}
  </>;
}
