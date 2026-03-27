"use client";

/**
 * Golden hour / early dusk version of the Shinkansen city background.
 * Same city geometry as the daytime flashcard scene — buildings, sakura trees,
 * mountains — but shifted to a warm evening palette with glowing windows and stars.
 * Used as the backdrop for the "See It In The Wild" sentence review screen.
 */
export function StaticGoldenHourBackground() {
  return (
    <div
      className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
      aria-hidden
    >
      <svg
        className="absolute w-full h-full"
        viewBox="0 0 1200 700"
        preserveAspectRatio="xMidYMax slice"
        shapeRendering="crispEdges"
      >
        {/* Sky gradient — deep navy → muted purple → terra cotta → soft orange → pale gold */}
        <defs>
          <linearGradient id="golden-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2D3A5C" />
            <stop offset="25%" stopColor="#5C4A6E" />
            <stop offset="50%" stopColor="#C47A5A" />
            <stop offset="75%" stopColor="#E8A86D" />
            <stop offset="100%" stopColor="#F0C88A" />
          </linearGradient>
        </defs>
        <rect width="1200" height="700" fill="url(#golden-sky)" />

        {/* Stars — a few tiny dots in the upper sky */}
        <g fill="#FFFFFF">
          <circle cx="180" cy="45" r="1.2" opacity="0.6" />
          <circle cx="420" cy="80" r="1" opacity="0.4" />
          <circle cx="650" cy="35" r="1.3" opacity="0.55" />
          <circle cx="870" cy="65" r="1" opacity="0.45" />
          <circle cx="1050" cy="50" r="1.1" opacity="0.5" />
          <circle cx="300" cy="110" r="0.8" opacity="0.3" />
          <circle cx="780" cy="100" r="0.9" opacity="0.35" />
          <circle cx="1140" cy="90" r="1" opacity="0.4" />
        </g>

        {/* Mountains — dark silhouette tones */}
        <g fill="#3A2E4A">
          <polygon points="0,700 80,450 160,700" />
          <polygon points="120,700 220,380 320,700" />
          <polygon points="260,700 360,420 460,700" />
          <polygon points="400,700 520,350 640,700" />
          <polygon points="560,700 680,400 800,700" />
          <polygon points="720,700 840,380 960,700" />
          <polygon points="880,700 1000,440 1120,700" />
          <polygon points="1040,700 1140,460 1200,700" />
        </g>
        {/* Snow caps — dimmed to a muted lavender */}
        <g fill="#7B7090" opacity="0.5">
          <polygon points="56,580 80,450 104,580" />
          <polygon points="190,520 220,380 250,520" />
          <polygon points="328,548 360,420 392,548" />
          <polygon points="472,518 520,350 568,518" />
          <polygon points="632,540 680,400 728,540" />
          <polygon points="792,524 840,380 888,524" />
          <polygon points="952,564 1000,440 1048,564" />
          <polygon points="1100,576 1140,460 1180,576" />
        </g>

        {/* Sakura — deep muted reds/maroons (silhouette), dark trunks */}
        <g fill="#2A1A1A" stroke="#2A1A1A" strokeWidth="2">
          <rect x="145" y="560" width="10" height="60" />
          <rect x="345" y="548" width="10" height="72" />
          <rect x="545" y="552" width="10" height="68" />
          <rect x="745" y="556" width="10" height="64" />
          <rect x="945" y="550" width="10" height="70" />
        </g>
        <g fill="#6B2A3A">
          <circle cx="150" cy="518" r="26" />
          <circle cx="150" cy="498" r="20" />
          <circle cx="350" cy="522" r="30" />
          <circle cx="350" cy="498" r="22" />
          <circle cx="550" cy="520" r="28" />
          <circle cx="550" cy="502" r="20" />
          <circle cx="750" cy="518" r="26" />
          <circle cx="750" cy="500" r="20" />
          <circle cx="950" cy="520" r="28" />
          <circle cx="950" cy="502" r="22" />
        </g>

        {/* Buildings — dark indigo/purple silhouettes with warm glowing windows */}
        {[
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
        ].map((b, i) => {
          // Alternate building body colors in the indigo/purple range
          const bodyColor = i % 2 === 0 ? "#1E1A30" : "#2A2540";
          const roofColor = "#15112A";
          // Each window gets a slightly different opacity to feel alive
          const windowOpacities = [0.9, 0.6, 0.8, 0.5, 0.7, 0.4];
          return (
            <g key={i}>
              <rect
                x={b.x}
                y={700 - b.h}
                width={b.w}
                height={b.h}
                fill={bodyColor}
              />
              <rect
                x={b.x}
                y={700 - b.h}
                width={b.w}
                height="10"
                fill={roofColor}
              />
              {/* Window grid 2×3 — warm yellow glow */}
              {[0, 1].map((col) =>
                [0, 1, 2].map((row) => (
                  <rect
                    key={`${col}-${row}`}
                    x={b.x + 8 + (col * (b.w - 20)) / 2}
                    y={700 - b.h + 18 + (row * (b.h - 28)) / 3}
                    width={(b.w - 20) / 2 - 4}
                    height={(b.h - 28) / 3 - 4}
                    rx="2"
                    fill="#F5D98A"
                    opacity={windowOpacities[(col * 3 + row + i) % 6]}
                  />
                ))
              )}
            </g>
          );
        })}

        {/* Platform strip — dark muted tone */}
        <rect x="0" y="650" width="1200" height="50" fill="#2E2840" />

        {/* Station sign — 1号車 */}
        <rect x="24" y="608" width="52" height="32" rx="2" fill="#1A3A2F" />
        <text
          x="50"
          y="628"
          textAnchor="middle"
          fill="#D4CFC0"
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
