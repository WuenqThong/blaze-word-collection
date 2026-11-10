import type { Contribution, DemoState, Session } from "./types";

// Explicitly identified sessions created during browser QA in this chat.
// Preserve their snapshots/answers, but do not treat them as participant activity.
const qaIds = new Set([
  "e0b3f5ee-f521-4413-95ec-75dac60bebd4",
  "715d6314-5b6b-4243-8a28-1d1dd4449b7f",
  "0a22fa66-504e-4c1a-909f-4591754748f2",
  "f6093d6a-2dff-4bd1-bad6-200d6cc008be",
  "1b95747b-7b17-4d6f-b124-8fc65f2de4cd",
]);
export function isTestSession(session: Session) {
  return session.testOnly === true || qaIds.has(session.id) || session.recovery === "993e9ad5-9a5f-4d61-9e49-418ae526563a";
}
export function markKnownTestSessions(state: DemoState) {
  let changed = false;
  for (const session of state.sessions) if (isTestSession(session) && !session.testOnly) { session.testOnly = true; changed = true; }
  return changed;
}
export function isTestContribution(state: DemoState, contribution: Contribution) {
  return state.sessions.some((session) => session.id === contribution.sessionId && isTestSession(session));
}
