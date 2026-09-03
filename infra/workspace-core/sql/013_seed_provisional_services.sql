-- Workspace Core V2 provisional Service/value model.
-- These rows intentionally remain model_status = provisional until the Service definitions
-- and Product contribution roles are reviewed as an operating model.

begin;

insert into registry.service_offerings (
  slug, name, summary, target_user, user_job, value_proposition, expected_outcome,
  stage, importance, model_status, metadata
)
values
  (
    'investment-decision-support',
    '投資判断・資産管理',
    '市場データの収集から分析・可視化・発信までをつなぎ、投資判断を再利用できる形にするサービス。',
    'まずは自分自身。将来的には個人投資家への展開も候補。',
    '市場・テーマ・銘柄・保有資産の情報が分散し、判断材料を毎回集め直す負担を減らす。',
    '投資情報を「集める」から「判断できる状態」に変える。',
    '調査時間の短縮、投資判断の再利用性向上、ポートフォリオ全体の理解、発信までの一貫性を高める。',
    'internal', 5, 'provisional',
    '{"model_version":"v1","origin":"user-approved-service-value-direction"}'::jsonb
  ),
  (
    'pc-cloud-operations',
    'PC / Cloud 運用支援',
    'PC・Cloud・SaaS・デプロイ先の確認をまとめ、個人開発環境の運用判断を支援するサービス。',
    '自分自身 / 個人開発の運用者。',
    'PC、Cloud、SaaS、デプロイ先が増えるほど、どこを確認すべきかが分散する。',
    '個人開発の運用を「覚えて管理」から「見れば分かる」に変える。',
    '確認漏れの削減、障害調査の入口統一、Cloud / SaaS利用状況の把握、保守負荷の低減。',
    'prototype', 3, 'provisional',
    '{"model_version":"v1","origin":"user-approved-service-value-direction"}'::jsonb
  ),
  (
    'ai-development-platform',
    'AI開発・開発基盤',
    'Skill・Template・Knowledge・Experimentを再利用し、AIを使った個人開発そのものを強化するサービス。',
    '自分自身 / AIを使って開発する開発者。',
    'プロンプト、規約、設計、Repository構成、実験知識を毎回ゼロから作り直す負担を減らす。',
    'AI開発を「その場限りの会話」から「再利用可能な開発能力」に変える。',
    '開発速度の向上、品質の標準化、AIエージェントへの知識移植、実験成果の再利用を進める。',
    'internal', 4, 'provisional',
    '{"model_version":"v1","origin":"user-approved-service-value-direction"}'::jsonb
  )
on conflict (slug) do update set
  name = excluded.name,
  summary = excluded.summary,
  target_user = excluded.target_user,
  user_job = excluded.user_job,
  value_proposition = excluded.value_proposition,
  expected_outcome = excluded.expected_outcome,
  stage = excluded.stage,
  importance = excluded.importance,
  model_status = excluded.model_status,
  metadata = registry.service_offerings.metadata || excluded.metadata;

with links(service_slug, product_slug, role, contribution, is_primary) as (
  values
    ('investment-decision-support', 'mini-tools', 'user_interface', '投資情報・分析・ポートフォリオを人が確認する主要なWeb / Dashboard接点。', true),
    ('investment-decision-support', 'stock-notes', 'data_service', '投資分析・銘柄・テーマ関連データを保存・提供するデータ/API基盤。', false),
    ('investment-decision-support', 'market-info', 'data_collection', '市場情報を収集・整形し、判断材料として下流へ供給する。', false),
    ('investment-decision-support', 'portfolio-x-post', 'distribution', '分析・ポートフォリオ情報を外部発信用コンテンツへ変換する。', false),
    ('pc-cloud-operations', 'pc-saas-health-monitor', 'operations_interface', 'PC・SaaS・Cloudの状態確認と運用支援をまとめる主要Product。', true),
    ('ai-development-platform', 'claude-skills', 'workflow_asset', 'AIエージェントが再利用できるSkill / Workflowを提供する。', true),
    ('ai-development-platform', 'repo-templates', 'development_template', 'Repository構成・開発規約を再利用可能なテンプレートとして提供する。', false),
    ('ai-development-platform', 'ideas', 'knowledge_source', '企画・アイデア・知識を蓄積し、開発Workflowから再利用する。', false),
    ('ai-development-platform', 'rag-workbench', 'experimentation', 'RAG・ベクトル検索等を検証し、得た知見を次のProductへ還元する。', false)
)
insert into registry.service_products (
  service_id, product_id, role, contribution, is_primary, source, confidence, verified_at, notes
)
select
  s.id, p.id, l.role, l.contribution, l.is_primary,
  'manual', 0.900, now(), 'User-approved provisional Service/value model, 2026-09-03.'
