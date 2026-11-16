// Bridges the demo store to the real /api/dialect backend for a signed-in account.
//
// Server-owned collections: contributions, votes, sources created by contributors,
// releases, people, credits and feedback. The game (questions, exams, sessions),
// campaigns, tasks, media blobs and AI jobs stay in IndexedDB.
//
// Contributions are written locally first (the reducer validates and the UI stays
// responsive), then pushed with the local id as idempotency key. Local ids are
// kept as an outbox until the server accepts them, so a dropped request is retried
// on the next sync instead of being lost.
import axios from "axios";
import { apiClient, extractError } from "../../api/client";
import type { User } from "../../lib/types";
import type {
  Command, Consent, Contribution, Credit, DemoState, Event, Feedback, Person, Raw, Release, Role, Source, Verdict, Vote,
} from "./types";

/** VITE_DEMO_SERVER=off keeps the whole demo in IndexedDB (offline demos, unit tests). */
export const SERVER_ENABLED = import.meta.env.VITE_DEMO_SERVER !== "off";

// ---------- server shapes ----------

interface ServerRaw {
  question_kind?: string; question_format?: Raw["questionFormat"];
  kind: "word" | "sentence";
  original_text: string; meaning: string; standard_vi: string; region: string; context: string; source_evidence: string;
  response?: Raw["response"]; method?: string; topic?: string; part_of_speech?: string; variants?: string;
  keywords?: string; family?: string; confidence?: string; media_ids?: string[];
}
interface ServerContribution {
  id: number; owner_id: number; parent_id: number | null; source_id: number; raw: ServerRaw; status: Verdict;
  withdrawn_at: string | null; created_at: string; vote_count: number; has_voted: boolean;
  votes: { id: number; reviewer_id: number; verdict: Vote["verdict"]; rubric: Record<string, boolean>; note: string; created_at: string }[];
  events: { action: string; note: string; created_at: string }[];
  consent: Consent;
  client_ref?: string | null;
  quality_reasons?: string[];
  quality_policy?: string;
  meta: { session_ref: string | null; duplicate_of: number | null; curated: Partial<Raw> | null; sense_id: string; qa_audio: string };
}
interface ServerPerson {
  id: number; full_name: string; role: "admin" | "reviewer" | "annotator"; account_status: string;
  region: string; verified: boolean; risk: "clear" | "hold"; review_region: string; appeal: string;
}
interface ServerSource { id: number; evidence: string; rights_confirmed: boolean; title: string; public: boolean; audio: boolean }
interface ServerRelease { id: number; created_at: string; count: number; checksum: string; ids: number[]; splits: Record<string, "train" | "dev" | "test" | "">; data_card: string }
interface ServerCredit { id: number; user_id: number; contribution_id: number; amount: number; used: number; expires_at: string; revoked: boolean; created_at: string }
interface ServerFeedback { id: number; user_id: number; entity: string; text: string; status: "open" | "resolved" }
export interface Snapshot {
  environment?: DemoState["serverEnvironment"];
  game_api?: number;
  next_cursor?: string | null;
  stats?: DemoState["serverStats"];
  me: ServerPerson;
  contributions: ServerContribution[];
  sources: ServerSource[];
  people: ServerPerson[];
  releases: ServerRelease[];
  credits: ServerCredit[];
  feedback: ServerFeedback[];
  reward_enabled: boolean;
}

// ---------- ids ----------

