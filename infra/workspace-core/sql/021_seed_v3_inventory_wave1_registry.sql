-- Workspace Core V3 inventory expansion - Wave 1 / Registry
-- Evidence-backed Product Functions and reusable Capabilities.

begin;

with github as (
  select id from platform.source_systems where code = 'github'
), defs(external_id, resource_type, title, url, summary) as (
  values
    ('Yuichi-TanakaJP/stock-notes:README.md@main','repository_document','stock-notes README','https://github.com/Yuichi-TanakaJP/stock-notes/blob/main/README.md','Stock Notesの役割、実装済みAPI、運用状態、Portfolio基盤の入口。'),
    ('Yuichi-TanakaJP/ideas:issue:31','github_issue','Ideas #31 投資判断統合ワークフロー','https://github.com/Yuichi-TanakaJP/ideas/issues/31','株式データ取得、AI相談、判断保存、次回再利用を統合するStock Notesの発端。'),
    ('Yuichi-TanakaJP/pc-saas-health-monitor:README.md@main','repository_document','PC/SaaS Health Monitor README','https://github.com/Yuichi-TanakaJP/pc-saas-health-monitor/blob/main/README.md','PC/SaaS横断監視の目的、対象、開発方針。'),
    ('Yuichi-TanakaJP/pc-saas-health-monitor:docs/MOTIVATION.md@main','repository_document','PC/SaaS Health Monitor Motivation','https://github.com/Yuichi-TanakaJP/pc-saas-health-monitor/blob/main/docs/MOTIVATION.md','GCR容量超過、Gmailに埋もれるアラート、market_info資産鮮度という3つの原体験。'),
    ('Yuichi-TanakaJP/pc-saas-health-monitor:issue:168','github_issue','Health Monitor Local-first + Cloud Mirror','https://github.com/Yuichi-TanakaJP/pc-saas-health-monitor/issues/168','Local SQLiteをOperational SoTとしworkspace-coreをRemote Read/History MirrorにするObservability V1.1契約。'),
    ('Yuichi-TanakaJP/portfolio_x_post:README.md@master','repository_document','portfolio_x_post README','https://github.com/Yuichi-TanakaJP/portfolio_x_post/blob/master/README.md','ideasやmarket_infoから公開可能な成果物を作るpublishing factory。'),
    ('Yuichi-TanakaJP/claude-skills:README.md@master','repository_document','claude-skills README','https://github.com/Yuichi-TanakaJP/claude-skills/blob/master/README.md','Claude CodeカスタムSkillを一元管理し他repoから--add-dirで再利用する運用。'),
    ('Yuichi-TanakaJP/repo-templates:README.md@master','repository_document','repo-templates README','https://github.com/Yuichi-TanakaJP/repo-templates/blob/master/README.md','AGENTS/CLAUDE/gitignore/CI/UAT/release checklist等の再利用テンプレート。'),
    ('Yuichi-TanakaJP/ideas:README.md@main','repository_document','ideas README','https://github.com/Yuichi-TanakaJP/ideas/blob/main/README.md','思いつきを即捕捉し、分類・実装・実験判定へ送る横断Inbox運用。')
)
insert into registry.external_resources (
  source_system_id, external_id, resource_type, title, url, summary, status, last_synced_at
)
select github.id, d.external_id, d.resource_type, d.title, d.url, d.summary, 'active', '2026-09-04T16:45:00Z'
from defs d cross join github
on conflict (source_system_id, external_id, resource_type) do update
set title = excluded.title,
    url = excluded.url,
    summary = excluded.summary,
    status = excluded.status,
    last_synced_at = excluded.last_synced_at,
    updated_at = now();

