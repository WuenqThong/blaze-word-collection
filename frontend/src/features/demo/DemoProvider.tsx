import { useEffect, useRef, useState, type ReactNode } from "react";
import { DemoContext } from "./context";
import { repository } from "./repository";
import type { Command, DemoState } from "./types";
import type { User } from "../../lib/types";
import { authApi } from "../../api/auth";
import { errorMessage, extractError } from "../../api/client";
import * as server from "./server";
import { gameAllocation, uid } from "./domain";
import * as games from "./gameServer";

// Serialize repository/account transitions as well as requests. Aborted old requests
// never merge into a newly bound account, even if their transport ignores abort.
let tail: Promise<unknown> = Promise.resolve();
function serial<T>(job: () => Promise<T>): Promise<T> {
  const next = tail.then(job, job);
  tail = next.catch(() => {});
  return next;
}
type Binding = { account?: User | null; controller: AbortController; ready: boolean };
const active = (b: Binding) => !b.controller.signal.aborted;
function check(b: Binding) { if (!active(b)) throw Error("Phiên tài khoản đã thay đổi."); }
async function synchronize(b: Binding, reportError: (message: string | null) => void) {
    check(b);
    if (!server.SERVER_ENABLED || !b.account) return;
    if ((await repository().load()).simulate === "offline") throw Error("Đang mô phỏng mất mạng; bản gốc vẫn được giữ trên máy.");
    check(b);
    const user = await authApi.me();
    check(b);
    if (user.id !== b.account.id) throw Error("Phiên đăng nhập đã thay đổi. Vui lòng tải lại trang.");
    const repo = repository();
    if ((await repo.load()).gameServerEnabled) await games.flush(user, b.controller.signal);
    let current = await repo.replace((s) => { check(b); return server.prepareOutbox(s, user.id); });
    const receipts = await server.flushReceipts(current, user.id, b.controller.signal, () => active(b));
    check(b);
    current = await repo.replace((s) => { check(b); return { ...s, sessions: s.sessions.map((x) => receipts.has(x.id) && x.owner === server.personId(user.id) ? { ...x, receipts: receipts.get(x.id) } : x) }; });
    const result = await server.flush(current, user.id, { signal: b.controller.signal, active: () => active(b) });
    check(b);
    // Persist outcomes before snapshot: even a failed GET cannot lose a rejection.
    await repo.replace((s) => {
      check(b);
      return { ...s, contributions: s.contributions.map((c) => result.updates.has(c.id) && c.owner === server.personId(user.id) ? { ...c, sync: result.updates.get(c.id) } : c),
        events: s.events.concat([...result.updates].map(([id, sync]) => ({ id: uid(), actor: server.personId(user.id), entity: id, action: `SYNC_${sync.status.toUpperCase()}`, note: sync.reason ?? "Máy chủ đã nhận", at: sync.attemptedAt! }))) };
    });
    const snap = await server.snapshot(b.controller.signal, user.id);
    check(b);
    if (snap.me.id !== user.id) throw Error("Workspace không thuộc tài khoản hiện tại.");
    await repo.replace((s) => { check(b); return server.merge(s, snap); });
    if (snap.game_api === 1) await games.load(user, b.controller.signal);
    check(b);
    reportError(result.pending ? "Chưa gửi được một số mẫu. Nội dung và lý do được giữ trong lịch sử." : null);
  }

