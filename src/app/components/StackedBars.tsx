/**
 * 回ごとの積み上げ棒。
 *
 * 選挙は年次の連続系列ではないので、回と回のあいだを曲線で補間しない。
 * 棒（bars）は回の順に等間隔。流れ（flow）は執行日の位置に棒を置き、
 * 続けて出た党どうしだけを直線の帯でつなぐ。帯の途切れは党の出入りそのもの。
 */

import { scaleBand, scaleLinear } from "d3-scale";
import { election, man, pct, year } from "../data/format.ts";
import type { Segment } from "../data/parties.ts";
import { useWidth } from "../hooks/useWidth.ts";

export type Measure = "votes" | "share";
export type Layout = "bars" | "flow";

export interface Column {
  n: number;
  total: number;
  segments: Segment[];
  /** 年の下に添える小さな注記（定数など）。流れでは隣と重なるので出さない。 */
  note?: string;
}

interface Placed {
  column: Column;
  x0: number;
  bw: number;
  /** 下から積んだ各党の上端・下端（ピクセル）。 */
  stacks: { segment: Segment; top: number; bottom: number }[];
}

const int = new Intl.NumberFormat("ja-JP");

export function StackedBars({
  columns,
  measure,
  layout = "bars",
  highlighted,
  focused,
  onFocus,
  height = 300,
  label,
}: {
  columns: Column[];
  measure: Measure;
  layout?: Layout;
  /** 空文字なら全党を同じ濃さで描く。 */
  highlighted: string;
  focused: number | null;
  onFocus: (n: number) => void;
  height?: number;
  label: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const flow = layout === "flow";
  const hasNotes = !flow && columns.some((c) => c.note !== undefined);
  const M = { left: 46, right: 6, top: 18, bottom: hasNotes ? 46 : 32 };
  const right = Math.max(M.left + 1, width - M.right);

  const maxTotal = Math.max(...columns.map((c) => c.total), 1);
  const y = scaleLinear()
    .domain([0, measure === "share" ? 1 : maxTotal])
    .nice(4)
    .range([height - M.bottom, M.top]);
  const ticks = y.ticks(4);
  const tick = (v: number) =>
    measure === "share" ? `${Math.round(v * 100)}%` : `${int.format(v / 10_000)}万`;
  const scale = (c: Column, v: number) => (measure === "share" ? v / c.total : v);

  const centers = (() => {
    if (!flow) {
      const band = scaleBand<number>()
        .domain(columns.map((c) => c.n))
        .range([M.left, right])
        .paddingInner(0.3)
        .paddingOuter(0.12);
      return { bw: band.bandwidth(), at: (c: Column) => band(c.n)! + band.bandwidth() / 2 };
    }
    const t = (c: Column) => Date.parse(election(c.n).date);
    const pad = 16;
    const time = scaleLinear()
      .domain([t(columns[0]!), t(columns.at(-1)!)])
      .range([M.left + pad, right - pad]);
    const gaps = columns.slice(1).map((c, i) => time(t(c)) - time(t(columns[i]!)));
    const bw = Math.min(26, Math.max(8, Math.min(...gaps) * 0.45));
    return { bw, at: (c: Column) => time(t(c)) };
  })();

  const placed: Placed[] = columns.map((c) => {
    let acc = 0;
    const stacks = c.segments.map((segment) => {
      const v = scale(c, segment.value);
      const bottom = y(acc);
      acc += v;
      return { segment, top: y(acc), bottom };
    });
    return { column: c, x0: centers.at(c) - centers.bw / 2, bw: centers.bw, stacks };
  });

  const emphasized = (key: string) => highlighted === "" || key === highlighted;

  return (
    <div ref={ref} className="w-full">
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={label} className="block">
          {ticks.map((t) => (
            <g key={t} transform={`translate(0,${y(t)})`}>
              <line x1={M.left} x2={width - M.right} className="stroke-rule" />
              <text x={M.left - 6} dy="0.32em" textAnchor="end" className="tnum fill-faint text-[10px]">
                {tick(t)}
              </text>
            </g>
          ))}

          {flow &&
            placed.slice(1).map((b, i) => {
              const a = placed[i]!;
              return (
                <g key={`${a.column.n}-${b.column.n}`} aria-hidden className="pointer-events-none">
                  {a.stacks.map((sa) => {
                    const sb = b.stacks.find((s) => s.segment.key === sa.segment.key);
                    if (sb === undefined) return null;
                    const x1 = a.x0 + a.bw;
                    const x2 = b.x0;
                    const picked = highlighted !== "" && sa.segment.key === highlighted;
                    return (
                      <path
                        key={sa.segment.key}
                        d={`M${x1},${sa.top}L${x2},${sb.top}L${x2},${sb.bottom}L${x1},${sa.bottom}Z`}
                        fill={picked ? sa.segment.color : sa.segment.faded}
                        opacity={picked ? 0.45 : emphasized(sa.segment.key) ? 1 : 0.35}
                        className="transition-[fill,opacity] duration-150 ease-out"
                      />
                    );
                  })}
                </g>
              );
            })}

          {placed.map(({ column: c, x0, bw, stacks }) => {
            const isFocused = c.n === focused;
            const pick = stacks.find((s) => s.segment.key === highlighted);
            const e = election(c.n);
            const cx = x0 + bw / 2;
            const hit = Math.max(bw * 1.36, 30);
            return (
              <g
                key={c.n}
                role="button"
                tabIndex={0}
                aria-pressed={isFocused}
                aria-label={`第${c.n}回（${year(c.n)}年）`}
                onClick={() => onFocus(c.n)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    onFocus(c.n);
                  }
                }}
                className="group cursor-pointer outline-none"
              >
                <rect
                  x={cx - hit / 2}
                  width={hit}
                  y={M.top - 16}
                  height={height - M.top + 16 - 2}
                  rx={4}
                  className={`group-focus-visible:stroke-ink group-focus-visible:stroke-2 ${
                    isFocused ? "fill-ink/[0.045]" : "fill-transparent hover:fill-ink/[0.025]"
                  }`}
                />
                {stacks.map(({ segment: s, top, bottom }) => (
                  <rect
                    key={s.key}
                    x={x0}
                    width={bw}
                    y={top}
                    height={Math.max(0, bottom - top - 0.5)}
                    fill={emphasized(s.key) ? s.color : s.faded}
                    className="transition-[fill] duration-150 ease-out"
                  >
                    <title>{`${s.key} ${man(s.value)}（${pct(s.value / c.total)}）`}</title>
                  </rect>
                ))}
                {pick !== undefined && (
                  <text
                    x={cx}
                    y={(measure === "share" ? pick.top : y(scale(c, c.total))) - 4}
                    textAnchor="middle"
                    className="tnum fill-ink text-[10px] font-semibold"
                  >
                    {measure === "share"
                      ? pct(pick.segment.value / c.total)
                      : man(pick.segment.value).replace("票", "")}
                  </text>
                )}
                <text
                  x={cx}
                  y={height - M.bottom + 14}
                  textAnchor="middle"
                  className={`tnum text-[10.5px] ${isFocused ? "fill-ink font-semibold" : "fill-muted"}`}
                >
                  {year(c.n)}
                </text>
                {e.edition === "速報" && (
                  <text x={cx} y={height - M.bottom + 25} textAnchor="middle" className="fill-ink text-[9px] font-semibold">
                    速報
                  </text>
                )}
                {hasNotes && c.note !== undefined && (
                  <text
                    x={cx}
                    y={height - M.bottom + (e.edition === "速報" ? 36 : 26)}
                    textAnchor="middle"
                    className="tnum fill-faint text-[9px]"
                  >
                    {c.note}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
