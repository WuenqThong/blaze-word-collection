import { describe, it, expect } from "vitest";
import { DemoRepository } from "../src/features/demo/repository";
import { blankAnswer } from "../src/features/demo/domain";
import { openDB } from "idb";
describe("IndexedDB sandbox", () => {
  it("migrates early v1 collections without losing sessions or feedback", async () => {
    const name = crypto.randomUUID();
    const repo = new DemoRepository(name);
    await repo.load();
    await repo.dispatch({
      type: "feedback",
      entity: "keep",
      text: "Giữ dữ liệu",
    });
    const db = await openDB(name, 1);
    const early = await db.get("state", "main");
    delete early.drafts;
    delete early.models;
    await db.put("state", early, "main");
    const migrated = await repo.load();
    expect(migrated.feedback).toHaveLength(1);
    expect(migrated.drafts).toEqual([]);
    expect(migrated.models.length).toBeGreaterThan(0);
  });
  it("rejects corrupt tables and media before modifying existing state or blobs", async () => {
    const repo = new DemoRepository(crypto.randomUUID());
    await repo.load();
    await repo.dispatch({
      type: "feedback",
      entity: "keep",
      text: "Không xóa",
    });
    await repo.putBlob("keep", new Blob(["keep"], { type: "text/plain" }));
    const backup = await repo.backup();
    const bad = structuredClone(backup);
    Object.assign(bad.state, { models: null });
    await expect(repo.restore(bad)).rejects.toThrow();
    await expect(
      repo.restore({
        ...backup,
        media: [{ id: "bad", type: "audio/webm", data: "%%%" }],
      }),
    ).rejects.toThrow();
    expect((await repo.load()).feedback).toHaveLength(1);
    expect((await repo.getBlob("keep"))?.size).toBe(4);
  });
  it("restores draft progress and snapshots after a new repository instance", async () => {
    const name = crypto.randomUUID();
    const repo = new DemoRepository(name);
    await repo.load();
    await repo.dispatch({
      type: "start",
      id: "persisted",
      examId: "exam-demo",
      campaignId: "",
      consent: {
        collect: true,
        train: false,
        public: false,
        audio: false,
        version: "v1",
      },
    });
    await repo.dispatch({
      type: "draftAnswer",
      id: "persisted",
      index: 0,
      answer: { ...blankAnswer(), text: "Nội dung chưa chuyển câu" },
    });
    const restored = await new DemoRepository(name).load();
    expect(restored.sessions[0].answers[0].text).toBe(
      "Nội dung chưa chuyển câu",
    );
    expect(restored.sessions[0].answers[0].attempts).toHaveLength(0);
  });
  it("serializes concurrent saves and backup restore is isolated", async () => {
    const repo = new DemoRepository(crypto.randomUUID());
    await repo.load();
    await Promise.all([
      repo.dispatch({ type: "feedback", entity: "one", text: "A" }),
      repo.dispatch({ type: "feedback", entity: "two", text: "B" }),
    ]);
    expect((await repo.load()).feedback).toHaveLength(2);
    const backup = await repo.backup();
    await repo.reset();
    expect((await repo.load()).feedback).toHaveLength(0);
    await repo.restore(backup);
    expect((await repo.load()).feedback).toHaveLength(2);
    await expect(repo.restore({ format: "not-demo" })).rejects.toThrow();
    expect((await repo.load()).feedback).toHaveLength(2);
  });
});
