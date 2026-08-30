-- Workspace Core V1 initial authoritative inventory.
-- Source: GitHub connected account inventory captured 2026-08-30.
-- This file is intended for the future Workspace Core Supabase project only.

begin;

insert into platform.domains (code, name, description)
values (
  'development',
  'Development',
  'Products, repositories, technologies, runtime services, and development relationships.'
)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description;

insert into platform.source_systems (code, name, system_type, source_of_truth_scope, base_url)
values
  ('github', 'GitHub', 'scm', 'Code, repositories, Issues, Pull Requests, Actions, and repository metadata.', 'https://github.com'),
  ('notion', 'Notion', 'knowledge_base', 'Long-form notes, source text, historical knowledge, and reference pages when Notion is the originating store.', 'https://www.notion.so'),
  ('supabase', 'Supabase', 'database_platform', 'Operational database projects, database state, and Supabase-managed runtime configuration.', 'https://supabase.com')
on conflict (code) do update
set name = excluded.name,
    system_type = excluded.system_type,
    source_of_truth_scope = excluded.source_of_truth_scope,
    base_url = excluded.base_url;

insert into registry.service_providers (slug, name, category, homepage_url)
values
  ('github', 'GitHub', 'source-control', 'https://github.com'),
  ('supabase', 'Supabase', 'database-platform', 'https://supabase.com'),
  ('vercel', 'Vercel', 'hosting', 'https://vercel.com'),
  ('google-cloud', 'Google Cloud', 'cloud-platform', 'https://cloud.google.com'),
  ('cloudflare', 'Cloudflare', 'edge-and-storage', 'https://www.cloudflare.com'),
  ('notion', 'Notion', 'knowledge-platform', 'https://www.notion.so'),
  ('openai', 'OpenAI', 'ai-platform', 'https://openai.com'),
  ('anthropic', 'Anthropic', 'ai-platform', 'https://www.anthropic.com')
on conflict (slug) do update
set name = excluded.name,
    category = excluded.category,
    homepage_url = excluded.homepage_url;

-- Verified existing Supabase instance. Do not store API keys or secrets here.
insert into registry.service_instances (
  provider_id,
  external_id,
  name,
  environment,
  region,
  status,
  metadata,
  last_synced_at
)
select
  sp.id,
  'uqnkjitvuebwhjvmaddb',
  'mini-tools',
  'production',
  'ap-northeast-1',
  'active',
  jsonb_build_object(
    'postgres_version', '17.6.1.127',
    'inventory_source', 'supabase_connector'
  ),
  now()
from registry.service_providers sp
where sp.slug = 'supabase'
on conflict (provider_id, external_id) where external_id is not null do update
set name = excluded.name,
    environment = excluded.environment,
    region = excluded.region,
    status = excluded.status,
    metadata = registry.service_instances.metadata || excluded.metadata,
    last_synced_at = excluded.last_synced_at;