with defs(product_slug, function_slug, name, description, function_type, lifecycle_status, is_user_facing, evidence_uri) as (
  values
    ('stock-notes','stock-context-api','銘柄Context API','銘柄・最新見立て・直近分析・未消化ActionをAIへまとめて返す。','interface','active',false,'https://github.com/Yuichi-TanakaJP/stock-notes/blob/main/README.md'),
    ('stock-notes','analysis-decision-memory','分析・判断メモリ','分析、見立て、Action、判断履歴を構造化して保存・再取得する。','workflow','active',false,'https://github.com/Yuichi-TanakaJP/stock-notes/blob/main/README.md'),
    ('stock-notes','portfolio-snapshot-ingestion','Portfolio Snapshot取込','証券会社CSVを検証・正規化し不変Snapshotとして保存する。','pipeline','active',false,'https://github.com/Yuichi-TanakaJP/stock-notes/blob/main/README.md'),
    ('stock-notes','portfolio-policy-review','Portfolio Policy / Review','投資方針を版管理し、Reviewと銘柄別方針を履歴として運用する。','workflow','active',false,'https://github.com/Yuichi-TanakaJP/stock-notes/blob/main/README.md'),
    ('pc-saas-health-monitor','local-observation-history','Local Observation History','raw observation、run state、alert、notification state、rollupをLocal SQLiteへ保存する。','pipeline','active',false,'https://github.com/Yuichi-TanakaJP/pc-saas-health-monitor/issues/168'),
    ('pc-saas-health-monitor','status-evaluation-alerting','状態判定・Actionable Alert','収集結果を判定し、対応が必要な状態をDashboard/通知へ残す。','workflow','active',true,'https://github.com/Yuichi-TanakaJP/pc-saas-health-monitor/blob/main/docs/MOTIVATION.md'),
    ('pc-saas-health-monitor','cloud-history-mirror','workspace-core Cloud Mirror','Current State / Transition / Daily Rollup / Governance履歴をoutbox経由でworkspace-coreへ同期する。','pipeline','experimental',false,'https://github.com/Yuichi-TanakaJP/pc-saas-health-monitor/issues/168'),
    ('portfolio-x-post','daily-x-draft','日次X投稿Draft','market_info factsと手入力騰落率からニュースを加味したX投稿Draftを生成する。','pipeline','active',true,'https://github.com/Yuichi-TanakaJP/portfolio_x_post/blob/master/README.md'),
    ('portfolio-x-post','weekly-market-recap','週間Market Recap','週次市場factsからX向け週間recapを生成する。','pipeline','active',true,'https://github.com/Yuichi-TanakaJP/portfolio_x_post/blob/master/README.md'),
    ('portfolio-x-post','note-draft-workflow','note Draft生成','過去note corpusと文体profileを使いカテゴリ別note Draftを生成する。','workflow','active',true,'https://github.com/Yuichi-TanakaJP/portfolio_x_post/blob/master/README.md'),
    ('portfolio-x-post','publication-log','公開結果ログ','提案文と実投稿の差、公開URLや実投稿結果を記録する。','workflow','active',false,'https://github.com/Yuichi-TanakaJP/portfolio_x_post/blob/master/README.md'),
    ('claude-skills','repo-setup-skill','repo-setup Skill','repo-templates正本を参照して新規Repositoryへ共通設定を配置する。','workflow','active',true,'https://github.com/Yuichi-TanakaJP/claude-skills/blob/master/README.md'),
    ('claude-skills','dev-status-skill','dev-status Skill','dev配下Repositoryの仕掛かり・PR・Issueを横断集約する。','workflow','active',true,'https://github.com/Yuichi-TanakaJP/claude-skills/blob/master/README.md'),
    ('claude-skills','ideas-review-skill','ideas-review Skill','ideas台帳の滞留・blocked再開条件・実装repo突合をレビューする。','workflow','active',true,'https://github.com/Yuichi-TanakaJP/claude-skills/blob/master/README.md'),
    ('repo-templates','agent-rules-template','Agent運用Rule Template','AGENTSを正本としCLAUDEを入口にする共通Rule Template。','module','active',false,'https://github.com/Yuichi-TanakaJP/repo-templates/blob/master/README.md'),
    ('repo-templates','ci-template','CI Template','Python/Node向けlint→test→smokeのCI雛形。','module','active',false,'https://github.com/Yuichi-TanakaJP/repo-templates/blob/master/README.md'),
    ('repo-templates','quality-gate-templates','UAT / Release Quality Gates','UAT手順書とRelease Checklistを再利用可能な雛形として提供する。','module','active',false,'https://github.com/Yuichi-TanakaJP/repo-templates/blob/master/README.md'),
    ('ideas','idea-inbox','Idea Inbox','思いつきを所属や精緻化より先に1行Issueとして捕捉する。','interface','active',true,'https://github.com/Yuichi-TanakaJP/ideas/blob/main/README.md'),
    ('ideas','idea-routing','Idea→実装Issue Routing','やると決めたIdeaを実装RepositoryのIssueへ移し、ideas側は状態とLinkを持つ。','workflow','active',true,'https://github.com/Yuichi-TanakaJP/ideas/blob/main/README.md'),
    ('ideas','experiment-review','Experiment判定Review','問い・予算・期限・判定・学びを持たせ、blocked/active/凍結を定期Reviewする。','workflow','active',true,'https://github.com/Yuichi-TanakaJP/ideas/blob/main/README.md')
)
insert into registry.product_functions (
  product_id, slug, name, description, function_type, lifecycle_status,
  is_user_facing, source, confidence, evidence_uri, verified_at
)
select p.id, d.function_slug, d.name, d.description, d.function_type, d.lifecycle_status,
       d.is_user_facing, 'inventory-wave1', 1.000, d.evidence_uri, '2026-09-04T16:45:00Z'
