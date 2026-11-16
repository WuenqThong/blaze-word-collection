import { ResponsiveTable } from "../../components/ResponsiveTable";
import { apiClient, errorMessage } from "../../api/client";
import { displayLabel, systemText } from "../../lib/display";
import { DataCardView } from "../../components/DataCardView";
import { useEffect, useState } from "react";
import Papa from "papaparse";
import { useDemo } from "./context";
import { blankRaw } from "./seed";
import {
  eligible,
  exclusionReasons,
  sha256,
  splitRecords,
  uid,
  duplicates,
} from "./domain";
import { Action, DemoGuard, Field, Heading, Panel } from "./ui";
import { repository } from "./repository";
import { download } from "./files";
import type { Raw } from "./types";
import { downloadRelease } from "./server";
import { PilotOperations } from "./PilotOperations";

export function ImportDemo() {
  return (
    <DemoGuard>
      <ImportInner />
    </DemoGuard>
  );
}
function ImportInner() {
  const { state, run } = useDemo();
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({
    text: "text",
    meaning: "meaning",
    standard: "standard",
    context: "context",
    evidence: "evidence",
    region: "region",
    topic: "topic",
  });
  const [error, setError] = useState("");
  const [batch, setBatch] = useState(uid);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [train, setTrain] = useState(false);
  const [publicConsent, setPublicConsent] = useState(false);
  const cols = [...new Set(rows.flatMap(Object.keys))];
  const preview = rows.map((row, i) => {
    const raw = { ...blankRaw(), method: "import" };
    for (const k of Object.keys(mapping))
      if (k in raw && mapping[k])
        Object.assign(raw, { [k]: row[mapping[k]] ?? "" });
    const errors = [
      "text",
      "meaning",
      "standard",
      "context",
      "evidence",
    ].filter((k) => !String(raw[k as keyof Raw]).trim());
    return {
      id: `${batch}:${i}`,
      raw,
      errors,
      duplicate: duplicates(state, raw).length,
    };
  });
  async function read(file: File) {
    try {
      if (file.size > 5 * 1024 * 1024)
        throw Error("Tệp import minh họa tối đa 5 MB.");
      const text = await file.text();
      let parsed: Record<string, string>[];
      if (file.name.endsWith(".jsonl")) {
        parsed = text
          .split(/\r?\n/)
          .filter((v) => v.trim())
          .map((line, i) => {
            let v: unknown;
            try {
              v = JSON.parse(line);
            } catch {
              throw Error(`JSONL lỗi cú pháp tại dòng ${i + 1}.`);
            }
            if (!v || typeof v !== "object" || Array.isArray(v))
              throw Error(`Dòng ${i + 1} phải là object.`);
            return Object.fromEntries(
              Object.entries(v).map(([k, x]) => [k, String(x ?? "")]),
            );
          });
      } else {
        const result = Papa.parse<Record<string, string>>(text, {
          header: true,
          skipEmptyLines: "greedy",
          delimiter: file.name.endsWith(".tsv") ? "\t" : "",
        });
        if (result.errors.length)
          throw Error(
            result.errors
              .map((e) => `Dòng ${e.row ?? "?"}: ${systemText(e.message)}`)
              .join(" / "),
          );
        parsed = result.data;
      }
      if (parsed.length > 1000)
        throw Error("Bản duyệt giới hạn 1000 dòng một lượt.");
      setRows(parsed);
      setBatch(uid());
      setProgress(0);
      setError("");
    } catch (e) {
      setError(errorMessage(e));
      setRows([]);
    }
  }
  return (
    <>
      <Heading title="Nhập ứng viên: đọc, đối chiếu, rồi tiếp nhận">
        <p>
          CSV / TSV / JSONL được xử lý trong trình duyệt; không tải lên nguồn
          bên ngoài. Mọi dòng nhập đều bắt đầu Bản gốc.
        </p>
      </Heading>
      <Panel title="01 / Chọn tệp & ghép cột">
        <Field label="Tệp CSV/TSV/JSONL">
          <input
            type="file"
            accept=".csv,.tsv,.jsonl"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void read(f);
              e.target.value = "";
            }}
          />
        </Field>
        <Action
          onClick={() =>
            download(
              "demo-import-template.csv",
              Papa.unparse([
                {
                  text: "Nội dung minh họa",
                  meaning: "Nghĩa minh họa",
                  standard: "Bản phổ thông minh họa",
                  context: "Ngữ cảnh tự soạn",
                  evidence: "Nguồn minh họa chưa xác minh",
                  region: "Quảng Nam",
                  topic: "Sinh hoạt",
                },
              ]),
            )
          }
        >
          Tải mẫu CSV
        </Action>
        <div className="demo-form-grid">
          {Object.entries(mapping).map(([k, v]) => (
            <Field key={k} label={`Cột ${displayLabel(k)}`}>
              <select
                value={v}
                onChange={(e) =>
                  setMapping({ ...mapping, [k]: e.target.value })
                }
              >
                <option value="">Không sử dụng cột này</option>
                {[...new Set([v, ...cols])].filter(Boolean).map((c) => (
                  <option key={c} value={c}>{displayLabel(c, c)}</option>
                ))}
              </select>
            </Field>
          ))}
        </div>
        <label className="demo-checkbox">
          <input
            type="checkbox"
            checked={train}
            onChange={(e) => setTrain(e.target.checked)}
          />
          Có căn cứ đồng ý huấn luyện của lô Minh họa
        </label>
        <label className="demo-checkbox">
          <input
            type="checkbox"
            checked={publicConsent}
            onChange={(e) => setPublicConsent(e.target.checked)}
          />
          Có căn cứ đồng ý công khai của lô Minh họa
        </label>
        <p>Sau khi nhập, cần rà soát quyền nguồn.</p>
      </Panel>
      <Panel title="02 / Xem trước lỗi và trùng">
        {error && (
          <p role="alert" className="demo-error">
            {error}
          </p>
        )}
        <p>
          {preview.length} dòng ·{" "}
          {preview.filter((r) => !r.errors.length).length} dòng hợp lệ ·{" "}
          {preview.filter((r) => r.duplicate).length} dòng trùng.
        </p>
        <ResponsiveTable>
          <table>
            <thead>
              <tr>
                <th>Dòng</th>
                <th>Nội dung</th>
                <th>Lỗi / trùng</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((r, i) => (
                <tr key={r.id}>
                  <td>{i + 1}</td>
                  <td>{r.raw.text}</td>
                  <td>
                    {r.errors.length
                      ? `Thiếu ${r.errors.map(key => displayLabel(key)).join(", ")}`
                      : r.duplicate
                        ? "Trùng: giữ Bản gốc để đối chiếu"
                        : "Hợp lệ"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResponsiveTable>
        <p role="status">
          Tiến độ nhập: {progress}/
          {preview.filter((r) => !r.errors.length).length}. Thử lại giữ ID lô dữ liệu
          để không nhân đôi.
        </p>
        <Action
          disabled={busy || !preview.some((r) => !r.errors.length)}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              let n = 0;
              for (const r of preview.filter((r) => !r.errors.length)) {
                await run({
                  type: "contribute",
                  id: r.id,
                  raw: r.raw,
                  consent: {
                    collect: true,
                    train,
                    public: publicConsent,
                    audio: false,
                    version: "demo-import-v1",
                  },
                  parent: null,
                });
                n++;
                setProgress(n);
              }
              const job = {
                id: batch,
                type: "import" as const,
                model: "CSV/TSV/JSONL",
                status: "completed" as const,
                progress: 100,
                log: [
                  `Nhập ${n} dòng hợp lệ thành Bản gốc`,
                  `${preview.filter((r) => r.errors.length).length} dòng lỗi giữ trong xem trước`,
                ],
                at: new Date().toISOString(),
              };
              await run({ type: "job", job });
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Xác nhận nhập dòng hợp lệ / thử lại
        </Action>
      </Panel>
    </>
  );
}

export function DatasetDemo() {
  return (
    <DemoGuard>
      <DatasetInner />
    </DemoGuard>
  );
}
function DatasetInner() {
  const { state, run, live } = useDemo();
  const [card, setCard] = useState(
    live
      ? "Ứng viên dữ liệu huấn luyện phương ngữ Quảng Nam – Đà Nẵng: mẫu đã được duyệt, đã chuẩn hóa, có đồng ý huấn luyện và nguồn đã xác nhận quyền. Chưa đánh giá đánh giá đối chiếu; không công khai nếu mẫu chưa có đồng ý công khai."
      : "Bộ dữ liệu Minh họa để quản lý duyệt giao diện. Không dùng huấn luyện, đánh giá đối chiếu hoặc công khai như dữ liệu thật.",
  );
  const [error, setError] = useState("");
  const selected = state.contributions.filter((c) => eligible(state, c));
  const records = live ? [] : splitRecords(selected);
  const [previewResult, setPreviewResult] = useState<{ contributions: typeof state.contributions; offset: number; data: {
    splits?: Record<string, string>; warnings?: string[]; data_card?: string;
    ids: number[]; eligible_count: number; total: number; excluded_count: number; preview_digest: string;
    items: { id: number; text: string; region: string; eligible: boolean; reasons: string[] }[];
  } } | null>(null);
  const [offset, setOffset] = useState(0);
  const [creating, setCreating] = useState(false);
  const serverPreview = previewResult?.contributions === state.contributions && previewResult.offset === offset ? previewResult.data : null;
  useEffect(() => {
    if (!live) return;
    let active = true;
    apiClient.get("/dialect/releases/preview", { params: { offset } }).then(({ data }) => {
      if (active) { setPreviewResult({ data, contributions: state.contributions, offset }); setError(""); }
    }).catch((e: unknown) => { if (active) setError(errorMessage(e)); });
    return () => { active = false; };
  }, [live, state.contributions, offset]);
  return (
    <>
      <Heading title="Bộ dữ liệu">
        <p>
          Chỉ xuất mẫu đã duyệt và đủ quyền.
        </p>
      </Heading>
      <Panel title="Mẫu">
        <p>
          {live ? serverPreview ? `${serverPreview.eligible_count}/${serverPreview.total} mẫu sẵn sàng.` : "Đang kiểm tra điều kiện trên máy chủ…" : `${selected.length} đủ điều kiện / ${state.contributions.length} bản gốc.`}
        </p>
        <ResponsiveTable>
          <table>
            <thead>
              <tr>
                <th>Mẫu</th>
                <th>Điều kiện</th>
                <th>Nhóm dữ liệu</th>
              </tr>
            </thead>
            <tbody>
              {live ? serverPreview?.items.map(c => <tr key={c.id}><td>{c.text}</td><td>{c.eligible ? "Sẵn sàng" : <details><summary>{c.reasons.some(reason => reason.startsWith("Trùng")) ? "Trùng" : "Cần xử lý"}</summary><ul>{c.reasons.map(reason => <li key={reason}>{systemText(reason)}</li>)}</ul></details>}</td><td>{displayLabel(serverPreview.splits?.[String(c.id)], "Không xuất")}</td></tr>) : state.contributions.map((c) => (
                <tr key={c.id}>
                  <td>{c.raw.text || displayLabel(c.raw.response)}</td>
                  <td>
                    {eligible(state, c)
                      ? live ? "Đủ Kiểm tra chất lượng và quyền" : "Đủ Kiểm tra chất lượng/quyền minh họa"
                      : exclusionReasons(state, c).join(" · ")}
                  </td>
                  <td>
                    {displayLabel(live
                      ? serverPreview?.splits?.[c.id.replace(/^c:/, "")] ?? "Máy chủ xác định khi tạo bản xuất"
                      : records.find((r) => r.id === c.id)?.split ?? "Không xuất")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResponsiveTable>
        {live && serverPreview && serverPreview.total > 25 && <div className="demo-actions"><Action disabled={offset === 0} onClick={() => setOffset(n => Math.max(0, n - 25))}>Trang trước</Action><span>Trang {Math.floor(offset / 25) + 1} / {Math.ceil(serverPreview.total / 25)}</span><Action disabled={offset + 25 >= serverPreview.total} onClick={() => setOffset(n => n + 25)}>Trang sau</Action></div>}
        {live ? (
          <details>
            <summary>Chi tiết bộ dữ liệu</summary>
            <DataCardView value={serverPreview?.data_card ?? ""} />
          </details>
        ) : (
          <Field label="Mô tả bộ dữ liệu">
            <textarea
              rows={4}
              value={card}
              onChange={(e) => setCard(e.target.value)}
            />
          </Field>
        )}
        {error && (
          <p role="alert" className="demo-error">
            {error}
          </p>
        )}
        <Action
          disabled={creating || (live ? !serverPreview?.ids.length : !selected.length || !card.trim())}
          onClick={async () => {
            setCreating(true);
            try {
              const checksum = await sha256(records);
              await run({
                type: "release",
                release: {
                  id: uid(),
                  ids: live ? serverPreview!.ids.map(id => `c:${id}`) : selected.map((c) => c.id),
                  ...(live ? { previewDigest: serverPreview!.preview_digest } : {}),
                  records,
                  checksum,
                  dataCard: live ? serverPreview?.data_card ?? "" : card,
                  at: new Date().toISOString(),
                },
              });
              setError("");
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setCreating(false);
            }
          }}
        >
          {creating ? "Đang tạo bản xuất…" : live ? "Tạo phiên bản" : "Tạo bản xuất Minh họa có bảng kê dữ liệu"}
        </Action>
      </Panel>
      <Panel title="Phiên bản">
        {state.releases.map((r) => {
          const affected = r.ids.filter((id) => {
            const c = state.contributions.find((c) => c.id === id);
            return !c || !eligible(state, c);
          });
          return (
            <div className="demo-contribution" key={r.id}>
              <h3>
                {r.id} · {r.records.length} mẫu
              </h3>
              <p>{r.at}</p>
              <p>Nhóm dữ liệu {live ? "từ máy chủ" : "minh họa"}: {(["train", "dev", "test"] as const).map((split) => `${displayLabel(split)}: ${r.records.filter((record) => record.split === split).length}`).join(" · ")}</p>
              <details><summary>Thông tin bộ dữ liệu và phạm vi sử dụng</summary><DataCardView value={r.dataCard} /></details>
              <p className="demo-checksum">Mã kiểm tra tính toàn vẹn: {r.checksum}</p>
              <p>
                {affected.length
                  ? `Chặn tải: ${affected.length} mẫu mất điều kiện`
                  : "Có thể tải tại thời điểm kiểm tra"}
              </p>
              <Action
                disabled={!!affected.length}
                onClick={async () => {
                  if (live && r.id.startsWith("r:")) {
                    try {
                      download(`dataset-${r.id.slice(2)}.json`, await downloadRelease(r.id));
                      setError("");
                    } catch (e) { setError(errorMessage(e)); }
                    return;
                  }
                  const checksum = await sha256(r.records);
                  if (checksum !== r.checksum)
                    throw Error("Checksum không khớp.");
                  download(`DEMO-dataset-${r.id}.json`, {
                    manifest: {
                      version: r.id,
                      schema: "demo-curated-v1",
                      policy: "demo-2-votes-v1",
                      scope: "DEMO_ONLY",
                      count: r.records.length,
                      sha256: r.checksum,
                      createdAt: r.at,
                      splitPolicy:
                        "connected-participant-source-family-hash-80-10-10",
                    },
                    dataCard: r.dataCard,
                    records: r.records,
                  });
                }}
              >
                Tải JSON
              </Action>
            </div>
          );
        })}
      </Panel>
    </>
  );
}

export function OperationsDemo() {
  return (
    <DemoGuard>
      <OperationsInner />
    </DemoGuard>
  );
}
function OperationsInner() {
  const { state, run, live } = useDemo();
  const [error, setError] = useState("");
  const [restore, setRestore] = useState<File | null>(null);
  if (live) return <PilotOperations />;
  return (
    <>
      <Heading title="Vận hành Minh họa và truy nguyên">
        <p>
          Kho riêng trên trình duyệt. Sao lưu này không phải sao lưu máy chủ; không
          mô phỏng bảo vệ thật bằng lời khẳng định.
        </p>
      </Heading>
      {!!state.catalogBackups?.length && <Panel title="Cấu hình cũ được giữ trên thiết bị"><p>Khi chuyển sang cấu hình máy chủ, bản bộ đề, câu hỏi và chiến dịch cũ được giữ lại để đối chiếu. Bản này chưa tự ghi đè cấu hình máy chủ.</p>{state.catalogBackups.map((backup, i) => <div key={i}><p>{new Date(backup.at).toLocaleString("vi-VN")} · {backup.exams.length} bộ đề · {backup.questions.length} câu hỏi</p><Action onClick={() => download(`cau-hinh-cu-${i + 1}.json`, backup)}>Tải bản cấu hình cũ</Action></div>)}</Panel>}
      <Panel title="Sao lưu / khôi phục">
        <p>Lần tạo sao lưu: {state.backupAt ?? "Chưa có"}</p>
        <Action
          onClick={async () => {
            await run({ type: "backup" });
            download(
              "APPDICHTHUAT-demo-backup.json",
              await repository().backup(),
            );
          }}
        >
          Tạo và tải sao lưu (kèm media)
        </Action>
        <Field label="Bản sao lưu Minh họa để nhập lại">
          <input
            type="file"
            accept=".json"
            onChange={(e) => setRestore(e.target.files?.[0] ?? null)}
          />
        </Field>
        <label className="demo-checkbox">
          <input type="checkbox" checked={!!restore} disabled />
          Tệp đã chọn: {restore?.name ?? "Chưa chọn"}
        </label>
        <p className="demo-note">
          Nhập thay thế toàn bộ kho Minh họa hiện tại. Xuất sao lưu trước nếu muốn
          giữ bản cũ.
        </p>
        <Action
          disabled={!restore}
          onClick={async () => {
            try {
              if (restore!.size > 100 * 1024 * 1024)
                throw Error("Sao lưu minh họa tối đa 100 MB.");
              await repository().restore(JSON.parse(await restore!.text()));
              setRestore(null);
              setError("");
            } catch (e) {
              setError(errorMessage(e));
            }
          }}
        >
          Xác nhận thay kho Minh họa bằng sao lưu
        </Action>
        {error && (
          <p className="demo-error" role="alert">
            {error}
          </p>
        )}
      </Panel>
      <Panel title="Nhật ký tác vụ & thử lại">
        {state.jobs.map((j) => (
          <div className="demo-list-row" key={j.id}>
            <div>
              <strong>
                {displayLabel(j.type)} · {displayLabel(j.status)}
              </strong>
              <p>{j.log.map(line => systemText(line)).join(" / ")}</p>
            </div>
            {j.status === "failed" && (
              <Action
                onClick={() =>
                  run({
                    type: "job",
                    job: {
                      ...j,
                      status: "queued",
                      progress: 0,
                      log: [...j.log, "Thử lại theo kịch bản minh họa"],
                    },
                  })
                }
              >
                Thử lại tác vụ
              </Action>
            )}
          </div>
        ))}
      </Panel>
      <Panel title="Nhật ký thay đổi">
        <ResponsiveTable>
          <table>
            <thead>
              <tr>
                <th>Thời điểm</th>
                <th>Tác nhân / hành động</th>
                <th>Thực thể / nội dung</th>
              </tr>
            </thead>
            <tbody>
              {[...state.events].reverse().map((e) => (
                <tr key={e.id}>
                  <td>{e.at}</td>
                  <td>
                    {e.actor}
                    <br />
                    {displayLabel(e.action, "Cập nhật dữ liệu")}
                  </td>
                  <td>
                    {e.entity}
                    <details>
                      <summary>Chi tiết</summary>
                      <p>{systemText(e.note, "Đã ghi nhận thay đổi dữ liệu.")}</p>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResponsiveTable>
      </Panel>
    </>
  );
}
