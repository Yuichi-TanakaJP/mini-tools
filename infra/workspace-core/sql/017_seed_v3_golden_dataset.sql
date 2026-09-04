-- Workspace Core V3
-- Reviewed Golden Dataset seed.
--
-- Scope:
--   1. YouTube -> LINE -> MiniTools / Stock Notes decision flow
--   2. Dividend-app inspiration -> proposed dividend feedback flow
--   3. Yutai cross origin and decision-support flow
--   4. RAG Workbench capability learning
--   5. Market Info manual pain -> automation -> AI-development evolution
--   6. Test English friction -> OCR/PWA flow
--
-- Principles:
--   - confirmed implementation facts use repository evidence
--   - personal origin/history uses Personal Log pointers, not copied raw bodies
--   - unimplemented dividend functionality stays an Idea + proposed Flow, not an active Product Function
--   - approximate dates remain bounded/approximate
--   - inserts are designed to be safe to replay

begin;

-- ---------------------------------------------------------------------------
-- External-resource pointers
-- ---------------------------------------------------------------------------

with supabase_source as (
  select id from platform.source_systems where code = 'supabase'
)
insert into registry.external_resources (
  source_system_id, external_id, resource_type, title, summary, status, metadata
)
select
  supabase_source.id,
  v.external_id,
  'personal_log_entry',
  v.title,
  v.summary,
  'active',
  v.metadata
from supabase_source
cross join (values
  (
    'uqnkjitvuebwhjvmaddb:public:personal_log_entries:435b04a0-6355-404e-b19b-48111bd98802',
    'Market Infoの起源とAI開発手段の進化',
    '小型株探索の手作業負荷からMarket Info自動化を始め、ChatGPT/Cursor、Codex、Claude Codeへ開発手段が進化した経緯。',
    jsonb_build_object('project_ref','uqnkjitvuebwhjvmaddb','schema','public','table','personal_log_entries','row_id','435b04a0-6355-404e-b19b-48111bd98802')
  ),
  (
    'uqnkjitvuebwhjvmaddb:public:personal_log_entries:9db7c7eb-03b4-4d1b-8161-3fb0c0c0163d',
    'Test Englishの起源',
    '音声学習は可能だが聞き取れない箇所のテキスト確認が面倒という摩擦から、OCRとスマホ向けWeb/PWA化を着想した経緯。',
    jsonb_build_object('project_ref','uqnkjitvuebwhjvmaddb','schema','public','table','personal_log_entries','row_id','9db7c7eb-03b4-4d1b-8161-3fb0c0c0163d')
  ),
  (
    'uqnkjitvuebwhjvmaddb:public:personal_log_entries:1d441c8f-4170-457a-ba59-8b4478740c64',
    '外部情報を自分の課題へ接続する開発スタイル',
    '外部刺激を自分の課題へ適用し、実験・実装・利用・改善・Capability蓄積へつなげる開発スタイル。',
    jsonb_build_object('project_ref','uqnkjitvuebwhjvmaddb','schema','public','table','personal_log_entries','row_id','1d441c8f-4170-457a-ba59-8b4478740c64')
  ),
  (
    'uqnkjitvuebwhjvmaddb:public:personal_log_entries:0e38ec01-09e9-4d63-8a4e-34f257df4592',
    '配当金アプリから得た価値と機能着想',
    '年間配当予測・非課税口座・増配寄与の可視化が、高配当投資の積み上がり実感と継続を支えたという記録。',
    jsonb_build_object('project_ref','uqnkjitvuebwhjvmaddb','schema','public','table','personal_log_entries','row_id','0e38ec01-09e9-4d63-8a4e-34f257df4592')
  ),
  (
    'uqnkjitvuebwhjvmaddb:public:personal_log_entries:517adf19-4de8-4e4f-aeda-3000febfb8bf',
    '優待クロスを知人・既存アプリから学び自作へ発展させた経緯',
    '知人から一般信用期間差などを学び、既存優待アプリの一覧性に刺激を受け、Market InfoとMiniToolsで自作支援基盤へ発展した経緯。',
    jsonb_build_object('project_ref','uqnkjitvuebwhjvmaddb','schema','public','table','personal_log_entries','row_id','517adf19-4de8-4e4f-aeda-3000febfb8bf')
  )
) as v(external_id, title, summary, metadata)
on conflict (source_system_id, external_id, resource_type) do update
set title = excluded.title,
    summary = excluded.summary,
    status = excluded.status,
    metadata = excluded.metadata,
    updated_at = now();

with github_source as (
  select id from platform.source_systems where code = 'github'
)
insert into registry.external_resources (
  source_system_id, external_id, resource_type, title, url, summary, status, metadata
)
select
  github_source.id,
  v.external_id,
  'repository_document',
  v.title,
  v.url,
  v.summary,
  'active',
  v.metadata
from github_source
cross join (values
  (
    'Yuichi-TanakaJP/test_line_news:README.md@main',
    'test_line_news README',
    'https://github.com/Yuichi-TanakaJP/test_line_news/blob/main/README.md',
    'Web/YouTube/disclosure researchをLLMで整形しLINEへ送る汎用パイプラインの正本説明。',
    jsonb_build_object('repository','Yuichi-TanakaJP/test_line_news','path','README.md','ref','main')
  ),
  (
    'Yuichi-TanakaJP/rag-workbench:README.md@master',
    'rag-workbench README',
    'https://github.com/Yuichi-TanakaJP/rag-workbench/blob/master/README.md',
    'collect→chunk→embed→upsert→search/retrieveのRAG実験構成。',
    jsonb_build_object('repository','Yuichi-TanakaJP/rag-workbench','path','README.md','ref','master')
  ),
  (
    'Yuichi-TanakaJP/test_english:README.md@main',
    'test_english README',
    'https://github.com/Yuichi-TanakaJP/test_english/blob/main/README.md',
    '紙教材をGemini OCRで構造化し、静的PWAを生成してCloudflare Pagesへ配信するパイプライン。',
    jsonb_build_object('repository','Yuichi-TanakaJP/test_english','path','README.md','ref','main')
  ),
  (
    'Yuichi-TanakaJP/market_info:docs/architecture.md@main',
    'Market Info architecture',
    'https://github.com/Yuichi-TanakaJP/market_info/blob/main/docs/architecture.md',
    'market_info→R2→market-info-api→mini-toolsの責務境界とデータ供給経路。',
    jsonb_build_object('repository','Yuichi-TanakaJP/market_info','path','docs/architecture.md','ref','main')
  )
) as v(external_id, title, url, summary, metadata)
on conflict (source_system_id, external_id, resource_type) do update
set title = excluded.title,
    url = excluded.url,
    summary = excluded.summary,
    status = excluded.status,
    metadata = excluded.metadata,
    updated_at = now();

-- ---------------------------------------------------------------------------
-- Product Functions
-- ---------------------------------------------------------------------------

