import { useEffect, useState } from "react";
import { Row, Col, Button, Alert, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { reviewApi } from "../api/review";
import { extractError } from "../api/client";
import type { AdminOverview, TopAnnotator } from "../lib/reviewTypes";
import { Playground } from "../features/annotate/Playground";

type Tone = "default" | "warning" | "success" | "danger";

interface StatTileProps {
  icon: string;
  label: string;
  value: string | number;
  hint?: string;
  tone?: Tone;
}

export function StatTile({ icon, label, value, hint, tone = "default" }: StatTileProps) {
  return (
    <div className={`stat-tile h-100 stat-tone-${tone}`}>
      <div className="icon"><i className={`bi ${icon}`}></i></div>
      <div className="flex-grow-1 min-w-0">
        <div className="label">{label}</div>
        <div className="value">{value}</div>
        {hint && <div className="hint">{hint}</div>}
      </div>
    </div>
  );
}

interface HighlightCardProps {
  icon: string;
  label: string;
  value: number;
  description: string;
  ctaText: string;
  ctaTo: string;
  tone: Tone;
}

export function HighlightCard({ icon, label, value, description, ctaText, ctaTo, tone }: HighlightCardProps) {
  return (
    <div className={`highlight-card stat-tone-${tone} h-100`}>
      <div className="d-flex align-items-start gap-3">
        <div className="highlight-icon"><i className={`bi ${icon}`}></i></div>
        <div className="flex-grow-1 min-w-0">
          <div className="highlight-label">{label}</div>
          <div className="highlight-value">{value}</div>
          <div className="highlight-desc">{description}</div>
        </div>
      </div>
      <Link to={ctaTo} className="highlight-cta">
        {ctaText} <i className="bi bi-arrow-right"></i>
      </Link>
    </div>
  );
}

export function SectionHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <div className="section-header">
      <div className="section-icon"><i className={`bi ${icon}`}></i></div>
      <div>
        <div className="section-title">{title}</div>
        {subtitle && <div className="section-subtitle">{subtitle}</div>}
      </div>
    </div>
  );
}

