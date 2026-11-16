import { useLayoutEffect, useRef, type ReactNode } from "react";

/** Keep one semantic table and the same controls at every breakpoint. */
export function ResponsiveTable({ children, className = "" }: { children: ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = root.current!;
    function labelCells() {
      for (const table of element.querySelectorAll("table")) {
        table.setAttribute("role", "table");
        const headings = Array.from(table.querySelectorAll("thead th"), th => th.textContent?.trim() ?? "");
        for (const group of table.querySelectorAll("thead, tbody")) group.setAttribute("role", "rowgroup");
        for (const row of table.querySelectorAll("tr")) {
          row.setAttribute("role", "row");
          let column = 0;
          for (const cell of Array.from(row.children)) {
            const header = cell.tagName === "TH";
            cell.setAttribute("role", header ? (row.closest("thead") ? "columnheader" : "rowheader") : "cell");
            if (!header && !cell.hasAttribute("data-label")) cell.setAttribute("data-label", headings[column] ?? "");
            column += Number(cell.getAttribute("colspan") ?? 1);
          }
        }
      }
    }
    labelCells();
    const observer = new MutationObserver(labelCells);
    observer.observe(element, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);
  return <div ref={root} className={`demo-table-scroll responsive-table ${className}`}>{children}</div>;
}
