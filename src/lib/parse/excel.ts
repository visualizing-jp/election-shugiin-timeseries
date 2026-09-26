/**
 * 総務省の結果調 Excel（.xls / .xlsx）を読む。
 *
 * 回によって列の組み方が揺れる。党名は結合セルのどの列にも置かれ得るし、
 * 長い党名は2行に折られる（「NHKと裁判してる党」「弁護士法72条違反で」）。
 * そこで党の列は、党名ではなく小見出し（男・女・計）や見出し行の位置から決める。
 */

import * as fs from "node:fs";
import * as XLSX from "xlsx";
import * as cptable from "xlsx/dist/cpexcel.full.mjs";
import { PREFECTURES } from "../data/areas.ts";
import { TOTAL, clean, round3, votes } from "./cells.ts";
import type { AreaVotes } from "./types.ts";

XLSX.set_fs(fs);
XLSX.set_cptable(cptable);

type Row = unknown[];

/** すべてのシートを上から順につなげた行。 */
export function readRows(path: string): Row[] {
  const wb = XLSX.readFile(path);
  return wb.SheetNames.flatMap((name) =>
    XLSX.utils.sheet_to_json<Row>(wb.Sheets[name]!, { header: 1, raw: true, defval: "" }),
  );
}

const PREF_SET = new Set<string>(PREFECTURES);
const HEADER_LABELS = new Set(["区分", "都道府県", "比例代表区", "選挙区"]);

function cell(row: Row | undefined, c: number): string {
  return clean(row?.[c]);
}

/** 党名 → 得票の組から、合計列を有効投票数として取り出す。 */
export function toAreaVotes(pairs: [string, number | null][], where: string): AreaVotes {
  const out: AreaVotes = { votes: {}, total: NaN };
  for (const [party, v] of pairs) {
    if (v === null) continue;
    if (party === TOTAL) out.total = round3(v);
    else {
      if (party in out.votes) throw new Error(`${where}: 党名が重複 ${party}`);
      out.votes[party] = round3(v);
    }
  }
  if (Number.isNaN(out.total)) throw new Error(`${where}: 合計列がない`);
  return out;
}

function mergeInto(target: Map<string, [string, number | null][]>, key: string, pairs: [string, number | null][]) {
  const list = target.get(key) ?? [];
  list.push(...pairs);
  target.set(key, list);
}

/**
 * 都道府県別届出政党等別得票数（小選挙区）。党ごとに男・女・計の3列。
 * 「計」の行は全国。
 */
