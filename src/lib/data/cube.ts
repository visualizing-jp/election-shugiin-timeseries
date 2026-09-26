/**
 * 配信データ（public/data/*.json）の型。scripts/build.ts が書き、画面が読む。
 * 回のメタ情報（執行日・版・定数）は elections.ts を正本とし、ここには回番号だけ持つ。
 */

export type System = "smd" | "pr";

/** 全国。votes[党][回]。その回に届出のない党は null。 */
export interface NationalCube {
  parties: string[];
  totals: number[];
  votes: (number | null)[][];
}

export interface EraJson {
  elections: number[];
  smd: NationalCube;
  pr: NationalCube;
}

/**
 * 地域（都道府県・ブロック）。totals[回][地域]、votes[党][回][地域]。
 * その回に全国で届出のない党は votes[党][回] が null、その地域に候補のない党は要素が null。
 */
export interface AreaJson {
  elections: number[];
  areas: string[];
  parties: string[];
  totals: number[][];
  votes: ((number | null)[] | null)[][];
}
