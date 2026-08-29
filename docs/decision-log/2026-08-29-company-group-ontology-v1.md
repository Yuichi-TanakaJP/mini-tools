# 企業グループ・オントロジー V1

Date: 2026-08-29  
Issue: #518  
Status: Draft for implementation planning

## 1. 背景

企業関係マップは、企業ノード、企業グループ、group membership、企業間の capital / control / historical relation を持つところまで構築した。

一方、実画面を Claude Code 版の業界マップと比較すると、企業を「並べる」「線で結ぶ」だけでは、企業グループの構造や意味を十分に理解できないことが分かった。

問題は描画方式ではなく、同じデータからどの問いに答えるかを規定する意味レイヤーが不足していることである。

V1 では Toyota Group をリファレンスにし、企業グループを理解するための最小オントロジーを定義する。

---

## 2. この画面で最終的に理解したいこと

企業グループ画面は、少なくとも次の問いに答える。

1. **構成**: 誰がこのグループに所属しているか。
2. **資本構造**: 誰が誰を所有・支配しているか。
3. **役割分担**: 各企業はグループ内で何を担っているか。
4. **事業領域**: グループはどの事業領域をカバーしているか。
5. **市場性**: 上場・非上場の構成はどうなっているか。
6. **厚みと空白**: 同じ領域に複数社がいるのか、特定企業に依存しているのか。
7. **根拠**: その情報は公式事実か、分析上の解釈か。

この7問に直接答えない情報は、主画面の優先度を下げる。

---

## 3. 意味レイヤー

### Layer A: Identity

既存の `stock_notes_company_entities` を正本とする。

持つ意味:
- 企業名
- 国
- 上場 / 非上場
- listing 情報

これは「誰か」を表す層。

### Layer B: Group Membership

既存の `stock_notes_corporate_groups` と `stock_notes_company_group_memberships` を正本とする。

持つ意味:
- この企業は公式にこのグループへ所属しているか
- membership role / basis
- source / as-of / verification

重要:
- membership は親子関係ではない
- Toyota Group → Denso の membership と Toyota Motor → Woven の 100% ownership は別の事実

### Layer C: Corporate Relationship

既存の `stock_notes_company_relationships` / read view を正本とする。

V1で表示対象にする factual relation:
- equity_ownership
- parent_of
- controls
- equity_method_investment
- spun_off
- predecessor_of
- merged_into

将来 V2 で commercial / strategic / technology relations を追加する。

### Layer D: Business / Function Taxonomy

企業グループ理解の不足部分として最重要。

原則として新しい独自テーブルを作らず、既存の
- `stock_notes_taxonomy_nodes`
- `stock_notes_taxonomy_edges`
- `stock_notes_company_taxonomy_links`

を再利用する。

ただし既存 taxonomy は `semiconductors`, `autonomous-driving` のようなテーマ・産業ドメイン中心なので、企業グループ横断比較に使うために新しい domain を追加する。

提案 domain:

`company-functions`

V1 node kinds:
- `classification`: 大分類
- `product_segment`: 事業・機能領域

初期 taxonomy 例:

- Mobility / Manufacturing
  - 完成車
  - 車体・生産
  - 自動車部品
  - 電動化・パワートレイン
- Technology / R&D
  - ソフトウェア
  - 自動運転・先進モビリティ
  - 研究開発
- Commerce / Services
  - 商社
  - 金融
- Property / Living
  - 不動産
  - 住宅
- Materials / Industrial
  - 素材
  - 産業機械

ここで重要なのは「Toyota 専用分類」にしないこと。Mitsui Group や Mitsubishi Group にも使える横断 taxonomy にする。

### Layer E: Group Position

「中核」「完全子会社」「上場グループ会社」「研究機関」など、画面上で非常に有用だが、意味の種類が混在する。

したがって1列に押し込まない。

#### E-1. Derived factual position

既存の事実から自動導出できるもの。

