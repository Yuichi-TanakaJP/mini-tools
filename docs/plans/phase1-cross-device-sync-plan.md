# Phase 1: クロスデバイス同期 実装計画（Supabase）

「ローカルデータの任意ログイン同期方針」（[decision-log 2026-06-21](../decision-log/2026-06-21-localstorage-optional-login-sync-policy.md)）の **Phase 1**。
未ログインは従来どおり端末内完結。ログイン時だけ、ツールデータをサーバー（DB）に保存し、別端末で復元できるようにする。

- 関連: [Phase 0（JSON エクスポート/インポート）](../../lib/local-data-transfer.ts) は実装済み（PR #380）。
- アーキ図: `OneDrive/dev-docs/mini-tools-architecture.html` セクション 5。

## 結論（採用スタック）

- **Supabase（Auth + PostgreSQL + RLS）** を採用する。
- 理由:
  - 本番で個人データを預かるため、**認証は自作せずマネージドに寄せる**（パスワードハッシュ・セッション・リセット・漏洩対策の自作リスクを回避）。
  - **RLS（Row Level Security）** で「自分の行だけ読み書き」を DB 側で強制でき、権限の肝を最小コードで担保できる。
  - mini-tools と同じ Next.js での Supabase 実装例（`dev/data-gallery`）があり、配線を流用できる。
  - 無料枠で足りる。
- 採らなかった案:
  - **Neon + 自前認証**: ログイン自作は学習価値が高いが、本番で認証を自作するセキュリティ責任が重い。
  - **Supabase DB + 自前セッション**: 認証の安全性が自作品質に依存するため本番では非推奨。

## 設計の柱

- **ローカルファースト**: LocalStorage を手元の正＝キャッシュとして維持。未ログインなら一切サーバー送信なし。
- **オプトイン**: ログインは任意。未ログインでも全機能が動く。
- **競合解決**: `updatedAt` の last-write-wins（新しい方を採用）。
- **権限**: RLS により `user_id = auth.uid()` の行だけ読み書き可。
- **段階**: 当初は **優待メモ帳（`yutai_memo_items_v1`）1 本**を縦に通す。2026-06-21 の本番確認後、手動保存/復元の対象を `lib/sync/registry.ts` に登録した LocalStorage 系主要キー（優待メモ帳、優待カレンダー、株主優待期限帳、マイ銘柄）へ拡張した。汎用 key-value 構造にし、後続ツールは行を足すだけ。

## データモデル

汎用の「ユーザー × LocalStorage キー × 値」テーブル 1 つにする。
ツールごとにテーブルを増やさず、既存の保存キー（`*_v1`）をそのまま預かる。

```
table: tool_data
- user_id     uuid        not null   references auth.users(id) on delete cascade
- key         text        not null   -- 例: "yutai_memo_items_v1"
- value       jsonb       not null   -- 各ツールが保存している JSON（文字列ではなく parse 済み）
- updated_at  timestamptz not null default now()
- primary key (user_id, key)
```

- 1 ユーザー × 1 キー = 1 行（upsert）。
- `value` は JSON。LocalStorage 上は文字列だが、送信時に parse して jsonb で持つ（検索・将来の集計に有利）。
- RLS: SELECT / INSERT / UPDATE / DELETE すべて `user_id = auth.uid()` を条件にする。

スキーマ・ポリシーの実体は [`supabase/schema.sql`](../../supabase/schema.sql)。Supabase の SQL Editor で実行する。

## API 契約（Route Handler）

サーバー（Next.js）に同期 API を置く。Supabase のセッション Cookie から `user` を取得し、未ログインは 401。

| メソッド | パス | 役割 | 入力 | 出力 |
|---|---|---|---|---|
| GET | `/api/sync` | 自分の全データを取得（復元用） | （なし） | `{ items: { key, value, updatedAt }[] }` |
| POST | `/api/sync` | 1 つ以上のキーを upsert（保存用） | `{ items: { key, value, updatedAt }[] }` | `{ items: { key, value, updatedAt }[] }`（マージ後） |

