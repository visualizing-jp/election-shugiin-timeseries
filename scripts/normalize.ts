/**
 * data/raw/ の結果調を読み、回ごとの正規化 JSON を data/normalized/ に書き出す。
 * 表を持たない回（第41〜43回）は手起こしの JSON が正本なので触らない。
 *
 *   npm run normalize
 */

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ELECTIONS, type Election, type TableId } from "../src/lib/data/elections.ts";
import { parseNational, parsePrBlock, parseSmdPref, readRows } from "../src/lib/parse/excel.ts";
import { parsePrBlockLayout, parseSmdPrefLayout, readLayout } from "../src/lib/parse/layout.ts";
import type { NormalizedElection } from "../src/lib/parse/types.ts";
import { rawPath } from "./fetch-data.ts";

const OUT_DIR = resolve(import.meta.dirname, "../data/normalized");

function path(e: Election, table: TableId): string {
  const source = e.tables[table];
  if (source === undefined) throw new Error(`第${e.n}回に ${table} がない`);
  return rawPath(e.n, table, source.format);
}

function normalize(e: Election): NormalizedElection {
  if (e.tables.smdPref?.format === "pdf") {
    const smd = parseSmdPrefLayout(readLayout(path(e, "smdPref")));
    const pr = parsePrBlockLayout(readLayout(path(e, "prBlock")));
    return { n: e.n, smd, pr };
  }
  const smd = parseSmdPref(readRows(path(e, "smdPref")));
  const pr = parsePrBlock(readRows(path(e, "prBlock")));
  return {
    n: e.n,
    smd: { ...smd, reported: parseNational(readRows(path(e, "smdNational"))) },
    pr: { ...pr, reported: parseNational(readRows(path(e, "prNational"))) },
  };
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  for (const e of ELECTIONS) {
    if (Object.keys(e.tables).length === 0) continue;
    const data = normalize(e);
    await writeFile(resolve(OUT_DIR, `${e.n}.json`), `${JSON.stringify(data, null, 1)}\n`);
    console.log(
      `  第${e.n}回  小選挙区 ${Object.keys(data.smd.national.votes).length}党  比例 ${Object.keys(data.pr.national.votes).length}党  ブロック ${Object.keys(data.pr.areas ?? {}).length}`,
    );
  }
}

await main();
