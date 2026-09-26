/**
 * 党の一覧。右端は得票率と、その回の最大の党を基準にした棒。
 * 「その他」にまとめられる小党もここからは選べる。
 */

import { useEffect, useRef } from "react";
import { man, pct } from "../data/format.ts";
import type { Palette } from "../data/load.ts";

export interface PartyRow {
  name: string;
  votes: number;
  share: number;
}

export function PartyList({
  rows,
  selected,
  onSelect,
  palette,
  allowNone = false,
}: {
  rows: PartyRow[];
  /** 空文字は「すべての党」（どの党も選んでいない）。 */
  selected: string;
  onSelect: (name: string) => void;
  palette: Palette;
  /** 先頭に「すべての党」の行を置き、選択を解除できるようにする。 */
  allowNone?: boolean;
}) {
  const max = Math.max(...rows.map((r) => r.share), 0.0001);
  const boxRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // 選んだ行が見えるよう、一覧の枠の中だけをスクロールする。scrollIntoView はページごと動かすので、
  // 一覧が本文の下に回る狭い画面では、開いた途端にページの末尾へ飛んでしまう。
  useEffect(() => {
    const box = boxRef.current;
    const el = selectedRef.current;
    if (box === null || el === null || box.scrollHeight <= box.clientHeight) return;
    const b = box.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (r.top < b.top) box.scrollTop += r.top - b.top;
    else if (r.bottom > b.bottom) box.scrollTop += r.bottom - b.bottom;
  }, [selected]);

  return (
    <div ref={boxRef} className="min-h-0 flex-1 overflow-y-auto">
    <ul className="flex flex-col">
      {allowNone && (
        <li className="mb-1 border-b border-rule pb-1">
          <button
            type="button"
            ref={selected === "" ? selectedRef : null}
            onClick={() => onSelect("")}
            aria-pressed={selected === ""}
            className={`flex w-full cursor-pointer items-center gap-2 rounded px-2 py-[3px] text-left transition-colors duration-150 ${
              selected === "" ? "bg-ink/[0.06]" : "hover:bg-ink/[0.03]"
            }`}
          >
            <span aria-hidden className="flex size-[9px] shrink-0 overflow-hidden rounded-[2px]">
              {rows.slice(0, 3).map((r) => (
                <span key={r.name} className="flex-1" style={{ backgroundColor: palette(r.name).base }} />
              ))}
            </span>
            <span className={`flex-1 text-[12px] ${selected === "" ? "font-semibold text-ink" : "text-muted"}`}>
              すべての党
            </span>
            <span className="tnum text-[11px] text-faint">{rows.length}党</span>
          </button>
        </li>
      )}
      {rows.map((row) => {
        const isSelected = row.name === selected;
        const c = palette(row.name);
        return (
          <li key={row.name}>
            <button
              type="button"
              ref={isSelected ? selectedRef : null}
              onClick={() => onSelect(row.name)}
              aria-pressed={isSelected}
              title={`${row.name} ${man(row.votes)}`}
              className={`flex w-full cursor-pointer items-center gap-2 rounded px-2 py-[3px] text-left transition-colors duration-150 ${
                isSelected ? "bg-ink/[0.06]" : "hover:bg-ink/[0.03]"
              }`}
            >
              <span aria-hidden className="size-[9px] shrink-0 rounded-[2px]" style={{ backgroundColor: c.base }} />
              <span
                className={`min-w-0 flex-1 truncate text-[12px] ${
                  isSelected ? "font-semibold text-ink" : "text-muted"
                }`}
              >
                {row.name}
              </span>
              <span
                className={`tnum w-[3.2rem] shrink-0 text-right text-[11px] ${
                  isSelected ? "text-ink" : "text-faint"
                }`}
              >
                {pct(row.share)}
              </span>
              <span className="h-[9px] w-[48px] shrink-0 bg-ink/[0.05]">
                <span
                  className="block h-full"
                  style={{
                    width: `${(row.share / max) * 100}%`,
                    backgroundColor: isSelected || selected === "" ? c.base : c.faded,
                  }}
                />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
    </div>
  );
}
