"use client";

/**
 * Static Japanese landscape background for the review screen: sky, mountains with snow caps,
 * sakura trees, buildings, platform, and station sign. Single crisp SVG, no parallax.
 * Scales cleanly on desktop and mobile. Card stays white on top (handled by parent).
 */
export function StaticShinkansenBackground() {
  return (
    <div
      className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
      aria-hidden
    >
      {/* Single SVG scene — crisp edges, reference palette, fills viewport */}
      <svg
        className="absolute w-full h-full"
        viewBox="0 0 1200 700"
        preserveAspectRatio="xMidYMax slice"
        shapeRendering="crispEdges"
      >
        {/* Sky — solid reference blue */}
        <rect width="1200" height="700" fill="#A9D6F1" />

        {/* Mountains — lavender-grey base, white snow caps (isosceles triangles) */}
        <g fill="#B4B9CC">
          <polygon points="0,700 80,450 160,700" />
          <polygon points="120,700 220,380 320,700" />
          <polygon points="260,700 360,420 460,700" />
          <polygon points="400,700 520,350 640,700" />
          <polygon points="560,700 680,400 800,700" />
          <polygon points="720,700 840,380 960,700" />
          <polygon points="880,700 1000,440 1120,700" />
          <polygon points="1040,700 1140,460 1200,700" />
        </g>
        <g fill="#FFFFFF">
          <polygon points="56,580 80,450 104,580" />
          <polygon points="190,520 220,380 250,520" />
          <polygon points="328,548 360,420 392,548" />
          <polygon points="472,518 520,350 568,518" />
          <polygon points="632,540 680,400 728,540" />
          <polygon points="792,524 840,380 888,524" />
          <polygon points="952,564 1000,440 1048,564" />
          <polygon points="1100,576 1140,460 1180,576" />
        </g>

        {/* Sakura — solid pink foliage, dark brown trunks */}
        <g fill="#5C4033" stroke="#5C4033" strokeWidth="2">
          <rect x="145" y="560" width="10" height="60" />
          <rect x="345" y="548" width="10" height="72" />
          <rect x="545" y="552" width="10" height="68" />
          <rect x="745" y="556" width="10" height="64" />
          <rect x="945" y="550" width="10" height="70" />
        </g>
        <g fill="#F9A1B1">
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

        {/* Buildings — neutral grey body, slate roof, window grid */}
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
        ].map((b, i) => (
          <g key={i}>
            <rect x={b.x} y={700 - b.h} width={b.w} height={b.h} fill="#B0B3B8" />
            <rect x={b.x} y={700 - b.h} width={b.w} height="10" fill="#4F5B66" />
            {/* Window grid 2×3 */}
            {[0, 1].map((col) =>
              [0, 1, 2].map((row) => (
                <rect
                  key={`${col}-${row}`}
                  x={b.x + 8 + col * (b.w - 20) / 2}
                  y={700 - b.h + 18 + row * (b.h - 28) / 3}
                  width={(b.w - 20) / 2 - 4}
                  height={(b.h - 28) / 3 - 4}
                  rx="2"
                  fill="#D8DCE0"
                />
              ))
            )}
          </g>
        ))}

        {/* Platform strip */}
        <rect x="0" y="650" width="1200" height="50" fill="#E2E6E8" />

        {/* Station sign — 1号車 */}
        <rect x="24" y="608" width="52" height="32" rx="2" fill="#2D6A4F" />
        <text
          x="50"
          y="628"
          textAnchor="middle"
          fill="#FFFFFF"
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