例:
- wholly_owned: verified ownership 100%
- listed_member: membership + listed
- private_member: membership + private
- parent_company: outbound parent/control relationを持つ

これらはDBへ重複保存せず、read model / view model で導出する。

#### E-2. Analytical group role

「中核企業」「戦略中核」「補完企業」などは解釈を含む。

V1ではDB factとして保存しない。

将来保存する場合は、`analytical_role` として fact layer と分離し、evidence / rationale / confidence を必須とする。

---

## 4. Toyota Group をこのオントロジーで読む例

現時点の verified/current データでは Toyota Group membership は17社、企業間の確認済み資本 relation は5件ある。

### 構成

- Toyota Motor
- Woven by Toyota
- Daihatsu
- Toyota Auto Body
- Toyota Motor East Japan
- Toyota Motor Kyushu
- Denso
- Aisin
- Toyota Tsusho
- その他の公式グループ企業

### 資本構造

現時点で確認済みの100%出資 relation:
- Toyota Motor → Woven by Toyota
- Toyota Motor → Daihatsu
- Toyota Motor → Toyota Auto Body
- Toyota Motor → Toyota Motor East Japan
- Toyota Motor → Toyota Motor Kyushu

重要:
Denso / Aisin / Toyota Tsusho 等が Toyota Group member であることと、Toyota Motor の100%子会社であることは全く同義ではない。

### 事業・機能

ここが現在のDBで不足している。

例として、公式事実を確認して taxonomy link を付けることで、画面上では次のような理解が可能になる。

- Toyota Motor → 完成車 / モビリティ
- Woven by Toyota → ソフトウェア / 先進モビリティ
- Toyota Auto Body → 車体・生産
- Denso → 自動車部品
- Aisin → 自動車部品
- Toyota Tsusho → 商社
- Toyota Central R&D Labs → 研究開発
- Toyota Home → 住宅
- Toyota Fudosan → 不動産

この分類は設計例であり、実データ化するときは各社公式情報で検証する。

---

## 5. UIビューを「描画形式」ではなく「問い」で定義する

### View 1: 構成

問い:
**このグループには誰がいて、どのような機能を担っているか。**

推奨表現:
- business/function taxonomy ごとのクラスター
- 各クラスター内に企業
- 上場/非上場バッジ
- 100%子会社など factual position のバッジ

現在の単純放射ビューは、この「構成」ビューへ発展させる。

### View 2: 資本・関係

問い:
**企業同士の実際の資本・支配・歴史関係はどうなっているか。**

推奨表現:
- relationを持つ企業を主役にする
- relation未登録企業を無理にキャンバスへ散らさない
- edgeごとに relation type / ownership %
- 関係タイプ凡例

現在の「関係」ビューをこの役割に限定する。

### View 3: 系列

問い:
**資本構造を親→子の階層として読むとどうなるか。**

推奨表現:
- compact tree
- 1 relation = 1 row
- 同一情報をカード2枚で重複させない
- 100% / parent / control をedgeラベルとして表示

### View 4: Coverage Matrix

問い:
**各企業がどの事業・機能領域を担い、どこに厚みや空白があるか。**

行:
- business/function taxonomy

列:
- group companies

cell:
- primary / secondary / support などの link role

Claude Code版の matrix が企業グループ分析にも最も転用価値が高い。

### View 5: Table

問い:
**個々の企業の位置づけ・事業・資本関係・根拠を正確に確認したい。**

推奨列:
- 企業
- 上場 / 非上場 + ticker
- 主な機能 / 事業
- factual position（100%子会社等）
- 主な企業間関係
- source as-of
- evidence

DB内部の `membership_basis`, `verification_status`, internal enum は主列に出さず detailへ寄せる。

---

## 6. 既存DBで再利用できるもの

