-- Workspace Core V3
-- Add covering indexes for V3 foreign keys reported by Supabase performance advisor.

begin;

create index if not exists flow_edges_source_step_version_idx
  on flow.flow_edges(source_step_id, version_id);
create index if not exists flow_edges_target_step_version_idx
  on flow.flow_edges(target_step_id, version_id);
create index if not exists flow_knowledge_links_relation_type_idx
  on flow.flow_knowledge_links(relation_type);
create index if not exists flow_versions_based_on_version_id_idx
  on flow.flow_versions(based_on_version_id)
  where based_on_version_id is not null;
create index if not exists value_flows_domain_id_idx
  on flow.value_flows(domain_id)
  where domain_id is not null;

create index if not exists evolution_event_relations_target_idx
  on knowledge.evolution_event_relations(target_event_id);
create index if not exists item_capabilities_relation_type_idx
  on knowledge.item_capabilities(relation_type);
create index if not exists item_product_functions_relation_type_idx
  on knowledge.item_product_functions(relation_type);
create index if not exists item_products_relation_type_idx
  on knowledge.item_products(relation_type);
create index if not exists item_relations_relation_type_idx
  on knowledge.item_relations(relation_type);
create index if not exists item_resources_relation_type_idx
  on knowledge.item_resources(relation_type);
create index if not exists item_technologies_relation_type_idx
  on knowledge.item_technologies(relation_type);
create index if not exists knowledge_items_domain_id_idx
  on knowledge.items(domain_id)
  where domain_id is not null;
create index if not exists knowledge_items_supersedes_item_id_idx
  on knowledge.items(supersedes_item_id)
  where supersedes_item_id is not null;

commit;
