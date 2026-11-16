"""Read-only Dataset1 snapshot audit. Outputs review candidates, never train data."""
import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
import re
import unicodedata
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

PREFERRED = {'Báo/trang tin', 'Tư liệu văn hóa', 'Bài nghiên cứu', 'Luận án'}


def clean(value):
    return ' '.join(unicodedata.normalize('NFC', str(value or '')).split())


def url_group(value):
    urls = []
    for url in re.findall(r'https?://[^\s]+', str(value or '')):
        p = urlsplit(url)
        query = [(k, v) for k, v in parse_qsl(p.query) if not k.startswith('utm_')]
        urls.append(urlunsplit((p.scheme, p.netloc.lower(), p.path, urlencode(query), '')))
    return hashlib.sha256('\n'.join(sorted(set(urls))).encode()).hexdigest() if urls else None


def dump_lines(path, rows):
    with path.open('w', encoding='utf-8') as file:
        for row in rows:
            file.write(json.dumps(row, ensure_ascii=False) + '\n')


def audit(root):
    source = json.loads((root / 'snapshot.json').read_text(encoding='utf-8'))
    notes = json.loads((root / 'cell-notes.json').read_text(encoding='utf-8'))
    sheets = source['sheets']
    by_title = {s['properties']['title']: s for s in sheets}
    note_index = defaultdict(list)
    for row in notes['values'][1:]:
        if len(row) >= 4 and row[3]:
            note_index[(row[0], row[2])].append(dict(cell=row[1], note=row[3]))
    outputs = defaultdict(list)
    main, sentence = sheets[1], sheets[3]
    global_pairs = defaultdict(list)

    def base(sheet, row_number, row):
        sid = sheet['properties']['sheetId']
        original_id = clean(row[0])
        return dict(sample_id=f'dataset1:{sid}:{row_number}:{original_id}', original_id=original_id,
                    sheet=sheet['properties']['title'], sheet_id=sid, row=row_number,
                    source_url=f"https://docs.google.com/spreadsheets/d/{source['spreadsheet_id']}/edit#gid={sid}&range=A{row_number}",
                    contributor_group=None, origin='authored_example_origin_unconfirmed', synthetic=None,
                    rights_status='unconfirmed', native_review_status='pending', training_eligible=False,
                    release_id=None, normalization='NFC + whitespace only; preserve case and diacritics',
                    cell_notes=note_index[(sheet['properties']['title'], original_id)])

    for i, raw in enumerate(main['values'][1:], 2):
        row = [clean(v) for v in raw] + [''] * (24 - len(raw))
        item = base(main, i, row)
        item.update(lexeme=row[2], meaning=row[3], source_text=row[4], target_text=row[5], context=None,
                    region=row[1], recorded_area=row[12], subregion=row[13], source_type=row[14],
                    lexical_source=row[10] or row[7], sentence_source=row[11] or None,
                    source_group=url_group(row[10] or row[7]), lexeme_root=row[17], sense_id=row[18],
                    declared_duplicate_group=row[21] or None, quality_note=row[23], sample_type=row[8])
        global_pairs[(row[4].casefold(), row[5].casefold())].append(item['sample_id'])
        if row[16] != 'Mục tiêu chính':
            item.update(disposition='regional_control_only', reason='outside_initial_QN_DN_scope')
            outputs['regional-controls'].append(item)
        elif row[8] == 'Câu theo khuôn tra cứu':
            item.update(disposition='collect_natural_sentence', reason='lookup_template_not_natural_dialogue')
            outputs['collection-prompts'].append(item)
        else:
            item.update(disposition='sentence_pair_candidate_needs_review', reason='unreviewed_authored_sentence',
                        priority='P1' if row[14] in PREFERRED else 'P2',
                        review_flags=['confirm_target_is_sentence_translation_not_gloss', 'supply_context_if_ambiguous',
                                      'confirm_naturalness_region_rights_and_authorship'])
            outputs['sentence-candidates'].append(item)

    for i, raw in enumerate(sentence['values'][1:], 2):
        row = [clean(v) for v in raw] + [''] * (10 - len(raw))
        item = base(sentence, i, row)
        item.update(lexeme=row[2], meaning=row[3], source_text=row[4], target_text=row[5], context=None,
                    region=row[1], lexical_source=row[7], sentence_source=None, source_group=url_group(row[7]),
                    disposition='sentence_pair_candidate_needs_review', reason='unreviewed_authored_sentence', priority='P1',
                    review_flags=['confirm_target_is_sentence_translation_not_gloss', 'supply_context_if_ambiguous',
                                  'confirm_naturalness_region_rights_and_authorship'])
        global_pairs[(row[4].casefold(), row[5].casefold())].append(item['sample_id'])
        outputs['sentence-candidates'].append(item)

    for i, raw in enumerate(sheets[4]['values'][1:], 2):
        row = [clean(v) for v in raw] + [''] * (9 - len(raw))
        item = base(sheets[4], i, row)
        item.update(lexeme=row[2], source_text=row[4], proposed_interpretation=row[5], target_text=None,
                    context=row[3], alternate_interpretation=row[6], constraints=row[7], region=row[1],
                    lexical_source=row[8], source_group=url_group(row[8]),
                    disposition='separate_language_reference' if row[0] == 'HY-11' else 'context_challenge_needs_target_review',
                    reason='Co_Tu_Vietnamese_illustration_not_original_dialect_sample' if row[0] == 'HY-11' else 'interpretation_not_assumed_to_be_translation')
        outputs['context-challenges'].append(item)

    for i, raw in enumerate(sheets[5]['values'][1:], 2):
        row = [clean(v) for v in raw] + [''] * (7 - len(raw))
        item = base(sheets[5], i, row)
        item.update(lexeme=row[1], evidence_status=row[3], required_work=row[4], lexical_source=row[5],
                    disposition='needs_source_verification', reason='explicitly_unconfirmed_in_source')
        outputs['source-verification'].append(item)

    # Exact duplicates across tabs are audit findings, not new training examples.
    pairs = [dict(sample_ids=ids, type='exact_normalized_source_target_pair') for ids in global_pairs.values() if len(ids) > 1]
    main_ids = {clean(row[0]) for row in main['values'][1:]}
    lookup_ids = [clean(row[0]) for row in sheets[2]['values'][1:]]
    priorities = Counter(row['priority'] for row in outputs['sentence-candidates'])
    statistics = dict(spreadsheet_id=source['spreadsheet_id'], title=source['title'],
                      snapshot_sha256=hashlib.sha256((root / 'snapshot.json').read_bytes()).hexdigest(),
                      cell_notes_sha256=hashlib.sha256((root / 'cell-notes.json').read_bytes()).hexdigest(),
                      tab_counts={s['properties']['title']: len(s['values']) - (3 if s is sheets[0] else 1) for s in sheets},
                      archived_cell_notes=len(notes['values'])-1,
                      main_rows=len(main['values'])-1,
                      target_main_rows=sum(clean(row[16]) == 'Mục tiêu chính' for row in main['values'][1:]),
                      main_native_review_status=dict(Counter(clean(row[9]) for row in main['values'][1:])),
                      sentence_sources_present=sum(bool(len(row)>11 and row[11]) for row in main['values'][1:]),
                      categories={key:len(value) for key,value in outputs.items()}, candidate_priorities=dict(priorities),
                      exact_pair_duplicate_groups=pairs, daily_lookup_rows=len(lookup_ids),
                      daily_lookup_ids_already_in_main=sum(sid in main_ids for sid in lookup_ids),
                      declared_duplicate_groups=dict(Counter(clean(row[21]) for row in main['values'][1:] if len(row)>21 and row[21])),
                      training_ready_rows=0, release_created=False, original_sheet_modified=False,
                      pipeline_scope='Dataset source audit only. No API import, approval, split or training export.',
                      gaps=['No verified contributor identities/consent mapping', 'No confirmed per-source training rights',
                            'No native-reviewed sentence labels', 'Authorship and AI/human origin not established',
                            'No actual audio rows in tab 11'])
    # Conservation and provenance checks are the acceptance checks for this extraction.
    assert len(main['values'])-1 == sum(len(outputs[key]) for key in ('regional-controls','collection-prompts')) + sum(
        row['sheet_id'] == main['properties']['sheetId'] for row in outputs['sentence-candidates'])
    assert len(set(row['sample_id'] for rows in outputs.values() for row in rows)) == sum(map(len,outputs.values()))
    assert all(not row['training_eligible'] and row['contributor_group'] is None and row['release_id'] is None
               for rows in outputs.values() for row in rows)
    for key, value in outputs.items():
        dump_lines(root / (key + '.jsonl'), value)
    preferred_cs = {'CS-001','CS-002','CS-006','CS-007','CS-012','CS-013',
                    'CS-018','CS-019','CS-043','CS-044','CS-063','CS-064'}
    pilot = [row for row in outputs['sentence-candidates'] if row['original_id'] in preferred_cs]
    for category, count in (('Luận án',6),('Bài nghiên cứu',4),('Tư liệu văn hóa',4),('Báo/trang tin',4)):
        candidates = [row for row in outputs['sentence-candidates'] if row.get('source_type') == category]
        pilot.extend(candidates[:count])
    assert len(pilot) == 30 and all(not row['training_eligible'] for row in pilot)
    dump_lines(root / 'review-pilot-30.jsonl', pilot)
    lines = ['# Gói 30 mẫu để bắt đầu duyệt', '',
             'Đây là danh sách cần duyệt, không phải 30 mẫu đã đạt train. Giữ nguyên nhãn/nguồn gốc chưa xác nhận.', '',
             'Chọn 12 câu đối chiếu nghĩa ở tab 03 và 18 câu từ bảng chính, đa dạng nhóm nguồn; loại nguồn không bảo đảm câu đúng.', '']
    for row in pilot:
        lines += [f"## {row['original_id']} · {row['region']}", '',
                  f"[Dòng nguồn]({row['source_url']})", '',
                  '- Câu đang có: ' + row['source_text'], '- Bản phổ thông đang có: ' + row['target_text'],
                  '- Ngữ cảnh ngoài câu: chưa được cung cấp trong bảng.',
                  '- Cần chốt: câu có tự nhiên ở tiểu vùng/nhóm tuổi không; bản dịch có giữ đủ ý/tên/số/phủ định không; nguồn câu và quyền dùng; tác giả/người cung cấp.', '']
    (root / 'review-pilot-30.md').write_text('\n'.join(lines), encoding='utf-8')
    statistics['review_pilot_rows'] = len(pilot)
    (root / 'audit-summary.json').write_text(json.dumps(statistics, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(statistics, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser()
    parser.add_argument('snapshot_directory', type=Path)
    audit(parser.parse_args().snapshot_directory.resolve())
