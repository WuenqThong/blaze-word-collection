import policy from "./playerContentPolicy.json";
import type { Question } from "./types";

// Allocation policy only: never censor contributions or rewrite old snapshots.
const excluded = new Set(policy.excludedRowIds);
const restricted = new Set(policy.restrictedPhrases);
export function playerQuestionAllowed(question: Question): boolean {
  if (excluded.has(question.provenance?.rowId ?? "")) return false;
  const fields = [question.prompt, question.originalText, question.blankTemplate,
    ...question.accepted, ...(question.options ?? []).map(option => option.text), question.provenance?.sense];
  return fields.every(field => {
    const words = (field ?? "").normalize("NFC").toLocaleLowerCase("vi").match(/[\p{L}\p{N}]+/gu) ?? [];
    for (let start = 0; start < words.length; start++) {
      for (let length = 1; length <= 4 && start + length <= words.length; length++) {
        if (restricted.has(words.slice(start, start + length).join(" "))) return false;
      }
    }
    return true;
  });
}
