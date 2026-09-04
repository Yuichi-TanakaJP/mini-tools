-- Workspace Core V3 inventory expansion - Wave 1
-- Evidence-backed inventory for Stock Notes, PC/SaaS Health Monitor,
-- Portfolio X Post, Claude Skills, Repository Templates, and Ideas.
--
-- This is DML only. It does not change the V3 schema.
-- AI-inferred reuse opportunities are intentionally not written as canonical facts.

begin;

-- ---------------------------------------------------------------------------
-- Evidence resources
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Product Functions
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Capabilities
-- ---------------------------------------------------------------------------

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
set name = excluded.name, description = excluded.description, category = excluded.category, updated_at = now();

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
join registry.products p on p.slug=d.product_slug
join registry.capabilities c on c.slug=d.capability_slug
on conflict (product_id, capability_id, relation_type) do update
set source=excluded.source, confidence=excluded.confidence, evidence_uri=excluded.evidence_uri,
    verified_at=excluded.verified_at, updated_at=now();

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
select c.id,t.id,d.relation_type,'inventory-wave1',1.000,'2026-09-04T16:45:00Z'
from defs d
join registry.capabilities c on c.slug=d.capability_slug
join registry.technologies t on t.slug=d.technology_slug
on conflict (capability_id, technology_id, relation_type) do update
set source=excluded.source, confidence=excluded.confidence, verified_at=excluded.verified_at, updated_at=now();

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
select c.id,d.stage,'2026-09-04T16:45:00Z',d.source,d.confidence,d.rationale
from defs d join registry.capabilities c on c.slug=d.capability_slug
where not exists (
  select 1 from registry.capability_assessments a
  where a.capability_id=c.id and a.stage=d.stage and a.assessed_at='2026-09-04T16:45:00Z' and a.source=d.source
);

-- ---------------------------------------------------------------------------
-- Canonical Knowledge
-- ---------------------------------------------------------------------------

insert into knowledge.items (
  canonical_key, kind, title, statement, lifecycle_status, verification_status,
  source, confidence, verified_at
)
values
  ('stock-notes-fragmented-ai-context','problem','AIとの投資議論が分散し再利用しにくい','ChatGPT・Claude等で銘柄相談しても後から内容を探しにくく、何を理由に保有・売却したかや次回確認点を忘れやすかった。','active','confirmed','artifact-review',1.000,'2026-09-04T16:45:00Z'),
  ('stock-notes-reusable-decision-memory','goal','投資判断を次回判断へ再利用できる状態にする','株式データ、前回仮説、AIとの議論、結論、Actionを構造化し、次の決算・材料発生時に過去判断を踏まえて再利用する。','active','confirmed','artifact-review',1.000,'2026-09-04T16:45:00Z'),
  ('stock-notes-selective-llm-analysis','principle','LLMへ渡す対象を先に絞る','全銘柄を毎回LLM分析せず、数値・Ruleで変化を検出し再検討が必要な銘柄だけAIで深掘りする。','active','confirmed','artifact-review',1.000,'2026-09-04T16:45:00Z'),

  ('health-monitor-usage-progress-invisible','problem','課金・容量上限への途中経過が見えない','GCR/Artifact Registryの保管量が増えても上限接近が日常画面に出ず、超過後に初めて気づいた。','active','confirmed','artifact-review',1.000,'2026-09-04T16:45:00Z'),
  ('health-monitor-alerts-buried','problem','重要Alertが大量メールに埋もれる','サービス側AlertがGmail未読に混ざり、対応が必要な通知を見失った。','active','confirmed','artifact-review',1.000,'2026-09-04T16:45:00Z'),
  ('health-monitor-assets-in-head','problem','データ資産の一覧と鮮度が頭の中にしかない','market_infoの取得先・出力・保管先が増え、何が動きどこに何が溜まりいつ更新されたかを説明しにくくなった。','active','confirmed','artifact-review',1.000,'2026-09-04T16:45:00Z'),
  ('health-monitor-actionable-attention','principle','通知数より未対応の重要状態を残す','対応サービスや通知を増やすこと自体ではなく、対応が必要なものだけが対応するまで残る状態を優先する。','active','confirmed','artifact-review',1.000,'2026-09-04T16:45:00Z'),
  ('health-monitor-local-first-cloud-mirror','principle','監視はLocal-first、CloudはHistory Mirror','Health Monitorの実行SoTはLocal SQLiteに置き、workspace-coreは重要状態・遷移・Rollup・GovernanceのRemote Read/History Mirrorとして使う。','active','confirmed','artifact-review',1.000,'2026-09-04T16:45:00Z'),

  ('publishing-factory-externalize-insights','goal','内部の思考とDataを外に出せる成果物へ変える','ideasの思考stockやmarket_infoの市場DataをX/note等へ出せるDraft・素材へ変換する。','active','confirmed','artifact-review',1.000,'2026-09-04T16:45:00Z'),
  ('publishing-factory-human-final-publish','principle','AIはDraft、人間が最終公開する','AIはNews検索とDraft生成を担当するが自動投稿はせず、人間がReviewして手動公開する。','active','confirmed','artifact-review',1.000,'2026-09-04T16:45:00Z'),
  ('publishing-factory-privacy-boundary','constraint','公開物へ個人Portfolio詳細を出さない','口座・株数・取得単価・評価額・総資産等の個人資産情報は保存も公開出力もしない。','active','confirmed','artifact-review',1.000,'2026-09-04T16:45:00Z'),

  ('ideas-capture-before-classify','principle','思いつきは分類より先に捕まえる','収集と分類を分離し、迷ったらideasへ1行で即登録して入口精度より捕捉速度を優先する。','active','confirmed','artifact-review',1.000,'2026-09-04T16:45:00Z'),
  ('ideas-experiment-decision-discipline','principle','実験には問い・予算・期限・判定・学びを持たせる','実験を漫然と続けず、判定日と続行/統合/凍結を明確にして終了時の学びを残す。','active','confirmed','artifact-review',1.000,'2026-09-04T16:45:00Z'),

  ('claude-skills-reusable-agent-workflows','goal','Agent WorkflowをRepository横断で再利用する','Claude Codeの作業手順をSkillとして一元管理し、別Repositoryから--add-dirで同じWorkflowを利用する。','active','confirmed','artifact-review',1.000,'2026-09-04T16:45:00Z'),
  ('claude-skills-no-secrets','principle','Skillには秘密情報を持たせない','Skillは指示文に限定し、API key/token/password等は含めず認証は.env等へ分離する。','active','confirmed','artifact-review',1.000,'2026-09-04T16:45:00Z'),

  ('repo-templates-standardize-bootstrap','goal','新規Repositoryの立ち上げを標準化する','AGENTS/CLAUDE/gitignore/env/CI/UAT/release checklistをTemplate化し、新規Projectへ使い回す。','active','confirmed','artifact-review',1.000,'2026-09-04T16:45:00Z'),
  ('repo-templates-agents-source-of-truth','principle','Agent Ruleの正本はAGENTSに集約する','CLAUDE.mdへ詳細を重複せず、AGENTS.mdを正本としてAgent運用・Git/PR Ruleを一元管理する。','active','confirmed','artifact-review',1.000,'2026-09-04T16:45:00Z')