with defs(product_slug, function_slug, name, description, function_type, lifecycle_status, is_user_facing, evidence_uri) as (
  values
    ('market-info','ranking-acquisition','市場ランキング取得','市場別の値上がり・値下がり・出来高ランキングを取得する。','pipeline','active',false,'https://github.com/Yuichi-TanakaJP/market_info/blob/main/docs/architecture.md'),
    ('market-info','market-normalization','市場データ正規化','取得したランキング・指数・業種等を再利用可能なデータへ整形する。','pipeline','active',false,'https://github.com/Yuichi-TanakaJP/market_info/blob/main/docs/architecture.md'),
    ('market-info','r2-publishing','R2公開','JSON等の成果物をCloudflare R2へ公開して下流へ供給する。','pipeline','active',false,'https://github.com/Yuichi-TanakaJP/market_info/blob/main/docs/architecture.md'),
    ('test-line-news','youtube-new-video-detection','YouTube新着検知','チャンネルRSSから新着動画を検知する。','automation','active',false,'https://github.com/Yuichi-TanakaJP/test_line_news/blob/main/README.md'),
    ('test-line-news','youtube-transcript-acquisition','YouTube字幕取得','対象動画の字幕を取得する。','pipeline','active',false,'https://github.com/Yuichi-TanakaJP/test_line_news/blob/main/README.md'),
    ('test-line-news','youtube-investment-extraction','投資情報抽出','字幕から投資判断に必要な銘柄・市場・優待等の情報を目的別に構造化する。','workflow','active',false,'https://github.com/Yuichi-TanakaJP/test_line_news/blob/main/README.md'),
    ('test-line-news','line-delivery','LINE配信','生成したメモをLINE Messaging APIでPushする。','automation','active',true,'https://github.com/Yuichi-TanakaJP/test_line_news/blob/main/README.md'),
    ('mini-tools','yutai-dashboard','優待ダッシュボード','月次候補、信用可否、仕込み、クロス戦略、実績を統合して確認する。','interface','active',true,'https://github.com/Yuichi-TanakaJP/mini-tools/blob/main/docs/plans/yutai-dashboard-plan.md'),
    ('mini-tools','stock-notes-dashboard','銘柄分析ダッシュボード','Stock Notesの分析・見立て・要対応・アクションを俯瞰する。','interface','active',true,'https://github.com/Yuichi-TanakaJP/mini-tools/blob/main/docs/specs/tools/stock-notes.md'),
    ('rag-workbench','rag-ingest','RAG ingest','ファイル収集、チャンク分割、埋め込み、Qdrant登録を行う。','pipeline','active',false,'https://github.com/Yuichi-TanakaJP/rag-workbench/blob/master/README.md'),
    ('rag-workbench','rag-retrieval','RAG retrieval','ベクトル検索と質問向け文脈取得を行う。','workflow','active',true,'https://github.com/Yuichi-TanakaJP/rag-workbench/blob/master/README.md'),
    ('test-english','material-ocr','教材OCR','撮影した英語教材をGemini APIでOCRし構造化JSONへ変換する。','pipeline','active',false,'https://github.com/Yuichi-TanakaJP/test_english/blob/main/README.md'),
    ('test-english','vocabulary-normalization','語彙正規化','OCR結果の表記ゆれ・発音記号・Lesson構造を整形する。','pipeline','active',false,'https://github.com/Yuichi-TanakaJP/test_english/blob/main/README.md'),
    ('test-english','pwa-build-publish','学習PWA生成・公開','語彙データから静的PWAを生成しCloudflare Pagesへ配信する。','pipeline','active',true,'https://github.com/Yuichi-TanakaJP/test_english/blob/main/README.md')
)
insert into registry.product_functions (
  product_id, slug, name, description, function_type, lifecycle_status,
  is_user_facing, source, confidence, evidence_uri, verified_at
)
select
  p.id, d.function_slug, d.name, d.description, d.function_type, d.lifecycle_status,
  d.is_user_facing, 'golden-dataset-review', 1.000, d.evidence_uri, '2026-09-04T14:00:00Z'
from defs d
join registry.products p on p.slug = d.product_slug
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
-- Capability masters + evidence-backed Product links
-- ---------------------------------------------------------------------------

insert into registry.capabilities (slug, name, description, category)
values
  ('authenticated-web-data-acquisition','認証付きWebデータ取得','ログイン状態や認証制約を含むWebサイトから必要範囲のデータを安定取得する。','automation'),
  ('browser-automation','ブラウザ自動化','ブラウザ操作・DOM取得・セッション維持を自動化する。','automation'),
  ('market-data-normalization','市場データ正規化','異なる市場データを再利用可能な構造へ整形する。','data'),
  ('scheduled-data-pipeline','定期データパイプライン','収集・変換・公開を定期運用する。','data'),
  ('purpose-specific-llm-extraction','目的別LLM情報抽出','長文・字幕から利用目的に合わせた構造化情報を抽出する。','ai'),
  ('feed-monitoring','Feed/RSS監視','Feedから新着を検知し状態管理する。','automation'),
  ('push-notification-orchestration','Push通知オーケストレーション','情報生成からLINE等のPush配信までを運用する。','automation'),
  ('multi-source-investment-integration','投資データ統合','複数ソースの市場・信用・優待等を意思決定画面へ統合する。','data'),
  ('decision-support-dashboard-design','意思決定支援ダッシュボード設計','表示そのものではなく次の判断・行動を支える画面を設計する。','product'),
  ('rag-pipeline-design','RAGパイプライン設計','収集・chunk・embedding・vector store・retrievalを構成する。','ai'),
  ('vector-retrieval','ベクトル検索・文脈取得','埋め込みとVector DBを使って関連文脈を取得する。','ai'),
  ('ocr-content-structuring','OCRコンテンツ構造化','画像/紙資料をOCRし後続利用できる構造へ変換する。','ai'),
  ('static-pwa-publishing','静的PWA生成・公開','構造化データからスマホ向け静的PWAを生成・公開する。','frontend'),
  ('ai-assisted-iterative-development','AI支援反復開発','AIレビュー・実装エージェントを段階的に取り入れ、実装と修正を反復する。','development')
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    updated_at = now();

with defs(product_slug, capability_slug, relation_type, evidence_uri, notes) as (
  values
    ('market-info','authenticated-web-data-acquisition','develops','https://github.com/Yuichi-TanakaJP/market_info/blob/main/docs/architecture.md','認証・セッションを含む市場データ取得で反復利用。'),
    ('market-info','browser-automation','develops','https://github.com/Yuichi-TanakaJP/market_info/blob/main/docs/architecture.md','Playwrightベースの取得運用。'),
    ('market-info','market-data-normalization','demonstrates','https://github.com/Yuichi-TanakaJP/market_info/blob/main/docs/architecture.md','複数市場データの整形と公開。'),
    ('market-info','scheduled-data-pipeline','demonstrates','https://github.com/Yuichi-TanakaJP/market_info/blob/main/docs/architecture.md','日次データ供給基盤として運用。'),
    ('market-info','ai-assisted-iterative-development','develops',null,'Personal Logに開発手段の進化履歴あり。'),
    ('test-line-news','purpose-specific-llm-extraction','demonstrates','https://github.com/Yuichi-TanakaJP/test_line_news/blob/main/README.md','字幕を投資用途別に構造化。'),
    ('test-line-news','feed-monitoring','demonstrates','https://github.com/Yuichi-TanakaJP/test_line_news/blob/main/README.md','YouTubeチャンネルRSSを監視。'),
    ('test-line-news','push-notification-orchestration','demonstrates','https://github.com/Yuichi-TanakaJP/test_line_news/blob/main/README.md','LLM生成結果をLINEへPush。'),
    ('mini-tools','multi-source-investment-integration','demonstrates','https://github.com/Yuichi-TanakaJP/mini-tools/blob/main/docs/plans/yutai-dashboard-plan.md','優待候補・信用・戦略・実績を統合。'),
    ('mini-tools','decision-support-dashboard-design','develops','https://github.com/Yuichi-TanakaJP/mini-tools/blob/main/docs/specs/tools/stock-notes.md','要対応・次アクション中心の情報設計。'),
    ('rag-workbench','rag-pipeline-design','develops','https://github.com/Yuichi-TanakaJP/rag-workbench/blob/master/README.md','RAGの一連のpipelineを実装。'),
    ('rag-workbench','vector-retrieval','develops','https://github.com/Yuichi-TanakaJP/rag-workbench/blob/master/README.md','Qdrant/FastEmbedによるretrieval。'),
    ('test-english','ocr-content-structuring','demonstrates','https://github.com/Yuichi-TanakaJP/test_english/blob/main/README.md','Gemini OCRから構造化JSONを生成。'),
    ('test-english','static-pwa-publishing','demonstrates','https://github.com/Yuichi-TanakaJP/test_english/blob/main/README.md','静的PWAをCloudflare Pagesへ公開。')
)
insert into registry.product_capabilities (
  product_id, capability_id, relation_type, source, confidence, evidence_uri, verified_at, notes
)
select
  p.id, c.id, d.relation_type, 'golden-dataset-review',
  case when d.evidence_uri is null then 0.950 else 1.000 end,
  d.evidence_uri, '2026-09-04T14:00:00Z', d.notes
from defs d
join registry.products p on p.slug = d.product_slug
join registry.capabilities c on c.slug = d.capability_slug
on conflict (product_id, capability_id, relation_type) do update
set source = excluded.source,
    confidence = excluded.confidence,
    evidence_uri = excluded.evidence_uri,
    verified_at = excluded.verified_at,
    notes = excluded.notes,
    updated_at = now();

