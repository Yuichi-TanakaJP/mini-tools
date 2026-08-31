-- Reconcile the evidence-backed discovery state that existed before 006/007.
-- This file intentionally repeats master upserts so a fresh bootstrap does not depend
-- on live-only rows that were discovered interactively.

begin;

insert into registry.technologies (slug,name,category,layer,metadata) values
 ('boto3','boto3','library','integration','{}'),('docker','Docker','container','infrastructure','{}'),
 ('fastapi','FastAPI','framework','backend','{}'),('fastembed','FastEmbed','library','ai','{}'),
 ('javascript','JavaScript','language','application','{}'),('mui','Material UI','framework','frontend','{}'),
 ('nextjs','Next.js','framework','fullstack','{}'),('notion-client','Notion Client','library','integration','{}'),
 ('pandas','pandas','library','data','{}'),('playwright','Playwright','automation','testing-and-scraping','{}'),
 ('prisma','Prisma','orm','data','{}'),('python','Python','language','runtime','{}'),
 ('qdrant-client','Qdrant Client','library','data','{}'),('react','React','framework','frontend','{}'),
 ('streamlit','Streamlit','framework','frontend','{}'),('tailwind-css','Tailwind CSS','framework','frontend','{}'),
 ('typescript','TypeScript','language','application','{}'),('vite','Vite','build-tool','frontend','{}'),
 ('vitest','Vitest','testing','testing','{}'),('youtube-transcript-api','YouTube Transcript API','library','integration','{}')
on conflict(slug) do update set name=excluded.name,category=excluded.category,layer=excluded.layer,updated_at=now();

insert into registry.service_providers(slug,name,category,metadata) values
 ('line','LINE','messaging','{}'),('qdrant','Qdrant','vector-database','{}'),('youtube','YouTube','media-platform','{}')
on conflict(slug) do update set name=excluded.name,category=excluded.category,updated_at=now();

