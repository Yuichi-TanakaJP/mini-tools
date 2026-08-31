-- Workspace Core discovery seed
-- Evidence-backed technology, provider and product relationships discovered from GitHub.
-- Idempotent: safe to re-run after the base registry and provider-level relationship migration.

begin;

insert into registry.technologies (slug, name, category, layer, metadata)
values
  ('nodejs', 'Node.js', 'runtime', 'backend', '{}'::jsonb),
  ('express', 'Express', 'framework', 'backend', '{}'::jsonb),
  ('neon-serverless', 'Neon Serverless Driver', 'library', 'data', '{}'::jsonb)
on conflict (slug) do update
set name = excluded.name,
    category = excluded.category,
    layer = excluded.layer,
    updated_at = now();

insert into registry.service_providers (slug, name, category, metadata)
values
  ('neon', 'Neon', 'database-platform', '{}'::jsonb),
  ('google-ai', 'Google AI / Gemini', 'ai-platform', '{}'::jsonb)
on conflict (slug) do update
set name = excluded.name,
    category = excluded.category,
    updated_at = now();

with links(product_slug, tech_slug, role, version, evidence_uri, confidence, notes) as (
  values
    ('todo-app', 'nodejs', 'backend runtime', null, 'https://github.com/Yuichi-TanakaJP/todo-app-backend/blob/main/package.json', 1.000, 'Backend repository runs compiled JavaScript with node.'),
    ('todo-app', 'express', 'backend framework', '^5.1.0', 'https://github.com/Yuichi-TanakaJP/todo-app-backend/blob/main/package.json', 1.000, 'Backend repository dependency.'),
    ('todo-app', 'prisma', 'database ORM', '^6.14.0', 'https://github.com/Yuichi-TanakaJP/todo-app-backend/blob/main/package.json', 1.000, 'Backend repository dependency; datasource is PostgreSQL.'),
    ('test-isn', 'typescript', 'application language', '^5.5.3', 'https://github.com/Yuichi-TanakaJP/test_ISN/blob/master/package.json', 1.000, null),
    ('test-isn', 'nextjs', 'web framework', '14.2.35', 'https://github.com/Yuichi-TanakaJP/test_ISN/blob/master/package.json', 1.000, null),
    ('test-isn', 'react', 'UI framework', '^18.3.1', 'https://github.com/Yuichi-TanakaJP/test_ISN/blob/master/package.json', 1.000, null),
    ('test-isn', 'neon-serverless', 'database client', '^1.1.0', 'https://github.com/Yuichi-TanakaJP/test_ISN/blob/master/package.json', 1.000, null),
    ('test-english', 'javascript', 'build/application scripts', null, 'https://github.com/Yuichi-TanakaJP/test_english/blob/main/README.md', 0.980, 'Main OCR/build pipeline uses .mjs scripts.'),
    ('test-english', 'python', 'support scripts', null, 'https://github.com/Yuichi-TanakaJP/test_english/blob/main/README.md', 0.850, 'README states some scripts are Python.'),
    ('test-antigravity', 'javascript', 'application language', null, 'https://github.com/Yuichi-TanakaJP/test_antigravity/blob/design-refinement-sensoria/five-senses-beauty/package.json', 1.000, null),
    ('test-antigravity', 'react', 'UI framework', '^19.2.0', 'https://github.com/Yuichi-TanakaJP/test_antigravity/blob/design-refinement-sensoria/five-senses-beauty/package.json', 1.000, null),
    ('test-antigravity', 'vite', 'frontend build', '^7.2.4', 'https://github.com/Yuichi-TanakaJP/test_antigravity/blob/design-refinement-sensoria/five-senses-beauty/package.json', 1.000, null),
    ('portfolio-x-post', 'python', 'publishing pipeline language', null, 'https://github.com/Yuichi-TanakaJP/portfolio_x_post/blob/master/README.md', 0.990, 'README lists multiple Python pipeline modules.')
)
insert into registry.product_technologies (
  product_id, technology_id, role, version, source, confidence,
  evidence_uri, last_verified_at, notes
)
select p.id, t.id, l.role, l.version, 'github-discovery', l.confidence,
       l.evidence_uri, now(), l.notes
