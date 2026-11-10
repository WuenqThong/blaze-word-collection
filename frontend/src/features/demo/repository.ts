import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { applyCommand } from "./domain";
import { seed } from "./seed";
import { addDatasetQuestions } from "./datasetQuestions";
import { addDatasetBank } from "./datasetBank";
import { markKnownTestSessions } from "./testSessions";
import { DISTRICTS } from "./regions";

export const REGIONS_PACK = "districts-v2";
import type { User } from "../../lib/types";
import type { Command, DemoState } from "./types";
interface DemoDB extends DBSchema {
  state: { key: string; value: DemoState };
  blobs: { key: string; value: Blob };
}
export class DemoRepository {
  private database: Promise<IDBPDatabase<DemoDB>>;
  private listeners = new Set<(state: DemoState) => void>();
  constructor(name = "appdichthuat-review-demo-v1") {
    this.database = openDB<DemoDB>(name, 1, {
      upgrade(db) {
        db.createObjectStore("state");
        db.createObjectStore("blobs");
      },
    });
  }
  async load() {
    const db = await this.database;
    const tx = db.transaction("state", "readwrite");
    let state = await tx.store.get("main");
    if (!state) {
      state = seed();
      await tx.store.put(state, "main");
    } else if (!state.drafts || !state.models) {
      // These collections were added during schema v1's frontend rollout.
      state = {
        ...state,
        drafts: state.drafts ?? [],
        models: state.models ?? seed().models,
      };
      await tx.store.put(state, "main");
    }
    // The bank pack runs after the original three exams so it can retire them once.
    const legacyAdded = addDatasetQuestions(state);
    const packAdded = addDatasetBank(state) || legacyAdded;
    const testsMarked = markKnownTestSessions(state);
    // v2 adds the Quảng Nam units; old answers keep whatever region they were saved with.
    const regionsChanged = !state.installedPacks?.includes(REGIONS_PACK);
    if (regionsChanged) { state.regions = [...DISTRICTS]; state.installedPacks = [...(state.installedPacks ?? []), REGIONS_PACK]; }
    if (packAdded || testsMarked || regionsChanged) await tx.store.put(state, "main");
    await tx.done;
    return state;
  }
  subscribe(listener: (state: DemoState) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  async bindAccount(user: User | null) {
    const db = await this.database;
    const tx = db.transaction("state", "readwrite");
    const state = (await tx.store.get("main")) ?? seed();
    if (user) {
      const id = `account:${user.id}`;
      const previous = state.people.find((p) => p.id === id);
      const person = { id, name: user.full_name, role: user.role === "annotator" ? "contributor" as const : user.role, verified: previous?.verified ?? false, region: previous?.region ?? "", risk: previous?.risk ?? "clear" as const, appeal: previous?.appeal ?? "" };
      state.people = state.people.filter((p) => p.id !== id).concat(person);
      state.actor = id;
    } else state.actor = "guest";
    await tx.store.put(state, "main"); await tx.done;
    this.listeners.forEach((fn) => fn(state));
    return state;
  }
  async dispatch(command: Command, account?: User | null) {
    const db = await this.database;
    const tx = db.transaction("state", "readwrite");
    try {
      const previous = (await tx.store.get("main")) ?? seed();
      if (account) {
        const id = `account:${account.id}`;
        const person = previous.people.find((p) => p.id === id);
        if (!person) throw Error("Tài khoản chưa được khởi tạo trong kho. Vui lòng tải lại trang.");
        person.role = account.role === "annotator" ? "contributor" : account.role;
        previous.actor = id;
      }
      const state = applyCommand(previous ?? seed(), command);
      await tx.store.put(state, "main");
      await tx.done;
      this.listeners.forEach((fn) => fn(state));
      return state;
    } catch (error) {
      tx.abort();
      await tx.done.catch(() => {});
      throw error;
    }
  }
  /** Rewrites the stored state in one transaction (used to merge server snapshots). */
  async replace(update: (state: DemoState) => DemoState) {
    const db = await this.database;
    const tx = db.transaction("state", "readwrite");
    try {
      const state = update((await tx.store.get("main")) ?? seed());
      await tx.store.put(state, "main");
      await tx.done;
      this.listeners.forEach((fn) => fn(state));
      return state;
    } catch (error) {
      tx.abort();
      await tx.done.catch(() => {});
      throw error;
    }
  }
  async reset() {
    const db = await this.database;
    const tx = db.transaction(["state", "blobs"], "readwrite");
    const state = seed();
    await tx.objectStore("state").put(state, "main");
    await tx.objectStore("blobs").clear();
    await tx.done;
    this.listeners.forEach((fn) => fn(state));
  }
  async putBlob(id: string, blob: Blob) {
    const db = await this.database;
    await db.put("blobs", blob, id);
  }
  async getBlob(id: string) {
    return (await this.database).get("blobs", id);
  }
  async backup() {
    const state = await this.load();
    const db = await this.database;
    const media = [];
    for (const m of state.media) {
      const b = await db.get("blobs", m.id);
      if (b) {
        const bytes = new Uint8Array(await b.arrayBuffer());
        let binary = "";
        bytes.forEach((n) => {
          binary += String.fromCharCode(n);
        });
        media.push({ id: m.id, type: b.type, data: btoa(binary) });
      }
    }
    return { format: "APPDICHTHUAT_DEMO_BACKUP", version: 1, state, media };
  }
  async restore(input: unknown) {
    if (
      !input ||
      typeof input !== "object" ||
      !("format" in input) ||
      input.format !== "APPDICHTHUAT_DEMO_BACKUP"
    )
      throw Error("Không phải bản sao lưu demo.");
    const value = input as Awaited<ReturnType<DemoRepository["backup"]>>;
    const s = value.state;
    if (
      value.version !== 1 ||
      s?.schema !== 1 ||
      !Array.isArray(s.sessions) ||
      !Array.isArray(s.exams) ||
      !Array.isArray(s.people) ||
      !s.people.some((p) => p.id === s.actor) ||
      !Array.isArray(s.questions) ||
      !Array.isArray(s.contributions) ||
      !Array.isArray(value.media)
    )
      throw Error("Schema bản lưu không hợp lệ.");
    const tables = [
      "questions",
      "exams",
      "sessions",
      "contributions",
      "votes",
      "sources",
      "campaigns",
      "tasks",
      "events",
      "credits",
      "feedback",
      "jobs",
      "releases",
      "media",
      "drafts",
      "models",
      "regions",
      "topics",
    ] as const;
    if (tables.some((k) => !Array.isArray(s[k])))
      throw Error("Thiếu bảng demo.");
    if (
      s.sessions.some(
        (x) =>
          !x ||
          !Array.isArray(x.questions) ||
          !Array.isArray(x.answers) ||
          x.questions.length !== 10 ||
          x.answers.length !== 10 ||
          !x.exam ||
          !x.consent,
      )
    )
      throw Error("Lượt chơi thiếu vị trí.");
    if (
      s.contributions.some((x) => !x?.raw || !x?.consent) ||
      s.people.some((p) => !p?.id || !p?.role)
    )
      throw Error("Ứng viên hoặc người dùng trong bản lưu không hợp lệ.");
    const blobs = value.media.map((m) => {
      if (
        !m ||
        typeof m.id !== "string" ||
        typeof m.data !== "string" ||
        typeof m.type !== "string"
      )
        throw Error("Media bản lưu không hợp lệ.");
      const bytes = Uint8Array.from(atob(m.data), (c) => c.charCodeAt(0));
      return { id: m.id, blob: new Blob([bytes], { type: m.type }) };
    });
    const db = await this.database;
    const tx = db.transaction(["state", "blobs"], "readwrite");
    try {
      await tx.objectStore("blobs").clear();
      for (const m of blobs) {
        await tx.objectStore("blobs").put(m.blob, m.id);
      }
      await tx.objectStore("state").put(s, "main");
      await tx.done;
    } catch (error) {
      tx.abort();
      await tx.done.catch(() => {});
      throw error;
    }
    this.listeners.forEach((fn) => fn(s));
  }
}
let instance: DemoRepository | undefined = import.meta.hot?.data.repository;
if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    data.repository = instance;
  });
}
export const repository = (reopen = false) => {
  if (reopen) instance = undefined;
  return (instance ??= new DemoRepository());
};