with l(product_slug,tech_slug,role,version,evidence_uri,confidence,notes) as (values
 ('data-gallery','mui','ui-component-library','^7.3.1','github:data-gallery/package.json',1.000,null),
 ('data-gallery','nextjs','fullstack_framework',null,'https://github.com/Yuichi-TanakaJP/data-gallery/blob/main/next.config.ts',1.000,null),
 ('data-gallery','react','ui-framework','19.1.0','github:data-gallery/package.json',1.000,null),
 ('data-gallery','tailwind-css','css-framework','^4','github:data-gallery/package.json',1.000,null),
 ('data-gallery','typescript','application_language',null,'https://github.com/Yuichi-TanakaJP/data-gallery/blob/main/tsconfig.json',0.980,null),
 ('market-info','boto3','object_storage_client','>=1.35','https://github.com/Yuichi-TanakaJP/market_info/blob/main/pyproject.toml',1.000,null),
 ('market-info','docker','containerization',null,'https://github.com/Yuichi-TanakaJP/market-info-api/blob/main/Dockerfile',1.000,'API repository is part of Market Info product'),
 ('market-info','fastapi','api-framework','>=0.110','https://github.com/Yuichi-TanakaJP/market-info-api/blob/main/pyproject.toml',1.000,'API repository is part of Market Info product'),
 ('market-info','pandas','data_processing','>=2.0','https://github.com/Yuichi-TanakaJP/market_info/blob/main/pyproject.toml',1.000,null),
 ('market-info','playwright','browser_automation','>=1.46','https://github.com/Yuichi-TanakaJP/market_info/blob/main/pyproject.toml',1.000,'Direct dependency'),
 ('market-info','python','application_language','>=3.9','https://github.com/Yuichi-TanakaJP/market_info/blob/main/pyproject.toml',1.000,'Project runtime'),
 ('market-info','streamlit','optional_viewer','>=1.30','https://github.com/Yuichi-TanakaJP/market_info/blob/main/pyproject.toml',1.000,null),
 ('mini-tools','nextjs','fullstack_framework','16.0.10','https://github.com/Yuichi-TanakaJP/mini-tools/blob/main/package.json',1.000,'Direct dependency'),
 ('mini-tools','playwright','ui_testing','1.59.1','https://github.com/Yuichi-TanakaJP/mini-tools/blob/main/package.json',1.000,'Dev dependency'),
 ('mini-tools','react','frontend_framework','19.2.3','https://github.com/Yuichi-TanakaJP/mini-tools/blob/main/package.json',1.000,'Direct dependency'),
 ('mini-tools','typescript','application_language','5.9.3','https://github.com/Yuichi-TanakaJP/mini-tools/blob/main/package.json',1.000,'Dev dependency and Next.js source'),
 ('mini-tools','vitest','unit_testing','4.1.2','https://github.com/Yuichi-TanakaJP/mini-tools/blob/main/package.json',1.000,null),
 ('notion-script','notion-client','notion-api-client','2.3.0','github:notion-script/requirements.txt',1.000,null),
 ('notion-script','python','application-language',null,'github:notion-script/requirements.txt',0.950,null),
 ('pc-saas-health-monitor','python','backend-language','3.12','https://github.com/Yuichi-TanakaJP/pc-saas-health-monitor/blob/main/README.md',1.000,'README setup specifies Python 3.12'),
 ('pc-saas-health-monitor','react','ui-framework',null,'https://github.com/Yuichi-TanakaJP/pc-saas-health-monitor/blob/main/README.md',1.000,null),
 ('pc-saas-health-monitor','typescript','frontend-language',null,'https://github.com/Yuichi-TanakaJP/pc-saas-health-monitor/blob/main/README.md',1.000,null),
 ('pc-saas-health-monitor','vite','frontend-build','8.x','https://github.com/Yuichi-TanakaJP/pc-saas-health-monitor/blob/main/README.md',1.000,null),
 ('rag-workbench','fastembed','embedding-runtime','>=0.3','github:rag-workbench/requirements.txt',1.000,null),
 ('rag-workbench','python','application-language',null,'github:rag-workbench/requirements.txt',0.950,null),
 ('rag-workbench','qdrant-client','vector-database-client','>=1.9','github:rag-workbench/requirements.txt',1.000,null),
 ('sensoria-portfolio','react','ui-framework','^19.2.0','github:sensoria-portfolio/package.json',1.000,null),
 ('sensoria-portfolio','typescript','application-language','~5.8.2','github:sensoria-portfolio/package.json',1.000,null),
 ('sensoria-portfolio','vite','frontend-build','^6.2.0','github:sensoria-portfolio/package.json',1.000,null),
 ('stock-notes','docker','container_runtime',null,'https://github.com/Yuichi-TanakaJP/stock-notes/blob/main/Dockerfile',1.000,'Cloud Build builds Docker image'),
 ('stock-notes','fastapi','backend_framework','>=0.111','https://github.com/Yuichi-TanakaJP/stock-notes/blob/main/pyproject.toml',1.000,'Direct dependency'),
 ('stock-notes','python','application_language','>=3.11','https://github.com/Yuichi-TanakaJP/stock-notes/blob/main/pyproject.toml',1.000,'Project runtime'),
 ('test-line-news','python','application-language','>=3.10','github:test_line_news/pyproject.toml',1.000,null),
 ('test-line-news','youtube-transcript-api','youtube-transcript-client',null,'github:test_line_news/pyproject.toml',1.000,null),
 ('todo-app','react','frontend_framework','19.1.0','https://github.com/Yuichi-TanakaJP/todo-app/blob/main/package.json',1.000,null),
 ('todo-app','typescript','frontend_language','~5.8.3','https://github.com/Yuichi-TanakaJP/todo-app/blob/main/package.json',1.000,null),
 ('todo-app','vite','frontend_build','6.3.5','https://github.com/Yuichi-TanakaJP/todo-app/blob/main/package.json',1.000,null)
)
insert into registry.product_technologies(product_id,technology_id,role,version,source,confidence,evidence_uri,last_verified_at,notes)
select p.id,t.id,l.role,l.version,'github-discovery',l.confidence,l.evidence_uri,now(),l.notes
from l join registry.products p on p.slug=l.product_slug join registry.technologies t on t.slug=l.tech_slug
on conflict(product_id,technology_id) do update set role=excluded.role,version=excluded.version,source=excluded.source,confidence=excluded.confidence,evidence_uri=excluded.evidence_uri,last_verified_at=excluded.last_verified_at,notes=excluded.notes,updated_at=now();

