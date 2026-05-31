# 2026-05-31 premium 画面構成の再設計（ランチャー化）

## 背景

- ログイン後 `/premium` は当初 TOPIX33 premium 構想の「仮トップ（グラフ mock）」として作られていた（2026-04-04 ログイン導線方針）。
- その後、保有銘柄ダッシュボード（2026-04-25）や管理コンソール `/admin`（2026-05-24）が増え、`/premium` トップに TOPIX33 のグラフが直に出る構成は実態と合わなくなっていた。
- 「現行の前提（= TOPIX33 グラフ mock をトップに置く）のまま手を入れても良くならない」という判断から、画面構成を全体的に見直した。

## 今回決めたこと

1. **`/premium` はランチャー（入口）に徹する。** トップにはグラフもデータ集計も置かず、各 premium 機能へのカード導線だけを置く。
   - カード: 保有銘柄ダッシュボード / 業種トレンド(TOPIX33) / 管理コンソール
   - 公開ツール一覧 (`/`) への戻り導線も置く
2. **TOPIX33 のグラフ群（月間ヒートマップ＋業種比較チャート＋モメンタム要約）は `/premium/market` へ全移設する。** 専用ページなので折りたたみはせず直接表示する。
3. **保有銘柄データはサーバ保存を前提に設計する。** 今回は実装せず、`app/premium/portfolio/data.ts` の `loadPortfolio()` を取得 seam として用意し、将来この中だけをサーバ取得へ差し替えれば画面側は変更不要にする。
4. 直前に入れた `CollapsibleSection`（トップでグラフを折りたたむための部品）は、トップからグラフが無くなるため削除する。

## 判断理由

- `/premium` が「何をする場所か」を一目で示すには、データを並べるより機能の入口に徹したほうが迷いが少ない。
- TOPIX33 の可視化自体は価値があるが、それは1機能であって premium の顔ではない。独立ページに分けると、トップの責務（ナビゲーション）と機能の責務（可視化）が分離できる。
- 個人の保有データは本来サーバ保存（アカウント単位）が筋。先に取得 seam を切っておくと、後からの移行が画面非破壊で済む。

## スコープ（今回やらないこと）

- 実際のアカウント認証・サーバ DB・課金の構築（別タスク）。premium-auth の Cookie 簡易ログインは現状維持。
- 保有データの入力 UI / インポート。

## 影響範囲

- `app/premium/page.tsx`（ランチャーへ全面刷新）
- `app/premium/market/page.tsx`（新規。旧 `/premium` のグラフ群を移設）
- `app/premium/portfolio/page.tsx` + `app/premium/portfolio/data.ts`（取得 seam 経由に）
- `app/premium/CollapsibleSection.tsx`（削除）
- 認証・課金方式（将来）

## 関連

- 参照 docs:
  - `docs/decision-log/2026-04-04-premium-login-placeholder-flow.md`
  - `docs/decision-log/2026-04-04-topix33-premium-visualization-plan.md`
  - `docs/decision-log/2026-04-25-premium-portfolio-dashboard.md`
  - `docs/decision-log/2026-05-24-admin-dashboard.md`
