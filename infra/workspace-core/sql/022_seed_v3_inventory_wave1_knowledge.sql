-- Workspace Core V3 inventory expansion - Wave 1 / Knowledge + Evolution

begin;

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
set kind = excluded.kind,
    title = excluded.title,
    statement = excluded.statement,
    lifecycle_status = excluded.lifecycle_status,
    verification_status = excluded.verification_status,
    source = excluded.source,
    confidence = excluded.confidence,
    verified_at = excluded.verified_at,
    updated_at = now();

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
insert into knowledge.item_products (
  item_id, product_id, relation_type, source, confidence, verified_at
)
select i.id, p.id, d.relation_type, 'inventory-wave1', 1.000, '2026-09-04T16:45:00Z'
from defs d
join knowledge.items i on i.canonical_key = d.item_key
join registry.products p on p.slug = d.product_slug
on conflict (item_id, product_id, relation_type) do update
set source = excluded.source,
    confidence = excluded.confidence,
    verified_at = excluded.verified_at,
    updated_at = now();

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
insert into knowledge.item_resources (
  item_id, resource_id, relation_type, source, confidence, verified_at
)
select i.id, r.id, 'evidenced_by', 'inventory-wave1', 1.000, '2026-09-04T16:45:00Z'
from defs d
join knowledge.items i on i.canonical_key = d.item_key
join registry.external_resources r on r.external_id = d.external_id
on conflict (item_id, resource_id, relation_type) do update
set source = excluded.source,
    confidence = excluded.confidence,
    verified_at = excluded.verified_at,
    updated_at = now();

with defs(event_type, title, summary, period_start, period_end, time_precision, verification_status, source, confidence) as (
  values
    ('idea_formed','Stock Notes統合構想をIdeasへ記録','株式データ収集、AIとの判断議論、結論保存、次回再利用を統合する構想がideas#31として明文化された。','2026-07-28'::date,'2026-07-28'::date,'day','confirmed','artifact-review',1.000),
    ('origin','Health Monitorの原体験を明文化','GCR容量超過、Gmailに埋もれるAlert、market_info資産鮮度という3つの困りごとをMOTIVATION.mdへ記録した。','2026-08-12'::date,'2026-08-12'::date,'day','confirmed','artifact-review',1.000),
    ('integration','Health Monitorにworkspace-core Cloud Mirror契約を追加','Local-firstを維持しつつCurrent State/Transition/Rollup/Governance履歴をworkspace-coreへMirrorするObservability V1.1契約を設計した。',null,null,'unknown','confirmed','artifact-review',1.000)
)
insert into knowledge.evolution_events (
  event_type, title, summary, period_start, period_end, time_precision,
  verification_status, source, confidence, verified_at
)
select d.event_type, d.title, d.summary, d.period_start, d.period_end, d.time_precision,
       d.verification_status, d.source, d.confidence, '2026-09-04T16:45:00Z'
from defs d
where not exists (
  select 1 from knowledge.evolution_events e
  where e.event_type = d.event_type
    and e.title = d.title
    and coalesce(e.period_start,'0001-01-01'::date) = coalesce(d.period_start,'0001-01-01'::date)
    and coalesce(e.period_end,'0001-01-01'::date) = coalesce(d.period_end,'0001-01-01'::date)
);

with defs(event_title, product_slug, role) as (
  values
    ('Stock Notes統合構想をIdeasへ記録','stock-notes','subject'),
    ('Stock Notes統合構想をIdeasへ記録','ideas','context'),
    ('Health Monitorの原体験を明文化','pc-saas-health-monitor','subject'),
    ('Health Monitorにworkspace-core Cloud Mirror契約を追加','pc-saas-health-monitor','subject')
)
insert into knowledge.evolution_event_products (
  event_id, product_id, role, source, confidence, verified_at
)
select e.id, p.id, d.role, 'inventory-wave1', 1.000, '2026-09-04T16:45:00Z'
from defs d
join knowledge.evolution_events e on e.title = d.event_title
join registry.products p on p.slug = d.product_slug
on conflict (event_id, product_id, role) do nothing;

with defs(event_title, external_id) as (
  values
    ('Stock Notes統合構想をIdeasへ記録','Yuichi-TanakaJP/ideas:issue:31'),
    ('Health Monitorの原体験を明文化','Yuichi-TanakaJP/pc-saas-health-monitor:docs/MOTIVATION.md@main'),
    ('Health Monitorにworkspace-core Cloud Mirror契約を追加','Yuichi-TanakaJP/pc-saas-health-monitor:issue:168')
)
insert into knowledge.evolution_event_resources (
  event_id, resource_id, relation_type
)
select e.id, r.id, 'evidence'
from defs d
join knowledge.evolution_events e on e.title = d.event_title
join registry.external_resources r on r.external_id = d.external_id
on conflict (event_id, resource_id, relation_type) do nothing;

commit;
