import { DISTRICT_GROUPS, UNSURE_REGION } from "./regions";

/** <option>s grouped by province; `unsure` adds a trailing "Không chắc" choice. */
export function RegionOptions({ unsure = false }: { unsure?: boolean }) {
  return (
    <>
      {DISTRICT_GROUPS.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.items.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </optgroup>
      ))}
      {unsure && <option value={UNSURE_REGION}>Không chắc / nhiều nơi</option>}
    </>
  );
}
