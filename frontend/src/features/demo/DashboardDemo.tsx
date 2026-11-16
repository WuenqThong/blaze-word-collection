import { ResponsiveTable } from "../../components/ResponsiveTable";
import { Link } from "react-router-dom";
import { useDemo } from "./context";
import { DemoGuard, Heading, Panel } from "./ui";
import { isTestSession, isTestContribution } from "./testSessions";

export function DashboardDemo() {
  return <DemoGuard><DashboardInner /></DemoGuard>;
}
function DashboardInner() {
  const { state, live } = useDemo();
  const sessions = state.sessions.filter((s) => s.state !== "withdrawn" && !isTestSession(s) && (!state.gameServerEnabled || !!s.serverRevision));
  const completed = sessions.filter((s) => s.state === "submitted");
  const contributions = state.contributions.filter((c) => !c.withdrawn && !c.duplicateOf && !isTestContribution(state, c));
  const pending = contributions.filter((c) => ["RAW", "REVIEW"].includes(c.status)).length;
  const verified = contributions.filter((c) => c.status === "VERIFIED").length;
  const held = contributions.filter(c => c.status === "HOLD").length;
  const feedback = state.feedback.filter(f => f.state === "open").length;
  const exams = [...new Map(sessions.map((s) => [`${s.exam.id}:${s.exam.version}`, s.exam])).values()];
  return <div className="admin-home">
    <Heading title="Tổng quan quản trị"><p>Bắt đầu từ việc cần xử lý. Các chức năng còn lại được gom trong 3 nhóm Dữ liệu, Trò chơi và Quản lý.</p></Heading>
    <Panel title="Việc cần xử lý">
      <div className="admin-work-list">
        <Link to="/demo/reviewer/review"><i className="bi bi-inbox" aria-hidden="true"/><div><strong>Duyệt đóng góp</strong><span>{pending ? `${pending} đóng góp đang chờ đánh giá hoặc phân xử` : "Chưa có đóng góp chờ đánh giá"}</span></div><span className="admin-work-action">Mở hàng chờ <i className="bi bi-arrow-right" aria-hidden="true"/></span></Link>
        <Link to="/demo/reviewer/review?status=HOLD"><i className="bi bi-chat-left-text" aria-hidden="true"/><div><strong>Kiểm tra nội dung cần bổ sung</strong><span>{held ? `${held} đóng góp đang tạm giữ để kiểm tra hoặc bổ sung` : "Chưa có đóng góp đang tạm giữ"}{feedback > 0 ? ` · ${feedback} phản hồi chưa xử lý` : ""}</span></div><span className="admin-work-action">Xem nội dung <i className="bi bi-arrow-right" aria-hidden="true"/></span></Link>
        <Link to="/demo/reviewer/datasets"><i className="bi bi-box-arrow-down" aria-hidden="true"/><div><strong>Chuẩn bị bộ dữ liệu</strong><span>{live ? (state.serverStats ? `${state.serverStats.valid_samples} mẫu đủ điều kiện xuất theo kiểm tra của máy chủ` : "Đang tải số mẫu đủ điều kiện xuất") : "Kiểm tra các mẫu đã duyệt và tạo bản xuất"}</span></div><span className="admin-work-action">Mở bản xuất <i className="bi bi-arrow-right" aria-hidden="true"/></span></Link>
      </div>
    </Panel>
    <div className="admin-shortcuts">
      <Link to="/demo/reviewer/exams"><i className="bi bi-controller" aria-hidden="true"/><div><strong>Trò chơi & lượt chơi</strong><span>Quản lý bộ đề, xem người chơi đã gửi gì.</span></div><i className="bi bi-arrow-right" aria-hidden="true"/></Link>
      <Link to="/demo/reviewer/settings"><i className="bi bi-people" aria-hidden="true"/><div><strong>Người dùng & phân công</strong><span>Quản lý vai trò, giao vùng cho người duyệt.</span></div><i className="bi bi-arrow-right" aria-hidden="true"/></Link>
    </div>
    <details className="admin-disclosure"><summary>Số liệu hoạt động và cách tính</summary><div>
      <dl className="admin-summary-numbers">
        <div><dt>Lượt bắt đầu</dt><dd>{live ? state.serverStats?.started_sessions ?? "Đang tải" : sessions.length}</dd></div>
        <div><dt>Lượt gửi bài</dt><dd>{live ? state.serverStats?.submitted_sessions ?? "Đang tải" : completed.length}</dd></div>
        <div><dt>Mẫu đã duyệt đạt</dt><dd>{verified}</dd></div>
      </dl>
      <p className="demo-note">{live ? (state.serverStats?.definitions.coverage ?? "Đang tải số liệu máy chủ.") + " Lượt bắt đầu/gửi bài giữ lịch sử kể cả khi đã rút." : "Số liệu từ kho minh họa trên trình duyệt này; đã loại lượt kiểm thử và dữ liệu đã rút."}</p>
    </div></details>
    <details className="admin-disclosure"><summary>{state.gameServerEnabled ? "Tiến độ các lượt có bản đề trên máy chủ" : live ? "Tiến độ bộ đề trên thiết bị này" : "Tiến độ theo bộ đề"}</summary><div>
      {sessions.length > 0 ? <>
        <p>Tỷ lệ hoàn thành chung: <strong>{Math.round(completed.length / sessions.length * 100)}%</strong></p>
        <ResponsiveTable><table>
          <thead><tr><th>Bộ đề</th><th>Bắt đầu</th><th>Hoàn thành</th><th>Tỷ lệ hoàn thành</th></tr></thead>
          <tbody>{exams.map((exam) => {
            const played = sessions.filter((s) => s.exam.id === exam.id && s.exam.version === exam.version);
            const submitted = played.filter((s) => s.state === "submitted").length;
            return <tr key={`${exam.id}:${exam.version}`}>
              <td>{exam.title} · phiên bản {exam.version}</td><td>{played.length}</td><td>{submitted}</td>
              <td>{Math.round(submitted / played.length * 100)}%</td>
            </tr>;
          })}</tbody>
        </table></ResponsiveTable>
      </> : <p>Chưa có lượt chơi. Số liệu sẽ xuất hiện khi người chơi bắt đầu một bộ đề.</p>}
    </div></details>
  </div>;
}