on conflict (canonical_key) do update
set kind=excluded.kind, title=excluded.title, statement=excluded.statement,
    lifecycle_status=excluded.lifecycle_status, verification_status=excluded.verification_status,
    source=excluded.source, confidence=excluded.confidence, verified_at=excluded.verified_at, updated_at=now();

with defs(item_key, product_slug, relation_type) as (
  values
    ('stock-notes-fragmented-ai-context','stock-notes','motivates'),
    ('stock-notes-reusable-decision-memory','stock-notes','realized_by'),
    ('stock-notes-selective-llm-analysis','stock-notes','applies_to'),
    ('health-monitor-usage-progress-invisible','pc-saas-health-monitor','motivates'),
    ('health-monitor-alerts-buried','pc-saas-health-monitor','motivates'),
    ('health-monitor-assets-in-head','pc-saas-health-monitor','motivates'),
    ('health-monitor-actionable-attention','pc-saas-health-monitor','applies_to'),
    ('health-monitor-local-first-cloud-mirror','pc-saas-health-monitor','applies_to'),
    ('publishing-factory-externalize-insights','portfolio-x-post','realized_by'),
    ('publishing-factory-human-final-publish','portfolio-x-post','applies_to'),
    ('publishing-factory-privacy-boundary','portfolio-x-post','constrains'),
    ('ideas-capture-before-classify','ideas','applies_to'),
    ('ideas-experiment-decision-discipline','ideas','applies_to'),
    ('claude-skills-reusable-agent-workflows','claude-skills','realized_by'),
    ('claude-skills-no-secrets','claude-skills','constrains'),
    ('repo-templates-standardize-bootstrap','repo-templates','realized_by'),
    ('repo-templates-agents-source-of-truth','repo-templates','applies_to')
)
insert into knowledge.item_products (item_id, product_id, relation_type, source, confidence, verified_at)
select i.id,p.id,d.relation_type,'inventory-wave1',1.000,'2026-09-04T16:45:00Z'
from defs d join knowledge.items i on i.canonical_key=d.item_key join registry.products p on p.slug=d.product_slug
on conflict (item_id, product_id, relation_type) do update
set source=excluded.source, confidence=excluded.confidence, verified_at=excluded.verified_at, updated_at=now();

