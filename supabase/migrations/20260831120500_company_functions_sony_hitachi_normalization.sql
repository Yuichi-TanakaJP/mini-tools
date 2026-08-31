begin;

-- Issue #553
-- Extend the cross-group company-functions ontology using existing Sony/Hitachi
-- taxonomy evidence. This migration is intentionally idempotent and does not
-- introduce new tables.

with scoped_users as (
  select distinct user_id
  from stock_notes_corporate_groups
  where slug in ('sony-group-network', 'hitachi-group')
), node_defs(kind, slug, display_name, description, layer) as (
  values
    ('classification', 'content-entertainment', 'コンテンツ・エンタメ', 'ゲーム・音楽・映像・アニメなどのIP/コンテンツ事業を横断比較する分類。', 1),
    ('classification', 'electronics-semiconductors', 'エレクトロニクス・半導体', '電子機器・半導体・センサー・製造装置を横断比較する分類。', 1),
    ('product_segment', 'games', 'ゲーム', 'ゲーム開発・ゲームプラットフォーム等。', 2),
    ('product_segment', 'music', '音楽', '音楽制作・レーベル・音楽IP等。', 2),
    ('product_segment', 'film-video', '映画・映像', '映画・TV・映像コンテンツ等。', 2),
    ('product_segment', 'anime-ip', 'アニメ・IP', 'アニメ企画・制作・配信・IP展開等。', 2),
    ('product_segment', 'semiconductor-sensors', '半導体・センサー', 'イメージセンサー等の半導体・センサー事業。', 2),
    ('product_segment', 'semiconductor-equipment', '半導体製造装置', '半導体製造・計測装置等。', 2),
    ('product_segment', 'ai-cloud-data', 'AI・クラウド・データ', 'AI・クラウド・データ基盤・デジタルエンジニアリング等。', 2),
    ('product_segment', 'power-energy', '電力・エネルギー', '発電・送配電・電力網などのエネルギーインフラ。', 2),
    ('product_segment', 'rail', '鉄道', '鉄道車両・信号・デジタル鉄道などの鉄道事業。', 2)
)
insert into stock_notes_taxonomy_nodes (
  user_id, domain, kind, slug, display_name, description, status, metadata
)
select
  u.user_id,
  'company-functions',
  d.kind,
  d.slug,
  d.display_name,
  d.description,
  'active',
  jsonb_build_object(
    'layer', d.layer,
    'scope', 'cross-group',
    'ontology_version', 'v1.2',
    'normalization_version', '2026-08-31-v1',
    'issue', 553
  )
from scoped_users u
cross join node_defs d
on conflict (user_id, domain, kind, slug)
do update set
  display_name = excluded.display_name,
  description = excluded.description,
  status = 'active',
  metadata = stock_notes_taxonomy_nodes.metadata || excluded.metadata,
  updated_at = now();

-- company-functions hierarchy
with edge_defs(parent_slug, child_slug) as (
  values
    ('content-entertainment', 'games'),
    ('content-entertainment', 'music'),
    ('content-entertainment', 'film-video'),
    ('content-entertainment', 'anime-ip'),
    ('electronics-semiconductors', 'semiconductor-sensors'),
    ('electronics-semiconductors', 'semiconductor-equipment'),
    ('technology-rd', 'ai-cloud-data'),
    ('infrastructure-logistics', 'power-energy'),
    ('infrastructure-logistics', 'rail')
)
insert into stock_notes_taxonomy_edges (
  user_id, domain, source_node_id, target_node_id, relation_type, relation_note
)
select
  p.user_id,
  'company-functions',
  p.id,
  c.id,
  'contains',
  'Company-functions ontology v1.2 expansion for Sony/Hitachi pilot (Issue #553).'
from edge_defs d
join stock_notes_taxonomy_nodes p
  on p.domain = 'company-functions'
 and p.kind = 'classification'
 and p.slug = d.parent_slug
join stock_notes_taxonomy_nodes c
  on c.user_id = p.user_id
 and c.domain = 'company-functions'
 and c.kind = 'product_segment'
 and c.slug = d.child_slug
on conflict (user_id, source_node_id, target_node_id, relation_type) do nothing;

-- Explicit cross-domain normalization edges. These preserve the semantic bridge
-- from existing specialist taxonomies to the group-comparison ontology.
with normalization_defs(source_domain, source_kind, source_slug, target_slug) as (
  values
    ('ip-content', 'product_segment', 'games', 'games'),
    ('ip-content', 'product_segment', 'music', 'music'),
    ('ip-content', 'product_segment', 'film', 'film-video'),
    ('ip-content', 'product_segment', 'anime', 'anime-ip'),
    ('semiconductors', 'product_segment', 'cmos-image-sensor', 'semiconductor-sensors'),
    ('semiconductors', 'product_segment', 'sensors', 'semiconductor-sensors'),
    ('semiconductors', 'classification', 'manufacturing-equipment', 'semiconductor-equipment'),
    ('business-ecosystems', 'product_segment', 'ai-cloud-data', 'ai-cloud-data'),
    ('business-ecosystems', 'classification', 'finance-led', 'finance'),
    ('power-energy', 'classification', 'power-energy-infrastructure-industry', 'power-energy'),
    ('built-environment', 'product_segment', 'railway-infrastructure', 'rail'),
    ('built-environment', 'product_segment', 'hvac-systems', 'building-systems')
)
insert into stock_notes_taxonomy_edges (
  user_id, domain, source_node_id, target_node_id, relation_type, relation_note
)
select
  s.user_id,
  'cross-domain',
  s.id,
  t.id,
  'related_to',
  'Normalized into company-functions for cross-group comparison (Issue #553).'
