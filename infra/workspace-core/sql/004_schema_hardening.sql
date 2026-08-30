-- Workspace Core V1 schema hardening.
-- Apply after 001-003 for the initial bootstrap.

begin;

-- A provider can have the same project/deployment name in multiple organizations,
-- teams, or accounts. Keep that scope explicit instead of treating provider+name
-- as globally unique.
alter table registry.service_instances
  add column if not exists account_scope text not null default 'personal';

alter table registry.service_instances
  drop constraint if exists service_instances_provider_id_name_environment_key;

alter table registry.service_instances
  add constraint service_instances_provider_scope_name_environment_key
  unique (provider_id, account_scope, name, environment);

comment on column registry.service_instances.account_scope is
  'Organization/team/account scope within the provider. Use a stable external scope ID when available; personal is the V1 fallback.';

-- Secondary-side FK indexes keep reverse graph traversal efficient and avoid
-- unnecessary sequential scans as the registry grows.
create index if not exists products_domain_id_idx
  on registry.products(domain_id);

create index if not exists product_repositories_repository_id_idx
  on registry.product_repositories(repository_id);

create index if not exists product_technologies_technology_id_idx
  on registry.product_technologies(technology_id);

create index if not exists product_service_links_service_instance_id_idx
  on registry.product_service_links(service_instance_id);

create index if not exists product_relations_target_product_id_idx
  on registry.product_relations(target_product_id);

create index if not exists product_resources_resource_id_idx
  on registry.product_resources(resource_id);

create index if not exists sync_runs_source_system_id_idx
  on ops.sync_runs(source_system_id);

-- Operational counters should never be negative.
alter table ops.sync_runs
  drop constraint if exists sync_runs_records_seen_nonnegative;
alter table ops.sync_runs
  add constraint sync_runs_records_seen_nonnegative check (records_seen >= 0);

alter table ops.sync_runs
  drop constraint if exists sync_runs_records_inserted_nonnegative;
alter table ops.sync_runs
  add constraint sync_runs_records_inserted_nonnegative check (records_inserted >= 0);

alter table ops.sync_runs
  drop constraint if exists sync_runs_records_updated_nonnegative;
alter table ops.sync_runs
  add constraint sync_runs_records_updated_nonnegative check (records_updated >= 0);

commit;
