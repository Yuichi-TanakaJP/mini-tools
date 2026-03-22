# 2026-03-22 決算カレンダーのデータ contract と運用メモ

## 背景

`mini-tools` に日本株の決算カレンダーを追加するにあたり、`market_info` 側で UI 向けの整形済み JSON を出す流れになった。  
当初は `latest.json` をそのまま読む前提で進めていたが、月間カレンダー UI と過去月表示のことを考えると、`manifest.json + month JSON` を主導線にする方が自然という整理に至った。

## 現時点の contract

### 1. `manifest.json` を主導線にする

`mini-tools` 側では、決算カレンダーの表示に `manifest.json` を正として使う。

想定している役割:

- `manifest.json`
  - 利用可能な月一覧を返す
  - `current_window` を返す
  - 各月の `path` / `partial` / `bucket` を返す
- month JSON
  - 各月の本番表示データ
  - 過去月 / 当月 / 翌月を同じ扱いで読む
- `latest.json`
  - 既存互換用として残す
  - UI の主導線には使わない

### 2. `manifest.json` の内容

`market_info` から受け取った `manifest.json` には、`mini-tools` 側が欲しい情報が揃っている。

確認できた項目:

- `as_of_date`
- `current_window.from`
- `current_window.to`
- `months[].id`
- `months[].year`
- `months[].month`
- `months[].path`
- `months[].partial`
- `months[].bucket`

`bucket` は `past / current / future` の UI 補助に使える。  
`partial` は一部データの月を UI で注記する時に使える。

### 3. month JSON の役割

month JSON は「過去月アーカイブ」ではなく、**その月の正式な表示単位** として扱う。

`mini-tools` 側では:

1. 初回に `manifest.json` を読む
2. 表示対象の月に対応する month JSON を読む
3. その month JSON をそのままカレンダー表示と日別一覧に使う

この構造により、過去月 / 当月 / 翌月を同じ実装で表示できる。

### 4. event_id

`calendar[].items[]` には `event_id` が入る前提で進める。

意図:

- React の一覧 `key` に使う
- 同じ `date + code + time` が複数あっても安定して描画する

`event_id` は upstream の公式 ID ではなく、`market_info` 側で生成する UI 向け ID として扱う。

## `mini-tools` 側の表示方針

### 月移動

ユーザーには実装都合を見せず、普通の月間カレンダーとして扱う。

- 矢印で前月 / 翌月へ移動
- データがある月は month JSON を読んで表示
- データがない未来月は空表示にする
- 過去月は `manifest` に載っている最古月まで遡れる形を想定

### UI とデータの関係

- データの有無判定は `manifest` を正とする
- 表示単位は month JSON
- `latest.json` の「2か月窓」は SBI 由来の配布形式であり、UI の主導線には持ち込まない

## 更新運用について

更新運用の詳細はまだ未確定。  
この話は Issue [#119](https://github.com/Yuichi-TanakaJP/mini-tools/issues/119) で別途整理する。

検討ポイント:

- 月1回 / 週次 / 平日デイリーのどれにするか
- `market_info` 側の出力タイミング
- `mini-tools` 側の取り込みタイミング
- 手動運用で始めるか、自動化するか

## 現時点の判断

採用する方針:

- `manifest.json + month JSON` を主導線にする
- `latest.json` は既存互換用として残す
- `event_id` は利用する
- UI は月単位で表示する

まだ決めていないこと:

- 更新頻度
- 自動化の有無
- 過去月の保持期間

## 補足

この判断により、`mini-tools` 側は「最新 window を直接読む」実装から、  
`manifest` を起点に必要月の JSON を読む実装へ移行する。
