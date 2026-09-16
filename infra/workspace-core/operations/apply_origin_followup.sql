-- Workspace Core: additive origin follow-up for mini-tools #583 / #588.
-- No DDL; no private payload, Personal Log IDs, or raw chat in this public file.
-- REQUIRED: explicit transaction; SET LOCAL via set_config() with the private
-- replay_manifest from the canonical mini-tools Workstream audit Update.
-- Example (placeholder is NOT executable):
-- BEGIN; SELECT set_config('workspace_core.origin_followup_manifest', :payload, true);
-- <this file>; ROLLBACK; -- dry run first; use COMMIT only after verification.
-- Replays never overwrite prior rows. Conflicting definitions abort atomically.
DO $seed$
DECLARE
  m jsonb := nullif(current_setting('workspace_core.origin_followup_manifest', true), '')::jsonb;
  batch constant text := 'origin-followup-583-588-v1';
  d jsonb; x jsonb; k text; tbl text; sid uuid; rid uuid; iid uuid; eid uuid; pid uuid;
  resources jsonb := '{}'::jsonb; items jsonb := '{}'::jsonb; events jsonb := '{}'::jsonb;
  protected_before jsonb := '{}'::jsonb; protected_after jsonb;
  first_pass jsonb; this_pass jsonb; digest text; pass integer;
