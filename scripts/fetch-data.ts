/**
 * 目録（src/lib/data/elections.ts）の表を総務省から data/raw/ に落とす。
 * 既にあるファイルは取り直さない。
 *
 *   npm run fetch
 */

import { mkdir, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ELECTIONS, type TableId } from "../src/lib/data/elections.ts";

const RAW_DIR = resolve(import.meta.dirname, "../data/raw");

export function rawPath(n: number, table: TableId, format: string): string {
  return resolve(RAW_DIR, String(n), `${table}.${format}`);
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  for (const e of ELECTIONS) {
    for (const [table, source] of Object.entries(e.tables)) {
      const path = rawPath(e.n, table as TableId, source.format);
      if (await exists(path)) continue;
      const res = await fetch(source.url);
      if (!res.ok) throw new Error(`第${e.n}回 ${table}: ${res.status} ${source.url}`);
      await mkdir(resolve(RAW_DIR, String(e.n)), { recursive: true });
      await writeFile(path, Buffer.from(await res.arrayBuffer()));
      console.log(`  第${e.n}回 ${table}.${source.format}`);
    }
  }
}

if (import.meta.main) await main();
