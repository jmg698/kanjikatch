/**
 * Dashboard scene — a single peaceful dawn world that the central facade
 * column sits inside of. Same building vocabulary as the review screen
 * (rectangular body + slate cap + window grid + sakura trees), but pulled
 * back as scenery flanking the dashboard "building" rather than dominating.
 *
 * Layered (back to front):
 *   1. Peach dawn sky gradient covering the full viewport
 *   2. Distant lavender mountain silhouettes on the horizon
 *   3. Asymmetric side cityscapes (left + right), with one breathing amber window
 *   4. Sakura along the sidewalk at the base
 *
 * The central facade column is rendered separately by FacadeColumn and sits
 * on top of the side cityscapes, framed by them.
 */

const SIDE_W = 720;
const SIDE_H = 480;
const GROUND = 480;

const PAD_X = 8;
const PAD_TOP = 12;
const PAD_BOTTOM = 8;
const GAP = 4;

type Building = {
  x: number;
  w: number;
  h: number;
  cols: number;
  rows: number;
};

// Buildings on the LEFT side, ordered closest-to-facade first.
// x is measured from the right edge of the SVG (the side closest to the
// facade), so building.x = 0 means it kisses the facade's left wall.
const LEFT_BUILDINGS: Building[] = [
  { x: 0,   w: 130, h: 280, cols: 3, rows: 5 },
  { x: 110, w: 100, h: 220, cols: 2, rows: 4 },
  { x: 195, w: 140, h: 320, cols: 3, rows: 6 },
  { x: 320, w: 110, h: 240, cols: 2, rows: 4 },
  { x: 415, w: 130, h: 200, cols: 3, rows: 4 },
  { x: 540, w: 100, h: 170, cols: 2, rows: 3 },
];

const RIGHT_BUILDINGS: Building[] = [
  { x: 0,   w: 130, h: 260, cols: 3, rows: 5 },
  { x: 115, w: 110, h: 200, cols: 2, rows: 4 },
  { x: 210, w: 130, h: 300, cols: 3, rows: 5 },
  { x: 325, w: 100, h: 230, cols: 2, rows: 4 },
  { x: 415, w: 140, h: 210, cols: 3, rows: 4 },
  { x: 545, w: 100, h: 175, cols: 2, rows: 3 },
];

// Distant background skyline — narrow, no windows, very faint.
const DISTANT: { x: number; w: number; h: number }[] = [
  { x: 30,  w: 50, h: 150 },
  { x: 90,  w: 64, h: 195 },
  { x: 175, w: 56, h: 165 },
  { x: 270, w: 48, h: 140 },
  { x: 350, w: 60, h: 175 },
  { x: 440, w: 52, h: 160 },
  { x: 520, w: 64, h: 190 },
  { x: 610, w: 50, h: 145 },
];

// Cohesive review-scene palette, gently dimmed so dashboard reads as
// "looking out from inside a building at dawn" rather than full daylight.
const COLORS = {
  distant: "#C8B8B0",
  body: "#A8AAB2",
  cap: "#4F5B66",
  window: "#D8DCE0",
  trunk: "#5C4033",
  sakura: "#F9A1B1",
  sakuraDark: "#E58CA0",
  amber: "#F4B860",
  groundShadow: "#B89B83",
};

function windowCell(b: Building, col: number, row: number) {
  const top = GROUND - b.h;
  const gridW = b.w - PAD_X * 2;
  const gridH = b.h - PAD_TOP - PAD_BOTTOM;
  const cellW = (gridW - (b.cols - 1) * GAP) / b.cols;
  const cellH = (gridH - (b.rows - 1) * GAP) / b.rows;
  return {
    x: b.x + PAD_X + col * (cellW + GAP),
    y: top + PAD_TOP + row * (cellH + GAP),
    w: cellW,
    h: cellH,
  };
}

function BuildingShape({
  b,
  body,
  cap,
  windowFill,
  capHeight = 5,
  skipCell,
}: {
  b: Building;
  body: string;
  cap: string;
  windowFill: string;
  capHeight?: number;
  skipCell?: { col: number; row: number };
}) {
  const top = GROUND - b.h;
  const cells: React.ReactNode[] = [];
  for (let c = 0; c < b.cols; c++) {
    for (let r = 0; r < b.rows; r++) {
      if (skipCell && c === skipCell.col && r === skipCell.row) continue;
      const cell = windowCell(b, c, r);
      cells.push(
        <rect
          key={`${c}-${r}`}
          x={cell.x}
          y={cell.y}
          width={cell.w}
          height={cell.h}
          fill={windowFill}
        />,
      );
    }
  }
  return (
    <g>
      <rect x={b.x} y={top} width={b.w} height={b.h} fill={body} />
      <rect x={b.x} y={top} width={b.w} height={capHeight} fill={cap} />
      {cells}
    </g>
  );
}

