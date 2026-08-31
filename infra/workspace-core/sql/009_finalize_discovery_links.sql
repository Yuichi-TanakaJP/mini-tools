-- Final pass after 008 master reconciliation.
-- Re-applies the incremental 006/007 links so a fresh 001-009 bootstrap is complete.

begin;

with l(product_slug,tech_slug,role,version,evidence_uri,confidence,notes) as (values
 ('todo-app','nodejs','backend runtime',null,'https://github.com/Yuichi-TanakaJP/todo-app-backend/blob/main/package.json',1.000,'Backend repository runs compiled JavaScript with node.'),
 ('todo-app','express','backend framework','^5.1.0','https://github.com/Yuichi-TanakaJP/todo-app-backend/blob/main/package.json',1.000,'Backend repository dependency.'),
 ('todo-app','prisma','database ORM','^6.14.0','https://github.com/Yuichi-TanakaJP/todo-app-backend/blob/main/package.json',1.000,'Backend repository dependency; datasource is PostgreSQL.'),
 ('test-isn','typescript','application language','^5.5.3','https://github.com/Yuichi-TanakaJP/test_ISN/blob/master/package.json',1.000,null),
 ('test-isn','nextjs','web framework','14.2.35','https://github.com/Yuichi-TanakaJP/test_ISN/blob/master/package.json',1.000,null),
 ('test-isn','react','UI framework','^18.3.1','https://github.com/Yuichi-TanakaJP/test_ISN/blob/master/package.json',1.000,null),
 ('test-isn','neon-serverless','database client','^1.1.0','https://github.com/Yuichi-TanakaJP/test_ISN/blob/master/package.json',1.000,null),
 ('test-english','javascript','build/application scripts',null,'https://github.com/Yuichi-TanakaJP/test_english/blob/main/README.md',0.980,'Main OCR/build pipeline uses .mjs scripts.'),
 ('test-english','python','support scripts',null,'https://github.com/Yuichi-TanakaJP/test_english/blob/main/README.md',0.850,'README states some scripts are Python.'),
 ('test-antigravity','javascript','application language',null,'https://github.com/Yuichi-TanakaJP/test_antigravity/blob/design-refinement-sensoria/five-senses-beauty/package.json',1.000,null),
 ('test-antigravity','react','UI framework','^19.2.0','https://github.com/Yuichi-TanakaJP/test_antigravity/blob/design-refinement-sensoria/five-senses-beauty/package.json',1.000,null),
 ('test-antigravity','vite','frontend build','^7.2.4','https://github.com/Yuichi-TanakaJP/test_antigravity/blob/design-refinement-sensoria/five-senses-beauty/package.json',1.000,null),
 ('portfolio-x-post','python','publishing pipeline language',null,'https://github.com/Yuichi-TanakaJP/portfolio_x_post/blob/master/README.md',0.990,'README lists multiple Python pipeline modules.'),
 ('test-trade','python','research runtime',null,'https://github.com/Yuichi-TanakaJP/test_trade/blob/main/README.md',1.000,null),
 ('test-trade','numpy','numerical analysis','>=2.0','https://github.com/Yuichi-TanakaJP/test_trade/blob/main/requirements.txt',1.000,null),
 ('test-trade','pandas','data analysis','>=2.2','https://github.com/Yuichi-TanakaJP/test_trade/blob/main/requirements.txt',1.000,null),
 ('test-trade','matplotlib','report visualization','>=3.8','https://github.com/Yuichi-TanakaJP/test_trade/blob/main/requirements.txt',1.000,null),
 ('test-trade','jquants-api-client','market data client','2.2.0','https://github.com/Yuichi-TanakaJP/test_trade/blob/main/requirements.txt',1.000,null)
)
insert into registry.product_technologies(product_id,technology_id,role,version,source,confidence,evidence_uri,last_verified_at,notes)
select p.id,t.id,l.role,l.version,'github-discovery',l.confidence,l.evidence_uri,now(),l.notes
from l join registry.products p on p.slug=l.product_slug join registry.technologies t on t.slug=l.tech_slug
on conflict(product_id,technology_id) do update set role=excluded.role,version=excluded.version,source=excluded.source,confidence=excluded.confidence,evidence_uri=excluded.evidence_uri,last_verified_at=excluded.last_verified_at,notes=excluded.notes,updated_at=now();

with l(product_slug,provider_slug,relation_type,evidence_uri,confidence,notes) as (values
 ('test-isn','neon','uses_database_platform','https://github.com/Yuichi-TanakaJP/test_ISN/blob/master/.env.example',0.980,'Concrete Neon project ID not identified.'),
 ('test-isn','vercel','deployment_target','https://github.com/Yuichi-TanakaJP/test_ISN/blob/master/.env.example',0.850,'Vercel integration documented; concrete deployment not registered.'),
 ('test-english','cloudflare','deployment_target','https://github.com/Yuichi-TanakaJP/test_english/blob/main/README.md',1.000,'Deployed Cloudflare Pages PWA.'),
 ('test-english','google-ai','uses_ai_api','https://github.com/Yuichi-TanakaJP/test_english/blob/main/README.md',1.000,'Gemini API OCR pipeline.'),
 ('portfolio-x-post','anthropic','uses_ai_cli','https://github.com/Yuichi-TanakaJP/portfolio_x_post/blob/master/README.md',1.000,'Runners invoke claude -p skills.'),
 ('test-trade','j-quants','uses_market_data_api','https://github.com/Yuichi-TanakaJP/test_trade/blob/main/.env.example',1.000,'J-Quants API key/client explicitly configured.'),
 ('test-trade','binance','uses_market_data_api','https://github.com/Yuichi-TanakaJP/test_trade/blob/main/README.md',0.950,'Quick start downloads BTCUSDT data from Binance.')
)
insert into registry.product_service_provider_links(product_id,provider_id,relation_type,source,confidence,evidence_uri,last_verified_at,notes)
select p.id,sp.id,l.relation_type,'github-discovery',l.confidence,l.evidence_uri,now(),l.notes
from l join registry.products p on p.slug=l.product_slug join registry.service_providers sp on sp.slug=l.provider_slug
on conflict(product_id,provider_id,relation_type) do update set source=excluded.source,confidence=excluded.confidence,evidence_uri=excluded.evidence_uri,last_verified_at=excluded.last_verified_at,notes=excluded.notes,updated_at=now();

update registry.products set product_type='application', lifecycle_status='active', metadata=metadata || jsonb_build_object('classification_source','github:README','classification_confidence',0.98), updated_at=now() where slug='test-english';

commit;
