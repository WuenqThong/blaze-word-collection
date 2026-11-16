import { useState, type FormEvent } from "react";

/** Error messages change on blur or submit, never while the user is typing. */
export function useBlurValidation(messages: Record<string, () => string>) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  function blur(field: string) {
    setErrors(previous => ({ ...previous, [field]: messages[field]() }));
  }
  function validate(event: FormEvent<HTMLFormElement>) {
    const next = Object.fromEntries(Object.entries(messages).map(([field, check]) => [field, check()]));
    setErrors(next);
    const first = Object.keys(next).find(field => next[field]);
    if (first) event.currentTarget.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
    return !first;
  }
  return { errors, blur, validate };
}
