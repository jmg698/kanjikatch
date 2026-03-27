"use client";

/**
 * Static Japanese bamboo forest background for the sentence review ("See It In The Wild") screen.
 * Inspired by the Arashiyama Bamboo Grove in Kyoto: tall bamboo stalks, filtered canopy light,
 * mossy ground, and a small stone lantern (石灯籠). Complements the Shinkansen station scene
 * used during flash card review. Single crisp SVG, no parallax.
 */
export function StaticForestBackground() {
  return (
    <div
      className="absolute inset-0 z-0 overflow-hidden pointer-events-none dark:brightness-[0.65]"
      aria-hidden
    >
      <svg
        className="absolute w-full h-full"
        viewBox="0 0 1200 700"
        preserveAspectRatio="xMidYMax slice"
        shapeRendering="crispEdges"
      >
        {/* Sky — soft sage green, light filtering through canopy */}
        <rect width="1200" height="700" fill="#C8E6C0" />

        {/* Distant tree line — subtle depth behind bamboo */}
        <g fill="#7BAF6E" opacity="0.35">
          <ellipse cx="100" cy="340" rx="90" ry="60" />
          <ellipse cx="280" cy="330" rx="110" ry="70" />
          <ellipse cx="500" cy="345" rx="95" ry="55" />
          <ellipse cx="700" cy="335" rx="105" ry="65" />
          <ellipse cx="920" cy="340" rx="100" ry="60" />
          <ellipse cx="1120" cy="335" rx="90" ry="55" />
        </g>

        {/* Bamboo stalks — varying x positions, widths, and heights */}
        {[
          { x: 45, w: 10, top: 80, bottom: 700 },
          { x: 120, w: 9, top: 40, bottom: 700 },
          { x: 195, w: 11, top: 100, bottom: 700 },
          { x: 290, w: 10, top: 60, bottom: 700 },
          { x: 380, w: 9, top: 90, bottom: 700 },
          { x: 460, w: 11, top: 50, bottom: 700 },
          { x: 555, w: 10, top: 110, bottom: 700 },
          { x: 640, w: 9, top: 70, bottom: 700 },
          { x: 735, w: 11, top: 45, bottom: 700 },
          { x: 820, w: 10, top: 95, bottom: 700 },
          { x: 920, w: 9, top: 55, bottom: 700 },
          { x: 1010, w: 11, top: 85, bottom: 700 },
          { x: 1095, w: 10, top: 65, bottom: 700 },
          { x: 1160, w: 9, top: 100, bottom: 700 },
        ].map((b, i) => {
          // Generate node positions every 60-80px along the stalk
          const nodes: number[] = [];
          for (let y = b.top + 50; y < b.bottom - 40; y += 60 + (i % 3) * 10) {
            nodes.push(y);
          }
          return (
            <g key={i}>
              {/* Main stalk */}
              <rect
                x={b.x}
                y={b.top}
                width={b.w}
                height={b.bottom - b.top}
                fill="#3D7A3A"
              />
              {/* Light highlight stripe */}
              <rect
                x={b.x + 2}
                y={b.top}
                width={2}
                height={b.bottom - b.top}
                fill="#6AAE5E"
                opacity="0.3"
              />
              {/* Nodes (horizontal bands) */}
              {nodes.map((ny, ni) => (
                <rect
                  key={ni}
                  x={b.x - 1}
                  y={ny}
                  width={b.w + 2}
                  height={4}
                  fill="#2D5A2A"
                />
              ))}
            </g>
          );
        })}

        {/* Canopy — overlapping leaf clusters at the top */}
        <g fill="#5A8A4A">
          <ellipse cx="60" cy="60" rx="70" ry="45" />
          <ellipse cx="180" cy="40" rx="80" ry="50" />
          <ellipse cx="310" cy="55" rx="65" ry="40" />
          <ellipse cx="430" cy="35" rx="75" ry="48" />
          <ellipse cx="560" cy="50" rx="70" ry="42" />
          <ellipse cx="680" cy="38" rx="80" ry="50" />
          <ellipse cx="800" cy="55" rx="65" ry="38" />
          <ellipse cx="930" cy="42" rx="75" ry="46" />
          <ellipse cx="1060" cy="52" rx="70" ry="40" />
          <ellipse cx="1170" cy="40" rx="60" ry="44" />
        </g>
        <g fill="#4A7A3A">
          <ellipse cx="120" cy="75" rx="55" ry="35" />
          <ellipse cx="250" cy="65" rx="60" ry="38" />
          <ellipse cx="370" cy="80" rx="50" ry="32" />
          <ellipse cx="500" cy="70" rx="58" ry="36" />
          <ellipse cx="620" cy="78" rx="52" ry="34" />
          <ellipse cx="750" cy="68" rx="60" ry="38" />
          <ellipse cx="870" cy="76" rx="55" ry="35" />
          <ellipse cx="1000" cy="72" rx="58" ry="36" />
          <ellipse cx="1130" cy="78" rx="50" ry="32" />
        </g>

        {/* Mid-ground foliage — low bushes/ferns at bamboo bases */}
        <g fill="#4A7A42">
          <ellipse cx="80" cy="620" rx="50" ry="18" />
          <ellipse cx="200" cy="625" rx="45" ry="16" />
          <ellipse cx="350" cy="618" rx="55" ry="20" />
          <ellipse cx="510" cy="622" rx="48" ry="17" />
          <ellipse cx="680" cy="616" rx="52" ry="19" />
          <ellipse cx="850" cy="624" rx="46" ry="16" />
          <ellipse cx="1000" cy="619" rx="50" ry="18" />
          <ellipse cx="1140" cy="623" rx="45" ry="16" />
        </g>

        {/* Filtered light rays — very subtle */}
        <g fill="#FFFFFF" opacity="0.06">
          <polygon points="300,0 340,0 420,700 380,700" />
          <polygon points="700,0 740,0 820,700 780,700" />
          <polygon points="1000,0 1035,0 1100,700 1065,700" />
        </g>

        {/* Stone lantern (石灯籠) — right of center */}
        <g>
          {/* Finial (top knob) */}
          <rect x="862" y="548" width="6" height="8" fill="#7A7872" />
          {/* Roof (cap) */}
          <polygon points="848,556 882,556 888,566 842,566" fill="#7A7872" />
          {/* Light chamber */}
          <rect x="853" y="566" width="24" height="20" fill="#9E9B93" />
          {/* Window opening */}
          <rect x="860" y="570" width="10" height="12" rx="1" fill="#6B6860" />
          {/* Middle post */}
          <rect x="860" y="586" width="10" height="18" fill="#9E9B93" />
          {/* Base platform */}
          <rect x="851" y="604" width="28" height="6" fill="#9E9B93" />
          {/* Ground base */}
          <rect x="847" y="610" width="36" height="5" fill="#8A8780" />
        </g>

        {/* Mossy ground — undulating top edge via overlapping shapes */}
        <g fill="#6B9E5A">
          <ellipse cx="0" cy="645" rx="100" ry="12" />
          <ellipse cx="150" cy="640" rx="90" ry="14" />
          <ellipse cx="300" cy="643" rx="110" ry="11" />
          <ellipse cx="460" cy="638" rx="95" ry="13" />
          <ellipse cx="620" cy="642" rx="100" ry="12" />
          <ellipse cx="780" cy="637" rx="90" ry="14" />
          <ellipse cx="940" cy="641" rx="110" ry="11" />
          <ellipse cx="1100" cy="639" rx="100" ry="13" />
          <ellipse cx="1200" cy="643" rx="80" ry="12" />
        </g>

        {/* Ground/earth — solid strip beneath moss */}
        <rect x="0" y="645" width="1200" height="55" fill="#5C7A4E" />

        {/* Moss detail — small lighter patches on ground */}
        <g fill="#7DB86E" opacity="0.5">
          <ellipse cx="100" cy="655" rx="25" ry="6" />
          <ellipse cx="400" cy="658" rx="30" ry="5" />
          <ellipse cx="700" cy="652" rx="22" ry="6" />
          <ellipse cx="1050" cy="656" rx="28" ry="5" />
        </g>
      </svg>
    </div>
  );
}
