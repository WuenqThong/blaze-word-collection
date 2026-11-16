import axios from "axios";
import { apiClient, errorMessage } from "../../api/client";
import type { User } from "../../lib/types";
import { canAdvance, uid } from "./domain";
import { repository } from "./repository";
import type { Command, DemoState, Session, Source } from "./types";

const owner = (id: number) => `account:${id}`;
const config = (account: User, signal?: AbortSignal) => ({ signal, headers: { "X-Account-ID": String(account.id) } });
const ensure = (signal?: AbortSignal) => { if (signal?.aborted) throw Error("Phiên tài khoản đã thay đổi."); };
export const GAME_COMMANDS = new Set(["answer", "draftAnswer", "moveSession", "sessionMeta", "submit", "withdrawSession"]);
export const CATALOG_COMMANDS = new Set(["question", "exam", "campaign", "task", "taxonomy", "publish", "closeExam"]);
export const isCatalogCommand = (command: Command) => CATALOG_COMMANDS.has(command.type) || (command.type === "source" && !command.source.id.startsWith("s:"));

export function replaceSession(state: DemoState, session: Session): DemoState {
  return { ...state, sessions: state.sessions.filter(s => s.id !== session.id).concat(session) };
}

export async function start(command: Extract<Command, { type: "start" | "autoStart" }>, account: User, signal?: AbortSignal) {
  const result = await apiClient.post<Session>("/dialect/game/sessions", { session_ref: command.id, ...(command.type === "start" ? { exam_id: command.examId } : {}), campaign_id: command.campaignId, consent: command.consent }, config(account, signal));
  ensure(signal);
  if (result.data.owner !== owner(account.id)) throw Error("Lượt chơi không thuộc tài khoản hiện tại.");
  await repository().replace(state => { ensure(signal); return replaceSession(state, result.data); });
}

export async function queue(command: Command, account: User, signal?: AbortSignal) {
  if (!("id" in command) || !GAME_COMMANDS.has(command.type)) throw Error("Thao tác lượt chơi không hợp lệ.");
  await repository().replace(state => {
    ensure(signal);
    const existing = state.sessions.find(s => s.id === command.id && s.owner === owner(account.id));
    if (!existing?.serverRevision) throw Error("Lượt này chưa có bản lưu trên máy chủ.");
    if (existing.serverConflict) throw Error("Hãy xử lý xung đột trước khi tiếp tục sửa lượt chơi.");
    const session = structuredClone(existing);
    const pending = session.serverPending ?? [];
    const last = pending.at(-1);
    const coalesce = last && !last.sent && last.command.type === command.type && ((command.type === "draftAnswer" && last.command.type === "draftAnswer" && last.command.index === command.index) || command.type === "sessionMeta");
    if (coalesce) last.command = command;
    else pending.push({ key: uid(), expectedRevision: session.serverRevision! + pending.length, command });
    session.serverPending = pending;
    session.serverSyncError = undefined;
    if (command.type === "draftAnswer" || command.type === "answer") {
      if (!canAdvance(session, command.index)) throw Error("Câu hỏi này chưa được mở.");
      const old = session.answers[command.index];
      session.answers[command.index] = { ...command.answer, attempts: old.attempts, updatedAt: new Date().toISOString() };
      if (command.type === "answer" && canAdvance(session, command.next)) session.cursor = command.next;
    } else if (command.type === "moveSession") session.cursor = command.cursor;
    else if (command.type === "sessionMeta") Object.assign(session, { region: command.region, upbringing: command.upbringing, usage: command.usage });
    return replaceSession(state, session);
  });
}

/** Persist the exact request before sending; retries never change its key/body. */
export async function flush(account: User, signal?: AbortSignal) {
  const repo = repository();
  for (const initial of (await repo.load()).sessions.filter(s => s.owner === owner(account.id) && s.serverRevision)) {
    for (;;) {
      ensure(signal);
      const session = (await repo.load()).sessions.find(s => s.id === initial.id)!;
      const next = session.serverPending?.[0];
      if (!next || session.serverConflict) break;
      await repo.replace(state => { ensure(signal); return replaceSession(state, { ...session, serverPending: session.serverPending!.map((entry, i) => i === 0 ? { ...entry, sent: true } : entry) }); });
      try {
        const result = (await apiClient.post<Session>(`/dialect/game/sessions/${encodeURIComponent(session.id)}/commands`, { key: next.key, expected_revision: next.expectedRevision, command: next.command }, config(account, signal))).data;
        ensure(signal);
        if (result.owner !== owner(account.id) || result.id !== session.id || !result.serverRevision) throw Error("Phản hồi lượt chơi không thuộc tài khoản hiện tại.");
        await repo.replace(state => {
          ensure(signal);
          const current = state.sessions.find(s => s.id === session.id)!;
          const remaining = (current.serverPending ?? []).filter(entry => entry.key !== next.key);
          // The acknowledged draft may be older than later unsent edits. Keep
          // the local projection until every queued command has been accepted.
          return replaceSession(state, remaining.length ? { ...current, serverRevision: result.serverRevision, serverPending: remaining, serverSyncError: undefined } : { ...result, serverViewKey: current.serverViewKey, localBackups: current.localBackups });
        });
      } catch (error) {
        ensure(signal);
        const detail = axios.isAxiosError(error) ? error.response?.data?.detail : null;
        const invalid = axios.isAxiosError(error) && error.response?.status === 422;
        let rejectedSnapshot: Session | undefined;
        if (invalid) {
          try { rejectedSnapshot = (await apiClient.get<Session>(`/dialect/game/sessions/${encodeURIComponent(session.id)}`, config(account, signal))).data; } catch { /* Keep the exact pending request if recovery is offline too. */ }
        }
        await repo.replace(state => {
          ensure(signal);
          const current = state.sessions.find(s => s.id === session.id)!;
          return replaceSession(state, { ...current, serverSyncError: detail?.message ?? errorMessage(error), ...(detail?.code === "game_conflict" && detail.session?.owner === owner(account.id) ? { serverConflict: detail.session as Session } : {}), ...(rejectedSnapshot?.owner === owner(account.id) && rejectedSnapshot.id === session.id ? { serverConflict: rejectedSnapshot, serverValidationError: true } : {}) });
        });
        if (axios.isAxiosError(error) && error.response?.status === 401) throw error;
        break;
      }
    }
  }
}