function Sakura({ x, baseY, scale = 1 }: { x: number; baseY: number; scale?: number }) {
  const trunkH = 38 * scale;
  const r1 = 14 * scale;
  const r2 = 11 * scale;
  return (
    <g>
      <rect
        x={x - 2}
        y={baseY - trunkH}
        width={4}
        height={trunkH}
        fill={COLORS.trunk}
      />
      <circle cx={x - r1 * 0.45} cy={baseY - trunkH - r1 * 0.2} r={r1} fill={COLORS.sakura} />
      <circle cx={x + r1 * 0.55} cy={baseY - trunkH + r1 * 0.05} r={r2} fill={COLORS.sakura} />
      <circle cx={x} cy={baseY - trunkH - r2 * 0.85} r={r2 * 0.85} fill={COLORS.sakuraDark} opacity={0.55} />
    </g>
  );
}

function SideCityscape({ side }: { side: "left" | "right" }) {
  const buildings = side === "left" ? LEFT_BUILDINGS : RIGHT_BUILDINGS;
  // Mirror the left side so its tallest building sits flush against the
  // facade on the right edge of the SVG.
  const transform = side === "left" ? `scale(-1, 1) translate(-${SIDE_W}, 0)` : undefined;

  // One breathing amber window — only on the right side, in a mid building.
  const amberBuildingIndex = 2;
  const amberCol = 1;
  const amberRow = 2;
  const amberBuilding = side === "right" ? buildings[amberBuildingIndex] : null;
  const amberCellRect = amberBuilding ? windowCell(amberBuilding, amberCol, amberRow) : null;

  // Sakura placement: a few small trees along the sidewalk in front of buildings.
  const sakuraSpots =
    side === "left"
      ? [
          { x: 70, scale: 0.85 },
          { x: 245, scale: 0.95 },
          { x: 470, scale: 0.8 },
        ]
      : [
          { x: 90, scale: 0.9 },
          { x: 280, scale: 0.85 },
          { x: 500, scale: 0.95 },
        ];

  return (
    <div
      className={`absolute bottom-0 ${side === "left" ? "left-0" : "right-0"} pointer-events-none`}
      style={{
        width: "min(45vw, 720px)",
        height: "min(48vh, 460px)",
      }}
      aria-hidden
    >
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox={`0 0 ${SIDE_W} ${SIDE_H}`}
        preserveAspectRatio={
          side === "left" ? "xMinYMax slice" : "xMaxYMax slice"
        }
        shapeRendering="crispEdges"
      >
        <g transform={transform}>
          {/* Distant skyline silhouettes */}
          <g opacity="0.55">
            {DISTANT.map((b, i) => (
              <rect
                key={`distant-${i}`}
                x={b.x}
                y={GROUND - b.h}
                width={b.w}
                height={b.h}
                fill={COLORS.distant}
              />
            ))}
          </g>

          {/* Mid-distance buildings with windows */}
          {buildings.map((b, i) => {
            const isAmber =
              side === "right" && i === amberBuildingIndex;
            return (
              <BuildingShape
                key={`b-${i}`}
                b={b}
                body={COLORS.body}
                cap={COLORS.cap}
                windowFill={COLORS.window}
                capHeight={6}
                skipCell={
                  isAmber ? { col: amberCol, row: amberRow } : undefined
                }
              />
            );
          })}

          {/* Sidewalk shadow strip just in front of buildings */}
          <rect
            x={0}
            y={GROUND - 3}
            width={SIDE_W}
            height={3}
            fill={COLORS.cap}
            opacity={0.18}
          />

          {/* Sakura at the sidewalk */}
          {sakuraSpots.map((s, i) => (
            <Sakura key={`s-${i}`} x={s.x} baseY={GROUND - 2} scale={s.scale} />
          ))}

          {/* Breathing amber window, only on the right side */}
          {amberCellRect && (
            <rect
              className="city-amber-window"
              x={amberCellRect.x}
              y={amberCellRect.y}
              width={amberCellRect.w}
              height={amberCellRect.h}
              fill={COLORS.amber}
            />
          )}
        </g>

      </svg>
    </div>
  );
}

export function StaticCityscapeBackground() {
  return (
    <>
      {/* Dawn sky — fixed, covers the entire viewport including behind nav.
          This is the "calm at dawn" mood the dashboard sits in. */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background:
            "#D0D4DB",
        }}
        aria-hidden
      />

      {/* Side cityscapes — flanking scenery, hidden on mobile where the
          facade fills the screen. Container uses the page's max width as a
          ceiling so the buildings always tuck in toward the facade. */}
      <div
        className="hidden md:block fixed inset-x-0 bottom-0 z-0 pointer-events-none"
        style={{ height: "min(48vh, 460px)" }}
        aria-hidden
      >
        <div className="relative w-full h-full">
          <SideCityscape side="left" />
          <SideCityscape side="right" />
        </div>
      </div>
    </>
  );
}