with defs(capability_slug, technology_slug, relation_type) as (
  values
    ('authenticated-web-data-acquisition','playwright','implemented_with'),
    ('authenticated-web-data-acquisition','python','implemented_with'),
    ('browser-automation','playwright','implemented_with'),
    ('market-data-normalization','python','implemented_with'),
    ('market-data-normalization','pandas','implemented_with'),
    ('scheduled-data-pipeline','python','implemented_with'),
    ('rag-pipeline-design','python','implemented_with'),
    ('rag-pipeline-design','fastembed','implemented_with'),
    ('rag-pipeline-design','qdrant-client','implemented_with'),
    ('vector-retrieval','fastembed','implemented_with'),
    ('vector-retrieval','qdrant-client','implemented_with'),
    ('static-pwa-publishing','javascript','implemented_with')
)
insert into registry.capability_technologies (
  capability_id, technology_id, relation_type, source, confidence, verified_at
)
select c.id, t.id, d.relation_type, 'golden-dataset-review', 1.000, '2026-09-04T14:00:00Z'
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
    ('authenticated-web-data-acquisition','repeated','user-history-review',0.950,'Market Infoで認証付き取得を継続運用している。'),
    ('browser-automation','repeated','artifact-review',1.000,'Market InfoでPlaywrightを継続利用。'),
    ('market-data-normalization','repeated','artifact-review',1.000,'日次市場データを複数形式へ整形し供給。'),
    ('scheduled-data-pipeline','repeated','artifact-review',1.000,'Market Infoの日次運用として成立。'),
    ('purpose-specific-llm-extraction','repeated','artifact-review',1.000,'複数YouTube profileで目的別抽出を反復。'),
    ('feed-monitoring','repeated','artifact-review',1.000,'複数チャンネルRSS監視として運用。'),
    ('push-notification-orchestration','repeated','artifact-review',1.000,'LINE送信を日次パイプラインで運用。'),
    ('multi-source-investment-integration','applied','artifact-review',1.000,'Yutai Dashboardで複数データを統合表示。'),
    ('decision-support-dashboard-design','applied','artifact-review',1.000,'Stock Notes/Yutai等で意思決定支援UIを実装。'),
    ('rag-pipeline-design','experimental','artifact-review',1.000,'RAG Workbenchで実験用pipelineを実装。'),
    ('vector-retrieval','experimental','artifact-review',1.000,'Qdrant検索と文脈取得を実装。'),
    ('ocr-content-structuring','applied','artifact-review',1.000,'Test Englishで教材OCR pipelineを実装。'),
    ('static-pwa-publishing','applied','artifact-review',1.000,'Test EnglishをCloudflare Pagesへ公開。'),
    ('ai-assisted-iterative-development','repeated','user-history-review',0.950,'ChatGPT/CursorからCodex・Claude Codeへ開発手段を段階的に拡張し複数Productで利用。')
)
insert into registry.capability_assessments (
  capability_id, stage, assessed_at, source, confidence, rationale
)
select c.id, d.stage, '2026-09-04T14:00:00Z', d.source, d.confidence, d.rationale
from defs d
join registry.capabilities c on c.slug = d.capability_slug
where not exists (
  select 1 from registry.capability_assessments ca
  where ca.capability_id = c.id
    and ca.stage = d.stage
    and ca.assessed_at = '2026-09-04T14:00:00Z'
    and ca.source = d.source
);

-- ---------------------------------------------------------------------------
-- Canonical Knowledge Items
-- ---------------------------------------------------------------------------

insert into knowledge.items (
  canonical_key, kind, title, statement, lifecycle_status, verification_status,
  source, confidence, verified_at
)
values
  ('market-info-find-emerging-stocks','goal','将来注目される銘柄を早めに見つける','市場ごとの特徴に合わせた観察軸を使い、これから注目される銘柄を早期に見つけたい。','active','confirmed','user-stated',1.000,'2026-09-04T14:00:00Z'),
  ('growth-volume-signal-hypothesis','hypothesis','グロース市場では出来高の継続変化を重視する','小型株では単日の値幅より、出来高が徐々に増える変化の方が継続的な関心や仕込みの兆候を捉える材料になり得る。','active','provisional','user-hypothesis',0.850,'2026-09-04T14:00:00Z'),
  ('market-info-manual-ranking-pain','problem','市場ランキングの毎日手作業集計が重い','内藤証券の複数ランキングを何十回もクリック・コピーしてExcelへ集約する作業が毎日約30分かかり、継続負荷が高かった。','active','confirmed','user-stated',1.000,'2026-09-04T14:00:00Z'),
  ('responsible-data-acquisition','principle','必要範囲に限定した責任あるデータ取得','外部サイトからのデータ取得は、必要性・取得量・利用条件を意識し、過剰取得を避ける。','active','confirmed','user-stated',1.000,'2026-09-04T14:00:00Z'),
  ('external-inspiration-to-problem-solving','principle','外部の刺激を自分の課題へ接続する','X・YouTube・ニュース・他アプリ・人から得た事例を、自分の現実の課題へ適用し、実験・実装・改善・再利用へつなげる。','active','confirmed','user-stated',1.000,'2026-09-04T14:00:00Z'),
  ('english-text-check-friction','problem','英語音声学習でテキスト確認の摩擦が高い','移動中に音声は聞けても、聞き取れない箇所のテキスト確認が面倒で補正学習が止まりやすい。','active','confirmed','user-stated',1.000,'2026-09-04T14:00:00Z'),
  ('english-ocr-pwa-idea','idea','紙教材をOCRしてスマホ向け学習PWAにする','紙教材をOCRで構造化し、語彙・例文等をスマホで素早く確認できるWeb/PWAへ変換する。','active','confirmed','user-stated-and-implemented',1.000,'2026-09-04T14:00:00Z'),
  ('youtube-investment-push-idea','idea','投資YouTubeを判断材料へ圧縮してLINEへPushする','YouTube字幕を目的別の投資情報へ変換し、LINEという日常TouchpointへPushする。','active','confirmed','artifact-verified',1.000,'2026-09-04T14:00:00Z'),
  ('line-mini-tools-handoff-gap','problem','LINEからMiniTools/Stock Notesへの文脈引き継ぎが弱い','LINEで気づいた後、銘柄や理由を人間が覚えてMiniToolsやStock Notesへ移る必要があり、システム間Handoffが切れている。','active','confirmed','user-confirmed',1.000,'2026-09-04T14:00:00Z'),
  ('dividend-progress-feedback-value','value','配当の成長実感が長期投資継続を支える','年間配当が数千円から数万円、十万円単位へ育つ可視化は、高配当投資を継続する実感とモチベーションになる。','active','confirmed','user-stated',1.000,'2026-09-04T14:00:00Z'),
  ('mini-tools-dividend-projection-idea','idea','MiniToolsで年間配当予測と増配寄与を可視化する','保有数量・口座税区分・予想配当から年間受取予測を計算し、増配による前年差等も確認できるようにしたい。','active','provisional','user-idea',0.950,'2026-09-04T14:00:00Z'),
  ('yutai-credit-window-insight','insight','証券会社ごとの一般信用期間差がクロス戦略を変える','一般信用を建てられる期間が証券会社ごとに異なるため、当月勝負・数ヶ月前仕込み等の戦略選択が変わる。','active','confirmed','user-learned',1.000,'2026-09-04T14:00:00Z'),
  ('yutai-existing-app-friction','problem','既存優待アプリは自分向けに十分カスタマイズできない','既存アプリの一覧性は有用だが、広告やカスタマイズ制約があり、自分の戦略・データを統合した運用には不足があった。','active','confirmed','user-stated',1.000,'2026-09-04T14:00:00Z'),
  ('yutai-integrated-dashboard-goal','goal','優待候補・信用・費用・仕込み・実績を統合する','月次優待候補と証券会社別信用情報、効率、取得費用、仕込み、実績を一つの自分用ダッシュボードで判断できるようにする。','active','confirmed','user-stated-and-implemented',1.000,'2026-09-04T14:00:00Z'),
  ('rag-learn-by-building','goal','RAGを実装して仕組みを理解する','collect・chunk・embed・vector store・retrieveを実装し、RAGの構成と検索品質を検証する。','active','confirmed','artifact-verified',1.000,'2026-09-04T14:00:00Z')
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

