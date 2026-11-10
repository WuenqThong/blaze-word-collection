import type {
  Answer,
  Command,
  Contribution,
  DemoState,
  Exam,
  Raw,
  Session,
} from "./types";
import { blankRaw, examKinds, gateCount } from "./seed";
import { questionErrors, shuffleOptions } from "./questionFormats";
import { isTestSession } from "./testSessions";
import { REGION_CHOICES } from "./regions";
export const uid = () => crypto.randomUUID();
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
export const normalize = (s: string) =>
  s
    .normalize("NFC")
    .trim()
    .toLocaleLowerCase("vi")
    .replace(/[.!?,;:]+$/, "")
    .replace(/\s+/g, " ");
export const searchKey = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/g, "d")
    .toLowerCase();
export const blankAnswer = (): Answer => ({
  text: "",
  meaning: "",
  standard: "",
  context: "",
  skipped: false,
  attempts: [],
  suggestion: "",
  updatedAt: new Date().toISOString(),
});
export function examErrors(s: DemoState, e: Exam, real = false) {
  const errors: string[] = [];
  if (e.questionIds.length !== 10 || new Set(e.questionIds).size !== 10)
    errors.push("Đề cần đúng 10 câu khác nhau.");
  e.questionIds.forEach((id, i) => {
    const q = s.questions.find((q) => q.id === id);
    if (q) errors.push(...questionErrors(q).map((message) => `Q${i + 1}: ${message}`));
    if (!q || q.kind !== examKinds(e)[i])
      errors.push(`Vị trí Q${String(i + 1).padStart(2, "0")} sai loại câu.`);
    if (
      q &&
      q.format !== "choice" &&
      ["GATE", "GOLD"].includes(q.kind) &&
      !q.accepted.some((a) => a.trim())
    )
      errors.push(`Q${i + 1} cần đáp án/biến thể.`);
    if (q && (!q.prompt.trim() || q.approval === "DRAFT"))
      errors.push(`Q${i + 1} chưa đủ nội dung/duyệt.`);
    const source = s.sources.find((x) => x.id === q?.sourceId);
    if (
      real &&
      (!q ||
        q.demo ||
        (q.provenance && q.provenance.verification !== "verified") ||
        q.approval !== "VERIFIED" ||
        source?.demo ||
        !source?.train)
    )
      errors.push(`Q${i + 1} chưa đủ điều kiện thu thật.`);
  });
  return errors;
}
export function canAdvance(session: Session, index: number) {
  return (
    session.exam.mode !== "strict" ||
    index < gateCount(session.exam) ||
    session.answers
      .slice(0, gateCount(session.exam))
      .every(
        (a) =>
          !a.skipped && isAnswered(a) && a.attempts.at(-1)?.correct === true,
      )
  );
}
export function isAnswered(a: Answer) {
  const last = a.attempts.at(-1);
  return (
    !!last &&
    (a.skipped || !!a.text.trim()) &&
    normalize(last.text) === normalize(a.text)
    && last.selectedOptionId === a.selectedOptionId
  );
}
export function publiclyVisible(s: DemoState, c: Contribution) {
  return (
    !c.duplicateOf &&
    c.status === "VERIFIED" &&
    !!c.curated &&
    !c.withdrawn &&
    c.raw.response === "answer" &&
    c.consent.collect &&
    c.consent.public &&
    s.sources.some((source) => source.id === c.sourceId && source.public)
  );
}
export function eligible(s: DemoState, c: Contribution) {
  const source = s.sources.find((x) => x.id === c.sourceId);
  const audio = c.raw.mediaIds.some(
    (id) => s.media.find((m) => m.id === id)?.kind === "audio",
  );
  return (
    !c.duplicateOf &&
    c.status === "VERIFIED" &&
    !!c.curated &&
    [
      c.curated.text,
      c.curated.meaning,
      c.curated.standard,
      c.curated.context,
    ].every((v) => v.trim()) &&
    c.raw.response === "answer" &&
    !c.withdrawn &&
    c.consent.collect &&
    c.consent.train &&
    source?.train === true &&
    (!audio || (c.consent.audio && source.audio && c.qaAudio === "pass")) &&
    s.votes.filter((v) => v.contributionId === c.id).length >= 2 &&
    !s.contributions.some(
      (x) => x.parent === c.id && x.status === "VERIFIED" && !x.withdrawn,
    )
  );
}
export function exclusionReasons(s: DemoState, c: Contribution) {
  return [
    c.duplicateOf ? `Trùng mẫu ${c.duplicateOf}` : null,
    c.status !== "VERIFIED" ? "Chưa xác minh" : null,
    !c.curated ? "Chưa chuẩn hóa" : null,
    c.curated &&
    ![
      c.curated.text,
      c.curated.meaning,
      c.curated.standard,
      c.curated.context,
    ].every((v) => v.trim())
      ? "Bản chuẩn hóa thiếu thông tin"
      : null,
    c.raw.response !== "answer"
      ? "Phản hồi không phải mục từ khẳng định"
      : null,
    c.raw.mediaIds.some(
      (id) => s.media.find((m) => m.id === id)?.kind === "audio",
    ) &&
    (!c.consent.audio ||
      !s.sources.find((x) => x.id === c.sourceId)?.audio ||
      c.qaAudio !== "pass")
      ? "Audio chưa đủ quyền/QA"
      : null,
    c.withdrawn ? "Đã rút" : null,
    !c.consent.collect || !c.consent.train ? "Thiếu đồng ý sử dụng" : null,
    !s.sources.find((x) => x.id === c.sourceId)?.train
      ? "Thiếu quyền nguồn"
      : null,
    s.votes.filter((v) => v.contributionId === c.id).length < 2
      ? "Thiếu phiếu"
      : null,
    s.contributions.some(
      (x) => x.parent === c.id && x.status === "VERIFIED" && !x.withdrawn,
    )
      ? "Đã có bản thay thế được duyệt"
      : null,
  ].filter(Boolean) as string[];
}
export function duplicates(s: DemoState, r: Raw, ignore?: string) {
  return s.contributions.filter(
    (c) =>
      c.id !== ignore &&
      !c.withdrawn &&
      normalize(c.raw.text) === normalize(r.text) &&
      normalize(c.raw.meaning) === normalize(r.meaning) &&
      c.raw.region === r.region,
  );
}
export function gameAllocation(s: DemoState, owner: string, campaignId = "", preferred?: string) {
  const campaign = campaignId ? s.campaigns.find((c) => c.id === campaignId) : undefined;
  if (campaignId && !campaign?.active) throw Error("Chiến dịch không tồn tại hoặc đã tắt.");
  const actor = s.people.find((p) => p.id === owner);
  let pool = s.exams.filter((e) => e.status === "active" && !examErrors(s, e).length && (!campaign || campaign.examIds.includes(e.id)) && (campaign?.mode !== "cross_region" || e.region !== actor?.region));
  // The original fixture stays available for internal previews; public play uses the new collection.
  if (!campaign && pool.some((e) => e.id !== "exam-demo")) pool = pool.filter((e) => e.id !== "exam-demo");
  const pending = s.sessions.find((x) => !isTestSession(x) && x.owner === owner && x.state === "playing" && (!campaignId || x.campaignId === campaignId));
  const completed = s.sessions.filter((x) => !isTestSession(x) && x.owner === owner && !!x.submittedAt);
  const unplayed = pool.filter((e) => !completed.some((x) => x.exam.id === e.id));
  const candidates = unplayed.length ? unplayed : pool;
  const count = (id: string) => s.sessions.filter((x) => !isTestSession(x) && x.exam.id === id && x.state !== "withdrawn").length;
  candidates.sort((a, b) => count(a.id) - count(b.id) || a.id.localeCompare(b.id));
  // The server balances across every account; trust its pick while it is still runnable here.
  const chosen = pool.find((e) => e.id === preferred);
  const played = [...new Set(completed.map((x) => x.exam.id))];
  if (chosen) return { pending, exam: chosen, repeat: played.includes(chosen.id), pool, played };
  return { pending, exam: candidates[0], repeat: !unplayed.length && pool.length > 0, pool, played };
}
export function isRepeatSession(s: DemoState, session: Session) {
  return session.repeat ?? s.sessions.some((x) => !isTestSession(x) && x.id !== session.id && x.owner === session.owner && x.exam.id === session.exam.id && !!x.submittedAt && x.submittedAt <= session.createdAt);
}
export function applyCommand(input: DemoState, command: Command): DemoState {
  const s = structuredClone(input);
  s.drafts ??= [];
  const actor = s.people.find((p) => p.id === s.actor)!;
  const now = new Date().toISOString();
  const assert = (ok: unknown, message: string) => {
    if (!ok) throw Error(message);
  };
  const admin = () =>
    assert(actor.role === "admin", "Cần vai trò quản trị trong demo.");
  const review = () =>
    assert(
      ["admin", "reviewer"].includes(actor.role),
      "Cần vai trò reviewer/admin.",
    );
  const contribution = (id: string) => {
    const c = s.contributions.find((c) => c.id === id);
    assert(c, "Không tìm thấy mẫu.");
    return c!;
  };
  const session = (id: string) => {
    const x = s.sessions.find((x) => x.id === id);
    assert(x, "Không tìm thấy lượt chơi.");
    assert(
      x!.owner === actor.id || actor.role === "admin",
      "Lượt chơi không thuộc vai trò hiện tại.",
    );
    return x!;
  };
  const audit = (action: string, entity: string, note: string) =>
    s.events.push({
      id: uid(),
      actor: actor.id,
      action,
      entity,
      note,
      at: now,
    });
  if (s.simulate === "offline" && !["simulate", "actor"].includes(command.type))
    throw Error(
      "Mô phỏng mất mạng: chưa lưu. Tắt lỗi rồi thử lại; dữ liệu đã lưu trước đó được giữ.",
    );
  if (
    s.simulate === "spam" &&
    ["start", "submit", "contribute"].includes(command.type)
  )
    throw Error(
      "Mô phỏng giới hạn lượt: tạm giữ yêu cầu. Hãy tắt kịch bản spam để thử lại.",
    );
  switch (command.type) {
    case "actor":
      assert(
        s.people.some((p) => p.id === command.id),
        "Vai trò không tồn tại.",
      );
      s.actor = command.id;
      break;
    case "register": {
      assert(command.name.trim(), "Cần tên hiển thị demo.");
      const id = uid();
      s.people.push({
        id,
        name: command.name,
        role: "contributor",
        verified: false,
        region: command.region,
        risk: "clear",
        appeal: "",
      });
      s.actor = id;
      audit("REGISTER", id, "Tài khoản demo, không được tặng credit.");
      break;
    }
    case "appeal":
      assert(command.text.trim(), "Cần lý do khiếu nại.");
      actor.appeal = command.text;
      s.feedback.push({
        id: uid(),
        owner: actor.id,
        entity: `risk:${actor.id}`,
        text: command.text,
        state: "open",
      });
      audit("APPEAL", actor.id, command.text);
      break;
    case "model":
      admin();
      assert(
        !s.models.some((m) => m.id === command.model.id),
        "Phiên bản model đã có; tạo ID mới.",
      );
      s.models.push(command.model);
      audit("MODEL_VERSION", command.model.id, command.model.notes);
      break;
    case "simulate":
      s.simulate = command.value;
      break;
    case "autoStart":
    case "start": {
      if (s.sessions.some((x) => x.id === command.id)) break;
      const allocation = command.type === "autoStart" ? gameAllocation(s, actor.id, command.campaignId, command.examId) : undefined;
      if (allocation?.pending) break;
      const e = command.type === "start" ? s.exams.find((e) => e.id === command.examId) : allocation?.exam;
      assert(e?.status === "active", "Bộ đề chưa mở hoặc đã đóng.");
      assert(command.consent.collect, "Cần đồng ý tiếp nhận.");
      assert(!examErrors(s, e!).length, "Bộ đề chưa đủ 10 vị trí hợp lệ.");
      const campaign = s.campaigns.find((c) => c.id === command.campaignId);
      if (command.campaignId)
        assert(
          campaign?.active && campaign.examIds.includes(e!.id),
          "Chiến dịch không mở bộ đề này.",
        );
      const history = s.sessions.filter((x) => x.owner === actor.id);
      const prior = history.flatMap((x) =>
        x.answers.flatMap((a) => a.attempts.filter((t) => t.correct !== null)),
      );
      const target =
        prior.length &&
        prior.filter((t) => t.correct).length / prior.length >= 0.8
          ? 2
          : 1;
      const used = new Set<string>();
      const ids = e!.questionIds.map((id) => {
        const original = s.questions.find((q) => q.id === id)!;
        let q = original;
        if (e!.adaptive || campaign?.mode === "adaptive") {
          const pool = s.questions.filter(
            (x) =>
              x.kind === original.kind &&
              x.region === e!.region &&
              x.approval !== "DRAFT" &&
              x.demo === e!.demo &&
              !used.has(x.id),
          );
          pool.sort(
            (a, b) =>
              Math.abs(a.difficulty - target) -
                Math.abs(b.difficulty - target) ||
              Number(
                history.some((h) => h.questions.some((x) => x.id === a.id)),
              ) -
                Number(
                  history.some((h) => h.questions.some((x) => x.id === b.id)),
                ),
          );
          q = pool[0] ?? original;
        } else if (e!.layout === "sourced2" && original.kind === "GATE") {
          // Q1–Q2 rotate through the whole sourced bank, unseen items first.
          const seen = new Set(history.flatMap((h) => h.questions.map((x) => x.id)));
          const pool = s.questions.filter(
            (x) =>
              x.kind === "GATE" &&
              x.format === original.format &&
              x.provenance?.verification === "sourced" &&
              x.approval !== "DRAFT" &&
              x.demo === e!.demo &&
              !used.has(x.id) &&
              !questionErrors(x).length,
          );
          pool.sort((a, b) => Number(seen.has(a.id)) - Number(seen.has(b.id)) || hash(command.id + a.id) - hash(command.id + b.id));
          q = pool[0] ?? original;
        } else if (!original.format && ["GATE", "GOLD"].includes(original.kind)) {
          const pool = e!.questionIds
            .map((id) => s.questions.find((q) => q.id === id)!)
            .filter((x) => x.kind === original.kind);
          const rotated = [
            ...pool.slice(history.length % pool.length),
            ...pool.slice(0, history.length % pool.length),
          ];
          q = rotated.find((x) => !used.has(x.id)) ?? original;
        }
        used.add(q.id);
        return q.id;
      });
      s.sessions.push({
        repeat: s.sessions.some((x) => !isTestSession(x) && x.owner === actor.id && x.exam.id === e!.id && !!x.submittedAt),
        id: command.id,
        owner: actor.id,
        recovery: uid(),
        exam: { ...structuredClone(e!), questionIds: ids },
        questions: ids.map((id) =>
          shuffleOptions(s.questions.find((q) => q.id === id)!),
        ),
        answers: Array.from({ length: 10 }, blankAnswer),
        cursor: 0,
        consent: command.consent,
        region: "",
        upbringing: "",
        usage: "",
        state: "playing",
        createdAt: now,
        submittedAt: null,
        campaignId: command.campaignId,
      });
      audit("START_GAME", command.id, "Phiên demo, snapshot đề đã lưu.");
      break;
    }
    case "answer": {
      const x = session(command.id);
      assert(x.state === "playing", "Lượt đã gửi/rút; không sửa RAW.");
      assert(command.index >= 0 && command.index < 10, "Vị trí không hợp lệ.");
      assert(canAdvance(x, command.index), "Cần đạt 3/3 trước Q04.");
      const a = structuredClone(command.answer);
      assert(a.skipped || a.text.trim(), "Nhập đáp án hoặc chọn bỏ qua.");
      assert(
        a.skipped ||
          command.index < 8 ||
          [a.meaning, a.standard, a.context].every((v) => v.trim()),
        "Câu đóng góp mới cần nghĩa, bản phổ thông và ngữ cảnh.",
      );
      const q = x.questions[command.index];
      if (!a.skipped && q.format === "choice") {
        const option = q.options?.find((o) => o.id === a.selectedOptionId);
        assert(option, "Hãy chọn một phương án hợp lệ.");
        a.text = option!.text;
      }
      a.attempts = [
        ...x.answers[command.index].attempts,
        {
          text: a.text,
          selectedOptionId: a.selectedOptionId,
          correct: a.skipped
            ? null
            : q.format === "choice"
              ? a.selectedOptionId === q.correctOptionId
              : q.format === "open" ? null
              : ["GATE", "GOLD"].includes(q.kind)
              ? q.accepted.some((v) => normalize(v) === normalize(a.text))
              : null,
          at: now,
        },
      ];
      a.updatedAt = now;
      x.answers[command.index] = a;
      assert(
        command.next >= 0 && command.next <= 12,
        "Vị trí tiếp theo không hợp lệ.",
      );
      x.cursor = canAdvance(x, command.next) ? command.next : command.index;
      break;
    }
    case "draftAnswer": {
      const x = session(command.id);
      assert(
        x.state === "playing" &&
          command.index >= 0 &&
          command.index < 10 &&
          canAdvance(x, command.index),
        "Không thể sửa vị trí này.",
      );
      x.answers[command.index] = {
        ...command.answer,
        attempts: x.answers[command.index].attempts,
        updatedAt: now,
      };
      break;
    }
    case "moveSession": {
      const x = session(command.id);
      assert(
        x.state === "playing" &&
          command.cursor >= 0 &&
          command.cursor <= 11 &&
          canAdvance(x, command.cursor),
        "Chưa mở bước này.",
      );
      x.cursor = command.cursor;
      break;
    }
    case "sessionMeta": {
      const x = session(command.id);
      assert(x.state === "playing", "Lượt đã gửi.");
      if (x.owner.startsWith("account:")) assert([command.region, command.upbringing, command.usage].every((v) => !v || REGION_CHOICES.includes(v)), "Chọn quận/huyện trong danh sách, hoặc “Không chắc / nhiều nơi”.");
      x.region = command.region;
      x.upbringing = command.upbringing;
      x.usage = command.usage;
      break;
    }
    case "submit": {
      const x = session(command.id);
      if (x.state === "submitted") break;
      assert(x.state === "playing", "Lượt đã rút.");
      if (x.owner.startsWith("account:")) assert([command.region, command.upbringing].every((v) => REGION_CHOICES.includes(v)), "Chọn nơi đang sống và nơi lớn lên trong danh sách, hoặc “Không chắc / nhiều nơi”.");
      assert(canAdvance(x, 10), "Chưa đạt điều kiện 3/3.");
      assert(
        x.answers.every(
          (a, i) =>
            isAnswered(a) &&
            (a.skipped ||
              i < 8 ||
              [a.meaning, a.standard, a.context].every((v) => v.trim())),
        ),
        "Cần trả lời hoặc đánh dấu bỏ qua đủ 10 câu.",
      );
      assert(
        command.region.trim() && command.upbringing.trim(),
        "Chọn nơi đang sống và nơi lớn lên, hoặc “Không chắc / nhiều nơi”.",
      );
      x.region = command.region;
      x.upbringing = command.upbringing;
      x.usage = command.usage;
      x.state = "submitted";
      x.submittedAt = now;
      x.cursor = 12;
      x.answers.forEach((a, i) => {
        if (a.skipped || ["GATE", "GOLD"].includes(x.questions[i].kind)) return;
        const r = {
          ...blankRaw(),
          kind: ["SENTENCE", "OPEN_SENTENCE"].includes(x.questions[i].kind) ? ("sentence" as const) : ("word" as const),
          text: a.text,
          meaning: a.meaning,
          standard: a.standard,
          context: a.context,
          region: x.region,
          topic: x.questions[i].topic,
          evidence: `Đề ${x.exam.title} v${x.exam.version} / Q${i + 1}${x.questions[i].provenance?.rowId ? ` · Dataset1 ${x.questions[i].provenance!.rowId} (${x.questions[i].provenance!.verification === "unverified" ? "chưa kiểm chứng" : "có nguồn"})` : ""}`,
          method: "game",
          family: `${x.exam.id}:q${i + 1}`,
        };
        const duplicate = s.contributions.find((c) => !c.withdrawn && !c.duplicateOf && c.raw.kind === r.kind && (["text", "meaning", "standard", "context", "region"] as const).every((key) => normalize(c.raw[key]) === normalize(r[key])));
        s.contributions.push({
          duplicateOf: duplicate?.id,
          id: `${x.id}:q${i + 1}`,
          owner: x.owner,
          sessionId: x.id,
          parent: null,
          raw: r,
          consent: structuredClone(x.consent),
          sourceId: x.questions[i].sourceId,
          status: duplicate ? "HOLD" : "RAW",
          createdAt: now,
          withdrawn: false,
          curated: null,
          senseId: null,
          qaAudio: "",
        });
      });
      audit(
        "SUBMIT_GAME",
        x.id,
        "Đã lưu 10 câu và RAW mở. Không tự cấp credit.",
      );
      break;
    }
    case "withdrawSession": {
      const x = session(command.id);
      x.state = "withdrawn";
      s.contributions
        .filter((c) => c.sessionId === x.id)
        .forEach((c) => {
          c.withdrawn = true;
        });
      audit("WITHDRAW_SESSION", x.id, "Đã rút các mẫu của lượt.");
      break;
    }
    case "claim": {
      assert(
        actor.role !== "guest",
        "Chuyển sang tài khoản demo trước khi nhận lượt.",
      );
      const x = s.sessions.find(
        (x) => x.id === command.id && x.recovery === command.code,
      );
      assert(x, "Mã khôi phục không đúng.");
      assert(x!.owner === "guest", "Lượt đã gắn tài khoản.");
      x!.owner = actor.id;
      s.contributions
        .filter((c) => c.sessionId === x!.id)
        .forEach((c) => {
          c.owner = actor.id;
        });
      audit("CLAIM", x!.id, "Gắn tài khoản demo.");
      break;
    }
    case "contribute": {
      if (s.contributions.some((c) => c.id === command.id)) break;
      assert(command.consent.collect, "Cần đồng ý tiếp nhận.");
      assert(
        command.raw.response !== "answer" ||
          [
            command.raw.text,
            command.raw.meaning,
            command.raw.standard,
            command.raw.context,
            command.raw.evidence,
          ].every((v) => v.trim()),
        "Thiếu nội dung, nghĩa, bản phổ thông, ngữ cảnh hoặc nguồn.",
      );
      if (command.parent) {
        const parent = contribution(command.parent);
        assert(
          parent.owner === actor.id && !parent.withdrawn,
          "Không thể bổ sung mẫu này.",
        );
      }
      let sourceId = command.sourceId;
      if (!sourceId) {
        sourceId = uid();
        s.sources.push({
          id: sourceId,
          title: "Nguồn người góp",
          evidence: command.raw.evidence,
          train: false,
          public: false,
          audio: false,
          demo: true,
        });
      }
      s.contributions.push({
        id: command.id,
        owner: actor.id,
        sessionId: null,
        parent: command.parent,
        raw: command.raw,
        consent: command.consent,
        sourceId,
        status: "RAW",
        createdAt: now,
        withdrawn: false,
        curated: null,
        senseId: null,
        qaAudio: "",
      });
      audit("CONTRIBUTE", command.id, "RAW giữ nguyên.");
      break;
    }
    case "consent": {
      const c = contribution(command.id);
      assert(
        c.owner === actor.id || actor.role === "admin",
        "Không có quyền quản lý mẫu.",
      );
      c.consent = command.consent;
      c.withdrawn = command.withdraw;
      audit(
        "CONSENT",
        c.id,
        JSON.stringify(command.consent) +
          (command.withdraw ? " / rút mẫu" : ""),
      );
      break;
    }
    case "vote": {
      review();
      const c = contribution(command.id);
      assert(!c.duplicateOf, "Mẫu trùng không thuộc hàng chờ duyệt mới.");
      assert(c.owner !== actor.id, "Không tự duyệt.");
      assert(
        actor.role === "admin" || actor.region === c.raw.region,
        "Ngoài phạm vi vùng reviewer.",
      );
      assert(
        !c.withdrawn && ["RAW", "REVIEW"].includes(c.status),
        "Mẫu không còn ở hàng chờ.",
      );
      assert(
        !s.votes.some(
          (v) => v.contributionId === c.id && v.reviewer === actor.id,
        ),
        "Mỗi người chỉ gửi một phiếu trong vòng này.",
      );
      assert(command.note.trim(), "Cần lý do.");
      assert(
        command.verdict !== "VERIFIED" ||
          (command.checks.length === 4 && command.checks.every(Boolean)),
        "Cần đạt đủ bốn tiêu chí.",
      );
      s.votes.push({
        id: uid(),
        contributionId: c.id,
        reviewer: actor.id,
        verdict: command.verdict,
        checks: command.checks,
        note: command.note,
        at: now,
      });
      const votes = s.votes.filter((v) => v.contributionId === c.id);
      c.status =
        votes.length >= 2 && new Set(votes.map((v) => v.verdict)).size === 1
          ? votes[0].verdict
          : "REVIEW";
      audit("VOTE", c.id, "Đã lưu phiếu độc lập.");
      break;
    }
    case "decide": {
      admin();
      const c = contribution(command.id);
      const votes = s.votes.filter((v) => v.contributionId === c.id);
      assert(
        c.owner !== actor.id && !votes.some((v) => v.reviewer === actor.id),
        "Điều phối viên phải độc lập.",
      );
      assert(
        c.status === "REVIEW" && !c.withdrawn && votes.length >= 2,
        "Cần ít nhất hai phiếu và bất đồng.",
      );
      assert(command.note.trim(), "Cần lý do.");
      c.status = command.verdict;
      audit("DECIDE", c.id, command.note);
      break;
    }
    case "curate": {
      review();
      const c = contribution(command.id);
      assert(
        c.status === "VERIFIED" && !c.withdrawn,
        "Chuẩn hóa sau khi xác minh.",
      );
      c.curated = command.raw;
      c.senseId = command.senseId;
      c.qaAudio = command.qaAudio;
      audit("CURATE", c.id, "Lưu bản chuẩn hóa; không sửa RAW.");
      break;
    }
    case "question": {
      admin();
      assert(command.question.prompt.trim(), "Cần nội dung câu.");
      assert(!questionErrors(command.question).length, questionErrors(command.question).join(" "));
      const old = s.questions.find((q) => q.id === command.question.id);
      assert(
        !old ||
          !s.exams.some(
            (e) => e.status !== "draft" && e.questionIds.includes(old.id),
          ),
        "Câu đã phát hành: nhân bản để sửa.",
      );
      s.questions = s.questions
        .filter((q) => q.id !== command.question.id)
        .concat(command.question);
      audit(
        "QUESTION",
        command.question.id,
        JSON.stringify({ before: old ?? null, after: command.question }),
      );
      break;
    }
    case "exam": {
      admin();
      const old = s.exams.find((e) => e.id === command.exam.id);
      assert(
        !s.exams.some((e) => e.id === command.exam.id && e.status !== "draft"),
        "Đề đã phát hành: tạo phiên bản mới.",
      );
      s.exams = s.exams
        .filter((e) => e.id !== command.exam.id)
        .concat({ ...command.exam, status: "draft" });
      audit(
        "EXAM",
        command.exam.id,
        JSON.stringify({
          before: old ?? null,
          after: { ...command.exam, status: "draft" },
        }),
      );
      break;
    }
    case "publish": {
      admin();
      const e = s.exams.find((e) => e.id === command.id);
      assert(e, "Không tìm thấy đề.");
      const errors = examErrors(s, e!, command.real);
      assert(!errors.length, errors.join(" "));
      e!.status = "active";
      e!.demo = !command.real;
      audit("PUBLISH", e!.id, command.real ? "Thu thật" : "Chỉ demo");
      break;
    }
    case "closeExam": {
      admin();
      const e = s.exams.find((e) => e.id === command.id);
      assert(e, "Không tìm thấy đề.");
      e!.status = "closed";
      audit("CLOSE_EXAM", e!.id, "Phiên đang làm giữ snapshot.");
      break;
    }
    case "source":
      admin();
      s.sources = s.sources
        .filter((x) => x.id !== command.source.id)
        .concat(command.source);
      audit("SOURCE", command.source.id, JSON.stringify(command.source));
      break;
    case "campaign":
      admin();
      assert(command.campaign.examIds.length, "Chọn ít nhất một đề.");
      s.campaigns = s.campaigns
        .filter((x) => x.id !== command.campaign.id)
        .concat(command.campaign);
      audit("CAMPAIGN", command.campaign.id, command.campaign.title);
      break;
    case "task":
      admin();
      s.tasks = s.tasks
        .filter((x) => x.id !== command.task.id)
        .concat(command.task);
      audit("TASK", command.task.id, command.task.method);
      break;
    case "person":
      admin();
      assert(
        command.person.id !== "admin" || command.person.role === "admin",
        "Không thu hồi quản trị mẫu.",
      );
      s.people = s.people
        .filter((x) => x.id !== command.person.id)
        .concat(command.person);
      audit("PERSON", command.person.id, JSON.stringify(command.person));
      break;
    case "taxonomy":
      admin();
      s.regions = command.regions.filter(Boolean);
      s.topics = command.topics.filter(Boolean);
      audit("TAXONOMY", "taxonomy", "Cập nhật vùng/chủ đề.");
      break;
    case "feedback":
      assert(command.text.trim(), "Cần nội dung phản hồi.");
      s.feedback.push({
        id: uid(),
        owner: actor.id,
        entity: command.entity,
        text: command.text,
        state: "open",
      });
      audit("FEEDBACK", command.entity, command.text);
      break;
    case "resolve":
      review();
      {
        const f = s.feedback.find((f) => f.id === command.id);
        assert(f, "Không tìm thấy phản hồi.");
        f!.state = "resolved";
      }
      break;
    case "rewardPolicy":
      admin();
      s.rewardEnabled = command.enabled;
      audit("REWARD_POLICY", "policy", String(command.enabled));
      break;
    case "grant": {
      admin();
      assert(s.rewardEnabled, "Chưa duyệt cơ chế hạn mức demo.");
      const p = s.people.find((p) => p.id === command.owner);
      const c = contribution(command.contributionId);
      assert(
        p?.verified && p.role !== "guest" && p.risk === "clear",
        "Tài khoản chưa xác nhận hoặc đang rà soát.",
      );
      assert(
        c.owner === p!.id &&
          eligible(s, c) &&
          !duplicates(s, c.raw, c.id).length,
        "Mẫu chưa đủ QA/quyền hoặc trùng.",
      );
      assert(
        !s.credits.some((x) => x.contributionId === c.id),
        "Mẫu đã được cấp.",
      );
      assert(
        s.credits.filter(
          (x) => x.owner === p!.id && x.at.slice(0, 10) === now.slice(0, 10),
        ).length < 4,
        "Đạt hạn mức cấp trong ngày.",
      );
      s.credits.push({
        id: uid(),
        owner: p!.id,
        contributionId: c.id,
        amount: 5,
        used: 0,
        expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        revoked: false,
        at: now,
      });
      audit("GRANT", p!.id, "Cấp 5 lượt AI nội bộ demo; không chuyển nhượng.");
      break;
    }
    case "revoke":
      admin();
      {
        const c = s.credits.find((c) => c.id === command.id);
        assert(c, "Không tìm thấy hạn mức.");
        c!.revoked = true;
        audit("REVOKE", c!.id, "Thu hồi hạn mức.");
      }
      break;
    case "spend": {
      assert(command.owner === actor.id, "Không dùng hạn mức của người khác.");
      let left = command.amount;
      assert(left > 0, "Số lượt không hợp lệ.");
      const credits = s.credits.filter(
        (c) =>
          c.owner === actor.id &&
          !c.revoked &&
          c.expiresAt > now &&
          s.contributions.some(
            (x) => x.id === c.contributionId && eligible(s, x),
          ),
      );
      assert(
        credits.reduce((n, c) => n + c.amount - c.used, 0) >= left,
        "Chưa đủ hạn mức AI nội bộ.",
      );
      for (const c of credits) {
        const n = Math.min(left, c.amount - c.used);
        c.used += n;
        left -= n;
      }
      audit("USE_CREDIT", actor.id, String(command.amount));
      break;
    }
    case "job":
      admin();
      s.jobs = s.jobs
        .filter((j) => j.id !== command.job.id)
        .concat(command.job);
      audit("JOB", command.job.id, command.job.status);
      break;
    case "release":
      admin();
      assert(
        command.release.ids.length &&
          command.release.ids.every((id) => {
            const c = s.contributions.find((c) => c.id === id);
            return c && eligible(s, c);
          }),
        "Không có mẫu đủ điều kiện.",
      );
      s.releases.push(command.release);
      audit("EXPORT", command.release.id, "Bản DEMO, không train thật.");
      break;
    case "media":
      assert(command.media.rights, "Cần xác nhận quyền media.");
      s.media = s.media
        .filter((m) => m.id !== command.media.id)
        .concat(command.media);
      audit("MEDIA", command.media.id, command.media.name);
      break;
    case "draft":
      s.drafts = s.drafts
        .filter((d) => d.key !== command.key)
        .concat({
          key: command.key,
          raw: command.raw,
          consent: command.consent,
          parent: command.parent,
        });
      break;
    case "clearDraft":
      s.drafts = s.drafts.filter((d) => d.key !== command.key);
      break;
    case "backup":
      admin();
      s.backupAt = now;
      audit("BACKUP", "demo", "Đã tạo bản sao lưu trình duyệt.");
      break;
  }
  s.revision++;
  return s;
}

// Connected participants/sources/families stay in one split, including transitive links.
export function splitRecords(items: Contribution[]) {
  const parents = items.map((_, i) => i);
  const root = (i: number): number =>
    parents[i] === i ? i : (parents[i] = root(parents[i]));
  const keys = new Map<string, number>();
  items.forEach((c, i) => {
    for (const key of [
      `owner:${c.owner}`,
      `source:${c.sourceId}`,
      `family:${c.raw.family || c.id}`,
    ]) {
      const other = keys.get(key);
      if (other !== undefined) parents[root(i)] = root(other);
      else keys.set(key, i);
    }
  });
  const groups = new Map<number, string[]>();
  items.forEach((c, i) => {
    const k = root(i);
    groups.set(k, [...(groups.get(k) ?? []), c.id]);
  });
  return items.map((c, i) => {
    const key = groups.get(root(i))!.sort()[0];
    const hash =
      [...key].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 0) % 100;
    return {
      id: c.id,
      raw: c.curated!,
      split:
        hash < 80
          ? ("train" as const)
          : hash < 90
            ? ("dev" as const)
            : ("test" as const),
    };
  });
}
export async function sha256(value: unknown) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(JSON.stringify(value)),
      ),
    ),
  ]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
