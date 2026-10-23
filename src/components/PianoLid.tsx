import { useEffect, useRef, useId, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
export interface LidTab {
  id: string;
  label: string;
  content: ReactNode;
}
export function PianoLid({
  open,
  onToggle,
  tabs,
  activeTab,
  onTabChange,
}: {
  open: boolean;
  onToggle: () => void;
  tabs: LidTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
}) {
  const shell = useRef<HTMLDivElement>(null),
    inner = useRef<HTMLDivElement>(null),
    cover = useRef<HTMLButtonElement>(null);
  const wing = useRef<SVGGElement>(null),
    prop = useRef<SVGLineElement>(null),
    inside = useRef<SVGGElement>(null);
  const artId = useId().replace(/:/g, "");
  const motion = useRef({
    height: 0,
    velocity: 0,
    openness: 0,
    openVelocity: 0,
  });
  useEffect(() => {
    const area = shell.current!,
      body = inner.current!,
      lid = cover.current!,
      state = motion.current;
    let frame = 0,
      previous = 0,
      goal = open ? body.scrollHeight : 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const paint = () => {
      area.style.height = Math.max(0, state.height) + "px";
      const p = Math.max(0, Math.min(1, state.openness));
      lid.style.setProperty("--lid-progress", String(p));
      lid.style.height = 120 + p * 155 + "px";
      wing.current?.setAttribute("transform", "rotate(" + -14 * p + " 40 245)");
      prop.current?.setAttribute("x2", String(900 - 178 * p));
      prop.current?.setAttribute("y2", String(258 - 182 * p));
      prop.current?.setAttribute("opacity", String(p));
      inside.current?.setAttribute("opacity", String(p));
    };
    const tick = (now: number) => {
      const dt = previous ? Math.min((now - previous) / 1000, 0.032) : 1 / 60;
      previous = now;
      const w = 19,
        decay = Math.exp(-w * dt);
      const error = state.height - goal,
        c = state.velocity + w * error;
      state.height = goal + (error + c * dt) * decay;
      state.velocity = (state.velocity - w * c * dt) * decay;
      const openGoal = open ? 1 : 0,
        e = state.openness - openGoal,
        oc = state.openVelocity + w * e;
      state.openness = openGoal + (e + oc * dt) * decay;
      state.openVelocity = (state.openVelocity - w * oc * dt) * decay;
      if (
        Math.abs(state.height - goal) < 0.2 &&
        Math.abs(state.velocity) < 0.5 &&
        Math.abs(state.openness - openGoal) < 0.001 &&
        Math.abs(state.openVelocity) < 0.005
      ) {
        state.height = goal;
        state.velocity = 0;
        state.openness = openGoal;
        state.openVelocity = 0;
        paint();
        return;
      }
      paint();
      frame = requestAnimationFrame(tick);
    };
    const start = () => {
      cancelAnimationFrame(frame);
      previous = 0;
      goal = open ? body.scrollHeight : 0;
      if (reduced.matches) {
        state.height = goal;
        state.velocity = 0;
        state.openness = open ? 1 : 0;
        state.openVelocity = 0;
        paint();
      } else frame = requestAnimationFrame(tick);
    };
    start();
    const observer = new ResizeObserver(start);
    observer.observe(body);
    reduced.addEventListener("change", start);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      reduced.removeEventListener("change", start);
    };
  }, [open, activeTab]);
  return (
    <section
      className={"piano-lid grand-piano-lid " + (open ? "is-open" : "")}
      aria-label="掀蓋式鋼琴與樂譜架"
    >
      <button
        ref={cover}
        type="button"
        className="lid-cover"
        aria-expanded={open}
        aria-controls="piano-lid-tray"
        aria-label={open ? "關上琴蓋" : "打開琴蓋"}
        onClick={onToggle}
      >
        <span className="lid-closed-surface" aria-hidden="true" />
        <svg
          className="grand-lid-art"
          viewBox="0 0 1000 300"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={artId + "-lacquer"} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#383c39" />
              <stop offset=".25" stopColor="#0b0e0c" />
              <stop offset="1" stopColor="#020403" />
            </linearGradient>
            <linearGradient id={artId + "-brass"}>
              <stop stopColor="#6a5430" />
              <stop offset=".4" stopColor="#dfc68b" />
              <stop offset=".7" stopColor="#8f7542" />
              <stop offset="1" stopColor="#ddc68d" />
            </linearGradient>
            <linearGradient id={artId + "-wood"} x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="#75442b" />
              <stop offset="1" stopColor="#2b1b12" />
            </linearGradient>
          </defs>
          <g ref={inside} opacity="0">
            <path
              d="M35 255 Q150 205 480 226 Q780 222 968 261 L965 278 L34 278Z"
              fill={"url(#" + artId + "-wood)"}
              stroke="#3b2f22"
              strokeWidth="2"
            />
            {Array.from({ length: 23 }, (_, i) => (
              <path
                key={i}
                d={
                  "M " +
                  (90 + i * 13) +
                  " 262 L " +
                  (620 + i * 12) +
                  " " +
                  (238 + i * 0.65)
                }
                stroke="#b79b61"
                strokeWidth=".7"
                opacity=".5"
              />
            ))}
            <path
              d="M90 255 Q400 225 920 263"
              fill="none"
              stroke="#b49a68"
              strokeWidth="2"
              opacity=".5"
            />
          </g>
          <line
            className="grand-prop-shadow"
            x1="900"
            y1="258"
            x2="722"
            y2="76"
            stroke="#000"
            strokeWidth="13"
            opacity={open ? 0.45 : 0}
          />
          <line
            ref={prop}
            className="grand-prop"
            x1="900"
            y1="258"
            x2="900"
            y2="258"
            stroke="#72756b"
            strokeWidth="7"
            opacity="0"
          />
          <g ref={wing}>
            <path
              d="M35 238 L930 226 Q965 224 978 234 L976 250 L36 256Z"
              fill={"url(#" + artId + "-lacquer)"}
              stroke="#555b53"
              strokeWidth="1.4"
            />
            <path
              d="M39 249 L971 243"
              stroke={"url(#" + artId + "-brass)"}
              strokeWidth="5"
            />
            {Array.from({ length: 22 }, (_, i) => (
              <circle
                key={i}
                cx={55 + i * 42}
                cy={249 - i * 0.27}
                r="1.3"
                fill="#e6d3a1"
                opacity=".7"
              />
            ))}
            <path
              d="M65 239 L931 229"
              stroke="#fff"
              strokeWidth="1"
              opacity=".12"
            />
          </g>
          <path
            d="M21 269 Q500 255 979 269 L983 291 L18 291Z"
            fill="#090c0a"
            stroke="#42463d"
            strokeWidth="1.4"
          />
          <path
            d="M28 273 L971 273"
            stroke={"url(#" + artId + "-brass)"}
            strokeWidth="2"
            opacity=".7"
          />
        </svg>
        <span className="lid-emblem">VIRTUAL PIANO STUDIO</span>
        <span className="lid-invitation">
          <span>{open ? "放下琴蓋" : "掀開琴蓋 · 放上琴譜與 MIDI"}</span>
          <ChevronDown size={15} />
        </span>
      </button>
      <div
        className="lid-tray"
        id="piano-lid-tray"
        ref={shell}
        inert={!open}
        aria-hidden={!open}
        style={{ height: 0 }}
      >
        <div className="lid-tray-inner" ref={inner}>
          <div className="lid-tabs" role="tablist" aria-label="琴蓋功能分類">
            {tabs.map((tab, i) => (
              <button
                role="tab"
                id={"lid-tab-" + tab.id}
                aria-controls={"lid-panel-" + tab.id}
                aria-selected={activeTab === tab.id}
                tabIndex={activeTab === tab.id ? 0 : -1}
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                onKeyDown={(e) => {
                  let next = i;
                  if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
                  else if (e.key === "ArrowLeft")
                    next = (i - 1 + tabs.length) % tabs.length;
                  else if (e.key === "Home") next = 0;
                  else if (e.key === "End") next = tabs.length - 1;
                  else return;
                  e.preventDefault();
                  onTabChange(tabs[next].id);
                  document.getElementById("lid-tab-" + tabs[next].id)?.focus();
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {tabs.map((tab) => (
            <div
              role="tabpanel"
              id={"lid-panel-" + tab.id}
              aria-labelledby={"lid-tab-" + tab.id}
              hidden={activeTab !== tab.id}
              key={tab.id}
            >
              {tab.content}
            </div>
          ))}
        </div>
      </div>
      <div className="lid-gold-rim" aria-hidden="true" />
    </section>
  );
}
