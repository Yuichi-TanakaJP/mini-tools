-- Workspace Core V3 inventory expansion - Wave 2 / Registry
-- Data Gallery, Todo App, Notion Script, Test Trade, Sensoria Portfolio, Test ISN.

begin;

with github as (
  select id from platform.source_systems where code = 'github'
), defs(external_id, resource_type, title, url, summary) as (
  values
    ('Yuichi-TanakaJP/data-gallery:README.md@main','repository_document','Data Gallery README','https://github.com/Yuichi-TanakaJP/data-gallery/blob/main/README.md','Next.js + Supabaseの作品一覧・投票Gallery。'),
    ('Yuichi-TanakaJP/data-gallery:docs/ONBOARDING.md@main','repository_document','Data Gallery Onboarding','https://github.com/Yuichi-TanakaJP/data-gallery/blob/main/docs/ONBOARDING.md','公開readとservice-role write、Route Handler、DB trigger、Zod契約の設計。'),
    ('Yuichi-TanakaJP/todo-app:README.md@main','repository_document','Todo App README','https://github.com/Yuichi-TanakaJP/todo-app/blob/main/README.md','React/Vite frontendと別Repository backendを組み合わせるTodo App。'),
    ('Yuichi-TanakaJP/todo-app-backend:README.md@main','repository_document','Todo API Backend README','https://github.com/Yuichi-TanakaJP/todo-app-backend/blob/main/README.md','Express + Prisma + PostgresのTodo REST API。'),
    ('Yuichi-TanakaJP/notion-script:README.md@master','repository_document','Notion Script README','https://github.com/Yuichi-TanakaJP/notion-script/blob/master/README.md','Notion DB空欄をfetch→AI補完→dry-run→write-backするScript群。'),
    ('Yuichi-TanakaJP/test_trade:README.md@main','repository_document','AI Trade Research Lab README','https://github.com/Yuichi-TanakaJP/test_trade/blob/main/README.md','AI戦略案を先読み・過学習を避けて検証するresearch lab。'),
    ('Yuichi-TanakaJP/test_trade:docs/current_status_ja.md@main','repository_document','AI Trade Research Lab current status','https://github.com/Yuichi-TanakaJP/test_trade/blob/main/docs/current_status_ja.md','検証済み戦略、棄却結果、暫定候補、paper tradingへの次段階を記録。'),
    ('Yuichi-TanakaJP/sensoria-portfolio:README.md@main','repository_document','Sensoria Portfolio README','https://github.com/Yuichi-TanakaJP/sensoria-portfolio/blob/main/README.md','美容・アート・旅のJournal/Works/Media Kitを統合した公開Portfolio。'),
    ('Yuichi-TanakaJP/sensoria-portfolio:docs/01-project-overview.md@main','repository_document','Sensoria Project Overview','https://github.com/Yuichi-TanakaJP/sensoria-portfolio/blob/main/docs/01-project-overview.md','活動・経歴を集約し外部メディア導線を一本化する目的とKPI。'),
    ('Yuichi-TanakaJP/test_ISN:README.md@master','repository_document','ISN Record Viewer README','https://github.com/Yuichi-TanakaJP/test_ISN/blob/master/README.md','閲覧・申請・承認・履歴管理Web App。'),
    ('Yuichi-TanakaJP/test_ISN:docs/architecture.md@master','repository_document','ISN Architecture','https://github.com/Yuichi-TanakaJP/test_ISN/blob/master/docs/architecture.md','request/approval、audit history、store abstraction、auth/concurrency設計。')
)
insert into registry.external_resources (
  source_system_id, external_id, resource_type, title, url, summary, status, last_synced_at
)
select github.id, d.external_id, d.resource_type, d.title, d.url, d.summary, 'active', '2026-09-04T17:10:00Z'
from defs d cross join github
on conflict (source_system_id, external_id, resource_type) do update
set title=excluded.title, url=excluded.url, summary=excluded.summary,
    status=excluded.status, last_synced_at=excluded.last_synced_at, updated_at=now();

