export type Role = "guest" | "contributor" | "reviewer" | "admin";
export type Verdict = "RAW" | "REVIEW" | "VERIFIED" | "HOLD" | "REJECT";
export type QuestionKind =
  "GATE" | "LEXEME" | "GOLD" | "SENTENCE" | "OPEN_WORD" | "OPEN_SENTENCE";
export interface Consent {
  collect: boolean;
  train: boolean;
  public: boolean;
  audio: boolean;
  version: string;
}
export interface Person {
  operations?: boolean;
  id: string;
  name: string;
  role: Role;
  verified: boolean;
  region: string;
  risk: "clear" | "hold";
  appeal: string;
}
export interface Question {
  originalText?: string;
  serverRevision?: number;
  format?: "choice" | "short" | "fill" | "open";
  options?: { id: string; text: string }[];
  correctOptionId?: string;
  blankTemplate?: string;
  provenance?: { rowId: string; sheet: string; url: string; sense: string; verification: "unverified" | "sourced" | "verified"; authored: boolean };
  id: string;
  version: number;
  kind: QuestionKind;
  prompt: string;
  accepted: string[];
  region: string;
  topic: string;
  sourceId: string;
  approval: "DRAFT" | "DEMO_APPROVED" | "VERIFIED";
  demo: boolean;
  difficulty: number;
}
export interface Exam {
  serverRevision?: number;
  id: string;
  version: number;
  title: string;
  questionIds: string[];
  mode: "signal" | "strict";
  status: "draft" | "active" | "closed";
  demo: boolean;
  adaptive: boolean;
  region: string;
  topic: string;
  /** "sourced2": Q1–Q2 câu có nguồn (chấm điểm), Q3–Q10 mục chưa kiểm chứng (câu mở). Mặc định "classic". */
  layout?: "classic" | "sourced2";
}
export interface Answer {
  originalText?: string;
  selectedOptionId?: string;
  text: string;
  meaning: string;
  standard: string;
  context: string;
  skipped: boolean;
  attempts: { text: string; selectedOptionId?: string; correct: boolean | null; at: string; proposal?: string }[];
  suggestion: string;
  updatedAt: string;
}
export interface Session {
  serverRevision?: number;
  serverPending?: { key: string; expectedRevision: number; command: Command; sent?: boolean }[];
  serverViewKey?: string;
  allowedRegions?: string[];
  serverConflict?: Session;
  serverSyncError?: string;
  serverValidationError?: boolean;
  localBackups?: { at: string; commands: NonNullable<Session["serverPending"]> }[];
  serverAllocated?: boolean;
  receipts?: Partial<Record<"started" | "submitted" | "withdraw", { done?: boolean; reason?: string; attempts?: number }>>;
  testOnly?: boolean;
  repeat?: boolean;
  id: string;
  owner: string;
  recovery: string;
  exam: Exam;
  questions: Question[];
  answers: Answer[];
  cursor: number;
  consent: Consent;
  region: string;
  upbringing: string;
  usage: string;
  state: "playing" | "submitted" | "withdrawn";
  createdAt: string;
  submittedAt: string | null;
  campaignId: string;
}
export interface Raw {
  questionKind?: string;
  questionFormat?: Question["format"];
  kind: "word" | "sentence";
  text: string;
  meaning: string;
  standard: string;
  context: string;
  region: string;
  topic: string;
  partOfSpeech: string;
  variants: string;
  keywords: string;
  evidence: string;
  method: string;
  family: string;
  confidence: string;
  response: "answer" | "unknown" | "no_term" | "same_standard";
  mediaIds: string[];
}
export interface ReviewRevision {
  revision: number; digest: string; content: Raw; senseId: string | null; qaAudio: string;
  status: Verdict; votes: Vote[]; archivedAt: string;
}
export interface Contribution {
  clientRef?: string;
  reviewDigest?: string;
  reviewRevision?: number;
  reviewHistory?: ReviewRevision[];
  qualityReasons?: string[];
  sync?: { status: "pending" | "rejected" | "retry" | "accepted" | "discarded"; approved: boolean; attempts: number; reason?: string; attemptedAt?: string; payload?: Record<string, unknown> };
  duplicateOf?: string;
  id: string;
  owner: string;
  sessionId: string | null;
  parent: string | null;
  raw: Raw;
  consent: Consent;
  sourceId: string;
  status: Verdict;
  createdAt: string;
  withdrawn: boolean;
  curated: Raw | null;
  senseId: string | null;
  qaAudio: string;
}
export interface Vote {
  id: string;
  contributionId: string;
  reviewer: string;
  verdict: "VERIFIED" | "HOLD" | "REJECT";
  checks: boolean[];
  note: string;
  at: string;
}
export interface Source {
  serverRevision?: number;
  id: string;
  title: string;
  evidence: string;
  train: boolean;
  public: boolean;
  audio: boolean;
  demo: boolean;
}
export interface Campaign {
  serverRevision?: number;
  id: string;
  title: string;
  examIds: string[];
  region: string;
  topic: string;
  active: boolean;
  mode: "standard" | "adaptive" | "cross_region" | "generation";
}
export interface Task {
  serverRevision?: number;
  id: string;
  title: string;
  method: string;
  prompt: string;
  region: string;
  topic: string;
  mediaId: string | null;
  active: boolean;
}
export interface Event {
  id: string;
  actor: string;
  action: string;
  entity: string;
  note: string;
  at: string;
}
export interface Credit {
  id: string;
  owner: string;
  contributionId: string;
  amount: number;
  used: number;
  expiresAt: string;
  revoked: boolean;
  at: string;
}
export interface Feedback {
  id: string;
  owner: string;
  entity: string;
  text: string;
  state: "open" | "resolved";
}
export interface Job {
  id: string;
  type: "training" | "evaluation" | "import";
  model: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  log: string[];
  at: string;
}
export interface Release {
  previewDigest?: string;
  id: string;
  ids: string[];
  records: { id: string; raw: Raw; split: "train" | "dev" | "test" }[];
  checksum: string;
  at: string;
  dataCard: string;
}
export interface Media {
  id: string;
  name: string;
  mime: string;
  transcript: string;
  rights: boolean;
  duration: number | null;
  kind: "audio" | "image" | "video";
}
export interface ModelVersion {
  id: string;
  name: string;
  version: number;
  rules: Record<string, string>;
  notes: string;
  active: boolean;
}
export interface DemoState {
  gameServerEnabled?: boolean;
  catalogRevisions?: Record<string, number>;
  catalogBackups?: { at: string; owner: string; questions: Question[]; exams: Exam[]; campaigns: Campaign[]; tasks: Task[]; regions: string[]; topics: string[]; sources?: Source[] }[];