BEGIN
  IF m IS NULL OR m->>'batch' IS DISTINCT FROM batch OR m->>'version' IS DISTINCT FROM '1'
     OR jsonb_typeof(m->'resources') IS DISTINCT FROM 'array'
     OR jsonb_typeof(m->'items') IS DISTINCT FROM 'array'
     OR jsonb_typeof(m->'events') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Private replay_manifest v1 is required; no data changed';
  END IF;
  IF jsonb_array_length(m->'resources') <> 8 OR jsonb_array_length(m->'items') <> 8
     OR jsonb_array_length(m->'events') <> 6 THEN
    RAISE EXCEPTION 'Unexpected manifest size for origin follow-up v1';
  END IF;
  IF (SELECT count(*) FROM registry.products WHERE slug IN
      ('todo-app','test-antigravity','sensoria-portfolio')) <> 3
     OR NOT EXISTS (SELECT 1 FROM registry.products WHERE slug='test-antigravity'
                    AND lifecycle_status='archived' AND importance=0) THEN
    RAISE EXCEPTION 'Workspace prerequisites or archived-product guard failed';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(batch, 0));
  FOREACH tbl IN ARRAY ARRAY['registry.products','registry.product_functions',
      'registry.product_capabilities','flow.value_flows','flow.flow_versions',
      'flow.flow_steps','flow.flow_edges'] LOOP
    EXECUTE format('SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)::text, ''[]'')) FROM %s t', tbl) INTO digest;
    protected_before := protected_before || jsonb_build_object(tbl, digest);
  END LOOP;

  -- Two identical passes in the transaction verify idempotence before commit.
  FOR pass IN 1..2 LOOP
    FOR d IN SELECT value FROM jsonb_array_elements(m->'resources') LOOP
      IF d->>'system' NOT IN ('github','supabase') THEN
        RAISE EXCEPTION 'Unsupported evidence system';
      END IF;
      SELECT id INTO STRICT sid FROM platform.source_systems WHERE code=d->>'system';
      INSERT INTO registry.external_resources
        (source_system_id,external_id,resource_type,title,url,summary,status,metadata)
      VALUES (sid,d->>'external_id',d->>'type',d->>'title',d->>'url',d->>'summary','active',
        coalesce(d->'metadata','{}'::jsonb) || jsonb_build_object('seed_batch',batch,'definition_hash',md5(d::text)))
      ON CONFLICT (source_system_id,external_id,resource_type) DO NOTHING;
      SELECT id INTO STRICT rid FROM registry.external_resources
      WHERE source_system_id=sid AND external_id=d->>'external_id' AND resource_type=d->>'type'
        AND title=d->>'title' AND url IS NOT DISTINCT FROM d->>'url'
        AND summary IS NOT DISTINCT FROM d->>'summary' AND status='active'
        AND metadata->>'seed_batch'=batch AND metadata->>'definition_hash'=md5(d::text);
      resources := resources || jsonb_build_object(d->>'key',rid);
    END LOOP;

    FOR d IN SELECT value FROM jsonb_array_elements(m->'items') LOOP
      INSERT INTO knowledge.items
        (canonical_key,kind,title,statement,lifecycle_status,verification_status,source,confidence,verified_at,metadata)
      VALUES (d->>'key',d->>'kind',d->>'title',d->>'statement','active',d->>'status',d->>'source',
        (d->>'confidence')::numeric,CASE WHEN d->>'status'='confirmed' THEN now() END,
        coalesce(d->'metadata','{}'::jsonb) || jsonb_build_object('seed_batch',batch,'definition_hash',md5(d::text)))
      ON CONFLICT (canonical_key) DO NOTHING;
      SELECT id INTO STRICT iid FROM knowledge.items
      WHERE canonical_key=d->>'key' AND kind=d->>'kind' AND title=d->>'title'
        AND statement=d->>'statement' AND lifecycle_status='active'
        AND verification_status=d->>'status' AND source=d->>'source'
        AND confidence=(d->>'confidence')::numeric
        AND metadata->>'seed_batch'=batch AND metadata->>'definition_hash'=md5(d::text);
      items := items || jsonb_build_object(d->>'key',iid);
      FOR x IN SELECT value FROM jsonb_array_elements(d->'products') LOOP
        IF x->>0 NOT IN ('todo-app','test-antigravity','sensoria-portfolio') THEN
          RAISE EXCEPTION 'Out-of-scope product';
        END IF;
        SELECT id INTO STRICT pid FROM registry.products WHERE slug=x->>0;
        INSERT INTO knowledge.item_products(item_id,product_id,relation_type,source,confidence,verified_at)
        VALUES (iid,pid,x->>1,batch,1,now()) ON CONFLICT DO NOTHING;
      END LOOP;
      FOR k IN SELECT jsonb_array_elements_text(d->'resources') LOOP
        rid := (resources->>k)::uuid;
        IF rid IS NULL THEN RAISE EXCEPTION 'Unresolved resource %', k; END IF;
        INSERT INTO knowledge.item_resources(item_id,resource_id,relation_type,source,confidence,verified_at,notes)
        VALUES (iid,rid,'evidenced_by',batch,1,now(),
          'Evidence supports the attributed report; subjective evaluations and hypotheses are not external benchmarks.')
        ON CONFLICT DO NOTHING;
      END LOOP;
    END LOOP;

    FOR d IN SELECT value FROM jsonb_array_elements(m->'events') LOOP
      INSERT INTO knowledge.evolution_events
        (event_type,title,summary,period_start,period_end,time_precision,verification_status,source,confidence,verified_at,metadata)
      VALUES (d->>'type',d->>'title',d->>'summary',(d->>'start')::date,(d->>'end')::date,
        d->>'precision','confirmed',d->>'source',1,now(),
        coalesce(d->'metadata','{}'::jsonb) || jsonb_build_object('seed_batch',batch,'definition_hash',md5(d::text),'event_key',d->>'key'))
      ON CONFLICT DO NOTHING;
      SELECT id INTO STRICT eid FROM knowledge.evolution_events
      WHERE event_type=d->>'type' AND title=d->>'title'
        AND period_start IS NOT DISTINCT FROM (d->>'start')::date
        AND period_end IS NOT DISTINCT FROM (d->>'end')::date
        AND summary=d->>'summary' AND time_precision=d->>'precision'
        AND verification_status='confirmed' AND source=d->>'source'
        AND metadata->>'seed_batch'=batch AND metadata->>'definition_hash'=md5(d::text);
      events := events || jsonb_build_object(d->>'key',eid);
      FOR x IN SELECT value FROM jsonb_array_elements(d->'products') LOOP
        IF x->>0 NOT IN ('todo-app','test-antigravity','sensoria-portfolio') THEN
          RAISE EXCEPTION 'Out-of-scope event product';
        END IF;
        SELECT id INTO STRICT pid FROM registry.products WHERE slug=x->>0;
        INSERT INTO knowledge.evolution_event_products(event_id,product_id,role,source,confidence,verified_at)
        VALUES (eid,pid,x->>1,batch,1,now()) ON CONFLICT DO NOTHING;
      END LOOP;
      FOR k IN SELECT jsonb_array_elements_text(d->'resources') LOOP
        rid := (resources->>k)::uuid;
        IF rid IS NULL THEN RAISE EXCEPTION 'Unresolved event resource %', k; END IF;
        INSERT INTO knowledge.evolution_event_resources(event_id,resource_id,relation_type,notes)
        VALUES (eid,rid,'evidence',batch) ON CONFLICT DO NOTHING;
      END LOOP;
      FOR x IN SELECT value FROM jsonb_array_elements(d->'items') LOOP
        iid := (items->>(x->>0))::uuid;
        IF iid IS NULL THEN RAISE EXCEPTION 'Unresolved event item'; END IF;
        INSERT INTO knowledge.evolution_event_items(event_id,item_id,role,source,confidence,verified_at)
        VALUES (eid,iid,x->>1,batch,1,now()) ON CONFLICT DO NOTHING;
      END LOOP;
    END LOOP;

    INSERT INTO registry.product_relations(source_product_id,target_product_id,relation_type,source,confidence,verified_at,notes)
    SELECT a.id,b.id,'predecessor_of',batch,1,now(),
      'Historical predecessor, not a runtime dependency. Evidence: ' || (m->>'predecessor_evidence_url')
    FROM registry.products a CROSS JOIN registry.products b
    WHERE a.slug='test-antigravity' AND b.slug='sensoria-portfolio'
    ON CONFLICT DO NOTHING;
    IF NOT EXISTS (SELECT 1 FROM registry.product_relations r
        JOIN registry.products a ON a.id=r.source_product_id
        JOIN registry.products b ON b.id=r.target_product_id
        WHERE a.slug='test-antigravity' AND b.slug='sensoria-portfolio'
          AND r.relation_type='predecessor_of' AND r.source=batch) THEN
      RAISE EXCEPTION 'Conflicting predecessor relation';
    END IF;

    IF (SELECT count(*) FROM jsonb_object_keys(resources))<>8
       OR (SELECT count(*) FROM jsonb_object_keys(items))<>8
       OR (SELECT count(*) FROM jsonb_object_keys(events))<>6 THEN
      RAISE EXCEPTION 'Duplicate or unresolved manifest keys';
    END IF;
    IF EXISTS (SELECT 1 FROM knowledge.items i WHERE i.metadata->>'seed_batch'=batch
        AND NOT EXISTS (SELECT 1 FROM knowledge.item_resources r WHERE r.item_id=i.id))
       OR EXISTS (SELECT 1 FROM knowledge.evolution_events e WHERE e.metadata->>'seed_batch'=batch
        AND NOT EXISTS (SELECT 1 FROM knowledge.evolution_event_resources r WHERE r.event_id=e.id)) THEN
      RAISE EXCEPTION 'Missing evidence link';
    END IF;
    protected_after := '{}'::jsonb;
    FOREACH tbl IN ARRAY ARRAY['registry.products','registry.product_functions',
        'registry.product_capabilities','flow.value_flows','flow.flow_versions',
        'flow.flow_steps','flow.flow_edges'] LOOP
      EXECUTE format('SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)::text, ''[]'')) FROM %s t', tbl) INTO digest;
      protected_after := protected_after || jsonb_build_object(tbl,digest);
    END LOOP;
    IF protected_after IS DISTINCT FROM protected_before THEN
      RAISE EXCEPTION 'Protected inventory changed; rollback required';
    END IF;
    this_pass := '{}'::jsonb;
    FOREACH tbl IN ARRAY ARRAY['registry.external_resources','knowledge.items',
        'knowledge.item_products','knowledge.item_resources','knowledge.evolution_events',
        'knowledge.evolution_event_products','knowledge.evolution_event_items',
        'knowledge.evolution_event_resources','registry.product_relations'] LOOP
      EXECUTE format('SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)::text, ''[]'')) FROM %s t', tbl) INTO digest;
      this_pass := this_pass || jsonb_build_object(tbl,digest);
    END LOOP;
    IF pass=1 THEN first_pass:=this_pass;
    ELSIF this_pass IS DISTINCT FROM first_pass THEN
      RAISE EXCEPTION 'Second pass changed rows: idempotence failure';
    END IF;
  END LOOP;
  PERFORM set_config('workspace_core.origin_followup_result',
    jsonb_build_object('batch',batch,'manifest_md5',md5(m::text),'resources',8,'items',8,'events',6,
      'idempotence','passed','protected_inventory','unchanged','fingerprints',this_pass)::text,true);
END;
$seed$;
SELECT current_setting('workspace_core.origin_followup_result')::jsonb AS origin_followup_result;