export function DemoProvider({ children, account }: { children: ReactNode; account?: User | null }) {
  const [state, setState] = useState<DemoState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [readyAccount, setReadyAccount] = useState("");
  const readyKey = `${account === undefined ? "local" : account?.id ?? "guest"}.${attempt}`;
  const binding = useRef<Binding | null>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const live = server.SERVER_ENABLED && !!account;


  useEffect(() => {
    const b: Binding = { account, controller: new AbortController(), ready: false };
    binding.current = b;
    const repo = repository(attempt > 0);
    const unsubscribe = repo.subscribe((s) => {
      if (active(b) && (!server.SERVER_ENABLED || account === undefined || s.actor === (account ? server.personId(account.id) : "guest"))) setState(s);
    });
    void serial(async () => {
      check(b);
      await repo.load(); check(b);
      const loaded = account === undefined ? await repo.load() : await repo.bindAccount(account);
      check(b);
      if (server.SERVER_ENABLED && account) {
        // Every pre-existing unsent item needs explicit approval in this session.
        await repo.replace((s) => { check(b); return { ...server.prepareOutbox(s, account.id), contributions: server.prepareOutbox(s, account.id).contributions.map((c) => c.owner === server.personId(account.id) && c.sync && !c.id.startsWith("c:") && c.sync.status !== "accepted" ? { ...c, sync: { ...c.sync, approved: false } } : c) }; });
      } else setState(loaded);
      b.ready = true;
      try { await synchronize(b, setError); }
      finally {
        if (active(b)) {
          const cached = await repo.load();
          if (active(b) && (!server.SERVER_ENABLED || !account || cached.serverAccountId === account.id)) {
            setState(cached);
            setReadyAccount(readyKey);
          }
        }
      }
    }).catch((e) => { if (active(b)) setError(extractError(e, errorMessage(e))); });
    const reconnect = () => { if (b.ready) void serial(() => synchronize(b, setError)).catch((e) => { if (active(b)) setError(extractError(e)); }); };
    window.addEventListener("online", reconnect);
    window.addEventListener("focus", reconnect);
    return () => { b.controller.abort(); if (syncTimer.current) clearTimeout(syncTimer.current); unsubscribe(); window.removeEventListener("online", reconnect); window.removeEventListener("focus", reconnect); };
  }, [account, attempt, readyKey]);

  async function refresh() {
    const b = binding.current;
    if (!b?.ready) return;
    await serial(() => synchronize(b, setError));
  }
  async function syncAction(id: string | null, action: "retry" | "discard" | "approve") {
    const b = binding.current;
    if (!b?.ready || !b.account) throw Error("Vui lòng đăng nhập.");
    return serial(async () => {
      check(b);
      const owner = server.personId(b.account!.id);
      await repository().replace((s) => {
        check(b);
        const ids = new Set(s.contributions.filter((c) => c.owner === owner && !c.id.startsWith("c:") && !c.withdrawn && c.sync?.status !== "accepted" && (id === null ? !c.sync?.approved : c.id === id)).map((c) => c.id));
        const prepared = server.prepareOutbox(s, b.account!.id, ids);
        return { ...prepared, contributions: prepared.contributions.map((c) => {
          if (!ids.has(c.id) || !c.sync) return c;
          if (c.sync.status === "accepted") throw Error("Máy chủ đã nhận mẫu. Tải lại và dùng chức năng rút mẫu.");
          return action === "discard" ? { ...c, withdrawn: true, sync: { ...c.sync, status: "discarded" as const } } : { ...c, sync: { ...c.sync, status: "pending" as const } };
        }), events: s.events.concat([...ids].map((entity) => ({ id: uid(), actor: owner, entity, action: `SYNC_${action.toUpperCase()}`, note: action === "discard" ? "Người góp xác nhận bỏ gửi; giữ bản gốc trên máy." : "Người góp xác nhận gửi nguyên bản.", at: new Date().toISOString() }))) };
      });
      if (action !== "discard") await synchronize(b, setError);
    });
  }
  async function run(input: Command): Promise<DemoState> {
    const b = binding.current;
    if (!b?.ready) throw Error("Kho dữ liệu chưa sẵn sàng.");
    return serial(async () => {
      check(b);
      let command = input;
      let allocated = false;
      try {
        const repo = repository();
        const before = await repo.load(); check(b);
        if (b.account !== undefined && !b.account && command.type !== "simulate") throw Error("Vui lòng đăng nhập để tiếp tục.");
        if (b.account !== undefined && command.type === "actor" && !["admin", "reviewer"].includes(b.account?.role ?? "")) throw Error("Bạn không có quyền đổi vai trò.");
        if (live && b.account && (server.runsOnServer(command) || ["start", "autoStart", "submit", "contribute"].includes(command.type))) {
          const me = await authApi.me(); check(b);
          if (me.id !== b.account.id) throw Error("Phiên đăng nhập đã thay đổi.");
        }
        if (live && b.account && before.gameServerEnabled) {
          if (command.type === "start" || command.type === "autoStart") {
            await games.start(command, b.account, b.controller.signal);
            await synchronize(b, setError); check(b);
            return server.accountView(await repo.load(), b.account.id);
          }
          if (games.isCatalogCommand(command)) {
            await games.saveCatalog(command, before, b.account, b.controller.signal);
            await synchronize(b, setError); check(b);
            return server.accountView(await repo.load(), b.account.id);
          }
          if (command.type === "resolveGameConflict") {
            await games.resolve(command, b.account, b.controller.signal);
            await synchronize(b, setError); check(b);
            return server.accountView(await repo.load(), b.account.id);
          }
          const gameId = "id" in command ? command.id : undefined;
          if (gameId && games.GAME_COMMANDS.has(command.type) && before.sessions.some(s => s.id === gameId && s.serverRevision)) {
            await games.queue(command, b.account, b.controller.signal); check(b);
            if (command.type === "draftAnswer" || command.type === "sessionMeta") {
              if (syncTimer.current) clearTimeout(syncTimer.current);
              syncTimer.current = setTimeout(() => { void serial(() => synchronize(b, setError)).catch(error => { if (active(b)) setError(errorMessage(error)); }); }, 700);
            } else {
              try { await synchronize(b, setError); } catch (error) { check(b); setError(`Nháp vẫn được giữ trên máy. ${errorMessage(error)}`); }
            }
            return server.accountView(await repo.load(), b.account.id);
          }
        }
        if (command.type === "start" && live && b.account && before.simulate !== "offline") {
          try { await server.allocate(command.id, [command.examId], [], command.campaignId, b.account.id); check(b); allocated = true; } catch { check(b); }
        }
        if (command.type === "autoStart" && live && b.account && before.simulate !== "offline") {
          const local = gameAllocation(before, before.actor, command.campaignId);
          if (!local.pending && local.pool.length) {
            try {
              const picked = await server.allocate(command.id, local.pool.map((e) => e.id), local.played, command.campaignId, b.account.id);
              check(b); command = { ...command, examId: picked.exam_id }; allocated = true;
            } catch { check(b); }
          }
        }
        if (live && server.runsOnServer(command)) {
          if (before.simulate === "offline") throw Error("Đang mô phỏng mất mạng.");
          await server.execute(command, before, b.account!); check(b);
          await synchronize(b, setError);
        } else {
          await repo.dispatch(command, b.account); check(b);
          if (live && b.account) {
            const oldIds = new Set(before.contributions.map((c) => c.id));
            await repo.replace((s) => {
              check(b);
              const newIds = new Set(s.contributions.filter((c) => c.owner === server.personId(b.account!.id) && !oldIds.has(c.id)).map((c) => c.id));
              const next = server.prepareOutbox(s, b.account!.id, newIds);
              next.sessions = next.sessions.map((session) => {
                if (!("id" in command) || session.id !== command.id || session.owner !== server.personId(b.account!.id)) return session;
                if ((command.type === "start" || command.type === "autoStart") && allocated) return { ...session, serverAllocated: true, receipts: { started: {} } };
                if (session.serverAllocated && command.type === "submit") return { ...session, receipts: { ...session.receipts, submitted: {} } };
                if (command.type === "withdrawSession") return { ...session, receipts: { ...session.receipts, withdraw: {} } };
                return session;
              });
              return next;
            });
            if (["start", "autoStart", "submit", "contribute", "withdrawSession"].includes(command.type)) {
              try { await synchronize(b, setError); } catch (e) { check(b); setError(`Đã lưu trên máy. ${extractError(e)}`); }
            }
          }
        }
        check(b);
        return !server.SERVER_ENABLED || b.account === undefined ? await repo.load() : server.accountView(await repo.load(), b.account?.id ?? null);
      } catch (e) {
        if (active(b)) setError(errorMessage(e));
        throw e;
      }
    });
  }
  const visible = state && (!live || readyAccount === readyKey) && (!server.SERVER_ENABLED || account === undefined || state.actor === (account ? server.personId(account.id) : "guest"));
  if (!visible) return <div className="collection-empty" role="status"><p>{error ?? "Đang tải dữ liệu tài khoản…"}</p>{error && <button onClick={() => { setError(null); setAttempt((n) => n + 1); }}>Thử lại</button>}</div>;
  return <DemoContext.Provider value={{ state: !server.SERVER_ENABLED || account === undefined ? state : server.accountView(state, account?.id ?? null), run, refresh, syncAction, error, clearError: () => setError(null), live }}>{children}</DemoContext.Provider>;
}