from defs d join registry.products p on p.slug = d.product_slug
on conflict (product_id, slug) do update
set name = excluded.name,
    description = excluded.description,
    function_type = excluded.function_type,
    lifecycle_status = excluded.lifecycle_status,
    is_user_facing = excluded.is_user_facing,
    source = excluded.source,
    confidence = excluded.confidence,
    evidence_uri = excluded.evidence_uri,
    verified_at = excluded.verified_at,
    updated_at = now();

insert into registry.capabilities (slug, name, description, category)
values
  ('ai-context-api-design','AI向けContext API設計','AIが必要な状態・履歴・Actionをコピー不要で取得できるAPIを設計する。','ai'),
  ('investment-decision-memory','投資判断メモリ設計','投資仮説・分析・Action・判断履歴を次回判断へ再利用できる形で保存する。','product'),
  ('immutable-snapshot-ingestion','不変Snapshot取込','外部CSVを検証・正規化し冪等な不変Snapshotとして保存する。','data'),
  ('versioned-policy-management','Versioned Policy運用','方針・Policyを上書きせず版履歴とactive/superseded状態で運用する。','architecture'),
  ('local-first-observability','Local-first Observability','監視の実行SoTをLocalに置き、Cloud障害から監視本体を分離する。','architecture'),
  ('actionable-alert-design','Actionable Alert設計','通知数ではなく未対応の重要状態が消えずに残る仕組みを設計する。','product'),
  ('outbox-cloud-mirroring','Outbox型Cloud Mirror','Local outbox + at-least-once delivery + idempotent upsertで重要履歴をCloudへMirrorする。','architecture'),
  ('deterministic-content-fact-building','決定的Content Facts生成','LLMの前段で根拠factsを決定的に組み立て入力・参照元を固定する。','data'),
  ('human-reviewed-ai-publishing','Human-reviewed AI Publishing','AIでDraftを作り、人間がReviewして最終公開するPublishing Workflowを運用する。','ai'),
  ('privacy-guarded-publishing','Privacy Guard付き公開Workflow','公開物に不要な口座・資産等の個人データを載せない境界を実装する。','product'),
  ('idea-inbox-operations','Idea Inbox運用','収集と分類を分離し、思いつきを失わず後からRouting・判定する。','product'),
  ('agent-workflow-packaging','Agent WorkflowのSkill化','再利用可能なAI作業手順をSkillとしてPackagingし複数Repositoryから利用する。','ai'),
  ('repository-bootstrap-standardization','Repository初期化標準化','Agent rules・gitignore・env・CI等を共通Templateで立ち上げる。','development'),
  ('quality-gate-standardization','Quality Gate標準化','UAT・release checklist・CIを再利用可能な品質Gateとして標準化する。','development')
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    updated_at = now();

with defs(product_slug, capability_slug, relation_type, evidence_uri) as (
  values
    ('stock-notes','ai-context-api-design','demonstrates','https://github.com/Yuichi-TanakaJP/stock-notes/blob/main/README.md'),
    ('stock-notes','investment-decision-memory','demonstrates','https://github.com/Yuichi-TanakaJP/ideas/issues/31'),
    ('stock-notes','immutable-snapshot-ingestion','demonstrates','https://github.com/Yuichi-TanakaJP/stock-notes/blob/main/README.md'),
    ('stock-notes','versioned-policy-management','demonstrates','https://github.com/Yuichi-TanakaJP/stock-notes/blob/main/README.md'),
    ('pc-saas-health-monitor','local-first-observability','demonstrates','https://github.com/Yuichi-TanakaJP/pc-saas-health-monitor/issues/168'),
    ('pc-saas-health-monitor','actionable-alert-design','develops','https://github.com/Yuichi-TanakaJP/pc-saas-health-monitor/blob/main/docs/MOTIVATION.md'),
    ('pc-saas-health-monitor','outbox-cloud-mirroring','develops','https://github.com/Yuichi-TanakaJP/pc-saas-health-monitor/issues/168'),
    ('portfolio-x-post','deterministic-content-fact-building','demonstrates','https://github.com/Yuichi-TanakaJP/portfolio_x_post/blob/master/README.md'),
    ('portfolio-x-post','human-reviewed-ai-publishing','demonstrates','https://github.com/Yuichi-TanakaJP/portfolio_x_post/blob/master/README.md'),
    ('portfolio-x-post','privacy-guarded-publishing','demonstrates','https://github.com/Yuichi-TanakaJP/portfolio_x_post/blob/master/README.md'),
    ('ideas','idea-inbox-operations','demonstrates','https://github.com/Yuichi-TanakaJP/ideas/blob/main/README.md'),
    ('claude-skills','agent-workflow-packaging','demonstrates','https://github.com/Yuichi-TanakaJP/claude-skills/blob/master/README.md'),
    ('repo-templates','repository-bootstrap-standardization','demonstrates','https://github.com/Yuichi-TanakaJP/repo-templates/blob/master/README.md'),
    ('repo-templates','quality-gate-standardization','demonstrates','https://github.com/Yuichi-TanakaJP/repo-templates/blob/master/README.md')
)
insert into registry.product_capabilities (
  product_id, capability_id, relation_type, source, confidence, evidence_uri, verified_at
)
select p.id, c.id, d.relation_type, 'inventory-wave1', 1.000, d.evidence_uri, '2026-09-04T16:45:00Z'
from defs d
join registry.products p on p.slug = d.product_slug
join registry.capabilities c on c.slug = d.capability_slug
on conflict (product_id, capability_id, relation_type) do update
set source = excluded.source,
    confidence = excluded.confidence,
    evidence_uri = excluded.evidence_uri,
    verified_at = excluded.verified_at,
    updated_at = now();

