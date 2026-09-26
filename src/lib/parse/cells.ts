/**
 * 結果調のセルの読み方。Excel と PDF で共通。
 */

/** 全角英数を半角に寄せ、空白と注記記号（※1 など）を落とす。 */
export function clean(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/※\d*/g, "")
    .replace(/\s+/g, "");
}

/**
 * 得票数。按分票があるので小数を残す。
 * 空欄・ダッシュ・0 は「その地域に候補（名簿）がない」として null。
 */
export function votes(value: unknown): number | null {
  if (typeof value === "number") return value === 0 ? null : value;
  const s = clean(value).replace(/,/g, "");
  if (s === "" || /^[-－―—ー]$/.test(s)) return null;
  const v = Number(s);
  if (!Number.isFinite(v)) throw new Error(`得票数として読めない: ${String(value)}`);
  return v === 0 ? null : v;
}

/** 按分票の小数第3位までに丸める。浮動小数の誤差を配信データに持ち込まない。 */
export function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

export const TOTAL = "合計";