from links l
join registry.products p on p.slug = l.product_slug
join registry.technologies t on t.slug = l.tech_slug
on conflict (product_id, technology_id) do update
set role = excluded.role,
    version = excluded.version,
    source = excluded.source,
    confidence = excluded.confidence,
    evidence_uri = excluded.evidence_uri,
    last_verified_at = excluded.last_verified_at,
    notes = excluded.notes,
    updated_at = now();

with provider_links(product_slug, provider_slug, relation_type, evidence_uri, confidence, notes) as (
  values
    ('test-isn', 'neon', 'uses_database_platform', 'https://github.com/Yuichi-TanakaJP/test_ISN/blob/master/.env.example', 0.980, 'Neon/Vercel Postgres connection is explicitly documented; concrete Neon project ID not identified.'),
    ('test-isn', 'vercel', 'deployment_target', 'https://github.com/Yuichi-TanakaJP/test_ISN/blob/master/.env.example', 0.850, 'Vercel integration is documented, but concrete deployment identity has not been registered.'),
    ('test-english', 'cloudflare', 'deployment_target', 'https://github.com/Yuichi-TanakaJP/test_english/blob/main/README.md', 1.000, 'README states deployed to Cloudflare Pages and names the Pages project.'),
    ('test-english', 'google-ai', 'uses_ai_api', 'https://github.com/Yuichi-TanakaJP/test_english/blob/main/README.md', 1.000, 'Gemini API is used for OCR; README names gemini-2.5-flash-lite as default.'),
    ('portfolio-x-post', 'anthropic', 'uses_ai_cli', 'https://github.com/Yuichi-TanakaJP/portfolio_x_post/blob/master/README.md', 1.000, 'Publishing runners invoke claude -p skills for news-backed drafting.')
)
insert into registry.product_service_provider_links (
  product_id, provider_id, relation_type, source, confidence,
  evidence_uri, last_verified_at, notes
)
select p.id, sp.id, l.relation_type, 'github-discovery', l.confidence,
       l.evidence_uri, now(), l.notes
from provider_links l
join registry.products p on p.slug = l.product_slug
join registry.service_providers sp on sp.slug = l.provider_slug
on conflict (product_id, provider_id, relation_type) do update
set source = excluded.source,
    confidence = excluded.confidence,
    evidence_uri = excluded.evidence_uri,
    last_verified_at = excluded.last_verified_at,
    notes = excluded.notes,
    updated_at = now();

with relations(source_slug, target_slug, relation_type, confidence, notes) as (
  values
    ('portfolio-x-post', 'ideas', 'consumes_content', 1.000, 'Publishing factory turns idea stock from ideas into outward-facing drafts.'),
    ('ideas', 'claude-skills', 'uses_workflow_asset', 1.000, 'ideas review workflow explicitly uses /ideas-review from claude-skills.'),
    ('claude-skills', 'repo-templates', 'references_source_of_truth', 1.000, 'repo-setup skill explicitly references repo-templates as its source of truth.')
)
insert into registry.product_relations (
  source_product_id, target_product_id, relation_type, source,
  confidence, verified_at, notes
)
select src.id, dst.id, r.relation_type, 'github-discovery',
       r.confidence, now(), r.notes
from relations r
join registry.products src on src.slug = r.source_slug
join registry.products dst on dst.slug = r.target_slug
on conflict (source_product_id, target_product_id, relation_type) do update
set source = excluded.source,
    confidence = excluded.confidence,
    verified_at = excluded.verified_at,
    notes = excluded.notes,
    updated_at = now();

update registry.products
set product_type = 'application',
    lifecycle_status = 'active',
    metadata = metadata || jsonb_build_object(
      'classification_source', 'github:README',
      'classification_confidence', 0.98
    ),
    updated_at = now()
where slug = 'test-english';

commit;
