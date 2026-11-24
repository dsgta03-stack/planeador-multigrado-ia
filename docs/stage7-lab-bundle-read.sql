-- LAB ONLY. No production. Read-only database function, SECURITY DEFINER
-- owned by the existing non-BYPASSRLS role. A verified actor must be set by
-- the authenticated Edge worker in the same transaction.
CREATE OR REPLACE FUNCTION multiplan_recovery.read_bundle(p_attempt uuid, p_run uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'multiplan_recovery', 'pg_temp'
AS $stage7$
DECLARE
  a multiplan_recovery.attempts;
  run_owner uuid;
  registered jsonb;
BEGIN
  IF multiplan_recovery.verified_actor_uid() IS NULL OR p_attempt IS NULL OR p_run IS NULL THEN
    RAISE EXCEPTION 'RECOVERY_FORBIDDEN' USING ERRCODE='42501';
  END IF;

  -- Existing forced RLS requires run ownership and attempt ownership.
  SELECT user_id INTO run_owner
  FROM public.plan_runs
  WHERE run_id=p_run AND user_id=multiplan_recovery.verified_actor_uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RECOVERY_FORBIDDEN' USING ERRCODE='42501';
  END IF;

  SELECT * INTO a
  FROM multiplan_recovery.attempts
  WHERE attempt_id=p_attempt AND run_id=p_run
    AND owner_id=multiplan_recovery.verified_actor_uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RECOVERY_FORBIDDEN' USING ERRCODE='42501';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'request_id', o.request_id,
    'family', o.family,
    'input_hash', o.input_hash,
    'code_version', o.code_version,
    'registered_revision', o.registered_revision,
    'supersedes', o.supersedes
  ) ORDER BY o.registered_revision, o.request_id), '[]'::jsonb)
  INTO registered
  FROM multiplan_recovery.operations o
  WHERE o.attempt_id=p_attempt;

  RETURN jsonb_build_object(
    'run_id',p_run,'run_owner_id',run_owner,
    'attempt_id',a.attempt_id,'attempt_owner_id',a.owner_id,
    'attempt_sources',a.sources,'attempt_bindings',a.bindings,
    'attempt_versions',a.versions,
    'state',multiplan_recovery.read_state(p_attempt),
    'registered_operations',registered,
    -- The synthetic plan_runs only hold lab_fixture/test_ordinal,
    -- not independently captured canonical curricula. Never fake them.
    'canonical_context_available',false,
    'canonical',null
  );
END;
$stage7$;
ALTER FUNCTION multiplan_recovery.read_bundle(uuid,uuid) OWNER TO multiplan_recovery_owner;
REVOKE ALL ON FUNCTION multiplan_recovery.read_bundle(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION multiplan_recovery.read_bundle(uuid,uuid) FROM anon;
REVOKE ALL ON FUNCTION multiplan_recovery.read_bundle(uuid,uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION multiplan_recovery.read_bundle(uuid,uuid) TO multiplan_recovery_executor;
