import { ResponsiveTable } from "../../components/ResponsiveTable";
import { useState } from "react";
import { useDemo } from "./context";
import { eligible } from "./domain";
import { Action, Field, Heading, Panel } from "./ui";

function streak(dates: string[]) {
  const days = new Set(
    dates.map((d) =>
      new Date(d).toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" }),
    ),
  );
  let n = 0;
  const day = new Date();
  while (
    days.has(day.toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" }))
  ) {
    n++;
    day.setDate(day.getDate() - 1);
  }
  return n;
}
export function RewardsDemo() {
  const { state, run, live } = useDemo();
  const actor = state.people.find((p) => p.id === state.actor)!;
  const [name, setName] = useState("");
  const [appeal, setAppeal] = useState("");
  const [candidate, setCandidate] = useState("");
  const completed = state.sessions.filter(
    (s) => s.owner === actor.id && s.state === "submitted" && (!state.gameServerEnabled || !!s.serverRevision),
  );
  const verified = state.contributions.filter(
    (c) => c.owner === actor.id && eligible(state, c),
  );
  const accountKey = actor.id.replace(/^account:/, "");
  const serverCounts = state.serverStats?.by_user?.[accountKey];
  const completedCount = live ? serverCounts?.submitted_sessions ?? 0 : completed.length;
  const verifiedCount = live ? serverCounts?.valid_samples ?? 0 : verified.length;
  const now = new Date().toISOString();
  const credits = state.credits.filter((c) => c.owner === actor.id);
  const balance = credits
    .filter(
      (c) =>
        !c.revoked &&
        c.expiresAt > now &&
        state.contributions.some(
          (x) => x.id === c.contributionId && eligible(state, x),
        ),
    )
    .reduce((n, c) => n + c.amount - c.used, 0);
  return (
    <>
      <Heading title="Thành tích & hạn mức AI nội bộ">
        <p>
          Điểm tham gia khác hạn mức AI. Không có chuyển nhượng, đổi tiền hoặc
          xuất token/API key.{" "}
          {live
            ? "Hạn mức, xác nhận tài khoản và khiếu nại lưu trên máy chủ; ví VND không bị tác động."
            : "Tất cả trong trang này là minh họa."}
        </p>
      </Heading>
      <div className="demo-stat-grid">
        <Panel title="Lượt gửi hoàn tất">
          <strong className="demo-number">{completedCount}</strong>
        </Panel>
        <Panel title="Điểm tham gia minh họa">
          <strong className="demo-number">{completedCount * 10}</strong>
          <p>10 điểm/lượt, không đổi lượt sử dụng.</p>
        </Panel>
        <Panel title={live ? "Chuỗi ngày trên thiết bị này" : "Chuỗi liên tiếp hiện tại"}>
          <strong className="demo-number">
            {streak(completed.map((s) => s.submittedAt!))}
          </strong>
          <p>Ngày liên tiếp có lượt gửi, theo giờ Việt Nam.</p>
        </Panel>
        <Panel title="Hạn mức còn dùng được">
          <strong className="demo-number">{balance}</strong>
          <p>{live ? "Lượt AI nội bộ." : "Lượt AI nội bộ minh họa."}</p>
        </Panel>
      </div>
      <div className="demo-two-col">
        <Panel title="Huy hiệu">
          <ul>
            <li>
              {completedCount ? "Đã đạt" : "Chưa đạt"} · Lượt chơi đầu tiên
            </li>
            <li>
              {verifiedCount ? "Đã đạt" : "Chưa đạt"} · Đóng góp đủ Kiểm tra chất lượng/quyền
            </li>
            <li>
              {streak(completed.map((s) => s.submittedAt!)) >= 3
                ? "Đã đạt"
                : "Chưa đạt"}{" "}
              · Ba ngày liên tiếp
            </li>
          </ul>
          <p>
            Thành tích được tính từ lượt/mẫu trong kho hiện tại, không phải xác
            nhận chuyên môn.
          </p>
        </Panel>
        <Panel title="Lộ trình nhận hạn mức">
          <ol>
            <li>
              {actor.role === "guest"
                ? "Chưa có tài khoản"
                : live ? "Có tài khoản" : "Có tài khoản minh họa"}
            </li>
            <li>
              {actor.verified ? (live ? "Đã xác nhận tài khoản" : "Đã xác nhận minh họa") : "Chờ xác nhận tài khoản"}
            </li>
            <li>{verifiedCount} mẫu đủ Kiểm tra chất lượng/phạm vi đồng ý/quyền</li>
            <li>
              {actor.risk === "clear"
                ? "Không tạm giữ rủi ro"
                : "Đang tạm giữ để rà soát"}
            </li>
            <li>
              {state.rewardEnabled
                ? live ? "Chính sách hạn mức đang bật" : "Đã bật chính sách minh họa"
                : "Chính sách chưa bật"}
            </li>
          </ol>
          <p>
            Chỉ quản trị viên cấp: 5 lượt/mẫu mới không trùng, tối đa 4 lần cấp/ngày,
            hết hạn sau 30 ngày; không tự cấp khi đăng ký/chơi.
          </p>
        </Panel>
      </div>
      {!live && <Panel title="Tạo tài khoản Minh họa tùy chọn">
        <p>
          Không đăng ký tài khoản thật, không yêu cầu mật khẩu hoặc thông tin cá
          nhân.
        </p>
        <Field label="Tên hiển thị giả lập">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ví dụ: Người thử giao diện"
            maxLength={100}
          />
        </Field>
        <Action
          disabled={!name.trim()}
          onClick={async () => {
            await run({ type: "register", name, region: actor.region });
            setName("");
          }}
        >
          Tạo tài khoản minh họa · 0 lượt sử dụng
        </Action>
      </Panel>}
      <Panel title={live ? "Thống kê tham gia trên máy chủ" : "Bảng xếp hạng minh họa"}>
        {live && <p className="demo-note">{state.serverStats?.definitions.submitted_sessions} {state.serverStats?.definitions.coverage}</p>}
        <ResponsiveTable>
          <table>
            <thead>
              <tr>
                <th>Tên hiển thị</th>
                <th>Lượt hoàn tất</th>
                <th>Mẫu đủ chất lượng</th>
                <th>Điểm tham gia</th>
              </tr>
            </thead>
            <tbody>
              {state.people
                .filter((p) => p.role === "contributor" && (!live || !!state.serverStats?.by_user?.[p.id.replace(/^account:/, "")]))
                .map((p) => ({
                  p,
                  count: live ? state.serverStats?.by_user?.[p.id.replace(/^account:/, "")]?.submitted_sessions ?? 0 : state.sessions.filter(
                    (s) => s.owner === p.id && s.state === "submitted",
                  ).length,
                  qa: live ? state.serverStats?.by_user?.[p.id.replace(/^account:/, "")]?.valid_samples ?? 0 : state.contributions.filter(
                    (c) => c.owner === p.id && eligible(state, c),
                  ).length,
                }))
                .sort((a, b) => b.qa - a.qa || b.count - a.count)
                .map(({ p, count, qa }) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{count}</td>
                    <td>{qa}</td>
                    <td>{count * 10}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </ResponsiveTable>
      </Panel>
      {["admin", "reviewer"].includes(actor.role) && (
        <Panel title={live ? "Chính sách & cấp hạn mức" : "Duyệt cơ chế & cấp hạn mức Minh họa"}>
          <label className="demo-checkbox">
            <input
              type="checkbox"
              checked={state.rewardEnabled}
              onChange={(e) =>
                void run({
                  type: "rewardPolicy",
                  enabled: e.target.checked,
                }).catch(() => {})
              }
            />
            {live
              ? "Bật chính sách cấp hạn mức AI cho mọi tài khoản (mặc định tắt)"
              : "Mô phỏng quản lý đã duyệt cơ chế hạn mức (mặc định tắt)"}
          </label>
          <Field label="Mẫu để xét cấp">
            <select
              value={candidate}
              onChange={(e) => setCandidate(e.target.value)}
            >
              <option value="">Chọn mẫu</option>
              {state.contributions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.raw.text} · {c.owner} ·{" "}
                  {eligible(state, c) ? "Đủ Kiểm tra chất lượng" : "Chưa đủ Kiểm tra chất lượng"}
                </option>
              ))}
            </select>
          </Field>
          <Action
            disabled={!candidate}
            onClick={() => {
              const c = state.contributions.find((c) => c.id === candidate)!;
              return run({
                type: "grant",
                owner: c.owner,
                contributionId: c.id,
              });
            }}
          >
            Xét điều kiện & cấp 5 lượt minh họa
          </Action>
          <p>
            Quản lý xác nhận tài khoản và rủi ro tại Vùng / nguồn / người. Mọi
            lần từ chối có thông báo điều kiện.
          </p>
          <ResponsiveTable>
            <table>
              <thead>
                <tr>
                  <th>Tài khoản</th>
                  <th>Cấp / dùng</th>
                  <th>Hết hạn</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {state.credits.map((c) => (
                  <tr key={c.id}>
                    <td>{c.owner}</td>
                    <td>
                      {c.amount} / {c.used}
                    </td>
                    <td>{c.expiresAt}</td>
                    <td>
                      <Action
                        disabled={c.revoked}
                        onClick={() => run({ type: "revoke", id: c.id })}
                      >
                        Thu hồi
                      </Action>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveTable>
        </Panel>
      )}
      <Panel title="Lịch sử hạn mức của tôi">
        {credits.map((c) => (
          <p key={c.id}>
            {c.at} · +{c.amount} · đã dùng {c.used} ·{" "}
            {c.revoked
              ? "Đã thu hồi"
              : c.expiresAt < now
                ? "Đã hết hạn"
                : "Theo điều kiện mẫu hiện tại"}
          </p>
        ))}
        {!credits.length && (
          <p>
            Chưa có hạn mức được cấp. Tạo nhiều tài khoản hoặc chơi nhiều lượt
            không tự tạo lượt sử dụng.
          </p>
        )}
      </Panel>
      <Panel title="Yêu cầu rà soát / khiếu nại">
        <Field label="Lý do">
          <textarea
            value={appeal}
            onChange={(e) => setAppeal(e.target.value)}
          />
        </Field>
        <Action
          disabled={!appeal.trim()}
          onClick={async () => {
            await run({ type: "appeal", text: appeal });
            setAppeal("");
          }}
        >
          Gửi yêu cầu cho điều phối
        </Action>
      </Panel>
    </>
  );
}
