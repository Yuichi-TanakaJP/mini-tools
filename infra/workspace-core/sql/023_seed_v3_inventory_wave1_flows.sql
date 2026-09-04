-- Workspace Core V3 inventory expansion - Wave 1 / Value Flows

begin;

insert into flow.value_flows (slug, name, summary, purpose, lifecycle_status, model_status, importance)
values
  ('stock-analysis-decision-memory-loop','投資情報 → AI検討 → 判断保存 → 再利用','定型Dataと過去判断を取得し、必要銘柄をAIで深掘りし、結論・Actionを保存して次回判断へ再利用する。','AI相談を一回限りにせず判断Memoryとして循環させる。','active','confirmed',5),
  ('health-monitor-operational-observability','監視収集 → 判定 → 気づき → 履歴','PC/SaaS状態をLocal-firstで収集・保存・判定し、重要状態をActionへつなぎ、将来Cloud Mirrorでも参照する。','壊れる前・見落とす前に気づき、PCが手元になくても重要履歴へ戻れるようにする。','active','confirmed',4),
  ('publishing-factory-to-publication','Ideas / Market Data → Draft → Human Review → 公開','内部の思考・市場factsからAI Draftを作り、人間Review後にX/noteへ手動公開して結果を記録する。','内部資産をprivacyを守りながら外部成果物へ変える。','active','confirmed',3),
  ('idea-capture-to-execution','思いつき → Ideas → 実装Issue → 完了','思いつきを即捕捉し、やると決めたものだけ実装RepositoryへRoutingして完了まで追う。','発想を失わず、分類負荷を入口から分離して実行へつなぐ。','active','confirmed',3),
  ('repository-standard-to-agent-workflow','Repo Template → Claude Skill → Target Repository','repo-templatesの標準をClaude Skill経由で対象Repositoryへ展開する。','開発標準とAgent Workflowを再利用しRepository立ち上げ・運用の品質を揃える。','active','confirmed',3)
on conflict (slug) do update
set name = excluded.name,
    summary = excluded.summary,
    purpose = excluded.purpose,
    lifecycle_status = excluded.lifecycle_status,
    model_status = excluded.model_status,
    importance = excluded.importance,
    updated_at = now();

with defs(flow_slug, version_number, variant_type, label, summary, state, based_on_number, as_of, source, confidence) as (
  values
    ('stock-analysis-decision-memory-loop',1,'as_is','Current','Market/Stock dataと過去判断をContextとしてAIへ渡し、分析・Action・Portfolio ReviewをStock Notesへ保存して再利用する。','active',null,'2026-09-05'::date,'artifact-review',1.000),
    ('health-monitor-operational-observability',1,'as_is','Local-first current','Collector→normalize→Local SQLite→evaluate→Alert/Dashboard→Human Action。','active',null,'2026-09-05'::date,'artifact-review',1.000),
    ('health-monitor-operational-observability',2,'proposed','Local + Cloud Mirror','Local-firstを維持し、重要状態をoutboxからworkspace-core Observabilityへ同期してRemote History/AI参照を追加する。','draft',1,'2026-09-05'::date,'artifact-review',1.000),
    ('publishing-factory-to-publication',1,'as_is','Current','Ideas/Market Info→facts→AI Draft→Human Review→Manual Publish→Publication Log。','active',null,'2026-09-05'::date,'artifact-review',1.000),
    ('idea-capture-to-execution',1,'as_is','Current','思いつき→ideas Issue→採用判断→対象repo Issue→実装→両IssueをClose/Link。','active',null,'2026-09-05'::date,'artifact-review',1.000),
    ('repository-standard-to-agent-workflow',1,'as_is','Current','repo-templates→claude-skills repo-setup→Target Repositoryへ標準Fileを展開。','active',null,'2026-09-05'::date,'artifact-review',1.000)
)
insert into flow.flow_versions (
  flow_id, version_number, variant_type, label, summary, state, based_on_version_id,
  as_of, source, confidence, verified_at
)
select f.id, d.version_number, d.variant_type, d.label, d.summary, d.state, base.id,
       d.as_of, d.source, d.confidence, '2026-09-04T16:45:00Z'
from defs d
join flow.value_flows f on f.slug = d.flow_slug
left join flow.flow_versions base
  on base.flow_id = f.id and base.version_number = d.based_on_number
on conflict (flow_id, version_number) do update
set variant_type = excluded.variant_type,
    label = excluded.label,
    summary = excluded.summary,
    state = excluded.state,
    based_on_version_id = excluded.based_on_version_id,
    as_of = excluded.as_of,
    source = excluded.source,
    confidence = excluded.confidence,
    verified_at = excluded.verified_at,
    updated_at = now();