export function parseSmdPref(rows: Row[]): { national: AreaVotes; areas: Record<string, AreaVotes> } {
  const byArea = new Map<string, [string, number | null][]>();

  rows.forEach((row, i) => {
    const totals = row
      .map((_, c) => c)
      .filter((c) => cell(row, c) === "計" && cell(row, c - 2) === "男" && cell(row, c - 1) === "女");
    if (totals.length === 0) return;

    // 見出しは小見出しの上、県の行か表題に当たるまで。
    const headerRows: Row[] = [];
    for (let k = i - 1; k >= Math.max(0, i - 4); k--) {
      const c0 = cell(rows[k], 0);
      const note = rows[k]!.some((v) => /^\((\d+|注)/.test(clean(v)));
      if (PREF_SET.has(c0) || c0 === "計" || note) break;
      headerRows.unshift(rows[k]!);
    }
    // 使われない 男・女・計 の組が見出しだけ残っていることがある。値が入っていなければ読み飛ばす。
    const columns = totals.map((c) => ({
      col: c,
      name: headerRows.map((r) => [c - 2, c - 1, c].map((cc) => cell(r, cc)).join("")).join(""),
    }));
    for (const { name, col } of columns) {
      if (HEADER_LABELS.has(name)) throw new Error(`${i}行目: 党名が読めない列 ${col}`);
    }
    const parties = columns.filter((p) => p.name !== "");

    for (let k = i + 1; k < rows.length; k++) {
      const c0 = cell(rows[k], 0);
      if (!PREF_SET.has(c0) && c0 !== "計") {
        if (c0 === "" && rows[k]!.every((v) => clean(v) === "")) continue;
        break;
      }
      for (const { name, col } of columns) {
        if (name === "" && votes(rows[k]![col]) !== null) {
          throw new Error(`${k}行目: 党名のない列 ${col} に値がある`);
        }
      }
      mergeInto(
        byArea,
        c0,
        parties.map((p) => [p.name, votes(rows[k]![p.col])]),
      );
    }
  });

  const national = byArea.get("計");
  if (national === undefined) throw new Error("計（全国）の行がない");
  const areas: Record<string, AreaVotes> = {};
  for (const pref of PREFECTURES) {
    const pairs = byArea.get(pref);
    if (pairs === undefined) throw new Error(`${pref} の行がない`);
    areas[pref] = toAreaVotes(pairs, pref);
  }
  return { national: toAreaVotes(national, "全国"), areas };
}

/**
 * 比例代表選挙区別都道府県別党派別得票数。党ごとに1列。
 * ブロックの値は「計」の行、1都道府県だけのブロック（北海道・東京都）はその県の行。
 * 「合計」の行は全国。
 */
export function parsePrBlock(rows: Row[]): { national: AreaVotes; areas: Record<string, AreaVotes> } {
  const byBlock = new Map<string, [string, number | null][]>();
  const singles = new Map<string, [string, number | null][]>();
  const national: [string, number | null][] = [];

  rows.forEach((row, i) => {
    if (!HEADER_LABELS.has(cell(row, 0)) || !HEADER_LABELS.has(cell(row, 1))) return;

    let first = i + 1;
    const names = row.map((_, c) => (c < 2 ? "" : cell(row, c)));
    for (; first < rows.length; first++) {
      const r = rows[first]!;
      if (PREF_SET.has(cell(r, 1)) || cell(r, 1) === "計" || cell(r, 1) === TOTAL) break;
      r.forEach((_, c) => {
        if (c >= 2) names[c] = (names[c] ?? "") + cell(r, c);
      });
    }
    const parties = names.flatMap((name, col) => (name ? [{ name, col }] : []));

    let block = "";
    for (let k = first; k < rows.length; k++) {
      const r = rows[k]!;
      const c0 = cell(r, 0);
      const c1 = cell(r, 1);
      if (c0 !== "") block = c0;
      const pairs = parties.map((p): [string, number | null] => [p.name, votes(r[p.col])]);
      if (c1 === TOTAL) {
        national.push(...pairs);
        break;
      }
      if (c1 === "計") mergeInto(byBlock, block, pairs);
      else if (PREF_SET.has(c1)) {
        if (c1 === block) mergeInto(singles, block, pairs);
      } else if (c0 === "" && c1 === "") continue;
      else break;
    }
  });

  const areas: Record<string, AreaVotes> = {};
  for (const [block, pairs] of byBlock) areas[block] = toAreaVotes(pairs, block);
  for (const [block, pairs] of singles) {
    if (!(block in areas)) areas[block] = toAreaVotes(pairs, block);
  }
  return { national: toAreaVotes(national, "全国"), areas };
}

/** 届出政党等別得票数（小選挙区）・党派別得票数（比例代表）の「今回」欄。 */
export function parseNational(rows: Row[]): AreaVotes {
  const pairs: [string, number | null][] = [];
  rows.forEach((row, i) => {
    if (cell(row, 0) !== "区分" || row.slice(1).every((v) => clean(v) === "")) return;
    const names = row.map((_, c) => (c < 1 ? "" : cell(row, c)));
    let k = i + 1;
    for (; k < rows.length && !cell(rows[k], 0).startsWith("今回"); k++) {
      rows[k]!.forEach((_, c) => {
        if (c >= 1) names[c] = (names[c] ?? "") + cell(rows[k], c);
      });
    }
    const current = rows[k];
    if (current === undefined) throw new Error(`${i}行目: 今回の行がない`);
    names.forEach((name, c) => {
      if (name) pairs.push([name, votes(current[c])]);
    });
  });
  return toAreaVotes(pairs, "全国表");
}