from links l
join registry.service_offerings s on s.slug = l.service_slug
join registry.products p on p.slug = l.product_slug
on conflict (service_id, product_id) do update set
  role = excluded.role,
  contribution = excluded.contribution,
  is_primary = excluded.is_primary,
  source = excluded.source,
  confidence = excluded.confidence,
  verified_at = excluded.verified_at,
  notes = excluded.notes;

with modes(service_slug, product_slug, mode, label, description, touchpoint, is_user_facing) as (
  values
    ('investment-decision-support', 'mini-tools', 'web_dashboard', 'Web / Dashboard', '投資情報・分析結果・保有状況を人が直接確認する。', 'mini-tools / Premium', true),
    ('investment-decision-support', 'stock-notes', 'api_data', 'API / Data', '構造化した投資データを他Productへ供給する。', 'server-side data/API', false),
    ('investment-decision-support', 'market-info', 'automation', 'Market Data Automation', '市場情報を定期収集・整形し、判断材料へ変換する。', 'background automation', false),
    ('investment-decision-support', 'portfolio-x-post', 'content', 'Content / Distribution', '分析やポートフォリオ情報を発信用コンテンツへ変換する。', 'X / external content', true),
    ('pc-cloud-operations', 'pc-saas-health-monitor', 'dashboard', 'Operations Dashboard', 'PC・SaaS・Cloudの運用情報を一覧で確認する。', 'PC / SaaS Health Monitor', true),
    ('pc-cloud-operations', 'pc-saas-health-monitor', 'health_check', 'Health Check', '対象環境やサービスの状態確認を行う。', 'health check workflow', true),
    ('pc-cloud-operations', 'pc-saas-health-monitor', 'automation', 'Automation', '定型的な確認や運用処理を自動化する。', 'background automation', false),
    ('pc-cloud-operations', 'pc-saas-health-monitor', 'internal_tool', 'Internal Tool', '自分の個人開発環境を維持・整理するための運用ツールとして使う。', 'developer operations', true),
    ('ai-development-platform', 'claude-skills', 'knowledge_asset', 'Reusable Skills', 'AIへ再利用可能なSkill・Workflowを渡す。', 'AI agent / coding workflow', true),
    ('ai-development-platform', 'repo-templates', 'template', 'Repository Template', '開発開始時の構成・規約を再利用する。', 'GitHub repository bootstrap', true),
    ('ai-development-platform', 'claude-skills', 'ai_workflow', 'AI Workflow', 'AIエージェントによる開発作業を再利用可能なWorkflowとして実行する。', 'AI-assisted development', true),
    ('ai-development-platform', 'rag-workbench', 'experiment', 'Experiment', 'RAG等の技術を検証し、再利用可能な知識へ変える。', 'development experiment', false)
)
insert into registry.service_delivery_modes (
  service_id, product_id, mode, label, description, touchpoint, is_user_facing,
  source, confidence, verified_at, notes
)
select
  s.id, p.id, m.mode, m.label, m.description, m.touchpoint, m.is_user_facing,
  'manual', 0.900, now(), 'User-approved provisional Service/value model, 2026-09-03.'
from modes m
join registry.service_offerings s on s.slug = m.service_slug
join registry.products p on p.slug = m.product_slug
on conflict (service_id, mode, product_id) do update set
  label = excluded.label,
  description = excluded.description,
  touchpoint = excluded.touchpoint,
  is_user_facing = excluded.is_user_facing,
  source = excluded.source,
  confidence = excluded.confidence,
  verified_at = excluded.verified_at,
  notes = excluded.notes;

commit;
