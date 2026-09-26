/**
 * 地域ビュー。都道府県（小選挙区）と比例ブロックで共用する。
 * 回と党を選んで地域ごとの得票率を塗り、選んだ地域の回ごとの推移を横に出す。
 */

import { use, useMemo } from "react";
import { prefCode } from "../../lib/data/areas.ts";
import type { AreaJson } from "../../lib/data/cube.ts";
import { loadBlock, loadPalette, loadPref } from "../data/load.ts";
import { election, longDate, man, pct } from "../data/format.ts";
import { majorParties, stack } from "../data/parties.ts";
import { BlockBars } from "../components/BlockBars.tsx";
import { ElectionSelect } from "../components/ElectionSelect.tsx";
import { PartyList, type PartyRow } from "../components/PartyList.tsx";
import { Preliminary } from "../components/Preliminary.tsx";
import { StackedBars, type Column } from "../components/StackedBars.tsx";
import { TileMap } from "../components/TileMap.tsx";
import { useUrlState } from "../hooks/useUrlState.ts";

export type AreaKind = "pref" | "block";

const TEXT: Record<AreaKind, { system: string; unit: string; none: string }> = {
  pref: { system: "小選挙区", unit: "都道府県", none: "候補なし" },
  block: { system: "比例代表", unit: "ブロック", none: "名簿なし" },
};

/** 地域の合計が全国と一致することは npm run verify で確かめてある。 */
function nationalOf(data: AreaJson) {
  const totals = data.totals.map((row) => row.reduce((a, b) => a + b, 0));
  const votes = data.votes.map((byElection) =>
    byElection.map((row) => (row === null ? null : row.reduce<number>((a, b) => a + (b ?? 0), 0))),
  );
  return { totals, votes };
}