- POST は `updatedAt` を比較し、**サーバー側が新しければ採用しない**（last-write-wins）。応答で確定値を返す。
- 環境変数が未設定なら 503（機能無効）。未ログインは 401。

## クライアント同期層

- `lib/sync/` に、対象キーの登録と push/pull を置く。
- 優待メモ帳の保存（`yutai_memo_items_v1`）を契機に、ログイン中ならデバウンスして POST。
- 起動時・ログイン直後に GET して、`updatedAt` が新しい方で LocalStorage を更新。ログイン直後はメタ無しの既存ローカル実データを保護し、手動の「復元」はサーバー側を優先する。
- 初回ログイン時は、ローカルにあるデータをサーバーへ吸い上げる（空のサーバーで上書き消去しない）。

## 認証フロー

- Supabase Auth（メール＋パスワード、もしくはマジックリンク。初手はメール＋パスワードを想定。後で確定）。
- `@supabase/ssr` でサーバー / クライアント両方のセッションを Cookie 経由で共有。
- ログイン/サインアップ UI を `/account`（仮）に置く。premium ログイン（共有 PW）とは別物。

## 環境変数

`.env.local`（と Vercel）に設定。`.env.local.example` にキー名のみ追記済み。**値は commit しない。**

| 変数 | 公開範囲 | 用途 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 公開 | Supabase プロジェクト URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 公開（ブラウザ可） | RLS 前提の anon キー |

- service_role キーは**当面使わない**（RLS + ユーザーセッションで完結するため）。管理操作が必要になったら別途サーバー専用で追加する。

## provision 手順（ユーザー作業）

私（Claude）はアカウントを作れないため、以下はご自身で行う。

1. Supabase で新規プロジェクトを作成（リージョンは ap-northeast 系を推奨）。
2. SQL Editor で [`supabase/schema.sql`](../../supabase/schema.sql) を実行（`tool_data` テーブル + RLS）。
3. Authentication → 設定でメール認証を有効化（確認メールの要否を選ぶ）。
4. Project Settings → API から `URL` と `anon public` キーを取得。
5. ローカル `.env.local` と Vercel の環境変数に `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` を設定。
6. 設定できたら連絡 → こちらで認証 UI と優待メモ帳の同期を実機検証しながら仕上げる。

## ロールアウト

1. **本 PR（foundation）**: 計画・スキーマ・依存・Supabase 配線・env 雛形・`/api/sync` 骨組み（未設定時 503）。既存ページからは未参照でビルドに影響なし。
2. **次 PR**: 認証 UI + 優待メモ帳の同期（provision 後、実機検証込み）。
3. **その後**: 対象ツールを順次拡大。Phase 2 で自動同期・競合の精緻化。

## リスクと可逆性

- 未ログイン時の挙動は不変なので、既存ユーザーへの影響はゼロ。
- 環境変数未設定なら同期機能は完全に無効（503）＝安全側に倒れる。
- データは既存 LocalStorage 形式のまま預かるので、撤退時もローカルは無傷。
- pause 懸念（Supabase 無料枠）: 実利用が始まれば起きにくい。最悪も復帰可能。

## 残課題

- 認証方式（メール＋パスワード / マジックリンク / OAuth）の最終決定。
- 退会・データ削除（GDPR 的）導線。
- 競合解決を要素単位に精緻化するか（当面はキー丸ごと last-write-wins）。
- 同期トリガの頻度・デバウンス・オフライン再送。

## 関連

- decision-log: [2026-06-21 ローカルデータの任意ログイン同期方針](../decision-log/2026-06-21-localstorage-optional-login-sync-policy.md)
- 参考実装: `dev/data-gallery`（Supabase × Next.js）
- Phase 0 実装: `lib/local-data-transfer.ts`, `app/tools/data-transfer/`