const contributionId = (n: number) => `c:${n}`;
const sourceId = (n: number) => `s:${n}`;
export const personId = (n: number) => `account:${n}`;
const isServer = (id: string, prefix: string) => id.startsWith(`${prefix}:`);
function serverNumber(id: string, prefix: string) {
  const n = Number(id.slice(prefix.length + 1));
  if (!isServer(id, prefix) || !Number.isInteger(n)) throw Error("Mục này chưa được đồng bộ lên máy chủ. Vui lòng tải lại trang.");
  return n;
}
const iso = (value: string) => new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`).toISOString();
const demoRole = (role: ServerPerson["role"]): Role => (role === "annotator" ? "contributor" : "reviewer");

// ---------- server -> demo ----------

function toRaw(r: ServerRaw): Raw {
  return {
    ...(r.question_kind ? { questionKind: r.question_kind } : {}),
    ...(r.question_format ? { questionFormat: r.question_format } : {}),
    kind: r.kind, text: r.original_text ?? "", meaning: r.meaning ?? "", standard: r.standard_vi ?? "", context: r.context ?? "",
    region: r.region ?? "", topic: r.topic ?? "", partOfSpeech: r.part_of_speech ?? "", variants: r.variants ?? "",
    keywords: r.keywords ?? "", evidence: r.source_evidence ?? "", method: r.method ?? "direct", family: r.family ?? "",
    confidence: r.confidence ?? "", response: r.response ?? "answer", mediaIds: r.media_ids ?? [],
  };
}

function toContribution(x: ServerContribution): Contribution {
  const raw = toRaw(x.raw);
  return {
    qualityReasons: x.quality_reasons ?? [],
    id: contributionId(x.id), owner: personId(x.owner_id), sessionId: x.meta.session_ref, parent: x.parent_id ? contributionId(x.parent_id) : null,
    raw, consent: x.consent, sourceId: sourceId(x.source_id), status: x.status, createdAt: iso(x.created_at), withdrawn: !!x.withdrawn_at,
    curated: x.meta.curated ? { ...raw, ...x.meta.curated } : null, senseId: x.meta.sense_id || null, qaAudio: x.meta.qa_audio,
    duplicateOf: x.meta.duplicate_of ? contributionId(x.meta.duplicate_of) : undefined,
  };
}

const RUBRIC = ["meaning_ok", "region_ok", "context_ok", "translation_ok"] as const;

function toVotes(x: ServerContribution): Vote[] {
  if (x.votes.length)
    return x.votes.map((v) => ({
      id: `v:${v.id}`, contributionId: contributionId(x.id), reviewer: personId(v.reviewer_id), verdict: v.verdict,
      checks: RUBRIC.map((k) => !!v.rubric[k]), note: v.note, at: iso(v.created_at),
    }));
  // Votes stay sealed until the caller has voted. Placeholders keep counts and
  // eligibility right without revealing who voted or how.
  return Array.from({ length: x.vote_count }, (_, i) => ({
    id: `v:sealed:${x.id}:${i}`, contributionId: contributionId(x.id), reviewer: "sealed", verdict: "HOLD" as const, checks: [], note: "", at: "",
  }));
}

function toPerson(p: ServerPerson): Person {
  return { id: personId(p.id), name: p.full_name, role: demoRole(p.role), verified: p.verified, region: p.role === "reviewer" ? p.review_region : p.region, risk: p.risk, appeal: p.appeal };
}

function toSource(s: ServerSource): Source {
  return { id: sourceId(s.id), title: s.title || `Nguồn #${s.id}`, evidence: s.evidence, train: s.rights_confirmed, public: s.public, audio: s.audio, demo: false };
}

function toRelease(r: ServerRelease, contributions: Contribution[]): Release {
  const ids = r.ids.map(contributionId);
  return {
    id: `r:${r.id}`, ids, checksum: r.checksum, at: iso(r.created_at), dataCard: r.data_card,
    records: ids.map((id) => {
      const c = contributions.find((c) => c.id === id);
      const split = r.splits[String(serverNumber(id, "c"))];
      return { id, raw: c?.curated ?? c?.raw ?? ({} as Raw), split: split || "train" };
    }),
  };
}

function toCredit(k: ServerCredit): Credit {
  return { id: `k:${k.id}`, owner: personId(k.user_id), contributionId: contributionId(k.contribution_id), amount: k.amount, used: k.used, expiresAt: iso(k.expires_at), revoked: k.revoked, at: iso(k.created_at) };
}

function toFeedback(f: ServerFeedback): Feedback {
  return { id: `f:${f.id}`, owner: personId(f.user_id), entity: f.entity, text: f.text, state: f.status };
}

/** Pending local contributions of this account that the server has not accepted yet.
 *  A pending item withdrawn before it reached the server is simply never sent. */
