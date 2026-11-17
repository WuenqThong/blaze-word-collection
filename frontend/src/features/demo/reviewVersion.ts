import type { Contribution, Raw } from "./types";

export const REVIEW_FIELDS = ["kind", "text", "meaning", "standard", "context", "variants", "region", "topic", "partOfSpeech", "keywords"] as const;
const normalized = (value: string) => value.normalize("NFC").trim().replace(/\s+/gu, " ");
export function reviewContentKey(raw: Raw, senseId: string | null, qaAudio = "") {
  return JSON.stringify([...REVIEW_FIELDS.map(key => normalized(raw[key])), normalized(senseId ?? ""), normalized(qaAudio)]);
}
// The epoch prevents A -> B -> A from reviving an old A action or draft.
export function reviewDigest(c: Contribution) {
  return c.reviewDigest ?? `local:${c.reviewRevision ?? 1}:${reviewContentKey(c.curated ?? c.raw, c.senseId ?? c.id, c.qaAudio)}`;
}
export function reviewDraftKey(actor: string, c: Contribution) {
  return `${actor}.review.${c.id}.${c.reviewRevision ?? 1}.${reviewDigest(c)}`;
}
