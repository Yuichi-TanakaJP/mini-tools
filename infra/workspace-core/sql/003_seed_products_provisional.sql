-- Workspace Core V1 provisional Product <-> Repository classification.
--
-- This is intentionally separate from the authoritative GitHub repository seed.
-- Repository facts come from GitHub; Product concepts are human/AI classifications
-- and may be refined later without altering the source inventory.
--
-- The metadata field marks this classification as provisional.

begin;

with development_domain as (
  select id from platform.domains where code = 'development'
), product_seed (slug, name, product_type, lifecycle_status, importance) as (
  values
    ('todo-app', 'Todo App', 'application', 'active', 2),
    ('data-gallery', 'Data Gallery', 'application', 'active', 2),
    ('market-info', 'Market Info', 'automation', 'active', 4),
    ('test-antigravity', 'Test Antigravity', 'experiment', 'archived', 0),
    ('mini-tools', 'Mini Tools', 'application', 'active', 5),
    ('sensoria-portfolio', 'Sensoria Portfolio', 'application', 'active', 2),
    ('notion-script', 'Notion Script', 'automation', 'active', 1),
    ('rag-workbench', 'RAG Workbench', 'experiment', 'active', 2),
    ('test-line-news', 'Test LINE News', 'experiment', 'active', 1),
    ('test-trade', 'Test Trade', 'experiment', 'active', 2),
    ('portfolio-x-post', 'Portfolio X Post', 'automation', 'active', 2),
    ('test-isn', 'Test ISN', 'experiment', 'active', 1),
    ('ideas', 'Ideas', 'knowledge', 'active', 1),
    ('test-english', 'Test English', 'experiment', 'active', 1),
    ('repo-templates', 'Repository Templates', 'infrastructure', 'active', 2),
    ('claude-skills', 'Claude Skills', 'library', 'active', 2),
    ('stock-notes', 'Stock Notes', 'service', 'active', 5),
    ('pc-saas-health-monitor', 'PC / SaaS Health Monitor', 'application', 'experimental', 3)
)
insert into registry.products (
  slug,
  name,
  product_type,
  lifecycle_status,
  importance,
  domain_id,
  metadata
)
select
  product_seed.slug,
  product_seed.name,
  product_seed.product_type,
  product_seed.lifecycle_status,
  product_seed.importance,
  development_domain.id,
  jsonb_build_object(
    'classification_status', 'provisional',
    'classification_source', 'workspace-core-v1-initial-inventory',
    'classified_at', '2026-08-30'
  )
from development_domain
cross join product_seed
on conflict (slug) do update
set name = excluded.name,
    product_type = excluded.product_type,
    lifecycle_status = excluded.lifecycle_status,
    importance = excluded.importance,
    domain_id = excluded.domain_id,
    metadata = registry.products.metadata || excluded.metadata;

