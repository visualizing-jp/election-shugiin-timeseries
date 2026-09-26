/**
 * ツール全体の配色ルール。色空間は CIE HCL（d3-color の hcl）。
 *
 * - 色相は党だけを表す。同じ回に出た党どうしの色相をできるだけ離して割り当てる。
 * - 明度は量だけを表す。量を色で表すとき（地図）は得票率→明度を全党共通にする。
 *   量を長さ・位置で表すとき（棒・一覧）は全党を同じ基準明度で塗る。
 * - 彩度は sRGB の色域に収めるためだけに下げる。
 * - 党でないもの（諸派・無所属・その他）は無彩色。
 */

import { hcl } from "d3-color";
import type { EraJson } from "./cube.ts";

export const NEUTRAL = new Set(["諸派", "無所属", "その他"]);

/** 全国で一度でもこの得票率に届いた党を主要な党とする。届かない党は積み上げで「その他」にまとめる。 */
export const MINOR = 0.02;

/** 基準明度。地図の明度関数で得票率 56% に当たる。 */
export const BASE_L = 58;
const BASE_C = 55;

/** 得票率 0 → 明度 96（紙色に近い）、100% → 28。 */
const L_AT_0 = 96;
const L_AT_1 = 28;

const HUE_STEP = 5;

/** 明度と色相を保ったまま、表示できるまで彩度を下げる。 */
function fit(h: number, c: number, l: number): string {
  let chroma = c;
  while (chroma > 0 && !hcl(h, chroma, l).displayable()) chroma -= 1;
  return hcl(h, Math.max(0, chroma), l).formatHex();
}

const circular = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
};

/**
 * 党の色相を決める。parties は得票の大きい順。
 * appearances[党] はその党が出た回の集合。回を共有する党どうしが衝突する。
 *
 * 同じ明度で色相だけを変えて見分けられる数には限りがあるので、離すのは主要な党どうしだけにする。
 * 小党は「その他」にまとまり、色が付くのは選んだ1党だけなので、主要な党とだけ離せばよい。
 */
export function assignHues(
  parties: string[],
  appearances: Map<string, Set<number>>,
  major: Set<string>,
): Map<string, number> {
  const hues = new Map<string, number>();
  const candidates = Array.from({ length: 360 / HUE_STEP }, (_, i) => i * HUE_STEP);
  const ordered = [...parties.filter((p) => major.has(p)), ...parties.filter((p) => !major.has(p))];
  for (const p of ordered) {
    if (NEUTRAL.has(p)) continue;
    const mine = appearances.get(p) ?? new Set<number>();
    const rivals = [...hues].filter(
      ([q]) => major.has(q) && [...(appearances.get(q) ?? [])].some((e) => mine.has(e)),
    );
    let best = candidates[0]!;
    let bestScore = -1;
    for (const h of candidates) {
      const score = rivals.length === 0 ? 360 : Math.min(...rivals.map(([, rh]) => circular(h, rh)));
      if (score > bestScore) {
        best = h;
        bestScore = score;
      }
    }
    hues.set(p, best);
  }
  return hues;
}

/** 全国の得票（両制度）から色相を決める。配信データ palette.json の中身。 */
export function huesFromEra(era: EraJson): Record<string, number> {
  const weight = new Map<string, number>();
  const appearances = new Map<string, Set<number>>();
  const major = new Set<string>();
  for (const cube of [era.smd, era.pr]) {
    cube.parties.forEach((p, i) => {
      cube.votes[i]!.forEach((v, e) => {
        if (v === null) return;
        const share = v / cube.totals[e]!;
        weight.set(p, (weight.get(p) ?? 0) + share);
        appearances.set(p, (appearances.get(p) ?? new Set()).add(era.elections[e]!));
        if (share >= MINOR) major.add(p);
      });
    });
  }
  const parties = [...weight.keys()].sort((a, b) => weight.get(b)! - weight.get(a)!);
  return Object.fromEntries(assignHues(parties, appearances, major));
}

/** 棒・一覧で使う党の色（全党同じ明度）。無彩色の党は hue = null。 */
export function baseColor(hue: number | null): string {
  return hue === null ? fit(0, 0, BASE_L) : fit(hue, BASE_C, BASE_L);
}

/** 地図で使う色。明度は全党共通の得票率の関数。 */
export function shareColor(hue: number | null, share: number): string {
  const v = Math.min(1, Math.max(0, share));
  const l = L_AT_0 + (L_AT_1 - L_AT_0) * v;
  const c = hue === null ? 0 : 12 + 48 * Math.min(1, v / 0.5);
  return fit(hue ?? 0, c, l);
}

/** 強調しない要素。明度を紙色へ寄せ、彩度を落とす。全画面で同じ割合。 */
export function fadedColor(hue: number | null): string {
  return fit(hue ?? 0, hue === null ? 0 : BASE_C * 0.3, BASE_L + (94 - BASE_L) * 0.75);
}

/** 党の色一式。画面はこれだけを使う。 */
export interface PartyColors {
  base: string;
  faded: string;
  hue: number | null;
}

export function colorsOf(hues: Record<string, number>, party: string): PartyColors {
  const hue = NEUTRAL.has(party) ? null : (hues[party] ?? null);
  return { base: baseColor(hue), faded: fadedColor(hue), hue };
}
