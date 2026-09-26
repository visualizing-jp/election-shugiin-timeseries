/**
 * PDF しかない回（第44回）の表を `pdftotext -layout` の出力から読む。
 *
 * 空欄は詰まって消えるので、数値の並び順では党を決められない。
 * 数値は列の右端に揃っているため、数値の右端より左にある最後の見出しをその列とする。
 */

import { execFileSync } from "node:child_process";
import { BLOCKS, PREFECTURES } from "../data/areas.ts";
import { TOTAL, clean, votes } from "./cells.ts";
import { toAreaVotes } from "./excel.ts";
import type { AreaVotes } from "./types.ts";

const PREF_SET = new Set<string>(PREFECTURES);
const BLOCKS_LONGEST_FIRST = [...BLOCKS].sort((a, b) => b.length - a.length);

export function readLayout(path: string): string[] {
  return execFileSync("pdftotext", ["-layout", path, "-"], { encoding: "utf8" })
    .replace(/\f/g, "\n")
    .split("\n");
}

interface Token {
  text: string;
  start: number;
  end: number;
}

function tokens(line: string, pattern: RegExp): Token[] {
  return [...line.matchAll(pattern)].map((m) => ({
    text: m[0],
    start: m.index,
    end: m.index + m[0].length,
  }));
}

const NUMBER = /\d[\d,]*(?:\.\d+)?/g;

/** 行頭の数字でない部分（地域名）と、数値トークン。 */
function splitRow(line: string): { label: string; numbers: Token[] } {
  const first = line.search(/\d/);
  const label = clean(first < 0 ? line : line.slice(0, first));
  return { label, numbers: first < 0 ? [] : tokens(line, NUMBER).filter((t) => t.start >= first) };
}

/** 見出し行の「区 分」より右の語。党名とその位置。 */
function headerNames(line: string): Token[] {
  const at = line.indexOf("分");
  return tokens(line, /\S+/g).filter((t) => t.start > at);
}

function column<T extends { pos: number }>(columns: T[], end: number): T | undefined {
  let found: T | undefined;
  for (const c of columns) if (c.pos < end) found = c;
  return found;
}

function merge(target: Map<string, [string, number | null][]>, key: string, pairs: [string, number | null][]) {
  target.set(key, [...(target.get(key) ?? []), ...pairs]);
}

/** 小選挙区都道府県別届出政党等別得票数。 */
export function parseSmdPrefLayout(lines: string[]) {
  const byArea = new Map<string, [string, number | null][]>();
  let columns: { pos: number; party: string | null }[] = [];

  lines.forEach((line, i) => {
    if (clean(line).startsWith("区分")) {
      // 党名は「諸 派」のように字間が空くので、字ごとに最も近い 男〜計 の範囲へ寄せる。
      const sub = lines.slice(i + 1).find((l) => l.trim() !== "") ?? "";
      const subTokens = tokens(sub, /[男女計]/g);
      const groups = subTokens
        .filter((t) => t.text === "計")
        .map((t) => {
          const male = subTokens.filter((s) => s.text === "男" && s.start < t.start).at(-1);
          return { from: male?.start ?? t.start, to: t.start, total: t, name: "" };
        });
      for (const ch of tokens(line, /\S/g).filter((t) => t.start > line.indexOf("分"))) {
        const distance = (g: (typeof groups)[number]) =>
          ch.start < g.from ? g.from - ch.start : ch.start > g.to ? ch.start - g.to : 0;
        const nearest = groups.reduce((a, b) => (distance(b) < distance(a) ? b : a));
        nearest.name += ch.text;
      }
      columns = subTokens.map((t) => {
        const g = groups.find((x) => x.total === t);
        return { pos: t.start, party: g === undefined || g.name === "" ? null : g.name };
      });
      return;
    }
    const { label, numbers } = splitRow(line);
    if (numbers.length === 0 || (!PREF_SET.has(label) && label !== "計")) return;
    const pairs: [string, number | null][] = [];
    for (const n of numbers) {
      const col = column(columns, n.end);
      if (col === undefined) throw new Error(`${i}行目: 列に当たらない数値 ${n.text}`);
      if (col.party !== null) pairs.push([col.party, votes(n.text)]);
    }
    merge(byArea, label, pairs);
  });

  const areas: Record<string, AreaVotes> = {};
  for (const pref of PREFECTURES) {
    const pairs = byArea.get(pref);
    if (pairs === undefined) throw new Error(`${pref} の行がない`);
    areas[pref] = toAreaVotes(pairs, pref);
  }
  const national = byArea.get("計");
  if (national === undefined) throw new Error("計（全国）の行がない");
  return { national: toAreaVotes(national, "全国"), areas };
}

/** 比例代表選挙区別都道府県別党派別得票数。 */
export function parsePrBlockLayout(lines: string[]) {
  const byBlock = new Map<string, [string, number | null][]>();
  const national: [string, number | null][] = [];
  let columns: { pos: number; party: string }[] = [];
  let block = "";

  lines.forEach((line, i) => {
    if (clean(line).startsWith("比例代表区")) {
      columns = headerNames(line).map((t) => ({ pos: t.start, party: t.text }));
      return;
    }
    const { label, numbers } = splitRow(line);
    if (numbers.length === 0 || label === "") return;

    let rest = label;
    const head = BLOCKS_LONGEST_FIRST.find((b) => label.startsWith(b) && label !== b);
    if (head !== undefined) {
      block = head;
      rest = label.slice(head.length);
    }
    const pairs = numbers.map((n): [string, number | null] => {
      const col = column(columns, n.end);
      if (col === undefined) throw new Error(`${i}行目: 列に当たらない数値 ${n.text}`);
      return [col.party, votes(n.text)];
    });

    if (rest === TOTAL) national.push(...pairs);
    else if (rest === "計") merge(byBlock, block, pairs);
    else if (PREF_SET.has(rest) && rest === block) merge(byBlock, block, pairs);
    else if (!PREF_SET.has(rest)) throw new Error(`${i}行目: 地域名が読めない ${label}`);
  });

  const areas: Record<string, AreaVotes> = {};
  for (const [b, pairs] of byBlock) areas[b] = toAreaVotes(pairs, b);
  return { national: toAreaVotes(national, "全国"), areas };
}
