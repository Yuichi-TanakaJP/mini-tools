# 2026-05-06 ペンギン・エイリアンシューター 敵キャラクター変更

## 背景

- ペンギン・バニーシューターの敵を、うさぎからエイリアンへ変更したい要望があった
- 直近でコンボ・スコアポップアップ・レベルアップ演出を追加しており、敵の見た目とゲーム内文言もあわせて揃える必要があった

## 今回決めたこと

- 敵キャラクターの絵文字表示を `🐰` から `👾` に変更する
- ゲーム内の敵呼称は「宇宙うさぎ」ではなく「宇宙エイリアン」にする
- 表示タイトル・metadata・トップページカードの名称は「ペンギン・エイリアンシューター」に変更する
- URL は既存導線との互換性を優先し、`/tools/penguin-rabbit-shooter` のまま維持する

## 判断理由

- 敵表示だけを差し替えてタイトルや説明文が「うさぎ」のままだと、ユーザー体験として不整合になる
- URL 変更は既存リンク・canonical・トップページ導線への影響が大きいため、今回の見た目変更とは分ける
- エイリアン表示は追加画像なしで成立するため、従来の絵文字ベース実装方針を維持できる

## 影響範囲

- `app/tools/penguin-rabbit-shooter/ToolClient.tsx`
- `app/tools/penguin-rabbit-shooter/page.tsx`
- `app/page.tsx`
- `docs/product-spec.md`

## 関連

- 参照 docs:
  - `docs/decision-log/2026-04-17-penguin-rabbit-shooter-minimal-intro.md`
  - `docs/decision-log/2026-05-06-penguin-combo-score-feedback.md`
