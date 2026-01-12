# QR 共有モーダル実装に関する設計判断（2026-01-11）

## 背景

トップ画面に共有用 QR コードを表示したところ、以下の問題が発生した。

- QR モーダルが小さい画面で見切れる
- Header（position: sticky）と z-index が競合し、モーダルが隠れる
- Google Lens で QR を読むとリンクではなくバーコード検索扱いになる
- QR と URL コピーで遷移先 URL が異なる（localhost / 本番 URL の不整合）

## 判断 1: モーダルは Portal で document.body 直下に出す

### 理由

- position: sticky による stacking context の影響を回避するため
- z-index の調整だけでは将来的に再発する可能性が高いため

### 採用案

- React Portal（createPortal）を使用
- overlay は position: fixed + inset: 0

## 判断 2: 共有 URL 生成を 1 関数に集約

### 理由

- QR / Copy / SNS で URL がズレる事故を防ぐ
- Google Lens が確実にリンクとして認識する絶対 URL を保証するため

### 採用案

- getShareUrl() に URL 正規化ロジックを集約
- QR と Copy の両方で同一関数を使用

## 判断 3: Header の高さを明示

### 理由

- モーダル表示時に Header が重なって見切れるのを防ぐ
- sticky header の実寸を UI 仕様として明確化するため

### 採用案

- Header に height: 88px を明示指定

## 結果

- QR モーダルは常に画面中央に安定表示
- Google Lens で正しくリンク認識
- lint / build ともに問題なし
- 実装と UI の責務が明確になった