-- Item -> Product links
with defs(item_key, product_slug, relation_type) as (
  values
    ('market-info-find-emerging-stocks','market-info','motivates'),
    ('growth-volume-signal-hypothesis','market-info','informs'),
    ('market-info-manual-ranking-pain','market-info','motivates'),
    ('responsible-data-acquisition','market-info','constrains'),
    ('external-inspiration-to-problem-solving','market-info','applies_to'),
    ('external-inspiration-to-problem-solving','test-line-news','applies_to'),
    ('external-inspiration-to-problem-solving','mini-tools','applies_to'),
    ('english-text-check-friction','test-english','motivates'),
    ('english-ocr-pwa-idea','test-english','origin_of'),
    ('youtube-investment-push-idea','test-line-news','origin_of'),
    ('line-mini-tools-handoff-gap','mini-tools','applies_to'),
    ('line-mini-tools-handoff-gap','stock-notes','applies_to'),
    ('dividend-progress-feedback-value','mini-tools','motivates'),
    ('mini-tools-dividend-projection-idea','mini-tools','applies_to'),
    ('yutai-credit-window-insight','mini-tools','informs'),
    ('yutai-existing-app-friction','mini-tools','motivates'),
    ('yutai-integrated-dashboard-goal','mini-tools','realized_by'),
    ('rag-learn-by-building','rag-workbench','motivates')
)
insert into knowledge.item_products (item_id, product_id, relation_type, source, confidence, verified_at)
select i.id, p.id, d.relation_type, 'golden-dataset-review', 1.000, '2026-09-04T14:00:00Z'
from defs d
join knowledge.items i on i.canonical_key = d.item_key
join registry.products p on p.slug = d.product_slug
on conflict (item_id, product_id, relation_type) do update
set source = excluded.source,
    confidence = excluded.confidence,
    verified_at = excluded.verified_at,
    updated_at = now();

-- Item -> Product Function links
with defs(item_key, product_slug, function_slug, relation_type) as (
  values
    ('market-info-manual-ranking-pain','market-info','ranking-acquisition','addresses'),
    ('growth-volume-signal-hypothesis','market-info','ranking-acquisition','informs'),
    ('responsible-data-acquisition','market-info','ranking-acquisition','constrains'),
    ('english-ocr-pwa-idea','test-english','material-ocr','realized_by'),
    ('english-ocr-pwa-idea','test-english','pwa-build-publish','realized_by'),
    ('youtube-investment-push-idea','test-line-news','youtube-investment-extraction','realized_by'),
    ('youtube-investment-push-idea','test-line-news','line-delivery','realized_by'),
    ('yutai-credit-window-insight','mini-tools','yutai-dashboard','informs'),
    ('yutai-integrated-dashboard-goal','mini-tools','yutai-dashboard','realized_by')
)
insert into knowledge.item_product_functions (
  item_id, product_function_id, relation_type, source, confidence, verified_at
)
select i.id, pf.id, d.relation_type, 'golden-dataset-review', 1.000, '2026-09-04T14:00:00Z'
from defs d
join knowledge.items i on i.canonical_key = d.item_key
join registry.products p on p.slug = d.product_slug
join registry.product_functions pf on pf.product_id = p.id and pf.slug = d.function_slug
on conflict (item_id, product_function_id, relation_type) do update
set source = excluded.source,
    confidence = excluded.confidence,
    verified_at = excluded.verified_at,
    updated_at = now();

-- Item -> Resource provenance
with defs(item_key, external_id, relation_type) as (
  values
    ('market-info-find-emerging-stocks','uqnkjitvuebwhjvmaddb:public:personal_log_entries:435b04a0-6355-404e-b19b-48111bd98802','evidenced_by'),
    ('growth-volume-signal-hypothesis','uqnkjitvuebwhjvmaddb:public:personal_log_entries:435b04a0-6355-404e-b19b-48111bd98802','evidenced_by'),
    ('market-info-manual-ranking-pain','uqnkjitvuebwhjvmaddb:public:personal_log_entries:435b04a0-6355-404e-b19b-48111bd98802','evidenced_by'),
    ('responsible-data-acquisition','uqnkjitvuebwhjvmaddb:public:personal_log_entries:435b04a0-6355-404e-b19b-48111bd98802','evidenced_by'),
    ('external-inspiration-to-problem-solving','uqnkjitvuebwhjvmaddb:public:personal_log_entries:1d441c8f-4170-457a-ba59-8b4478740c64','evidenced_by'),
    ('english-text-check-friction','uqnkjitvuebwhjvmaddb:public:personal_log_entries:9db7c7eb-03b4-4d1b-8161-3fb0c0c0163d','evidenced_by'),
    ('english-ocr-pwa-idea','uqnkjitvuebwhjvmaddb:public:personal_log_entries:9db7c7eb-03b4-4d1b-8161-3fb0c0c0163d','evidenced_by'),
    ('english-ocr-pwa-idea','Yuichi-TanakaJP/test_english:README.md@main','evidenced_by'),
    ('youtube-investment-push-idea','Yuichi-TanakaJP/test_line_news:README.md@main','evidenced_by'),
    ('dividend-progress-feedback-value','uqnkjitvuebwhjvmaddb:public:personal_log_entries:0e38ec01-09e9-4d63-8a4e-34f257df4592','evidenced_by'),
    ('mini-tools-dividend-projection-idea','uqnkjitvuebwhjvmaddb:public:personal_log_entries:0e38ec01-09e9-4d63-8a4e-34f257df4592','evidenced_by'),
    ('yutai-credit-window-insight','uqnkjitvuebwhjvmaddb:public:personal_log_entries:517adf19-4de8-4e4f-aeda-3000febfb8bf','evidenced_by'),
    ('yutai-existing-app-friction','uqnkjitvuebwhjvmaddb:public:personal_log_entries:517adf19-4de8-4e4f-aeda-3000febfb8bf','evidenced_by'),
    ('yutai-integrated-dashboard-goal','uqnkjitvuebwhjvmaddb:public:personal_log_entries:517adf19-4de8-4e4f-aeda-3000febfb8bf','evidenced_by'),
    ('rag-learn-by-building','Yuichi-TanakaJP/rag-workbench:README.md@master','evidenced_by')
)
insert into knowledge.item_resources (
  item_id, resource_id, relation_type, source, confidence, verified_at
)
select i.id, r.id, d.relation_type, 'golden-dataset-review', 1.000, '2026-09-04T14:00:00Z'
from defs d
join knowledge.items i on i.canonical_key = d.item_key
join registry.external_resources r on r.external_id = d.external_id
on conflict (item_id, resource_id, relation_type) do update
set source = excluded.source,
    confidence = excluded.confidence,
    verified_at = excluded.verified_at,
    updated_at = now();

-- Selected semantic relations
with defs(source_key, target_key, relation_type, rationale) as (
  values
    ('market-info-manual-ranking-pain','market-info-find-emerging-stocks','motivates','手作業で続けていた探索目的を失わず自動化する必要があった。'),
    ('growth-volume-signal-hypothesis','market-info-find-emerging-stocks','informs','市場別の観察軸を決める仮説。'),
    ('dividend-progress-feedback-value','mini-tools-dividend-projection-idea','motivates','機能そのものより投資継続のフィードバック価値が起点。'),
    ('yutai-credit-window-insight','yutai-integrated-dashboard-goal','informs','証券会社差を一覧化・戦略化する必要性につながる。'),
    ('yutai-existing-app-friction','yutai-integrated-dashboard-goal','motivates','既存アプリの制約が自作統合画面の動機。'),
    ('english-text-check-friction','english-ocr-pwa-idea','motivates','確認摩擦を減らすためOCR/PWA化を着想。')
)
insert into knowledge.item_relations (
  source_item_id, target_item_id, relation_type, rationale, source, confidence, verified_at
)
select s.id, t.id, d.relation_type, d.rationale, 'golden-dataset-review', 1.000, '2026-09-04T14:00:00Z'
from defs d
join knowledge.items s on s.canonical_key = d.source_key
join knowledge.items t on t.canonical_key = d.target_key
on conflict (source_item_id, target_item_id, relation_type) do update
set rationale = excluded.rationale,
    source = excluded.source,
    confidence = excluded.confidence,
    verified_at = excluded.verified_at,
    updated_at = now();

-- ---------------------------------------------------------------------------
-- Evolution / History
-- ---------------------------------------------------------------------------

