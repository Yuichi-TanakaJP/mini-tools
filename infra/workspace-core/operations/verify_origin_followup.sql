-- Full read-only acceptance. Bind the private manifest AND its independently
-- retrieved JSONB-text MD5 in one transaction. No private data in this file.
-- Full JSONB metadata equality is deliberate: extra keys also require review.
-- Exact audit instants are not in manifest v1; preserve them, check verification
-- presence, and never substitute replay time for historical verification time.
DO $verify$
-- BEGIN SHARED ACCEPTANCE
DECLARE
  m jsonb := nullif(current_setting('workspace_core.origin_followup_manifest',true),'')::jsonb;
  b constant text := 'origin-followup-583-588-v1';
  d jsonb; x jsonb; got jsonb; want jsonb;
  rs jsonb := '{}'::jsonb; ki jsonb := '{}'::jsonb; ev jsonb := '{}'::jsonb;
BEGIN
  IF m IS NULL OR m->>'batch' IS DISTINCT FROM b OR m->>'version' IS DISTINCT FROM '1'
     OR jsonb_typeof(m->'resources') IS DISTINCT FROM 'array'
     OR jsonb_typeof(m->'items') IS DISTINCT FROM 'array'
     OR jsonb_typeof(m->'events') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'origin follow-up: invalid manifest';
  END IF;
  IF nullif(current_setting('workspace_core.origin_followup_expected_md5',true),'') IS DISTINCT FROM md5(m::text) THEN
    RAISE EXCEPTION 'origin follow-up: missing or mismatched independent manifest checksum';
  END IF;
  IF jsonb_array_length(m->'resources')<>8 OR jsonb_array_length(m->'items')<>8
     OR jsonb_array_length(m->'events')<>6 THEN
    RAISE EXCEPTION 'origin follow-up: invalid manifest counts';
  END IF;
  IF nullif(btrim(m->>'predecessor_evidence_url'),'') IS NULL
     OR (m->>'predecessor_evidence_url') !~ '^https://github[.]com/[^/]+/[^/]+/blob/[0-9a-f]{40}/.+'
     OR (SELECT count(*) FROM jsonb_array_elements(m->'resources') r
         WHERE r->>'system'='github' AND r->>'type'='github_commit'
           AND nullif(r#>>'{metadata,evidence_path}','') IS NOT NULL
           AND m->>'predecessor_evidence_url' = replace(r->>'url','/commit/','/blob/') || '/' || (r#>>'{metadata,evidence_path}'))<>1 THEN
    RAISE EXCEPTION 'origin follow-up: predecessor needs exactly one immutable evidence resource';
  END IF;
  IF (SELECT count(*) FROM registry.products WHERE slug IN ('todo-app','test-antigravity','sensoria-portfolio'))<>3
     OR NOT EXISTS(SELECT 1 FROM registry.products WHERE slug='test-antigravity' AND lifecycle_status='archived' AND importance=0) THEN
    RAISE EXCEPTION 'origin follow-up: product prerequisites changed';
  END IF;
  FOR d IN SELECT value FROM jsonb_array_elements(m->'resources') LOOP
    IF jsonb_typeof(d->'metadata') IS DISTINCT FROM 'object'
       OR d->>'system' IS NULL OR d->>'system' NOT IN ('github','supabase')
       OR nullif(d->>'key','') IS NULL THEN
      RAISE EXCEPTION 'origin follow-up: invalid evidence definition';
    END IF;
  END LOOP;
  FOR d IN SELECT value FROM jsonb_array_elements((m->'items') || (m->'events')) LOOP
    IF jsonb_typeof(d->'metadata') IS DISTINCT FROM 'object'
       OR jsonb_typeof(d->'products') IS DISTINCT FROM 'array'
       OR jsonb_typeof(d->'resources') IS DISTINCT FROM 'array'
       OR nullif(d->>'key','') IS NULL THEN
      RAISE EXCEPTION 'origin follow-up: invalid item/event definition';
    END IF;
    FOR x IN SELECT value FROM jsonb_array_elements(d->'products') LOOP
      IF jsonb_typeof(x) IS DISTINCT FROM 'array' OR jsonb_array_length(x)<>2
         OR x->>0 IS NULL OR x->>0 NOT IN ('todo-app','test-antigravity','sensoria-portfolio')
         OR nullif(x->>1,'') IS NULL THEN
        RAISE EXCEPTION 'origin follow-up: invalid product association';
      END IF;
    END LOOP;
  END LOOP;
  FOR d IN SELECT value FROM jsonb_array_elements(m->'resources') LOOP
    SELECT to_jsonb(t) INTO STRICT got FROM registry.external_resources t WHERE source_system_id=(SELECT id FROM platform.source_systems WHERE code=d->>'system') AND external_id=d->>'external_id' AND resource_type=d->>'type';
    want := jsonb_build_object('source_system_id',(SELECT id FROM platform.source_systems WHERE code=d->>'system'),'external_id',d->>'external_id','resource_type',d->>'type','title',d->>'title','url',d->>'url','summary',d->>'summary','status','active','metadata',(d->'metadata')||jsonb_build_object('seed_batch',b,'definition_hash',md5(d::text)));
    IF (SELECT jsonb_object_agg(keys.name,got->keys.name) FROM jsonb_object_keys(want) AS keys(name)) IS DISTINCT FROM want THEN
      RAISE EXCEPTION 'origin follow-up: resources definition/semantic metadata conflict';
    END IF;
    rs := rs || jsonb_build_object(d->>'key',got->'id');
  END LOOP;
  IF (SELECT count(*) FROM jsonb_object_keys(rs))<>8 OR (SELECT count(*) FROM registry.external_resources WHERE metadata->>'seed_batch'=b)<>8 THEN RAISE EXCEPTION 'origin follow-up: resources identity set conflict'; END IF;
  FOR d IN SELECT value FROM jsonb_array_elements(m->'items') LOOP
    SELECT to_jsonb(t) INTO STRICT got FROM knowledge.items t WHERE canonical_key=d->>'key';
    want := jsonb_build_object('canonical_key',d->>'key','kind',d->>'kind','title',d->>'title','statement',d->>'statement','lifecycle_status','active','verification_status',d->>'status','source',d->>'source','confidence',(d->>'confidence')::numeric,'metadata',(d->'metadata')||jsonb_build_object('seed_batch',b,'definition_hash',md5(d::text)));
    IF (SELECT jsonb_object_agg(keys.name,got->keys.name) FROM jsonb_object_keys(want) AS keys(name)) IS DISTINCT FROM want THEN
      RAISE EXCEPTION 'origin follow-up: items definition/semantic metadata conflict';
    END IF;
    IF ((got->>'verified_at') IS NOT NULL) IS DISTINCT FROM (d->>'status'='confirmed') THEN RAISE EXCEPTION 'origin follow-up: items verification state conflict'; END IF;
    ki := ki || jsonb_build_object(d->>'key',got->'id');
  END LOOP;
  IF (SELECT count(*) FROM jsonb_object_keys(ki))<>8 OR (SELECT count(*) FROM knowledge.items WHERE metadata->>'seed_batch'=b)<>8 THEN RAISE EXCEPTION 'origin follow-up: items identity set conflict'; END IF;
  FOR d IN SELECT value FROM jsonb_array_elements(m->'events') LOOP
    SELECT to_jsonb(t) INTO STRICT got FROM knowledge.evolution_events t WHERE event_type=d->>'type' AND title=d->>'title' AND period_start IS NOT DISTINCT FROM (d->>'start')::date AND period_end IS NOT DISTINCT FROM (d->>'end')::date;
    want := jsonb_build_object('event_type',d->>'type','title',d->>'title','summary',d->>'summary','period_start',(d->>'start')::date,'period_end',(d->>'end')::date,'time_precision',d->>'precision','verification_status','confirmed','source',d->>'source','confidence',1,'metadata',(d->'metadata')||jsonb_build_object('seed_batch',b,'definition_hash',md5(d::text),'event_key',d->>'key'));
    IF (SELECT jsonb_object_agg(keys.name,got->keys.name) FROM jsonb_object_keys(want) AS keys(name)) IS DISTINCT FROM want THEN
      RAISE EXCEPTION 'origin follow-up: events definition/semantic metadata conflict';
    END IF;
    IF got->>'verified_at' IS NULL THEN RAISE EXCEPTION 'origin follow-up: events verification state conflict'; END IF;
    ev := ev || jsonb_build_object(d->>'key',got->'id');
  END LOOP;
  IF (SELECT count(*) FROM jsonb_object_keys(ev))<>6 OR (SELECT count(*) FROM knowledge.evolution_events WHERE metadata->>'seed_batch'=b)<>6 THEN RAISE EXCEPTION 'origin follow-up: events identity set conflict'; END IF;
  SELECT coalesce(jsonb_agg(v ORDER BY v),'[]'::jsonb) INTO want FROM (
    SELECT jsonb_build_object('item_id',ki->(definition.value->>'key'),'product_id',(SELECT id FROM registry.products WHERE slug=association.value->>0),'relation_type',association.value->>1,'source',b,'confidence',1,'notes',null::text,'verified',true) v
    FROM jsonb_array_elements(m->'items') AS definition(value)
    CROSS JOIN LATERAL jsonb_array_elements(definition.value->'products') AS association(value)
  ) expected;
  SELECT coalesce(jsonb_agg(v ORDER BY v),'[]'::jsonb) INTO got FROM (
    SELECT (to_jsonb(t)-ARRAY['created_at','updated_at','verified_at'])||jsonb_build_object('verified',t.verified_at IS NOT NULL) v FROM knowledge.item_products t WHERE t.item_id::text IN (SELECT value FROM jsonb_each_text(ki)) OR t.source=b
  ) actual;
  IF jsonb_array_length(want)<>8 OR got IS DISTINCT FROM want THEN
    RAISE EXCEPTION 'origin follow-up: knowledge.item_products association set/provenance conflict';
  END IF;
  SELECT coalesce(jsonb_agg(v ORDER BY v),'[]'::jsonb) INTO want FROM (
    SELECT jsonb_build_object('item_id',ki->(definition.value->>'key'),'resource_id',rs->(association.value#>>'{}'),'relation_type','evidenced_by','source',b,'confidence',1,'notes','Evidence supports the attributed report; subjective evaluations and hypotheses are not external benchmarks.','verified',true) v
    FROM jsonb_array_elements(m->'items') AS definition(value)
    CROSS JOIN LATERAL jsonb_array_elements(definition.value->'resources') AS association(value)
  ) expected;
  SELECT coalesce(jsonb_agg(v ORDER BY v),'[]'::jsonb) INTO got FROM (
    SELECT (to_jsonb(t)-ARRAY['created_at','updated_at','verified_at'])||jsonb_build_object('verified',t.verified_at IS NOT NULL) v FROM knowledge.item_resources t WHERE t.item_id::text IN (SELECT value FROM jsonb_each_text(ki)) OR t.source=b
  ) actual;
  IF jsonb_array_length(want)<>9 OR got IS DISTINCT FROM want THEN
    RAISE EXCEPTION 'origin follow-up: knowledge.item_resources association set/provenance conflict';
  END IF;
  SELECT coalesce(jsonb_agg(v ORDER BY v),'[]'::jsonb) INTO want FROM (
    SELECT jsonb_build_object('event_id',ev->(definition.value->>'key'),'product_id',(SELECT id FROM registry.products WHERE slug=association.value->>0),'role',association.value->>1,'source',b,'confidence',1,'notes',null::text,'verified',true) v
    FROM jsonb_array_elements(m->'events') AS definition(value)
    CROSS JOIN LATERAL jsonb_array_elements(definition.value->'products') AS association(value)
  ) expected;
  SELECT coalesce(jsonb_agg(v ORDER BY v),'[]'::jsonb) INTO got FROM (
    SELECT (to_jsonb(t)-ARRAY['created_at','updated_at','verified_at'])||jsonb_build_object('verified',t.verified_at IS NOT NULL) v FROM knowledge.evolution_event_products t WHERE t.event_id::text IN (SELECT value FROM jsonb_each_text(ev)) OR t.source=b
  ) actual;
  IF jsonb_array_length(want)<>6 OR got IS DISTINCT FROM want THEN
    RAISE EXCEPTION 'origin follow-up: knowledge.evolution_event_products association set/provenance conflict';
  END IF;
  SELECT coalesce(jsonb_agg(v ORDER BY v),'[]'::jsonb) INTO want FROM (
    SELECT jsonb_build_object('event_id',ev->(definition.value->>'key'),'resource_id',rs->(association.value#>>'{}'),'relation_type','evidence','notes',b) v
    FROM jsonb_array_elements(m->'events') AS definition(value)
    CROSS JOIN LATERAL jsonb_array_elements(definition.value->'resources') AS association(value)
  ) expected;
  SELECT coalesce(jsonb_agg(v ORDER BY v),'[]'::jsonb) INTO got FROM (
    SELECT (to_jsonb(t)-ARRAY['created_at','updated_at','verified_at']) v FROM knowledge.evolution_event_resources t WHERE t.event_id::text IN (SELECT value FROM jsonb_each_text(ev)) OR t.notes=b
  ) actual;
  IF jsonb_array_length(want)<>10 OR got IS DISTINCT FROM want THEN
    RAISE EXCEPTION 'origin follow-up: knowledge.evolution_event_resources association set/provenance conflict';
  END IF;
  SELECT coalesce(jsonb_agg(v ORDER BY v),'[]'::jsonb) INTO want FROM (
    SELECT jsonb_build_object('event_id',ev->(definition.value->>'key'),'item_id',ki->(association.value->>0),'role',association.value->>1,'source',b,'confidence',1,'notes',null::text,'verified',true) v
    FROM jsonb_array_elements(m->'events') AS definition(value)
    CROSS JOIN LATERAL jsonb_array_elements(definition.value->'items') AS association(value)
  ) expected;
  SELECT coalesce(jsonb_agg(v ORDER BY v),'[]'::jsonb) INTO got FROM (
    SELECT (to_jsonb(t)-ARRAY['created_at','updated_at','verified_at'])||jsonb_build_object('verified',t.verified_at IS NOT NULL) v FROM knowledge.evolution_event_items t WHERE t.event_id::text IN (SELECT value FROM jsonb_each_text(ev)) OR t.source=b
  ) actual;
  IF jsonb_array_length(want)<>9 OR got IS DISTINCT FROM want THEN
    RAISE EXCEPTION 'origin follow-up: knowledge.evolution_event_items association set/provenance conflict';
  END IF;
  want := jsonb_build_array(jsonb_build_object(
    'source_product_id',(SELECT id FROM registry.products WHERE slug='test-antigravity'),
    'target_product_id',(SELECT id FROM registry.products WHERE slug='sensoria-portfolio'),
    'relation_type','predecessor_of','source',b,'confidence',1,'verified',true,
    'notes','Historical predecessor, not a runtime dependency. Evidence: '||(m->>'predecessor_evidence_url')));
  SELECT coalesce(jsonb_agg((to_jsonb(t)-ARRAY['created_at','updated_at','verified_at'])||jsonb_build_object('verified',t.verified_at IS NOT NULL)),'[]'::jsonb)
  INTO got FROM registry.product_relations t
  WHERE t.source=b OR (t.source_product_id=(SELECT id FROM registry.products WHERE slug='test-antigravity')
      AND t.target_product_id=(SELECT id FROM registry.products WHERE slug='sensoria-portfolio') AND t.relation_type='predecessor_of');
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION 'origin follow-up: predecessor evidence/provenance conflict'; END IF;
  IF (SELECT count(*) FROM knowledge.items WHERE metadata->>'seed_batch'=b AND verification_status='provisional')<>2
     OR (SELECT count(*) FROM knowledge.items WHERE metadata->>'seed_batch'=b AND metadata->>'scope'='workspace')<>2
     OR EXISTS(SELECT 1 FROM knowledge.items i JOIN knowledge.item_products p ON p.item_id=i.id WHERE i.metadata->>'seed_batch'=b AND i.metadata->>'scope'='workspace') THEN
    RAISE EXCEPTION 'origin follow-up: hypothesis/workspace ownership conflict';
  END IF;
  IF (SELECT count(*) FROM knowledge.evolution_events WHERE metadata->>'seed_batch'=b AND time_precision='unknown' AND period_start IS NULL AND period_end IS NULL)<>2
     OR (SELECT count(*) FROM knowledge.evolution_events WHERE metadata->>'seed_batch'=b AND time_precision='month')<>1
     OR (SELECT count(*) FROM knowledge.evolution_events WHERE metadata->>'seed_batch'=b AND time_precision='day')<>3 THEN
    RAISE EXCEPTION 'origin follow-up: historical precision conflict';
  END IF;
END;
-- END SHARED ACCEPTANCE
$verify$;
SELECT 'passed' AS origin_followup_acceptance;
