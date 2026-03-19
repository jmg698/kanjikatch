"use client";

import { useMemo } from "react";

/**
 * Static Japanese landscape background for the review screen: sky, mountains with snow caps,
 * sakura (cherry blossom) layer, and buildings. No parallax or animation — just a calm, pleasant scene.
 * Card stays white on top; this fills the area behind it.
 */
export function StaticShinkansenBackground() {
  const mountains = useMemo(
    () =>
      [
        { width: 220, height: 200, x: 0 },
        { width: 280, height: 260, x: 180 },
        { width: 240, height: 220, x: 380 },
        { width: 260, height: 240, x: 540 },
        { width: 200, height: 180, x: 720 },
        { width: 300, height: 280, x: 840 },
      ].map((m, i) => ({ ...m, id: i })),
    [],
  );

  const buildings = useMemo(
    () =>
      [
        { width: 70, height: 50, x: 40 },
        { width: 90, height: 60, x: 160 },
        { width: 60, height: 45, x: 300 },
        { width: 80, height: 55, x: 420 },
        { width: 100, height: 65, x: 540 },
        { width: 75, height: 52, x: 680 },
        { width: 85, height: 58, x: 800 },
        { width: 65, height: 48, x: 920 },
      ].map((b, i) => ({ ...b, id: i })),
    [],
  );

  const sakuraClusters = useMemo(
    () =>
      [
        { cx: 80, cy: 72, r: 36 },
        { cx: 220, cy: 68, r: 42 },
        { cx: 380, cy: 75, r: 38 },
        { cx: 520, cy: 70, r: 40 },
        { cx: 680, cy: 72, r: 35 },
        { cx: 820, cy: 68, r: 44 },
      ].map((s, i) => ({ ...s, id: i })),
    [],
  );

  return (
    <div
      className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
      aria-hidden
    >
      {/* Sky gradient — soft blue, slightly darker at top */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(to bottom, #9ec9dc 0%, #c5e4ef 45%, #e2f2f7 100%)",
        }}
      />

      {/* Subtle horizontal lines for texture (optional, very faint) */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "repeating-linear-gradient(to bottom, transparent 0, transparent 3px, #fff 3px, #fff 4px)",
        }}
      />

      {/* Mountains — lavender-gray with white snow caps */}
      <div className="absolute bottom-0 left-0 right-0 h-[45%] min-h-[280px]">
        {mountains.map((m) => (
          <div
            key={m.id}
            className="absolute bottom-0"
            style={{ left: `${(m.x / 1100) * 100}%` }}
          >
            <svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${m.width} ${m.height}`}
              preserveAspectRatio="xMidYMax meet"
              className="h-full w-auto max-h-[280px]"
              style={{ minWidth: m.width * 0.5 }}
            >
              <polygon
                points={`0,${m.height} ${m.width / 2},0 ${m.width},${m.height}`}
                fill="#B8B8D1"
              />
              <polygon
                points={`${m.width * 0.35},${m.height * 0.32} ${m.width / 2},0 ${m.width * 0.65},${m.height * 0.32}`}
                fill="#fff"
                opacity={0.95}
              />
            </svg>
          </div>
        ))}
      </div>

      {/* Sakura (cherry blossom) layer — pale pink cloud shapes */}
      <div className="absolute bottom-[18%] left-0 right-0 h-[22%] min-h-[120px]">
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 1100 120"
          preserveAspectRatio="none"
        >
          {sakuraClusters.map((s) => (
            <g key={s.id}>
              <ellipse cx={s.cx} cy={s.cy} rx={s.r} ry={s.r * 0.5} fill="#FBC4AB" opacity={0.92} />
              <ellipse cx={s.cx + 15} cy={s.cy - 5} rx={s.r * 0.7} ry={s.r * 0.35} fill="#FAD4C4" opacity={0.88} />
              <ellipse cx={s.cx - 10} cy={s.cy + 8} rx={s.r * 0.6} ry={s.r * 0.3} fill="#FBC4AB" opacity={0.85} />
            </g>
          ))}
        </svg>
      </div>

      {/* Buildings — gray-beige with dark roofs and window grids */}
      <div className="absolute bottom-0 left-0 right-0 h-[18%] min-h-[90px]">
        {buildings.map((b) => {
          const leftPct = (b.x / 1100) * 100;
          return (
            <div
              key={b.id}
              className="absolute bottom-0 rounded-t-sm overflow-hidden"
              style={{
                left: `${leftPct}%`,
                width: "clamp(48px, 8vw, 90px)",
                height: "100%",
                minHeight: b.height,
              }}
            >
              <div
                className="absolute inset-0 rounded-t"
                style={{ backgroundColor: "#C4C4B2" }}
              />
              <div
                className="absolute top-0 left-0 right-0 h-4 rounded-t"
                style={{ backgroundColor: "#6B6B6B" }}
              />
              <div
                className="absolute left-1 right-1 top-5 bottom-1 grid gap-0.5"
                style={{
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gridTemplateRows: "repeat(3, 1fr)",
                }}
              >
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-sm bg-sky-100/90"
                    style={{ minHeight: 4 }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Platform strip — very light gray */}
      <div
        className="absolute bottom-0 left-0 right-0 h-6"
        style={{ backgroundColor: "#E8E8E4" }}
      />
    </div>
  );
}
