import { errorMessage } from "../../api/client";
import { useState } from "react";
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
        throw Error("Tệp import demo tối đa 5 MB.");
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
              .map((e) => `Dòng ${e.row ?? "?"}: ${e.message}`)
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
          bên ngoài. Mọi dòng nhập đều bắt đầu RAW.
        </p>
      </Heading>
      <Panel title="01 / Chọn file & mapping">
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
                  evidence: "Nguồn demo chưa xác minh",
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
            <Field key={k} label={`Cột ${k}`}>
              <select
                value={v}
                onChange={(e) =>
                  setMapping({ ...mapping, [k]: e.target.value })
                }
              >
                <option value="">Không map</option>
                {[...new Set([v, ...cols])].filter(Boolean).map((c) => (
                  <option key={c}>{c}</option>
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
          Có căn cứ đồng ý training của lô DEMO
        </label>
        <label className="demo-checkbox">
          <input
            type="checkbox"
            checked={publicConsent}
            onChange={(e) => setPublicConsent(e.target.checked)}
          />
          Có căn cứ đồng ý công khai của lô DEMO
        </label>
        <p>Quyền nguồn vẫn phải rà soát riêng sau import.</p>
      </Panel>
      <Panel title="02 / Preview lỗi và trùng">
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
        <div className="demo-table-scroll">
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
                      ? `Thiếu ${r.errors.join(", ")}`
                      : r.duplicate
                        ? "Trùng: giữ RAW để đối chiếu"
                        : "Hợp lệ"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p role="status">
          Tiến độ nhập: {progress}/
          {preview.filter((r) => !r.errors.length).length}. Retry giữ ID batch
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
                  `Nhập ${n} dòng hợp lệ thành RAW`,
                  `${preview.filter((r) => r.errors.length).length} dòng lỗi giữ trong preview`,
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
      ? "Ứng viên dữ liệu huấn luyện phương ngữ Quảng Nam – Đà Nẵng: mẫu đã được duyệt, đã chuẩn hóa, có đồng ý huấn luyện và nguồn đã xác nhận quyền. Chưa đánh giá benchmark; không công khai nếu mẫu chưa có đồng ý công khai."
      : "Bộ dữ liệu DEMO để quản lý duyệt frontend. Không dùng huấn luyện, benchmark hoặc công khai như dữ liệu thật.",
  );
  const [error, setError] = useState("");
  const selected = state.contributions.filter((c) => eligible(state, c));
  const records = splitRecords(selected);
  return (
    <>
      <Heading title="Dataset có truy vết & kiểm điều kiện">
        <p>
          Chỉ xuất CURATED đủ QA, consent và nguồn. Chia theo nhóm liên thông
          người/nguồn/họ câu để giữ cùng nhóm trong một tập.
        </p>
      </Heading>
      <Panel title="Preview hiện tại">
        <p>
          {selected.length} đủ điều kiện / {state.contributions.length} bản gốc.
          Phạm vi xuất: {live ? "ứng viên huấn luyện đã duyệt (verified-training-candidates)" : "DEMO_ONLY"}.
        </p>
        <div className="demo-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Mẫu</th>
                <th>Điều kiện</th>
                <th>Split</th>
              </tr>
            </thead>
            <tbody>
              {state.contributions.map((c) => (
                <tr key={c.id}>
                  <td>{c.raw.text || c.raw.response}</td>
                  <td>
                    {eligible(state, c)
                      ? live ? "Đủ QA và quyền" : "Đủ QA/quyền demo"
                      : exclusionReasons(state, c).join(" · ")}
                  </td>
                  <td>
                    {records.find((r) => r.id === c.id)?.split ?? "Không xuất"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="demo-note">
          Tỷ lệ mục tiêu 80/10/10 theo hash nhóm. Lô nhỏ hoặc một nhóm lớn có
          thể có tập rỗng; không tách nhóm chỉ để đủ tỷ lệ.
        </p>
        <Field label="Data card">
          <textarea
            rows={4}
            value={card}
            onChange={(e) => setCard(e.target.value)}
          />
        </Field>
        {error && (
          <p role="alert" className="demo-error">
            {error}
          </p>
        )}
        <Action
          disabled={!selected.length || !card.trim()}
          onClick={async () => {
            try {
              const checksum = await sha256(records);
              await run({
                type: "release",
                release: {
                  id: uid(),
                  ids: selected.map((c) => c.id),
                  records,
                  checksum,
                  dataCard: card,
                  at: new Date().toISOString(),
                },
              });
              setError("");
            } catch (e) {
              setError(errorMessage(e));
            }
          }}
        >
          {live ? "Tạo bản xuất có manifest" : "Tạo bản xuất DEMO có manifest"}
        </Action>
      </Panel>
      <Panel title="Các phiên bản đã tạo">
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
              <p className="demo-checksum">SHA-256 records: {r.checksum}</p>
              <p>
                {affected.length
                  ? `Chặn tải: ${affected.length} mẫu mất điều kiện`
                  : "Có thể tải tại thời điểm kiểm tra"}
              </p>
              <Action
                disabled={!!affected.length}
                onClick={async () => {
                  if (live && r.id.startsWith("r:")) {
                    // The server re-checks eligibility and returns its own manifest.
                    download(`dataset-${r.id.slice(2)}.json`, await downloadRelease(r.id));
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
                Tải JSON + manifest + data card
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
  const { state, run } = useDemo();
  const [error, setError] = useState("");
  const [restore, setRestore] = useState<File | null>(null);
  return (
    <>
      <Heading title="Vận hành DEMO và truy nguyên">
        <p>
          Kho riêng trên trình duyệt. Backup này không phải backup server; không
          mô phỏng bảo vệ thật bằng lời khẳng định.
        </p>
      </Heading>
      <Panel title="Backup / khôi phục">
        <p>Lần tạo backup: {state.backupAt ?? "Chưa có"}</p>
        <Action
          onClick={async () => {
            await run({ type: "backup" });
            download(
              "APPDICHTHUAT-demo-backup.json",
              await repository().backup(),
            );
          }}
        >
          Tạo và tải backup (kèm media)
        </Action>
        <Field label="Bản backup DEMO để nhập lại">
          <input
            type="file"
            accept=".json"
            onChange={(e) => setRestore(e.target.files?.[0] ?? null)}
          />
        </Field>
        <label className="demo-checkbox">
          <input type="checkbox" checked={!!restore} disabled />
          File đã chọn: {restore?.name ?? "Chưa chọn"}
        </label>
        <p className="demo-note">
          Nhập thay thế toàn bộ kho DEMO hiện tại. Xuất backup trước nếu muốn
          giữ bản cũ.
        </p>
        <Action
          disabled={!restore}
          onClick={async () => {
            try {
              if (restore!.size > 100 * 1024 * 1024)
                throw Error("Backup demo tối đa 100 MB.");
              await repository().restore(JSON.parse(await restore!.text()));
              setRestore(null);
              setError("");
            } catch (e) {
              setError(errorMessage(e));
            }
          }}
        >
          Xác nhận thay kho DEMO bằng backup
        </Action>
        {error && (
          <p className="demo-error" role="alert">
            {error}
          </p>
        )}
      </Panel>
      <Panel title="Job log / thử lại">
        {state.jobs.map((j) => (
          <div className="demo-list-row" key={j.id}>
            <div>
              <strong>
                {j.type} · {j.status}
              </strong>
              <p>{j.log.join(" / ")}</p>
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
                      log: [...j.log, "Thử lại theo kịch bản demo"],
                    },
                  })
                }
              >
                Thử lại job
              </Action>
            )}
          </div>
        ))}
      </Panel>
      <Panel title="Audit">
        <div className="demo-table-scroll">
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
                    {e.action}
                  </td>
                  <td>
                    {e.entity}
                    <details>
                      <summary>Chi tiết</summary>
                      <pre>{e.note}</pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
