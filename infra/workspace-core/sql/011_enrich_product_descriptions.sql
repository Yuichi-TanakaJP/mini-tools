-- Curated Product descriptions for the Workspace Dashboard portfolio view.
-- Product concepts are human-defined in Workspace Core; these summaries are intentionally
-- conservative and only populate rows whose purpose is sufficiently clear.
-- sensoria-portfolio and test-isn remain null until their purpose is reviewed.

begin;

with descriptions(slug, description) as (
  values
    ('mini-tools', '投資・開発・日常向けの小さな機能とPremiumダッシュボードを集約するWebアプリ。'),
    ('stock-notes', '投資分析データや銘柄・テーマ関連データを保存・提供するサービス/API。'),
    ('market-info', '日本株の市場情報を収集・整形し、APIや成果物へ供給する自動化基盤。'),
    ('pc-saas-health-monitor', 'PC・SaaS・Cloudサービスの状態確認と運用支援をまとめるアプリ。'),
    ('claude-skills', 'Claude向けの再利用可能なSkill・Workflowをまとめる共有Knowledge asset。'),
    ('portfolio-x-post', 'PortfolioやMarket Info等のデータを使い、X投稿向けコンテンツを生成する自動化。'),
    ('rag-workbench', 'RAG構成とベクトル検索を検証するための実験用Workbench。'),
    ('repo-templates', 'Repositoryの共通テンプレートや開発規約を再利用するための共有Knowledge asset。'),
    ('test-trade', 'BinanceやJ-Quantsの市場データを使うトレード検証用Experiment。'),
    ('todo-app', 'FrontendとBackendを分けて構成したTodo管理Webアプリ。'),
    ('ideas', 'アイデア・企画メモを蓄積し、他の自動化から参照する共有Knowledge asset。'),
    ('notion-script', 'Notion APIを使った定型処理・補助作業を自動化するスクリプト群。'),
    ('test-english', '英語学習・英語機能の検証に使うWebアプリ。'),
    ('test-line-news', 'YouTube等のコンテンツをLINE連携するニュース配信自動化。'),
    ('data-gallery', 'データをWeb上で一覧・閲覧するためのギャラリー型アプリ。'),
    ('test-antigravity', '過去の開発検証を参照用に残しているArchived Experiment。')
)
update registry.products p
set description = d.description,
    metadata = p.metadata || jsonb_build_object(
      'description_source', 'workspace-dashboard-redesign',
      'description_updated_at', '2026-09-03'
    )
from descriptions d
where p.slug = d.slug
  and p.description is null;

commit;
