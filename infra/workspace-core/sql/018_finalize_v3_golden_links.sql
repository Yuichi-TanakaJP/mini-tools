-- Workspace Core V3
-- Finalize links that depend on rows created earlier in the Golden Dataset seed.
-- Kept separate so a fresh bootstrap reaches the same final state in one ordered pass.

begin;

update flow.flow_versions proposed
set based_on_version_id = base.id,
    updated_at = now()
from flow.value_flows f,
     flow.flow_versions base
where proposed.flow_id = f.id
  and base.flow_id = f.id
  and f.slug = 'youtube-investment-signal-to-decision'
  and proposed.version_number = 2
  and base.version_number = 1
  and proposed.based_on_version_id is distinct from base.id;

commit;
