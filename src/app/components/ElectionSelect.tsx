/**
 * 回の選択。8回分あるのでセグメントでは横に長くなりすぎる。
 * 独自のポップオーバーは作らず、ネイティブの select に見た目だけ当てる。
 */

import { election, year } from "../data/format.ts";

export function ElectionSelect({
  elections,
  value,
  onChange,
}: {
  elections: number[];
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="relative flex items-center">
      <span className="sr-only">選挙</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="tnum cursor-pointer appearance-none rounded-md border border-rule bg-surface py-1 pr-7 pl-3 text-[12px] font-medium transition-colors duration-150 hover:border-rule-strong"
      >
        {[...elections].reverse().map((n) => (
          <option key={n} value={n}>
            {year(n)}年 第{n}回{election(n).edition === "速報" ? "（速報）" : ""}
          </option>
        ))}
      </select>
      <svg
        viewBox="0 0 10 6"
        width="9"
        height="6"
        aria-hidden
        className="pointer-events-none absolute right-2.5 fill-none stroke-muted"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M1 1l4 4 4-4" />
      </svg>
    </label>
  );
}
