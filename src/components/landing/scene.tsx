// Landing-page scenery: the review screen's flat Japanese cityscape, painted
// at two times of day. Marketing-owned on purpose — do not import the
// production review backgrounds here (and vice versa) so landing tweaks can
// never touch the app. One geometry + two palettes keeps "same room,
// different light" structurally true.
//
// Bottom-anchored (`xMidYMax slice`) with the sky filling the whole viewBox,
// so the *container's* height chooses the crop: a short band shows skyline +
// ground (hero), a tall section reveals the upper sky and stars (finale).

interface ScenePalette {
  skyGradient: [string, string, string, string, string] | null;
  sky: string;
  mountain: string;
  snow: string;
  snowOpacity?: number;
  sakura: string;
  trunk: string;
  building: string;
  roof: string;
  window: string;
  platform: string;
  sign: string;
  signText: string;
}

const DAY: ScenePalette = {
  skyGradient: null,
  sky: "#A9D6F1",
  mountain: "#B4B9CC",
  snow: "#FFFFFF",
  sakura: "#F9A1B1",
  trunk: "#5C4033",
  building: "#B0B3B8",
  roof: "#4F5B66",
  window: "#D8DCE0",
  platform: "#E2E6E8",
  sign: "#2D6A4F",
  signText: "#FFFFFF",
};

const DUSK: ScenePalette = {
  skyGradient: ["#2D3A5C", "#5C4A6E", "#C47A5A", "#E8A86D", "#F0C88A"],
  sky: "#2D3A5C",
  mountain: "#3A2E4A",
  snow: "#7B7090",
  snowOpacity: 0.5,
  sakura: "#6B2A3A",
  trunk: "#2A1A1A",
  building: "#1E1A30",
  roof: "#15112A",
  window: "#2A2540",
  platform: "#2E2840",
  sign: "#1A3A2F",
  signText: "#D4CFC0",
};

const MOUNTAINS: string[] = [
  "0,700 80,450 160,700",
  "120,700 220,380 320,700",
  "260,700 360,420 460,700",
  "400,700 520,350 640,700",
  "560,700 680,400 800,700",
  "720,700 840,380 960,700",
  "880,700 1000,440 1120,700",
  "1040,700 1140,460 1200,700",
];

const SNOWCAPS: string[] = [
  "56,580 80,450 104,580",
  "190,520 220,380 250,520",
  "328,548 360,420 392,548",
  "472,518 520,350 568,518",
  "632,540 680,400 728,540",
  "792,524 840,380 888,524",
  "952,564 1000,440 1048,564",
  "1100,576 1140,460 1180,576",
];

const TREES = [
  { x: 150, trunkY: 560, trunkH: 60 },
  { x: 350, trunkY: 548, trunkH: 72 },
  { x: 550, trunkY: 552, trunkH: 68 },
  { x: 750, trunkY: 556, trunkH: 64 },
  { x: 950, trunkY: 550, trunkH: 70 },
];

const BUILDINGS = [
  { x: 30, w: 55, h: 90 },
  { x: 100, w: 65, h: 110 },
  { x: 180, w: 50, h: 75 },
  { x: 245, w: 70, h: 95 },
  { x: 330, w: 60, h: 85 },
  { x: 405, w: 75, h: 100 },
  { x: 495, w: 55, h: 80 },
  { x: 565, w: 70, h: 105 },
  { x: 650, w: 60, h: 90 },
  { x: 725, w: 65, h: 95 },
  { x: 805, w: 55, h: 82 },
  { x: 875, w: 70, h: 98 },
  { x: 960, w: 60, h: 88 },
  { x: 1035, w: 65, h: 92 },
];

// Stars live above y=300 so they only appear in the finale's tall crop.
const STARS = [
  { cx: 180, cy: 45, r: 1.2, o: 0.6 },
  { cx: 420, cy: 80, r: 1, o: 0.4 },
  { cx: 650, cy: 35, r: 1.3, o: 0.55 },
  { cx: 870, cy: 65, r: 1, o: 0.45 },
  { cx: 1050, cy: 50, r: 1.1, o: 0.5 },
  { cx: 300, cy: 110, r: 0.8, o: 0.3 },
  { cx: 780, cy: 100, r: 0.9, o: 0.35 },
  { cx: 1140, cy: 90, r: 1, o: 0.4 },
  { cx: 520, cy: 160, r: 0.9, o: 0.35 },
  { cx: 960, cy: 140, r: 0.8, o: 0.3 },
];

