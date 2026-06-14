## QR 共有 URL の仕様について

本プロジェクトでは、QR コード共有および URL コピーに使用する URL を  
**resolveShareUrl() 関数に集約**して管理しています。

### 方針

- QR / コピー / SNS などの共有導線で **URL の不整合を起こさない**
- Google Lens 等で確実にリンクとして認識される **絶対 URL** を使用する

### 実装上の前提

- `NEXT_PUBLIC_SITE_URL` が定義されている場合は、共有 URL の基準（base）として優先的に使用する
- ローカル開発環境（localhost）であっても、QR 共有では正規サイト URL を生成する
- URL 生成ロジックは 1 箇所（`components/share-url.ts` の `resolveShareUrl`）に集約し、分岐はオプションで表現する（将来拡張用）

### base の解決順とハイドレーション

共有 URL の base は次の順で解決する:

1. `NEXT_PUBLIC_SITE_URL`（設定時は SSR・クライアントとも常にこれを使用）
2. **env 未設定時はマウント後に現在の `origin`（`window.location.origin`）を使用する**

`origin` はブラウザ依存値のため、**レンダー中には読まない**。`ShareButtons` はマウント後に `useEffect` で `origin` を state へ注入し、再レンダリングで絶対 URL へ昇格させる。これにより **SSR とクライアント初回描画の出力が一致**し、ハイドレーションミスマッチを防ぐ。

- env 未設定 かつ マウント前（SSR / 初回 CSR）: 相対 URL（例 `/tools/x`）を返す
- env 未設定 かつ マウント後: `origin` を base にした絶対 URL を返す
- env 設定済み: マウント前後を問わず env を base にした絶対 URL を返す

### url prop の扱い

- `url` prop は対象 URL の明示指定として扱う
- `url` prop が**絶対 URL** の場合はそのまま使用する
- `url` prop が**相対 URL** の場合は、`pathname` と同じく base で絶対化する（base 未解決時のみ相対のまま）

この方針により、開発環境と本番環境の差異による共有トラブルと、ハイドレーション不整合を防いでいます。
