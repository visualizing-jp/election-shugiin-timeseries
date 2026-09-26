/**
 * 積み上げの組み立て。色は配色ルール（lib/data/palette.ts）から受け取る。
 */

import { MINOR } from "../../lib/data/palette.ts";
import type { Palette } from "./load.ts";

export const OTHER = "その他";

/** 無所属・諸派は「その他」に混ぜず、いつも独立した系列として一番上に置く。 */
export const TRAILING = ["諸派", "無所属"];

/**
 * 「その他」にまとめない党。この制度で全国の得票率が一度でも MINOR に届いた党。
 * votes[党][回] と totals[回] は全国値。
 */
export function majorParties(
  parties: string[],
  votes: (number | null)[][],
  totals: number[],
): Set<string> {
  return new Set(
    parties.filter(
      (p, i) =>
        TRAILING.includes(p) || votes[i]!.some((v, e) => v !== null && v / totals[e]! >= MINOR),
    ),
  );
}

export interface Segment {
  key: string;
  value: number;
  color: string;
  /** 他の党を強調しているときの色。 */
  faded: string;
}

/**
 * 1本の棒の積み上げ（下から）。主要な党 → 選択中の小党 → その他 → 諸派・無所属。
 * values は parties と同じ並びの得票（null はその地域・回に候補なし）。
 */
export function stack(
  parties: string[],
  values: (number | null)[],
  major: Set<string>,
  selected: string,
  palette: Palette,
): Segment[] {
  const segment = (key: string, value: number): Segment => {
    const c = palette(key);
    return { key, value, color: c.base, faded: c.faded };
  };
  const main: Segment[] = [];
  const trailing: Segment[] = [];
  let pickedMinor: Segment | null = null;
  let other = 0;
  parties.forEach((p, i) => {
    const v = values[i];
    if (v === null || v === undefined) return;
    if (TRAILING.includes(p)) trailing.push(segment(p, v));
    else if (major.has(p)) main.push(segment(p, v));
    else if (p === selected) pickedMinor = segment(p, v);
    else other += v;
  });
  return [
    ...main,
    ...(pickedMinor === null ? [] : [pickedMinor]),
    ...(other > 0 ? [segment(OTHER, other)] : []),
    ...trailing,
  ];
}