with defs(item_key, external_id) as (
  values
    ('stock-notes-fragmented-ai-context','Yuichi-TanakaJP/ideas:issue:31'),
    ('stock-notes-reusable-decision-memory','Yuichi-TanakaJP/ideas:issue:31'),
    ('stock-notes-selective-llm-analysis','Yuichi-TanakaJP/ideas:issue:31'),
    ('health-monitor-usage-progress-invisible','Yuichi-TanakaJP/pc-saas-health-monitor:docs/MOTIVATION.md@main'),
    ('health-monitor-alerts-buried','Yuichi-TanakaJP/pc-saas-health-monitor:docs/MOTIVATION.md@main'),
    ('health-monitor-assets-in-head','Yuichi-TanakaJP/pc-saas-health-monitor:docs/MOTIVATION.md@main'),
    ('health-monitor-actionable-attention','Yuichi-TanakaJP/pc-saas-health-monitor:docs/MOTIVATION.md@main'),
    ('health-monitor-local-first-cloud-mirror','Yuichi-TanakaJP/pc-saas-health-monitor:issue:168'),
    ('publishing-factory-externalize-insights','Yuichi-TanakaJP/portfolio_x_post:README.md@master'),
    ('publishing-factory-human-final-publish','Yuichi-TanakaJP/portfolio_x_post:README.md@master'),
    ('publishing-factory-privacy-boundary','Yuichi-TanakaJP/portfolio_x_post:README.md@master'),
    ('ideas-capture-before-classify','Yuichi-TanakaJP/ideas:README.md@main'),
    ('ideas-experiment-decision-discipline','Yuichi-TanakaJP/ideas:README.md@main'),
    ('claude-skills-reusable-agent-workflows','Yuichi-TanakaJP/claude-skills:README.md@master'),
    ('claude-skills-no-secrets','Yuichi-TanakaJP/claude-skills:README.md@master'),
    ('repo-templates-standardize-bootstrap','Yuichi-TanakaJP/repo-templates:README.md@master'),
    ('repo-templates-agents-source-of-truth','Yuichi-TanakaJP/repo-templates:README.md@master')
)
insert into knowledge.item_resources (item_id, resource_id, relation_type, source, confidence, verified_at)
select i.id,r.id,'evidenced_by','inventory-wave1',1.000,'2026-09-04T16:45:00Z'
from defs d
join knowledge.items i on i.canonical_key=d.item_key
join registry.external_resources r on r.external_id=d.external_id
on conflict (item_id, resource_id, relation_type) do update
set source=excluded.source, confidence=excluded.confidence, verified_at=excluded.verified_at, updated_at=now();

-- ---------------------------------------------------------------------------
-- Evolution
-- ---------------------------------------------------------------------------

with defs(event_type,title,summary,period_start,period_end,time_precision,verification_status,source,confidence) as (
  values
    ('idea_formed','Stock Notes統合構想をIdeasへ記録','株式データ収集、AIとの判断議論、結論保存、次回再利用を統合する構想がideas#31として明文化された。','2026-07-28'::date,'2026-07-28'::date,'day','confirmed','artifact-review',1.000),
    ('origin','Health Monitorの原体験を明文化','GCR容量超過、Gmailに埋もれるAlert、market_info資産鮮度という3つの困りごとをMOTIVATION.mdへ記録した。','2026-08-12'::date,'2026-08-12'::date,'day','confirmed','artifact-review',1.000),
    ('integration','Health Monitorにworkspace-core Cloud Mirror契約を追加','Local-firstを維持しつつCurrent State/Transition/Rollup/Governance履歴をworkspace-coreへMirrorするObservability V1.1契約を設計した。',null,null,'unknown','confirmed','artifact-review',1.000)
)
insert into knowledge.evolution_events (
  event_type,title,summary,period_start,period_end,time_precision,verification_status,source,confidence,verified_at
)
select d.event_type,d.title,d.summary,d.period_start,d.period_end,d.time_precision,d.verification_status,d.source,d.confidence,'2026-09-04T16:45:00Z'
from defs d
where not exists (
  select 1 from knowledge.evolution_events e
  where e.event_type=d.event_type and e.title=d.title
    and coalesce(e.period_start,'0001-01-01'::date)=coalesce(d.period_start,'0001-01-01'::date)
    and coalesce(e.period_end,'0001-01-01'::date)=coalesce(d.period_end,'0001-01-01'::date)
);

with defs(event_title,product_slug,role) as (
  values
    ('Stock Notes統合構想をIdeasへ記録','stock-notes','origin'),
    ('Stock Notes統合構想をIdeasへ記録','ideas','context'),
    ('Health Monitorの原体験を明文化','pc-saas-health-monitor','origin'),
    ('Health Monitorにworkspace-core Cloud Mirror契約を追加','pc-saas-health-monitor','subject')
)
insert into knowledge.evolution_event_products (event_id,product_id,role,source,confidence,verified_at)
select e.id,p.id,d.role,'inventory-wave1',1.000,'2026-09-04T16:45:00Z'
from defs d join knowledge.evolution_events e on e.title=d.event_title join registry.products p on p.slug=d.product_slug
on conflict (event_id,product_id,role) do nothing;

