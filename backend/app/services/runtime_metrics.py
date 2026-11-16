"""Bounded process-local HTTP window. No identities, URLs or payloads retained."""
from collections import deque, Counter
from threading import Lock
import time

_rows = deque(maxlen=10000)
_lock = Lock()
_started = time.time()


def record(status, milliseconds):
    with _lock:
        _rows.append((time.time(), int(status), round(milliseconds, 2)))


def snapshot():
    cutoff = time.time() - 3600
    with _lock:
        rows = [row for row in _rows if row[0] >= cutoff]
        capped = len(_rows) == _rows.maxlen and bool(rows) and _rows[0][0] >= cutoff
    durations = sorted(row[2] for row in rows)
    counts = Counter(row[1] for row in rows)
    return {'scope': 'process-last-hour', 'started_at': _started, 'requests': len(rows),
            'server_errors': sum(n for code,n in counts.items() if code >= 500),
            'unauthorized': counts[401], 'rate_limited': counts[429],
            'p95_ms': durations[max(0, int(len(durations)*.95)-1)] if durations else None,
            'capped': capped, 'retention_limit': 10000}