export function relativeTime(d: Date): string {
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 5) return "vừa xong";
  if (sec < 60) return `${sec}s trước`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} phút trước`;
  const hr = Math.floor(min / 60);
  return `${hr} giờ trước`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "U";
}

interface DonutSegment { value: number; color: string; }

function DonutChart({ segments, size = 168, thickness = 20 }: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img">
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="var(--surface-2)" strokeWidth={thickness}
      />
      {total > 0 && segments.map((s, i) => {
        if (s.value <= 0) return null;
        const len = (s.value / total) * c;
        const dasharray = `${len} ${c - len}`;
        const dashoffset = -offset;
        offset += len;
        return (
          <circle
            key={i}
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke={s.color} strokeWidth={thickness}
            strokeLinecap="butt"
            strokeDasharray={dasharray}
            strokeDashoffset={dashoffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: "stroke-dasharray 0.5s ease" }}
          />
        );
      })}
    </svg>
  );
}

interface LegendRow { color: string; label: string; value: number; total: number; hint?: string; }

function AnnotatorBreakdown({ overview }: { overview: AdminOverview }) {
  const total = overview.total_annotators;
  const segments: DonutSegment[] = [
    { value: overview.annotators_active, color: "#10b981" },
    { value: overview.annotators_under_review, color: "#f59e0b" },
    { value: overview.annotators_suspended, color: "#ef4444" },
  ];
  const rows: LegendRow[] = [
    { color: "#10b981", label: "Đang hoạt động", value: overview.annotators_active, total },
    { color: "#f59e0b", label: "Đang review",    value: overview.annotators_under_review, total, hint: "Tự động flag do error rate" },
    { color: "#ef4444", label: "Bị khoá",        value: overview.annotators_suspended, total, hint: "Không nhận task mới" },
  ];

  const activityPct = total > 0 ? (overview.annotators_active_last_7d / total) * 100 : 0;

  return (
    <div className="breakdown-card">
      <div className="breakdown-chart">
        <DonutChart segments={segments} />
        <div className="breakdown-center">
          <div className="breakdown-total">{total}</div>
          <div className="breakdown-total-label">annotator</div>
        </div>
      </div>

      <div className="breakdown-legend">
        {rows.map((r) => {
          const pct = r.total > 0 ? (r.value / r.total) * 100 : 0;
          return (
            <div key={r.label} className="legend-row">
              <span className="legend-dot" style={{ background: r.color }} />
              <div className="flex-grow-1 min-w-0">
                <div className="d-flex justify-content-between gap-2">
                  <span className="legend-label">{r.label}</span>
                  <span className="legend-value">
                    <strong>{r.value}</strong>
                    <span className="legend-pct">{pct.toFixed(0)}%</span>
                  </span>
                </div>
                {r.hint && <div className="legend-hint">{r.hint}</div>}
              </div>
            </div>
          );
        })}

        <div className="legend-divider" />

        <div className="legend-row legend-row-activity">
          <span className="legend-dot legend-dot-outline" />
          <div className="flex-grow-1 min-w-0">
            <div className="d-flex justify-content-between gap-2">
              <span className="legend-label">Hoạt động 7 ngày qua</span>
              <span className="legend-value">
                <strong>{overview.annotators_active_last_7d}</strong>
                <span className="legend-pct">/ {total}</span>
              </span>
            </div>
            <div className="legend-progress">
              <div className="legend-progress-fill" style={{ width: `${activityPct}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AnnotationBreakdown({ overview }: { overview: AdminOverview }) {
  const reviewed = overview.annotations_approved + overview.annotations_rejected;
  const total = overview.annotations_pending + reviewed;
  const segments: DonutSegment[] = [
    { value: overview.annotations_approved, color: "#10b981" },
    { value: overview.annotations_pending, color: "#f59e0b" },
    { value: overview.annotations_rejected, color: "#ef4444" },
  ];
  const rows: LegendRow[] = [
    { color: "#10b981", label: "Đã duyệt",    value: overview.annotations_approved, total, hint: "Score chính thức" },
    { color: "#f59e0b", label: "Chờ review",  value: overview.annotations_pending,  total, hint: "Cần admin duyệt" },
    { color: "#ef4444", label: "Bị từ chối",  value: overview.annotations_rejected, total, hint: "Score = 0, clawback" },
  ];

  return (
    <div className="breakdown-card">
      <div className="breakdown-chart">
        <DonutChart segments={segments} />
        <div className="breakdown-center">
          <div className="breakdown-total">{total}</div>
          <div className="breakdown-total-label">câu</div>
        </div>
      </div>

      <div className="breakdown-legend">
        {rows.map((r) => {
          const pct = r.total > 0 ? (r.value / r.total) * 100 : 0;
          return (
            <div key={r.label} className="legend-row">
              <span className="legend-dot" style={{ background: r.color }} />
              <div className="flex-grow-1 min-w-0">
                <div className="d-flex justify-content-between gap-2">
                  <span className="legend-label">{r.label}</span>
                  <span className="legend-value">
                    <strong>{r.value}</strong>
                    <span className="legend-pct">{pct.toFixed(0)}%</span>
                  </span>
                </div>
                {r.hint && <div className="legend-hint">{r.hint}</div>}
              </div>
            </div>
          );
        })}

        <div className="legend-divider" />

        <div className="legend-row">
          <span className="legend-dot legend-dot-outline" />
          <div className="flex-grow-1 min-w-0">
            <div className="d-flex justify-content-between gap-2">
              <span className="legend-label">Mới hôm nay</span>
              <span className="legend-value">
                <strong>{overview.annotations_new_today}</strong>
                <span className="legend-pct">/ {overview.annotations_new_last_7d} (7 ngày)</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const RANK_TONES = ["gold", "silver", "bronze"] as const;

function TopAnnotatorsCard({ items }: { items: TopAnnotator[] | undefined }) {
  const list = items ?? [];
  const maxScore = list.length > 0 ? Math.max(1, ...list.map((x) => x.score_confirmed)) : 1;
  return (
    <div className="leaderboard-card">
      <div className="leaderboard-header">
        <div>
          <div className="leaderboard-title">
            <i className="bi bi-trophy-fill"></i>
            Top annotator
          </div>
          <div className="leaderboard-sub">Theo điểm chính thức</div>
        </div>
        <span className="leaderboard-pill">Top {list.length || 5}</span>
      </div>

      {list.length === 0 ? (
        <div className="leaderboard-empty">
          <i className="bi bi-people"></i>
          <div>Chưa có annotation nào được duyệt</div>
        </div>
      ) : (
        <ol className="leaderboard-list">
          {list.map((u, i) => {
            const rankTone = i < 3 ? RANK_TONES[i] : "default";
            const widthPct = (u.score_confirmed / maxScore) * 100;
            return (
              <li key={u.user_id} className={`leaderboard-row rank-${rankTone}`}>
                <span className={`rank-badge rank-${rankTone}`}>{i + 1}</span>
                <span className="leaderboard-avatar">{initials(u.full_name)}</span>
                <div className="flex-grow-1 min-w-0">
                  <div className="d-flex align-items-baseline justify-content-between gap-2">
                    <span className="leaderboard-name text-truncate">{u.full_name}</span>
                    <span className="leaderboard-score">
                      <strong>{u.score_confirmed.toLocaleString()}</strong>
                      <span className="leaderboard-score-label">đ</span>
                    </span>
                  </div>
                  <div className="leaderboard-bar">
                    <div className="leaderboard-bar-fill" style={{ width: `${widthPct}%` }} />
                  </div>
                  <div className="leaderboard-meta">
                    <span><i className="bi bi-check2"></i> {u.count_approved} đã duyệt</span>
                    {u.count_reviewed > 0 && (
                      <span>· acc {Math.round(u.accuracy * 100)}%</span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role === "admin") return <AdminDashboard fullName={user.full_name} />;

  // Annotator: trang chính chỉ là Playground (random task).
  // Lịch sử / Điểm thưởng đã chuyển lên navbar.
  return <><div className="projects-heading"><div><div className="page-eyebrow">ĐÓNG GÓP DỮ LIỆU</div><h1>Không gian gán nhãn</h1><p>Nghe kỹ, ghi lại chính xác và cùng xây dựng dữ liệu chất lượng.</p></div><Link to="/projects" className="btn btn-outline-secondary"><i className="bi bi-folder2" aria-hidden="true" /> Xem dự án</Link></div><Playground /></>;
}

function AdminDashboard({ fullName }: { fullName: string }) {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [, force] = useState(0);

  const load = () => {
    setLoading(true);
    reviewApi.adminOverview()
      .then((d) => { setOverview(d); setError(null); setRefreshedAt(new Date()); })
      .catch((e) => setError(extractError(e, "Không tải được tổng quan")))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);


  return (
    <>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <div className="page-eyebrow">KHÔNG GIAN QUẢN TRỊ</div>
          <h1 className="mb-2">Xin chào, {fullName.split(" ").slice(-1)[0]}</h1>
          <div className="d-flex align-items-center gap-2 text-muted small">
            <span>Tổng quan hệ thống gán nhãn</span>
            {refreshedAt && (
              <>
                <span>·</span>
                <span>Cập nhật {relativeTime(refreshedAt)}</span>
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0 ms-1 text-decoration-none"
                  onClick={load}
                  disabled={loading}
                  title="Làm mới"
                >
                  <i className={`bi bi-arrow-clockwise ${loading ? "spin" : ""}`}></i>
                </button>
              </>
            )}
          </div>
        </div>
        <Link to="/projects/new">
          <Button variant="primary"><i className="bi bi-plus-lg me-2"></i>Tạo project</Button>
        </Link>
      </div>

      {error && <Alert variant="danger" className="py-2">{error}</Alert>}

      {loading && !overview ? (
        <div className="d-flex justify-content-center py-5"><Spinner animation="border" /></div>
      ) : overview ? (
        <>
          {/* Spotlight: 2 chỉ số cần hành động */}
          <Row className="g-3 mb-4">
            <Col lg={6}>
              <HighlightCard
                tone="warning"
                icon="bi-clipboard-check"
                label="Annotation chờ review"
                value={overview.annotations_pending}
                description="Duyệt sớm để annotator được trả điểm chính thức."
                ctaText="Mở hàng đợi"
                ctaTo="/admin/review"
              />
            </Col>
            <Col lg={6}>
              <HighlightCard
                tone={overview.annotators_under_review > 0 ? "danger" : "success"}
                icon="bi-shield-exclamation"
                label="Tài khoản cần xem xét"
                value={overview.annotators_under_review}
                description={
                  overview.annotators_under_review > 0
                    ? "Có user vượt ngưỡng error rate — đang bị tự động flag."
                    : "Không có tài khoản nào bất thường — hệ thống ổn định."
                }
                ctaText="Xem chi tiết"
                ctaTo="/admin/flagged"
              />
            </Col>
          </Row>

          <SectionHeader
            icon="bi-people"
            title="Annotator"
            subtitle="Phân bố theo trạng thái tài khoản"
          />
          <div className="mb-4">
            <AnnotatorBreakdown overview={overview} />
          </div>

          <Row className="g-3 mb-4">
            <Col lg={7}>
              <SectionHeader
                icon="bi-soundwave"
                title="Câu đã gán nhãn"
                subtitle="Phân bố theo trạng thái review"
              />
              <AnnotationBreakdown overview={overview} />
            </Col>
            <Col lg={5}>
              <SectionHeader
                icon="bi-trophy"
                title="Top annotator"
                subtitle="Bảng xếp hạng theo điểm chính thức"
              />
              <TopAnnotatorsCard items={overview.top_annotators} />
            </Col>
          </Row>

        </>
      ) : null}
    </>
  );
}