export function outbox(state: DemoState, accountId: number) {
  return state.contributions.filter((c) => !isServer(c.id, "c") && c.owner === personId(accountId) && !c.withdrawn);
}

export function merge(state: DemoState, snap: Snapshot): DemoState {
  const s = structuredClone(state);
  const contributions = snap.contributions.map(toContribution);
  // Keep local sources only when a question bank item still points at them.
  const questionSources = new Set(s.questions.map((q) => q.sourceId));
  s.sources = s.sources.filter((x) => !isServer(x.id, "s") && (questionSources.has(x.id) || s.contributions.some((c) => c.sourceId === x.id && !isServer(c.id, "c")))).concat(snap.sources.map(toSource));
  // A pending copy is done once the server holds a row with its idempotency key.
  const stored = new Set(snap.contributions.map((x) => x.client_ref).filter(Boolean));
  s.contributions = contributions.concat(s.contributions.filter((c) => !isServer(c.id, "c") && c.owner.startsWith("account:") && (c.owner !== personId(snap.me.id) || !stored.has(c.id) || c.sync?.status === "discarded")));
  s.serverStats = snap.stats;
  s.serverAccountId = snap.me.id;
  s.serverEnvironment = snap.environment;
  s.gameServerEnabled = snap.game_api === 1 || s.gameServerEnabled;
  s.events = s.events.map((e) => {
    const accepted = snap.contributions.find((c) => c.client_ref === e.entity && c.owner_id === snap.me.id);
    return accepted ? { ...e, entity: contributionId(accepted.id) } : e;
  });
  s.votes = snap.contributions.flatMap(toVotes);
  s.releases = snap.releases.map((r) => toRelease(r, contributions));
  s.credits = snap.credits.map(toCredit);
  s.feedback = snap.feedback.map(toFeedback);
  s.rewardEnabled = snap.reward_enabled;
  const guest = s.people.find((p) => p.id === "guest");
  s.people = (guest ? [guest] : []).concat(snap.people.map(toPerson));
  if (!s.people.some((p) => p.id === personId(snap.me.id))) s.people.push(toPerson(snap.me));
  s.actor = personId(snap.me.id);
  const serverEvents: Event[] = snap.contributions.flatMap((x) =>
    x.events.map((e, i) => ({ id: `e:${x.id}:${i}`, actor: "", action: e.action, entity: contributionId(x.id), note: e.note, at: iso(e.created_at) })),
  );
  s.events = s.events.filter((e) => !isServer(e.entity, "c") || e.action.startsWith("SYNC_")).concat(serverEvents);
  return s;
}

/** Project the durable shared store into the current account's view only. */
export function accountView(state: DemoState, accountId: number | null): DemoState {
  const owner = accountId === null ? "guest" : personId(accountId);
  const loaded = accountId !== null && state.serverAccountId === accountId;
  const staff = loaded && ["admin", "reviewer"].includes(state.people.find(p => p.id === owner)?.role ?? "");
  const contributions = state.contributions.filter((c) => isServer(c.id, "c") ? loaded : c.owner === owner);
  const ids = new Set(contributions.map((c) => c.id));
  const sources = new Set([...state.questions.map((q) => q.sourceId), ...contributions.map((c) => c.sourceId)]);
  return { ...state, contributions, sessions: state.sessions.filter((s) => s.owner === owner || (staff && !!s.serverRevision)),
    drafts: state.drafts.filter((d) => d.key.startsWith(`${owner}.`)),
    sources: state.sources.filter((s) => sources.has(s.id) || (loaded && isServer(s.id, "s"))),
    people: loaded ? state.people : state.people.filter((p) => p.id === owner || p.id === "guest"),
    votes: state.votes.filter((v) => ids.has(v.contributionId)),
    events: state.events.filter((e) => ids.has(e.entity) || e.actor === owner),
    releases: loaded ? state.releases : [], credits: loaded ? state.credits : [], feedback: loaded ? state.feedback : [],
    serverStats: loaded ? state.serverStats : undefined,
  };
}

// ---------- demo -> server ----------