export function AreaView({ kind }: { kind: AreaKind }) {
  const data = use(kind === "pref" ? loadPref() : loadBlock());
  const palette = use(loadPalette());
  const text = TEXT[kind];
  const last = data.elections.at(-1)!;

  const [nParam, setN] = useUrlState<string>("n", String(last), (v) => data.elections.includes(Number(v)));
  const [partyParam, setParty] = useUrlState<string>("party", "", (v) => data.parties.includes(v));
  const [area, setArea] = useUrlState<string>("area", "", (v) => data.areas.includes(v));
  const n = Number(nParam);
  const ei = data.elections.indexOf(n);

  const national = useMemo(() => nationalOf(data), [data]);
  const major = useMemo(
    () => majorParties(data.parties, national.votes, national.totals),
    [data.parties, national],
  );

  const rows = useMemo(
    (): PartyRow[] =>
      data.parties
        .flatMap((p, i) => {
          const v = national.votes[i]![ei];
          return v === null || v === undefined ? [] : [{ name: p, votes: v, share: v / national.totals[ei]! }];
        })
        .sort((a, b) => b.votes - a.votes),
    [data.parties, national, ei],
  );

  // 選んだ党がこの回に届出をしていなければ、この回の最大の党に落とす（URL の選択は残す）。
  const party = rows.some((r) => r.name === partyParam) ? partyParam : rows[0]!.name;
  const pi = data.parties.indexOf(party);
  const colors = palette(party);
  const row = rows.find((r) => r.name === party)!;

  const shares = data.areas.map((_, ai) => {
    const v = data.votes[pi]![ei]?.[ai] ?? null;
    return v === null ? null : v / data.totals[ei]![ai]!;
  });

  const ranked = data.areas
    .map((name, ai) => ({ name, share: shares[ai]! }))
    .filter((a) => a.share !== null)
    .sort((a, b) => b.share - a.share);

  const ai = area === "" ? -1 : data.areas.indexOf(area);
  const columns = useMemo(
    (): Column[] =>
      data.elections.map((en, e) => ({
        n: en,
        total: ai < 0 ? national.totals[e]! : data.totals[e]![ai]!,
        segments: stack(
          data.parties,
          data.parties.map((_, p) =>
            ai < 0 ? national.votes[p]![e]! : (data.votes[p]![e]?.[ai] ?? null),
          ),
          major,
          party,
          palette,
        ),
      })),
    [data, national, major, party, ai, palette],
  );

  const map =
    kind === "pref" ? (
      <TileMap
        tiles={data.areas.map((name, i) => ({ code: prefCode(name), label: name, share: shares[i]! }))}
        hue={colors.hue}
        pinned={area === "" ? null : prefCode(area)}
        onPin={(code) => setArea(code === null ? "" : data.areas[Number(code) - 1]!)}
      />
    ) : (
      <BlockBars
        rows={data.areas.map((name, i) => ({ name, share: shares[i]! }))}
        color={colors.base}
        pinned={area === "" ? null : area}
        onPin={(name) => setArea(name ?? "")}
      />
    );

  return (
    <div className="mx-auto flex w-full max-w-[1240px] gap-8 px-6 py-6 max-lg:flex-col-reverse">
      <aside className="w-[300px] shrink-0 max-lg:w-full lg:sticky lg:top-6 lg:flex lg:max-h-[calc(100dvh-3rem)] lg:flex-col lg:self-start">
        <h2 className="flex items-baseline justify-between px-2 pb-1 text-[11px] font-semibold tracking-wide text-faint">
          <span>
            党 <span className="font-normal">{rows.length}</span>
          </span>
          <span className="font-normal">全国の得票率</span>
        </h2>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <PartyList rows={rows} selected={party} onSelect={setParty} palette={palette} />
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center justify-between gap-3 pb-4">
          <div className="flex min-w-0 items-baseline gap-3">
            <h1 className="flex min-w-0 items-center gap-2 text-[19px] font-semibold tracking-tight">
              <span aria-hidden className="size-[11px] shrink-0 rounded-[2px]" style={{ backgroundColor: colors.base }} />
              <span className="truncate">{party}</span>
            </h1>
            <p className="tnum shrink-0 text-[13px] text-muted">
              {text.system} 全国 {pct(row.share)}
            </p>
          </div>
          <ElectionSelect elections={data.elections} value={n} onChange={(v) => setN(String(v))} />
        </header>

        <p className="tnum min-h-9 pb-4 text-[12.5px] text-muted">
          {longDate(n)}
          {election(n).edition === "速報" && <Preliminary />}
          {ranked.length > 0 && (
            <>
              {" · 最も高い "}
              <span className="font-semibold text-ink">
                {ranked[0]!.name} {pct(ranked[0]!.share)}
              </span>
              {ranked.length > 1 && (
                <>
                  {" ／ 最も低い "}
                  <span className="font-semibold text-ink">
                    {ranked.at(-1)!.name} {pct(ranked.at(-1)!.share)}
                  </span>
                </>
              )}
              {ranked.length < data.areas.length &&
                ` · ${text.none}の${text.unit} ${data.areas.length - ranked.length}`}
            </>
          )}
        </p>

        <div className="grid gap-8 xl:grid-cols-[minmax(460px,1fr)_minmax(340px,0.85fr)]">
          <section aria-label={`${text.unit}別の得票率`} className="min-w-0">
            {map}
          </section>

          <section aria-label="推移" className="min-w-0">
            <h2 className="flex items-baseline justify-between pb-2">
              <span className="text-[14px] font-semibold">
                {area === "" ? "全国" : area}の推移
                <span className="ml-2 text-[11px] font-normal text-muted">{text.system}・得票率</span>
              </span>
              {area !== "" && (
                <button
                  type="button"
                  onClick={() => setArea("")}
                  className="cursor-pointer text-[11px] text-muted transition-colors duration-150 hover:text-ink"
                >
                  全国に戻す
                </button>
              )}
            </h2>
            <StackedBars
              columns={columns}
              measure="share"
              highlighted={party}
              focused={n}
              onFocus={(v) => setN(String(v))}
              height={260}
              label={`${area === "" ? "全国" : area}の${text.system}の党派別得票率`}
            />
            <p className="pt-2 text-[11px] leading-relaxed text-faint">
              {area === ""
                ? `${text.unit}を選ぶと、その${text.unit}の推移に切り替わる。`
                : `有効投票 ${man(data.totals[ei]![ai]!)}（${longDate(n)}）`}
            </p>
          </section>
        </div>

        <ul className="mt-5 flex flex-col gap-1 border-t border-rule pt-3 text-[11px] leading-relaxed text-muted">
          {kind === "pref" ? (
            <>
              <li>小選挙区の得票率は、その県で候補を立てた選挙区の数に左右される。候補が一部の選挙区だけなら県全体の率は低く出る。</li>
              <li>地図は模式図。得票率は党の得票 ÷ その県の小選挙区の有効投票の合計。</li>
            </>
          ) : (
            <li>得票率は党の得票 ÷ そのブロックの比例代表の有効投票。</li>
          )}
          <li>都道府県・ブロック別の表が電子的に読めるのは第44回（2005年）から。第41〜43回は「時代」で全国値だけを見られる。</li>
        </ul>
      </main>
    </div>
  );
}
