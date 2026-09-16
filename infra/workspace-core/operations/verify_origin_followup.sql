-- Read-only acceptance checks for origin-followup-583-588-v1.
-- This verifies only the scoped follow-up, not the entire database or UI.
DO $verify$
DECLARE b constant text := 'origin-followup-583-588-v1';
BEGIN
  IF (SELECT count(*) FROM knowledge.items WHERE metadata->>'seed_batch'=b)<>8
     OR (SELECT count(*) FROM knowledge.evolution_events WHERE metadata->>'seed_batch'=b)<>6
     OR (SELECT count(*) FROM registry.external_resources WHERE metadata->>'seed_batch'=b)<>8 THEN
    RAISE EXCEPTION 'Unexpected scoped record counts';
  END IF;
  IF (SELECT count(*) FROM knowledge.item_products WHERE source=b)<>8
     OR (SELECT count(*) FROM knowledge.item_resources WHERE source=b)<>9
     OR (SELECT count(*) FROM knowledge.evolution_event_products WHERE source=b)<>6
     OR (SELECT count(*) FROM knowledge.evolution_event_resources WHERE notes=b)<>10
     OR (SELECT count(*) FROM knowledge.evolution_event_items WHERE source=b)<>9 THEN
    RAISE EXCEPTION 'Unexpected scoped relationship counts';
  END IF;
  IF EXISTS (SELECT 1 FROM knowledge.items i WHERE i.metadata->>'seed_batch'=b
       AND NOT EXISTS(SELECT 1 FROM knowledge.item_resources r WHERE r.item_id=i.id))
     OR EXISTS (SELECT 1 FROM knowledge.evolution_events e WHERE e.metadata->>'seed_batch'=b
       AND NOT EXISTS(SELECT 1 FROM knowledge.evolution_event_resources r WHERE r.event_id=e.id)) THEN
    RAISE EXCEPTION 'Missing provenance';
  END IF;
  IF (SELECT count(*) FROM knowledge.items WHERE metadata->>'seed_batch'=b AND verification_status='provisional')<>2
     OR (SELECT count(*) FROM knowledge.items WHERE metadata->>'seed_batch'=b AND metadata->>'scope'='workspace')<>2
     OR EXISTS(SELECT 1 FROM knowledge.items i JOIN knowledge.item_products p ON p.item_id=i.id
               WHERE i.metadata->>'seed_batch'=b AND i.metadata->>'scope'='workspace') THEN
    RAISE EXCEPTION 'Hypothesis status or workspace-level scope changed';
  END IF;
  IF (SELECT count(*) FROM knowledge.evolution_events WHERE metadata->>'seed_batch'=b
        AND time_precision='unknown' AND period_start IS NULL AND period_end IS NULL)<>2
     OR (SELECT count(*) FROM knowledge.evolution_events WHERE metadata->>'seed_batch'=b AND time_precision='month')<>1
     OR (SELECT count(*) FROM knowledge.evolution_events WHERE metadata->>'seed_batch'=b AND time_precision='day')<>3 THEN
    RAISE EXCEPTION 'Historical precision changed';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM registry.products WHERE slug='test-antigravity' AND lifecycle_status='archived' AND importance=0)
     OR (SELECT count(*) FROM registry.product_relations r JOIN registry.products a ON a.id=r.source_product_id
          JOIN registry.products c ON c.id=r.target_product_id WHERE a.slug='test-antigravity' AND c.slug='sensoria-portfolio'
          AND r.relation_type='predecessor_of' AND r.source=b)<>1 THEN
    RAISE EXCEPTION 'Archive or historical predecessor contract changed';
  END IF;
END;
$verify$;
SELECT 'origin-followup-583-588-v1' AS batch, 'passed' AS acceptance_checks;
