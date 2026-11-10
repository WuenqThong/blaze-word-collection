import { useState } from "react";
import { useDemo } from "./context";
import { normalize, uid } from "./domain";
import { blankRaw } from "./seed";
import { Action, Field, Heading, Panel } from "./ui";
import { download } from "./files";
import { BENCHMARK, simulateTranslation } from "./aiScenario";
export function AIDemo() {
  const { state, run } = useDemo();
  const actor = state.people.find((p) => p.id === state.actor)!;
  const [input, setInput] = useState("chi");
  const [modelId, setModelId] = useState(state.models[0]?.id ?? "");
  const [result, setResult] = useState("");
  const [feedback, setFeedback] = useState("");
  const [transcript, setTranscript] = useState("");
  const [mediaId, setMediaId] = useState("");
  const [note, setNote] = useState("");
  const [rules, setRules] = useState("");
  const [jobModel, setJobModel] = useState("");
  const model = state.models.find((m) => m.id === modelId) ?? state.models[0];
  function translate() {
    if (model) setResult(simulateTranslation(input, model));
  }
  return (
    <>
      <Heading title="AI & pipeline · mô phỏng có nhãn">
        <p>
          Chưa tích hợp nhà cung cấp, tải model hoặc huấn luyện. Kết quả bên
          dưới do bộ quy tắc demo và dữ liệu bạn nhập, không phải chất lượng AI
          thật.
        </p>
      </Heading>
      <div className="demo-two-col">
        <Panel title="Phương ngữ → tiếng Việt phổ thông">
          <Field label="Phiên bản kịch bản">
            <select
              value={model?.id ?? ""}
              onChange={(e) => setModelId(e.target.value)}
            >
              {state.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · v{m.version}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Văn bản để mô phỏng">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
          </Field>
          <div className="demo-actions">
            <Action disabled={!input.trim()} onClick={translate}>
              Chạy kịch bản demo (không gọi AI)
            </Action>
            <Action
              disabled={!input.trim() || actor.role === "guest"}
              onClick={async () => {
                await run({ type: "spend", owner: actor.id, amount: 1 });
                translate();
              }}
            >
              Mô phỏng sử dụng 1 lượt nội bộ
            </Action>
          </div>
          {result && (
            <div className="demo-result">
              <strong>Kết quả QUY TẮC DEMO</strong>
              <p>{result}</p>
              <small>Version {model?.id} · không tự VERIFIED.</small>
            </div>
          )}
          <Field label="Góp lỗi dịch / bản phổ thông bạn đề xuất">
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />
          </Field>
          <Action
            disabled={!feedback.trim()}
            onClick={async () => {
              await run({
                type: "feedback",
                entity: `translation:${model?.id}:${input}`,
                text: feedback,
              });
              setFeedback("");
            }}
          >
            Gửi lỗi vào hàng chờ
          </Action>
          <Action
            disabled={!result || !feedback.trim()}
            onClick={() =>
              run({
                type: "contribute",
                id: uid(),
                raw: {
                  ...blankRaw(),
                  kind: "sentence",
                  text: input,
                  meaning: feedback,
                  standard: feedback,
                  context: "Phản hồi từ màn hình dịch DEMO",
                  evidence: `Quy tắc demo ${model?.id}`,
                  method: "model-feedback",
                },
                consent: {
                  collect: true,
                  train: false,
                  public: false,
                  audio: false,
                  version: "demo-ai-feedback-v1",
                },
                parent: null,
              })
            }
          >
            Lưu bản sửa thành RAW chờ reviewer
          </Action>
        </Panel>
        <Panel title="ASR / gợi ý transcript và trùng">
          <p>
            Kịch bản minh họa: chọn audio và nhập transcript dự kiến; nút gợi ý
            chỉ chuẩn hóa văn bản này, không phân tích âm thanh.
          </p>
          <Field label="Audio có quyền trong demo">
            <select
              value={mediaId}
              onChange={(e) => {
                setMediaId(e.target.value);
                setTranscript(
                  state.media.find((m) => m.id === e.target.value)
                    ?.transcript ?? "",
                );
              }}
            >
              <option value="">Chọn audio / dùng văn bản minh họa</option>
              {state.media
                .filter((m) => m.kind === "audio")
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Transcript dự kiến để thử kịch bản">
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
            />
          </Field>
          <Action
            disabled={!transcript.trim()}
            onClick={() =>
              setTranscript(transcript.trim().replace(/\s+/g, " "))
            }
          >
            Gợi ý chuẩn hóa transcript · DEMO
          </Action>
          <p>
            Gợi ý trùng theo cách viết:{" "}
            {
              state.contributions.filter(
                (c) =>
                  normalize(c.raw.text) === normalize(transcript) &&
                  !c.withdrawn,
              ).length
            }{" "}
            mẫu. Không phải semantic search AI.
          </p>
          {mediaId && (
            <Action
              onClick={() => {
                const m = state.media.find((m) => m.id === mediaId)!;
                return run({ type: "media", media: { ...m, transcript } });
              }}
            >
              Lưu transcript để reviewer QA
            </Action>
          )}
          <Action
            disabled={!transcript.trim()}
            onClick={() =>
              run({
                type: "feedback",
                entity: `asr:${mediaId || "text-demo"}`,
                text: `Transcript gợi ý DEMO, cần reviewer: ${transcript}`,
              })
            }
          >
            Chuyển gợi ý cho reviewer
          </Action>
        </Panel>
      </div>
      <Panel title="Benchmark minh họa · trước/sau bổ sung">
        <p>
          Bốn ca tự soạn bên dưới chỉ kiểm thử kịch bản frontend. Không phải
          gold bank hoặc benchmark AI nghiên cứu.
        </p>
        <div className="demo-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Version</th>
                <th>Đúng / tổng</th>
                <th>Kết quả từng ca</th>
              </tr>
            </thead>
            <tbody>
              {state.models.map((m) => {
                const cases = BENCHMARK.map(([text, expected]) => ({
                  text,
                  expected,
                  predicted: simulateTranslation(text, m),
                }));
                return (
                  <tr key={m.id}>
                    <td>
                      {m.name} v{m.version}
                    </td>
                    <td>
                      {
                        cases.filter(
                          (c) =>
                            normalize(c.expected) === normalize(c.predicted),
                        ).length
                      }
                      /{cases.length}
                    </td>
                    <td>
                      {cases.map((c) => (
                        <p key={c.text}>
                          {c.text} → {c.predicted} · tham chiếu minh họa:{" "}
                          {c.expected}
                        </p>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Action
          onClick={() =>
            download(
              "DEMO-benchmark.json",
              state.models.map((m) => ({
                model: m.id,
                cases: BENCHMARK.map(([text, expected]) => ({
                  text,
                  expected,
                  predicted: simulateTranslation(text, m),
                })),
              })),
            )
          }
        >
          Tải kết quả đối chiếu demo
        </Action>
      </Panel>
      {actor.role === "admin" && (
        <>
          <Panel title="Đăng ký phiên bản mô phỏng">
            <Field label="Tên / mô tả phiên bản">
              <input value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <Field label="Quy tắc minh họa: mỗi dòng từ = bản phổ thông">
              <textarea
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                placeholder="chừ = bây giờ"
              />
            </Field>
            <Action
              disabled={!note.trim() || !rules.trim()}
              onClick={async () => {
                const entries = rules
                  .split("\n")
                  .map((line) => line.split("=").map((x) => x.trim()))
                  .filter(
                    (parts) => parts.length === 2 && parts.every(Boolean),
                  );
                if (!entries.length)
                  throw Error("Cần ít nhất một dòng từ = nghĩa.");
                await run({
                  type: "model",
                  model: {
                    id: uid(),
                    name: note,
                    version:
                      Math.max(0, ...state.models.map((m) => m.version)) + 1,
                    rules: Object.fromEntries(entries),
                    notes:
                      "Phiên bản QUY TẮC DEMO, không phải model huấn luyện.",
                    active: true,
                  },
                });
                setRules("");
                setNote("");
              }}
            >
              Lưu version mới
            </Action>
          </Panel>
          <Panel title="Pipeline training / evaluation · kịch bản trạng thái">
            <Field label="Tên cấu hình job">
              <input
                value={jobModel}
                onChange={(e) => setJobModel(e.target.value)}
                placeholder="DEMO thử nghiệm trước/sau"
              />
            </Field>
            <div className="demo-actions">
              {(["training", "evaluation"] as const).map((type) => (
                <Action
                  key={type}
                  disabled={!jobModel.trim()}
                  onClick={() =>
                    run({
                      type: "job",
                      job: {
                        id: uid(),
                        type,
                        model: jobModel,
                        status: "queued",
                        progress: 0,
                        log: ["Job DEMO: chưa gọi GPU/API hoặc train thật."],
                        at: new Date().toISOString(),
                      },
                    })
                  }
                >
                  Tạo job {type}
                </Action>
              ))}
            </div>
            {state.jobs
              .filter((j) => j.type !== "import")
              .map((j) => (
                <div className="demo-contribution" key={j.id}>
                  <h3>
                    {j.model} · {j.type} · {j.status}
                  </h3>
                  <progress
                    max={100}
                    value={j.progress}
                    aria-label={`Tiến độ job ${j.id}`}
                  />
                  <p>{j.log.join(" / ")}</p>
                  <div className="demo-actions">
                    <Action
                      disabled={j.status !== "queued"}
                      onClick={() =>
                        run({
                          type: "job",
                          job: {
                            ...j,
                            status: "running",
                            progress: 35,
                            log: [
                              ...j.log,
                              "Chuyển running theo thao tác demo.",
                            ],
                          },
                        })
                      }
                    >
                      Chạy kịch bản
                    </Action>
                    <Action
                      disabled={j.status !== "running"}
                      onClick={() =>
                        run({
                          type: "job",
                          job: {
                            ...j,
                            status: "completed",
                            progress: 100,
                            log: [
                              ...j.log,
                              "Hoàn tất kịch bản UI. Không tạo model thật.",
                            ],
                          },
                        })
                      }
                    >
                      Mô phỏng hoàn tất
                    </Action>
                    <Action
                      disabled={j.status !== "running"}
                      onClick={() =>
                        run({
                          type: "job",
                          job: {
                            ...j,
                            status: "failed",
                            progress: 35,
                            log: [
                              ...j.log,
                              "Lỗi dịch vụ mô phỏng; có thể thử lại.",
                            ],
                          },
                        })
                      }
                    >
                      Mô phỏng lỗi
                    </Action>
                    <Action
                      disabled={!["queued", "running"].includes(j.status)}
                      onClick={() =>
                        run({
                          type: "job",
                          job: {
                            ...j,
                            status: "cancelled",
                            log: [...j.log, "Đã hủy kịch bản."],
                          },
                        })
                      }
                    >
                      Hủy
                    </Action>
                    <Action
                      disabled={j.status !== "failed"}
                      onClick={() =>
                        run({
                          type: "job",
                          job: {
                            ...j,
                            status: "queued",
                            progress: 0,
                            log: [...j.log, "Thử lại job demo."],
                          },
                        })
                      }
                    >
                      Thử lại
                    </Action>
                  </div>
                </div>
              ))}
          </Panel>
        </>
      )}
    </>
  );
}
