import type { ReactNode } from "react";

interface AuthShellProps {
  children: ReactNode;
}

export function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="auth-shell">
      <aside className="auth-hero">
        <div className="auth-hero-content">
          <div className="d-inline-flex align-items-center gap-2 mb-4">
            <span
              className="d-inline-flex align-items-center justify-content-center"
              style={{
                width: 40, height: 40, borderRadius: 10,
                background: "rgba(255,255,255,0.18)",
              }}
            >
              <i className="bi bi-soundwave fs-5"></i>
            </span>
            <span style={{ fontWeight: 800, letterSpacing: "-0.02em", fontSize: "1.1rem" }}>
              Audio Annotator
            </span>
          </div>

          <h1>Gán nhãn audio. Nhận điểm. Quy đổi giá trị.</h1>
          <p className="mb-4">
            Nền tảng annotation tập trung vào chất lượng dữ liệu giọng nói — minh bạch, an toàn,
            công bằng cho mọi người tham gia.
          </p>

          <div className="feature">
            <i className="bi bi-shield-check"></i>
            <div>
              <strong>Bảo mật chuẩn enterprise</strong>
              <div className="small text-white-50">Phiên mã hoá, audit log đầy đủ, watermark từng truy cập.</div>
            </div>
          </div>
          <div className="feature">
            <i className="bi bi-graph-up-arrow"></i>
            <div>
              <strong>Điểm thưởng minh bạch</strong>
              <div className="small text-white-50">Theo dõi pending → confirmed → paid theo từng task.</div>
            </div>
          </div>
          <div className="feature">
            <i className="bi bi-people"></i>
            <div>
              <strong>Cộng đồng có chuẩn</strong>
              <div className="small text-white-50">Golden + consensus đảm bảo chất lượng dataset.</div>
            </div>
          </div>
        </div>

        <div className="auth-hero-footer">© {new Date().getFullYear()} Audio Annotator</div>
      </aside>

      <main className="auth-form-side">
        <div className="auth-card">{children}</div>
      </main>
    </div>
  );
}
