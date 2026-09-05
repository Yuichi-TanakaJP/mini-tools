-- Workspace Core V3 inventory expansion - Wave 2 / Origin context
-- Adds user-confirmed motivation plus Git/Notion evidence discovered during inventory.

begin;

-- Evidence resources: exact Notion DB and Git history that corroborate the current workflow.
with github as (select id from platform.source_systems where code='github'),
defs(external_id,resource_type,title,url,summary) as (
  values
    ('Yuichi-TanakaJP/notion-script:commit:64c4acc04db6a0cbfac4342b28d31dd91b3f046d','github_commit','notion-script initial project setup','https://github.com/Yuichi-TanakaJP/notion-script/commit/64c4acc04db6a0cbfac4342b28d31dd91b3f046d','2026-03-07: folder structure/shared lib/fill_memo_dbを置いた初期commit。'),
    ('Yuichi-TanakaJP/notion-script:commit:d15eaef6ced3957c60e2e31db10630747ed81d19','github_commit','notion-script 3-step pipeline refactor','https://github.com/Yuichi-TanakaJP/notion-script/commit/d15eaef6ced3957c60e2e31db10630747ed81d19','2026-03-07: fill_memo_dbからfetch/analyze/updateの3-step pipelineへ変更。'),
    ('Yuichi-TanakaJP/test_trade:commit:c3bb83c4ed4338f4366df4fe6d395075300e329d','github_commit','Test Trade: AI backtest動画2本から手法整理','https://github.com/Yuichi-TanakaJP/test_trade/commit/c3bb83c4ed4338f4366df4fe6d395075300e329d','2026-06-16: AI backtest動画2本の文字起こし・手法をresearch backlogへ取り込み。')
)
insert into registry.external_resources(source_system_id,external_id,resource_type,title,url,summary,status,last_synced_at)
select github.id,d.external_id,d.resource_type,d.title,d.url,d.summary,'active',now() from defs d cross join github
on conflict (source_system_id,external_id,resource_type) do update
set title=excluded.title,url=excluded.url,summary=excluded.summary,status=excluded.status,last_synced_at=excluded.last_synced_at,updated_at=now();

with notion as (select id from platform.source_systems where code='notion')
insert into registry.external_resources(source_system_id,external_id,resource_type,title,url,summary,status,last_synced_at)
select notion.id,'notion:226cae2d-86b8-80f8-801c-f207af0c7387','notion_database','Think / めも','https://app.notion.com/p/226cae2d86b880f8801cf207af0c7387','気になる概念や投資・技術用語等を蓄積するNotion DB。2026-09-05確認時207件。','active',now() from notion
on conflict (source_system_id,external_id,resource_type) do update
set title=excluded.title,url=excluded.url,summary=excluded.summary,status=excluded.status,last_synced_at=excluded.last_synced_at,updated_at=now();

-- User-confirmed origin / learning. These are first-person provenance, not inferred from code.
insert into knowledge.items(canonical_key,kind,title,statement,lifecycle_status,verification_status,source,confidence,verified_at)
values
 ('notion-script-manual-enrichment-burden','problem','Notionの未整理項目を人手で1件ずつ埋めるのが重い','OneNoteからNotionへ情報整理を移した後、気になる単語やメモの分類・要約・Field補完を1件ずつ行う運用が負担になった。','active','confirmed','user-confirmed',1.000,now()),
 ('notion-script-mcp-readwrite-discovery','insight','ClaudeとNotion MCPでAIから直接Read/Writeできる価値に気づいた','Claude ChatからNotionへ接続し、DBを読んで列や内容を更新できる体験が「AIからKnowledge Baseを操作する」発想の起点になった。','active','confirmed','user-confirmed',1.000,now()),
 ('notion-script-mcp-token-cost','problem','1件単位MCP処理はTokenと時間の効率が悪かった','多数の空欄をClaude Chat + MCPで1件ずつ補完すると、各操作の往復でToken消費と処理時間が大きくなり、Batch処理には向かなかった。','active','confirmed','user-confirmed',1.000,now()),
 ('notion-script-script-first-ai-second','principle','定型Data移動はScript/API、意味補完だけAIに寄せる','取得・整形・書戻しなど決定的にできる処理はScript/APIへ寄せ、AIは要約・分類など意味判断へ集中させることでToken節約と再現性を高める。','active','confirmed','user-confirmed',1.000,now()),
 ('notion-script-skill-orchestration-learning','goal','SkillをPromptではなくWorkflow orchestrationとして理解する','SkillにScript実行や手順を組み込み、同じ作業を再現可能にする使い方を試す学習機会としてNotion Scriptを使った。','active','confirmed','user-confirmed',1.000,now()),
 ('test-trade-youtube-to-verification','goal','YouTubeの投資手法を「真似する」から「検証する」へ変える','AIを使ったBacktest動画を見て、自分でもすぐ試せそうだと考え、利用可能なMarket Dataで再現・検証するResearchを始めた。','active','confirmed','user-confirmed',1.000,now()),
 ('test-trade-ideas-are-hypotheses','principle','外部の投資アイデアは仮説として扱いBacktestで確かめる','YouTubeやメモで得た手法をそのまま信じず、Data・Cost・Out-of-sample条件で成立するかを検証してから判断する。','active','confirmed','user-confirmed',1.000,now()),
 ('test-trade-data-length-limit','constraint','短いData期間では強い結論を出さない','J-Quants Free等の短期間Dataでは統計的確信が不足するため、有料Data/別Data源/将来期間の蓄積が必要になる。','active','confirmed','user-confirmed',1.000,now())
