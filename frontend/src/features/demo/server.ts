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
import { apiClient } from "../../api/client";
import type { User } from "../../lib/types";
import type {
  Command, Consent, Contribution, Credit, DemoState, Event, Feedback, Person, Raw, Release, Role, Source, Verdict, Vote,
} from "./types";

/** VITE_DEMO_SERVER=off keeps the whole demo in IndexedDB (offline demos, unit tests). */
export const SERVER_ENABLED = import.meta.env.VITE_DEMO_SERVER !== "off";

// ---------- server shapes ----------

interface ServerRaw {
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
const demoRole = (role: ServerPerson["role"]): Role => (role === "annotator" ? "contributor" : role);

// ---------- server -> demo ----------

function toRaw(r: ServerRaw): Raw {
  return {
    kind: r.kind, text: r.original_text ?? "", meaning: r.meaning ?? "", standard: r.standard_vi ?? "", context: r.context ?? "",
    region: r.region ?? "", topic: r.topic ?? "", partOfSpeech: r.part_of_speech ?? "", variants: r.variants ?? "",
    keywords: r.keywords ?? "", evidence: r.source_evidence ?? "", method: r.method ?? "direct", family: r.family ?? "",
    confidence: r.confidence ?? "", response: r.response ?? "answer", mediaIds: r.media_ids ?? [],
  };
}

function toContribution(x: ServerContribution): Contribution {
  const raw = toRaw(x.raw);
  return {
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
  return { id: personId(p.id), name: p.full_name, role: demoRole(p.role), verified: p.verified, region: p.region, risk: p.risk, appeal: p.appeal };
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
  s.sources = s.sources.filter((x) => !isServer(x.id, "s") && questionSources.has(x.id)).concat(snap.sources.map(toSource));
  // A pending copy is done once the server holds a row with its idempotency key.
  const stored = new Set(snap.contributions.map((x) => x.client_ref).filter(Boolean));
  s.contributions = contributions.concat(outbox(s, snap.me.id).filter((c) => !stored.has(c.id)));
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
  s.events = s.events.filter((e) => !isServer(e.entity, "c")).concat(serverEvents);
  return s;
}

// ---------- demo -> server ----------

export async function snapshot(): Promise<Snapshot> {
  return (await apiClient.get<Snapshot>("/dialect/workspace")).data;
}

function contributionBody(c: Contribution) {
  const r = c.raw;
  return {
    kind: r.kind, original_text: r.text, meaning: r.meaning, standard_vi: r.standard, region: r.region, context: r.context,
    source_evidence: r.evidence, response: r.response, method: r.method, topic: r.topic, part_of_speech: r.partOfSpeech,
    variants: r.variants, keywords: r.keywords, family: r.family, confidence: r.confidence, media_ids: r.mediaIds,
    consent_version: c.consent.version, consent_collect: c.consent.collect, consent_train: c.consent.train,
    consent_public: c.consent.public, consent_audio: c.consent.audio,
    parent_id: c.parent ? serverNumber(c.parent, "c") : null, session_ref: c.sessionId, idempotency_key: c.id,
  };
}

/** Asks the server for the least-played exam among those this browser can run. */
export async function allocate(sessionRef: string, examIds: string[], played: string[], campaignId: string) {
  return (await apiClient.post<{ session_ref: string; exam_id: string; plays: number; repeat: boolean }>("/dialect/allocation", {
    session_ref: sessionRef, exam_ids: examIds, played, campaign_id: campaignId,
  })).data;
}

/** A request the server answered with a client error will fail again on retry. */
const permanent = (e: unknown) => axios.isAxiosError(e) && !!e.response && e.response.status >= 400 && e.response.status < 500 && e.response.status !== 401 && e.response.status !== 429;

/**
 * Pushes the outbox. Returns ids the server refused for good (validation, permission)
 * with the reason, so the caller can drop them and tell the user. Network errors
 * leave items in place for the next sync.
 */
export async function flush(state: DemoState, accountId: number) {
  const rejected: { id: string; error: unknown }[] = [];
  let pending: unknown = null;
  for (const c of outbox(state, accountId)) {
    try {
      await apiClient.post("/dialect/contributions", contributionBody(c));
    } catch (e) {
      if (permanent(e)) rejected.push({ id: c.id, error: e });
      else pending ??= e;
    }
  }
  return { rejected, pending };
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
  switch (command.type) {
    case "actor":
      throw Error("Đang dùng tài khoản thật. Đăng nhập bằng tài khoản khác để đổi vai trò.");
    case "register":
      throw Error("Đang dùng tài khoản thật. Tạo tài khoản mới ở trang Đăng ký.");
    case "consent": {
      const c = state.contributions.find((x) => x.id === command.id);
      if (c && !isServer(c.id, "c")) throw Error("Mẫu đang chờ đồng bộ. Thử lại sau khi mẫu đã lên máy chủ.");
      await apiClient.post(`/dialect/contributions/${serverNumber(command.id, "c")}/consent`, { consent: command.consent, withdraw: command.withdraw });
      return;
    }
    case "vote": {
      const [meaning_ok, region_ok, context_ok, translation_ok] = [0, 1, 2, 3].map((i) => !!command.checks[i]);
      await apiClient.post(`/dialect/reviews/${serverNumber(command.id, "c")}/votes`, { verdict: command.verdict, meaning_ok, region_ok, context_ok, translation_ok, note: command.note });
      return;
    }
    case "decide":
      await apiClient.post(`/dialect/reviews/${serverNumber(command.id, "c")}/finalize`, { verdict: command.verdict, note: command.note });
      return;
    case "curate":
      await apiClient.post(`/dialect/reviews/${serverNumber(command.id, "c")}/curate`, { raw: command.raw, sense_id: command.senseId, qa_audio: command.qaAudio });
      return;
    case "source": {
      const s = command.source;
      await apiClient.post(`/dialect/sources/${serverNumber(s.id, "s")}/rights`, {
        rights_confirmed: s.train, note: s.train ? "Xác nhận quyền huấn luyện từ màn hình nguồn" : "Chưa xác nhận quyền huấn luyện",
        title: s.title, public: s.public, audio: s.audio,
      });
      return;
    }
    case "person": {
      const p = command.person;
      const before = state.people.find((x) => x.id === p.id);
      const body: Record<string, unknown> = { verified: p.verified, risk: p.risk, review_region: p.region };
      if (before && before.role !== p.role) {
        const role = ROLE_FOR_SERVER[p.role];
        if (!role) throw Error("Màn hình này chỉ chuyển giữa Người góp và Reviewer. Quyền admin cấp ở máy chủ.");
        body.role = role;
      }
      await apiClient.put(`/dialect/participants/${serverNumber(p.id, "account")}`, body);
      return;
    }
    case "feedback":
      await apiClient.post("/dialect/feedback", { entity: command.entity.slice(0, 512), text: command.text });
      return;
    case "resolve":
      await apiClient.post(`/dialect/feedback/${serverNumber(command.id, "f")}/resolve`);
      return;
    case "rewardPolicy":
      await apiClient.put("/dialect/rewards/policy", { enabled: command.enabled });
      return;
    case "grant":
      await apiClient.post("/dialect/credits", { contribution_id: serverNumber(command.contributionId, "c") });
      return;
    case "revoke":
      await apiClient.post(`/dialect/credits/${serverNumber(command.id, "k")}/revoke`);
      return;
    case "spend":
      if (command.owner !== personId(account.id)) throw Error("Không dùng hạn mức của người khác.");
      await apiClient.post("/dialect/credits/spend", { amount: command.amount });
      return;
    case "release": {
      const splits: Record<string, string> = {};
      for (const r of command.release.records) splits[String(serverNumber(r.id, "c"))] = r.split;
      await apiClient.post("/dialect/releases", { ids: command.release.ids.map((id) => serverNumber(id, "c")), splits, data_card: command.release.dataCard });
      return;
    }
    case "appeal":
      await apiClient.post("/dialect/me/appeal", { text: command.text });
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
