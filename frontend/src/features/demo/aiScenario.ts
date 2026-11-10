import { normalize } from "./domain";
import type { ModelVersion } from "./types";
export const BENCHMARK = [
  ["chi", "cái gì"],
  ["mô", "đâu"],
  ["răng", "sao"],
  ["chừ", "bây giờ"],
];
export function simulateTranslation(input: string, model: ModelVersion) {
  let output = normalize(input);
  for (const [term, value] of Object.entries(model.rules).sort(
    (a, b) => b[0].length - a[0].length,
  ))
    output = output.split(term).join(value);
  return output;
}