| 意味 | 既存 | 判断 |
|---|---|---|
| Company identity | `stock_notes_company_entities` | そのまま再利用 |
| Listing | `stock_notes_company_listings` / entity listing status | 再利用 |
| Corporate group | `stock_notes_corporate_groups` | 再利用 |
| Membership | `stock_notes_company_group_memberships` | 再利用 |
| Capital/control/history | `stock_notes_company_relationships` | 再利用 |
| Business/function concepts | `stock_notes_taxonomy_nodes` | 新domain追加で再利用 |
| Taxonomy hierarchy | `stock_notes_taxonomy_edges` | 再利用 |
| Company ↔ function | `stock_notes_company_taxonomy_links` | 再利用候補 |
| Evidence / as-of | 各既存relation/link | 再利用 |

結論:
**V1で新しい汎用テーブルを増やす必要はない可能性が高い。**

まず `company-functions` taxonomy と company-taxonomy links を使って意味密度を上げる。

---

## 7. 既存 `company_taxonomy_links` の注意点

現行列:
- `strategic_role`
- `control_type`
- `relation_note`
- `source_type`
- `confidence`
- `as_of`
- validity

これは業界マップ文脈では使えるが、企業の「事業・機能の関与度」を表すには名称がやや不自然。

V1実装前に次を判断する。

Option A: 既存列を意味づけして再利用
- `strategic_role`: primary / secondary / support
- `control_type`: null

Option B: link tableに `participation_role` を追加
- primary
- secondary
- support

V1推奨は **Option Aで試験**。Toyota Group 17社で表現力が不足すると確認できた場合だけschemaを増やす。

---

## 8. 事実と分析の境界

### Factとして保存してよい

- 公式グループmembership
- 上場 / 非上場
- 出資比率
- 親会社 / 子会社
- 公式事業セグメント・主要事業
- 公式に記載された研究機能等

### 分析として扱う

- 「グループの中核企業」
- 「戦略的重要企業」
- 「成長ドライバー」
- 「弱い領域」
- 「依存度が高い」

UIでは両方見せられるが、データソースと視覚表現を分ける。

---

## 9. V1実装順序

### Step 1 — taxonomy設計

`company-functions` の最小 taxonomy を作る。
Toyota 専用にせず、Mitsui / Mitsubishi でも使える分類にする。

### Step 2 — Toyota Group factual mapping

17社について公式情報を調査し、各社を1〜3個程度のfunction nodeへリンクする。

原則:
- primary function 1つ
- 必要に応じて secondary function
- 推測分類禁止

### Step 3 — read model

group membership + company relationships + company function taxonomy を一度に読める read model / API を作る。

### Step 4 — UI再設計

優先順位:
1. 構成（function cluster）
2. Coverage Matrix
3. 資本・関係
4. 系列
5. Table

### Step 5 — Mitsuiで汎用性検証

Toyota固有設計になっていないかを Mitsui Group 22社で確認する。

---

## 10. 次Issueへの分割案

1. `[企業関係 Phase 7A] company-functions taxonomy V1を作成する`
2. `[企業関係 Phase 7B] Toyota Group 17社を事業・機能taxonomyへfact mappingする`
3. `[企業関係 Phase 7C] 企業グループread modelへfunction taxonomyを統合する`
4. `[企業関係 Phase 7D] 構成ビューをfunction cluster型へ刷新する`
5. `[企業関係 Phase 7E] Company × Function coverage matrixを追加する`
6. `[企業関係 Phase 7F] Mitsui Groupでontology汎用性を検証する`

---

## 11. Decision

企業関係マップの次フェーズでは、描画形式を増やすより先に意味レイヤーを厚くする。

V1では新規の専用ontologyテーブルを増やさず、既存 taxonomy infrastructure を企業グループ分析へ再利用する。

中心となる追加概念は `company-functions` taxonomy であり、企業ごとの公式事業・機能をfactとしてリンクする。

UIは「同じデータを違う形にする」のではなく、それぞれ別の問いへ答える:
- 構成
- 資本・関係
- 系列
- Coverage Matrix
- Table

この設計をToyota Groupで成立させた後、Mitsui Groupで汎用性を検証する。
