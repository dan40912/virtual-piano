/**
 * Front elevation of an original grand piano cabinet, built from layers so it
 * stretches to the keyboard's width. `.vp[data-lid]` drives the lid opening
 * in CSS, so the transition never re-renders React.
 */
export function HeroPiano() {
  return (
    <div className="cabinet" aria-hidden="true">
      <div className="cabinet-interior">
        <span className="cabinet-strings" />
        <span className="cabinet-glow" />
      </div>
      <svg className="cabinet-desk" viewBox="0 0 400 160" preserveAspectRatio="xMidYMax meet" focusable="false">
        <defs>
          <linearGradient id="vp-desk" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2b2b30" />
            <stop offset="0.5" stopColor="#111114" />
            <stop offset="1" stopColor="#060607" />
          </linearGradient>
        </defs>
        <path d="M24 152 L24 30 Q24 14 42 12 Q200 -6 358 12 Q376 14 376 30 L376 152 Z" fill="url(#vp-desk)" stroke="#3b3b41" strokeWidth="1.2" />
        <path d="M44 24 Q200 8 356 24" fill="none" stroke="#ffffff" strokeOpacity="0.16" strokeWidth="1.5" />
        <rect x="8" y="148" width="384" height="12" rx="3" fill="#0d0d0f" />
      </svg>
      <span className="cabinet-prop" />
      <div className="cabinet-lid">
        <span className="lid-under" />
        <span className="lid-rail" />
        <span className="lid-top" />
      </div>
      <div className="cabinet-case" />
    </div>
  );
}
