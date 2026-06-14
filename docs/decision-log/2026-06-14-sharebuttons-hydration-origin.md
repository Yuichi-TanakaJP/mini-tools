# ShareButtons の共有 URL ハイドレーション対応

Date: 2026-06-14

## Decision

`ShareButtons` の共有 URL 生成を、SSR とクライアント初回描画で必ず一致させる。

- URL 生成ロジック `resolveShareUrl` を `components/share-url.ts` に純関数として切り出し、単体テスト可能にする。
- `resolveShareUrl(urlProp, pathname, searchParams, origin)` は base を `NEXT_PUBLIC_SITE_URL` → `origin` の順で解決する。`origin` は引数で受け取り、関数内で `window` を参照しない。
- `ShareButtons` は `useSyncExternalStore` で origin を取得する（server snapshot = `null`、client snapshot = `window.location.origin`）。これによりサーバー / ハイドレーション初回は `null`、マウント後に現在 origin へ昇格する。
- url prop が相対 URL の場合も base で絶対化する（絶対 URL ならそのまま）。

## Reason

旧実装は `resolveShareUrl` がレンダー中に `typeof window` を見て分岐していた。`NEXT_PUBLIC_SITE_URL` 未設定時、サーバーは相対パス・クライアントは `window.location.origin` 基準の絶対 URL を返し、共有リンクの `href` がハイドレーションで不一致になっていた（`.env` で同変数を空/削除した際に顕在化。`.env` 変更がバグを作ったのではなく、既存の潜在バグが表面化した）。

リポジトリ方針「SSR とクライアント初回描画を一致させ、ブラウザ依存値はマウント後に注入する」に合わせ、origin をレンダー中に読まない構成へ変更した。`useSyncExternalStore` は React 公式の SSR セーフなブラウザ値取得手段で、`useEffect` 内同期 setState を禁じる lint ルール（react-hooks/set-state-in-effect）にも抵触しない。

## Impact

- `NEXT_PUBLIC_SITE_URL` 未設定（ローカル開発）でも共有リンクのハイドレーション警告が出ない。env 設定時は従来どおり最初から絶対 URL。
- `resolveShareUrl` に env 未設定 / 設定済み / url prop 指定（絶対・相対）のケースを `components/__tests__/share-url.test.ts` で網羅。
- 仕様は [share-url-spec.md](../specs/cross-cutting/share-url-spec.md) に base 解決順・url prop の扱いを追記。
