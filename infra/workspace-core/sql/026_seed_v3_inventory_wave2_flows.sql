-- Workspace Core V3 inventory expansion - Wave 2 / Value Flows
-- As-Is flows only. Human/manual boundaries are explicitly represented.

begin;

with defs(slug,name,summary,purpose,lifecycle_status,model_status,importance) as (
  values
    ('data-gallery-vote-flow','Gallery閲覧 → 投票 → DB集計','公開Galleryの閲覧からserver-side投票、DB trigger集計まで。','作品を安全に閲覧・投票できる。','active','confirmed',2),
    ('todo-app-crud-flow','Todo Frontend → REST API → Postgres','独立FrontendからBackend REST APIを経由してTodoをCRUDする。','Frontend/Backend分離とAPI境界を実装する。','active','confirmed',2),
    ('notion-script-enrichment-flow','Notion空欄 → Batch抽出 → AI補完 → 確認 → 書戻し','Notion DBの空欄だけをbatch抽出し、AI補完後にdry-run確認して安全にwrite-backする。','大量の未整理Notion項目を低コスト・再現可能に補完する。','active','confirmed',2),
    ('test-trade-research-flow','仮説 → Data → Backtest → OOS検証 → 棄却/候補 → Paper','投資仮説をデータ化し、先読み防止・train/validation/testで検証し、実資金採用前に棄却またはPaper Tradingへ送る。','AI/人間の投資仮説を検証可能な研究判断へ変える。','active','confirmed',3),
    ('sensoria-public-portfolio-flow','活動・実績 → Journal/Works/Media Kit → 外部読者','活動・経歴・掲載実績を編集し公開Portfolioにまとめ、読者・編集者・協業候補へ届ける。','外部向けに世界観・実績・問い合わせ導線を一本化する。','active','confirmed',2),
    ('test-isn-approval-flow','変更入力 → Request → Admin Review → Apply → Audit','一般Userの変更をpending request化し、admin承認後のみ本Dataへatomic applyし監査履歴へ残す。','業務Dataの変更を承認・監査可能にする。','active','confirmed',2)
)
insert into flow.value_flows (slug,name,summary,purpose,lifecycle_status,model_status,importance)
select * from defs
on conflict (slug) do update set name=excluded.name, summary=excluded.summary, purpose=excluded.purpose,
 lifecycle_status=excluded.lifecycle_status, model_status=excluded.model_status, importance=excluded.importance, updated_at=now();

with defs(flow_slug,label,summary,as_of) as (
  values
    ('data-gallery-vote-flow','As-Is','公開readとprivileged writeを分離した現在の投票Flow','2026-09-04'::date),
    ('todo-app-crud-flow','As-Is','Frontend/Backend 2-repository構成の現在Flow','2026-09-04'::date),
    ('notion-script-enrichment-flow','As-Is','fetch → AI completion → dry-run → updateの3段Flow','2026-09-04'::date),
    ('test-trade-research-flow','As-Is','研究仮説を棄却/継続候補へ判定しPaper Tradingへ送る現在Flow','2026-09-04'::date),
    ('sensoria-public-portfolio-flow','As-Is','静的Contentを公開Portfolioへ編集・公開する現在Flow','2026-09-04'::date),
    ('test-isn-approval-flow','As-Is','一般変更を承認後のみ反映する現在Flow','2026-09-04'::date)
)
insert into flow.flow_versions (flow_id,version_number,variant_type,label,summary,state,as_of,source,confidence,verified_at)
select f.id,1,'as_is',d.label,d.summary,'active',d.as_of,'inventory-wave2',1.000,now()
from defs d join flow.value_flows f on f.slug=d.flow_slug
on conflict (flow_id,version_number) do update set variant_type=excluded.variant_type,label=excluded.label,summary=excluded.summary,
 state=excluded.state,as_of=excluded.as_of,source=excluded.source,confidence=excluded.confidence,verified_at=excluded.verified_at,updated_at=now();