with defs(capability_slug, technology_slug, relation_type) as (
  values
    ('ai-context-api-design','fastapi','implemented_with'),
    ('ai-context-api-design','python','implemented_with'),
    ('immutable-snapshot-ingestion','python','implemented_with'),
    ('deterministic-content-fact-building','python','implemented_with'),
    ('local-first-observability','python','implemented_with')
)
insert into registry.capability_technologies (
  capability_id, technology_id, relation_type, source, confidence, verified_at
)
select c.id, t.id, d.relation_type, 'inventory-wave1', 1.000, '2026-09-04T16:45:00Z'
from defs d
join registry.capabilities c on c.slug = d.capability_slug
join registry.technologies t on t.slug = d.technology_slug
on conflict (capability_id, technology_id, relation_type) do update
set source = excluded.source,
    confidence = excluded.confidence,
    verified_at = excluded.verified_at,
    updated_at = now();

with defs(capability_slug, stage, source, confidence, rationale) as (
  values
    ('ai-context-api-design','repeated','artifact-review',1.000,'Stock Notesの実運用APIとして複数Endpointで利用。'),
    ('investment-decision-memory','repeated','artifact-review',1.000,'分析・Action・Portfolio Review/Policyを実運用。'),
    ('immutable-snapshot-ingestion','applied','artifact-review',1.000,'証券会社CSV import endpointとして実装。'),
    ('versioned-policy-management','applied','artifact-review',1.000,'Portfolio Policyの版管理・activateを実装。'),
    ('local-first-observability','repeated','artifact-review',1.000,'health_center.dbをOperational SoTとしてraw/rollup/outbox等を保持。'),
    ('actionable-alert-design','applied','artifact-review',1.000,'原体験からDashboard最上部に未対応を残す設計へ反映。'),
    ('outbox-cloud-mirroring','experimental','artifact-review',1.000,'Observability V1.1として設計・実装進行中。'),
    ('deterministic-content-fact-building','repeated','artifact-review',1.000,'日次/週次/previewでfacts生成を反復利用。'),
    ('human-reviewed-ai-publishing','repeated','artifact-review',1.000,'X/note等でAI Draft→Human Review→Manual Publishを運用。'),
    ('privacy-guarded-publishing','repeated','artifact-review',1.000,'口座/保有資産を公開出力しないprivacy guardを運用。'),
    ('idea-inbox-operations','repeated','artifact-review',1.000,'全Repository横断のIdea Inboxとして運用。'),
    ('agent-workflow-packaging','repeated','artifact-review',1.000,'複数Skillを--add-dir経由で別Repositoryから利用。'),
    ('repository-bootstrap-standardization','repeated','artifact-review',1.000,'共通Templateを新規Repositoryへ再利用。'),
    ('quality-gate-standardization','applied','artifact-review',1.000,'CI/UAT/release checklist Templateを共通資産として整備。')
)
insert into registry.capability_assessments (
  capability_id, stage, assessed_at, source, confidence, rationale
)
select c.id, d.stage, '2026-09-04T16:45:00Z', d.source, d.confidence, d.rationale
from defs d
join registry.capabilities c on c.slug = d.capability_slug
where not exists (
  select 1 from registry.capability_assessments a
  where a.capability_id = c.id
    and a.stage = d.stage
    and a.assessed_at = '2026-09-04T16:45:00Z'
    and a.source = d.source
);

commit;
