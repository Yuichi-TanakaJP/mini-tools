-- Workspace Core discovery seed: AI Trade Research Lab
-- Evidence-backed dependencies and market-data providers.

begin;

insert into registry.technologies (slug, name, category, layer, metadata)
values
  ('numpy', 'NumPy', 'library', 'data', '{}'::jsonb),
  ('matplotlib', 'Matplotlib', 'library', 'data-visualization', '{}'::jsonb),
  ('jquants-api-client', 'J-Quants API Client', 'library', 'integration', '{}'::jsonb)
on conflict (slug) do update
set name = excluded.name,
    category = excluded.category,
    layer = excluded.layer,
    updated_at = now();

insert into registry.service_providers (slug, name, category, metadata)
values
  ('j-quants', 'J-Quants', 'market-data', '{}'::jsonb),
  ('binance', 'Binance', 'market-data', '{}'::jsonb)
on conflict (slug) do update
set name = excluded.name,
    category = excluded.category,
    updated_at = now();

with links(product_slug, tech_slug, role, version, evidence_uri, confidence) as (
  values
    ('test-trade', 'python', 'research runtime', null, 'https://github.com/Yuichi-TanakaJP/test_trade/blob/main/README.md', 1.000),
    ('test-trade', 'numpy', 'numerical analysis', '>=2.0', 'https://github.com/Yuichi-TanakaJP/test_trade/blob/main/requirements.txt', 1.000),
    ('test-trade', 'pandas', 'data analysis', '>=2.2', 'https://github.com/Yuichi-TanakaJP/test_trade/blob/main/requirements.txt', 1.000),
    ('test-trade', 'matplotlib', 'report visualization', '>=3.8', 'https://github.com/Yuichi-TanakaJP/test_trade/blob/main/requirements.txt', 1.000),
    ('test-trade', 'jquants-api-client', 'market data client', '2.2.0', 'https://github.com/Yuichi-TanakaJP/test_trade/blob/main/requirements.txt', 1.000)
)
insert into registry.product_technologies (
  product_id, technology_id, role, version, source, confidence,
  evidence_uri, last_verified_at
)
select p.id, t.id, l.role, l.version, 'github-discovery', l.confidence,
       l.evidence_uri, now()
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
    updated_at = now();

with provider_links(product_slug, provider_slug, relation_type, evidence_uri, confidence, notes) as (
  values
    ('test-trade', 'j-quants', 'uses_market_data_api', 'https://github.com/Yuichi-TanakaJP/test_trade/blob/main/.env.example', 1.000, 'J-Quants API key and client are explicitly configured for research experiments.'),
    ('test-trade', 'binance', 'uses_market_data_api', 'https://github.com/Yuichi-TanakaJP/test_trade/blob/main/README.md', 0.950, 'README quick start downloads BTCUSDT market data from Binance.')
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

commit;