with defs(event_title,external_id) as (
  values
    ('Stock Notes統合構想をIdeasへ記録','Yuichi-TanakaJP/ideas:issue:31'),
    ('Health Monitorの原体験を明文化','Yuichi-TanakaJP/pc-saas-health-monitor:docs/MOTIVATION.md@main'),
    ('Health Monitorにworkspace-core Cloud Mirror契約を追加','Yuichi-TanakaJP/pc-saas-health-monitor:issue:168')
)
insert into knowledge.evolution_event_resources (event_id,resource_id,relation_type)
select e.id,r.id,'evidence'
from defs d join knowledge.evolution_events e on e.title=d.event_title join registry.external_resources r on r.external_id=d.external_id
on conflict (event_id,resource_id,relation_type) do nothing;

-- ---------------------------------------------------------------------------
-- Value Flows
-- ---------------------------------------------------------------------------

insert into flow.value_flows (slug,name,summary,purpose,lifecycle_status,model_status,importance)
values
  ('stock-analysis-decision-memory-loop','投資情報 → AI検討 → 判断保存 → 再利用','定型Dataと過去判断を取得し、必要銘柄をAIで深掘りし、結論・Actionを保存して次回判断へ再利用する。','AI相談を一回限りにせず判断Memoryとして循環させる。','active','confirmed',5),
  ('health-monitor-operational-observability','監視収集 → 判定 → 気づき → 履歴','PC/SaaS状態をLocal-firstで収集・保存・判定し、重要状態をActionへつなぎ、将来Cloud Mirrorでも参照する。','壊れる前・見落とす前に気づき、PCが手元になくても重要履歴へ戻れるようにする。','active','confirmed',4),
  ('publishing-factory-to-publication','Ideas / Market Data → Draft → Human Review → 公開','内部の思考・市場factsからAI Draftを作り、人間Review後にX/noteへ手動公開して結果を記録する。','内部資産をprivacyを守りながら外部成果物へ変える。','active','confirmed',3),
  ('idea-capture-to-execution','思いつき → Ideas → 実装Issue → 完了','思いつきを即捕捉し、やると決めたものだけ実装RepositoryへRoutingして完了まで追う。','発想を失わず、分類負荷を入口から分離して実行へつなぐ。','active','confirmed',3),
  ('repository-standard-to-agent-workflow','Repo Template → Claude Skill → Target Repository','repo-templatesの標準をClaude Skill経由で対象Repositoryへ展開する。','開発標準とAgent Workflowを再利用しRepository立ち上げ・運用の品質を揃える。','active','confirmed',3)
on conflict (slug) do update
set name=excluded.name, summary=excluded.summary, purpose=excluded.purpose,
    lifecycle_status=excluded.lifecycle_status, model_status=excluded.model_status,
    importance=excluded.importance, updated_at=now();

with defs(flow_slug,version_number,variant_type,label,summary,state,based_on_number,as_of,source,confidence) as (
  values
    ('stock-analysis-decision-memory-loop',1,'as_is','Current','Market/Stock dataと過去判断をContextとしてAIへ渡し、分析・Action・Portfolio ReviewをStock Notesへ保存して再利用する。','active',null,'2026-09-05'::date,'artifact-review',1.000),
    ('health-monitor-operational-observability',1,'as_is','Local-first current','Collector→normalize→Local SQLite→evaluate→Alert/Dashboard→Human Action。','active',null,'2026-09-05'::date,'artifact-review',1.000),
    ('health-monitor-operational-observability',2,'proposed','Local + Cloud Mirror','Local-firstを維持し、重要状態をoutboxからworkspace-core Observabilityへ同期してRemote History/AI参照を追加する。','draft',1,'2026-09-05'::date,'artifact-review',1.000),
    ('publishing-factory-to-publication',1,'as_is','Current','Ideas/Market Info→facts→AI Draft→Human Review→Manual Publish→Publication Log。','active',null,'2026-09-05'::date,'artifact-review',1.000),
    ('idea-capture-to-execution',1,'as_is','Current','思いつき→ideas Issue→採用判断→対象repo Issue→実装→両IssueをClose/Link。','active',null,'2026-09-05'::date,'artifact-review',1.000),
    ('repository-standard-to-agent-workflow',1,'as_is','Current','repo-templates→claude-skills repo-setup→Target Repositoryへ標準Fileを展開。','active',null,'2026-09-05'::date,'artifact-review',1.000)
)
insert into flow.flow_versions (
  flow_id,version_number,variant_type,label,summary,state,based_on_version_id,as_of,source,confidence,verified_at
)
select f.id,d.version_number,d.variant_type,d.label,d.summary,d.state,base.id,d.as_of,d.source,d.confidence,'2026-09-04T16:45:00Z'
from defs d
join flow.value_flows f on f.slug=d.flow_slug
left join flow.flow_versions base on base.flow_id=f.id and base.version_number=d.based_on_number
on conflict (flow_id,version_number) do update
set variant_type=excluded.variant_type,label=excluded.label,summary=excluded.summary,state=excluded.state,
    based_on_version_id=excluded.based_on_version_id,as_of=excluded.as_of,source=excluded.source,
    confidence=excluded.confidence,verified_at=excluded.verified_at,updated_at=now();