// Lit-window opacity cycle for dusk, echoing the app's golden-hour scene.
const LIT_CYCLE = [0.9, 0.6, 0.8, 0.5, 0.7, 0.4];

export function LandingScene({
  palette,
  showStars = false,
  className = "",
}: {
  palette: "day" | "dusk";
  showStars?: boolean;
  className?: string;
}) {
  const p = palette === "day" ? DAY : DUSK;
  const gradientId = `landing-sky-${palette}`;
  let litIndex = 0;

  return (
    <div
      className={`pointer-events-none select-none overflow-hidden ${className}`}
      aria-hidden
    >
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1200 700"
        preserveAspectRatio="xMidYMax slice"
        shapeRendering="crispEdges"
      >
        {p.skyGradient ? (
          <>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={p.skyGradient[0]} />
                <stop offset="25%" stopColor={p.skyGradient[1]} />
                <stop offset="50%" stopColor={p.skyGradient[2]} />
                <stop offset="75%" stopColor={p.skyGradient[3]} />
                <stop offset="100%" stopColor={p.skyGradient[4]} />
              </linearGradient>
            </defs>
            <rect width="1200" height="700" fill={`url(#${gradientId})`} />
          </>
        ) : (
          <rect width="1200" height="700" fill={p.sky} />
        )}

        {showStars && (
          <g fill="#FFFFFF">
            {STARS.map((s, i) => (
              <circle key={i} cx={s.cx} cy={s.cy} r={s.r} opacity={s.o} />
            ))}
          </g>
        )}

        <g fill={p.mountain}>
          {MOUNTAINS.map((pts) => (
            <polygon key={pts} points={pts} />
          ))}
        </g>
        <g fill={p.snow} opacity={p.snowOpacity ?? 1}>
          {SNOWCAPS.map((pts) => (
            <polygon key={pts} points={pts} />
          ))}
        </g>

        <g fill={p.trunk} stroke={p.trunk} strokeWidth="2">
          {TREES.map((t) => (
            <rect key={t.x} x={t.x - 5} y={t.trunkY} width="10" height={t.trunkH} />
          ))}
        </g>
        <g fill={p.sakura}>
          {TREES.map((t) => (
            <g key={t.x}>
              <circle cx={t.x} cy={t.trunkY - 42} r="26" />
              <circle cx={t.x} cy={t.trunkY - 60} r="20" />
            </g>
          ))}
        </g>

        {BUILDINGS.map((b, i) => (
          <g key={i}>
            <rect x={b.x} y={700 - b.h} width={b.w} height={b.h} fill={p.building} />
            <rect x={b.x} y={700 - b.h} width={b.w} height="10" fill={p.roof} />
            {[0, 1].map((col) =>
              [0, 1, 2].map((row) => {
                const lit = palette === "dusk" && (i * 6 + col * 3 + row) % 5 !== 2;
                const litOpacity = LIT_CYCLE[litIndex++ % LIT_CYCLE.length];
                return (
                  <rect
                    key={`${col}-${row}`}
                    x={b.x + 8 + (col * (b.w - 20)) / 2}
                    y={700 - b.h + 18 + (row * (b.h - 28)) / 3}
                    width={(b.w - 20) / 2 - 4}
                    height={(b.h - 28) / 3 - 4}
                    rx="2"
                    fill={lit ? "#F5D98A" : p.window}
                    opacity={lit ? litOpacity : 1}
                  />
                );
              })
            )}
          </g>
        ))}

        <rect x="0" y="650" width="1200" height="50" fill={p.platform} />

        <rect x="24" y="608" width="52" height="32" rx="2" fill={p.sign} />
        <text
          x="50"
          y="628"
          textAnchor="middle"
          fill={p.signText}
          fontSize="14"
          fontFamily="system-ui, sans-serif"
          fontWeight="600"
        >
          1号車
        </text>
      </svg>
    </div>
  );
}
