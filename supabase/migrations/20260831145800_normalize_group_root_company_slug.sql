begin;

-- Issue #559
-- `root_company_slug` is the canonical metadata key consumed by Company Network.
-- Some older group records, notably NTT, stored the same concept as
-- `top_company_slug`. Copy the existing value only when root_company_slug is
-- absent; this does not introduce a new business fact.

update stock_notes_corporate_groups
set metadata = jsonb_set(metadata, '{root_company_slug}', to_jsonb(metadata->>'top_company_slug'), true),
    updated_at = now()
where status = 'active'
  and valid_to is null
  and jsonb_typeof(metadata) = 'object'
  and nullif(btrim(metadata->>'root_company_slug'), '') is null
  and nullif(btrim(metadata->>'top_company_slug'), '') is not null;

commit;