export async function load(account: User, signal?: AbortSignal) {
  const catalog = (await apiClient.get<Pick<DemoState, "questions" | "exams" | "campaigns" | "tasks" | "regions" | "topics"> & { revisions: Record<string, number>; bankSources?: Source[] }>("/dialect/game/catalog", config(account, signal))).data;
  const sessions: Session[] = [];
  let cursor: string | null = null;
  const seen = new Set<string>();
  do {
    const page: { items: Session[]; next_cursor: string | null } = (await apiClient.get("/dialect/game/sessions", { ...config(account, signal), params: { limit: 100, ...(cursor ? { cursor } : {}) } })).data;
    ensure(signal);
    if (!Array.isArray(page.items)) throw Error("Chưa tải được danh sách lượt chơi từ máy chủ.");
    sessions.push(...page.items);
    cursor = page.next_cursor;
    if (cursor && seen.has(cursor)) throw Error("Danh sách lượt chơi chưa tải đầy đủ. Hãy thử lại.");
    if (cursor) seen.add(cursor);
  } while (cursor);
  await repository().replace(state => {
    ensure(signal);
    const backups = state.catalogBackups ?? [];
    if (!state.catalogRevisions) backups.push({ at: new Date().toISOString(), owner: owner(account.id), questions: state.questions, exams: state.exams, campaigns: state.campaigns, tasks: state.tasks, regions: state.regions, topics: state.topics, sources: state.sources.filter(source => !source.id.startsWith("s:")) });
    let next: DemoState = { ...state, ...catalog, catalogBackups: backups, catalogRevisions: catalog.revisions, gameServerEnabled: true };
    if (catalog.bankSources) next.sources = state.sources.filter(source => source.id.startsWith("s:")).concat(catalog.bankSources);
    for (const remote of sessions) {
      if (!["admin", "reviewer"].includes(account.role) && remote.owner !== owner(account.id)) throw Error("Lượt chơi không thuộc tài khoản hiện tại.");
      const local = next.sessions.find(s => s.id === remote.id && s.owner === remote.owner);
      // A newer revision may be our own write whose response was lost. Retry
      // the exact key first; only a command's explicit 409 proves a conflict.
      if (local?.serverPending?.length) next = replaceSession(next, local);
      else next = replaceSession(next, { ...remote, serverViewKey: local?.serverRevision === remote.serverRevision ? local?.serverViewKey : uid(), localBackups: local?.localBackups });
    }
    return next;
  });
}

export async function resolve(command: Extract<Command, { type: "resolveGameConflict" }>, account: User, signal?: AbortSignal) {
  await repository().replace(state => {
    ensure(signal);
    const local = state.sessions.find(s => s.id === command.id && s.owner === owner(account.id));
    const remote = local?.serverConflict;
    if (!local || !remote) throw Error("Không còn xung đột cần xử lý.");
    const backups = [...(local.localBackups ?? []), { at: new Date().toISOString(), commands: local.serverPending ?? [] }];
    if (command.choice === "server") return replaceSession(state, { ...remote, serverViewKey: uid(), localBackups: backups });
    if (remote.state !== "playing") throw Error("Lượt trên máy chủ đã gửi hoặc rút. Hãy dùng bản máy chủ; nháp trên máy vẫn được giữ.");
    const entries = (local.serverPending ?? []).map((entry, index) => ({ key: uid(), expectedRevision: remote.serverRevision! + index, command: entry.command }));
    return replaceSession(state, { ...local, serverRevision: remote.serverRevision, serverConflict: undefined, serverSyncError: undefined, serverPending: entries, localBackups: backups });
  });
}

export async function saveCatalog(command: Command, state: DemoState, account: User, signal?: AbortSignal) {
  let kind: string, value: Record<string, unknown>, expected: number | undefined;
  switch (command.type) {
    case "source": kind = "bank_source"; value = { ...command.source }; break;
    case "question": kind = "question"; value = { ...command.question }; break;
    case "exam": kind = "exam"; value = { ...command.exam, status: "draft" }; break;
    case "campaign": kind = "campaign"; value = { ...command.campaign }; break;
    case "task": kind = "task"; value = { ...command.task }; break;
    case "taxonomy": kind = "taxonomy"; value = { id: "default", regions: command.regions, topics: command.topics }; expected = command.expectedRevision ?? state.catalogRevisions?.["taxonomy:default"]; break;
    case "closeExam":
    case "publish": {
      kind = "exam";
      const exam = state.exams.find(e => e.id === command.id);
      if (!exam) throw Error("Không tìm thấy bộ đề.");
      value = { ...exam, status: command.type === "publish" ? "active" : "closed", ...(command.type === "publish" ? { demo: !command.real } : {}) }; break;
    }
    default: throw Error("Không phải thao tác cấu hình máy chủ.");
  }
  const id = String(value.id); expected ??= Number(value.serverRevision ?? 0);
  delete value.serverRevision;
  if (kind === "taxonomy") delete value.id;
  await apiClient.put(`/dialect/game/catalog/${kind}/${encodeURIComponent(id)}`, { value, expected_revision: expected }, config(account, signal));
  ensure(signal);
}
