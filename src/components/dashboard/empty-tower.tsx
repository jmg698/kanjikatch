/**
 * Empty-state centerpiece — a single tower at dawn whose windows are mostly
 * dark, with one window already warmly lit. It speaks the same building
 * vocabulary as the dashboard cityscape (rectangular body + slate cap +
 * window grid + a sakura at the base) so the new-user screen feels like part
 * of the same world rather than a blank template.
 *
 * The metaphor: every kanji or word you catch lights another window. The
 * tower starts dark; the first capture lights it up.
 */

const COLORS = {
  body: "#A8AAB2",
  cap: "#4F5B66",
  windowDark: "#8E929B",
  amber: "#F4B860",
  trunk: "#5C4033",
  sakura: "#F9A1B1",
  sakuraDark: "#E58CA0",
  glow: "rgba(244, 184, 96, 0.35)",
};

const COLS = 3;
const ROWS = 6;

// Building geometry within the 160×210 viewBox.
const B = { x: 40, w: 80, top: 40, ground: 196 };
const PAD_X = 11;
const PAD_TOP = 14;
const PAD_BOTTOM = 12;
const GAP = 6;
const CAP_H = 6;

// The one window that's already lit — middle column, a few floors up.
const LIT = { col: 1, row: 3 };

function cell(col: number, row: number) {
  const gridW = B.w - PAD_X * 2;
  const innerH = (B.ground - B.top) - PAD_TOP - PAD_BOTTOM;
  const cellW = (gridW - (COLS - 1) * GAP) / COLS;
  const cellH = (innerH - (ROWS - 1) * GAP) / ROWS;
  return {
    x: B.x + PAD_X + col * (cellW + GAP),
    y: B.top + PAD_TOP + row * (cellH + GAP),
    w: cellW,
    h: cellH,
  };
}

function Sakura({ x, baseY, scale = 1 }: { x: number; baseY: number; scale?: number }) {
  const trunkH = 26 * scale;
  const r1 = 11 * scale;
  const r2 = 9 * scale;
  return (
    <g>
      <rect x={x - 1.5} y={baseY - trunkH} width={3} height={trunkH} fill={COLORS.trunk} />
      <circle cx={x - r1 * 0.45} cy={baseY - trunkH - r1 * 0.2} r={r1} fill={COLORS.sakura} />
      <circle cx={x + r1 * 0.55} cy={baseY - trunkH + r1 * 0.05} r={r2} fill={COLORS.sakura} />
      <circle cx={x} cy={baseY - trunkH - r2 * 0.85} r={r2 * 0.85} fill={COLORS.sakuraDark} opacity={0.55} />
    </g>
  );
}

export function EmptyTower() {
  const windows: React.ReactNode[] = [];
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const isLit = c === LIT.col && r === LIT.row;
      const rect = cell(c, r);
      windows.push(
        isLit ? (
          <rect
            key={`${c}-${r}`}
            className="city-amber-window"
            x={rect.x}
            y={rect.y}
            width={rect.w}
            height={rect.h}
            fill={COLORS.amber}
          />
        ) : (
          <rect
            key={`${c}-${r}`}
            x={rect.x}
            y={rect.y}
            width={rect.w}
            height={rect.h}
            fill={COLORS.windowDark}
          />
        ),
      );
    }
  }

  const lit = cell(LIT.col, LIT.row);

  return (
    <svg
      viewBox="0 0 160 210"
      className="mx-auto h-36 w-auto sm:h-44"
      role="img"
      aria-label="A tower at dawn with one lit window"
    >
      {/* Soft dawn glow behind the lit window */}
      <circle
        cx={lit.x + lit.w / 2}
        cy={lit.y + lit.h / 2}
        r={46}
        fill={COLORS.glow}
      />

      {/* Building body + slate cap */}
      <rect x={B.x} y={B.top} width={B.w} height={B.ground - B.top} fill={COLORS.body} />
      <rect x={B.x} y={B.top} width={B.w} height={CAP_H} fill={COLORS.cap} />

      {windows}

      {/* Sidewalk shadow */}
      <rect x={B.x - 14} y={B.ground} width={B.w + 28} height={3} fill={COLORS.cap} opacity={0.18} />

      {/* A small sakura at the base for warmth */}
      <Sakura x={B.x - 6} baseY={B.ground} scale={0.95} />
    </svg>
  );
}
