-- Workspace Core V3 inventory expansion - Wave 2 / Knowledge + Evolution

begin;

insert into knowledge.items (
  canonical_key, kind, title, statement, lifecycle_status, verification_status,
  source, confidence, verified_at
)
values
  ('data-gallery-public-read-privileged-write','principle','公開ReadとPrivileged Writeを分離する','Gallery閲覧には公開Keyを使い、投票writeはserver-side Route Handlerのservice-role経由に限定する。','active','confirmed','artifact-review',1.000,'2026-09-04T17:10:00Z'),
  ('data-gallery-contract-validation','principle','APIとUIのData ContractをSchemaで揃える','Data構造変更時はZod schemaを更新し、APIとUI双方の整合性を確認する。','active','confirmed','artifact-review',1.000,'2026-09-04T17:10:00Z'),

  ('notion-script-fill-missing-fields','goal','Notion DBの空欄をAIで補完する','Notion DBから空欄を持つEntryを抽出し、AI補完した結果を安全に元DBへ反映する。','active','confirmed','artifact-review',1.000,'2026-09-04T17:10:00Z'),
  ('notion-script-no-overwrite','principle','既存Dataは上書きせず空欄だけ補完する','AI補完によって既存Fieldの内容を壊さず、空欄Fieldだけを更新対象にする。','active','confirmed','artifact-review',1.000,'2026-09-04T17:10:00Z'),
  ('notion-script-dry-run-before-write','principle','Write前にdry-runで確認する','Notionへの本番書戻し前にdry-runで変更内容を確認できる運用を持つ。','active','confirmed','artifact-review',1.000,'2026-09-04T17:10:00Z'),

  ('test-trade-rigorous-ai-strategy-validation','goal','AIが出すStrategy案を厳密に検証する','YouTubeで見たAI戦略生成の発想を、先読み・過学習を避ける小さなResearch環境で検証する。','active','confirmed','artifact-review',1.000,'2026-09-04T17:10:00Z'),
  ('test-trade-no-lookahead','principle','当日までの情報だけでSignalを計算する','Signalは当日終値までの情報で計算し翌日始値で売買するなど、future leakageを避ける。','active','confirmed','artifact-review',1.000,'2026-09-04T17:10:00Z'),
  ('test-trade-holdout-discipline','principle','Testを見てParameterを選び直さない','trainで候補を絞りvalidationで比較し、最後に選んだ1案だけをtestで評価する。test結果で再調整すればtestではなくなる。','active','confirmed','artifact-review',1.000,'2026-09-04T17:10:00Z'),
  ('test-trade-no-production-strategy-yet','insight','現時点で実運用採用Strategyはない','多数のStrategyを検証したが実運用開始判定はまだなく、暫定候補はPaper Tradingと未使用期間での前向き検証へ進める。','active','confirmed','artifact-review',1.000,'2026-09-04T17:10:00Z'),
  ('test-trade-research-only','constraint','Research用であり収益保証・投資助言ではない','検証環境の結果をそのまま実資金採用や収益保証として扱わない。','active','confirmed','artifact-review',1.000,'2026-09-04T17:10:00Z'),

  ('sensoria-unify-activity-and-media-routes','goal','活動・経歴を集約し外部Media導線を一本化する','個人の活動・経歴・300本超の記事実績をJournal / Works / Media Kitへ集約し、読者・編集者・協業候補が理解・遷移しやすくする。','active','confirmed','artifact-review',1.000,'2026-09-04T17:10:00Z'),
  ('sensoria-publish-and-grow','principle','公開して育てるPortfolioとして運用する','完成して固定するのではなく、公開後もPortfolio資産を継続的に強化する。','active','confirmed','artifact-review',1.000,'2026-09-04T17:10:00Z'),

  ('test-isn-approval-before-mutation','principle','一般Userの変更は承認後にだけ実Dataへ反映する','追加・更新・削除を直接本Dataへ適用せずpending requestとし、admin承認時のみ反映する。','active','confirmed','artifact-review',1.000,'2026-09-04T17:10:00Z'),
  ('test-isn-preserve-audit-snapshot','principle','変更前後のAudit Snapshotを追記で残す','CREATE/UPDATE/DELETEのSnapshotを履歴へ残し、削除済みRecordの内容も後から確認できるようにする。','active','confirmed','artifact-review',1.000,'2026-09-04T17:10:00Z'),
  ('test-isn-review-concurrent-requests','principle','競合申請は再確認状態へ送る','base_versionで承認時の版を確認し、先行承認後のpending申請はneeds_reviewへ変更して再確認する。','active','confirmed','artifact-review',1.000,'2026-09-04T17:10:00Z')
on conflict (canonical_key) do update
set kind=excluded.kind, title=excluded.title, statement=excluded.statement,
    lifecycle_status=excluded.lifecycle_status, verification_status=excluded.verification_status,
    source=excluded.source, confidence=excluded.confidence, verified_at=excluded.verified_at,
    updated_at=now();

