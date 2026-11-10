import { useState } from "react";
import { Link } from "react-router-dom";
import { useDemo } from "./context";
import { searchKey, uid, publiclyVisible } from "./domain";
import { Action, Field, Heading, Panel } from "./ui";
import { MediaPreview } from "./ContributionDemo";

export function DictionaryDemo() {
  const { state, run } = useDemo();
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("");
  const [topic, setTopic] = useState("");
  const [selected, setSelected] = useState("");
  const [feedback, setFeedback] = useState("");
  const words = state.contributions.filter((c) => publiclyVisible(state, c));
  const key = searchKey(query);
  const fuzzy = (text: string) => {
    const value = searchKey(text);
    if (value.includes(key)) return true;
    let pos = 0;
    for (const c of value) {
      if (c === key[pos]) pos++;
    }
    return pos === key.length;
  };
  const filtered = words.filter(
    (c) =>
      (!region || c.raw.region === region) &&
      (!topic || c.raw.topic === topic) &&
      fuzzy(`${c.curated!.text} ${c.curated!.meaning} ${c.curated!.variants}`),
  );
  const item = filtered.find((c) => c.id === selected);
  return (
    <>
      <Heading title="Từ điển đã duyệt trong DEMO">
        <p>
          Tra không dấu hoặc gần đúng. Chỉ hiển thị bản chuẩn hóa đủ quyền công
          khai; đây không phải từ điển ngôn ngữ đã phát hành thật.
        </p>
      </Heading>
      <Panel>
        <div className="demo-filters">
          <Field label="Tìm từ / nghĩa">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Có dấu hoặc không dấu…"
            />
          </Field>
          <Field label="Vùng">
            <select value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="">Tất cả</option>
              {state.regions.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="Chủ đề">
            <select value={topic} onChange={(e) => setTopic(e.target.value)}>
              <option value="">Tất cả</option>
              {state.topics.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
        </div>
        {filtered.map((c) => (
          <button
            className="demo-queue-button"
            key={c.id}
            onClick={() => setSelected(c.id)}
          >
            <strong>{c.curated!.text}</strong>
            <span>
              {c.curated!.meaning} · {c.raw.region}
            </span>
          </button>
        ))}
        {!filtered.length && (
          <p>
            Chưa có mục đủ quyền phù hợp. Có thể góp từ mới hoặc báo thiếu
            nghĩa.
          </p>
        )}
      </Panel>
      {item && (
        <Panel title={item.curated!.text}>
          <p>{item.curated!.meaning}</p>
          <p>Phổ thông: {item.curated!.standard}</p>
          <p>Ngữ cảnh: {item.curated!.context}</p>
          <p>
            Biến thể: {item.curated!.variants || "Chưa bổ sung"} · ID nghĩa{" "}
            {item.senseId}
          </p>
          {item.raw.mediaIds
            .filter(
              (id) =>
                state.media.find((m) => m.id === id)?.kind === "audio" &&
                item.consent.audio &&
                item.qaAudio === "pass" &&
                state.sources.find((s) => s.id === item.sourceId)?.audio,
            )
            .map((id) => (
              <MediaPreview key={id} id={id} />
            ))}
          {!item.raw.mediaIds.length && (
            <p className="demo-note">
              Chưa có bản thu minh họa. Người góp có thể bổ sung audio có quyền.
            </p>
          )}
          <Link to={`/demo/contribute?kind=${item.raw.kind}`}>
            Góp biến thể / cách dùng khác
          </Link>
        </Panel>
      )}
      <Panel title="Báo sai / thiếu nghĩa">
        <Field label="Phản hồi">
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Nêu từ/câu, vùng và phần cần sửa…"
          />
        </Field>
        <Action
          disabled={!feedback.trim()}
          onClick={async () => {
            await run({
              type: "feedback",
              entity: selected || `dictionary:${query}`,
              text: feedback,
            });
            setFeedback("");
          }}
        >
          Gửi vào hàng chờ reviewer
        </Action>
      </Panel>
    </>
  );
}

export function CommunityDemo() {
  const { state, run } = useDemo();
  const [region, setRegion] = useState(state.regions[0]);
  const [mode, setMode] = useState("So sánh cách gọi địa bàn");
  const [word, setWord] = useState("");
  const [text, setText] = useState("");
  const actor = state.people.find((p) => p.id === state.actor)!;
  const methods = [
    "So sánh cách gọi địa bàn",
    "Thử thách nói lại câu",
    "Phiên chợ đổi nghĩa",
    "Khác thế hệ",
    "Khoảng trống dữ liệu",
  ];
  const items = state.contributions.filter((c) => publiclyVisible(state, c));
  return (
    <>
      <Heading title="Một cách gọi, nhiều vùng sử dụng">
        <p>
          Sơ đồ vùng từ dữ liệu DEMO; không phải bản đồ ranh giới địa lý. Không
          suy vùng của người dùng từ IP hoặc giọng nói.
        </p>
      </Heading>
      <Panel title="Bản đồ biến thể · sơ đồ theo vùng">
        <div className="demo-region-map">
          {state.regions.map((v) => (
            <button
              key={v}
              className={region === v ? "is-selected" : ""}
              aria-pressed={region === v}
              onClick={() => setRegion(v)}
            >
              <i className="bi bi-geo-alt" aria-hidden="true" />
              <strong>{v}</strong>
              <span>
                {items.filter((c) => c.raw.region === v).length} mục công khai
                demo
              </span>
            </button>
          ))}
        </div>
        <Field label="Cách gọi / nghĩa để so sánh">
          <input value={word} onChange={(e) => setWord(e.target.value)} />
        </Field>
        <div className="demo-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Vùng</th>
                <th>Cách gọi</th>
                <th>Nghĩa / biến thể</th>
              </tr>
            </thead>
            <tbody>
              {items
                .filter(
                  (c) =>
                    (!word ||
                      searchKey(
                        `${c.curated!.text} ${c.curated!.meaning}`,
                      ).includes(searchKey(word))) &&
                    (!region || c.raw.region === region),
                )
                .map((c) => (
                  <tr key={c.id}>
                    <td>{c.raw.region}</td>
                    <td>{c.curated!.text}</td>
                    <td>
                      {c.curated!.meaning} · {c.curated!.variants}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <Action onClick={() => setRegion("")}>So sánh tất cả vùng</Action>
      </Panel>
      <Panel title="Thử thách & phiên chợ đổi nghĩa">
        <Field label="Cơ chế cộng đồng">
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            {methods.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </Field>
        <Field label="Nội dung / đề xuất khoảng trống">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ghi một câu để người khác nói lại, nghĩa muốn trao đổi hoặc chủ đề còn thiếu…"
          />
        </Field>
        <Action
          disabled={!text.trim()}
          onClick={async () => {
            await run({
              type: "feedback",
              entity: `community:${mode}`,
              text: `${region || "Mọi vùng"}: ${text}`,
            });
            setText("");
          }}
        >
          Gửi đề xuất cho điều phối
        </Action>
        {actor.role === "admin" && (
          <Action
            disabled={!text.trim()}
            onClick={() =>
              run({
                type: "task",
                task: {
                  id: uid(),
                  title: mode,
                  method: mode,
                  prompt: text,
                  region: region || state.regions[0],
                  topic: state.topics[0],
                  mediaId: null,
                  active: true,
                },
              })
            }
          >
            Tạo nhiệm vụ từ khoảng trống (admin)
          </Action>
        )}
        <p className="demo-note">
          Câu nói lại/biến thể vẫn đi qua form nguồn, consent và RAW. Không ghi
          đè ý kiến khác vùng.
        </p>
        <Link className="btn btn-primary" to="/demo/contribute?kind=sentence">
          Góp câu / thu âm nói lại
        </Link>
      </Panel>
      <Panel title="Đề xuất cộng đồng đã gửi">
        {state.feedback
          .filter((f) => f.entity.startsWith("community:"))
          .map((f) => (
            <p key={f.id}>
              {f.entity} · {f.text} · {f.state}
            </p>
          ))}
      </Panel>
    </>
  );
}
