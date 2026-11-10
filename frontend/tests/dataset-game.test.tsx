import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { openDB } from "idb";
import { seed, consentDefault } from "../src/features/demo/seed";
import { applyCommand, blankAnswer, examErrors } from "../src/features/demo/domain";
import { DemoRepository, repository } from "../src/features/demo/repository";
import { questionErrors } from "../src/features/demo/questionFormats";
import { datasetPackId } from "../src/features/demo/datasetQuestions";
import { demoRoute } from "../src/features/demo/routes";

const consent = { ...consentDefault(), collect: true };
const ids = ["dataset1-daily", "dataset1-kitchen", "dataset1-context"];
afterEach(cleanup);
describe("dataset question pack", () => {
  it("hides exam selection, ignores requested exam IDs, and resumes an existing draft", async () => {
    await repository().reset();
    const router = createMemoryRouter([demoRoute], { initialEntries: ["/demo/play?exam=exam-demo"] });
    render(<RouterProvider router={router} />);
    await screen.findByRole("button", { name: "Bắt đầu chơi" }, { timeout: 10000 });
    expect(screen.queryByRole("combobox", { name: "Bộ đề 10 câu" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Tiếp nhận & kiểm duyệt/));
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu chơi" }));
    await screen.findByRole("heading", { name: "Q01 / 10" });
    const original = (await repository().load()).sessions[0];
    expect(original.exam.id).not.toBe("exam-demo");
    // Return through the public entry without triggering the intentional leave-game dialog.
    cleanup();
    const returnRouter = createMemoryRouter([demoRoute], { initialEntries: ["/demo/play"] });
    render(<RouterProvider router={returnRouter} />);
    fireEvent.click(await screen.findByRole("button", { name: "Tiếp tục chơi" }));
    await screen.findByRole("heading", { name: "Q01 / 10" });
    expect(returnRouter.state.location.pathname).toBe(`/demo/game/${original.id}`);
    expect((await repository().load()).sessions).toHaveLength(1);
  });
  it("validates all three signal/demo exams and blocks real publication", () => {
    const s = seed();
    for (const id of ids) {
      const e = s.exams.find((e) => e.id === id)!;
      expect(examErrors(s, e)).toEqual([]);
      expect(examErrors(s, e, true).length).toBeGreaterThan(0);
      expect(e.mode).toBe("signal");
      expect(e.questionIds).toHaveLength(10);
      const closed = e.questionIds.map((id) => s.questions.find((q) => q.id === id)!).filter((q) => q.format !== "open");
      expect(new Set(closed.map((q) => q.provenance!.sense)).size).toBe(closed.length);
    }
  });
  it("rejects incomplete, duplicate or conflicting options and bad blanks", () => {
    const q = seed().questions.find((q) => q.format === "choice")!;
    expect(questionErrors({ ...q, options: q.options!.slice(0, 3) }).length).toBeGreaterThan(0);
    expect(questionErrors({ ...q, correctOptionId: "missing" }).length).toBeGreaterThan(0);
    expect(questionErrors({ ...q, options: [q.options![0], q.options![0], ...q.options!.slice(2)] }).length).toBeGreaterThan(0);
    expect(questionErrors({ ...q, accepted: [q.options![1].text] }).length).toBeGreaterThan(0);
    expect(questionErrors({ ...q, format: "fill", blankTemplate: "___ và ___" }).length).toBeGreaterThan(0);
    const s = seed(); const e = structuredClone(s.exams.find((e) => e.id === ids[0])!);
    [e.questionIds[0], e.questionIds[3]] = [e.questionIds[3], e.questionIds[0]];
    expect(examErrors(s, e).length).toBeGreaterThan(0);
  });
  it("scores stable option IDs and Vietnamese variants while leaving open responses unscored", () => {
    const base = seed(); base.exams.find((e) => e.id === ids[0])!.status = "active";
    let s = applyCommand(base, { type: "start", id: "one", examId: ids[0], consent, campaignId: "" });
    const q = s.sessions[0].questions[0];
    s = applyCommand(s, { type: "answer", id: "one", index: 0, answer: { ...blankAnswer(), text: "not a grading key", selectedOptionId: q.correctOptionId }, next: 1 });
    expect(s.sessions[0].answers[0].attempts[0].correct).toBe(true);
    expect(s.sessions[0].answers[0].text).toBe(q.options!.find((o) => o.id === q.correctOptionId)!.text);
    s = applyCommand(s, { type: "answer", id: "one", index: 1, answer: { ...blankAnswer(), text: "  VỪA NÃY! " }, next: 2 });
    expect(s.sessions[0].answers[1].attempts[0].correct).toBe(true);
    s = applyCommand(s, { type: "answer", id: "one", index: 1, answer: { ...blankAnswer(), text: "vua nay" }, next: 2 });
    expect(s.sessions[0].answers[1].attempts.at(-1)!.correct).toBe(false);
    s = applyCommand(s, { type: "answer", id: "one", index: 3, answer: { ...blankAnswer(), text: "Cách hiểu riêng" }, next: 4 });
    expect(s.sessions[0].answers[3].attempts[0].correct).toBeNull();
    s = applyCommand(s, { type: "answer", id: "one", index: 7, answer: { ...blankAnswer(), skipped: true }, next: 8 });
    expect(s.sessions[0].answers[7].attempts[0].correct).toBeNull();
  });
  it("migrates an old store once without overwriting sessions or option order", async () => {
    const name = crypto.randomUUID(); const repo = new DemoRepository(name);
    await repo.load(); await repo.dispatch({ type: "start", id: "old", examId: "exam-demo", consent, campaignId: "" });
    const db = await openDB(name, 1); const old = await db.get("state", "main");
    old.questions = old.questions.filter((q: { id: string }) => !q.id.startsWith("dataset1-"));
    old.exams = old.exams.filter((e: { id: string }) => !e.id.startsWith("dataset1-")); delete old.installedPacks;
    await db.put("state", old, "main");
    const migrated = await repo.load(); expect(migrated.sessions).toEqual(old.sessions);
    expect(migrated.installedPacks).toContain(datasetPackId);
    expect((await repo.load()).exams).toHaveLength(migrated.exams.length);
    expect(migrated.exams.find((e) => e.id === ids[0])!.status).toBe("closed");
    await repo.dispatch({ type: "start", id: "new", examId: "dataset1-bank-01", consent, campaignId: "" });
    const snapshot = (await repo.load()).sessions.find((s) => s.id === "new")!;
    await repo.dispatch({ type: "draftAnswer", id: "new", index: 0, answer: { ...blankAnswer(), selectedOptionId: snapshot.questions[0].options![0].id, text: snapshot.questions[0].options![0].text } });
    const restored = await new DemoRepository(name).load();
    expect(restored.sessions.find((s) => s.id === "new")!.questions).toEqual(snapshot.questions);
    expect(restored.sessions.find((s) => s.id === "new")!.answers[0].selectedOptionId).toBe(snapshot.questions[0].options![0].id);
    db.close();
  });
  it.each([...ids, "dataset1-bank-01"])("completes every format and submits ten answers: %s", async (examId) => {
    await repository().reset();
    const db = await openDB("appdichthuat-review-demo-v1", 1); const state = await db.get("state", "main");
    state.exams.forEach((e: { id: string; status: string }) => { e.status = e.id === examId ? "active" : "closed"; });
    await db.put("state", state, "main"); db.close();
    const router = createMemoryRouter([demoRoute], { initialEntries: [`/demo/play?exam=${examId}`] });
    render(<RouterProvider router={router} />);
    await screen.findByRole("button", { name: "Bắt đầu chơi" }, { timeout: 10000 });
    fireEvent.click(screen.getByLabelText(/Tiếp nhận & kiểm duyệt/));
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu chơi" }));
    for (let i = 0; i < 10; i++) {
      await screen.findByRole("heading", { name: `Q${String(i + 1).padStart(2, "0")} / 10` });
      const session = (await repository().load()).sessions.at(-1)!; const q = session.questions[i];
      if (q.format === "choice") fireEvent.click(screen.getByRole("radio", { name: q.options![0].text }));
      else {
        const standardAnswer = q.format !== "choice";
        if (standardAnswer) expect(screen.queryByLabelText("Đáp án của bạn")).not.toBeInTheDocument();
        fireEvent.change(screen.getByLabelText("Cách nói phổ thông *"), { target: { value: q.accepted[0] ?? "Câu trả lời tự nhiên của tôi" } });
      }
      if (i >= 8) for (const label of ["Nghĩa bạn muốn giải thích *", "Cách nói phổ thông *", "Ví dụ / ngữ cảnh *"]) fireEvent.change(screen.getByLabelText(label), { target: { value: "Nội dung góp mới" } });
      await waitFor(() => expect(screen.getByRole("button", { name: "Lưu & tiếp tục" })).toBeEnabled());
      fireEvent.click(screen.getByRole("button", { name: "Lưu & tiếp tục" }));
    }
    await screen.findByRole("heading", { name: "Bạn thường nghe cách nói này ở đâu?" });
    for (const label of ["Nơi đang sống *", "Nơi lớn lên *"]) fireEvent.change(screen.getByLabelText(label), { target: { value: "Quận Hải Châu" } });
    fireEvent.click(screen.getByRole("button", { name: "Xem lại 10 câu" }));
    await screen.findByRole("button", { name: "Gửi kết quả 10 câu" });
    fireEvent.click(screen.getByRole("button", { name: "Gửi kết quả 10 câu" }));
    await screen.findByRole("heading", { name: "Cảm ơn bạn đã góp." });
    expect(screen.queryByRole("link", { name: "Dataset" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Chưa duyệt bản địa|Câu biên soạn\./)).not.toBeInTheDocument();
    expect(screen.getByText("Câu trả lời của bạn")).toBeInTheDocument();
    const session = (await repository().load()).sessions.at(-1)!;
    expect(session.state).toBe("submitted"); expect(session.answers).toHaveLength(10);
    expect(session.answers.every((a) => a.attempts.length === 1)).toBe(true);
    await repository().dispatch({ type: "actor", id: "admin" });
    await router.navigate(`/demo/admin/sessions/${session.id}`);
    await screen.findByRole("heading", { name: "Lượt chơi & từng câu trả lời" });
    expect(screen.getByRole("table")).toBeInTheDocument();
  }, 30000);
});