update flow.flow_versions proposed
set based_on_version_id = base.id,
    updated_at = now()
from flow.value_flows f,
     flow.flow_versions base
where proposed.flow_id = f.id
  and base.flow_id = f.id
  and f.slug = 'health-monitor-operational-observability'
  and proposed.version_number = 2
  and base.version_number = 1
  and proposed.based_on_version_id is distinct from base.id;

-- Stock Notes flow
with defs(step_key, label, step_type, actor_type, seq) as (
  values
    ('signals','株価・決算・信用・優待等','source','system',10),
    ('filter','変化検出・再検討対象を絞る','signal','system',20),
    ('context','Stock Notes Context取得','acquire','system',30),
    ('deliberate','ChatGPT/Claudeで深掘り','deliberate','mixed',40),
    ('save','分析・判断・Actionを保存','record','system',50),
    ('view','MiniToolsで現在判断を確認','touchpoint','user',60),
    ('reuse','次回材料発生時に再利用','reflect','mixed',70)
)
insert into flow.flow_steps (version_id, step_key, label, step_type, actor_type, sequence_hint)
select fv.id, d.step_key, d.label, d.step_type, d.actor_type, d.seq
from defs d
join flow.value_flows f on f.slug = 'stock-analysis-decision-memory-loop'
join flow.flow_versions fv on fv.flow_id = f.id and fv.version_number = 1
on conflict (version_id, step_key) do update
set label = excluded.label,
    step_type = excluded.step_type,
    actor_type = excluded.actor_type,
    sequence_hint = excluded.sequence_hint,
    updated_at = now();

with defs(source_key, target_key, edge_type, label) as (
  values
    ('signals','filter','system_data','定型Data'),
    ('filter','context','system_handoff','必要銘柄だけ'),
    ('context','deliberate','system_handoff','過去判断＋最新Context'),
    ('deliberate','save','system_handoff','結論・理由・Action'),
    ('save','view','system_handoff','保存済み状態'),
    ('view','reuse','feedback','次回確認点を次の判断へ')
)
insert into flow.flow_edges (
  version_id, source_step_id, target_step_id, edge_type, label, source, confidence, verified_at
)
select fv.id, s.id, t.id, d.edge_type, d.label, 'inventory-wave1', 1.000, '2026-09-04T16:45:00Z'
from defs d
join flow.value_flows f on f.slug = 'stock-analysis-decision-memory-loop'
join flow.flow_versions fv on fv.flow_id = f.id and fv.version_number = 1
join flow.flow_steps s on s.version_id = fv.id and s.step_key = d.source_key
join flow.flow_steps t on t.version_id = fv.id and t.step_key = d.target_key
on conflict (version_id, source_step_id, target_step_id, edge_type) do update
set label = excluded.label,
    source = excluded.source,
    confidence = excluded.confidence,
    verified_at = excluded.verified_at,
    updated_at = now();