-- Same-name repositories and known multi-repository products.
with mappings (product_slug, repo_full_name, role, is_primary, confidence, notes) as (
  values
    ('todo-app', 'Yuichi-TanakaJP/todo-app', 'frontend', true, 1.000::numeric, 'Repository name directly matches the product concept.'),
    ('todo-app', 'Yuichi-TanakaJP/todo-app-backend', 'backend', false, 0.990::numeric, 'Backend repository name explicitly identifies it as part of todo-app.'),
    ('data-gallery', 'Yuichi-TanakaJP/data-gallery', 'primary', true, 1.000::numeric, null),
    ('market-info', 'Yuichi-TanakaJP/market_info', 'data-pipeline', true, 1.000::numeric, 'Primary market data automation repository.'),
    ('market-info', 'Yuichi-TanakaJP/market-info-api', 'api', false, 0.990::numeric, 'API repository explicitly named for market-info.'),
    ('test-antigravity', 'Yuichi-TanakaJP/test_antigravity', 'primary', true, 1.000::numeric, null),
    ('mini-tools', 'Yuichi-TanakaJP/mini-tools', 'primary', true, 1.000::numeric, null),
    ('sensoria-portfolio', 'Yuichi-TanakaJP/sensoria-portfolio', 'primary', true, 1.000::numeric, null),
    ('notion-script', 'Yuichi-TanakaJP/notion-script', 'primary', true, 1.000::numeric, null),
    ('rag-workbench', 'Yuichi-TanakaJP/rag-workbench', 'primary', true, 1.000::numeric, null),
    ('test-line-news', 'Yuichi-TanakaJP/test_line_news', 'primary', true, 1.000::numeric, null),
    ('test-trade', 'Yuichi-TanakaJP/test_trade', 'primary', true, 1.000::numeric, null),
    ('portfolio-x-post', 'Yuichi-TanakaJP/portfolio_x_post', 'primary', true, 1.000::numeric, null),
    ('test-isn', 'Yuichi-TanakaJP/test_ISN', 'primary', true, 1.000::numeric, null),
    ('ideas', 'Yuichi-TanakaJP/ideas', 'primary', true, 1.000::numeric, null),
    ('test-english', 'Yuichi-TanakaJP/test_english', 'primary', true, 1.000::numeric, null),
    ('repo-templates', 'Yuichi-TanakaJP/repo-templates', 'primary', true, 1.000::numeric, null),
    ('claude-skills', 'Yuichi-TanakaJP/claude-skills', 'primary', true, 1.000::numeric, null),
    ('stock-notes', 'Yuichi-TanakaJP/stock-notes', 'primary', true, 1.000::numeric, null),
    ('pc-saas-health-monitor', 'Yuichi-TanakaJP/pc-saas-health-monitor', 'primary', true, 1.000::numeric, null)
)
insert into registry.product_repositories (
  product_id,
  repository_id,
  role,
  is_primary,
  source,
  confidence,
  verified_at,
  notes
)
select
  p.id,
  r.id,
  mappings.role,
  mappings.is_primary,
  'github_inventory+classification',
  mappings.confidence,
  now(),
  mappings.notes
from mappings
join registry.products p on p.slug = mappings.product_slug
join registry.repositories r on r.full_name = mappings.repo_full_name
on conflict (product_id, repository_id) do update
set role = excluded.role,
    is_primary = excluded.is_primary,
    source = excluded.source,
    confidence = excluded.confidence,
    verified_at = excluded.verified_at,
    notes = excluded.notes;

-- Verified relationship: mini-tools uses the existing mini-tools Supabase project.
-- Pin by Supabase project ref, not display name, so a future same-name project in
-- another account/team cannot be linked accidentally.
insert into registry.product_service_links (
  product_id,
  service_instance_id,
  relation_type,
  environment,
  source,
  confidence,
  verified_at,
  notes
)
select
  p.id,
  si.id,
  'uses_database',
  si.environment,
  'supabase_connector+mini-tools_env',
  1.000,
  now(),
  'Verified from the connected Supabase project inventory and mini-tools Supabase environment configuration.'
from registry.products p
join registry.service_instances si on si.external_id = 'uqnkjitvuebwhjvmaddb'
join registry.service_providers sp on sp.id = si.provider_id and sp.slug = 'supabase'
where p.slug = 'mini-tools'
on conflict (product_id, service_instance_id, relation_type) do update
set environment = excluded.environment,
    source = excluded.source,
    confidence = excluded.confidence,
    verified_at = excluded.verified_at,
    notes = excluded.notes;

-- Verified cross-product API relationships from mini-tools/.env.local.example.
with relation_seed (source_slug, target_slug, relation_type, notes) as (
  values
    ('mini-tools', 'market-info', 'consumes_api', 'mini-tools defines MARKET_INFO_API_BASE_URL for the market-info API.'),
    ('mini-tools', 'stock-notes', 'consumes_api', 'mini-tools defines STOCK_NOTES_API_BASE_URL for the stock-notes API.')
)
insert into registry.product_relations (
  source_product_id,
  target_product_id,
  relation_type,
  source,
  confidence,
  verified_at,
  notes
)
select
  source_product.id,
  target_product.id,
  relation_seed.relation_type,
  'github:mini-tools/.env.local.example',
  1.000,
  now(),
  relation_seed.notes
from relation_seed
join registry.products source_product on source_product.slug = relation_seed.source_slug
join registry.products target_product on target_product.slug = relation_seed.target_slug
on conflict (source_product_id, target_product_id, relation_type) do update
set source = excluded.source,
    confidence = excluded.confidence,
    verified_at = excluded.verified_at,
    notes = excluded.notes;

commit;
