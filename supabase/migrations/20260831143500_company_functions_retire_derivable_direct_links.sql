begin;

-- Issue #555
-- Phase C (#553) temporarily materialized company-functions links so the current
-- Company Network loader could display Sony/Hitachi specialist taxonomy data.
-- After the read model learns to derive company-functions through cross-domain
-- mappings, those materialized links become duplicate facts.
--
-- Retire only links that:
--   1. were created by Issue #553 normalization,
--   2. are currently active, and
--   3. can be reproduced from an active specialist taxonomy company link plus
--      a cross-domain related_to mapping into the same company-functions node.
--
-- Non-derivable explicit exceptions remain active.

with derivable_phase_c_links as (
  select direct.id
  from stock_notes_company_taxonomy_links direct
  join stock_notes_taxonomy_nodes target
    on target.user_id = direct.user_id
   and target.id = direct.node_id
   and target.domain = 'company-functions'
   and target.kind = 'product_segment'
  where direct.valid_to is null
    and direct.relation_note like '%Issue #553.%'
    and exists (
      select 1
      from stock_notes_taxonomy_edges mapping
      join stock_notes_company_taxonomy_links source_link
        on source_link.user_id = direct.user_id
       and source_link.company_entity_id = direct.company_entity_id
       and source_link.node_id = mapping.source_node_id
       and source_link.valid_to is null
      where mapping.user_id = direct.user_id
        and mapping.domain = 'cross-domain'
        and mapping.relation_type = 'related_to'
        and mapping.target_node_id = direct.node_id
    )
)
update stock_notes_company_taxonomy_links link
set valid_to = now(),
    updated_at = now()
where link.id in (select id from derivable_phase_c_links);

commit;