  serverAccountId?: number;
  serverEnvironment?: { label: string; id: string };
  serverStats?: { started_sessions: number; submitted_sessions: number; withdrawn_sessions: number; valid_samples: number; held_samples?: number; rejected_samples?: number; by_user?: Record<string, { started_sessions: number; submitted_sessions: number; withdrawn_sessions: number; valid_samples: number }>; coverage_since?: string; definitions: Record<string, string> };
  installedPacks?: string[];
  schema: 1;
  models: ModelVersion[];
  revision: number;
  actor: string;
  people: Person[];
  questions: Question[];
  exams: Exam[];
  sessions: Session[];
  contributions: Contribution[];
  votes: Vote[];
  sources: Source[];
  campaigns: Campaign[];
  tasks: Task[];
  events: Event[];
  credits: Credit[];
  feedback: Feedback[];
  jobs: Job[];
  releases: Release[];
  media: Media[];
  drafts: { key: string; raw: Raw; consent: Consent; parent: string | null }[];
  regions: string[];
  topics: string[];
  rewardEnabled: boolean;
  backupAt: string | null;
}
export type Command =
  | { type: "resolveGameConflict"; id: string; choice: "server" | "local" }
  | { type: "autoStart"; consent: Consent; campaignId: string; id: string; /** Đề do server chọn; bỏ qua nếu không còn trong pool. */ examId?: string }
  | {
      type: "start";
      examId: string;
      consent: Consent;
      campaignId: string;
      id: string;
    }
  | { type: "answer"; id: string; index: number; answer: Answer; next: number }
  | { type: "draftAnswer"; id: string; index: number; answer: Answer }
  | { type: "moveSession"; id: string; cursor: number }
  | {
      type: "sessionMeta";
      id: string;
      region: string;
      upbringing: string;
      usage: string;
    }
  | {
      type: "submit";
      id: string;
      region: string;
      upbringing: string;
      usage: string;
    }
  | { type: "withdrawSession"; id: string }
  | { type: "claim"; id: string; code: string }
  | {
      type: "contribute";
      id: string;
      raw: Raw;
      consent: Consent;
      parent: string | null;
      sourceId?: string;
    }
  | { type: "consent"; id: string; consent: Consent; withdraw: boolean }
  | {
      type: "vote";
      expectedDigest?: string;
      id: string;
      verdict: Vote["verdict"];
      checks: boolean[];
      note: string;
    }
  | { type: "decide"; expectedDigest?: string; id: string; verdict: Vote["verdict"]; note: string }
  | { type: "curate"; expectedDigest?: string; id: string; raw: Raw; senseId: string; qaAudio: string }
  | { type: "question"; question: Question }
  | { type: "exam"; exam: Exam }
  | { type: "publish"; id: string; real: boolean }
  | { type: "closeExam"; id: string }
  | { type: "source"; source: Source }
  | { type: "campaign"; campaign: Campaign }
  | { type: "task"; task: Task }
  | { type: "person"; person: Person; expected?: Person }
  | { type: "taxonomy"; regions: string[]; topics: string[]; expectedRevision?: number }
  | { type: "feedback"; entity: string; text: string }
  | { type: "resolve"; id: string }
  | { type: "grant"; owner: string; contributionId: string }
  | { type: "revoke"; id: string }
  | { type: "spend"; owner: string; amount: number }
  | { type: "rewardPolicy"; enabled: boolean }
  | { type: "job"; job: Job }
  | { type: "release"; release: Release }
  | { type: "media"; media: Media }
  | { type: "backup" }
  | {
      type: "draft";
      key: string;
      raw: Raw;
      consent: Consent;
      parent: string | null;
    }
  | { type: "clearDraft"; key: string }
  | { type: "register"; name: string; region: string }
  | { type: "appeal"; text: string }
  | { type: "model"; model: ModelVersion };
