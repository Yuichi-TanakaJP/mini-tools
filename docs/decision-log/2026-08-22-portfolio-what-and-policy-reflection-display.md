# ポートフォリオのWhatとpolicy/reflection表示

## 結論

ポートフォリオ機能の中心は、保有表の表示や自動的な金額配分ではなく、ChatGPTとの対話で投資方針を更新し、
ポートフォリオ全体の現在地・不足・補強方向・振り返りを保存し、MiniToolsで再利用する循環である。

MiniToolsは主入力画面ではなく、stock-notes API/DBに保存された判断を確認する読み取り画面とする。

## 今回の判断

- active policyはreviewの`allocation_policy`とは別の正本データとして表示する
- policyの変更は新しいversionとして履歴に残るため、MiniToolsではactive版と版履歴を表示する
- reflectionはreviewの要約に混ぜず、期待・結果・学び・方針変更案として別表示する
- MiniToolsからpolicyのactive化、reviewのfinalize、reflection保存は行わない
- 今回は新規APIや新規DBテーブルを追加せず、既存Supabaseの本人データを読み取る
- MiniToolsとstock-notesの集計定義を別実装にしないため、exposure・差分・鮮度判定は共有読み取り契約へ移行する候補として残す
- reviewとactive policyの取り違えを防ぐため、reviewの`policy_version_id`を読み取り、policy履歴からv2等の版表示へ解決する。legacy reviewは未紐付けとして表示する

## 実装範囲

今回のUI変更は次の読み取りだけを対象とする。

- active policy
- policy version履歴
- policy rule
- latest reflection
- 既存のreview・recommendation・action

書き込み経路は従来どおりPortfolio GPT → stock-notes API → Supabaseとする。
