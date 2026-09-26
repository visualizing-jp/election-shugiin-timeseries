/**
 * 都道府県のタイル地図。選んだ党の得票率で塗る。
 * 色相は党、明度は得票率（0〜100%、全党共通の関数）。同じ明るさはどの党でも同じ率を表す。
 */

import { shareColor } from "../../lib/data/palette.ts";
import { pct } from "../data/format.ts";

const LAYOUT = [
  "........................01",
  "........................02",
  "......................0503",
  "......................0604",
  "....................1507..",
  "..............171620100908",
  "..............1821..111312",
  "....3231..2625..23221914..",
  "..35343328272924..........",
  "404438373630..............",
  "4143..39..................",
  "424645....................",
  "..........................",
  "47........................",
];

const COLS = 13;
const PAPER = "#f7f5f1";

export interface Tile {
  code: string;
  label: string;
  /** null はその県に候補がいない。 */
  share: number | null;
}

function short(label: string): string {
  return label === "北海道" ? label : label.replace(/[都府県]$/, "");
}

/** 文字の墨色。styles.css の --color-ink と同じ。 */
const INK = "#16140f";

/** WCAG 2 の相対輝度。 */
function luminance(hex: string): number {
  const [r, g, b] = (hex.match(/[\da-f]{2}/gi) ?? []).map((h) => {
    const c = parseInt(h, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 白字と墨字のうち、塗りとのコントラスト比が高いほうを選ぶ。白字なら true。 */
function isDark(hex: string): boolean {
  const bg = luminance(hex);
  return (1 + 0.05) / (bg + 0.05) > (bg + 0.05) / (luminance(INK) + 0.05);
}

export function TileMap({
  tiles,
  hue,
  pinned,
  onPin,
}: {
  tiles: Tile[];
  /** 選んだ党の色相。無彩色の党は null。 */
  hue: number | null;
  pinned: string | null;
  onPin: (code: string | null) => void;
}) {
  const byCode = new Map(tiles.map((t) => [t.code, t]));
  const color = (share: number) => shareColor(hue, share);

  return (
    <div className="mx-[-0.5rem] overflow-x-auto px-2">
      <div
        className="grid aspect-[13/14] max-w-[640px] min-w-[440px] gap-[3px]"
        style={{
          gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${LAYOUT.length}, minmax(0, 1fr))`,
        }}
      >
        <div className="flex flex-col justify-start pt-1" style={{ gridColumn: "1 / 8", gridRow: "1 / 5" }}>
          <Legend color={color} />
        </div>
        {LAYOUT.flatMap((row, r) =>
          Array.from({ length: COLS }, (_, c) => {
            const code = row.slice(c * 2, c * 2 + 2);
            const tile = code === ".." ? undefined : byCode.get(code);
            if (tile === undefined) return null;
            const isPinned = tile.code === pinned;
            const bg = tile.share === null ? PAPER : color(tile.share);
            const dark = tile.share !== null && isDark(bg);
            return (
              <button
                type="button"
                key={tile.code}
                aria-pressed={isPinned}
                onClick={() => onPin(isPinned ? null : tile.code)}
                title={`${tile.label} ${tile.share === null ? "候補なし" : pct(tile.share)}`}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-[3px] border transition-[box-shadow,transform,background-color] duration-150 ease-out active:scale-[0.97] ${
                  isPinned ? "border-ink shadow-[0_0_0_1.5px_var(--color-ink)]" : "border-rule hover:border-ink"
                }`}
                style={{ gridColumn: c + 1, gridRow: r + 1, backgroundColor: bg }}
              >
                <span className={`text-[9.5px] leading-tight ${dark ? "text-white/80" : "text-ink/70"}`}>
                  {short(tile.label)}
                </span>
                <span
                  className={`tnum text-[11px] leading-tight ${
                    tile.share === null ? "text-faint" : dark ? "font-medium text-white" : "font-medium"
                  }`}
                >
                  {tile.share === null ? "—" : pct(tile.share)}
                </span>
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}

function Legend({ color }: { color: (share: number) => string }) {
  const stops = Array.from({ length: 11 }, (_, i) => `${color(i / 10)} ${i * 10}%`).join(", ");
  return (
    <div className="max-w-[240px] text-[10.5px] leading-relaxed text-muted">
      <p className="pb-1.5">得票率</p>
      <div className="flex items-center gap-2">
        <span className="tnum">0%</span>
        <span
          className="h-[7px] flex-1 rounded-full border border-rule"
          style={{ background: `linear-gradient(to right, ${stops})` }}
        />
        <span className="tnum">100%</span>
      </div>
      <p className="pt-1 text-faint">色は党、明るさは得票率。明るさの尺度は全党・全回で共通。「—」は候補なし。</p>
    </div>
  );
}

if (import.meta.env.DEV) {
  const codes = LAYOUT.flatMap((row) => row.match(/../g) ?? []).filter((s) => s !== "..");
  if (new Set(codes).size !== 47) {
    throw new Error(`タイル配置の県が ${new Set(codes).size} 個しかない`);
  }
  if (LAYOUT.some((row) => row.length !== COLS * 2)) {
    throw new Error(`タイル配置の行の長さが ${COLS * 2} 文字でない`);
  }
}