with defs(product_slug, function_slug, name, description, function_type, lifecycle_status, is_user_facing, evidence_uri) as (
  values
    ('data-gallery','ranked-gallery','票数順Gallery','Supabaseから作品一覧を取得し票数順にCard表示する。','feature','active',true,'https://github.com/Yuichi-TanakaJP/data-gallery/blob/main/docs/ONBOARDING.md'),
    ('data-gallery','vote-api','投票API','Route Handler経由でvote_eventsへ投票を記録し最新票数を返す。','interface','active',true,'https://github.com/Yuichi-TanakaJP/data-gallery/blob/main/docs/ONBOARDING.md'),
    ('data-gallery','vote-trigger-aggregation','投票Trigger集計','vote_events挿入を契機にworks.votes_countをDB triggerで更新する。','automation','active',false,'https://github.com/Yuichi-TanakaJP/data-gallery/blob/main/docs/ONBOARDING.md'),

    ('todo-app','todo-frontend','Todo Frontend','Todo一覧・追加・完了切替・削除をBackend API経由で操作するReact Frontend。','interface','active',true,'https://github.com/Yuichi-TanakaJP/todo-app/blob/main/README.md'),
    ('todo-app','todo-rest-api','Todo REST API','GET/POST/PUT/DELETEのTodo APIをExpress + Prismaで提供する。','interface','active',false,'https://github.com/Yuichi-TanakaJP/todo-app-backend/blob/main/README.md'),
    ('todo-app','api-health-check','API Health Check','FrontendからBackendのhealth endpointを確認する。','feature','active',true,'https://github.com/Yuichi-TanakaJP/todo-app/blob/main/README.md'),

    ('notion-script','fetch-missing-fields','Notion空欄抽出','Notion DBから空欄フィールドを持つEntryだけraw.mdへ抽出する。','pipeline','active',false,'https://github.com/Yuichi-TanakaJP/notion-script/blob/master/README.md'),
    ('notion-script','ai-field-completion','AIフィールド補完','Claude Code / notion-complete Skillでraw.mdからcompleted.mdを作る。','workflow','active',true,'https://github.com/Yuichi-TanakaJP/notion-script/blob/master/README.md'),
    ('notion-script','safe-notion-writeback','Dry-run付きNotion書戻し','dry-run確認後、空欄フィールドだけNotionへ書き戻す。','workflow','active',true,'https://github.com/Yuichi-TanakaJP/notion-script/blob/master/README.md'),

    ('test-trade','research-data-ingestion','Research Data取込','Binance/J-Quants等の研究Dataを取得・cacheし再開可能にする。','pipeline','active',false,'https://github.com/Yuichi-TanakaJP/test_trade/blob/main/README.md'),
    ('test-trade','strategy-backtesting','Strategy Backtest','AI/人間の戦略仮説をcost/slippage込みでbacktestする。','workflow','active',false,'https://github.com/Yuichi-TanakaJP/test_trade/blob/main/README.md'),
    ('test-trade','robustness-validation','Robustness検証','train/validation/test分離や業種中立化等で頑健性・非定常性を検証する。','workflow','active',false,'https://github.com/Yuichi-TanakaJP/test_trade/blob/main/docs/current_status_ja.md'),
    ('test-trade','paper-trading','Paper Trading','実資金を使わず候補Strategyの前向き組成・Ledgerを記録する。','workflow','experimental',false,'https://github.com/Yuichi-TanakaJP/test_trade/blob/main/README.md'),

    ('sensoria-portfolio','journal','Journal','世界観・記事・活動背景を読者へ届ける公開Journal。','feature','active',true,'https://github.com/Yuichi-TanakaJP/sensoria-portfolio/blob/main/README.md'),
    ('sensoria-portfolio','works-archive','Works Archive','300本超の掲載実績を確認できるWorks archive。','feature','active',true,'https://github.com/Yuichi-TanakaJP/sensoria-portfolio/blob/main/README.md'),
    ('sensoria-portfolio','media-kit','Media Kit','編集者・協業候補向けに実績・プロフィール・問い合わせ導線をまとめる。','feature','active',true,'https://github.com/Yuichi-TanakaJP/sensoria-portfolio/blob/main/docs/01-project-overview.md'),

    ('test-isn','change-request-workflow','変更申請Workflow','一般Userの追加/更新/削除をpending requestとして記録する。','workflow','active',true,'https://github.com/Yuichi-TanakaJP/test_ISN/blob/master/docs/architecture.md'),
    ('test-isn','admin-approval','Admin承認','adminが申請を承認/却下し、承認時のみ実Dataへ反映する。','workflow','active',true,'https://github.com/Yuichi-TanakaJP/test_ISN/blob/master/docs/architecture.md'),
    ('test-isn','audit-history','変更監査履歴','CREATE/UPDATE/DELETEのsnapshotを追記し削除後も閲覧可能にする。','feature','active',true,'https://github.com/Yuichi-TanakaJP/test_ISN/blob/master/docs/architecture.md'),
    ('test-isn','store-abstraction','Store Abstraction','DATABASE_URL有無でNeon DBとLocal CSV実装を切り替える。','module','active',false,'https://github.com/Yuichi-TanakaJP/test_ISN/blob/master/docs/architecture.md'),
    ('test-isn','user-auth-management','認証・User管理','scrypt password、署名Cookie、admin user managementを提供する。','feature','active',true,'https://github.com/Yuichi-TanakaJP/test_ISN/blob/master/README.md')
)
insert into registry.product_functions (
  product_id, slug, name, description, function_type, lifecycle_status,
  is_user_facing, source, confidence, evidence_uri, verified_at
)
select p.id, d.function_slug, d.name, d.description, d.function_type, d.lifecycle_status,
       d.is_user_facing, 'inventory-wave2', 1.000, d.evidence_uri, '2026-09-04T17:10:00Z'
