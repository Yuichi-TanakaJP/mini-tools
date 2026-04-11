# 2026-04-11 ローディングUIのスピナー2段パターン統一

## 背景

- ローディング中の表示が各ツールでバラバラだという指摘から調査を実施
- スクリーンショットで確認した「スピナー上・テキスト下の縦並び（2段）」を基準に、統一されていない箇所を洗い出した
- 関連するシーン：ページ遷移時（`loading.tsx`）と、コンポーネント内データ取得時の2種類がある

## 今回決めたこと

### ローディングUIの役割分担

| シーン | 担当 | UI |
|---|---|---|
| ページ遷移時（コンポーネント未レンダリング） | `loading.tsx` | スケルトンUI |
| 初回データ取得（コンポーネントはレンダリング済み・データなし） | 各 `ToolClient.tsx` | スピナー2段 |
| 日付・条件切り替え（旧データがある） | 各 `ToolClient.tsx` | 旧データ表示 ＋ ナビ内小スピナー |

### スピナー2段の定義

```
    ○         ← スピナー（上）
  読み込み中...  ← テキスト（下）
```

`flexDirection: "column"` で縦並びにする。横並び（`display: flex` デフォルト）は禁止。

### 基準実装

`nikkei-contribution/ToolClient.tsx` の初回ロード時スピナーを基準とする。

```tsx
<div style={{ padding: "56px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
  <div className={styles.spinner} />
  <span style={{ color: "var(--color-text-muted)", fontSize: 13 }}>読み込み中...</span>
</div>
```

## 判断理由

### スケルトン vs スピナーの使い分け根拠

- **スケルトンの効果が発揮されるのはロード時間が1秒以上の場合**（Google研究）
- Googleの研究で「100ms未満のフィードバックはユーザーに知覚されない」とされている
- コンポーネント内の2回目以降のデータ取得（日付切り替え等）は既存データを見せることができるため、スケルトンは不要

### コンポーネント内でスケルトンを使わない理由

- `loading.tsx`（スケルトン）はページ遷移時（ルートレベル）で既に表示される
- ページ遷移後、コンポーネントがマウントされた時点でヘッダー・ナビ等は既に表示済み
- その状態でスケルトン（灰色ブロック）を再表示すると「一度見えたコンテンツが灰色に戻る」逆行した見た目になる
- `loading.tsx` との重複実装にもなる

### API不要なツール（charcount / total / yutai-expiry）に loading.tsx を追加しない理由

- これらはAPI呼び出しがなく、ロード時間がほぼゼロ
- 100ms未満で消えるスケルトンは視覚的なちらつき（フラッシュ問題）を引き起こし、何も表示しない場合より悪いUXになりうる

## 影響範囲

### 今回修正したファイル

| ファイル | 変更内容 |
|---|---|
| `app/globals.css` | `@keyframes skeleton-pulse` / `@keyframes spin` / `.loading-spinner` クラスを追加 |
| `app/tools/topix33/ToolClient.tsx` | スピナー+テキストを横並び→縦並びに修正 |
| `app/tools/stock-ranking/ToolClient.tsx` | テキストのみ→スピナー2段に修正 |

### 変更しなかったファイル・理由

| ファイル | 理由 |
|---|---|
| `app/tools/nikkei-contribution/ToolClient.tsx` | 既に2段で基準通り（変更不要） |
| `app/tools/nikkei-contribution/ToolClient.tsx:990` | ナビ内の小スピナー（ステータスバッジ代替）で問題なし |
| `app/tools/topix33/ToolClient.tsx:411` | 今回修正済み |
| charcount / total / yutai-expiry / yutai-memo の `loading.tsx` | ロード時間ほぼゼロのため追加不要 |

## 残課題

- スピナーのスタイルが `globals.css`（`.loading-spinner`）と CSS Module（`styles.spinner`）に分かれている
  - 将来的に `<LoadingSpinner />` 共通コンポーネントに統一することを検討してよい
  - 現時点では差し迫った問題ではないため保留

## 関連

- Issue: なし（会話から直接実装）
- PR: 対応するPRを参照
- 参照 docs: [2026-04-07 loading.tsx 追加と並列 fetch 化](./2026-04-07-loading-ui-and-parallel-fetch.md)