with defs(item_key, product_slug, relation_type) as (
  values
    ('data-gallery-public-read-privileged-write','data-gallery','applies_to'),
    ('data-gallery-contract-validation','data-gallery','applies_to'),
    ('notion-script-fill-missing-fields','notion-script','realized_by'),
    ('notion-script-no-overwrite','notion-script','applies_to'),
    ('notion-script-dry-run-before-write','notion-script','applies_to'),
    ('test-trade-rigorous-ai-strategy-validation','test-trade','realized_by'),
    ('test-trade-no-lookahead','test-trade','applies_to'),
    ('test-trade-holdout-discipline','test-trade','applies_to'),
    ('test-trade-no-production-strategy-yet','test-trade','applies_to'),
    ('test-trade-research-only','test-trade','constrains'),
    ('sensoria-unify-activity-and-media-routes','sensoria-portfolio','realized_by'),
    ('sensoria-publish-and-grow','sensoria-portfolio','applies_to'),
    ('test-isn-approval-before-mutation','test-isn','applies_to'),
    ('test-isn-preserve-audit-snapshot','test-isn','applies_to'),
    ('test-isn-review-concurrent-requests','test-isn','applies_to')
)
insert into knowledge.item_products (
  item_id, product_id, relation_type, source, confidence, verified_at
)
select i.id, p.id, d.relation_type, 'inventory-wave2', 1.000, '2026-09-04T17:10:00Z'
from defs d
join knowledge.items i on i.canonical_key=d.item_key
join registry.products p on p.slug=d.product_slug
on conflict (item_id, product_id, relation_type) do update
set source=excluded.source, confidence=excluded.confidence,
    verified_at=excluded.verified_at, updated_at=now();

with defs(item_key, external_id) as (
  values
    ('data-gallery-public-read-privileged-write','Yuichi-TanakaJP/data-gallery:docs/ONBOARDING.md@main'),
    ('data-gallery-contract-validation','Yuichi-TanakaJP/data-gallery:docs/ONBOARDING.md@main'),
    ('notion-script-fill-missing-fields','Yuichi-TanakaJP/notion-script:README.md@master'),
    ('notion-script-no-overwrite','Yuichi-TanakaJP/notion-script:README.md@master'),
    ('notion-script-dry-run-before-write','Yuichi-TanakaJP/notion-script:README.md@master'),
    ('test-trade-rigorous-ai-strategy-validation','Yuichi-TanakaJP/test_trade:README.md@main'),
    ('test-trade-no-lookahead','Yuichi-TanakaJP/test_trade:README.md@main'),
    ('test-trade-holdout-discipline','Yuichi-TanakaJP/test_trade:README.md@main'),
    ('test-trade-no-production-strategy-yet','Yuichi-TanakaJP/test_trade:docs/current_status_ja.md@main'),
    ('test-trade-research-only','Yuichi-TanakaJP/test_trade:README.md@main'),
    ('sensoria-unify-activity-and-media-routes','Yuichi-TanakaJP/sensoria-portfolio:docs/01-project-overview.md@main'),
    ('sensoria-publish-and-grow','Yuichi-TanakaJP/sensoria-portfolio:docs/01-project-overview.md@main'),
    ('test-isn-approval-before-mutation','Yuichi-TanakaJP/test_ISN:docs/architecture.md@master'),
    ('test-isn-preserve-audit-snapshot','Yuichi-TanakaJP/test_ISN:docs/architecture.md@master'),
    ('test-isn-review-concurrent-requests','Yuichi-TanakaJP/test_ISN:docs/architecture.md@master')
)
insert into knowledge.item_resources (
  item_id, resource_id, relation_type, source, confidence, verified_at
)
select i.id, r.id, 'evidenced_by', 'inventory-wave2', 1.000, '2026-09-04T17:10:00Z'
from defs d
join knowledge.items i on i.canonical_key=d.item_key
join registry.external_resources r on r.external_id=d.external_id
on conflict (item_id, resource_id, relation_type) do update
set source=excluded.source, confidence=excluded.confidence,
    verified_at=excluded.verified_at, updated_at=now();

with defs(event_type, title, summary, period_start, period_end, time_precision, verification_status, source, confidence) as (
  values
    ('milestone','Test TradeをPaper Trading前段階へ進める判定','多数のStrategyを棄却し、暫定候補は統計的確信不足のため実資金採用せず、次段階をPaper Tradingと未使用期間蓄積にした。','2026-06-20'::date,'2026-06-20'::date,'day','confirmed','artifact-review',1.000)
)
insert into knowledge.evolution_events (
  event_type, title, summary, period_start, period_end, time_precision,
  verification_status, source, confidence, verified_at
)
select d.event_type, d.title, d.summary, d.period_start, d.period_end, d.time_precision,
       d.verification_status, d.source, d.confidence, '2026-09-04T17:10:00Z'
from defs d
where not exists (
  select 1 from knowledge.evolution_events e
  where e.event_type=d.event_type and e.title=d.title
    and coalesce(e.period_start,'0001-01-01'::date)=coalesce(d.period_start,'0001-01-01'::date)
    and coalesce(e.period_end,'0001-01-01'::date)=coalesce(d.period_end,'0001-01-01'::date)
);

insert into knowledge.evolution_event_products (
  event_id, product_id, role, source, confidence, verified_at
)
select e.id, p.id, 'subject', 'inventory-wave2', 1.000, '2026-09-04T17:10:00Z'
from knowledge.evolution_events e
join registry.products p on p.slug='test-trade'
where e.title='Test TradeをPaper Trading前段階へ進める判定'
on conflict (event_id, product_id, role) do nothing;

insert into knowledge.evolution_event_resources (event_id, resource_id, relation_type)
select e.id, r.id, 'evidence'
from knowledge.evolution_events e
join registry.external_resources r on r.external_id='Yuichi-TanakaJP/test_trade:docs/current_status_ja.md@main'
where e.title='Test TradeをPaper Trading前段階へ進める判定'
on conflict (event_id, resource_id, relation_type) do nothing;

commit;