-- Ensure proposed Health Monitor version points to current version after both exist.
update flow.flow_versions proposed
set based_on_version_id=base.id, updated_at=now()
from flow.value_flows f, flow.flow_versions base
where proposed.flow_id=f.id and base.flow_id=f.id
  and f.slug='health-monitor-operational-observability'
  and proposed.version_number=2 and base.version_number=1
  and proposed.based_on_version_id is distinct from base.id;

-- Stock Notes flow steps
with defs(step_key,label,step_type,actor_type,seq) as (
  values
    ('signals','株価・決算・信用・優待等','source','system',10),
    ('filter','変化検出・再検討対象を絞る','signal','system',20),
    ('context','Stock Notes Context取得','acquire','system',30),
    ('deliberate','ChatGPT/Claudeで深掘り','deliberate','mixed',40),
    ('save','分析・判断・Actionを保存','record','system',50),
    ('view','MiniToolsで現在判断を確認','touchpoint','user',60),
    ('reuse','次回材料発生時に再利用','reflect','mixed',70)
)
insert into flow.flow_steps(version_id,step_key,label,step_type,actor_type,sequence_hint)
select fv.id,d.step_key,d.label,d.step_type,d.actor_type,d.seq
from defs d join flow.value_flows f on f.slug='stock-analysis-decision-memory-loop'
join flow.flow_versions fv on fv.flow_id=f.id and fv.version_number=1
on conflict (version_id,step_key) do update
set label=excluded.label,step_type=excluded.step_type,actor_type=excluded.actor_type,sequence_hint=excluded.sequence_hint,updated_at=now();

with defs(a,b,t,label) as (
  values
    ('signals','filter','system_data','定型Data'),
    ('filter','context','system_handoff','必要銘柄だけ'),
    ('context','deliberate','system_handoff','過去判断＋最新Context'),
    ('deliberate','save','system_handoff','結論・理由・Action'),
    ('save','view','system_handoff','保存済み状態'),
    ('view','reuse','feedback','次回確認点を次の判断へ')
)
insert into flow.flow_edges(version_id,source_step_id,target_step_id,edge_type,label,source,confidence,verified_at)
select fv.id,s.id,tg.id,d.t,d.label,'inventory-wave1',1.000,'2026-09-04T16:45:00Z'
from defs d join flow.value_flows f on f.slug='stock-analysis-decision-memory-loop'
join flow.flow_versions fv on fv.flow_id=f.id and fv.version_number=1
join flow.flow_steps s on s.version_id=fv.id and s.step_key=d.a
join flow.flow_steps tg on tg.version_id=fv.id and tg.step_key=d.b
on conflict (version_id,source_step_id,target_step_id,edge_type) do update
set label=excluded.label,source=excluded.source,confidence=excluded.confidence,verified_at=excluded.verified_at,updated_at=now();

-- Health Monitor As-Is + Proposed steps
with defs(version_number,step_key,label,step_type,actor_type,seq) as (
  values
    (1,'collect','Collectorで取得','acquire','system',10),
    (1,'normalize','Common Modelへnormalize','transform','system',20),
    (1,'local','Local SQLiteへ保存','store','system',30),
    (1,'evaluate','Status/Threshold判定','signal','system',40),
    (1,'attention','Alert / Dashboard','touchpoint','system',50),
    (1,'act','Humanが対応','human_action','user',60),
    (2,'collect','Collectorで取得','acquire','system',10),
    (2,'normalize','Common Modelへnormalize','transform','system',20),
    (2,'local','Local SQLiteへ保存','store','system',30),
    (2,'evaluate','Status/Threshold判定','signal','system',40),
    (2,'outbox','Cloud Mirror outbox','store','system',50),
    (2,'mirror','workspace-coreへ重要履歴同期','deliver','system',60),
    (2,'remote','Remote History / AI参照','touchpoint','mixed',70),
    (2,'act','Humanが対応','human_action','user',80)
)
insert into flow.flow_steps(version_id,step_key,label,step_type,actor_type,sequence_hint)
select fv.id,d.step_key,d.label,d.step_type,d.actor_type,d.seq
from defs d join flow.value_flows f on f.slug='health-monitor-operational-observability'
join flow.flow_versions fv on fv.flow_id=f.id and fv.version_number=d.version_number
on conflict (version_id,step_key) do update
set label=excluded.label,step_type=excluded.step_type,actor_type=excluded.actor_type,sequence_hint=excluded.sequence_hint,updated_at=now();