from defs d join registry.products p on p.slug=d.product_slug
on conflict (product_id, slug) do update
set name=excluded.name, description=excluded.description, function_type=excluded.function_type,
    lifecycle_status=excluded.lifecycle_status, is_user_facing=excluded.is_user_facing,
    source=excluded.source, confidence=excluded.confidence, evidence_uri=excluded.evidence_uri,
    verified_at=excluded.verified_at, updated_at=now();

insert into registry.capabilities (slug, name, description, category)
values
  ('privileged-server-write-separation','Public Read / Privileged Write分離','Public readとserver-side privileged writeを分離して秘密KeyをBrowserへ出さない。','architecture'),
  ('database-trigger-aggregation','DB Trigger集計','Event insertから集計値をDB triggerで一貫して更新する。','data'),
  ('frontend-backend-api-contract','Frontend / Backend API契約','独立FrontendとBackendをHTTP API contractで接続する。','architecture'),
  ('orm-backed-rest-api','ORM-backed REST API','ORM/migrationを使うCRUD REST APIを設計・運用する。','backend'),
  ('human-in-loop-data-enrichment','Human-in-the-loop Data補完','AI補完を人間確認・dry-runと組み合わせて元Dataへ安全に戻す。','ai'),
  ('non-destructive-field-completion','非破壊Field補完','既存値を上書きせず空欄だけを補完する更新境界を設計する。','data'),
  ('leakage-resistant-backtesting','先読み防止Backtest設計','当日までの情報、翌日約定等でfuture leakageを避けて検証する。','quant'),
  ('staged-out-of-sample-validation','段階的Out-of-sample検証','train→validation→testを分離しtestをparameter tuningへ再利用しない。','quant'),
  ('resumable-rate-limited-ingestion','再開可能Rate-limit Data取込','API limitを守り日付/銘柄単位cacheで中断後に未取得分から再開する。','data'),
  ('forward-paper-validation','Paper Trading前向き検証','実資金を使わず固定条件で将来期間の組成・約定差を記録する。','quant'),
  ('public-portfolio-information-architecture','公開Portfolio情報設計','活動・実績・Media Kit・CTAを外部閲覧者向けに一つの情報Architectureへまとめる。','product'),
  ('approval-workflow-design','申請・承認Workflow設計','一般操作をrequest化し権限者の承認後のみ本Dataへ適用する。','product'),
  ('append-only-audit-history','追記型Audit History','変更時snapshotを追記し削除後も履歴を再現できるようにする。','data'),
  ('approval-concurrency-control','承認時Concurrency Control','base version確認とneeds_review遷移で競合申請を安全に扱う。','architecture'),
  ('storage-backend-abstraction','Storage Backend抽象化','共通Store interfaceの裏でDB/Local file実装を切り替える。','architecture')