with defs(event_type, title, summary, period_start, period_end, time_precision, verification_status, source, confidence) as (
  values
    ('origin','Market Info自動化の起点','小型株探索のため毎日手作業していたランキング収集を自動化したいという課題からMarket Infoが始まった。','2025-09-01'::date,'2025-09-30'::date,'month','confirmed','user-history-review',0.850),
    ('experiment_started','ChatGPT→Cursorコピペ型で自動化開発を開始','AIが出したコードをエディタへ貼り、実行エラーを会話で直す反復から開始した。','2025-09-01'::date,'2025-09-30'::date,'month','confirmed','user-history-review',0.850),
    ('technology_adopted','Codexを開発へ導入','当初はレビュー中心で距離を置いたが、段階的に実装へ使うようになった。','2025-12-01'::date,'2025-12-31'::date,'month','provisional','user-history-review',0.700),
    ('workflow_changed','Codexへ実装を任せる比率が上昇','レビュー補助から、実際に使えるコードを任せる開発スタイルへ移行した。','2025-12-01'::date,'2026-02-28'::date,'range','provisional','user-history-review',0.700),
    ('technology_adopted','Claude Codeを開発へ導入','Codex以外の主要Coding AgentとしてClaude Codeを試し、現在の複数Agent活用へつながった。','2026-03-01'::date,'2026-03-31'::date,'month','confirmed','user-history-review',0.850),
    ('origin','優待クロスの実践知を知人から得る','証券会社ごとの一般信用期間差など、実運用上重要な戦略差を知人から学んだ。',null,null,'unknown','confirmed','user-history-review',1.000),
    ('idea_formed','既存優待アプリを見て自作統合画面を着想','月次優待・一般信用可否を一覧化する既存アプリに価値を感じつつ、広告・カスタマイズ制約から自作を考えた。',null,null,'unknown','confirmed','user-history-review',1.000),
    ('experiment_started','RAG WorkbenchでRAG構成を実装検証','collect→chunk→embed→Qdrant→retrieveを小さな実験環境として実装した。',null,null,'unknown','confirmed','artifact-review',1.000),
    ('origin','Test Englishはテキスト確認摩擦から始まった','音声学習中に聞き取れない箇所をスマホでテキスト確認する摩擦を下げる目的からOCR/PWA化を始めた。',null,null,'unknown','confirmed','user-history-review',1.000)
)
insert into knowledge.evolution_events (
  event_type, title, summary, period_start, period_end, time_precision,
  verification_status, source, confidence, verified_at
)
select d.event_type, d.title, d.summary, d.period_start, d.period_end, d.time_precision,
       d.verification_status, d.source, d.confidence, '2026-09-04T14:00:00Z'
from defs d
where not exists (
  select 1 from knowledge.evolution_events e
  where e.event_type = d.event_type
    and e.title = d.title
    and coalesce(e.period_start,'0001-01-01'::date) = coalesce(d.period_start,'0001-01-01'::date)
    and coalesce(e.period_end,'0001-01-01'::date) = coalesce(d.period_end,'0001-01-01'::date)
);

-- Event -> Product bindings
with defs(event_title, product_slug, role) as (
  values
    ('Market Info自動化の起点','market-info','subject'),
    ('ChatGPT→Cursorコピペ型で自動化開発を開始','market-info','context'),
    ('Codexを開発へ導入','market-info','context'),
    ('Codexへ実装を任せる比率が上昇','market-info','context'),
    ('Claude Codeを開発へ導入','market-info','context'),
    ('優待クロスの実践知を知人から得る','mini-tools','context'),
    ('既存優待アプリを見て自作統合画面を着想','mini-tools','result'),
    ('RAG WorkbenchでRAG構成を実装検証','rag-workbench','subject'),
    ('Test Englishはテキスト確認摩擦から始まった','test-english','subject')
)
insert into knowledge.evolution_event_products (
  event_id, product_id, role, source, confidence, verified_at
)
select e.id, p.id, d.role, 'golden-dataset-review', 1.000, '2026-09-04T14:00:00Z'
from defs d
join knowledge.evolution_events e on e.title = d.event_title
join registry.products p on p.slug = d.product_slug
on conflict (event_id, product_id, role) do nothing;

-- Event -> Capability bindings
with defs(event_title, capability_slug, role) as (
  values
    ('ChatGPT→Cursorコピペ型で自動化開発を開始','ai-assisted-iterative-development','subject'),
    ('Codexを開発へ導入','ai-assisted-iterative-development','subject'),
    ('Codexへ実装を任せる比率が上昇','ai-assisted-iterative-development','result'),
    ('Claude Codeを開発へ導入','ai-assisted-iterative-development','subject'),
    ('RAG WorkbenchでRAG構成を実装検証','rag-pipeline-design','result'),
    ('RAG WorkbenchでRAG構成を実装検証','vector-retrieval','result'),
    ('Test Englishはテキスト確認摩擦から始まった','ocr-content-structuring','result')
)
insert into knowledge.evolution_event_capabilities (
  event_id, capability_id, role, source, confidence, verified_at
)
select e.id, c.id, d.role, 'golden-dataset-review', 1.000, '2026-09-04T14:00:00Z'
from defs d
join knowledge.evolution_events e on e.title = d.event_title
join registry.capabilities c on c.slug = d.capability_slug
on conflict (event_id, capability_id, role) do nothing;

-- Event -> Personal Log / README provenance
with defs(event_title, external_id, relation_type) as (
  values
    ('Market Info自動化の起点','uqnkjitvuebwhjvmaddb:public:personal_log_entries:435b04a0-6355-404e-b19b-48111bd98802','evidence'),
    ('ChatGPT→Cursorコピペ型で自動化開発を開始','uqnkjitvuebwhjvmaddb:public:personal_log_entries:435b04a0-6355-404e-b19b-48111bd98802','evidence'),
    ('Codexを開発へ導入','uqnkjitvuebwhjvmaddb:public:personal_log_entries:435b04a0-6355-404e-b19b-48111bd98802','evidence'),
    ('Codexへ実装を任せる比率が上昇','uqnkjitvuebwhjvmaddb:public:personal_log_entries:435b04a0-6355-404e-b19b-48111bd98802','evidence'),
    ('Claude Codeを開発へ導入','uqnkjitvuebwhjvmaddb:public:personal_log_entries:435b04a0-6355-404e-b19b-48111bd98802','evidence'),
    ('優待クロスの実践知を知人から得る','uqnkjitvuebwhjvmaddb:public:personal_log_entries:517adf19-4de8-4e4f-aeda-3000febfb8bf','evidence'),
    ('既存優待アプリを見て自作統合画面を着想','uqnkjitvuebwhjvmaddb:public:personal_log_entries:517adf19-4de8-4e4f-aeda-3000febfb8bf','evidence'),
    ('RAG WorkbenchでRAG構成を実装検証','Yuichi-TanakaJP/rag-workbench:README.md@master','evidence'),
    ('Test Englishはテキスト確認摩擦から始まった','uqnkjitvuebwhjvmaddb:public:personal_log_entries:9db7c7eb-03b4-4d1b-8161-3fb0c0c0163d','evidence')
)
insert into knowledge.evolution_event_resources (event_id, resource_id, relation_type)
select e.id, r.id, d.relation_type
from defs d
join knowledge.evolution_events e on e.title = d.event_title
join registry.external_resources r on r.external_id = d.external_id
on conflict (event_id, resource_id, relation_type) do nothing;

-- Selected event sequencing
with defs(source_title, target_title, relation_type, rationale) as (
  values
    ('Market Info自動化の起点','ChatGPT→Cursorコピペ型で自動化開発を開始','led_to','自動化したい課題がAI支援コーディングの実践開始につながった。'),
    ('ChatGPT→Cursorコピペ型で自動化開発を開始','Codexを開発へ導入','followed_by','AI支援開発の次段階としてCodexを導入。'),
    ('Codexを開発へ導入','Codexへ実装を任せる比率が上昇','led_to','レビュー中心から実装委譲へ変化。'),
    ('Codexへ実装を任せる比率が上昇','Claude Codeを開発へ導入','followed_by','複数Coding Agentを比較・併用する段階へ進んだ。'),
    ('優待クロスの実践知を知人から得る','既存優待アプリを見て自作統合画面を着想','enabled','戦略理解があることで既存アプリの価値と不足を具体的に評価できた。')
)
insert into knowledge.evolution_event_relations (
  source_event_id, target_event_id, relation_type, rationale, source, confidence, verified_at
)
select s.id, t.id, d.relation_type, d.rationale, 'golden-dataset-review', 1.000, '2026-09-04T14:00:00Z'
from defs d
join knowledge.evolution_events s on s.title = d.source_title
join knowledge.evolution_events t on t.title = d.target_title
on conflict (source_event_id, target_event_id, relation_type) do update
set rationale = excluded.rationale,
    source = excluded.source,
    confidence = excluded.confidence,
    verified_at = excluded.verified_at,
    updated_at = now();

-- ---------------------------------------------------------------------------
-- Value Flows
-- ---------------------------------------------------------------------------