with defs(version_number,a,b,t,label) as (
  values
    (1,'collect','normalize','system_data','Observation'),
    (1,'normalize','local','system_data','normalized observation'),
    (1,'local','evaluate','system_data','local history'),
    (1,'evaluate','attention','system_handoff','status/alert'),
    (1,'attention','act','human_handoff','対応が必要な状態'),
    (2,'collect','normalize','system_data','Observation'),
    (2,'normalize','local','system_data','normalized observation'),
    (2,'local','evaluate','system_data','local history'),
    (2,'evaluate','outbox','system_handoff','Cloud対象payload'),
    (2,'outbox','mirror','system_handoff','at-least-once + idempotent'),
    (2,'mirror','remote','system_handoff','Current/Transition/Rollup/Governance'),
    (2,'remote','act','human_handoff','Remoteでも重要状態を確認')
)
insert into flow.flow_edges(version_id,source_step_id,target_step_id,edge_type,label,source,confidence,verified_at)
select fv.id,s.id,tg.id,d.t,d.label,'inventory-wave1',1.000,'2026-09-04T16:45:00Z'
from defs d join flow.value_flows f on f.slug='health-monitor-operational-observability'
join flow.flow_versions fv on fv.flow_id=f.id and fv.version_number=d.version_number
join flow.flow_steps s on s.version_id=fv.id and s.step_key=d.a
join flow.flow_steps tg on tg.version_id=fv.id and tg.step_key=d.b
on conflict (version_id,source_step_id,target_step_id,edge_type) do update
set label=excluded.label,source=excluded.source,confidence=excluded.confidence,verified_at=excluded.verified_at,updated_at=now();

-- Publishing factory flow steps
with defs(step_key,label,step_type,actor_type,seq) as (
  values
    ('inputs','Ideas / Market Info / User input','source','mixed',10),
    ('facts','決定的Facts生成','transform','system',20),
    ('draft','AI Draft生成','transform','system',30),
    ('review','Human Review','human_action','user',40),
    ('publish','X / noteへ手動公開','publish','user',50),
    ('log','実投稿・公開URLを記録','record','mixed',60)
)
insert into flow.flow_steps(version_id,step_key,label,step_type,actor_type,sequence_hint)
select fv.id,d.step_key,d.label,d.step_type,d.actor_type,d.seq
from defs d join flow.value_flows f on f.slug='publishing-factory-to-publication'
join flow.flow_versions fv on fv.flow_id=f.id and fv.version_number=1
on conflict (version_id,step_key) do update
set label=excluded.label,step_type=excluded.step_type,actor_type=excluded.actor_type,sequence_hint=excluded.sequence_hint,updated_at=now();

with defs(a,b,t) as (
  values
    ('inputs','facts','system_handoff'),('facts','draft','system_data'),('draft','review','human_handoff'),('review','publish','human_handoff'),('publish','log','human_handoff')
)
insert into flow.flow_edges(version_id,source_step_id,target_step_id,edge_type,source,confidence,verified_at)
select fv.id,s.id,tg.id,d.t,'inventory-wave1',1.000,'2026-09-04T16:45:00Z'
from defs d join flow.value_flows f on f.slug='publishing-factory-to-publication'
join flow.flow_versions fv on fv.flow_id=f.id and fv.version_number=1
join flow.flow_steps s on s.version_id=fv.id and s.step_key=d.a
join flow.flow_steps tg on tg.version_id=fv.id and tg.step_key=d.b
on conflict (version_id,source_step_id,target_step_id,edge_type) do nothing;

-- Ideas flow steps
with defs(step_key,label,step_type,actor_type,seq) as (
  values
    ('thought','思いつき','source','user',10),
    ('capture','Ideasへ1行Issue登録','record','user',20),
    ('decide','やる/保留/blocked/凍結を判定','decision','mixed',30),
    ('route','対象Repositoryへ実装Issue','deliver','mixed',40),
    ('implement','実装・実験','execute','mixed',50),
    ('close','結果・学びを記録してClose','reflect','mixed',60)
)
insert into flow.flow_steps(version_id,step_key,label,step_type,actor_type,sequence_hint)
select fv.id,d.step_key,d.label,d.step_type,d.actor_type,d.seq
from defs d join flow.value_flows f on f.slug='idea-capture-to-execution'
join flow.flow_versions fv on fv.flow_id=f.id and fv.version_number=1
on conflict (version_id,step_key) do update
set label=excluded.label,step_type=excluded.step_type,actor_type=excluded.actor_type,sequence_hint=excluded.sequence_hint,updated_at=now();

