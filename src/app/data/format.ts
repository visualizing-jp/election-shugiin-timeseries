import { ELECTIONS, type Election } from "../../lib/data/elections.ts";

const int = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 });
const one = new Intl.NumberFormat("ja-JP", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** 得票数は万票に丸めて見せる。按分票の小数は画面では意味を持たない。 */
export function man(votes: number): string {
  return `${int.format(Math.round(votes / 10_000))}万票`;
}

export function exact(votes: number): string {
  return `${int.format(Math.round(votes))}票`;
}

export function pct(share: number): string {
  return `${one.format(share * 100)}%`;
}

const BY_N = new Map(ELECTIONS.map((e) => [e.n, e]));

export function election(n: number): Election {
  const e = BY_N.get(n);
  if (e === undefined) throw new Error(`第${n}回は目録にない`);
  return e;
}

export function year(n: number): string {
  return election(n).date.slice(0, 4);
}

export function longDate(n: number): string {
  const [y, m, d] = election(n).date.split("-").map(Number);
  return `${y}年${m}月${d}日`;
}