from normalization_defs d
join stock_notes_taxonomy_nodes s
  on s.domain = d.source_domain
 and s.kind = d.source_kind
 and s.slug = d.source_slug
join stock_notes_taxonomy_nodes t
  on t.user_id = s.user_id
 and t.domain = 'company-functions'
 and t.kind = 'product_segment'
 and t.slug = d.target_slug
on conflict (user_id, source_node_id, target_node_id, relation_type) do nothing;

-- Sony/Hitachi pilot mappings. Each mapping is backed by taxonomy evidence that
-- already existed before this migration; no new business fact is inferred here.
with company_function_defs(group_slug, company_name, function_slug, strategic_role, confidence, basis) as (
  values
    ('sony-group-network', 'Crunchyroll', 'anime-ip', 'core', 'high', 'Existing business-ecosystems evidence: アニメ配信・ファン基盤。'),
    ('sony-group-network', 'Sony Music Entertainment', 'music', 'core', 'high', 'Existing business-ecosystems evidence: 音楽IP・グローバル配信。'),
    ('sony-group-network', 'Sony Pictures Entertainment', 'film-video', 'core', 'high', 'Existing business-ecosystems evidence: 映画・TV・映像IP。'),
    ('sony-group-network', 'アニプレックス', 'anime-ip', 'core', 'high', 'Existing business-ecosystems evidence: アニメ企画・制作・IP。'),
    ('sony-group-network', 'ソニー・インタラクティブエンタテインメント', 'games', 'core', 'high', 'Existing business-ecosystems evidence: PlayStation Network・ゲームプラットフォーム。'),
    ('sony-group-network', 'ソニー・ミュージックエンタテインメント', 'music', 'core', 'high', 'Existing business-ecosystems evidence: 国内音楽・アニメIP。'),
    ('sony-group-network', 'ソニー・ミュージックエンタテインメント', 'anime-ip', 'supporting', 'high', 'Existing business-ecosystems evidence: 国内音楽・アニメIP。'),
    ('sony-group-network', 'ソニーセミコンダクタソリューションズ', 'semiconductor-sensors', 'core', 'high', 'Existing semiconductors evidence: CMOSイメージセンサー／センサー半導体。'),
    ('sony-group-network', 'ソニーフィナンシャルグループ', 'finance', 'core', 'high', 'Existing business-ecosystems evidence: 金融起点。'),

    ('hitachi-group', 'GlobalLogic', 'ai-cloud-data', 'core', 'high', 'Existing business-ecosystems evidence: Agentic AI・chip-to-cloud開発。'),
    ('hitachi-group', 'Hitachi Energy', 'power-energy', 'core', 'high', 'Existing power-energy evidence: 送配電・パワーグリッド。'),
    ('hitachi-group', 'Hitachi Rail', 'rail', 'core', 'high', 'Existing built-environment evidence: 鉄道車両・信号・デジタル鉄道。'),
    ('hitachi-group', 'Hitachi Vantara', 'ai-cloud-data', 'core', 'high', 'Existing business-ecosystems evidence: AI時代のデータ基盤。'),
    ('hitachi-group', '日立GEベルノバニュークリアエナジー', 'power-energy', 'core', 'high', 'Existing power-energy evidence: 原子力・SMR電源。'),
    ('hitachi-group', '日立グローバルライフソリューションズ', 'building-systems', 'core', 'high', 'Existing built-environment evidence: 空調設備。'),
    ('hitachi-group', '日立ハイテク', 'semiconductor-equipment', 'core', 'high', 'Existing semiconductors evidence: 半導体製造・計測装置。'),
    ('hitachi-group', '日立ビルシステム', 'building-systems', 'core', 'high', 'Existing taxonomy evidence: 昇降機・ビルサービス／ビル設備保守・更新。')
), resolved as (
  select
    g.user_id,
    c.id as company_entity_id,
    n.id as node_id,
    d.strategic_role,
    d.confidence,
    d.basis
  from company_function_defs d
  join stock_notes_corporate_groups g
    on g.slug = d.group_slug
   and g.status = 'active'
   and g.valid_to is null
  join stock_notes_company_group_memberships gm
    on gm.user_id = g.user_id
   and gm.group_id = g.id
   and gm.valid_to is null
  join stock_notes_company_entities c
    on c.user_id = gm.user_id
   and c.id = gm.company_entity_id
   and c.display_name = d.company_name
  join stock_notes_taxonomy_nodes n
    on n.user_id = g.user_id
   and n.domain = 'company-functions'
   and n.kind = 'product_segment'
   and n.slug = d.function_slug
)
insert into stock_notes_company_taxonomy_links (
  user_id,
  company_entity_id,
  node_id,
  strategic_role,
  control_type,
  relation_note,
  source_type,
  confidence,
  as_of,
  valid_from
)
select
  r.user_id,
  r.company_entity_id,
  r.node_id,
  r.strategic_role,
  'unknown',
  'Normalized from pre-existing taxonomy evidence. ' || r.basis || ' Issue #553.',
  'manual',
  r.confidence,
  now(),
  now()
from resolved r
where not exists (
  select 1
  from stock_notes_company_taxonomy_links existing
  where existing.user_id = r.user_id
    and existing.company_entity_id = r.company_entity_id
    and existing.node_id = r.node_id
    and existing.valid_to is null
);

commit;
