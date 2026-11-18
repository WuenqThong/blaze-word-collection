"""Server-owned release policy. Callers supply their complete eligibility result.

No router imports, writes, or commits. Data cards contain IDs and digests, never
contact details or free-form source evidence. Download validation fails closed.
"""
import hashlib
import json
import re
import unicodedata
from collections import Counter

from fastapi import HTTPException
from app.services.curation import valid_curated
from app.services.review_binding import binding, bound_votes
from app.services.dataset_package import POLICY
from app.models.dialect import (
    DialectContributionMeta as M, DialectSource as S,
    DialectSourceRights as SR, DialectVote as V,
)

RULE_VERSION = POLICY
CONSENT_VERSIONS = {"dialect-2026-11-v1", "demo-consent-v1", "demo-import-v1", "demo-ai-feedback-v1"}


def normalize(value):
    return " ".join(unicodedata.normalize("NFKC", str(value or "")).casefold().split())


def _digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def _consent(c, m):
    if m and m.consent is not None:
        return m.consent
    return {k: c.raw.get("consent_" + k, False) for k in ("collect", "train", "public", "audio")} | {"version": c.raw.get("consent_version", "")}


def _valid(db, c):
    m, source = db.get(M, c.id), db.get(S, c.source_id)
    consent = _consent(c, m)
    votes = bound_votes(db, c)
    return bool(
        c.status == "VERIFIED" and not c.withdrawn_at and source and source.rights_confirmed
        and consent.get("collect") is True and consent.get("train") is True
        and consent.get("version") in CONSENT_VERSIONS
        and len({v.reviewer_id for v in votes if v.reviewer_id != c.owner_id}) >= 1
        and m and valid_curated(m.curated)
    )


def _groups(db, items):
    """Union before selection: a nonselected eligible row can bridge two rows."""
    roots = {c.id: c.id for c in items}

    def root(cid):
        while roots[cid] != cid:
            roots[cid] = roots[roots[cid]]
            cid = roots[cid]
        return cid

    def union(a, b):
        a, b = root(a), root(b)
        roots[max(a, b)] = min(a, b)

    seen = {}
    for c in sorted(items, key=lambda x: x.id):
        m, source = db.get(M, c.id), db.get(S, c.source_id)
        keys = [("owner", c.owner_id), ("source", c.source_id)]
        evidence = normalize(source.evidence) if source else ""
        if evidence:
            keys.append(("provenance", evidence))
        if m and m.sense_id:
            keys.append(("sense", normalize(m.sense_id)))
        for payload in (c.raw, m.curated if m else None):
            if not payload:
                continue
            if normalize(payload.get("family")):
                keys.append(("family", normalize(payload["family"])))
            # Text and variants share a namespace, connecting A.variant=B.text.
            text = normalize(payload.get("text") or payload.get("original_text"))
            if text:
                keys.append(("lexeme", text))
            variants = payload.get("variants", "")
            if isinstance(variants, str):
                variants = re.split(r"[,;|\n]+", variants)
            if isinstance(variants, list):
                keys.extend(("lexeme", normalize(v)) for v in variants if normalize(v))
        for target in (c.parent_id, m.duplicate_of if m else None):
            if target in roots:
                union(c.id, target)
        for key in keys:
            if key in seen:
                union(c.id, seen[key])
            else:
                seen[key] = c.id
    return {cid: root(cid) for cid in roots}


def release_candidates(db, eligible_items):
    """The dashboard and exporter use the same validation and deduplication."""
    from app.services.dataset_package import duplicate_key
    allowed, representatives, duplicates = {}, {}, {}
    for c in sorted(eligible_items, key=lambda item: item.id):
        if not _valid(db, c):
            continue
        key = duplicate_key(c.raw, db.get(M, c.id).curated)
        if key in representatives:
            duplicates[c.id] = representatives[key]
        else:
            representatives[key] = c.id
            allowed[c.id] = c
    return allowed, duplicates