export async function snapshot(signal?: AbortSignal, accountId?: number): Promise<Snapshot> {
  let cursor: string | undefined;
  let result: Snapshot | undefined;
  const seen = new Set<string>();
  const collections = ["contributions", "sources", "people", "releases", "credits", "feedback"] as const;
  for (let page = 0; page < 10000; page++) {
    const data = (await apiClient.get<Snapshot>("/dialect/workspace", { params: { limit: 100, ...(cursor ? { cursor } : {}) }, signal, ...(accountId === undefined ? {} : { headers: { "X-Account-ID": String(accountId) } }) })).data;
    if (!result) result = structuredClone(data);
    else {
      if (data.me.id !== result.me.id || data.me.role !== result.me.role) throw Error("Phiên đăng nhập thay đổi khi tải dữ liệu.");
      for (const key of collections) {
        const rows = new Map<number, unknown>(result[key].map((x) => [x.id, x]));
        for (const row of data[key]) rows.set(row.id, row);
        Object.assign(result, { [key]: [...rows.values()] });
      }
    }
    if (data.next_cursor == null) return { ...result, next_cursor: null };
    if (typeof data.next_cursor !== "string" || !data.next_cursor || seen.has(data.next_cursor)) throw Error("Con trỏ phân trang lặp/không hợp lệ.");
    seen.add(data.next_cursor); cursor = data.next_cursor;
  }
  throw Error("Quá giới hạn trang workspace; chưa thay dữ liệu trên máy.");
}

function contributionBody(c: Contribution) {
  const r = c.raw;
  return {
    ...(r.questionKind ? { question_kind: r.questionKind } : {}),
    ...(r.questionFormat ? { question_format: r.questionFormat } : {}),
    kind: r.kind, original_text: r.text, meaning: r.meaning, standard_vi: r.standard, region: r.region, context: r.context,
    source_evidence: r.evidence, response: r.response, method: r.method, topic: r.topic, part_of_speech: r.partOfSpeech,
    variants: r.variants, keywords: r.keywords, family: r.family, confidence: r.confidence, media_ids: r.mediaIds,
    consent_version: c.consent.version, consent_collect: c.consent.collect, consent_train: c.consent.train,
    consent_public: c.consent.public, consent_audio: c.consent.audio,
    expected_owner_id: serverNumber(c.owner, "account"),
    parent_id: c.parent ? serverNumber(c.parent, "c") : null, session_ref: c.sessionId, idempotency_key: c.id,
  };
}

/** Asks the server for the least-played exam among those this browser can run. */
export async function allocate(sessionRef: string, examIds: string[], played: string[], campaignId: string, accountId?: number) {
  const body = { session_ref: sessionRef, exam_ids: examIds, played, campaign_id: campaignId };
  type Allocation = { session_ref: string; exam_id: string; plays: number; repeat: boolean };
  return (accountId === undefined
    ? await apiClient.post<Allocation>("/dialect/allocation", body)
    : await apiClient.post<Allocation>("/dialect/allocation", body, { headers: { "X-Account-ID": String(accountId) } })).data;
}

/** A request the server answered with a client error will fail again on retry. */
const permanent = (e: unknown) => axios.isAxiosError(e) && !!e.response && e.response.status >= 400 && e.response.status < 500 && e.response.status !== 401 && e.response.status !== 429;