with defs(flow_slug,step_key,label,step_type,actor_type,description,seq) as (
  values
  ('data-gallery-vote-flow','browse','作品一覧を取得・表示','touchpoint','user','公開Keyで作品一覧を読み票数順に表示する。',10),
  ('data-gallery-vote-flow','vote','投票操作','human_action','user','Userが作品Cardから投票する。',20),
  ('data-gallery-vote-flow','route','Route Handlerで投票受付','deliver','system','Browserから/api/voteへPOSTしserver-sideで検証する。',30),
  ('data-gallery-vote-flow','event','vote_eventsへ記録','store','system','service-role側でvote eventを保存する。',40),
  ('data-gallery-vote-flow','aggregate','DB Triggerで票数集計','transform','system','triggerがworks.votes_countを更新する。',50),
  ('data-gallery-vote-flow','refresh','最新票数をUIへ返す','touchpoint','system','最新票数をBrowserへ返して表示更新する。',60),

  ('todo-app-crud-flow','ui','Todo Frontend','touchpoint','user','React/Vite UIで一覧・追加・更新・削除を操作する。',10),
  ('todo-app-crud-flow','api','Todo REST API','deliver','system','HTTP API contractでFrontend requestを受ける。',20),
  ('todo-app-crud-flow','orm','PrismaでData操作','transform','system','API requestをORM操作へ変換する。',30),
  ('todo-app-crud-flow','db','Postgresへ保存','store','system','Todo stateをPostgresへ永続化する。',40),
  ('todo-app-crud-flow','response','結果をFrontendへ返す','touchpoint','system','API responseでUI stateを更新する。',50),

  ('notion-script-enrichment-flow','source','Notion DBの未補完Entry','source','system','空欄Fieldを含むNotion DBを入力源とする。',10),
  ('notion-script-enrichment-flow','fetch','空欄だけBatch抽出','acquire','system','APIで空欄Entryをまとめてraw.mdへ抽出する。',20),
  ('notion-script-enrichment-flow','complete','AI / Skillで補完','transform','mixed','Claude Code/Skillがraw.mdからcompleted.mdを生成する。',30),
  ('notion-script-enrichment-flow','dryrun','dry-runで変更確認','investigate','user','本番write前に差分を確認する。',40),
  ('notion-script-enrichment-flow','write','空欄だけNotionへ書戻し','record','system','既存値を上書きせず空欄Fieldのみ更新する。',50),
  ('notion-script-enrichment-flow','reuse','再現可能な補完Workflowとして再利用','outcome','mixed','同一Patternを複数Notion DBへ適用できる。',60),

  ('test-trade-research-flow','hypothesis','投資仮説 / Strategy案','source','mixed','YouTube・メモ・AI・人間の発想から検証仮説を作る。',10),
  ('test-trade-research-flow','data','Market Dataを取得・Cache','acquire','system','Binance/J-Quants等のDataをrate limitを守って取得する。',20),
  ('test-trade-research-flow','backtest','Cost込みBacktest','transform','system','future leakageを避けて仮説を定量検証する。',30),
  ('test-trade-research-flow','oos','Train / Validation / Test','investigate','system','holdoutを分離して非定常性・過学習を確認する。',40),
  ('test-trade-research-flow','decision','棄却 / 継続候補を判定','decision','mixed','結果が弱いStrategyは棄却し、条件を満たす候補だけ残す。',50),
  ('test-trade-research-flow','paper','Paper Tradingへ送る','execute','system','実資金を使わず将来期間で前向き検証する。',60),
  ('test-trade-research-flow','learn','研究結果・失敗知見を残す','reflect','mixed','採用だけでなく不採用理由・回避知見も研究資産として保存する。',70),

  ('sensoria-public-portfolio-flow','assets','活動・経歴・掲載実績','source','user','Journal/Works/プロフィール等の元Contentを持つ。',10),
  ('sensoria-public-portfolio-flow','curate','公開向けに編集・構成','transform','mixed','世界観と閲覧者目的に合わせてContentを整理する。',20),
  ('sensoria-public-portfolio-flow','site','Journal / Works / Media Kit','publish','system','SPAとして公開する。',30),
  ('sensoria-public-portfolio-flow','visitor','読者・編集者・協業候補が閲覧','touchpoint','external_actor','実績・プロフィール・世界観を理解する。',40),
  ('sensoria-public-portfolio-flow','cta','記事 / SNS / 問い合わせへ遷移','outcome','external_actor','外部媒体や連絡導線へ進む。',50),

  ('test-isn-approval-flow','edit','一般Userが変更を入力','human_action','user','追加/更新/削除を申請する。',10),
  ('test-isn-approval-flow','request','change_requestsにpending保存','record','system','本Dataを直接変えず申請として記録する。',20),
  ('test-isn-approval-flow','review','Adminが承認/却下','decision','user','権限者が内容とbase versionを確認する。',30),
  ('test-isn-approval-flow','apply','承認時だけAtomic Apply','execute','system','承認された変更のみ本Dataへ反映する。',40),
  ('test-isn-approval-flow','audit','Audit HistoryへSnapshot追記','record','system','変更Snapshotと誰が承認したかを保存する。',50),
  ('test-isn-approval-flow','view','最新Dataと履歴を閲覧','touchpoint','user','削除済み内容も履歴から確認できる。',60)
)
insert into flow.flow_steps (version_id,step_key,label,step_type,actor_type,description,sequence_hint)
select v.id,d.step_key,d.label,d.step_type,d.actor_type,d.description,d.seq
from defs d join flow.value_flows f on f.slug=d.flow_slug join flow.flow_versions v on v.flow_id=f.id and v.version_number=1
on conflict (version_id,step_key) do update set label=excluded.label,step_type=excluded.step_type,actor_type=excluded.actor_type,
 description=excluded.description,sequence_hint=excluded.sequence_hint,updated_at=now();

