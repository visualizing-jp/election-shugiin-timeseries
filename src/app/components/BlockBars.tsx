/**
 * 比例代表の11ブロック。北から南の順に、選んだ党の得票率を横棒で並べる。
 * 棒の長さは 0〜100% で固定し、党・回を切り替えても同じ長さは同じ率を表す。
 */

import { pct } from "../data/format.ts";

export interface BlockRow {
  name: string;
  /** null はそのブロックに名簿がない。 */
  share: number | null;
}

export function BlockBars({
  rows,
  color,
  pinned,
  onPin,
}: {
  rows: BlockRow[];
  color: string;
  pinned: string | null;
  onPin: (name: string | null) => void;
}) {
  return (
    <ul className="flex max-w-[640px] flex-col gap-[3px]">
      {rows.map((row) => {
        const isPinned = row.name === pinned;
        return (
          <li key={row.name}>
            <button
              type="button"
              aria-pressed={isPinned}
              onClick={() => onPin(isPinned ? null : row.name)}
              className={`flex w-full cursor-pointer items-center gap-3 rounded-[3px] border px-2.5 py-1.5 text-left transition-[border-color,box-shadow,transform] duration-150 ease-out active:scale-[0.99] ${
                isPinned ? "border-ink bg-surface shadow-[0_0_0_1px_var(--color-ink)]" : "border-rule bg-surface/60 hover:border-ink"
              }`}
            >
              <span className={`w-[4.5rem] shrink-0 text-[12px] ${isPinned ? "font-semibold" : "text-muted"}`}>
                {row.name}
              </span>
              <span className="relative h-[14px] flex-1 bg-ink/[0.04]">
                {row.share !== null && (
                  <span
                    className="absolute inset-0 origin-left transition-transform duration-200 ease-out"
                    style={{ transform: `scaleX(${row.share})`, backgroundColor: color }}
                  />
                )}
              </span>
              <span className="tnum w-[3.4rem] shrink-0 text-right text-[12px] font-medium">
                {row.share === null ? <span className="text-faint">名簿なし</span> : pct(row.share)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