/** Persist the exact payload before first sending. Old items need approval. */
export function prepareOutbox(state: DemoState, accountId: number, approveIds: Set<string> = new Set()): DemoState {
  return { ...state, contributions: state.contributions.map((c) => {
    if (c.owner !== personId(accountId) || isServer(c.id, "c") || c.withdrawn) return c;
    const sync = c.sync ?? { status: "pending" as const, approved: false, attempts: 0 };
    return { ...c, sync: { ...sync, approved: sync.approved || approveIds.has(c.id), payload: sync.payload ?? contributionBody(c) } };
  }) };
}
export async function flush(state: DemoState, accountId: number, options: { signal?: AbortSignal; active?: () => boolean } = {}) {
  const rejected: { id: string; error: unknown }[] = [];
  const updates = new Map<string, NonNullable<Contribution["sync"]>>();
  let pending: unknown = null;
  for (const c of outbox(state, accountId)) {
    if (!c.sync?.approved || ["rejected", "accepted", "discarded"].includes(c.sync.status)) continue;
    if (options.signal?.aborted || options.active?.() === false) break;
    const sync = { ...c.sync, attempts: c.sync.attempts + 1, attemptedAt: new Date().toISOString() };
    try {
      await apiClient.post("/dialect/contributions", c.sync.payload ?? contributionBody(c), { signal: options.signal, headers: { "X-Account-ID": String(accountId) } });
      updates.set(c.id, { ...sync, status: "accepted", reason: undefined });
    } catch (e) {
      if (options.signal?.aborted || options.active?.() === false) break;
      updates.set(c.id, { ...sync, status: permanent(e) ? "rejected" : "retry", reason: extractError(e, "Máy chủ từ chối mẫu") });
      if (permanent(e)) rejected.push({ id: c.id, error: e });
      else { pending ??= e; break; }
    }
  }
  return { rejected, pending, updates };
}
export async function flushReceipts(state: DemoState, accountId: number, signal: AbortSignal, active: () => boolean) {
  const updates = new Map<string, NonNullable<DemoState["sessions"][number]["receipts"]>>();
  for (const session of state.sessions.filter((s) => s.owner === personId(accountId) && (s.serverAllocated || s.receipts?.withdraw))) {
    const receipts = structuredClone(session.receipts ?? {});
    for (const kind of ["started", "submitted", "withdraw"] as const) {
      if (!receipts[kind] || receipts[kind]?.done) continue;
      if (signal.aborted || !active()) return updates;
      try {
        await apiClient.post(`/dialect/sessions/${encodeURIComponent(session.id)}/${kind}`, {}, { signal, headers: { "X-Account-ID": String(accountId) } });
        receipts[kind] = { done: true, attempts: (receipts[kind]?.attempts ?? 0) + 1 };
      } catch (e) {
        if (signal.aborted || !active()) return updates;
        receipts[kind] = { attempts: (receipts[kind]?.attempts ?? 0) + 1, reason: extractError(e) };
        updates.set(session.id, receipts); return updates;
      }
      updates.set(session.id, receipts);
    }
  }
  return updates;
}

/** Commands whose effect lives only on the server. `source` only for server sources
 *  (see isServerSource); question-bank sources stay local. */
export const SERVER_COMMANDS = new Set<Command["type"]>([
  "consent", "vote", "decide", "curate", "source", "person", "feedback", "resolve", "rewardPolicy", "grant", "revoke", "spend", "release", "appeal", "register", "actor",
]);

/** Where a command runs for a signed-in account. */
export function runsOnServer(command: Command) {
  return SERVER_COMMANDS.has(command.type) && (command.type !== "source" || isServerSource(command));
}
/** Local commands that create or withdraw contributions and therefore need a sync afterwards. */
export const SYNCED_LOCAL_COMMANDS = new Set<Command["type"]>(["contribute", "submit", "withdrawSession"]);

const ROLE_FOR_SERVER: Partial<Record<Role, "annotator" | "reviewer">> = { contributor: "annotator", reviewer: "reviewer" };

