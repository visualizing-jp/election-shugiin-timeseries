/**
 * 配色ルールの検証用。党×段階の色見本と色覚シミュレーションを HTML に書き出し、
 * 同じ回に出た党どうしの最小色差（CIELAB ΔE）を表示する。
 *
 *   node scripts/palette-check.ts > /tmp/palette.html
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { lab, rgb } from "d3-color";
import type { EraJson } from "../src/lib/data/cube.ts";
import { baseColor, fadedColor, huesFromEra, MINOR, NEUTRAL, shareColor } from "../src/lib/data/palette.ts";

const era = JSON.parse(await readFile(resolve(import.meta.dirname, "../public/data/era.json"), "utf8")) as EraJson;

const weight = new Map<string, number>();
const appearances = new Map<string, Set<number>>();
const major = new Set<string>();
for (const system of ["smd", "pr"] as const) {
  const cube = era[system];
  cube.parties.forEach((p, i) => {
    cube.votes[i]!.forEach((v, e) => {
      if (v === null) return;
      weight.set(p, (weight.get(p) ?? 0) + v / cube.totals[e]!);
      appearances.set(p, (appearances.get(p) ?? new Set()).add(era.elections[e]!));
      if (v / cube.totals[e]! >= MINOR) major.add(p);
    });
  });
}
const parties = [...weight.keys()].sort((a, b) => weight.get(b)! - weight.get(a)!);
const hues = new Map(Object.entries(huesFromEra(era)));

const perElection = era.elections.map(
  (n) => [...major].filter((p) => !NEUTRAL.has(p) && appearances.get(p)!.has(n)).length,
);
console.error(`同じ回の主要な党の数: ${era.elections.map((n, i) => `${n}:${perElection[i]}`).join(" ")}`);
const hueOf = (p: string) => (NEUTRAL.has(p) ? null : hues.get(p)!);

/** Machado et al. (2009) 重度1.0 の行列。線形 sRGB に掛ける。 */
const CVD: Record<string, number[][]> = {
  P型: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  D型: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  T型: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};
const toLinear = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
function simulate(hex: string, m: number[][] | null): string {
  if (m === null) return hex;
  const c = rgb(hex);
  const lin = [toLinear(c.r), toLinear(c.g), toLinear(c.b)];
  const out = m.map((row) => toSrgb(Math.min(1, Math.max(0, row[0]! * lin[0]! + row[1]! * lin[1]! + row[2]! * lin[2]!))));
  return rgb(out[0]!, out[1]!, out[2]!).formatHex();
}
const deltaE = (a: string, b: string) => {
  const x = lab(a);
  const y = lab(b);
  return Math.hypot(x.l - y.l, x.a - y.a, x.b - y.b);
};

const STEPS = [0.05, 0.2, 0.4, 0.6, 0.8];
const VISIONS: [string, number[][] | null][] = [["通常", null], ...Object.entries(CVD)];

// 同じ回に出た主要な党どうしの ΔE（基準色）。見え方ごとに、見分けにくい組を上から並べる。
const pairs: { a: string; b: string; d: Record<string, number> }[] = [];
const majors = parties.filter((p) => major.has(p) && !NEUTRAL.has(p));
for (let i = 0; i < majors.length; i++) {
  for (let j = i + 1; j < majors.length; j++) {
    const a = majors[i]!;
    const b = majors[j]!;
    if (![...appearances.get(a)!].some((e) => appearances.get(b)!.has(e))) continue;
    const d: Record<string, number> = {};
    for (const [name, m] of VISIONS) {
      d[name] = deltaE(simulate(baseColor(hueOf(a)), m), simulate(baseColor(hueOf(b)), m));
    }
    pairs.push({ a, b, d });
  }
}
pairs.sort((x, y) => x.d["通常"]! - y.d["通常"]!);
for (const [name] of VISIONS) {
  const min = Math.min(...pairs.map((p) => p.d[name]!));
  const under10 = pairs.filter((p) => p.d[name]! < 10).length;
  console.error(`${name}: 最小ΔE ${min.toFixed(1)}  ΔE<10 の組 ${under10}/${pairs.length}`);
}

const sw = (hex: string, label = "") =>
  `<td style="background:${hex};color:${lab(hex).l < 55 ? "#fff" : "#16140f"}">${label}</td>`;
const rows = parties
  .map((p) => {
    const h = hueOf(p);
    const cells = VISIONS.map(([, m]) =>
      [simulate(baseColor(h), m), ...STEPS.map((s) => simulate(shareColor(h, s), m))].map((c) => sw(c)).join(""),
    ).join('<td class="gap"></td>');
    const when = [...appearances.get(p)!].sort().map((n) => n).join(",");
    return `<tr><th>${p}</th><td class="meta">${h ?? "—"}</td><td class="meta">${when}</td>${sw(fadedColor(h))}<td class="gap"></td>${cells}</tr>`;
  })
  .join("\n");

const head = VISIONS.map(([name]) => `<th colspan="6">${name}（基準・5・20・40・60・80%）</th>`).join('<th class="gap"></th>');

console.log(`<!doctype html><meta charset="utf-8"><title>palette check</title>
<style>
body{font:12px/1.4 "Hiragino Sans",sans-serif;background:#f7f5f1;color:#16140f;margin:24px}
table{border-collapse:separate;border-spacing:2px}
td{width:26px;height:20px;border-radius:2px}
td.gap,th.gap{width:10px;background:none}
td.meta{width:auto;color:#6d675d;font-size:10px;padding:0 6px}
th{text-align:left;font-weight:600;padding-right:8px;white-space:nowrap}
.pairs td{width:auto;padding:1px 8px;height:auto}
</style>
<h2>党×段階の色見本</h2>
<table><tr><th>党</th><th>色相</th><th>出た回</th><th>非強調</th><th class="gap"></th>${head}</tr>
${rows}</table>
<h2>同じ回に出た主要な党どうしの ΔE（基準色、通常の見え方で小さい順）</h2>
<table class="pairs"><tr><th>党</th><th>党</th>${VISIONS.map(([n]) => `<th>${n}</th>`).join("")}</tr>
${pairs
  .slice(0, 20)
  .map(
    (x) =>
      `<tr><td>${x.a}</td><td>${x.b}</td>${VISIONS.map(([n]) => `<td>${x.d[n]!.toFixed(1)}</td>`).join("")}</tr>`,
  )
  .join("\n")}</table>`);
