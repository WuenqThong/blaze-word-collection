import { Link } from "react-router-dom";
import { useDemo } from "./context";
import { DemoGuard, Heading, Panel } from "./ui";
import { isTestSession, isTestContribution } from "./testSessions";

export function DashboardDemo() {
  return <DemoGuard><DashboardInner /></DemoGuard>;
}
function DashboardInner() {
  const { state, live } = useDemo();
  const sessions = state.sessions.filter((s) => s.state !== "withdrawn" && !isTestSession(s));
  const completed = sessions.filter((s) => s.state === "submitted");
  const contributions = state.contributions.filter((c) => !c.withdrawn && !c.duplicateOf && !isTestContribution(state, c));
  const pending = contributions.filter((c) => ["RAW", "REVIEW"].includes(c.status)).length;
  const verified = contributions.filter((c) => c.status === "VERIFIED").length;
  const exams = [...new Map(sessions.map((s) => [`${s.exam.id}:${s.exam.version}`, s.exam])).values()];
  return <>
    <Heading title="Tổng quan"><p>Theo dõi lượt chơi và tiến độ duyệt đóng góp.</p></Heading>
    <div className="demo-stat-grid">
      {[
        ["Lượt bắt đầu", sessions.length],
        ["Lượt hoàn thành", completed.length],
        ["Mẫu chờ duyệt", pending],
        ["Mẫu đã xác minh", verified],
      ].map(([label, value]) => <Panel key={label} title={String(label)}>
        <strong className="demo-number">{value}</strong>
      </Panel>)}
    </div>
    <p className="demo-note">
      {live
        ? "Số mẫu lấy từ máy chủ. Số lượt chơi chỉ tính các lượt trên trình duyệt này. Đã loại lượt kiểm thử và dữ liệu đã rút."
        : "Số liệu từ kho demo trên trình duyệt này; đã loại lượt kiểm thử và dữ liệu đã rút."}
    </p>
    <Panel title="Quản lý nhanh">
      <div className="demo-actions">
        <Link className="btn btn-primary" to="/demo/admin/review">Duyệt đóng góp{pending > 0 ? ` (${pending})` : ""}</Link>
        <Link className="btn btn-outline-primary" to="/demo/admin/sessions">Xem lượt chơi</Link>
        <Link className="btn btn-outline-primary" to="/demo/admin/exams">Quản lý bộ đề</Link>
      </div>
    </Panel>
    <Panel title="Tiến độ theo bộ đề">
      {sessions.length > 0 ? <>
        <p>Tỷ lệ hoàn thành chung: <strong>{Math.round(completed.length / sessions.length * 100)}%</strong></p>
        <div className="demo-table-scroll"><table>
          <thead><tr><th>Bộ đề</th><th>Bắt đầu</th><th>Hoàn thành</th><th>Tỷ lệ hoàn thành</th></tr></thead>
          <tbody>{exams.map((exam) => {
            const played = sessions.filter((s) => s.exam.id === exam.id && s.exam.version === exam.version);
            const submitted = played.filter((s) => s.state === "submitted").length;
            return <tr key={`${exam.id}:${exam.version}`}>
              <td>{exam.title} · v{exam.version}</td><td>{played.length}</td><td>{submitted}</td>
              <td>{Math.round(submitted / played.length * 100)}%</td>
            </tr>;
          })}</tbody>
        </table></div>
      </> : <p>Chưa có lượt chơi. Số liệu sẽ xuất hiện khi người chơi bắt đầu một bộ đề.</p>}
    </Panel>
  </>;
}
