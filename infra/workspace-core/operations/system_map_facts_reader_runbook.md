# System Map reviewed-facts reader runbook

This runbook owns the credential lifecycle for
`health_monitor_system_map_reader`.

This credential is intentionally separate from
`health_monitor_workspace_reader`, which remains dedicated to Product
Evolution Review evidence. Migration 029 fail-closes on unexpected membership,
so adding a second capability to that principal would weaken an existing
single-purpose contract.

Never paste the password or a DSN containing it into GitHub, chat, SQL files,
shell arguments, screenshots, logs, or committed configuration.

## Preconditions

1. Issue #680 and its permission design have passed independent review.
2. `030_system_map_facts_reader.sql` has been applied to Workspace Core.
3. `verify_system_map_facts_reader.sql` passes as an administrative role.
4. Post-apply Supabase security/performance advisors show no new WARN/ERROR.
5. Health Monitor Issue #326 still expects the same four-table/column contract.

## Initial password and actual-login UAT

Use an administrative `psql` session and set the password interactively:

```text
\password health_monitor_system_map_reader
```

Before putting the DSN into Health Monitor, connect as the real principal. Do
not use `SET ROLE`; the UAT must load the principal's own role settings.

Use the project's real Pooler host from the Supabase connection settings:

```powershell
psql "host=<pooler-host> port=6543 dbname=postgres user=health_monitor_system_map_reader.<project-ref> sslmode=require" -W -f infra/workspace-core/operations/uat_system_map_facts_reader.sql
```

The `-W` prompt asks for the password without putting it in the command line.

The UAT asserts:

- actual `session_user/current_user`
- `default_transaction_read_only=on`
- `transaction_read_only=on`
- `search_path=registry, flow, pg_catalog`
- only the reviewed lifecycle/model/relation vocabularies are visible
- only the explicitly allowed columns are readable
- another Registry table, Flow steps, and Knowledge are denied
- writes are denied

Only after UAT passes, store the complete DSN on the Windows machine:

```powershell
uv run --directory core health-center credential set WORKSPACE_CORE_SYSTEM_MAP_DB_URL
```

Health Monitor Issue #326 must treat missing/unavailable credentials as an
optional overlay failure. The local System Map must still render.

## Rotation

This reader should open short-lived read-only connections only when reviewed
facts are explicitly requested/refreshed.

1. In an administrative `psql` session, run
   `\password health_monitor_system_map_reader`.
2. Run the actual-login UAT with the new password.
3. Replace `WORKSPACE_CORE_SYSTEM_MAP_DB_URL` using Health Monitor
   `credential set`.
4. Run one reviewed-facts refresh/read and confirm success.
5. Do not retain the old password in a file, environment variable, or fallback
   credential.

## Emergency revoke

If the credential may be exposed:

```sql
alter role health_monitor_system_map_reader nologin;
alter role health_monitor_system_map_reader password null;
revoke system_map_facts_reader from health_monitor_system_map_reader;

select pg_terminate_backend(pid)
from pg_stat_activity
where usename = 'health_monitor_system_map_reader'
  and pid <> pg_backend_pid();
```

Then remove the local credential:

```powershell
uv run --directory core health-center credential delete WORKSPACE_CORE_SYSTEM_MAP_DB_URL
```

## Recovery after emergency revoke

1. Re-run privileged verification and identify why containment was needed.
2. Restore only the intended membership:
   ```sql
   grant system_map_facts_reader
     to health_monitor_system_map_reader
     with admin false, inherit true, set false;
   alter role health_monitor_system_map_reader login;
   ```
3. Set a fresh password interactively with `\password`.
4. Run the actual-login UAT.
5. Store the new DSN with Health Monitor `credential set`.
6. Run one reviewed-facts refresh/read.
7. Record the incident/rotation without recording the secret.

## Responsibility boundary

- Workspace Core owner: role attributes, membership, RLS policies, grants,
  catalog verification, advisors, emergency database containment.
- Health Monitor owner: OS Credential Store value, read timeout/failure
  handling, credential deletion/replacement.
- GitHub/PRs: procedure and non-secret verification evidence only.
