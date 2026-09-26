/**
 * 正規化 JSON の健全性チェック。1つでも落ちたら終了コード 1。
 *
 *   npm run verify
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { BLOCKS, PREFECTURES } from "../src/lib/data/areas.ts";
import { ELECTIONS } from "../src/lib/data/elections.ts";
import type { AreaVotes, NormalizedElection, SystemVotes } from "../src/lib/parse/types.ts";

const DIR = resolve(import.meta.dirname, "../data/normalized");

/** 按分票の丸めが党の数だけ積もるので、票の比較には 0.01 の幅を持たせる。 */
const EPS = 0.01;

/**
 * 第49回確定結果調「党派別得票数の推移」の全国値（総得票・自由民主党）。
 * 速報結果ページの Excel / PDF から組み立てた値が確定値と一致するかを見る。
 */
const CONFIRMED: Record<number, { smd: [number, number]; pr: [number, number] }> = {
  44: { smd: [68066291.924, 32518389.918], pr: [67811069, 25887798] },
  45: { smd: [70581679.935, 27301982.074], pr: [70370255, 18810217] },
  46: { smd: [59626567.905, 25643309.437], pr: [60179888, 16624457] },
  47: { smd: [52939789.958, 25461448.922], pr: [53334447, 17658916] },
  48: { smd: [55422192.951, 26500776.635], pr: [55757552, 18555717] },
  49: { smd: [57457032.942, 27626235.498], pr: [57465978.963, 19914883] },
};

const failures: string[] = [];
let checks = 0;

function check(ok: boolean, message: string): void {
  checks++;
  if (!ok) failures.push(message);
}

const near = (a: number, b: number) => Math.abs(a - b) <= EPS;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function checkArea(where: string, a: AreaVotes): void {
  const s = sum(Object.values(a.votes));
  check(near(s, a.total), `${where}: 党の合計 ${s} ≠ 合計 ${a.total}`);
  for (const [party, v] of Object.entries(a.votes)) {
    check(v > 0, `${where} ${party}: 得票が正でない ${v}`);
  }
}

function checkSystem(label: string, s: SystemVotes, expectedAreas: readonly string[] | null): void {
  checkArea(`${label} 全国`, s.national);

  if (expectedAreas !== null) {
    const areas = s.areas ?? {};
    check(
      expectedAreas.every((a) => a in areas) && Object.keys(areas).length === expectedAreas.length,
      `${label}: 地域が揃っていない（${Object.keys(areas).length}）`,
    );
    for (const [name, a] of Object.entries(areas)) checkArea(`${label} ${name}`, a);

    const totals = sum(Object.values(areas).map((a) => a.total));
    check(near(totals, s.national.total), `${label}: 地域の合計 ${totals} ≠ 全国 ${s.national.total}`);
    for (const [party, v] of Object.entries(s.national.votes)) {
      const byArea = sum(Object.values(areas).map((a) => a.votes[party] ?? 0));
      check(near(byArea, v), `${label} ${party}: 地域の合計 ${byArea} ≠ 全国 ${v}`);
    }
    for (const a of Object.values(areas)) {
      for (const party of Object.keys(a.votes)) {
        check(party in s.national.votes, `${label} ${party}: 地域にあって全国にない`);
      }
    }
  }

  if (s.reported !== undefined) {
    const r = s.reported;
    check(near(r.total, s.national.total), `${label}: 全国表の合計 ${r.total} ≠ ${s.national.total}`);
    const a = Object.keys(r.votes).sort().join("、");
    const b = Object.keys(s.national.votes).sort().join("、");
    check(a === b, `${label}: 全国表と党が違う\n    全国表: ${a}\n    地域表: ${b}`);
    for (const [party, v] of Object.entries(r.votes)) {
      const mine = s.national.votes[party];
      check(mine !== undefined && near(mine, v), `${label} ${party}: 全国表 ${v} ≠ ${mine}`);
    }
  }
}

for (const e of ELECTIONS) {
  const data = JSON.parse(await readFile(resolve(DIR, `${e.n}.json`), "utf8")) as NormalizedElection;
  check(data.n === e.n, `第${e.n}回: ファイルの回が ${data.n}`);
  const hasAreas = Object.keys(e.tables).length > 0;
  checkSystem(`第${e.n}回 小選挙区`, data.smd, hasAreas ? PREFECTURES : null);
  checkSystem(`第${e.n}回 比例`, data.pr, hasAreas ? BLOCKS : null);

  const confirmed = CONFIRMED[e.n];
  if (confirmed !== undefined) {
    for (const system of ["smd", "pr"] as const) {
      const [total, ldp] = confirmed[system];
      const s = data[system].national;
      check(near(s.total, total), `第${e.n}回 ${system}: 総得票 ${s.total} ≠ 確定 ${total}`);
      check(
        near(s.votes["自由民主党"] ?? NaN, ldp),
        `第${e.n}回 ${system}: 自由民主党 ${s.votes["自由民主党"]} ≠ 確定 ${ldp}`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error(`✗ ${failures.length}/${checks} 件が不一致`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`✓ ${checks} 件すべて一致`);
