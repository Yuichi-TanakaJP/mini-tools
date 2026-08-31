# Company Functions Derivation Policy

Date: 2026-08-31  
Issue: #555  
Status: Accepted for implementation

## Decision

企業の事業・機能に関する Source of Truth は、各専門 domain に保存された `stock_notes_company_taxonomy_links` とする。

`company-functions` は企業グループを横断比較するための正規化・派生レイヤーであり、原則として同じ企業事実を二重保存しない。

## Rules

1. 専門 taxonomy → `company-functions` の概念対応は、`stock_notes_taxonomy_edges` の `domain='cross-domain'`, `relation_type='related_to'` で表現する。
2. Company Network read model は、この mapping を使って専門 taxonomy の company link から company-function link を動的に導出する。
3. derived link は元 company-taxonomy link の `strategic_role`, `confidence`, `source_type`, `as_of`, `relation_note` を引き継ぐ。
4. 同一 company × function に direct と derived が存在する場合、direct を明示的な例外・override として優先する。
5. derived 同士が競合する場合、confidence、次に role の優先度で代表根拠を決める。tie は決定的な link id 順で解消する。
6. direct `company-functions` link は、既存 taxonomy から一意に導出できない場合だけ許可する。
7. 新しい企業事実を `company-functions` を埋める目的だけで推測追加しない。

## Why

### Avoid duplicate facts

Sony/Hitachi の Phase C (#553) で、既存専門 taxonomy に十分な事業情報があるにもかかわらず、表示のために同じ意味の direct `company-functions` link を保存したケースがあった。

これは現行 UI では機能したが、専門 taxonomy が更新された際に direct link 側との同期が必要になり、Source of Truth が曖昧になる。

### Preserve cross-group comparison

一方、Company Network では Toyota / Mitsui / Sony / Hitachi を同じ軸で比較する必要があるため、共通語彙としての `company-functions` 自体は必要である。

そこで「共通語彙と概念 mapping は保存するが、企業ごとの重複 fact は read model で導出する」方式を採用する。

## Explicit exceptions from Phase C

Phase C #553 で追加した17 direct linksのうち、13件は既存専門 taxonomy + cross-domain mapping から自動導出可能。

以下4件は、元 taxonomy の粒度だけでは一意に導出できないため direct exception として残す。

- Crunchyroll → アニメ・IP
- ソニー・ミュージックエンタテインメント → 音楽
- ソニー・ミュージックエンタテインメント → アニメ・IP
- 日立ビルシステム → 建築設備

これらも将来、専門 taxonomy 側に十分に具体的な Source of Truth が追加され、一意 mapping が可能になれば direct exception を終了できる。

## Non-goals

- 新規汎用テーブルの追加
- 専門 taxonomy の置換
- UI表示のためだけの事実推測
- NTT等のデータカバレッジ拡充

## Operational rule

今後、新しい企業グループを Company Network に追加するときは次の順序で確認する。

1. 既存専門 taxonomy に企業事業 fact があるか
2. 対応する `company-functions` 概念があるか
3. cross-domain mapping があるか
4. 1〜3で導出できるなら direct company-function link は作らない
5. 導出不能で、かつ画面上必要な明示的事実だけ direct exception として保存する
