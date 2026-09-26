/**
 * 配信データの取得。同じファイルは一度しか取りに行かない。
 */

import type { AreaJson, EraJson } from "../../lib/data/cube.ts";
import { colorsOf, type PartyColors } from "../../lib/data/palette.ts";

const cache = new Map<string, Promise<unknown>>();

function load<Raw, T = Raw>(name: string, transform: (raw: Raw) => T = (raw) => raw as unknown as T): Promise<T> {
  const hit = cache.get(name);
  if (hit !== undefined) return hit as Promise<T>;
  const promise = fetch(`${import.meta.env.BASE_URL}data/${name}.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`${name}.json の取得に失敗しました (${r.status})`);
      return r.json() as Promise<Raw>;
    })
    .then(transform);
  cache.set(name, promise);
  return promise;
}

export type Palette = (party: string) => PartyColors;

export const loadEra = () => load<EraJson>("era");
export const loadPref = () => load<AreaJson>("pref");
export const loadBlock = () => load<AreaJson>("block");

/** 党 → 色。色域への押し込みは一度だけ計算して覚えておく。 */
export const loadPalette = () =>
  load<Record<string, number>, Palette>("palette", (hues) => {
    const memo = new Map<string, PartyColors>();
    return (party) => {
      let c = memo.get(party);
      if (c === undefined) {
        c = colorsOf(hues, party);
        memo.set(party, c);
      }
      return c;
    };
  });