with l(product_slug,provider_slug,relation_type,evidence_uri,confidence,notes) as (values
 ('data-gallery','supabase','uses_database_platform','https://github.com/Yuichi-TanakaJP/data-gallery/tree/main/supabase',0.950,'Supabase directory exists; concrete project ref not yet identified.'),
 ('market-info','cloudflare','uses_object_storage','https://github.com/Yuichi-TanakaJP/market_info/blob/main/.env.example',1.000,'R2 credentials configured'),
 ('market-info','google-cloud','deployment_target','https://github.com/Yuichi-TanakaJP/market-info-api/blob/main/.env.example',1.000,'Comments explicitly reference Cloud Run'),
 ('mini-tools','supabase','uses_database_platform','https://github.com/Yuichi-TanakaJP/mini-tools/blob/main/package.json',1.000,'Concrete mini-tools instance is separately linked.'),
 ('notion-script','notion','uses_api','https://github.com/Yuichi-TanakaJP/notion-script/blob/master/.env.example',0.980,'Notion integration configuration present.'),
 ('rag-workbench','qdrant','uses_vector_database','github:rag-workbench/requirements.txt',0.980,'Concrete Qdrant instance not identified.'),
 ('stock-notes','google-cloud','deployment_target','https://github.com/Yuichi-TanakaJP/stock-notes/blob/main/cloudbuild.yaml',1.000,'Cloud Build deploys to Cloud Run'),
 ('test-line-news','line','uses_messaging_api','github:test_line_news/.env.example',1.000,'LINE Messaging API credentials are configured for push delivery.'),
 ('test-line-news','youtube','consumes_content_api','github:test_line_news/pyproject.toml',0.950,'Uses youtube-transcript-api for transcript retrieval.'),
 ('pc-saas-health-monitor','anthropic','monitors_service','https://github.com/Yuichi-TanakaJP/pc-saas-health-monitor/blob/main/README.md',0.800,'Monitoring target.'),
 ('pc-saas-health-monitor','cloudflare','monitors_service','https://github.com/Yuichi-TanakaJP/pc-saas-health-monitor/blob/main/README.md',0.850,'Monitoring target.'),
 ('pc-saas-health-monitor','github','monitors_service','https://github.com/Yuichi-TanakaJP/pc-saas-health-monitor/blob/main/README.md',0.850,'Monitoring target.'),
 ('pc-saas-health-monitor','google-cloud','monitors_service','https://github.com/Yuichi-TanakaJP/pc-saas-health-monitor/blob/main/README.md',0.850,'Monitoring target.'),
 ('pc-saas-health-monitor','notion','monitors_service','https://github.com/Yuichi-TanakaJP/pc-saas-health-monitor/blob/main/README.md',0.800,'Monitoring target.'),
 ('pc-saas-health-monitor','supabase','monitors_service','https://github.com/Yuichi-TanakaJP/pc-saas-health-monitor/blob/main/README.md',0.850,'Monitoring target.'),
 ('pc-saas-health-monitor','vercel','monitors_service','https://github.com/Yuichi-TanakaJP/pc-saas-health-monitor/blob/main/README.md',0.850,'Monitoring target.')
)
insert into registry.product_service_provider_links(product_id,provider_id,relation_type,source,confidence,evidence_uri,last_verified_at,notes)
select p.id,sp.id,l.relation_type,'github-discovery',l.confidence,l.evidence_uri,now(),l.notes from l join registry.products p on p.slug=l.product_slug join registry.service_providers sp on sp.slug=l.provider_slug
on conflict(product_id,provider_id,relation_type) do update set source=excluded.source,confidence=excluded.confidence,evidence_uri=excluded.evidence_uri,last_verified_at=excluded.last_verified_at,notes=excluded.notes,updated_at=now();

insert into registry.product_relations(source_product_id,target_product_id,relation_type,source,confidence,verified_at,notes)
select a.id,b.id,'consumes_data','github-discovery',1.000,now(),'Reads market_info generated output via MARKET_OUT_ROOT; read-only consumer.'
from registry.products a, registry.products b where a.slug='portfolio-x-post' and b.slug='market-info'
on conflict(source_product_id,target_product_id,relation_type) do update set source=excluded.source,confidence=excluded.confidence,verified_at=excluded.verified_at,notes=excluded.notes,updated_at=now();

update registry.products set product_type='automation', lifecycle_status='active', updated_at=now() where slug='test-line-news';
update registry.products set product_type='knowledge', metadata=metadata || '{"asset_kind":"shared-asset"}'::jsonb, updated_at=now() where slug in ('repo-templates','claude-skills','ideas');

commit;