with github_source as (
  select id from platform.source_systems where code = 'github'
), inventory (
  external_id,
  owner_name,
  repo_name,
  full_name,
  visibility,
  default_branch,
  archived,
  html_url,
  size_kb,
  code_search_indexed
) as (
  values
    ('1001986992', 'Yuichi-TanakaJP', 'todo-app', 'Yuichi-TanakaJP/todo-app', 'private', 'main', false, 'https://github.com/Yuichi-TanakaJP/todo-app', 101, false),
    ('1039456794', 'Yuichi-TanakaJP', 'todo-app-backend', 'Yuichi-TanakaJP/todo-app-backend', 'public', 'main', false, 'https://github.com/Yuichi-TanakaJP/todo-app-backend', 24, false),
    ('1041392639', 'Yuichi-TanakaJP', 'data-gallery', 'Yuichi-TanakaJP/data-gallery', 'public', 'main', false, 'https://github.com/Yuichi-TanakaJP/data-gallery', 158, false),
    ('1069558714', 'Yuichi-TanakaJP', 'market_info', 'Yuichi-TanakaJP/market_info', 'private', 'main', false, 'https://github.com/Yuichi-TanakaJP/market_info', 2935, true),
    ('1101866652', 'Yuichi-TanakaJP', 'test_antigravity', 'Yuichi-TanakaJP/test_antigravity', 'private', 'design-refinement-sensoria', true, 'https://github.com/Yuichi-TanakaJP/test_antigravity', 39, false),
    ('1119637009', 'Yuichi-TanakaJP', 'mini-tools', 'Yuichi-TanakaJP/mini-tools', 'public', 'main', false, 'https://github.com/Yuichi-TanakaJP/mini-tools', 6598, true),
    ('1131985490', 'Yuichi-TanakaJP', 'sensoria-portfolio', 'Yuichi-TanakaJP/sensoria-portfolio', 'public', 'main', false, 'https://github.com/Yuichi-TanakaJP/sensoria-portfolio', 715, false),
    ('1175249672', 'Yuichi-TanakaJP', 'notion-script', 'Yuichi-TanakaJP/notion-script', 'public', 'master', false, 'https://github.com/Yuichi-TanakaJP/notion-script', 28, false),
    ('1194923339', 'Yuichi-TanakaJP', 'market-info-api', 'Yuichi-TanakaJP/market-info-api', 'public', 'main', false, 'https://github.com/Yuichi-TanakaJP/market-info-api', 236, false),
    ('1215176930', 'Yuichi-TanakaJP', 'rag-workbench', 'Yuichi-TanakaJP/rag-workbench', 'private', 'master', false, 'https://github.com/Yuichi-TanakaJP/rag-workbench', 50, false),
    ('1241531166', 'Yuichi-TanakaJP', 'test_line_news', 'Yuichi-TanakaJP/test_line_news', 'public', 'main', false, 'https://github.com/Yuichi-TanakaJP/test_line_news', 111, true),
    ('1270261854', 'Yuichi-TanakaJP', 'test_trade', 'Yuichi-TanakaJP/test_trade', 'private', 'main', false, 'https://github.com/Yuichi-TanakaJP/test_trade', 880, false),
    ('1278265070', 'Yuichi-TanakaJP', 'portfolio_x_post', 'Yuichi-TanakaJP/portfolio_x_post', 'private', 'master', false, 'https://github.com/Yuichi-TanakaJP/portfolio_x_post', 181, false),
    ('1282600145', 'Yuichi-TanakaJP', 'test_ISN', 'Yuichi-TanakaJP/test_ISN', 'private', 'master', false, 'https://github.com/Yuichi-TanakaJP/test_ISN', 244, false),
    ('1289757039', 'Yuichi-TanakaJP', 'ideas', 'Yuichi-TanakaJP/ideas', 'private', 'main', false, 'https://github.com/Yuichi-TanakaJP/ideas', 86, false),
    ('1297399438', 'Yuichi-TanakaJP', 'test_english', 'Yuichi-TanakaJP/test_english', 'private', 'main', false, 'https://github.com/Yuichi-TanakaJP/test_english', 224, false),
    ('1298383716', 'Yuichi-TanakaJP', 'repo-templates', 'Yuichi-TanakaJP/repo-templates', 'private', 'master', false, 'https://github.com/Yuichi-TanakaJP/repo-templates', 17, false),
    ('1299392248', 'Yuichi-TanakaJP', 'claude-skills', 'Yuichi-TanakaJP/claude-skills', 'private', 'master', false, 'https://github.com/Yuichi-TanakaJP/claude-skills', 32, false),
    ('1318887380', 'Yuichi-TanakaJP', 'stock-notes', 'Yuichi-TanakaJP/stock-notes', 'private', 'main', false, 'https://github.com/Yuichi-TanakaJP/stock-notes', 816, false),
    ('1330965207', 'Yuichi-TanakaJP', 'pc-saas-health-monitor', 'Yuichi-TanakaJP/pc-saas-health-monitor', 'private', 'main', false, 'https://github.com/Yuichi-TanakaJP/pc-saas-health-monitor', 1987, false)
)
insert into registry.repositories (
  source_system_id,
  external_id,
  owner_name,
  repo_name,
  full_name,
  visibility,
  default_branch,
  archived,
  html_url,
  size_kb,
  last_synced_at,
  metadata
)
select
  github_source.id,
  inventory.external_id,
  inventory.owner_name,
  inventory.repo_name,
  inventory.full_name,
  inventory.visibility,
  inventory.default_branch,
  inventory.archived,
  inventory.html_url,
  inventory.size_kb,
  now(),
  jsonb_build_object(
    'code_search_indexed', inventory.code_search_indexed,
    'inventory_source', 'github_connector',
    'inventory_captured_at', '2026-08-30'
  )
from github_source
cross join inventory
on conflict (source_system_id, external_id) do update
set owner_name = excluded.owner_name,
    repo_name = excluded.repo_name,
    full_name = excluded.full_name,
    visibility = excluded.visibility,
    default_branch = excluded.default_branch,
    archived = excluded.archived,
    html_url = excluded.html_url,
    size_kb = excluded.size_kb,
    last_synced_at = excluded.last_synced_at,
    metadata = registry.repositories.metadata || excluded.metadata;

commit;
