import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";

export type DrawerTab = { id: string; label: string; content: ReactNode };

/**
 * The single home for every setting. It overlays the waterfall only, so the
 * keyboard never moves, and it returns focus to whatever opened it.
 */
export function ControlDrawer({
  open,
  tabs,
  active,
  onTabChange,
  onClose,
}: {
  open: boolean;
  tabs: DrawerTab[];
  active: string;
  onTabChange: (id: string) => void;
  onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus({ preventScroll: true });
    return () => {
      if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
    };
  }, [open]);
  const current = tabs.find((tab) => tab.id === active) ?? tabs[0];
  // Tabs stay mounted once visited, so an ongoing recording or MIDI link survives tab switches.
  const [visited, setVisited] = useState(() => new Set<string>());
  useEffect(() => {
    if (open && !visited.has(current.id)) setVisited((previous) => new Set(previous).add(current.id));
  }, [open, current.id, visited]);
  return (
    <div
      ref={panel}
      className="drawer"
      data-open={open ? "true" : "false"}
      role="region"
      aria-label="設定面板"
      aria-hidden={!open}
      inert={!open}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="drawer-head">
        <div className="drawer-tabs" role="tablist" aria-label="設定分類">
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`drawer-tab-${tab.id}`}
              aria-selected={tab.id === current.id}
              aria-controls="drawer-panel"
              tabIndex={tab.id === current.id ? 0 : -1}
              onClick={() => onTabChange(tab.id)}
              onKeyDown={(event) => {
                if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
                event.preventDefault();
                const next = tabs.at((index + (event.key === "ArrowRight" ? 1 : -1)) % tabs.length)!;
                onTabChange(next.id);
                requestAnimationFrame(() => document.getElementById(`drawer-tab-${next.id}`)?.focus());
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button type="button" className="icon-button drawer-close" aria-label="收起設定" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      <div
        className="drawer-body"
        id="drawer-panel"
        role="tabpanel"
        aria-labelledby={`drawer-tab-${current.id}`}
      >
        {tabs.map((tab) => (visited.has(tab.id) || (open && tab.id === current.id)) && (
          <div key={tab.id} className="drawer-section" hidden={tab.id !== current.id}>
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
}