insert into flow.flow_edges (version_id,source_step_id,target_step_id,edge_type,label,source,confidence,verified_at)
select v.id,s1.id,s2.id,'system_data',null,'inventory-wave2',1.000,now()
from flow.value_flows f join flow.flow_versions v on v.flow_id=f.id and v.version_number=1
join flow.flow_steps s1 on s1.version_id=v.id
join flow.flow_steps s2 on s2.version_id=v.id and s2.sequence_hint=(select min(s3.sequence_hint) from flow.flow_steps s3 where s3.version_id=v.id and s3.sequence_hint>s1.sequence_hint)
where f.slug in ('data-gallery-vote-flow','todo-app-crud-flow','notion-script-enrichment-flow','test-trade-research-flow','sensoria-public-portfolio-flow','test-isn-approval-flow')
on conflict (version_id,source_step_id,target_step_id,edge_type) do nothing;

-- Reclassify edges that are primarily human/value hand-offs rather than machine transfers.
update flow.flow_edges e set edge_type='human_value', updated_at=now()
from flow.flow_steps s1, flow.flow_steps s2, flow.flow_versions v, flow.value_flows f
where e.source_step_id=s1.id and e.target_step_id=s2.id and e.version_id=v.id and v.flow_id=f.id
and (
  (f.slug='data-gallery-vote-flow' and s1.step_key='browse' and s2.step_key='vote') or
  (f.slug='notion-script-enrichment-flow' and s1.step_key='complete' and s2.step_key='dryrun') or
  (f.slug='notion-script-enrichment-flow' and s1.step_key='dryrun' and s2.step_key='write') or
  (f.slug='test-trade-research-flow' and s1.step_key='oos' and s2.step_key='decision') or
  (f.slug='sensoria-public-portfolio-flow' and s1.step_key='site' and s2.step_key='visitor') or
  (f.slug='sensoria-public-portfolio-flow' and s1.step_key='visitor' and s2.step_key='cta') or
  (f.slug='test-isn-approval-flow' and s1.step_key='request' and s2.step_key='review') or
  (f.slug='test-isn-approval-flow' and s1.step_key='review' and s2.step_key='apply')
);