-- Health Monitor current / proposed
with defs(version_number, step_key, label, step_type, actor_type, seq) as (
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
insert into flow.flow_steps (version_id, step_key, label, step_type, actor_type, sequence_hint)
select fv.id, d.step_key, d.label, d.step_type, d.actor_type, d.seq
from defs d
join flow.value_flows f on f.slug = 'health-monitor-operational-observability'
join flow.flow_versions fv on fv.flow_id = f.id and fv.version_number = d.version_number
on conflict (version_id, step_key) do update
set label = excluded.label,
    step_type = excluded.step_type,
    actor_type = excluded.actor_type,
    sequence_hint = excluded.sequence_hint,
    updated_at = now();

with defs(version_number, source_key, target_key, edge_type, label) as (
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
insert into flow.flow_edges (
  version_id, source_step_id, target_step_id, edge_type, label, source, confidence, verified_at
)
select fv.id, s.id, t.id, d.edge_type, d.label, 'inventory-wave1', 1.000, '2026-09-04T16:45:00Z'
from defs d
join flow.value_flows f on f.slug = 'health-monitor-operational-observability'
join flow.flow_versions fv on fv.flow_id = f.id and fv.version_number = d.version_number
join flow.flow_steps s on s.version_id = fv.id and s.step_key = d.source_key
join flow.flow_steps t on t.version_id = fv.id and t.step_key = d.target_key
on conflict (version_id, source_step_id, target_step_id, edge_type) do update
set label = excluded.label,
    source = excluded.source,
    confidence = excluded.confidence,
    verified_at = excluded.verified_at,
    updated_at = now();

-- Publishing factory
with defs(step_key, label, step_type, actor_type, seq) as (
  values
    ('inputs','Ideas / Market Info / User input','source','mixed',10),
    ('facts','決定的Facts生成','transform','system',20),
    ('draft','AI Draft生成','transform','system',30),
    ('review','Human Review','human_action','user',40),
    ('publish','X / noteへ手動公開','publish','user',50),
    ('log','実投稿・公開URLを記録','record','mixed',60)
)
insert into flow.flow_steps (version_id, step_key, label, step_type, actor_type, sequence_hint)
select fv.id, d.step_key, d.label, d.step_type, d.actor_type, d.seq
from defs d
join flow.value_flows f on f.slug = 'publishing-factory-to-publication'
join flow.flow_versions fv on fv.flow_id = f.id and fv.version_number = 1
on conflict (version_id, step_key) do update
set label = excluded.label,
    step_type = excluded.step_type,
    actor_type = excluded.actor_type,
    sequence_hint = excluded.sequence_hint,
    updated_at = now();

with defs(source_key, target_key, edge_type) as (
  values
    ('inputs','facts','system_handoff'),
    ('facts','draft','system_data'),
    ('draft','review','human_handoff'),
    ('review','publish','human_handoff'),
    ('publish','log','human_handoff')
)
insert into flow.flow_edges (version_id, source_step_id, target_step_id, edge_type, source, confidence, verified_at)
select fv.id, s.id, t.id, d.edge_type, 'inventory-wave1', 1.000, '2026-09-04T16:45:00Z'
from defs d
join flow.value_flows f on f.slug = 'publishing-factory-to-publication'
join flow.flow_versions fv on fv.flow_id = f.id and fv.version_number = 1
join flow.flow_steps s on s.version_id = fv.id and s.step_key = d.source_key
join flow.flow_steps t on t.version_id = fv.id and t.step_key = d.target_key
on conflict (version_id, source_step_id, target_step_id, edge_type) do nothing;

-- Ideas flow
with defs(step_key, label, step_type, actor_type, seq) as (
  values
    ('thought','思いつき','source','user',10),
    ('capture','Ideasへ1行Issue登録','record','user',20),
    ('decide','やる/保留/blocked/凍結を判定','decision','mixed',30),
    ('route','対象Repositoryへ実装Issue','deliver','mixed',40),
    ('implement','実装・実験','execute','mixed',50),
    ('close','結果・学びを記録してClose','reflect','mixed',60)
)
insert into flow.flow_steps (version_id, step_key, label, step_type, actor_type, sequence_hint)
select fv.id, d.step_key, d.label, d.step_type, d.actor_type, d.seq
from defs d
join flow.value_flows f on f.slug = 'idea-capture-to-execution'
join flow.flow_versions fv on fv.flow_id = f.id and fv.version_number = 1
on conflict (version_id, step_key) do update
set label = excluded.label,
    step_type = excluded.step_type,
    actor_type = excluded.actor_type,
    sequence_hint = excluded.sequence_hint,
    updated_at = now();

with defs(source_key, target_key, edge_type) as (
  values
    ('thought','capture','human_handoff'),
    ('capture','decide','human_handoff'),
    ('decide','route','system_handoff'),
    ('route','implement','human_handoff'),
    ('implement','close','feedback')
)
insert into flow.flow_edges (version_id, source_step_id, target_step_id, edge_type, source, confidence, verified_at)
select fv.id, s.id, t.id, d.edge_type, 'inventory-wave1', 1.000, '2026-09-04T16:45:00Z'
from defs d
join flow.value_flows f on f.slug = 'idea-capture-to-execution'
join flow.flow_versions fv on fv.flow_id = f.id and fv.version_number = 1
join flow.flow_steps s on s.version_id = fv.id and s.step_key = d.source_key
join flow.flow_steps t on t.version_id = fv.id and t.step_key = d.target_key
on conflict (version_id, source_step_id, target_step_id, edge_type) do nothing;

-- Repository standards -> Claude skill -> target repo
with defs(step_key, label, step_type, actor_type, seq) as (
  values
    ('template','repo-templates正本','source','system',10),
    ('skill','Claude repo-setup Skill','transform','system',20),
    ('target','Target Repositoryへ標準File配置','deliver','system',30),
    ('develop','共通Rule/CI/品質Gateで開発','outcome','mixed',40)
)
insert into flow.flow_steps (version_id, step_key, label, step_type, actor_type, sequence_hint)
select fv.id, d.step_key, d.label, d.step_type, d.actor_type, d.seq
from defs d
join flow.value_flows f on f.slug = 'repository-standard-to-agent-workflow'
join flow.flow_versions fv on fv.flow_id = f.id and fv.version_number = 1
on conflict (version_id, step_key) do update
set label = excluded.label,
    step_type = excluded.step_type,
    actor_type = excluded.actor_type,
    sequence_hint = excluded.sequence_hint,
    updated_at = now();

with defs(source_key, target_key, edge_type) as (
  values
    ('template','skill','system_handoff'),
    ('skill','target','system_handoff'),
    ('target','develop','control')
)
insert into flow.flow_edges (version_id, source_step_id, target_step_id, edge_type, source, confidence, verified_at)
select fv.id, s.id, t.id, d.edge_type, 'inventory-wave1', 1.000, '2026-09-04T16:45:00Z'
from defs d
join flow.value_flows f on f.slug = 'repository-standard-to-agent-workflow'
join flow.flow_versions fv on fv.flow_id = f.id and fv.version_number = 1
join flow.flow_steps s on s.version_id = fv.id and s.step_key = d.source_key
join flow.flow_steps t on t.version_id = fv.id and t.step_key = d.target_key
on conflict (version_id, source_step_id, target_step_id, edge_type) do nothing;

-- Product / Function bindings
with defs(flow_slug, version_number, step_key, product_slug, role) as (
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
insert into flow.flow_step_products (
  step_id, product_id, role, source, confidence, verified_at
)
select fs.id, p.id, d.role, 'inventory-wave1', 1.000, '2026-09-04T16:45:00Z'
from defs d
join flow.value_flows f on f.slug = d.flow_slug
join flow.flow_versions fv on fv.flow_id = f.id and fv.version_number = d.version_number
join flow.flow_steps fs on fs.version_id = fv.id and fs.step_key = d.step_key
join registry.products p on p.slug = d.product_slug
on conflict (step_id, product_id, role) do nothing;

with defs(flow_slug, version_number, step_key, product_slug, function_slug, role) as (
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
insert into flow.flow_step_product_functions (
  step_id, product_function_id, role, source, confidence, verified_at
)
select fs.id, pf.id, d.role, 'inventory-wave1', 1.000, '2026-09-04T16:45:00Z'
from defs d
join flow.value_flows f on f.slug = d.flow_slug
join flow.flow_versions fv on fv.flow_id = f.id and fv.version_number = d.version_number
join flow.flow_steps fs on fs.version_id = fv.id and fs.step_key = d.step_key
join registry.products p on p.slug = d.product_slug
join registry.product_functions pf on pf.product_id = p.id and pf.slug = d.function_slug
on conflict (step_id, product_function_id, role) do nothing;

with defs(flow_slug, item_key, relation_type) as (
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
insert into flow.flow_knowledge_links (
  flow_id, item_id, relation_type, source, confidence, verified_at
)
select f.id, i.id, d.relation_type, 'inventory-wave1', 1.000, '2026-09-04T16:45:00Z'
from defs d
join flow.value_flows f on f.slug = d.flow_slug
join knowledge.items i on i.canonical_key = d.item_key
on conflict (flow_id, item_id, relation_type) do nothing;

with defs(flow_slug, outcome_type, title, description, importance) as (
  values
    ('stock-analysis-decision-memory-loop','user_value','過去判断を忘れず次回へ持ち越す','投資仮説・理由・Actionを再利用し、次の材料発生時に前回の議論から続けられる。',5),
    ('health-monitor-operational-observability','user_value','異常・上限接近・鮮度劣化に早く気づく','壊れた後ではなく途中経過で気づき、重要状態を未対応のまま埋もれさせない。',5),
    ('publishing-factory-to-publication','user_value','内部資産を継続的に外部成果物へ変える','市場Dataや思考stockをprivacyを守ったDraftへ変え、X/note等で発信できる。',3),
    ('idea-capture-to-execution','learning','発想を失わず実験・実装へ送る','思いつきの捕捉、採否、実装、学びの履歴を一つの運用として回せる。',4),
    ('repository-standard-to-agent-workflow','learning','開発標準を次のRepositoryへ再利用する','一度作ったRule/CI/品質Gate/Skillを次のProject立ち上げへ持ち越せる。',4)
)
insert into flow.flow_outcomes (
  flow_id, outcome_type, title, description, importance
)
select f.id, d.outcome_type, d.title, d.description, d.importance
from defs d
join flow.value_flows f on f.slug = d.flow_slug
on conflict (flow_id, outcome_type, title) do update
set description = excluded.description,
    importance = excluded.importance,
    updated_at = now();

commit;
