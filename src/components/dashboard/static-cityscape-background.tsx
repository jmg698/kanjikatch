/**
 * Dashboard cityscape — three depth-layers of the same building vocabulary
 * used in the review scene (rectangular body + slate cap + window grid),
 * stacked back-to-front to imply a dense industrial skyline. Cool graphite
 * palette, fades into transparency at the top so the warm page background
 * still reads. Single point of motion: one amber window slowly breathing.
 */

const VIEW_W = 1440;
const VIEW_H = 480;
const GROUND = 480;

const PAD_X = 10;
const PAD_TOP = 14;
const PAD_BOTTOM = 10;
const GAP = 4;

type Building = {
  x: number;
  w: number;
  h: number;
  cols?: number;
  rows?: number;
};

// Distant skyline — narrow towers, lightest tone, no windows.
const BACK: Building[] = [
  { x: 180, w: 64, h: 320 },
  { x: 400, w: 78, h: 380 },
  { x: 680, w: 82, h: 410 },
  { x: 920, w: 70, h: 360 },
  { x: 1180, w: 68, h: 330 },
];

// Mid-distance — medium mass, sparse window grid, slotted between back towers.
const MIDDLE: Building[] = [
  { x: 60, w: 110, h: 240, cols: 2, rows: 4 },
  { x: 290, w: 130, h: 265, cols: 3, rows: 4 },
  { x: 520, w: 120, h: 250, cols: 2, rows: 4 },
  { x: 790, w: 130, h: 275, cols: 3, rows: 4 },
  { x: 1050, w: 120, h: 255, cols: 2, rows: 4 },
];

// Foreground — broad chunky blocks, denser window grid, darkest tone.
// Edges run off the viewBox left/right so the city reads as continuous.
const FRONT: Building[] = [
  { x: -20, w: 170, h: 180, cols: 3, rows: 3 },
  { x: 200, w: 210, h: 210, cols: 4, rows: 4 },
  { x: 440, w: 190, h: 195, cols: 4, rows: 3 },
  { x: 660, w: 220, h: 225, cols: 4, rows: 4 },
  { x: 910, w: 200, h: 210, cols: 4, rows: 4 },
  { x: 1140, w: 190, h: 200, cols: 4, rows: 3 },
  { x: 1380, w: 160, h: 180, cols: 3, rows: 3 },
];

const COLORS = {
  back: { body: "#9CA3AF", cap: "#7B8290" },
  middle: { body: "#6B7280", cap: "#4B5563", window: "#B8C0CC" },
  front: { body: "#374151", cap: "#1F2937", window: "#5B6470" },
};

// Focal building gets a single warm window — the only motion in the scene.
const AMBER_BUILDING_INDEX = 3;
const AMBER_COL = 1;
const AMBER_ROW = 2;

function windowCell(b: Building, col: number, row: number) {
  const top = GROUND - b.h;
  const gridW = b.w - PAD_X * 2;
  const gridH = b.h - PAD_TOP - PAD_BOTTOM;
  const cellW = (gridW - (b.cols! - 1) * GAP) / b.cols!;
  const cellH = (gridH - (b.rows! - 1) * GAP) / b.rows!;
  return {
    x: b.x + PAD_X + col * (cellW + GAP),
    y: top + PAD_TOP + row * (cellH + GAP),
    w: cellW,
    h: cellH,
  };
}

function BuildingShape(props: {
  b: Building;
  body: string;
  cap: string;
  windowFill?: string;
  skipCell?: { col: number; row: number };
}) {
  const { b, body, cap, windowFill, skipCell } = props;
  const top = GROUND - b.h;
  const cells: React.ReactNode[] = [];
  if (b.cols && b.rows && windowFill) {
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
          />
        );
      }
    }
  }
  return (
    <g>
      <rect x={b.x} y={top} width={b.w} height={b.h} fill={body} />
      <rect x={b.x} y={top} width={b.w} height={5} fill={cap} />
      {cells}
    </g>
  );
}

export function StaticCityscapeBackground() {
  const focal = FRONT[AMBER_BUILDING_INDEX];
  const amberCell = windowCell(focal, AMBER_COL, AMBER_ROW);

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-0 pointer-events-none overflow-hidden"
      style={{ height: "min(42vh, 440px)" }}
      aria-hidden
    >
      <svg
        className="absolute inset-x-0 bottom-0 w-full h-full"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMax slice"
        shapeRendering="crispEdges"
      >
        <defs>
          <linearGradient id="city-sky-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E5E7EB" stopOpacity="0" />
            <stop offset="50%" stopColor="#D1D5DB" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#A8B0BA" stopOpacity="0.78" />
          </linearGradient>
        </defs>

        <rect width={VIEW_W} height={VIEW_H} fill="url(#city-sky-fade)" />

        {BACK.map((b, i) => (
          <BuildingShape key={`back-${i}`} b={b} body={COLORS.back.body} cap={COLORS.back.cap} />
        ))}

        {/* Antenna on the tallest back tower */}
        <line
          x1={BACK[2].x + BACK[2].w / 2}
          y1={GROUND - BACK[2].h}
          x2={BACK[2].x + BACK[2].w / 2}
          y2={GROUND - BACK[2].h - 38}
          stroke={COLORS.back.cap}
          strokeWidth="1.5"
        />

        {MIDDLE.map((b, i) => (
          <BuildingShape
            key={`mid-${i}`}
            b={b}
            body={COLORS.middle.body}
            cap={COLORS.middle.cap}
            windowFill={COLORS.middle.window}
          />
        ))}

        {FRONT.map((b, i) => (
          <BuildingShape
            key={`front-${i}`}
            b={b}
            body={COLORS.front.body}
            cap={COLORS.front.cap}
            windowFill={COLORS.front.window}
            skipCell={i === AMBER_BUILDING_INDEX ? { col: AMBER_COL, row: AMBER_ROW } : undefined}
          />
        ))}

        {/* Rooftop water tank on the focal building — a small architectural anchor */}
        <rect
          x={focal.x + focal.w / 2 - 22}
          y={GROUND - focal.h - 12}
          width={44}
          height={12}
          fill={COLORS.front.cap}
        />

        {/* The breathing amber window — the only motion */}
        <rect
          className="city-amber-window"
          x={amberCell.x}
          y={amberCell.y}
          width={amberCell.w}
          height={amberCell.h}
          fill="#F4B860"
        />

        {/* Platform edge */}
        <rect x="0" y={GROUND - 2} width={VIEW_W} height="2" fill="#1F2937" opacity="0.35" />
      </svg>
    </div>
  );
}