def build_release(db, eligible_items, ids=None, client_splits=None, grouping_items=None):
    """Return records/splits/data_card/warnings/rule_version; ignore client splits.

    eligible_items MUST be the full parent-policy eligible dataset, never a page
    or selected subset. Only valid CURATED rows may be released; all eligible
    rows (including not-yet-curated intermediates) participate in grouping.
    """
    items = sorted(list(eligible_items), key=lambda c: c.id)
    allowed, duplicates = release_candidates(db, items)
    selected = sorted(allowed if ids is None else set(ids))
    if not selected or any(cid not in allowed for cid in selected):
        raise HTTPException(409, "Mẫu cần bản chỉnh lý đầy đủ, một phiếu duyệt hợp lệ và đủ quyền sử dụng; hãy tải lại.")
    universe = sorted(list(grouping_items if grouping_items is not None else items), key=lambda c: c.id)
    groups = _groups(db, universe)
    if any(c.id not in groups for c in items):
        raise HTTPException(409, 'Chưa đối chiếu được toàn bộ nhóm nguồn; hãy tải lại')
    # Allocate over the entire dataset, so selecting a subset never moves groups.
    ranked = sorted({groups[c.id] for c in items}, key=lambda x: (_digest([RULE_VERSION, x]), x))
    assignment = {gid: "train" for gid in ranked}
    if len(ranked) >= 3:
        holdout = max(1, len(ranked) // 10)
        assignment.update({gid: "test" for gid in ranked[:holdout]})
        assignment.update({gid: "dev" for gid in ranked[holdout:2 * holdout]})
    selected_groups = {groups[cid] for cid in selected}
    warnings = []
    if duplicates:
        warnings.append(f'Đã loại {len(duplicates)} mẫu trùng hoàn toàn sau chuẩn hóa khỏi bản xuất; giữ nguyên bản gốc và lịch sử.')
    if len(ranked) < 3:
        warnings.append("Toàn bộ dữ liệu có ít hơn 3 nhóm độc lập: chỉ train; không tạo benchmark/gold.")
    splits = {str(cid): assignment[groups[cid]] for cid in selected}
    if len(set(splits.values())) < 3 and not warnings:
        warnings.append("Bản chọn chưa có đủ train/dev/test; không coi là benchmark/gold.")
    records, provenance = [], []
    for cid in selected:
        c, m = allowed[cid], db.get(M, cid)
        source, rights = db.get(S, c.source_id), db.get(SR, c.source_id)
        consent = _consent(c, m)
        scopes = {"train": True, "public": bool(consent.get("public") and rights and rights.public),
                  "audio": bool(consent.get("audio") and rights and rights.audio)}
        records.append({"id": cid, "source_id": c.source_id, "raw": c.raw,
                        "curated": m.curated, "sense_id": m.sense_id, "split": splits[str(cid)]})
        provenance.append({"id": cid, "source_id": c.source_id,
                           **binding(db, c),
                           "contributor_ref": _digest(['contributor', c.owner_id]),
                           "source_digest": _digest(normalize(source.evidence)),
                           "group": _digest([RULE_VERSION, groups[cid]]),
                           "parent_id": c.parent_id, "duplicate_of": m.duplicate_of,
                           "effective_consent": {k: consent.get(k, False) for k in ("collect", "train", "public", "audio", "version")},
                           "scopes": scopes})
    card = {"rule_version": RULE_VERSION, "scope": "verified-training-candidates",
            "schema": "dialect-data-card-v1", "expert_review": {"status": "pending", "approved_ids": []},
            "records_sha256": _digest(records),
            "universe_groups": sorted(_digest([RULE_VERSION, gid]) for gid in ranked),
            "deduplication": {"policy": "normalized-curated-content-and-metadata", "excluded": [{"id": cid, "representative_id": target} for cid, target in sorted(duplicates.items())]},
            "benchmark": False, "split_policy": "connected-owner-provenance-duplicate-parent-sense-family-variant",
            "counts": {"records": len(records), "groups": len(selected_groups),
                       "eligible_universe": len(items), "grouping_universe": len(universe), "universe_groups": len(ranked), "splits": dict(Counter(splits.values()))},
            "warnings": warnings, "provenance": provenance,
            "usage": "Huấn luyện nội bộ; public/audio chỉ khi scopes của từng mẫu cho phép. Chưa là benchmark/gold."}
    return {"records": records, "splits": splits, "data_card": json.dumps(card, ensure_ascii=False, sort_keys=True),
            "warnings": warnings, "rule_version": RULE_VERSION}


def validate_download(db, records, eligible_items, data_card, grouping_items=None):
    """Fail closed for legacy releases, stale permissions, content or grouping."""
    try:
        card = json.loads(data_card) if isinstance(data_card, str) else data_card
        if not card or card.get("rule_version") != RULE_VERSION:
            raise ValueError("legacy policy")
        if not records or any(not r.get("curated") for r in records):
            raise ValueError("uncurated")
        current = build_release(db, eligible_items, [r["id"] for r in records], grouping_items=grouping_items)
        fresh = json.loads(current["data_card"])
        if len(records) != len(current["records"]) or sorted(records, key=lambda r: r["id"]) != current["records"]:
            raise ValueError("changed records")
        if card != fresh:
            raise ValueError("changed policy")
    except (ValueError, TypeError, KeyError, AttributeError):
        raise HTTPException(409, "Bản phát hành cũ hoặc quyền/CURATED/split đã đổi; hãy tạo bản mới.") from None
    return current