with defs(a,b,t) as (
  values
    ('thought','capture','human_handoff'),('capture','decide','human_handoff'),('decide','route','system_handoff'),('route','implement','human_handoff'),('implement','close','feedback')
)
insert into flow.flow_edges(version_id,source_step_id,target_step_id,edge_type,source,confidence,verified_at)
select fv.id,s.id,tg.id,d.t,'inventory-wave1',1.000,'2026-09-04T16:45:00Z'
from defs d join flow.value_flows f on f.slug='idea-capture-to-execution'
join flow.flow_versions fv on fv.flow_id=f.id and fv.version_number=1
join flow.flow_steps s on s.version_id=fv.id and s.step_key=d.a
join flow.flow_steps tg on tg.version_id=fv.id and tg.step_key=d.b
on conflict (version_id,source_step_id,target_step_id,edge_type) do nothing;

-- Repository standard reuse flow
with defs(step_key,label,step_type,actor_type,seq) as (
  values
    ('template','repo-templates正本','source','system',10),
    ('skill','Claude repo-setup Skill','transform','system',20),
    ('target','Target Repositoryへ標準File配置','deliver','system',30),
    ('develop','共通Rule/CI/品質Gateで開発','outcome','mixed',40)
)
insert into flow.flow_steps(version_id,step_key,label,step_type,actor_type,sequence_hint)
select fv.id,d.step_key,d.label,d.step_type,d.actor_type,d.seq
from defs d join flow.value_flows f on f.slug='repository-standard-to-agent-workflow'
join flow.flow_versions fv on fv.flow_id=f.id and fv.version_number=1
on conflict (version_id,step_key) do update
set label=excluded.label,step_type=excluded.step_type,actor_type=excluded.actor_type,sequence_hint=excluded.sequence_hint,updated_at=now();

with defs(a,b,t) as (
  values ('template','skill','system_handoff'),('skill','target','system_handoff'),('target','develop','control')
)
insert into flow.flow_edges(version_id,source_step_id,target_step_id,edge_type,source,confidence,verified_at)
select fv.id,s.id,tg.id,d.t,'inventory-wave1',1.000,'2026-09-04T16:45:00Z'
from defs d join flow.value_flows f on f.slug='repository-standard-to-agent-workflow'
join flow.flow_versions fv on fv.flow_id=f.id and fv.version_number=1
join flow.flow_steps s on s.version_id=fv.id and s.step_key=d.a
join flow.flow_steps tg on tg.version_id=fv.id and tg.step_key=d.b
on conflict (version_id,source_step_id,target_step_id,edge_type) do nothing;

-- ---------------------------------------------------------------------------
-- Flow bindings
-- ---------------------------------------------------------------------------

with defs(flow_slug,version_number,step_key,product_slug,role) as (
  values
    ('stock-analysis-decision-memory-loop',1,'context','stock-notes','owner'),
    ('stock-analysis-decision-memory-loop',1,'save','stock-notes','owner'),
    ('stock-analysis-decision-memory-loop',1,'view','mini-tools','participant'),
    ('health-monitor-operational-observability',1,'local','pc-saas-health-monitor','owner'),
    ('health-monitor-operational-observability',1,'evaluate','pc-saas-health-monitor','owner'),
    ('health-monitor-operational-observability',2,'local','pc-saas-health-monitor','owner'),
    ('health-monitor-operational-observability',2,'mirror','pc-saas-health-monitor','owner'),
    ('publishing-factory-to-publication',1,'inputs','ideas','source'),
    ('publishing-factory-to-publication',1,'facts','portfolio-x-post','owner'),
    ('publishing-factory-to-publication',1,'draft','portfolio-x-post','owner'),
    ('publishing-factory-to-publication',1,'log','portfolio-x-post','owner'),
    ('idea-capture-to-execution',1,'capture','ideas','owner'),
    ('idea-capture-to-execution',1,'route','ideas','owner'),
    ('repository-standard-to-agent-workflow',1,'template','repo-templates','source'),
    ('repository-standard-to-agent-workflow',1,'skill','claude-skills','owner')
)
insert into flow.flow_step_products(step_id,product_id,role,source,confidence,verified_at)
select fs.id,p.id,d.role,'inventory-wave1',1.000,'2026-09-04T16:45:00Z'
from defs d join flow.value_flows f on f.slug=d.flow_slug
join flow.flow_versions fv on fv.flow_id=f.id and fv.version_number=d.version_number
join flow.flow_steps fs on fs.version_id=fv.id and fs.step_key=d.step_key
join registry.products p on p.slug=d.product_slug
on conflict (step_id,product_id,role) do nothing;

