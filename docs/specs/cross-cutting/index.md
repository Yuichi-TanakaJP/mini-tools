# 横断仕様インデックス

複数ツールにまたがる現在仕様、データ contract、設計境界を整理する場所です。

| 仕様 | 内容 |
|---|---|
| [mini-tools システム構成概要](./system-architecture-overview.md) | アプリ全体の構成、データ取得、保存、外部依存 |
| [React Server / Client 責任境界](./react-server-client-boundaries.md) | Server Component と Client Component の役割分担 |
| [Market Tools データ取得経路一覧](./market-tools-data-fetch-paths.md) | market tools の取得元、fallback、内部 route |
| [QR 共有 URL 仕様](./share-url-spec.md) | QR / コピー / SNS 共有 URL の生成方針 |
| [UI カラーパレット仕様](./ui-color-palette.md) | 採用中・候補カラーパレットと CSS 変数 |
| [株価ランキング UI JSON CLI 仕様](./stock-ranking-ui-json-cli-spec.md) | market_info 側 CLI の入出力 contract |

## 更新ルール

- ツール固有の詳細は `docs/specs/tools/` に置く
- 横断仕様には対象範囲と関連 tool を明記する
- 計画や段階移行の話は `docs/plans/` に置く