insert into flow.value_flows (slug, name, summary, purpose, lifecycle_status, model_status, importance)
values
  ('youtube-investment-signal-to-decision','YouTube投資情報 → 判断','YouTube動画を投資判断向けSignalへ変換し、LINEで受け取り、必要に応じMiniTools/Stock Notesで深掘りして判断する。','長い動画を全部視聴せず、重要情報を日常Touchpointから意思決定へつなぐ。','active','confirmed',5),
  ('market-ranking-to-candidate-discovery','市場ランキング → 注目銘柄発見','市場ランキングを自動取得・正規化し、ユーザーが注目候補を発見する。','手作業集計を自動化し、市場特性に応じた候補探索を継続可能にする。','active','confirmed',5),
  ('yutai-cross-decision','優待候補 → クロス判断','優待候補、信用情報、費用・戦略を確認し、ユーザーがクロス実行/見送りを判断する。','分散した情報を統合して優待クロス判断を速く安全にする。','active','confirmed',4),
  ('english-material-to-mobile-learning','紙教材 → スマホ学習','紙教材をOCR・正規化・PWA化してスマホで学習できる状態へ変換する。','テキスト確認の摩擦を下げ、移動中でも学習を継続しやすくする。','active','confirmed',3),
  ('dividend-growth-feedback','保有 → 配当成長実感','保有・口座税区分・配当情報から受取予測と成長要因を可視化し、長期投資継続へフィードバックする。','配当が育つ実感を可視化して高配当投資の継続を支える。','planned','provisional',4)
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
    ('youtube-investment-signal-to-decision',1,'as_is','Current','LINEから先は主に人間が文脈を持ってMiniTools/Stock Notesへ移る。','active',null,'2026-09-04'::date,'reviewed-as-is',1.000),
    ('youtube-investment-signal-to-decision',2,'proposed','Context-preserving handoff','LINEからMiniToolsへ銘柄・Signal理由を引き継ぐDeep Linkを設ける。','draft',1,'2026-09-04'::date,'user-approved-direction',0.950),
    ('market-ranking-to-candidate-discovery',1,'as_is','Automated current','Market Infoがランキングを取得・整形・公開し、MiniTools等から確認する。','active',null,'2026-09-04'::date,'artifact-review',1.000),
    ('yutai-cross-decision',1,'as_is','Current','Market Info/APIとMiniToolsの優待画面を使い、最終実行は証券会社で人間が行う。','active',null,'2026-09-04'::date,'artifact-and-user-review',1.000),
    ('english-material-to-mobile-learning',1,'as_is','Current PWA pipeline','撮影→Gemini OCR→正規化→PWA build→Cloudflare Pages→スマホ学習。','active',null,'2026-09-04'::date,'artifact-review',1.000),
    ('dividend-growth-feedback',1,'proposed','Proposed MiniTools flow','Portfolio保有から年間配当・税区分・増配寄与を算出し、成長実感へつなぐ。','draft',null,'2026-09-04'::date,'user-idea',0.950)
)
insert into flow.flow_versions (
  flow_id, version_number, variant_type, label, summary, state, based_on_version_id,
  as_of, source, confidence, verified_at
)
select
  f.id, d.version_number, d.variant_type, d.label, d.summary, d.state,
  base.id, d.as_of, d.source, d.confidence, '2026-09-04T14:00:00Z'
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

-- YouTube flow steps (As-Is)
with defs(step_key, label, step_type, actor_type, seq) as (
  values
    ('youtube-source','YouTube動画','source','external_actor',10),
    ('detect','新着検知','signal','system',20),
    ('transcript','字幕取得','acquire','system',30),
    ('extract','投資判断向け情報抽出','transform','system',40),
    ('line','LINE通知','touchpoint','system',50),
    ('read','LINEを読む','human_action','user',60),
    ('mini-tools','MiniToolsで状況確認','investigate','user',70),
    ('stock-notes','Stock Notes / ChatGPTで深掘り','deliberate','mixed',80),
    ('decision','投資判断','decision','user',90),
    ('brokerage','証券会社で売買/見送り','execute','user',100)
)
insert into flow.flow_steps (version_id, step_key, label, step_type, actor_type, sequence_hint)
select fv.id, d.step_key, d.label, d.step_type, d.actor_type, d.seq
from defs d
join flow.value_flows f on f.slug = 'youtube-investment-signal-to-decision'
join flow.flow_versions fv on fv.flow_id = f.id and fv.version_number = 1
on conflict (version_id, step_key) do update
set label = excluded.label,
    step_type = excluded.step_type,
    actor_type = excluded.actor_type,
    sequence_hint = excluded.sequence_hint,
    updated_at = now();

-- YouTube flow edges (As-Is)
with defs(source_key,target_key,edge_type,label) as (
  values
    ('youtube-source','detect','system_data','RSS'),
    ('detect','transcript','system_handoff','動画ID/URL'),
    ('transcript','extract','system_data','Transcript'),
    ('extract','line','system_handoff','LINE用メモ'),
    ('line','read','human_handoff','Push通知を読む'),
    ('read','mini-tools','human_handoff','人間が銘柄/理由を持って移動'),
    ('mini-tools','stock-notes','human_handoff','必要な銘柄を人間が深掘り'),
    ('stock-notes','decision','human_handoff','分析結果を判断へ'),
    ('decision','brokerage','human_handoff','明示的な実行判断')
)
insert into flow.flow_edges (version_id, source_step_id, target_step_id, edge_type, label, source, confidence, verified_at)
select fv.id, s.id, t.id, d.edge_type, d.label, 'golden-dataset-review', 1.000, '2026-09-04T14:00:00Z'
from defs d
join flow.value_flows f on f.slug = 'youtube-investment-signal-to-decision'
join flow.flow_versions fv on fv.flow_id = f.id and fv.version_number = 1
join flow.flow_steps s on s.version_id = fv.id and s.step_key = d.source_key
join flow.flow_steps t on t.version_id = fv.id and t.step_key = d.target_key
on conflict (version_id, source_step_id, target_step_id, edge_type) do update
set label = excluded.label,
    source = excluded.source,
    confidence = excluded.confidence,
    verified_at = excluded.verified_at,
    updated_at = now();

-- YouTube flow proposed version: full path with system handoff after LINE.
with defs(step_key, label, step_type, actor_type, seq) as (
  values
    ('youtube-source','YouTube動画','source','external_actor',10),
    ('detect','新着検知','signal','system',20),
    ('transcript','字幕取得','acquire','system',30),
    ('extract','投資判断向け情報抽出','transform','system',40),
    ('line','LINE通知','touchpoint','system',50),
    ('deep-link','銘柄・Signal文脈付きDeep Link','deliver','system',60),
    ('mini-tools','MiniToolsで対象を直接確認','investigate','user',70),
    ('stock-notes','Stock Notes / ChatGPTで文脈付き深掘り','deliberate','mixed',80),
    ('decision','投資判断','decision','user',90),
    ('brokerage','証券会社で売買/見送り','execute','user',100)
)
insert into flow.flow_steps (version_id, step_key, label, step_type, actor_type, sequence_hint)
select fv.id, d.step_key, d.label, d.step_type, d.actor_type, d.seq
from defs d
join flow.value_flows f on f.slug = 'youtube-investment-signal-to-decision'
join flow.flow_versions fv on fv.flow_id = f.id and fv.version_number = 2
on conflict (version_id, step_key) do update
set label = excluded.label,
    step_type = excluded.step_type,
    actor_type = excluded.actor_type,
    sequence_hint = excluded.sequence_hint,
    updated_at = now();

with defs(source_key,target_key,edge_type,label) as (
  values
    ('youtube-source','detect','system_data','RSS'),
    ('detect','transcript','system_handoff','動画ID/URL'),
    ('transcript','extract','system_data','Transcript'),
    ('extract','line','system_handoff','LINE用メモ'),
    ('line','deep-link','system_handoff','対象銘柄・Signal理由を保持'),
    ('deep-link','mini-tools','system_handoff','Context-preserving handoff'),
    ('mini-tools','stock-notes','system_handoff','対象銘柄と調査トリガーを引き継ぐ'),
    ('stock-notes','decision','human_handoff','分析結果を判断へ'),
    ('decision','brokerage','human_handoff','明示的な実行判断')
)
insert into flow.flow_edges (version_id, source_step_id, target_step_id, edge_type, label, source, confidence, verified_at)
select fv.id, s.id, t.id, d.edge_type, d.label, 'proposed-review', 0.950, '2026-09-04T14:00:00Z'
from defs d
join flow.value_flows f on f.slug = 'youtube-investment-signal-to-decision'
join flow.flow_versions fv on fv.flow_id = f.id and fv.version_number = 2
join flow.flow_steps s on s.version_id = fv.id and s.step_key = d.source_key
join flow.flow_steps t on t.version_id = fv.id and t.step_key = d.target_key
on conflict (version_id, source_step_id, target_step_id, edge_type) do update
set label = excluded.label,
    source = excluded.source,
    confidence = excluded.confidence,
    verified_at = excluded.verified_at,
    updated_at = now();

