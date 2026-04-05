# 2026-04-05 yutai-candidates の SBI 短期対象表示ルール

## 背景

- `yutai-candidates` で SBI 一般信用データを表示しているが、`latest.json` には日計り・ハイパー・短期・長期が混在している。
- 画面では「15営業日短期売りとして扱っているか」を知りたい一方、在庫は日々変動するため、在庫状態まで表示条件に入れると月別候補の見え方が不安定になる。
- 実際に `is_short=true` の銘柄でも `position_status=unavailable` の日に画面から消えてしまい、利用意図とズレていた。

## 今回決めたこと

- `yutai-candidates` では SBI データの扱い有無を `is_short=true` だけで判定する。
- `position_status` による在庫あり・残少・在庫なしの違いは、表示条件にもフィルタ条件にも使わない。
- UI 上の SBI 表示は `SBI売可` の 1 種類だけにし、「扱っているか / 扱っていないか」だけを示す。

## 判断理由

- ユーザーが確認したいのは、その銘柄を SBI の短期売り対象として扱っているかどうかであり、当日の在庫変動ではない。
- 在庫状態を表示条件に含めると、同じ月の候補一覧が日によって増減し、月次候補比較やピック作業の一貫性が落ちる。
- 在庫状態は変動値なので、扱い有無のような安定した属性と分けて扱う方が UI の意味が明確になる。

## 影響範囲

- [ToolClient.tsx](/c:/Users/yutaz/dev/mini-tools/app/tools/yutai-candidates/ToolClient.tsx)
- `SBI` フィルタ文言は `SBI: 売可あり` とし、在庫状態ではなく短期対象の扱い有無を表す。
- `SBI` バッジは在庫状態を区別せず、`SBI売可` のみ表示する。

## 残課題

- API の `position_status` 文字列は `available` / `unavailable` 以外に API 依存値を返すことがあるため、将来 UI で在庫状態を再度扱う場合は contract を別途固定する。

## 関連

- Issue:
- PR:
- 参照 docs:
  - [Market Tools データ取得経路一覧](/c:/Users/yutaz/dev/mini-tools/docs/market-tools-data-fetch-paths.md)
