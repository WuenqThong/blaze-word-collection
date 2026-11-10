import type { ReactNode } from "react";
import { Brand } from "../../components/Brand";

export function AuthShell({ children }: { children: ReactNode }) {
  return <div className="collection-auth">
    <header className="collection-auth-header"><Brand /><span><i className="bi bi-globe2" aria-hidden="true" /> Tiếng Việt</span></header>
    <main className="collection-auth-main">
      <div className="collection-auth-form">{children}</div>
    </main>
  </div>;
}
