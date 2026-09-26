/**
 * 時代ビュー。全国の党派別得票を回ごとの積み上げ棒で見せる。
 */

import { use, useMemo } from "react";
import type { System } from "../../lib/data/cube.ts";
import { loadEra, loadPalette } from "../data/load.ts";
import { election, exact, longDate, man, pct } from "../data/format.ts";
import { majorParties, stack } from "../data/parties.ts";
import { PartyList, type PartyRow } from "../components/PartyList.tsx";
import { Preliminary } from "../components/Preliminary.tsx";
import { Segmented } from "../components/Segmented.tsx";
import { StackedBars, type Column, type Layout, type Measure } from "../components/StackedBars.tsx";
import { useUrlState } from "../hooks/useUrlState.ts";

const SYSTEMS = [
  { value: "pr", label: "比例代表" },
  { value: "smd", label: "小選挙区" },
] as const;

const MEASURES = [
  { value: "share", label: "得票率" },
  { value: "votes", label: "得票数" },
] as const;

const LAYOUTS = [
  { value: "bars", label: "棒" },
  { value: "flow", label: "流れ" },
] as const;

export const SYSTEM_LABEL: Record<System, string> = { smd: "小選挙区", pr: "比例代表" };

export function EraView() {
  const era = use(loadEra());
  const palette = use(loadPalette());
  const last = era.elections.at(-1)!;

  const [system, setSystem] = useUrlState<System>("sys", "pr", (v) => v === "smd" || v === "pr");
  const [measure, setMeasure] = useUrlState<Measure>("measure", "share", (v) => v === "share" || v === "votes");
  const [layout, setLayout] = useUrlState<Layout>("chart", "bars", (v) => v === "bars" || v === "flow");
  const [party, setParty] = useUrlState<string>(
    "party",
    "",
    (v) => era.smd.parties.includes(v) || era.pr.parties.includes(v),
  );
  const [focusParam, setFocusParam] = useUrlState<string>("n", String(last), (v) =>
    era.elections.includes(Number(v)),
  );
  const focus = Number(focusParam);

  const cube = era[system];
  const major = useMemo(() => majorParties(cube.parties, cube.votes, cube.totals), [cube]);
  const selected = cube.parties.includes(party) ? party : "";

  const columns = useMemo(
    (): Column[] =>
      era.elections.map((n, e) => ({
        n,
        total: cube.totals[e]!,
        segments: stack(
          cube.parties,
          cube.votes.map((v) => v[e]!),
          major,
          selected,
          palette,
        ),
        note: `定数${election(n).seats[system]}`,
      })),
    [era.elections, cube, major, selected, system, palette],
  );

  const fi = era.elections.indexOf(focus);
  const rows = useMemo(
    (): PartyRow[] =>
      cube.parties
        .flatMap((p, i) => {
          const v = cube.votes[i]![fi];
          return v === null || v === undefined ? [] : [{ name: p, votes: v, share: v / cube.totals[fi]! }];
        })
        .sort((a, b) => b.votes - a.votes),
    [cube, fi],
  );
  const pick = rows.find((r) => r.name === selected);

  return (
    <div className="mx-auto flex w-full max-w-[1240px] gap-8 px-6 py-6 max-lg:flex-col-reverse">
      <aside className="w-[300px] shrink-0 max-lg:w-full lg:sticky lg:top-6 lg:flex lg:max-h-[calc(100dvh-3rem)] lg:flex-col lg:self-start">
        <h2 className="flex items-baseline justify-between px-2 pb-1 text-[11px] font-semibold tracking-wide text-faint">
          <span>
            {longDate(focus)} {SYSTEM_LABEL[system]}
          </span>
          <span className="font-normal">得票率</span>
        </h2>
        <PartyList
          rows={rows}
          selected={selected}
          onSelect={(p) => setParty(p === selected ? "" : p)}
          palette={palette}
          allowNone
        />
        <p className="mt-2 border-t border-rule px-2 pt-2 text-[10.5px] leading-relaxed text-faint">
          党を選ぶとグラフでその党だけを濃くする。「すべての党」か、同じ党をもう一度押すと解除。棒を押すとその回の内訳をここに出す。
        </p>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center justify-between gap-3 pb-4">
          <h1 className="text-[19px] font-semibold tracking-tight">全国の党派別得票</h1>
          <div className="flex flex-wrap gap-2">
            <Segmented label="制度" options={SYSTEMS} value={system} onChange={setSystem} />
            <Segmented label="尺度" options={MEASURES} value={measure} onChange={setMeasure} />
            <Segmented label="表示" options={LAYOUTS} value={layout} onChange={setLayout} />
          </div>
        </header>

        <p className="tnum min-h-9 pb-3 text-[12.5px]">
          <span className="font-semibold">
            第{focus}回 {longDate(focus)}
          </span>
          {election(focus).edition === "速報" && <Preliminary />}
          <span className="text-muted">{` · 有効投票 ${man(cube.totals[fi]!)}`}</span>
          {pick !== undefined && (
            <>
              <span className="text-muted"> · </span>
              <span
                aria-hidden
                className="mr-1 inline-block size-[9px] rounded-[2px] align-baseline"
                style={{ backgroundColor: palette(pick.name).base }}
              />
              <span className="font-semibold">{pick.name}</span>
              <span className="text-muted">{` ${exact(pick.votes)}（${pct(pick.share)}）`}</span>
            </>
          )}
          {selected !== "" && pick === undefined && (
            <span className="text-muted">{` · ${selected}はこの回に届出がない`}</span>
          )}
          {selected !== "" && (
            <button
              type="button"
              onClick={() => setParty("")}
              className="ml-2 cursor-pointer rounded border border-rule px-1.5 py-px text-[11px] text-muted transition-[color,border-color,transform] duration-150 ease-out hover:border-rule-strong hover:text-ink active:scale-[0.97]"
            >
              解除
            </button>
          )}
        </p>

        <StackedBars
          columns={columns}
          measure={measure}
          layout={layout}
          highlighted={selected}
          focused={focus}
          onFocus={(n) => setFocusParam(String(n))}
          height={340}
          label={`全国の${SYSTEM_LABEL[system]}の党派別${measure === "share" ? "得票率" : "得票数"}`}
        />

        <ul className="mt-5 flex flex-col gap-1 border-t border-rule pt-3 text-[11px] leading-relaxed text-muted">
          <li>
            定数は第41回 500（小選挙区300・比例200）、第42〜46回 480（300・180）、第47回 475（295・180）、第48回以降 465（289・176）。得票数は定数の変化を補正していない。
          </li>
          <li>
            「流れ」は棒を執行日の位置に置き、続けて届出のあった党どうしを帯でつなぐ。帯は選挙のあいだの推移を表すものではない（選挙のない時期の得票は存在しない）。帯の途切れは党の新設・解散・不出馬。
          </li>
          <li>「その他」は、この制度で全国の得票率が一度も2%に届かなかった党。一覧から選ぶと分けて表示する。</li>
          <li>
            党名が同じなら同じ系列として並べる。第46回と第48回以降の日本維新の会、第48回と第49回以降の立憲民主党は、名前が同じ別の政党。前身・後継の党はつながない。
          </li>
          <li>第41〜43回は全国値だけ。都道府県・比例ブロック別は第44回（2005年）から。</li>
        </ul>
      </main>
    </div>
  );
}
