"""Resolve dialect sources from structured snapshots or known legacy prompt grammar."""
import re

OPEN_KINDS = {'OPEN_WORD', 'OPEN_SENTENCE'}
QUOTES = re.compile(r'‘([^’]*)’|“([^”]*)”|"([^"\n]*)"')


def question_original(q):
    if q.get('kind') in OPEN_KINDS:
        return ''
    if 'originalText' in q:
        value = q['originalText']
        return value.strip() if isinstance(value, str) and len(value) <= 5000 else ''
    prompt = q.get('prompt', '')
    if not isinstance(prompt, str) or re.search(r'<\d+>', prompt):
        return ''
    quotes = []

    def token(match):
        quotes.append(next(v for v in match.groups() if v is not None).strip())
        return f'<{len(quotes)-1}>'

    grammar = QUOTES.sub(token, prompt.strip())
    # Only explicit grammatical subjects qualify. Context sentences, tentative
    # meanings and quoted instructions are never selected by quote position.
    patterns = []
    if q.get('kind') == 'SENTENCE':
        patterns = [
            (r'(?:Diễn đạt câu|Viết lại(?: câu)?) <0> bằng tiếng Việt phổ thông\.', 0),
            (r'Câu <0> được biên soạn từ nguồn chưa kiểm chứng\. Người quê bạn có nói vậy không\? Viết bản phổ thông; nếu câu chưa tự nhiên, ghi cách nói đúng ở phần ngữ cảnh\.', 0),
        ]
    elif q.get('kind') == 'LEXEME':
        patterns = [
            (r'(?:Giải thích(?: một nghĩa của)?|Bạn hiểu) <0>(?: \([^<>]*\))? (?:trong (?:<1>|một ngữ cảnh cụ thể)[^<>]*(?:<2>[^<>]*)?|bằng lời của bạn\.(?: Nguồn tạm ghi: <1> \(chưa kiểm chứng\)\.)?|và hoàn cảnh bạn nghe\.)', 0),
            (r'Nơi bạn sống có dùng <0>(?: \([^<>]*\))? không\? Nguồn tạm ghi nghĩa <1>\. Ghi nghĩa bạn hiểu và hoàn cảnh bạn hay nghe\.', 0),
            (r'Từ cần xác minh: <0> \([^<>]*\)\. Bạn có nghe hoặc dùng từ này không\? Ghi nghĩa phổ thông bạn hiểu, hoặc ghi <1>\.', 0),
            (r'Nguồn tra cứu chưa kiểm chứng ghi <0>(?: \([^<>]*\))? nghĩa là <1>\. Theo bạn, <2>(?: \([^<>]*\))? nói theo tiếng phổ thông là gì\? Nếu nghĩa khác hoặc bạn chưa nghe từ này, hãy ghi rõ\.', 2),
        ]
    elif q.get('kind') in {'GATE', 'GOLD'}:
        patterns = [
            (r'Trong(?: câu)? <0>, <1>(?: \([^<>]*\))? (?:có nghĩa(?: là)? gì|tương ứng cách nói nào|là gì|được hiểu thế nào|là hành động nào|tương ứng từ nào)\?', 1),
            (r'<0>: (?:tên phổ thông của )?<1> (?:là gì|dùng để làm gì trong câu này|là đồ dùng nào)\?', 1),
            (r'(?:Trong nghĩa đối chiếu của bộ đề, điền tên phổ thông của|Trong ngữ cảnh món canh, điền tên đối chiếu của|Điền tên phổ thông của|Điền động từ phổ thông tương ứng|Điền cách nói phổ thông của) <0>(?: \([^<>]*\))? trong(?: câu:? )? ?<1>', 0),
            (r'(?:Trong ví dụ minh họa, <0> có nghĩa gì\?|Câu hiệu chỉnh minh họa: <0> tương ứng cách nói nào\?|Diễn đạt <0> bằng lời phổ thông\.)', 0),
            (r'Điền từ vào bản phổ thông của <0>', 0),
        ]
    candidates = {quotes[index] for pattern, index in patterns if re.fullmatch(pattern, grammar)}
    # Repeated source in confirmation prompts must agree, not contradict.
    if grammar.startswith('Nguồn tra cứu chưa kiểm chứng ghi ') and len(quotes) == 3 and quotes[0] != quotes[2]:
        return ''
    return next(iter(candidates)) if len(candidates) == 1 else ''
