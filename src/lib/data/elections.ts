/**
 * 対象とする総選挙の目録。出典の正本は docs/data-sources.md。
 *
 * 第41〜43回は都道府県・比例ブロック別の表が電子的に読める形で公開されていないため、
 * 全国の党派別得票だけを持つ（第49回確定結果調「党派別得票数の推移」から起こした値）。
 */

export type Edition = "確定" | "速報";

/** 総務省の結果調から取る表。 */
export type TableId = "smdNational" | "prNational" | "smdPref" | "prBlock";

export interface Source {
  url: string;
  format: "xls" | "xlsx" | "pdf";
}

export interface Election {
  n: number;
  date: string;
  edition: Edition;
  /** 定数（小選挙区・比例代表）。 */
  seats: { smd: number; pr: number };
  page: string | null;
  /** 取得して正規化する表。空なら data/normalized の手起こし JSON が正本。 */
  tables: Partial<Record<TableId, Source>>;
}

const MAIN = "https://www.soumu.go.jp/main_content/";
const PAGE = (n: number) =>
  `https://www.soumu.go.jp/senkyo/senkyo_s/data/shugiin${n}/index.html`;
const H17 = "https://www.soumu.go.jp/senkyo/senkyo_s/data/shugiin44/pdf/h17sousenkyo_050911_";

/** 第41〜43回の全国値の出典（第49回確定結果調 pp.25–26「党派別得票数の推移」）。 */
export const HISTORY_SOURCE = `${MAIN}000930924.pdf`;

const x = (id: string): Source => ({ url: `${MAIN}${id}`, format: id.endsWith(".xlsx") ? "xlsx" : "xls" });

export const ELECTIONS: Election[] = [
  { n: 41, date: "1996-10-20", edition: "確定", seats: { smd: 300, pr: 200 }, page: null, tables: {} },
  { n: 42, date: "2000-06-25", edition: "確定", seats: { smd: 300, pr: 180 }, page: null, tables: {} },
  { n: 43, date: "2003-11-09", edition: "確定", seats: { smd: 300, pr: 180 }, page: null, tables: {} },
  {
    n: 44,
    date: "2005-09-11",
    edition: "確定",
    seats: { smd: 300, pr: 180 },
    page: PAGE(44),
    tables: {
      smdPref: { url: `${H17}03_06.pdf`, format: "pdf" },
      prBlock: { url: `${H17}03_07.pdf`, format: "pdf" },
    },
  },
  {
    n: 45,
    date: "2009-08-30",
    edition: "確定",
    seats: { smd: 300, pr: 180 },
    page: PAGE(45),
    tables: {
      smdNational: x("000037627.xls"),
      prNational: x("000037629.xls"),
      smdPref: x("000037631.xls"),
      prBlock: x("000037632.xls"),
    },
  },
  {
    n: 46,
    date: "2012-12-16",
    edition: "確定",
    seats: { smd: 300, pr: 180 },
    page: PAGE(46),
    tables: {
      smdNational: x("000194186.xls"),
      prNational: x("000194187.xls"),
      smdPref: x("000194188.xls"),
      prBlock: x("000194189.xls"),
    },
  },
  {
    n: 47,
    date: "2014-12-14",
    edition: "確定",
    seats: { smd: 295, pr: 180 },
    page: PAGE(47),
    tables: {
      smdNational: x("000328946.xls"),
      prNational: x("000328947.xls"),
      smdPref: x("000328948.xls"),
      prBlock: x("000328949.xls"),
    },
  },
  {
    n: 48,
    date: "2017-10-22",
    edition: "確定",
    seats: { smd: 289, pr: 176 },
    page: PAGE(48),
    tables: {
      smdNational: x("000516722.xls"),
      prNational: x("000516723.xls"),
      smdPref: x("000516724.xls"),
      prBlock: x("000516725.xls"),
    },
  },
  {
    n: 49,
    date: "2021-10-31",
    edition: "確定",
    seats: { smd: 289, pr: 176 },
    page: PAGE(49),
    tables: {
      smdNational: x("000776970.xls"),
      prNational: x("000776971.xlsx"),
      smdPref: x("000776972.xls"),
      prBlock: x("000776973.xlsx"),
    },
  },
  {
    n: 50,
    date: "2024-10-27",
    edition: "速報",
    seats: { smd: 289, pr: 176 },
    page: PAGE(50),
    tables: {
      smdNational: x("000979125.xls"),
      prNational: x("000979126.xls"),
      smdPref: x("000979127.xls"),
      prBlock: x("000979128.xls"),
    },
  },
  {
    n: 51,
    date: "2026-02-08",
    edition: "速報",
    seats: { smd: 289, pr: 176 },
    page: PAGE(51),
    tables: {
      smdNational: x("001061478.xlsx"),
      prNational: x("001061479.xlsx"),
      smdPref: x("001061480.xlsx"),
      prBlock: x("001061481.xlsx"),
    },
  },
];