/** Runs a server-owned command. `source` is server-owned only for server sources. */
export async function execute(command: Command, state: DemoState, account: User) {
  // Request-local scope: never mutate shared client defaults across accounts.
  const config = { headers: { "X-Account-ID": String(account.id) } };
  const client = {
    post: (url: string, body?: unknown) => apiClient.post(url, body, config),
    put: (url: string, body?: unknown) => apiClient.put(url, body, config),
  };
  switch (command.type) {
    case "actor":
      throw Error("Đang dùng tài khoản thật. Đăng nhập bằng tài khoản khác để đổi vai trò.");
    case "register":
      throw Error("Đang dùng tài khoản thật. Tạo tài khoản mới ở trang Đăng ký.");
    case "consent": {
      const c = state.contributions.find((x) => x.id === command.id);
      if (c && !isServer(c.id, "c")) throw Error("Mẫu đang chờ đồng bộ. Thử lại sau khi mẫu đã lên máy chủ.");
      await client.post(`/dialect/contributions/${serverNumber(command.id, "c")}/consent`, { consent: command.consent, withdraw: command.withdraw });
      return;
    }
    case "vote": {
      const [meaning_ok, region_ok, context_ok, translation_ok] = [0, 1, 2, 3].map((i) => !!command.checks[i]);
      await client.post(`/dialect/reviews/${serverNumber(command.id, "c")}/votes`, { verdict: command.verdict, meaning_ok, region_ok, context_ok, translation_ok, note: command.note });
      return;
    }
    case "decide":
      await client.post(`/dialect/reviews/${serverNumber(command.id, "c")}/finalize`, { verdict: command.verdict, note: command.note });
      return;
    case "curate":
      await client.post(`/dialect/reviews/${serverNumber(command.id, "c")}/curate`, { raw: command.raw, sense_id: command.senseId, qa_audio: command.qaAudio });
      return;
    case "source": {
      const s = command.source;
      await client.post(`/dialect/sources/${serverNumber(s.id, "s")}/rights`, {
        rights_confirmed: s.train, note: s.train ? "Xác nhận quyền huấn luyện từ màn hình nguồn" : "Chưa xác nhận quyền huấn luyện",
        title: s.title, public: s.public, audio: s.audio,
      });
      return;
    }
    case "person": {
      const p = command.person;
      const before = state.people.find((x) => x.id === p.id);
      const body: Record<string, unknown> = { verified: p.verified, risk: p.risk, review_region: p.region };
      if (command.expected) {
        const old = command.expected;
        body.expected = { role: old.role === "contributor" ? "annotator" : old.role, verified: old.verified, risk: old.risk, ...(old.role === "reviewer" ? { review_region: old.region } : {}) };
      }
      if (before && before.role !== p.role) {
        const role = ROLE_FOR_SERVER[p.role];
        if (!role) throw Error("Chọn Người góp hoặc Reviewer.");
        body.role = role;
      }
      await client.put(`/dialect/participants/${serverNumber(p.id, "account")}`, body);
      return;
    }
    case "feedback":
      await client.post("/dialect/feedback", { entity: command.entity.slice(0, 512), text: command.text });
      return;
    case "resolve":
      await client.post(`/dialect/feedback/${serverNumber(command.id, "f")}/resolve`);
      return;
    case "rewardPolicy":
      await client.put("/dialect/rewards/policy", { enabled: command.enabled });
      return;
    case "grant":
      await client.post("/dialect/credits", { contribution_id: serverNumber(command.contributionId, "c") });
      return;
    case "revoke":
      await client.post(`/dialect/credits/${serverNumber(command.id, "k")}/revoke`);
      return;
    case "spend":
      if (command.owner !== personId(account.id)) throw Error("Không dùng hạn mức của người khác.");
      await client.post("/dialect/credits/spend", { amount: command.amount });
      return;
    case "release": {
      const splits: Record<string, string> = {};
      for (const r of command.release.records) splits[String(serverNumber(r.id, "c"))] = r.split;
      await client.post("/dialect/releases", { ids: command.release.ids.map((id) => serverNumber(id, "c")), splits, data_card: command.release.dataCard, ...(command.release.previewDigest ? { preview_digest: command.release.previewDigest } : {}) });
      return;
    }
    case "appeal":
      await client.post("/dialect/me/appeal", { text: command.text });
      return;
    default:
      throw Error(`Lệnh ${command.type} không chạy trên máy chủ.`);
  }
}

/** Server part of a local command, run after the local reducer succeeded. */
export async function afterLocal(command: Command) {
  if (command.type === "withdrawSession") await apiClient.post(`/dialect/sessions/${encodeURIComponent(command.id)}/withdraw`);
}

export function isServerSource(command: Command) {
  return command.type === "source" && isServer(command.source.id, "s");
}

export async function downloadRelease(id: string) {
  return (await apiClient.get(`/dialect/releases/${serverNumber(id, "r")}`)).data as unknown;
}