on conflict (slug) do update
set name=excluded.name, description=excluded.description, category=excluded.category, updated_at=now();

with defs(product_slug, capability_slug, relation_type, evidence_uri) as (
  values
    ('data-gallery','privileged-server-write-separation','demonstrates','https://github.com/Yuichi-TanakaJP/data-gallery/blob/main/docs/ONBOARDING.md'),
    ('data-gallery','database-trigger-aggregation','demonstrates','https://github.com/Yuichi-TanakaJP/data-gallery/blob/main/docs/ONBOARDING.md'),
    ('todo-app','frontend-backend-api-contract','demonstrates','https://github.com/Yuichi-TanakaJP/todo-app/blob/main/README.md'),
    ('todo-app','orm-backed-rest-api','demonstrates','https://github.com/Yuichi-TanakaJP/todo-app-backend/blob/main/README.md'),
    ('notion-script','human-in-loop-data-enrichment','demonstrates','https://github.com/Yuichi-TanakaJP/notion-script/blob/master/README.md'),
    ('notion-script','non-destructive-field-completion','demonstrates','https://github.com/Yuichi-TanakaJP/notion-script/blob/master/README.md'),
    ('test-trade','leakage-resistant-backtesting','demonstrates','https://github.com/Yuichi-TanakaJP/test_trade/blob/main/README.md'),
    ('test-trade','staged-out-of-sample-validation','demonstrates','https://github.com/Yuichi-TanakaJP/test_trade/blob/main/README.md'),
    ('test-trade','resumable-rate-limited-ingestion','demonstrates','https://github.com/Yuichi-TanakaJP/test_trade/blob/main/README.md'),
    ('test-trade','forward-paper-validation','develops','https://github.com/Yuichi-TanakaJP/test_trade/blob/main/docs/current_status_ja.md'),
    ('sensoria-portfolio','public-portfolio-information-architecture','demonstrates','https://github.com/Yuichi-TanakaJP/sensoria-portfolio/blob/main/docs/01-project-overview.md'),
    ('test-isn','approval-workflow-design','demonstrates','https://github.com/Yuichi-TanakaJP/test_ISN/blob/master/docs/architecture.md'),
    ('test-isn','append-only-audit-history','demonstrates','https://github.com/Yuichi-TanakaJP/test_ISN/blob/master/docs/architecture.md'),
    ('test-isn','approval-concurrency-control','demonstrates','https://github.com/Yuichi-TanakaJP/test_ISN/blob/master/docs/architecture.md'),
    ('test-isn','storage-backend-abstraction','demonstrates','https://github.com/Yuichi-TanakaJP/test_ISN/blob/master/docs/architecture.md')
)
insert into registry.product_capabilities (
  product_id, capability_id, relation_type, source, confidence, evidence_uri, verified_at
)
select p.id, c.id, d.relation_type, 'inventory-wave2', 1.000, d.evidence_uri, '2026-09-04T17:10:00Z'
from defs d
join registry.products p on p.slug=d.product_slug
join registry.capabilities c on c.slug=d.capability_slug
on conflict (product_id, capability_id, relation_type) do update
set source=excluded.source, confidence=excluded.confidence, evidence_uri=excluded.evidence_uri,
    verified_at=excluded.verified_at, updated_at=now();

