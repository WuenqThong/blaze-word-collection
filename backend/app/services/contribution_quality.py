"""Advisory HOLD policy v1: stable ordered codes, immutable RAW, no length ban.
Explicit explanatory kinds need context; ordinary game answers do not.
Bump the version whenever thresholds/codes change and update shared fixtures.
"""
import re
import unicodedata
QUALITY_POLICY_VERSION = "contribution-quality-v2"
EXPLANATORY_KINDS = {"explanation", "explain", "OPEN_WORD", "OPEN_SENTENCE"}
KEYBOARD_RUNS = ("qwerty", "asdfgh", "zxcvbn", "qwertz", "azerty")

def quality_reasons(raw: dict) -> list[str]:
    """Pure helper returning HOLD reason codes. No hard rejection or RAW mutation.
    Keyboard runs match whole ASCII tokens; newline/tab/CR are allowed.
    """
    reasons = []
    values = [raw.get(k) if isinstance(raw.get(k), str) else "" for k in ("original_text", "meaning", "standard_vi", "context")]
    if any(any(unicodedata.category(c) in {"Cc", "Cf"} and c not in "\t\n\r" for c in v) for v in values):
        reasons.append("invalid_control")
    if raw.get("response", "answer") != "answer":
        return reasons
    for value in values:
        text = unicodedata.normalize("NFC", value).strip()
        if not text:
            continue
        found = []
        if not any(unicodedata.category(c)[0] in {"L", "N"} for c in text):
            found.append("punctuation_only")
        compact = "".join(text.lower().split())
        if any(len(compact) >= 6 and len(compact) % w == 0 and len(compact) // w >= (6 if w == 1 else 4) and compact == compact[:w] * (len(compact) // w) for w in (1, 2, 3)):
            found.append("repeated_noise")
        runs = (*KEYBOARD_RUNS, *(r[::-1] for r in KEYBOARD_RUNS))
        if any(any(len(t) % len(r) == 0 and t == r * (len(t) // len(r)) for r in runs) for t in re.findall(r"[a-z]+", text.lower())):
            found.append("keyboard_mash")
        reasons.extend(r for r in found if r not in reasons)
    if raw.get("question_kind") in EXPLANATORY_KINDS and not values[3].strip() and not (raw.get('method') == 'game' and values[1].strip()):
        reasons.append("missing_context")
    return reasons