-- Product/function/provider participation for YouTube flow As-Is.
with defs(step_key, product_slug, function_slug, role) as (
  values
    ('detect','test-line-news','youtube-new-video-detection','owner'),
    ('transcript','test-line-news','youtube-transcript-acquisition','owner'),
    ('extract','test-line-news','youtube-investment-extraction','owner'),
    ('line','test-line-news','line-delivery','owner'),
    ('mini-tools','mini-tools','stock-notes-dashboard','participant')
)
insert into flow.flow_step_product_functions (step_id, product_function_id, role, source, confidence, verified_at)
select fs.id, pf.id, d.role, 'golden-dataset-review', 1.000, '2026-09-04T14:00:00Z'
from defs d
join flow.value_flows f on f.slug = 'youtube-investment-signal-to-decision'
join flow.flow_versions fv on fv.flow_id = f.id and fv.version_number = 1
join flow.flow_steps fs on fs.version_id = fv.id and fs.step_key = d.step_key
join registry.products p on p.slug = d.product_slug
join registry.product_functions pf on pf.product_id = p.id and pf.slug = d.function_slug
on conflict (step_id, product_function_id, role) do nothing;

with defs(step_key, product_slug, role) as (
  values
    ('mini-tools','mini-tools','participant'),
    ('stock-notes','stock-notes','participant')
)
insert into flow.flow_step_products (step_id, product_id, role, source, confidence, verified_at)
select fs.id, p.id, d.role, 'golden-dataset-review', 1.000, '2026-09-04T14:00:00Z'
from defs d
join flow.value_flows f on f.slug = 'youtube-investment-signal-to-decision'
join flow.flow_versions fv on fv.flow_id = f.id and fv.version_number = 1
join flow.flow_steps fs on fs.version_id = fv.id and fs.step_key = d.step_key
join registry.products p on p.slug = d.product_slug
on conflict (step_id, product_id, role) do nothing;

with defs(step_key, provider_slug, role) as (
  values
    ('youtube-source','youtube','source'),
    ('extract','anthropic','processor'),
    ('line','line','delivery')
)
insert into flow.flow_step_providers (step_id, provider_id, role, source, confidence, verified_at)
select fs.id, sp.id, d.role, 'golden-dataset-review', 1.000, '2026-09-04T14:00:00Z'
from defs d
join flow.value_flows f on f.slug = 'youtube-investment-signal-to-decision'
join flow.flow_versions fv on fv.flow_id = f.id and fv.version_number = 1
join flow.flow_steps fs on fs.version_id = fv.id and fs.step_key = d.step_key
join registry.service_providers sp on sp.slug = d.provider_slug
on conflict (step_id, provider_id, role) do nothing;

-- Market ranking flow
with defs(step_key, label, step_type, actor_type, seq) as (
  values
    ('market-source','証券/市場ランキング','source','external_actor',10),
    ('acquire','Market Infoで取得','acquire','system',20),
    ('normalize','ランキング正規化','transform','system',30),
    ('publish','R2/APIへ供給','publish','system',40),
    ('view','MiniTools等で確認','touchpoint','mixed',50),
    ('discover','注目候補を発見','outcome','user',60)
)
insert into flow.flow_steps (version_id, step_key, label, step_type, actor_type, sequence_hint)
select fv.id, d.step_key, d.label, d.step_type, d.actor_type, d.seq
from defs d
join flow.value_flows f on f.slug = 'market-ranking-to-candidate-discovery'
join flow.flow_versions fv on fv.flow_id = f.id and fv.version_number = 1
on conflict (version_id, step_key) do update
set label = excluded.label, step_type = excluded.step_type, actor_type = excluded.actor_type,
    sequence_hint = excluded.sequence_hint, updated_at = now();

with defs(source_key,target_key,edge_type) as (
  values
    ('market-source','acquire','system_handoff'),
    ('acquire','normalize','system_data'),
    ('normalize','publish','system_data'),
    ('publish','view','system_handoff'),
    ('view','discover','human_handoff')
)
insert into flow.flow_edges (version_id, source_step_id, target_step_id, edge_type, source, confidence, verified_at)
select fv.id, s.id, t.id, d.edge_type, 'golden-dataset-review', 1.000, '2026-09-04T14:00:00Z'
from defs d
join flow.value_flows f on f.slug = 'market-ranking-to-candidate-discovery'
join flow.flow_versions fv on fv.flow_id = f.id and fv.version_number = 1
join flow.flow_steps s on s.version_id = fv.id and s.step_key = d.source_key
join flow.flow_steps t on t.version_id = fv.id and t.step_key = d.target_key
on conflict (version_id, source_step_id, target_step_id, edge_type) do nothing;

with defs(step_key, function_slug, role) as (
  values
    ('acquire','ranking-acquisition','owner'),
    ('normalize','market-normalization','owner'),
    ('publish','r2-publishing','owner')
)
insert into flow.flow_step_product_functions (step_id, product_function_id, role, source, confidence, verified_at)
select fs.id, pf.id, d.role, 'golden-dataset-review', 1.000, '2026-09-04T14:00:00Z'
from defs d
join flow.value_flows f on f.slug = 'market-ranking-to-candidate-discovery'
join flow.flow_versions fv on fv.flow_id = f.id and fv.version_number = 1
join flow.flow_steps fs on fs.version_id = fv.id and fs.step_key = d.step_key
join registry.products p on p.slug = 'market-info'
join registry.product_functions pf on pf.product_id = p.id and pf.slug = d.function_slug
on conflict (step_id, product_function_id, role) do nothing;

-- Yutai flow
with defs(step_key, label, step_type, actor_type, seq) as (
  values
    ('data','優待候補・信用・株価データ','source','system',10),
    ('dashboard','優待ダッシュボードで比較','investigate','mixed',20),
    ('select','ピック/パス・戦略判断','decision','user',30),
    ('brokerage','証券会社で在庫確認・クロス実行','execute','user',40),
    ('record','取得実績を記録','record','user',50)
)
insert into flow.flow_steps (version_id, step_key, label, step_type, actor_type, sequence_hint)
select fv.id, d.step_key, d.label, d.step_type, d.actor_type, d.seq
from defs d
join flow.value_flows f on f.slug = 'yutai-cross-decision'
join flow.flow_versions fv on fv.flow_id = f.id and fv.version_number = 1
on conflict (version_id, step_key) do update
set label = excluded.label, step_type = excluded.step_type, actor_type = excluded.actor_type,
    sequence_hint = excluded.sequence_hint, updated_at = now();

with defs(source_key,target_key,edge_type) as (
  values
    ('data','dashboard','system_handoff'),
    ('dashboard','select','human_handoff'),
    ('select','brokerage','human_handoff'),
    ('brokerage','record','human_handoff')
)
insert into flow.flow_edges (version_id, source_step_id, target_step_id, edge_type, source, confidence, verified_at)
select fv.id, s.id, t.id, d.edge_type, 'golden-dataset-review', 1.000, '2026-09-04T14:00:00Z'
from defs d
join flow.value_flows f on f.slug = 'yutai-cross-decision'
join flow.flow_versions fv on fv.flow_id = f.id and fv.version_number = 1
join flow.flow_steps s on s.version_id = fv.id and s.step_key = d.source_key
join flow.flow_steps t on t.version_id = fv.id and t.step_key = d.target_key
on conflict (version_id, source_step_id, target_step_id, edge_type) do nothing;

insert into flow.flow_step_product_functions (step_id, product_function_id, role, source, confidence, verified_at)
select fs.id, pf.id, 'owner', 'golden-dataset-review', 1.000, '2026-09-04T14:00:00Z'
from flow.value_flows f
join flow.flow_versions fv on fv.flow_id = f.id and fv.version_number = 1
join flow.flow_steps fs on fs.version_id = fv.id and fs.step_key = 'dashboard'
join registry.products p on p.slug = 'mini-tools'
join registry.product_functions pf on pf.product_id = p.id and pf.slug = 'yutai-dashboard'
where f.slug = 'yutai-cross-decision'
on conflict (step_id, product_function_id, role) do nothing;

