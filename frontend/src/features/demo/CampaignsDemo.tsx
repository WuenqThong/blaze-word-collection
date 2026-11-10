import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Link } from "react-router-dom";
import { useDemo } from "./context";
import { uid } from "./domain";
import { Action, Field, Heading, Panel } from "./ui";
import type { Campaign } from "./types";
function CampaignQR({ url }: { url: string }) {
  const [qr, setQR] = useState("");
  useEffect(() => {
    let current = true;
    QRCode.toDataURL(url, { width: 200, margin: 2 }).then((value) => {
      if (current) setQR(value);
    });
    return () => {
      current = false;
    };
  }, [url]);
  return qr ? (
    <img
      className="demo-qr"
      src={qr}
      width={200}
      height={200}
      alt={`QR mở chiến dịch ${url}`}
    />
  ) : (
    <p>Đang tạo QR…</p>
  );
}
export function CampaignsDemo() {
  const { state, run } = useDemo();
  const actor = state.people.find((p) => p.id === state.actor)!;
  const [editing, setEditing] = useState<Campaign | null>(null);
  const fresh = (): Campaign => ({
    id: uid(),
    title: "",
    region: state.regions[0],
    topic: state.topics[0],
    examIds: [],
    active: true,
    mode: "standard",
  });
  return (
    <>
      <Heading title="Chiến dịch và thử thách 10 câu">
        <p>
          Link/QR riêng, nhiều đề theo vùng/chủ đề. Link localhost chỉ mở được
          trên máy đang chạy frontend.
        </p>
      </Heading>
      {actor.role === "admin" && (
        <Action onClick={() => setEditing(fresh())}>
          Tạo chiến dịch / thử thách
        </Action>
      )}
      {editing && (
        <Panel title="Cấu hình chiến dịch">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await run({ type: "campaign", campaign: editing });
                setEditing(null);
              } catch {
                /* Provider displays failures. */
              }
            }}
          >
            <Field label="Tên chiến dịch">
              <input
                value={editing.title}
                required
                onChange={(e) =>
                  setEditing({ ...editing, title: e.target.value })
                }
              />
            </Field>
            <div className="demo-form-grid">
              <Field label="Vùng">
                <select
                  value={editing.region}
                  onChange={(e) =>
                    setEditing({ ...editing, region: e.target.value })
                  }
                >
                  {state.regions.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
              <Field label="Chủ đề">
                <select
                  value={editing.topic}
                  onChange={(e) =>
                    setEditing({ ...editing, topic: e.target.value })
                  }
                >
                  {state.topics.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
              <Field label="Loại thử thách">
                <select
                  value={editing.mode}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      mode: e.target.value as Campaign["mode"],
                    })
                  }
                >
                  <option value="standard">Theo chủ đề</option>
                  <option value="adaptive">Thích ứng chất lượng</option>
                  <option value="cross_region">Khác vùng</option>
                  <option value="generation">Khác thế hệ</option>
                </select>
              </Field>
            </div>
            <fieldset>
              <legend>Phân phối các bộ đề</legend>
              {state.exams
                .filter((e) => e.status === "active")
                .map((exam) => (
                  <label className="demo-checkbox" key={exam.id}>
                    <input
                      type="checkbox"
                      checked={editing.examIds.includes(exam.id)}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          examIds: e.target.checked
                            ? [...editing.examIds, exam.id]
                            : editing.examIds.filter((id) => id !== exam.id),
                        })
                      }
                    />
                    {exam.title} · {exam.region}
                  </label>
                ))}
            </fieldset>
            <label className="demo-checkbox">
              <input
                type="checkbox"
                checked={editing.active}
                onChange={(e) =>
                  setEditing({ ...editing, active: e.target.checked })
                }
              />
              Mở chiến dịch
            </label>
            <button className="btn btn-primary">Lưu chiến dịch</button>
          </form>
        </Panel>
      )}
      <div className="demo-card-grid">
        {state.campaigns
          .filter((c) => actor.role === "admin" || c.active)
          .map((c) => {
            const url = `${window.location.origin}/demo/play?campaign=${c.id}`;
            const sessions = state.sessions.filter(
              (s) => s.campaignId === c.id,
            );
            return (
              <Panel key={c.id} title={c.title}>
                <p>
                  {c.region} · {c.topic} · {c.mode}
                </p>
                <p>
                  {c.examIds.length} đề · {sessions.length} lượt bắt đầu ·{" "}
                  {sessions.filter((s) => s.state === "submitted").length} lượt
                  gửi.
                </p>
                <CampaignQR url={url} />
                <Field label="Link chiến dịch">
                  <input readOnly value={url} />
                </Field>
                <div className="demo-actions">
                  <Link
                    className="btn btn-primary"
                    to={`/demo/play?campaign=${c.id}`}
                  >
                    {c.active ? "Tham gia chiến dịch" : "Xem chiến dịch đã tắt"}
                  </Link>
                  {actor.role === "admin" && (
                    <Action onClick={() => setEditing(c)}>Sửa / bật tắt</Action>
                  )}
                </div>
                <small>
                  Ưu tiên bộ đề chưa chơi trong lịch sử của vai trò. Phiên đã
                  tạo giữ snapshot khi tắt chiến dịch.
                </small>
              </Panel>
            );
          })}
      </div>
    </>
  );
}
