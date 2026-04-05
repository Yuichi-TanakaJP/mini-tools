# 2026-04-05 海外決算カレンダー統合方針

## 背景

`market-info-api` 側で海外決算カレンダー API が `main` にマージされた。  
`mini-tools` 側では既存の国内決算カレンダーがあり、別 tool に分けるか、同一画面に統合するかを決める必要があった。

利用可能になった endpoint:

- `GET /earnings-calendar/overseas/latest`
- `GET /earnings-calendar/overseas/manifest`
- `GET /earnings-calendar/overseas/monthly/{YYYY-MM}`

## 決めたこと

### 1. UI は既存の決算カレンダーに統合する

- `mini-tools` 側では `/tools/earnings-calendar` を維持し、画面内で `国内 / 海外` を切り替える
- 「国内版と海外版で別 tool を増やす」よりも、比較しやすさと導線の少なさを優先する

### 2. 主導線は `manifest + monthly` にする

海外版でも、国内版と同じく UI の主導線は次で統一する。

- `manifest`
  - 利用可能月一覧を決める
  - `current_window` を確認する
  - 月タブ / 月移動の対象範囲を決める
- `monthly/{YYYY-MM}`
  - 月間カレンダーと日別一覧の本体データとして使う

### 3. `latest` は補助用途として扱う

- `latest` は「最新スナップショット全体」を素早く出したい用途に向いている
- ただし月間 UI の主経路には使わず、最新件数や補助情報の表示に留める

### 4. `year_month` は mini-tools 側でも `YYYY-MM` を正とする

- route / loader / UI いずれも `YYYY-MM` 前提で扱う
- 不正形式は upstream で `422`
- 存在しない月は upstream で `404`
- UI ではユーザーに raw error を見せず、「その月のデータはまだありません」に寄せて扱う

### 5. 海外 monthly item は mini-tools 側で UI 用 shape に正規化する

live API 確認の結果、海外 `monthly/{YYYY-MM}` の `items[]` は国内版と別 field 名で返っていた。

- 海外:
  - `local_time`
  - `ticker`
  - `stock_name`
  - `exchange_code`
  - `fiscal_term_name`
- 国内 UI が期待する shape:
  - `time`
  - `code`
  - `name`
  - `market`
  - `announcement_type`

このため `mini-tools` 側の loader で次の対応を行う。

- `local_time` -> `time`
- `ticker` -> `code`
- `stock_name` -> `name`
- `exchange_code` -> `market`
- `fiscal_term_name` -> `announcement_type`

補足:

- `event_id` はそのまま利用する
- `publish_status` は `sch_flg` から画面表示用に補完する
- `progress_status` は海外版では UI 主用途がないため、`country_code` を退避的に保持する

## 理由

### 1. 既存の国内版とデータ構造が近い

国内版もすでに `manifest + month JSON` を前提にしているため、海外版だけ別の導線にすると実装も説明も増える。

### 2. market tools の API 統一方針と相性が良い

`mini-tools` では market tools の取得入口を `MARKET_INFO_API_BASE_URL` に寄せていく方針を採っている。  
海外決算もこの流れに乗せることで、loader の責務を揃えやすい。

### 3. `latest` 直読より月単位 UI の方が自然

`latest` は current window 全体把握には便利だが、月切替・過去月参照・空月表示を考えると、UI の基準は `manifest + monthly` の方が扱いやすい。

## 影響範囲

- `app/tools/earnings-calendar`
- `README.md`
- `docs/system-architecture-overview.md`
- `docs/market-tools-data-fetch-paths.md`

## 補足

現時点では国内版の元データは repo 同梱 JSON を維持し、海外版のみ `market-info-api` から取得する。  
将来的に国内版も API 化する場合は、同じ page / client 構成のまま loader の取得先だけ差し替える。
