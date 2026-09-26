# 衆議院選挙で、どの党がどれだけ票を得てきたか

総務省「衆議院議員総選挙・最高裁判所裁判官国民審査結果調」をもとに、1996年以降の総選挙の党派別得票を探索するダッシュボード。

visualizing.jp スタンドアロン（dataviz.jp サブスクツールではない）。

想定URL: https://election-shugiin-timeseries.visualizing.jp

## ビュー

| ビュー | 内容 |
| --- | --- |
| 時代 | 全国の党派別得票（第41〜51回、1996–2026）。小選挙区／比例代表、得票率／得票数 |
| 都道府県 | 小選挙区の都道府県別得票率（第44回以降）と、選んだ県の推移 |
| 比例ブロック | 比例代表の11ブロック別得票率（第44回以降）と、選んだブロックの推移 |

データ設計の正本は [`docs/data-sources.md`](docs/data-sources.md)。

## 開発

```bash
npm install
npm run fetch && npm run normalize && npm run verify && npm run data
npm run dev
```

| スクリプト | 内容 |
| --- | --- |
| `npm run fetch` | 総務省の結果調（Excel / PDF）を `data/raw/` に取得 |
| `npm run normalize` | 回ごとの正規化 JSON を `data/normalized/` に書き出す（第44回の PDF には poppler の `pdftotext` が要る） |
| `npm run verify` | 合計・地域の合計・全国表・確定値との突合 |
| `npm run data` | 正規化 JSON から配信用 JSON を `public/data/` に書き出す |
| `npm run dev` | Vite 開発サーバ |
| `npm run build` | 本番ビルド |
| `npm run typecheck` | TypeScript 検査 |

配色のルールは `src/lib/data/palette.ts`（色相＝党、明度＝量、CIE HCL）。党の色相は `npm run data` が全国の得票から決めて `public/data/palette.json` に書く。見分けやすさの確認は `node scripts/palette-check.ts > .tmp-screenshots/palette.html`（党×段階の色見本、色覚シミュレーション、同じ回の主要な党どうしの色差）。

`data/normalized/` と `public/data/` は追跡する。第41〜43回の `data/normalized/*.json` は手起こしの正本で、`normalize` は上書きしない。

## GitHub Pages / DNS

- `.github/workflows/pages.yml` で Pages にデプロイする。
- カスタムドメイン `election-shugiin-timeseries.visualizing.jp` は `public/CNAME` に置いた。Pages 設定と visualizing.jp 側 DNS（既存シリーズと同じ運用）で登録する。
- Google Analytics の測定ID（`src/app/analytics.ts`）は空のまま。空のあいだは計測しない。