on conflict (canonical_key) do update
set kind=excluded.kind,title=excluded.title,statement=excluded.statement,lifecycle_status=excluded.lifecycle_status,
 verification_status=excluded.verification_status,source=excluded.source,confidence=excluded.confidence,verified_at=excluded.verified_at,updated_at=now();

with defs(item_key,product_slug,relation_type) as (
 values
 ('notion-script-manual-enrichment-burden','notion-script','motivates'),
 ('notion-script-mcp-readwrite-discovery','notion-script','origin_of'),
 ('notion-script-mcp-token-cost','notion-script','motivates'),
 ('notion-script-script-first-ai-second','notion-script','applies_to'),
 ('notion-script-skill-orchestration-learning','notion-script','realized_by'),
 ('test-trade-youtube-to-verification','test-trade','origin_of'),
 ('test-trade-ideas-are-hypotheses','test-trade','applies_to'),
 ('test-trade-data-length-limit','test-trade','constrains')
)
insert into knowledge.item_products(item_id,product_id,relation_type,source,confidence,verified_at)
select i.id,p.id,d.relation_type,'inventory-wave2-origin',1.000,now()
from defs d join knowledge.items i on i.canonical_key=d.item_key join registry.products p on p.slug=d.product_slug
on conflict (item_id,product_id,relation_type) do update set source=excluded.source,confidence=excluded.confidence,verified_at=excluded.verified_at,updated_at=now();

-- Link the scalable enrichment motivation to the actual Notion memo database.
insert into knowledge.item_resources(item_id,resource_id,relation_type,source,confidence,verified_at)
select i.id,r.id,'evidenced_by','inventory-wave2-origin',0.900,now()
from knowledge.items i join registry.external_resources r on r.external_id='notion:226cae2d-86b8-80f8-801c-f207af0c7387'
where i.canonical_key in ('notion-script-manual-enrichment-burden','notion-script-script-first-ai-second')
on conflict (item_id,resource_id,relation_type) do update set source=excluded.source,confidence=excluded.confidence,verified_at=excluded.verified_at,updated_at=now();

-- Evolution: user history + exact repository events.
with defs(event_type,title,summary,period_start,period_end,time_precision,verification_status,source,confidence) as (
 values
 ('workflow_changed','OneNoteからNotionへ情報整理基盤を移す','単純なNotebook/Section構造では参照・関連づけが難しく、Table/Databaseを使えるNotionへメモ整理を移した。',null::date,null::date,'unknown','confirmed','user-confirmed',1.000),
 ('idea_formed','Claude + Notion MCPでAIがKnowledge Baseを直接操作できると気づく','AIからNotionをRead/Writeできる体験で自動補完の可能性が見えた一方、1件単位処理のToken/時間Costが課題になった。',null::date,null::date,'unknown','confirmed','user-confirmed',1.000),
 ('experiment_started','Notion Script初期実装','Notion DB補完をScript化する初期Projectを開始。','2026-03-07'::date,'2026-03-07'::date,'day','confirmed','github-history',1.000),
 ('workflow_changed','Notion Scriptを3-step pipelineへ変更','単一fill scriptからfetch → AI analyze → updateへ責務分離し、dry-run可能な再現Workflowへ変えた。','2026-03-07'::date,'2026-03-07'::date,'day','confirmed','github-history',1.000),
 ('experiment_started','AI Backtest動画の手法をTest Tradeへ取り込む','AI backtest動画2本の手法と文字起こしを取り込み、主張をそのまま採用せず検証Method backlogとして整理した。','2026-06-16'::date,'2026-06-16'::date,'day','confirmed','github-history',1.000)
)
insert into knowledge.evolution_events(event_type,title,summary,period_start,period_end,time_precision,verification_status,source,confidence,verified_at)
select d.event_type,d.title,d.summary,d.period_start,d.period_end,d.time_precision,d.verification_status,d.source,d.confidence,now() from defs d
where not exists (select 1 from knowledge.evolution_events e where e.event_type=d.event_type and e.title=d.title and coalesce(e.period_start,'0001-01-01')=coalesce(d.period_start,'0001-01-01'));

with defs(title,product_slug,role) as (
 values
 ('OneNoteからNotionへ情報整理基盤を移す','notion-script','context'),
 ('Claude + Notion MCPでAIがKnowledge Baseを直接操作できると気づく','notion-script','cause'),
 ('Notion Script初期実装','notion-script','subject'),
 ('Notion Scriptを3-step pipelineへ変更','notion-script','subject'),
 ('AI Backtest動画の手法をTest Tradeへ取り込む','test-trade','subject')
)
insert into knowledge.evolution_event_products(event_id,product_id,role,source,confidence,verified_at)
select e.id,p.id,d.role,'inventory-wave2-origin',1.000,now() from defs d
join knowledge.evolution_events e on e.title=d.title join registry.products p on p.slug=d.product_slug
on conflict (event_id,product_id,role) do nothing;

with defs(title,external_id) as (
 values
 ('Notion Script初期実装','Yuichi-TanakaJP/notion-script:commit:64c4acc04db6a0cbfac4342b28d31dd91b3f046d'),
 ('Notion Scriptを3-step pipelineへ変更','Yuichi-TanakaJP/notion-script:commit:d15eaef6ced3957c60e2e31db10630747ed81d19'),
 ('AI Backtest動画の手法をTest Tradeへ取り込む','Yuichi-TanakaJP/test_trade:commit:c3bb83c4ed4338f4366df4fe6d395075300e329d')
)
insert into knowledge.evolution_event_resources(event_id,resource_id,relation_type,notes)
select e.id,r.id,'evidence','Exact repository history' from defs d
join knowledge.evolution_events e on e.title=d.title join registry.external_resources r on r.external_id=d.external_id
on conflict (event_id,resource_id,relation_type) do nothing;

commit;