with defs(flow_slug,version_number,step_key,product_slug,function_slug,role) as (
  values
    ('stock-analysis-decision-memory-loop',1,'context','stock-notes','stock-context-api','owner'),
    ('stock-analysis-decision-memory-loop',1,'save','stock-notes','analysis-decision-memory','owner'),
    ('health-monitor-operational-observability',1,'local','pc-saas-health-monitor','local-observation-history','owner'),
    ('health-monitor-operational-observability',1,'evaluate','pc-saas-health-monitor','status-evaluation-alerting','owner'),
    ('health-monitor-operational-observability',2,'mirror','pc-saas-health-monitor','cloud-history-mirror','owner'),
    ('publishing-factory-to-publication',1,'facts','portfolio-x-post','daily-x-draft','participant'),
    ('publishing-factory-to-publication',1,'log','portfolio-x-post','publication-log','owner'),
    ('idea-capture-to-execution',1,'capture','ideas','idea-inbox','owner'),
    ('idea-capture-to-execution',1,'route','ideas','idea-routing','owner'),
    ('repository-standard-to-agent-workflow',1,'template','repo-templates','agent-rules-template','source'),
    ('repository-standard-to-agent-workflow',1,'skill','claude-skills','repo-setup-skill','owner')
)
insert into flow.flow_step_product_functions(step_id,product_function_id,role,source,confidence,verified_at)
select fs.id,pf.id,d.role,'inventory-wave1',1.000,'2026-09-04T16:45:00Z'
from defs d join flow.value_flows f on f.slug=d.flow_slug
join flow.flow_versions fv on fv.flow_id=f.id and fv.version_number=d.version_number
join flow.flow_steps fs on fs.version_id=fv.id and fs.step_key=d.step_key
join registry.products p on p.slug=d.product_slug
join registry.product_functions pf on pf.product_id=p.id and pf.slug=d.function_slug
on conflict (step_id,product_function_id,role) do nothing;

with defs(flow_slug,item_key,relation_type) as (
  values
    ('stock-analysis-decision-memory-loop','stock-notes-reusable-decision-memory','realized_by'),
    ('stock-analysis-decision-memory-loop','stock-notes-fragmented-ai-context','addresses'),
    ('stock-analysis-decision-memory-loop','stock-notes-selective-llm-analysis','informs'),
    ('health-monitor-operational-observability','health-monitor-usage-progress-invisible','addresses'),
    ('health-monitor-operational-observability','health-monitor-alerts-buried','addresses'),
    ('health-monitor-operational-observability','health-monitor-assets-in-head','addresses'),
    ('health-monitor-operational-observability','health-monitor-actionable-attention','informs'),
    ('health-monitor-operational-observability','health-monitor-local-first-cloud-mirror','informs'),
    ('publishing-factory-to-publication','publishing-factory-externalize-insights','realized_by'),
    ('publishing-factory-to-publication','publishing-factory-human-final-publish','informs'),
    ('publishing-factory-to-publication','publishing-factory-privacy-boundary','constrains'),
    ('idea-capture-to-execution','ideas-capture-before-classify','informs'),
    ('idea-capture-to-execution','ideas-experiment-decision-discipline','informs'),
    ('repository-standard-to-agent-workflow','claude-skills-reusable-agent-workflows','realized_by'),
    ('repository-standard-to-agent-workflow','repo-templates-standardize-bootstrap','realized_by'),
    ('repository-standard-to-agent-workflow','repo-templates-agents-source-of-truth','informs')
)
insert into flow.flow_knowledge_links(flow_id,item_id,relation_type,source,confidence,verified_at)
select f.id,i.id,d.relation_type,'inventory-wave1',1.000,'2026-09-04T16:45:00Z'
from defs d join flow.value_flows f on f.slug=d.flow_slug join knowledge.items i on i.canonical_key=d.item_key
on conflict (flow_id,item_id,relation_type) do nothing;

with defs(flow_slug,outcome_type,title,description,importance) as (
  values
    ('stock-analysis-decision-memory-loop','user_value','過去判断を忘れず次回へ持ち越す','投資仮説・理由・Actionを再利用し、次の材料発生時に前回の議論から続けられる。',5),
    ('health-monitor-operational-observability','user_value','異常・上限接近・鮮度劣化に早く気づく','壊れた後ではなく途中経過で気づき、重要状態を未対応のまま埋もれさせない。',5),
    ('publishing-factory-to-publication','user_value','内部資産を継続的に外部成果物へ変える','市場Dataや思考stockをprivacyを守ったDraftへ変え、X/note等で発信できる。',3),
    ('idea-capture-to-execution','learning','発想を失わず実験・実装へ送る','思いつきの捕捉、採否、実装、学びの履歴を一つの運用として回せる。',4),
    ('repository-standard-to-agent-workflow','learning','開発標準を次のRepositoryへ再利用する','一度作ったRule/CI/品質Gate/Skillを次のProject立ち上げへ持ち越せる。',4)
)
insert into flow.flow_outcomes(flow_id,outcome_type,title,description,importance)
select f.id,d.outcome_type,d.title,d.description,d.importance
from defs d join flow.value_flows f on f.slug=d.flow_slug
on conflict (flow_id,outcome_type,title) do update
set description=excluded.description,importance=excluded.importance,updated_at=now();

commit;