with defs(capability_slug, technology_slug, relation_type) as (
  values
    ('privileged-server-write-separation','nextjs','implemented_with'),
    ('frontend-backend-api-contract','react','implemented_with'),
    ('frontend-backend-api-contract','typescript','implemented_with'),
    ('orm-backed-rest-api','express','implemented_with'),
    ('orm-backed-rest-api','prisma','implemented_with'),
    ('human-in-loop-data-enrichment','python','implemented_with'),
    ('non-destructive-field-completion','python','implemented_with'),
    ('leakage-resistant-backtesting','python','implemented_with'),
    ('staged-out-of-sample-validation','python','implemented_with'),
    ('resumable-rate-limited-ingestion','python','implemented_with'),
    ('forward-paper-validation','python','implemented_with'),
    ('public-portfolio-information-architecture','react','implemented_with'),
    ('public-portfolio-information-architecture','typescript','implemented_with'),
    ('public-portfolio-information-architecture','vite','implemented_with'),
    ('approval-workflow-design','nextjs','implemented_with'),
    ('approval-workflow-design','typescript','implemented_with'),
    ('storage-backend-abstraction','typescript','implemented_with')
)
insert into registry.capability_technologies (
  capability_id, technology_id, relation_type, source, confidence, verified_at
)
select c.id, t.id, d.relation_type, 'inventory-wave2', 1.000, '2026-09-04T17:10:00Z'
from defs d
join registry.capabilities c on c.slug=d.capability_slug
join registry.technologies t on t.slug=d.technology_slug
on conflict (capability_id, technology_id, relation_type) do update
set source=excluded.source, confidence=excluded.confidence,
    verified_at=excluded.verified_at, updated_at=now();

with defs(capability_slug, stage, source, confidence, rationale) as (
  values
    ('privileged-server-write-separation','applied','artifact-review',1.000,'Data GalleryでBrowser readとRoute Handler service-role writeを分離。'),
    ('database-trigger-aggregation','applied','artifact-review',1.000,'投票eventからvotes_countをDB triggerで集計。'),
    ('frontend-backend-api-contract','applied','artifact-review',1.000,'Todo frontend/backendを別Repository・HTTP APIで接続。'),
    ('orm-backed-rest-api','applied','artifact-review',1.000,'Express + Prisma + Postgres CRUD APIとして実装。'),
    ('human-in-loop-data-enrichment','repeated','artifact-review',1.000,'Notion DB別configでfetch→AI→write-backを反復可能。'),
    ('non-destructive-field-completion','repeated','artifact-review',1.000,'既存値を上書きせず空欄のみ補完する運用。'),
    ('leakage-resistant-backtesting','repeated','artifact-review',1.000,'複数戦略群で先読み防止ルールを反復適用。'),
    ('staged-out-of-sample-validation','repeated','artifact-review',1.000,'train/validation/testを複数研究で継続適用。'),
    ('resumable-rate-limited-ingestion','applied','artifact-review',1.000,'J-Quantsをrate limit以下でcacheし未取得分から再開。'),
    ('forward-paper-validation','experimental','artifact-review',1.000,'暫定候補の次段階としてPaper Tradingを開始する段階。'),
    ('public-portfolio-information-architecture','applied','artifact-review',1.000,'Journal/Works/Media Kitをreleased SPAとして公開。'),
    ('approval-workflow-design','applied','artifact-review',1.000,'一般変更をpending化しadmin承認時のみAtomic apply。'),
    ('append-only-audit-history','applied','artifact-review',1.000,'削除時snapshotも含むrecord_historyを保持。'),
    ('approval-concurrency-control','applied','artifact-review',1.000,'base_versionとneeds_reviewで競合を扱う。'),
    ('storage-backend-abstraction','applied','artifact-review',1.000,'Store interfaceでNeon/CSV実装を切替。')
)
insert into registry.capability_assessments (
  capability_id, stage, assessed_at, source, confidence, rationale
)
select c.id, d.stage, '2026-09-04T17:10:00Z', d.source, d.confidence, d.rationale
from defs d
join registry.capabilities c on c.slug=d.capability_slug
where not exists (
  select 1 from registry.capability_assessments a
  where a.capability_id=c.id and a.stage=d.stage
    and a.assessed_at='2026-09-04T17:10:00Z' and a.source=d.source
);

commit;