with defs(flow_slug,step_key,product_slug,function_slug,role) as (
  values
  ('data-gallery-vote-flow','browse','data-gallery','ranked-gallery','primary'),
  ('data-gallery-vote-flow','route','data-gallery','vote-api','primary'),
  ('data-gallery-vote-flow','aggregate','data-gallery','vote-trigger-aggregation','primary'),
  ('todo-app-crud-flow','ui','todo-app','todo-frontend','primary'),
  ('todo-app-crud-flow','api','todo-app','todo-rest-api','primary'),
  ('notion-script-enrichment-flow','fetch','notion-script','fetch-missing-fields','primary'),
  ('notion-script-enrichment-flow','complete','notion-script','ai-field-completion','primary'),
  ('notion-script-enrichment-flow','write','notion-script','safe-notion-writeback','primary'),
  ('test-trade-research-flow','data','test-trade','research-data-ingestion','primary'),
  ('test-trade-research-flow','backtest','test-trade','strategy-backtesting','primary'),
  ('test-trade-research-flow','oos','test-trade','robustness-validation','primary'),
  ('test-trade-research-flow','paper','test-trade','paper-trading','primary'),
  ('sensoria-public-portfolio-flow','site','sensoria-portfolio','journal','primary'),
  ('sensoria-public-portfolio-flow','site','sensoria-portfolio','works-archive','primary'),
  ('sensoria-public-portfolio-flow','site','sensoria-portfolio','media-kit','primary'),
  ('test-isn-approval-flow','request','test-isn','change-request-workflow','primary'),
  ('test-isn-approval-flow','review','test-isn','admin-approval','primary'),
  ('test-isn-approval-flow','audit','test-isn','audit-history','primary')
)
insert into flow.flow_step_product_functions (step_id,product_function_id,role,source,confidence,verified_at)
select s.id,pf.id,d.role,'inventory-wave2',1.000,now()
from defs d join flow.value_flows f on f.slug=d.flow_slug join flow.flow_versions v on v.flow_id=f.id and v.version_number=1
join flow.flow_steps s on s.version_id=v.id and s.step_key=d.step_key
join registry.products p on p.slug=d.product_slug join registry.product_functions pf on pf.product_id=p.id and pf.slug=d.function_slug
on conflict (step_id,product_function_id,role) do nothing;

insert into flow.flow_step_products (step_id,product_id,role,source,confidence,verified_at)
select distinct s.id,p.id,'participant','inventory-wave2',1.000,now()
from flow.flow_step_product_functions spf join flow.flow_steps s on s.id=spf.step_id
join registry.product_functions pf on pf.id=spf.product_function_id join registry.products p on p.id=pf.product_id
on conflict (step_id,product_id,role) do nothing;

with defs(flow_slug,outcome_type,title,description,importance) as (
 values
 ('data-gallery-vote-flow','user_value','安全に作品へ投票できる','Browserへ秘密Keyを出さず投票と集計が成立する。',2),
 ('todo-app-crud-flow','learning','Frontend/Backend API境界を実装で理解する','2-repo構成でUIとREST APIの責務を分離した経験を残す。',2),
 ('notion-script-enrichment-flow','productivity','Notion補完作業をBatch化する','大量の空欄を1件ずつLLM/MCP処理せず再現可能なPipelineで補完する。',3),
 ('test-trade-research-flow','learning','採用だけでなく棄却知見を蓄積する','仮説が成立しないことも再利用可能な研究結果として残す。',4),
 ('sensoria-public-portfolio-flow','user_value','活動・実績を外部へ伝える','読者・編集者・協業候補が世界観と実績を一箇所で理解できる。',3),
 ('test-isn-approval-flow','governance','変更を承認・監査可能にする','誰が何を申請し誰が承認して何が変わったかを追跡できる。',3)
)
insert into flow.flow_outcomes (flow_id,outcome_type,title,description,importance)
select f.id,d.outcome_type,d.title,d.description,d.importance from defs d join flow.value_flows f on f.slug=d.flow_slug
where not exists (select 1 from flow.flow_outcomes o where o.flow_id=f.id and o.outcome_type=d.outcome_type and o.title=d.title);

commit;