-- Test English flow
with defs(step_key, label, step_type, actor_type, seq) as (
  values
    ('photo','教材ページを撮影','source','user',10),
    ('ocr','Gemini OCR','transform','system',20),
    ('normalize','語彙・Lesson構造を正規化','transform','system',30),
    ('build','静的PWAを生成','publish','system',40),
    ('pages','Cloudflare Pagesへ配信','deliver','system',50),
    ('learn','スマホで学習・テキスト確認','outcome','user',60)
)
insert into flow.flow_steps (version_id, step_key, label, step_type, actor_type, sequence_hint)
select fv.id, d.step_key, d.label, d.step_type, d.actor_type, d.seq
from defs d
join flow.value_flows f on f.slug = 'english-material-to-mobile-learning'
join flow.flow_versions fv on fv.flow_id = f.id and fv.version_number = 1
on conflict (version_id, step_key) do update
set label = excluded.label, step_type = excluded.step_type, actor_type = excluded.actor_type,
    sequence_hint = excluded.sequence_hint, updated_at = now();

with defs(source_key,target_key,edge_type) as (
  values
    ('photo','ocr','human_handoff'),
    ('ocr','normalize','system_data'),
    ('normalize','build','system_data'),
    ('build','pages','system_handoff'),
    ('pages','learn','human_handoff')
)
insert into flow.flow_edges (version_id, source_step_id, target_step_id, edge_type, source, confidence, verified_at)
select fv.id, s.id, t.id, d.edge_type, 'artifact-review', 1.000, '2026-09-04T14:00:00Z'
from defs d
join flow.value_flows f on f.slug = 'english-material-to-mobile-learning'
join flow.flow_versions fv on fv.flow_id = f.id and fv.version_number = 1
join flow.flow_steps s on s.version_id = fv.id and s.step_key = d.source_key
join flow.flow_steps t on t.version_id = fv.id and t.step_key = d.target_key
on conflict (version_id, source_step_id, target_step_id, edge_type) do nothing;

with defs(step_key, function_slug, role) as (
  values
    ('ocr','material-ocr','owner'),
    ('normalize','vocabulary-normalization','owner'),
    ('build','pwa-build-publish','owner')
)
insert into flow.flow_step_product_functions (step_id, product_function_id, role, source, confidence, verified_at)
select fs.id, pf.id, d.role, 'artifact-review', 1.000, '2026-09-04T14:00:00Z'
from defs d
join flow.value_flows f on f.slug = 'english-material-to-mobile-learning'
join flow.flow_versions fv on fv.flow_id = f.id and fv.version_number = 1
join flow.flow_steps fs on fs.version_id = fv.id and fs.step_key = d.step_key
join registry.products p on p.slug = 'test-english'
join registry.product_functions pf on pf.product_id = p.id and pf.slug = d.function_slug
on conflict (step_id, product_function_id, role) do nothing;

with defs(step_key, provider_slug, role) as (
  values
    ('ocr','google-ai','processor'),
    ('pages','cloudflare','delivery')
)
insert into flow.flow_step_providers (step_id, provider_id, role, source, confidence, verified_at)
select fs.id, sp.id, d.role, 'artifact-review', 1.000, '2026-09-04T14:00:00Z'
from defs d
join flow.value_flows f on f.slug = 'english-material-to-mobile-learning'
join flow.flow_versions fv on fv.flow_id = f.id and fv.version_number = 1
join flow.flow_steps fs on fs.version_id = fv.id and fs.step_key = d.step_key
join registry.service_providers sp on sp.slug = d.provider_slug
on conflict (step_id, provider_id, role) do nothing;

-- Dividend proposed flow: no Product Function is created until the feature is actually adopted.
with defs(step_key, label, step_type, actor_type, seq) as (
  values
    ('positions','Portfolio保有・口座区分','source','system',10),
    ('calculate','年間配当・税区分・増配寄与を算出','transform','system',20),
    ('visualize','配当の積み上がりを可視化','touchpoint','system',30),
    ('feel-progress','成長実感を得る','outcome','user',40),
    ('continue','高配当投資を継続する','outcome','user',50)
)
insert into flow.flow_steps (version_id, step_key, label, step_type, actor_type, sequence_hint)
select fv.id, d.step_key, d.label, d.step_type, d.actor_type, d.seq
from defs d
join flow.value_flows f on f.slug = 'dividend-growth-feedback'
join flow.flow_versions fv on fv.flow_id = f.id and fv.version_number = 1
on conflict (version_id, step_key) do update
set label = excluded.label, step_type = excluded.step_type, actor_type = excluded.actor_type,
    sequence_hint = excluded.sequence_hint, updated_at = now();

with defs(source_key,target_key,edge_type) as (
  values
    ('positions','calculate','system_data'),
    ('calculate','visualize','system_data'),
    ('visualize','feel-progress','human_handoff'),
    ('feel-progress','continue','feedback')
)
insert into flow.flow_edges (version_id, source_step_id, target_step_id, edge_type, source, confidence, verified_at)
select fv.id, s.id, t.id, d.edge_type, 'user-proposed', 0.950, '2026-09-04T14:00:00Z'
from defs d
join flow.value_flows f on f.slug = 'dividend-growth-feedback'
join flow.flow_versions fv on fv.flow_id = f.id and fv.version_number = 1
join flow.flow_steps s on s.version_id = fv.id and s.step_key = d.source_key
join flow.flow_steps t on t.version_id = fv.id and t.step_key = d.target_key
on conflict (version_id, source_step_id, target_step_id, edge_type) do nothing;

insert into flow.flow_step_products (step_id, product_id, role, source, confidence, verified_at)
select fs.id, p.id, 'proposed_owner', 'user-proposed', 0.950, '2026-09-04T14:00:00Z'
from flow.value_flows f
join flow.flow_versions fv on fv.flow_id = f.id and fv.version_number = 1
join flow.flow_steps fs on fs.version_id = fv.id and fs.step_key in ('calculate','visualize')
join registry.products p on p.slug = 'mini-tools'
where f.slug = 'dividend-growth-feedback'
on conflict (step_id, product_id, role) do nothing;

-- Flow -> Knowledge links
with defs(flow_slug, item_key, relation_type) as (
  values
    ('youtube-investment-signal-to-decision','youtube-investment-push-idea','realized_by'),
    ('youtube-investment-signal-to-decision','line-mini-tools-handoff-gap','applies_to'),
    ('market-ranking-to-candidate-discovery','market-info-find-emerging-stocks','realized_by'),
    ('market-ranking-to-candidate-discovery','market-info-manual-ranking-pain','addresses'),
    ('market-ranking-to-candidate-discovery','growth-volume-signal-hypothesis','informs'),
    ('yutai-cross-decision','yutai-integrated-dashboard-goal','realized_by'),
    ('yutai-cross-decision','yutai-credit-window-insight','informs'),
    ('english-material-to-mobile-learning','english-text-check-friction','addresses'),
    ('english-material-to-mobile-learning','english-ocr-pwa-idea','realized_by'),
    ('dividend-growth-feedback','dividend-progress-feedback-value','realized_by'),
    ('dividend-growth-feedback','mini-tools-dividend-projection-idea','realized_by')
)
insert into flow.flow_knowledge_links (flow_id, item_id, relation_type, source, confidence, verified_at)
select f.id, i.id, d.relation_type, 'golden-dataset-review', 1.000, '2026-09-04T14:00:00Z'
from defs d
join flow.value_flows f on f.slug = d.flow_slug
join knowledge.items i on i.canonical_key = d.item_key
on conflict (flow_id, item_id, relation_type) do nothing;

-- Flow outcomes
with defs(flow_slug, outcome_type, title, description, importance) as (
  values
    ('youtube-investment-signal-to-decision','user_value','投資情報を効率よく日常へ取り込む','長い動画を全部視聴せず重要Signalを受け取り、必要なものだけ深掘りする。',5),
    ('market-ranking-to-candidate-discovery','user_value','注目候補の継続発見','毎日の手作業を減らしながら市場ランキングから候補を発見する。',5),
    ('yutai-cross-decision','user_value','クロス判断の高速化・安全化','信用・費用・仕込み情報を統合し、実行/見送りを判断しやすくする。',4),
    ('english-material-to-mobile-learning','user_value','テキスト確認摩擦の低減','紙教材情報をスマホで確認可能にし、移動中学習の摩擦を下げる。',3),
    ('english-material-to-mobile-learning','learning','OCR/PWA Capabilityの獲得','OCR構造化と静的PWA公開を実課題で経験する。',3),
    ('dividend-growth-feedback','user_value','配当の成長実感','受取配当が育つ過程を確認し、長期投資継続のフィードバックにする。',4)
)
insert into flow.flow_outcomes (flow_id, outcome_type, title, description, importance)
select f.id, d.outcome_type, d.title, d.description, d.importance
from defs d
join flow.value_flows f on f.slug = d.flow_slug
where not exists (
  select 1 from flow.flow_outcomes o
  where o.flow_id = f.id and o.outcome_type = d.outcome_type and o.title = d.title
);

commit;
