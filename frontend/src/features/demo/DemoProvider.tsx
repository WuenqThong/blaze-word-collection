import { useEffect, useState, type ReactNode } from "react";
import { DemoContext } from "./context";
import { repository } from "./repository";
import type { Command, DemoState } from "./types";
import type { User } from "../../lib/types";
import { authApi } from "../../api/auth";
import { extractError } from "../../api/client";
import * as server from "./server";
import { gameAllocation, uid } from "./domain";

const OFFLINE = "Mô phỏng mất mạng: chưa lưu. Tắt lỗi rồi thử lại; dữ liệu đã lưu trước đó được giữ.";
const { SERVER_ENABLED } = server;

/**
 * Sends pending contributions, then replaces the server-owned collections with a
 * fresh snapshot. Contributions the server refuses for good are removed from the
 * outbox and kept as an audit event so the text is not silently lost.
 */
async function sync(account: User) {
  const repo = repository();
  const current = await repo.load();
  const { rejected, pending } = await server.flush(current, account.id);
  const snap = await server.snapshot();
  const dropped = new Map(rejected.map((r) => [r.id, extractError(r.error, "Máy chủ từ chối mẫu")]));
  const state = await repo.replace((s) => {
    const lost = s.contributions.filter((c) => dropped.has(c.id));
    const kept = { ...s, contributions: s.contributions.filter((c) => !dropped.has(c.id)) };
    kept.events = kept.events.concat(lost.map((c) => ({
      id: uid(), actor: c.owner, action: "SYNC_REJECTED", entity: c.id,
      note: `${dropped.get(c.id)} · ${JSON.stringify(c.raw)}`, at: new Date().toISOString(),
    })));
    return server.merge(kept, snap);
  });
  const warnings = [];
  if (rejected.length) warnings.push(`${rejected.length} mẫu không được máy chủ nhận: ${dropped.values().next().value}`);
  if (pending) warnings.push("Một số mẫu chưa gửi được lên máy chủ; hệ thống sẽ gửi lại ở lần đồng bộ sau.");
  return { state, warning: warnings.join(" ") || null };
}

export function DemoProvider({ children, account }: { children: ReactNode; account?: User | null }) {
  const [state, setState] = useState<DemoState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const live = SERVER_ENABLED && !!account;
  useEffect(() => {
    let current = true;
    let unsubscribe = () => {};
    Promise.resolve()
      .then(() => {
        if (!current) return null;
        const repo = repository(attempt > 0);
        unsubscribe = repo.subscribe((s) => {
          if (current) setState(s);
        });
        return repo.load().then((s) => account === undefined ? s : repo.bindAccount(account));
      })
      .then(async (s) => {
        if (current && s) setState(s);
        if (!current || !live || !account) return;
        try {
          const result = await sync(account);
          if (current && result.warning) setError(result.warning);
        } catch (e) {
          if (current) setError(`Chưa đồng bộ được với máy chủ: ${extractError(e)} Dữ liệu trên máy vẫn được giữ.`);
        }
      })
      .catch((e) => {
        if (current)
          setError(
            `Không mở được kho demo: ${String(e)}. Cho phép lưu dữ liệu trên trình duyệt rồi thử lại.`,
          );
      });
    return () => {
      current = false;
      unsubscribe();
    };
  }, [attempt, account, live]);
  async function run(input: Command) {
    let command = input;
    try {
      let result: DemoState;
      let warning: string | null = null;
      if (account !== undefined) {
        if (!account && command.type !== "simulate") throw Error("Vui lòng đăng nhập để tiếp tục.");
        if (command.type === "actor" && account?.role !== "admin") throw Error("Bạn không có quyền đổi vai trò.");
        if (account && ["start", "autoStart", "submit"].includes(command.type)) {
          const current = await authApi.me();
          if (current.id !== account.id) throw Error("Phiên đăng nhập đã thay đổi. Vui lòng tải lại trang.");
        }
      }
      if (command.type === "autoStart" && live && account && state && state.simulate !== "offline") {
        const local = gameAllocation(state, state.actor, command.campaignId);
        if (!local.pending && local.pool.length) {
          try {
            const picked = await server.allocate(command.id, local.pool.map((e) => e.id), local.played, command.campaignId);
            command = { ...command, examId: picked.exam_id };
          } catch {
            // Offline or older server: the local balance still starts a game.
          }
        }
      }
      const onServer = live && server.runsOnServer(command);
      if (onServer) {
        if (state?.simulate === "offline") throw Error(OFFLINE);
        await server.execute(command, state!, account!);
        ({ state: result, warning } = await sync(account!));
      } else {
        result = await repository().dispatch(command, account);
        if (live && server.SYNCED_LOCAL_COMMANDS.has(command.type)) {
          // Saved locally already; a failed upload is retried on the next sync.
          try {
            await server.afterLocal(command);
            ({ state: result, warning } = await sync(account));
          } catch (e) {
            warning = `Đã lưu trên máy nhưng chưa gửi được lên máy chủ: ${extractError(e)} Hệ thống sẽ gửi lại sau.`;
          }
        }
      }
      setState(result);
      setError(warning);
      return result;
    } catch (e) {
      const message = e instanceof Error && !("isAxiosError" in e) ? e.message : extractError(e);
      setError(message);
      throw e;
    }
  }
  if (!state)
    return (
      <div className="collection-empty" role="status">
        <h1>{error ? "Chưa mở được demo" : "Đang mở kho DEMO riêng…"}</h1>
        <p>{error ?? "Đang tải dữ liệu…"}</p>
        {error && (
          <button
            className="btn btn-primary"
            onClick={() => {
              setError(null);
              setAttempt((n) => n + 1);
            }}
          >
            Thử lại
          </button>
        )}
      </div>
    );
  return (
    <DemoContext.Provider
      value={{ state, run, error, clearError: () => setError(null), live }}
    >
      {children}
    </DemoContext.Provider>
  );
}
